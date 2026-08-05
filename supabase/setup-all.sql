-- ============================================================
-- SHUGAR MOMMY — ПОЛНАЯ УСТАНОВКА БАЗЫ ЗА ОДИН РАЗ
--
-- Выполните ВЕСЬ этот файл в Supabase → SQL Editor → Run.
-- Скрипт безопасно перезапускать: всё создаётся «если ещё нет».
--
-- ПОСЛЕ ЗАПУСКА: выполните credentials.local.sql (создайте его из
-- credentials.example.sql), чтобы включить уведомления в Telegram.
--
-- Порядок важен: сначала таблица заявок, потом всё остальное,
-- потому что уведомления и политики ссылаются на неё.
-- ============================================================

create extension if not exists pgcrypto;

-- ============================================================
-- 0. КТО ТАКОЙ АДМИН
--
-- Один аккаунт студии. Все политики ниже ссылаются на эту функцию,
-- поэтому «просто вошедший пользователь» не получает доступ к заявкам.
-- Чтобы сменить админа — замените uid ниже (Supabase → Authentication →
-- Users → колонка UID) и выполните файл ещё раз.
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
-- 1. ЗАЯВКИ — основная таблица
-- ============================================================

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  customer_name text not null check (char_length(customer_name) between 1 and 120),
  phone text not null check (char_length(phone) between 5 and 32),
  services text not null check (char_length(services) between 1 and 1000),
  master text check (master is null or char_length(master) <= 120),
  visit_date date not null,
  visit_time text not null check (visit_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  total_price bigint not null default 0 check (total_price >= 0 and total_price <= 100000000),
  comment text check (comment is null or char_length(comment) <= 1000),
  status text not null default 'new' check (status in ('new', 'confirmed', 'done', 'cancelled'))
);

-- Источник заявки: Instagram, Telegram, Google, Прямой заход, UTM-метка.
alter table public.bookings
  add column if not exists source text
  check (source is null or char_length(source) <= 120);

-- Длительность визита в минутах. Одна запись занимает столько получасовых
-- ячеек, сколько нужно: «ноги полностью» — 50 минут, «ноги + глубокое
-- бикини» — 90. NULL допустим: старые записи сайт считает получасовыми.
alter table public.bookings
  add column if not exists duration_min integer default 30
  check (duration_min is null or duration_min between 5 and 600);

-- Время визита — только реальные часы 00:00–23:59. Ранняя версия проверки
-- пропускала '24:30'…'29:59', и такая строка роняла рассылку напоминаний.
-- NOT VALID: новые строки проверяются сразу, а уже сохранённый мусор
-- (если база не пустая) не мешает выполнить файл до конца.
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

create index if not exists bookings_created_at_idx on public.bookings (created_at desc);
create index if not exists bookings_visit_date_idx on public.bookings (visit_date);

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

alter table public.bookings enable row level security;

-- Клиентки (anon) могут только создавать заявки.
drop policy if exists "anon can insert bookings" on public.bookings;
create policy "anon can insert bookings"
  on public.bookings for insert
  to anon
  with check (status = 'new');

-- Читать, менять статусы и удалять может только админ студии.
-- using (true) здесь нельзя: тогда доступ получил бы ЛЮБОЙ аккаунт Supabase.
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
-- 2. УВЕДОМЛЕНИЯ В TELEGRAM при каждой новой записи
-- ============================================================

create extension if not exists pg_net with schema extensions;

create table if not exists public.notification_config (
  id text primary key,
  bot_token text not null,
  chat_id text not null
);
alter table public.notification_config enable row level security;
-- Политик нет намеренно: таблица недоступна через REST никому.

-- Токен бота и chat_id НЕ хранятся в репозитории. Впишите их один раз
-- отдельным файлом supabase/credentials.local.sql — см. его шаблон
-- credentials.example.sql. Пока строки нет, уведомления просто молчат.

create or replace function public.notify_telegram_on_booking()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  cfg record;
  msg text;
  url text;
  body jsonb;
  -- Поля клиентки экранируются для parse_mode=HTML, иначе <, >, &
  -- из имени или комментария могли бы вставить теги в сообщение админу.
