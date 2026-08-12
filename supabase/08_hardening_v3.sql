-- ============================================================
-- SHUGAR MOMMY — обновление безопасности v3
--
-- Выполните ВЕСЬ этот файл в Supabase → SQL Editor → Run.
-- Он ОБНОВЛЯЕТ уже установленную базу до состояния setup-all.sql.
-- Скрипт безопасно перезапускать: всё делается «если ещё нет».
--
-- На ПУСТОЙ базе сначала выполните setup-all.sql — этот файл ожидает,
-- что таблицы bookings и blocked_slots уже существуют.
--
-- Что чинит:
--   1. Доступ админа. Раньше ЛЮБОЙ вошедший пользователь мог читать,
--      менять и удалять заявки клиенток. Теперь — только uid студии.
--   2. Права на функции. link_telegram и send_visit_reminders больше
--      нельзя вызвать публичным anon-ключом.
--   3. Отмена записи. Номер сверяется по последним 9 цифрам, поэтому
--      «90 123 45 67» отменяет запись, сделанную как «+998 90 123-45-67».
--   4. Время визита. '24:30' больше не проходит проверку и не роняет
--      рассылку напоминаний.
--   5. Двойная запись и спам. Один слот — одна запись, плюс лимит
--      заявок с одного номера.
-- ============================================================

-- ============================================================
-- 1. КТО ТАКОЙ АДМИН
--
-- Один аккаунт студии. Чтобы сменить админа — замените uid ниже
-- (Supabase → Authentication → Users → колонка UID) и выполните файл ещё раз.
-- ============================================================

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $function$
  -- nuuuu391@gmail.com — единственный аккаунт админ-панели.
  select coalesce(auth.uid() = 'bbdcddcf-7164-4ed7-bf8e-924d75656870'::uuid, false);
$function$;

revoke all on function public.is_admin() from public;
revoke execute on function public.is_admin() from anon;
grant execute on function public.is_admin() to authenticated;

-- ============================================================
-- 2. ПОЛИТИКИ ЗАЯВОК — только админ, а не любой вошедший
-- ============================================================

alter table public.bookings enable row level security;

-- Прямая вставка от anon СНЯТА в 13_lock_anon_insert.sql: цену считает
-- сервер в create_booking(), а политика позволяла прислать любую сумму.
-- Здесь остаётся только drop, иначе повторный запуск этого файла вернул бы
-- обход пересчёта.
drop policy if exists "anon can insert bookings" on public.bookings;

drop policy if exists "authenticated can read bookings" on public.bookings;
drop policy if exists "admin can read bookings" on public.bookings;
create policy "admin can read bookings"
  on public.bookings for select
  to authenticated
  using (public.is_admin());

drop policy if exists "authenticated can update bookings" on public.bookings;
drop policy if exists "admin can update bookings" on public.bookings;
create policy "admin can update bookings"
  on public.bookings for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin() and status in ('new', 'confirmed', 'done', 'cancelled'));

drop policy if exists "authenticated can delete bookings" on public.bookings;
drop policy if exists "admin can delete bookings" on public.bookings;
create policy "admin can delete bookings"
  on public.bookings for delete
  to authenticated
  using (public.is_admin());

-- ============================================================
-- 3. ПОЛИТИКИ БЛОКИРОВОК — читают все, меняет только админ
-- ============================================================

alter table public.blocked_slots enable row level security;

drop policy if exists "anyone can read blocked slots" on public.blocked_slots;
create policy "anyone can read blocked slots"
  on public.blocked_slots for select
  to anon, authenticated
  using (true);

drop policy if exists "authenticated can insert blocked slots" on public.blocked_slots;
drop policy if exists "admin can insert blocked slots" on public.blocked_slots;
create policy "admin can insert blocked slots"
  on public.blocked_slots for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "authenticated can delete blocked slots" on public.blocked_slots;
drop policy if exists "admin can delete blocked slots" on public.blocked_slots;
create policy "admin can delete blocked slots"
  on public.blocked_slots for delete
  to authenticated
  using (public.is_admin());

-- ============================================================
-- 4. ВРЕМЯ ВИЗИТА — только реальные часы 00:00–23:59
--
-- Старая проверка '^[0-2][0-9]:[0-5][0-9]$' пропускала '24:30'…'29:59'.
-- Такая строка ломала пересчёт в timestamp внутри рассылки напоминаний.
-- Ограничение добавляется как NOT VALID: новые строки проверяются сразу,
-- а уже сохранённый мусор не мешает выполнить этот файл до конца.
-- ============================================================

