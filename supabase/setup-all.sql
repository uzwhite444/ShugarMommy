-- ============================================================
-- SHUGAR MOMMY — ПОЛНАЯ УСТАНОВКА БАЗЫ ЗА ОДИН РАЗ
--
-- Выполните ВЕСЬ этот файл в Supabase → SQL Editor → Run.
-- Скрипт безопасно перезапускать: всё создаётся «если ещё нет».
--
-- ПЕРЕД ЗАПУСКОМ: замените BOT_TOKEN и CHAT_ID в блоке 2
-- (или используйте файл setup-all.local.sql, где они уже вписаны).
--
-- Порядок важен: сначала таблица заявок, потом всё остальное,
-- потому что уведомления и политики ссылаются на неё.
-- ============================================================

create extension if not exists pgcrypto;

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
  visit_time text not null check (visit_time ~ '^[0-2][0-9]:[0-5][0-9]$'),
  total_price bigint not null default 0 check (total_price >= 0 and total_price <= 100000000),
  comment text check (comment is null or char_length(comment) <= 1000),
  status text not null default 'new' check (status in ('new', 'confirmed', 'done', 'cancelled'))
);

-- Источник заявки: Instagram, Telegram, Google, Прямой заход, UTM-метка.
alter table public.bookings
  add column if not exists source text
  check (source is null or char_length(source) <= 120);

create index if not exists bookings_created_at_idx on public.bookings (created_at desc);
create index if not exists bookings_visit_date_idx on public.bookings (visit_date);

alter table public.bookings enable row level security;

-- Клиентки (anon) могут только создавать заявки.
drop policy if exists "anon can insert bookings" on public.bookings;
create policy "anon can insert bookings"
  on public.bookings for insert
  to anon
  with check (status = 'new');

-- Читать, менять статусы и удалять может только вошедший админ.
drop policy if exists "authenticated can read bookings" on public.bookings;
create policy "authenticated can read bookings"
  on public.bookings for select
  to authenticated
  using (true);

drop policy if exists "authenticated can update bookings" on public.bookings;
create policy "authenticated can update bookings"
  on public.bookings for update
  to authenticated
  using (true)
  with check (status in ('new', 'confirmed', 'done', 'cancelled'));

drop policy if exists "authenticated can delete bookings" on public.bookings;
create policy "authenticated can delete bookings"
  on public.bookings for delete
  to authenticated
  using (true);

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

-- ЗАМЕНИТЕ значения ниже на свои перед запуском.
insert into public.notification_config (id, bot_token, chat_id)
values ('telegram', 'BOT_TOKEN', 'CHAT_ID')
on conflict (id) do update set
  bot_token = excluded.bot_token,
  chat_id   = excluded.chat_id;

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
  block_time text check (block_time is null or block_time ~ '^[0-2][0-9]:[0-5][0-9]$'),
  master text,
  reason text check (reason is null or char_length(reason) <= 200)
);

create index if not exists blocked_slots_date_idx on public.blocked_slots (block_date);

alter table public.blocked_slots enable row level security;

-- Читать может кто угодно: это просто «занято», без персональных данных.
drop policy if exists "anyone can read blocked slots" on public.blocked_slots;
create policy "anyone can read blocked slots"
  on public.blocked_slots for select
  to anon, authenticated
  using (true);

drop policy if exists "authenticated can insert blocked slots" on public.blocked_slots;
create policy "authenticated can insert blocked slots"
  on public.blocked_slots for insert
  to authenticated
  with check (true);

drop policy if exists "authenticated can delete blocked slots" on public.blocked_slots;
create policy "authenticated can delete blocked slots"
  on public.blocked_slots for delete
  to authenticated
  using (true);

-- Занятое время из записей. SECURITY DEFINER обходит RLS таблицы bookings,
-- но отдаёт ТОЛЬКО время и мастера — никаких имён, телефонов, комментариев.
create or replace function public.booked_slots(target_date date)
returns table (visit_time text, master text)
language sql
security definer
set search_path = public
stable
as $$
  select b.visit_time, b.master
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

  if char_length(digits) < 7 then
    return 0;
  end if;

  update public.bookings b
  set status = 'cancelled'
  where b.visit_date = target_date
    and b.status in ('new', 'confirmed')
    and regexp_replace(b.phone, '[^0-9]', '', 'g') = digits;

  get diagnostics affected = row_count;
  return affected;
end;
$function$;

revoke all on function public.cancel_booking(text, date) from public;
grant execute on function public.cancel_booking(text, date) to anon, authenticated;

-- ============================================================
-- ГОТОВО. Проверьте: Table Editor → должны быть bookings и blocked_slots.
-- Затем Authentication → Users → Add user (это вход в админку),
-- и Authentication → Sign In / Up → выключите «Allow new users to sign up».
-- ============================================================