begin
  select bot_token, chat_id into cfg from public.notification_config where id = 'telegram';
  if cfg is null or cfg.bot_token is null or cfg.chat_id is null then
    return new;
  end if;

  msg := format(
    E'💆‍♀️ <b>Новая запись Shugar Mommy</b>\n\n👤 %s\n📞 %s\n✨ %s\n👩‍🔬 %s\n📅 %s · 🕐 %s\n💰 %s сум\n\n#%s',
    replace(replace(replace(coalesce(new.customer_name, '—'), '&', '&amp;'), '<', '&lt;'), '>', '&gt;'),
    replace(replace(replace(coalesce(new.phone, '—'), '&', '&amp;'), '<', '&lt;'), '>', '&gt;'),
    replace(replace(replace(coalesce(new.services, '—'), '&', '&amp;'), '<', '&lt;'), '>', '&gt;'),
    replace(replace(replace(coalesce(new.master, 'Любой мастер'), '&', '&amp;'), '<', '&lt;'), '>', '&gt;'),
    to_char(new.visit_date, 'DD.MM.YYYY'),
    coalesce(new.visit_time, '—'),
    to_char(coalesce(new.total_price, 0), 'FM999G999G999'),
    substring(new.id::text, 1, 8)
  );

  url := 'https://api.telegram.org/bot' || cfg.bot_token || '/sendMessage';
  body := jsonb_build_object(
    'chat_id', cfg.chat_id,
    'text', msg,
    'parse_mode', 'HTML',
    'disable_web_page_preview', true
  );

  perform net.http_post(
    url := url,
    body := body,
    headers := '{"Content-Type": "application/json"}'::jsonb
  );

  return new;
end;
$$;

drop trigger if exists trg_notify_telegram on public.bookings;
create trigger trg_notify_telegram
after insert on public.bookings
for each row execute function public.notify_telegram_on_booking();

-- ============================================================
-- 3. ЗАНЯТОСТЬ СЛОТОВ — блокировки и свободное время
-- ============================================================

create table if not exists public.blocked_slots (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  block_date date not null,
  -- NULL = заблокирован весь день
  block_time text check (block_time is null or block_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  master text,
  reason text check (reason is null or char_length(reason) <= 200)
);

create index if not exists blocked_slots_date_idx on public.blocked_slots (block_date);

-- Как и у заявок: только реальные часы 00:00–23:59.
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

alter table public.blocked_slots enable row level security;

-- Читать может кто угодно: это просто «занято», без персональных данных.
drop policy if exists "anyone can read blocked slots" on public.blocked_slots;
create policy "anyone can read blocked slots"
  on public.blocked_slots for select
  to anon, authenticated
  using (true);

-- Создавать и удалять блокировки может только админ студии.
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

-- Занятое время из записей. SECURITY DEFINER обходит RLS таблицы bookings,
-- но отдаёт ТОЛЬКО время, мастера и длительность — никаких имён, телефонов,
-- комментариев.
--
-- DROP перед CREATE: на базе с прежней версией функции (две колонки)
-- create or replace не смог бы поменять набор возвращаемых колонок.
-- DROP снимает и права, поэтому GRANT ниже обязателен.
drop function if exists public.booked_slots(date);

create function public.booked_slots(target_date date)
returns table (visit_time text, master text, duration_min integer)
language sql
security definer
set search_path = public
stable
as $$
  select b.visit_time, b.master, coalesce(b.duration_min, 30)
  from public.bookings b
  where b.visit_date = target_date
    and b.status in ('new', 'confirmed');
$$;

revoke all on function public.booked_slots(date) from public;
grant execute on function public.booked_slots(date) to anon, authenticated;

-- ============================================================
-- 4. ОТМЕНА ЗАПИСИ клиенткой через сайт
-- ============================================================

-- Клиентка вводит телефон и дату визита; функция отменяет её активные
-- записи. Личные данные наружу не отдаются — только число отменённых.
create or replace function public.cancel_booking(customer_phone text, target_date date)
returns integer
language plpgsql
security definer
set search_path = public
as $function$
declare
  digits text;
  affected integer;
begin
  -- [^0-9] вместо \D: без обратных слешей, чтобы не зависеть
  -- от настроек экранирования строк.
  digits := regexp_replace(coalesce(customer_phone, ''), '[^0-9]', '', 'g');

  -- Слишком короткий номер — не пытаемся угадывать, ничего не отменяем.
  if char_length(digits) < 9 then
    return 0;
  end if;

  -- Сравниваем 9 последних цифр (узбекский абонентский номер): запись,
  -- сделанную как «+998 90 123-45-67», отменяет ввод «90 123 45 67».
  update public.bookings b
  set status = 'cancelled'
  where b.visit_date = target_date
    and b.status in ('new', 'confirmed')
    and right(regexp_replace(b.phone, '[^0-9]', '', 'g'), 9) = right(digits, 9);

  get diagnostics affected = row_count;
  return affected;
end;
$function$;

revoke all on function public.cancel_booking(text, date) from public;
-- Вызывается клиенткой с сайта без входа — доступ остаётся публичным.
grant execute on function public.cancel_booking(text, date) to anon, authenticated;

notify pgrst, 'reload schema';

-- ============================================================
-- ГОТОВО. Проверьте: Table Editor → должны быть bookings и blocked_slots.
-- Затем Authentication → Users → Add user (это вход в админку),
-- и Authentication → Sign In / Up → выключите «Allow new users to sign up».
--
-- Напоминания в Telegram ставятся отдельно: 07_reminders.sql
-- (нужны расширения pg_cron и pg_net).
-- Уже установленную базу обновляют 08_hardening_v3.sql, затем
-- 09_visit_duration.sql (длительность визита).
-- ============================================================