alter table public.bookings drop constraint if exists bookings_visit_time_check;
alter table public.bookings drop constraint if exists bookings_visit_time_valid;
alter table public.bookings
  add constraint bookings_visit_time_valid
  check (visit_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$') not valid;

do $$
begin
  alter table public.bookings validate constraint bookings_visit_time_valid;
exception when check_violation then
  raise warning 'В bookings есть записи с некорректным visit_time. Найдите их: select id, visit_date, visit_time from public.bookings where visit_time !~ ''^([01][0-9]|2[0-3]):[0-5][0-9]$'';';
end $$;

alter table public.blocked_slots drop constraint if exists blocked_slots_block_time_check;
alter table public.blocked_slots drop constraint if exists blocked_slots_block_time_valid;
alter table public.blocked_slots
  add constraint blocked_slots_block_time_valid
  check (block_time is null or block_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$') not valid;

do $$
begin
  alter table public.blocked_slots validate constraint blocked_slots_block_time_valid;
exception when check_violation then
  raise warning 'В blocked_slots есть блокировки с некорректным block_time — удалите их, затем выполните: alter table public.blocked_slots validate constraint blocked_slots_block_time_valid;';
end $$;

-- ============================================================
-- 5. ОДИН СЛОТ — ОДНА ЗАПИСЬ + защита от спама
-- ============================================================

-- Проверка занятости на сайте и вставка — два разных запроса, между ними
-- слот могли занять. Индекс закрывает эту щель на уровне базы: вторая
-- запись падает с SQLSTATE 23505, клиент показывает «время занято».
do $$
begin
  create unique index if not exists bookings_slot_uniq
    on public.bookings (visit_date, visit_time, (coalesce(master, '')))
    where status in ('new', 'confirmed');
exception when unique_violation then
  raise warning 'Индекс bookings_slot_uniq не создан: в базе уже есть две активные записи на один слот. Найдите их: select visit_date, visit_time, coalesce(master, '''') as m, count(*) from public.bookings where status in (''new'', ''confirmed'') group by 1, 2, 3 having count(*) > 1;';
end $$;

-- Мягкий анти-флуд: обычная клиентка записывается 1–2 раза и лимитов
-- не замечает, а скрипт не сможет забить весь календарь.
create or replace function public.bookings_antiflood()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  max_active    constant integer  := 5;
  max_recent    constant integer  := 3;
  recent_window constant interval := interval '10 minutes';
  digits text;
  active_count integer;
  recent_count integer;
begin
  -- Админ заводит записи руками из панели — лимиты на него не действуют.
  if public.is_admin() then
    return new;
  end if;

  -- [^0-9] вместо \D: без обратных слешей, чтобы не зависеть
  -- от настроек экранирования строк.
  digits := regexp_replace(coalesce(new.phone, ''), '[^0-9]', '', 'g');
  if char_length(digits) < 9 then
    return new;
  end if;

  select count(*) into active_count
  from public.bookings b
  where b.status in ('new', 'confirmed')
    and b.visit_date >= (now() at time zone 'Asia/Tashkent')::date
    and right(regexp_replace(b.phone, '[^0-9]', '', 'g'), 9) = right(digits, 9);

  if active_count >= max_active then
    raise exception 'booking limit: too many active bookings for this phone';
  end if;

  select count(*) into recent_count
  from public.bookings b
  where b.created_at > now() - recent_window
    and right(regexp_replace(b.phone, '[^0-9]', '', 'g'), 9) = right(digits, 9);

  if recent_count >= max_recent then
    raise exception 'booking limit: too many booking attempts, try again later';
  end if;

  return new;
end;
$function$;

drop trigger if exists trg_bookings_antiflood on public.bookings;
create trigger trg_bookings_antiflood
before insert on public.bookings
for each row execute function public.bookings_antiflood();

-- ============================================================
-- 6. ОТМЕНА ЗАПИСИ
--
-- Здесь раньше создавалась cancel_booking(телефон, дата). Она отменяла
-- чужую запись по одному лишь номеру и дате и по коду возврата выдавала,
-- есть ли у номера визит. Функция УДАЛЕНА в 11_cancel_by_code.sql, и
-- воссоздавать её тут нельзя: этот файл README разрешает перезапускать,
-- а перезапуск вернул бы дыру. Актуальная отмена — по коду заявки плюс
-- телефон, см. 11_cancel_by_code.sql.
-- ============================================================

drop function if exists public.cancel_booking(text, date);

-- Занятость слотов сайту тоже нужна без входа — оставляем публичной.
revoke all on function public.booked_slots(date) from public;
grant execute on function public.booked_slots(date) to anon, authenticated;

-- ============================================================
-- 7. НАПОМИНАНИЯ — права и устойчивость рассылки
--
-- В Supabase роли anon и authenticated получают EXECUTE явно, поэтому
-- «revoke from public» их не отзывал: обе функции оставались доступны
-- через публичный anon-ключ. link_telegram по чужому id записи
-- перенаправляла напоминание (имя, услуги, мастер, время) в чужой Telegram.
--
-- Колонки добавляются здесь же, чтобы файл выполнялся и на базе,
-- где 07_reminders.sql ещё не запускали.
-- ============================================================

alter table public.bookings
  add column if not exists telegram_chat_id text
  check (telegram_chat_id is null or char_length(telegram_chat_id) <= 32);

alter table public.bookings
  add column if not exists reminder_sent_at timestamptz;

create or replace function public.link_telegram(booking_id uuid, chat_id text)
returns boolean
language plpgsql
security definer
set search_path = public
as $function$
declare
  affected integer;
begin
  update public.bookings
  set telegram_chat_id = chat_id
  where id = booking_id
    and status in ('new', 'confirmed');
  get diagnostics affected = row_count;
  return affected > 0;
end;
$function$;

revoke all on function public.link_telegram(uuid, text) from public;
revoke execute on function public.link_telegram(uuid, text) from anon, authenticated;
-- Вызывается только сервисным ключом из Edge Function telegram-webhook.
grant execute on function public.link_telegram(uuid, text) to service_role;

-- Одна кривая запись не должна ронять весь проход рассылки:
-- крон ходит каждые 5 минут, и раньше одна ошибка отменяла всю пачку.
create or replace function public.send_visit_reminders()
returns integer
language plpgsql
security definer
set search_path = public, extensions
as $function$
declare
  cfg record;
  b record;
  visit_at timestamptz;
  msg text;
  sent integer := 0;
begin
  select bot_token into cfg from public.notification_config where id = 'telegram';
  if cfg is null or cfg.bot_token is null then
    return 0;
  end if;

  for b in
    select id, customer_name, services, master, visit_date, visit_time, telegram_chat_id
    from public.bookings
    where status in ('new', 'confirmed')
      and telegram_chat_id is not null
      and reminder_sent_at is null
      and visit_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
      and visit_date between (now() at time zone 'Asia/Tashkent')::date
                         and ((now() at time zone 'Asia/Tashkent') + interval '1 day')::date
  loop
    -- Момент визита в реальном времени (местное время студии). Старые записи
    -- могли сохранить невозможное время, поэтому приведение типа обёрнуто:
    -- испорченная строка пропускается, рассылка продолжается.
    begin
      visit_at := (b.visit_date::text || ' ' || b.visit_time || ':00')::timestamp
                  at time zone 'Asia/Tashkent';
    exception when others then
      raise warning 'send_visit_reminders: запись % — некорректное время (%)', b.id, sqlerrm;
      visit_at := null;
    end;

    continue when visit_at is null;

    -- Окно 45–75 минут до визита: планировщик ходит каждые 5 минут,
    -- поэтому каждая запись попадает в него ровно один раз.
    continue when visit_at - now() > interval '75 minutes'
              or visit_at - now() < interval '45 minutes';

    begin
      msg := format(
        E'⏰ <b>Напоминание о визите</b>\n\n%s, ждём вас через час!\n\n✨ %s\n👩‍🔬 %s\n🕐 Сегодня в %s\n\nЕсли планы изменились — отмените запись на сайте: https://shugarmommy.vercel.app/#/cancel',
        replace(replace(replace(coalesce(b.customer_name, ''), '&', '&amp;'), '<', '&lt;'), '>', '&gt;'),
        replace(replace(replace(coalesce(b.services, '—'), '&', '&amp;'), '<', '&lt;'), '>', '&gt;'),
        replace(replace(replace(coalesce(b.master, 'мастер студии'), '&', '&amp;'), '<', '&lt;'), '>', '&gt;'),
        b.visit_time
      );

      perform net.http_post(
        url := 'https://api.telegram.org/bot' || cfg.bot_token || '/sendMessage',
        body := jsonb_build_object(
          'chat_id', b.telegram_chat_id,
          'text', msg,
          'parse_mode', 'HTML',
          'disable_web_page_preview', true
        ),
        headers := '{"Content-Type": "application/json"}'::jsonb
      );

      update public.bookings set reminder_sent_at = now() where id = b.id;
      sent := sent + 1;
    exception when others then
      raise warning 'send_visit_reminders: запись % пропущена (%)', b.id, sqlerrm;
    end;
  end loop;

  return sent;
end;
$function$;

revoke all on function public.send_visit_reminders() from public;
-- Вызывается только планировщиком pg_cron.
revoke execute on function public.send_visit_reminders() from anon, authenticated;

notify pgrst, 'reload schema';

-- ============================================================
-- ГОТОВО. Проверка: обе строки должны вернуть 0, а не ошибку.
-- ============================================================
select public.cancel_booking('123', current_date) as short_phone_should_be_zero;

select count(*) as overbroad_admin_policies_should_be_zero
from pg_policies
where schemaname = 'public'
  and tablename in ('bookings', 'blocked_slots')
  and roles = '{authenticated}'
  and coalesce(qual, with_check) = 'true';
