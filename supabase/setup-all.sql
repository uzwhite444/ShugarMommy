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
  check (duration_min is null or duration_min between 5 and 720);

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

-- Клиентки (anon) НЕ пишут в таблицу напрямую. Единственная дверь для сайта —
-- функция create_booking() из раздела 5: она сама считает цену и длительность,
-- а клиент присылает только состав зон.
--
-- Политики на INSERT здесь нет намеренно. Пока она есть, заявку можно создать
-- в обход расчёта — с суммой 0 или 99 999 999, — и отчёты студии станут враньём.
drop policy if exists "anon can insert bookings" on public.bookings;
revoke insert on public.bookings from anon;

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
  -- Ключ сравнения: последние 9 цифр у нормального номера, иначе — сама
  -- строка. Ранняя версия при коротком номере ВЫХОДИЛА БЕЗ ПРОВЕРОК, и
  -- телефон вроде «1234567» отключал лимиты целиком (10_antiflood_fix.sql).
  key_expr text;
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

  if char_length(digits) >= 9 then
    key_expr := right(digits, 9);

    select count(*) into active_count
    from public.bookings b
    where b.status in ('new', 'confirmed')
      and b.visit_date >= (now() at time zone 'Asia/Tashkent')::date
      and char_length(regexp_replace(b.phone, '[^0-9]', '', 'g')) >= 9
      and right(regexp_replace(b.phone, '[^0-9]', '', 'g'), 9) = key_expr;

    select count(*) into recent_count
    from public.bookings b
    where b.created_at > now() - recent_window
      and char_length(regexp_replace(b.phone, '[^0-9]', '', 'g')) >= 9
      and right(regexp_replace(b.phone, '[^0-9]', '', 'g'), 9) = key_expr;
  else
    -- Телефон непригоден для сверки по цифрам — считаем по точной строке.
    key_expr := coalesce(new.phone, '');

    select count(*) into active_count
    from public.bookings b
    where b.status in ('new', 'confirmed')
      and b.visit_date >= (now() at time zone 'Asia/Tashkent')::date
      and coalesce(b.phone, '') = key_expr;

    select count(*) into recent_count
    from public.bookings b
    where b.created_at > now() - recent_window
      and coalesce(b.phone, '') = key_expr;
  end if;

  if active_count >= max_active then
    raise exception 'booking limit: too many active bookings for this phone';
  end if;

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

-- Телефон должен содержать хотя бы 7 цифр, иначе позвонить по нему нельзя,
-- а значит запись бесполезна и студии, и клиентке.
-- NOT VALID: уже сохранённые записи не мешают выполнить файл.
alter table public.bookings drop constraint if exists bookings_phone_digits;
alter table public.bookings
  add constraint bookings_phone_digits
  check (char_length(regexp_replace(phone, '[^0-9]', '', 'g')) >= 7) not valid;

do $$
begin
  alter table public.bookings validate constraint bookings_phone_digits;
exception when check_violation then
  raise warning 'В bookings есть записи с телефоном короче 7 цифр. Найдите их: select id, phone from public.bookings where char_length(regexp_replace(phone, ''[^0-9]'', '''', ''g'')) < 7;';
end $$;

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
-- 4. ОТМЕНА ЗАПИСИ клиенткой через сайт — по КОДУ ЗАЯВКИ
--
-- Отмена требует ДВА фактора: код заявки (первые 8 знаков id — их видит
-- только сама клиентка на экране подтверждения и в напоминании бота) И
-- телефон, с которого делалась запись.
--
-- Прежняя версия принимала телефон + дату и отменяла чужую запись любому,
-- кто знает номер. Она удалена ниже: пока такая функция существует в базе,
-- дыра открыта, даже если сайт её больше не вызывает.
--
-- Почему 8 знаков: 16^8 = 4 294 967 296 вариантов. С ограничением
-- 5 попыток на номер за 15 минут перебор половины пространства занял бы
-- порядка 12 000 лет. Длиннее — только опечатки при диктовке по телефону.
-- ============================================================

drop function if exists public.cancel_booking(text, date);

-- Счётчик неудачных попыток: защита от подбора кода.
create table if not exists public.cancel_attempts (
  -- Последние 9 цифр номера, либо сам набор цифр, если их меньше девяти.
  phone_key text primary key,
  failed_count integer not null default 0,
  first_failed_at timestamptz not null default now(),
  last_failed_at timestamptz not null default now()
);

alter table public.cancel_attempts enable row level security;
-- Политик нет намеренно: через REST таблица недоступна никому. Пишет в неё
-- только функция ниже — она SECURITY DEFINER и работает от владельца.
revoke all on table public.cancel_attempts from anon, authenticated;

create or replace function public.cancel_booking_by_code(booking_code text, customer_phone text)
returns text
language plpgsql
security definer
set search_path = public
as $function$
declare
  max_failed  constant integer  := 5;
  fail_window constant interval := interval '15 minutes';
  code text;
  digits text;
  match_key text;
  blocked boolean;
  affected integer;
begin
  -- [^0-9a-f] и [^0-9] вместо \w и \d: без обратных слешей, чтобы не
  -- зависеть от настроек экранирования строк.
  -- Клиентка может прислать «3F7A-9C21», «3f7a 9c21» или весь id из ссылки.
  code := regexp_replace(lower(coalesce(booking_code, '')), '[^0-9a-f]', '', 'g');
  digits := regexp_replace(coalesce(customer_phone, ''), '[^0-9]', '', 'g');

  -- Заведомо негодный ввод: попытка не засчитывается — подбором это быть
  -- не может, а честную клиентку с опечаткой блокировать не за что.
  if char_length(code) < 8 or char_length(digits) < 7 then
    return 'not_found';
  end if;

  code := left(code, 8);
  -- Тот же ключ сравнения, что у анти-спама: запись, сделанную как
  -- «+998 90 123-45-67», отменяет ввод «90 123 45 67».
  match_key := case when char_length(digits) >= 9 then right(digits, 9) else digits end;

  select (a.failed_count >= max_failed and a.last_failed_at > now() - fail_window)
    into blocked
  from public.cancel_attempts a
  where a.phone_key = match_key;

  if coalesce(blocked, false) then
    return 'throttled';
  end if;

  -- Оба условия обязательны. left(id::text, 8) — первые 8 знаков UUID,
  -- ровно то, что показано клиентке как «код записи».
  update public.bookings b
  set status = 'cancelled'
  where b.status in ('new', 'confirmed')
    and left(b.id::text, 8) = code
    and case
          when char_length(regexp_replace(b.phone, '[^0-9]', '', 'g')) >= 9
            then right(regexp_replace(b.phone, '[^0-9]', '', 'g'), 9)
          else regexp_replace(b.phone, '[^0-9]', '', 'g')
        end = match_key;

  get diagnostics affected = row_count;

  if affected > 0 then
    delete from public.cancel_attempts where phone_key = match_key;
    return 'ok';
  end if;

  -- Не совпало — засчитываем попытку. Окно скользящее: после 15 минут
  -- тишины счётчик начинается заново.
  insert into public.cancel_attempts as a (phone_key, failed_count, first_failed_at, last_failed_at)
  values (match_key, 1, now(), now())
  on conflict (phone_key) do update
    set failed_count = case
          when a.last_failed_at < now() - fail_window then 1
          else a.failed_count + 1
        end,
        first_failed_at = case
          when a.last_failed_at < now() - fail_window then now()
          else a.first_failed_at
        end,
        last_failed_at = now();

  -- Уборка: таблица не должна расти вечно.
  delete from public.cancel_attempts where last_failed_at < now() - interval '1 day';

  return 'not_found';
end;
$function$;

revoke all on function public.cancel_booking_by_code(text, text) from public;
-- Вызывается клиенткой с сайта без входа — доступ остаётся публичным,
-- но теперь он ничего не даёт без кода заявки.
grant execute on function public.cancel_booking_by_code(text, text) to anon, authenticated;

-- >>> НАЧАЛО СГЕНЕРИРОВАННОГО БЛОКА — npm run pricing:sql >>>

-- ============================================================
-- 5. ЦЕНУ ЗАЯВКИ СЧИТАЕТ СЕРВЕР
--
-- Прайс, скидки и сеты живут в src/data.ts. Блок ниже — их копия в базе,
-- порождённая генератором (`npm run pricing:sql`) из того же файла, плюс
-- сам расчёт. Руками этот блок не правят: генерация перезапишет, а
-- `npm run build` упадёт раньше — на проверке pricing:check.
-- ============================================================

-- ------------------------------------------------------------
-- СПРАВОЧНИК ЦЕН — КОПИЯ src/data.ts
--
-- Эти пять таблиц заполняет генератор (npm run pricing:sql), а не человек.
-- Цену правят В ОДНОМ МЕСТЕ — в src/data.ts; SQL из него порождается.
-- Если поправить цену здесь руками, следующая генерация её сотрёт, а
-- `npm run build` упадёт раньше — на проверке pricing:check.
--
-- RLS включён, политик нет: через REST таблицы недоступны никому. Читает
-- их только функция расчёта — она SECURITY DEFINER и работает от владельца.
-- ------------------------------------------------------------

create table if not exists public.pricing_zones (
  zone_id      text primary key,
  -- Самая низкая цена зоны среди всех прайсов — то самое «от», которое сайт
  -- показывает для «любого мастера». NULL = цены нет ни у кого («по запросу»),
  -- и такая зона НЕ входит в сумму.
  floor_price  bigint,
  -- Оценка длительности. Сумма по зонам решает, сколько получасовых ячеек
  -- занимает визит, поэтому завышенная длительность с клиента — это захват
  -- чужого времени, а не косметика.
  duration_min integer not null default 0
);

create table if not exists public.pricing_masters (
  -- RU-написание имени: ровно то, что лежит в bookings.master.
  master_key         text primary key,
  -- Порядок из MASTERS. Нужен, чтобы «любой мастер» при равной сумме выбирал
  -- того же мастера, что и сайт: там перебор идёт по массиву и побеждает первый.
  sort_order         integer not null,
  -- NULL = процентной скидки у неё нет вовсе (Рената). Это позиция студии,
  -- а не «ноль по умолчанию».
  discount_min_zones integer,
  discount_pct       integer
);

create table if not exists public.pricing_master_zones (
  master_key text not null references public.pricing_masters(master_key) on delete cascade,
  zone_id    text not null references public.pricing_zones(zone_id) on delete cascade,
  -- NULL = мастер зону ДЕЛАЕТ, но цены студия не дала («по запросу»).
  -- Строки нет вовсе = мастер эту зону не делает. Разница важна: в первом
  -- случае зону можно записать к ней, во втором — нет.
  price      bigint,
  primary key (master_key, zone_id)
);

create table if not exists public.pricing_sets (
  set_id     text primary key,
  master_key text not null references public.pricing_masters(master_key) on delete cascade,
  price      bigint not null
);

create table if not exists public.pricing_set_zones (
  set_id  text not null references public.pricing_sets(set_id) on delete cascade,
  zone_id text not null references public.pricing_zones(zone_id) on delete cascade,
  primary key (set_id, zone_id)
);

alter table public.pricing_zones        enable row level security;
alter table public.pricing_masters      enable row level security;
alter table public.pricing_master_zones enable row level security;
alter table public.pricing_sets         enable row level security;
alter table public.pricing_set_zones    enable row level security;

revoke all on table
  public.pricing_zones,
  public.pricing_masters,
  public.pricing_master_zones,
  public.pricing_sets,
  public.pricing_set_zones
from anon, authenticated;

-- ------------------------------------------------------------
-- САМ ПРАЙС (сгенерирован из src/data.ts)
-- ------------------------------------------------------------

-- Порядок удаления обратен ссылкам: сначала дети, потом родители.
delete from public.pricing_set_zones;
delete from public.pricing_sets;
delete from public.pricing_master_zones;
delete from public.pricing_masters;
delete from public.pricing_zones;

insert into public.pricing_zones (zone_id, floor_price, duration_min) values
  ('arms-full', 120000, 40),
  ('arms-half', 80000, 30),
  ('hands', 30000, 15),
  ('underarms', 50000, 15),
  ('legs-full', 170000, 60),
  ('legs-half', 130000, 40),
  ('thighs', 90000, 30),
  ('bikini-deep', 110000, 40),
  ('back', 60000, 30),
  ('chest', 60000, 20),
  ('buttocks', 50000, 20),
  ('lower-back', 50000, 15),
  ('belly', 60000, 20),
  ('face-full', 120000, 30),
  ('mustache', 30000, 10),
  ('forehead', 30000, 10),
  ('sideburns', 50000, 10),
  ('chin', null, 10),
  ('neck-nape', 50000, 15),
  ('brow-shape', 100000, 30),
  ('brow-tint', 100000, 30),
  ('brow-lamination', 200000, 60),
  ('lash-lamination', 200000, 60),
  ('polymer-mustache', 40000, 10),
  ('polymer-forehead', 50000, 10);

insert into public.pricing_masters (master_key, sort_order, discount_min_zones, discount_pct) values
  ('Рената', 0, null, null),
  ('Ангелина', 1, 3, 20),
  ('Муслима', 2, 3, 20);

insert into public.pricing_master_zones (master_key, zone_id, price) values
  ('Рената', 'arms-full', 140000),
  ('Рената', 'arms-half', 100000),
  ('Рената', 'hands', 40000),
  ('Рената', 'underarms', 60000),
  ('Рената', 'legs-full', 200000),
  ('Рената', 'legs-half', 150000),
  ('Рената', 'thighs', 100000),
  ('Рената', 'bikini-deep', 130000),
  ('Рената', 'back', 70000),
  ('Рената', 'chest', 70000),
  ('Рената', 'buttocks', 70000),
  ('Рената', 'lower-back', 70000),
  ('Рената', 'belly', 70000),
  ('Рената', 'face-full', 120000),
  ('Рената', 'mustache', 30000),
  ('Рената', 'forehead', 30000),
  ('Рената', 'sideburns', 50000),
  ('Рената', 'chin', null),
  ('Рената', 'neck-nape', 50000),
  ('Рената', 'brow-shape', 100000),
  ('Рената', 'brow-tint', 100000),
  ('Рената', 'brow-lamination', 200000),
  ('Рената', 'lash-lamination', 200000),
  ('Рената', 'polymer-mustache', 40000),
  ('Рената', 'polymer-forehead', 50000),
  ('Ангелина', 'arms-full', 120000),
  ('Ангелина', 'arms-half', 80000),
  ('Ангелина', 'hands', 30000),
  ('Ангелина', 'underarms', 50000),
  ('Ангелина', 'legs-full', 170000),
  ('Ангелина', 'legs-half', 130000),
  ('Ангелина', 'thighs', 90000),
  ('Ангелина', 'bikini-deep', 110000),
  ('Ангелина', 'back', 60000),
  ('Ангелина', 'chest', 60000),
  ('Ангелина', 'buttocks', 50000),
  ('Ангелина', 'lower-back', 50000),
  ('Ангелина', 'belly', 60000),
  ('Муслима', 'arms-full', 120000),
  ('Муслима', 'arms-half', 80000),
  ('Муслима', 'hands', 30000),
  ('Муслима', 'underarms', 50000),
  ('Муслима', 'legs-full', 170000),
  ('Муслима', 'legs-half', 130000),
  ('Муслима', 'thighs', 90000),
  ('Муслима', 'bikini-deep', 110000),
  ('Муслима', 'back', 60000),
  ('Муслима', 'chest', 60000),
  ('Муслима', 'buttocks', 50000),
  ('Муслима', 'lower-back', 50000),
  ('Муслима', 'belly', 60000);

insert into public.pricing_sets (set_id, master_key, price) values
  ('set-bikini-underarms', 'Рената', 180000),
  ('set-bikini-underarms-shins', 'Рената', 320000),
  ('set-bikini-underarms-legs', 'Рената', 380000),
  ('set-bikini-underarms-legs-arms', 'Рената', 500000);

insert into public.pricing_set_zones (set_id, zone_id) values
  ('set-bikini-underarms', 'bikini-deep'),
  ('set-bikini-underarms', 'underarms'),
  ('set-bikini-underarms-shins', 'bikini-deep'),
  ('set-bikini-underarms-shins', 'underarms'),
  ('set-bikini-underarms-shins', 'legs-half'),
  ('set-bikini-underarms-legs', 'bikini-deep'),
  ('set-bikini-underarms-legs', 'underarms'),
  ('set-bikini-underarms-legs', 'legs-full'),
  ('set-bikini-underarms-legs-arms', 'bikini-deep'),
  ('set-bikini-underarms-legs-arms', 'underarms'),
  ('set-bikini-underarms-legs-arms', 'legs-full'),
  ('set-bikini-underarms-legs-arms', 'arms-full');

-- ------------------------------------------------------------
-- ИЗ ЧЕГО СЧИТАЛАСЬ ЦЕНА
--
-- services — это текст для админа на языке клиентки, он нужен глазам.
-- Считается цена не по нему, а по кодам зон, поэтому коды сохраняются
-- рядом: по ним цену любой записи можно пересчитать и проверить.
-- ------------------------------------------------------------

alter table public.bookings
  add column if not exists zone_ids text[];

comment on column public.bookings.zone_ids is
  'Коды зон, из которых сервер посчитал total_price и duration_min. Заполняет create_booking().';

-- ------------------------------------------------------------
-- РАСЧЁТ ЦЕНЫ И ДЛИТЕЛЬНОСТИ
--
-- Те же правила, что в calcTotal() из src/utils.ts, в том же порядке:
--
--   1. Зона без цены не входит НИ В ОДНО число. Она не «стоит ноль» —
--      её просто нет в сумме.
--   2. Фиксированный сет ПОБЕЖДАЕТ процентную скидку. Совпадение только
--      точное (весь состав, ничего лишнего) и только у своего мастера:
--      сет — это уже сниженная студией цена, вторая скидка сверху увела бы
--      итог ниже того, что студия берёт.
--   3. Иначе — скидка ВЫБРАННОГО мастера, и считается она по числу зон
--      С ЦЕНОЙ: зона, которой нет в сумме, не может дать скидку.
--
-- «Любой мастер» (master пустой) получает НИЖНЮЮ цену и НИ скидки, НИ сета.
-- Нижняя цена — это цена самого дешёвого мастера, который делает ВСЮ
-- корзину, а не сумма минимумов по зонам: ламинацию ресниц делает только
-- Рената, и «её ламинация + бикини по цене Ангелины» — сумма, которую не
-- возьмёт никто. Скидка же принадлежит конкретному мастеру, поэтому до
-- выбора мастера она не обещается.
-- ------------------------------------------------------------

-- DROP перед CREATE: create or replace не умеет менять набор возвращаемых
-- колонок, а этот файл должен оставаться перезапускаемым и после правок
-- расчёта. DROP снимает и права, поэтому REVOKE/GRANT ниже обязательны.
drop function if exists public.quote_booking(text, text[]);

create function public.quote_booking(p_master text, p_zone_ids text[])
returns table (
  quoted_master   text,
  quoted_total    bigint,
  quoted_duration integer,
  -- Состав, из которого посчитана цена: без неизвестных кодов и без повторов.
  -- Возвращается, чтобы create_booking() записала в заявку РОВНО то, за что
  -- выставлен счёт, а не свою версию того же списка.
  quoted_zones    text[]
)
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  -- Самый длинный реальный заказ — все зоны прайса. Всё сверх этого прислано
  -- не формой; обрезаем, чтобы огромный массив не превращался в нагрузку.
  max_zones   constant integer := 100;
  -- Одна ячейка сетки: даже пустая заявка занимает полчаса.
  min_minutes constant integer := 30;
  -- Верхняя граница колонки duration_min. Она же чинит давнюю мелочь: выбрать
  -- все зоны прайса — это 660 минут по оценкам, и такую запись CHECK отвергал.
  -- 720 = самое длинное рабочее окно студии (Муслима, 08:00–20:00). Сайт
  -- не даёт выбрать время, куда процедура не помещается до закрытия, поэтому
  -- всё, что он вообще способен записать, укладывается в эту границу. Прежние
  -- 600 обрезали длинный комплекс, и последний час визита оставался
  -- «свободным» в сетке занятости.
  max_minutes constant integer := 720;
  v_input     text[];
  v_master    text;
  v_zones     text[];
  v_known     integer;
  v_requested integer;
  v_quote_by  text;
  v_subtotal  bigint  := 0;
  v_priced    integer := 0;
  v_set_price bigint;
  v_min_zones integer;
  v_pct       integer;
  v_total     bigint;
  v_duration  integer := 0;
begin
  v_input := coalesce(p_zone_ids, '{}'::text[]);
  if coalesce(array_length(v_input, 1), 0) > max_zones then
    v_input := v_input[1:max_zones];
  end if;

  -- Мастер опознаётся ТОЧНЫМ совпадением имени. Незнакомое имя (переименовали
  -- мастера, а вкладка у клиентки открыта со вчера) — это не отказ в записи:
  -- заявка проходит как «любой мастер», по нижней цене, и админ назначит сам.
  select m.master_key into v_master
  from public.pricing_masters m
  where m.master_key = btrim(coalesce(p_master, ''));

  -- Только зоны, которые студия действительно знает.
  select coalesce(array_agg(distinct z.zone_id), '{}'::text[])
    into v_zones
  from public.pricing_zones z
  where z.zone_id = any (v_input);

  v_known := coalesce(array_length(v_zones, 1), 0);

  select count(distinct t.id)::integer into v_requested
  from unnest(v_input) as t(id);

  -- Длительность считается по ВСЕМ выбранным зонам, и по бесплатным тоже:
  -- кресло занято независимо от того, назвала ли студия цену.
  select coalesce(sum(z.duration_min), 0)::integer into v_duration
  from public.pricing_zones z
  where z.zone_id = any (v_zones);
  v_duration := least(greatest(v_duration, min_minutes), max_minutes);

  -- Чьими ценами считаем.
  if v_master is not null then
    v_quote_by := v_master;
  else
    select c.master_key into v_quote_by
    from (
      select mz.master_key, sum(mz.price) as sum_price
      from public.pricing_master_zones mz
      join public.pricing_zones z on z.zone_id = mz.zone_id
      where mz.zone_id = any (v_zones)
        and z.floor_price is not null
        and mz.price is not null
      group by mz.master_key
      -- Мастер годится, только если у неё есть цена на КАЖДУЮ зону корзины,
      -- у которой цена вообще существует.
      having count(*) = (
        select count(*)
        from public.pricing_zones z2
        where z2.zone_id = any (v_zones)
          and z2.floor_price is not null
      )
    ) c
    join public.pricing_masters m on m.master_key = c.master_key
    order by c.sum_price asc, m.sort_order asc
    limit 1;
    -- v_quote_by остаётся NULL, если корзину целиком не покрывает никто —
    -- тогда каждая зона берётся по своей нижней цене, ровно как на сайте.
  end if;

  select coalesce(sum(p.price), 0)::bigint, count(p.price)::integer
    into v_subtotal, v_priced
  from (
    select case when v_quote_by is null then z.floor_price else mz.price end as price
    from public.pricing_zones z
    left join public.pricing_master_zones mz
      on mz.master_key = v_quote_by
     and mz.zone_id = z.zone_id
    where z.zone_id = any (v_zones)
  ) p;

  -- Сет — только у своего мастера и только при ТОЧНОМ составе. Неизвестный код
  -- зоны в заявке означает, что состав не равен сету: сайт такого не пришлёт,
  -- а подделанный запрос не должен получать сетовую цену за лишнюю зону.
  if v_master is not null and v_requested = v_known then
    select s.price into v_set_price
    from public.pricing_sets s
    where s.master_key = v_master
      and (
        select count(*) from public.pricing_set_zones sz where sz.set_id = s.set_id
      ) = v_known
      and not exists (
        select 1
        from public.pricing_set_zones sz
        where sz.set_id = s.set_id
          and not (sz.zone_id = any (v_zones))
      )
    order by s.price asc, s.set_id asc
    limit 1;
  end if;

  if v_set_price is not null then
    v_total := v_set_price;
  else
    -- Скидка ВЫБРАННОГО мастера. При «любом мастере» строка не найдётся и
    -- переменные останутся NULL — скидки не будет, как и на сайте.
    select m.discount_min_zones, m.discount_pct
      into v_min_zones, v_pct
    from public.pricing_masters m
    where m.master_key = v_master;

    if v_pct is not null and v_min_zones is not null and v_priced >= v_min_zones then
      v_total := v_subtotal - round(v_subtotal::numeric * v_pct / 100)::bigint;
    else
      v_total := v_subtotal;
    end if;
  end if;

  quoted_master   := v_master;
  quoted_total    := greatest(coalesce(v_total, 0), 0);
  quoted_duration := v_duration;
  quoted_zones    := v_zones;
  return next;
end;
$function$;

revoke all on function public.quote_booking(text, text[]) from public;
-- Снаружи не вызывается: цену клиентке показывает сайт, а в базу её пишет
-- только create_booking() ниже — она SECURITY DEFINER и вызывает эту от
-- имени владельца.
revoke execute on function public.quote_booking(text, text[]) from anon, authenticated;

-- ------------------------------------------------------------
-- СОЗДАНИЕ ЗАЯВКИ
--
-- Единственная дверь в bookings для сайта. Цену и длительность клиент
-- больше НЕ присылает — он присылает состав зон и мастера, остальное
-- считает сервер.
--
-- Что сохраняется как было:
--   * id задаёт клиент — RLS не даёт anon прочитать созданную строку,
--     а экран подтверждения должен знать код заявки сразу;
--   * анти-спам (trg_bookings_antiflood) и уникальный индекс слота
--     (bookings_slot_uniq) срабатывают ровно так же: вставка обычная,
--     триггеры и индексы её видят;
--   * SQLSTATE доходит до сайта нетронутым, поэтому «занято» (23505),
--     «слишком часто» (P0001) и «отклонено» (23514) по-прежнему
--     различаются и показываются разными сообщениями.
--
-- SECURITY DEFINER: функция работает от владельца таблицы, поэтому
-- политика на INSERT для anon больше не нужна — и её снимает
-- 13_lock_anon_insert.sql.
-- ------------------------------------------------------------

drop function if exists public.create_booking(uuid, text, text, text, text, date, text, text[], text, text);

create function public.create_booking(
  p_id            uuid,
  p_customer_name text,
  p_phone         text,
  p_services      text,
  p_master        text,
  p_visit_date    date,
  p_visit_time    text,
  p_zone_ids      text[],
  p_comment       text,
  p_source        text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  q    record;
  v_id uuid;
begin
  select * into q from public.quote_booking(p_master, p_zone_ids);

  v_id := coalesce(p_id, gen_random_uuid());

  insert into public.bookings (
    id, customer_name, phone, services, master,
    visit_date, visit_time, total_price, duration_min,
    comment, source, status, zone_ids
  ) values (
    v_id,
    btrim(coalesce(p_customer_name, '')),
    btrim(coalesce(p_phone, '')),
    -- Текст для глаз админа, приходит с сайта: у сервера нет переводов, а
    -- клиентка должна видеть в подтверждении свой язык. На цену он не влияет —
    -- она считается по кодам зон. Обрезка и «—» здесь только чтобы подделанный
    -- запрос упирался в отказ по существу, а не в CHECK на длину строки
    -- (весь прайс целиком — 476 знаков, форма в тысячу не упирается).
    left(coalesce(nullif(btrim(coalesce(p_services, '')), ''), '—'), 1000),
    q.quoted_master,
    p_visit_date,
    p_visit_time,
    q.quoted_total,
    q.quoted_duration,
    nullif(left(btrim(coalesce(p_comment, '')), 1000), ''),
    nullif(left(btrim(coalesce(p_source, '')), 120), ''),
    'new',
    q.quoted_zones
  );

  -- total_price возвращается не для показа, а для сверки: сайт сравнивает его
  -- со своим числом и пишет в консоль, если они разошлись. Разойтись они могут
  -- только одним способом — прайс в базе отстал от src/data.ts.
  return jsonb_build_object(
    'id', v_id,
    'master', q.quoted_master,
    'total_price', q.quoted_total,
    'duration_min', q.quoted_duration
  );
end;
$function$;

revoke all on function public.create_booking(uuid, text, text, text, text, date, text, text[], text, text) from public;
-- Вызывается формой записи без входа. Публичный доступ здесь безопасен:
-- функция не читает чужие заявки и не принимает цену.
grant execute on function public.create_booking(uuid, text, text, text, text, date, text, text[], text, text) to anon, authenticated;

notify pgrst, 'reload schema';

-- <<< КОНЕЦ СГЕНЕРИРОВАННОГО БЛОКА <<<

notify pgrst, 'reload schema';

-- ============================================================
-- ГОТОВО. Проверьте: Table Editor → должны быть bookings и blocked_slots.
-- Затем Authentication → Users → Add user (это вход в админку),
-- и Authentication → Sign In / Up → выключите «Allow new users to sign up».
--
-- Напоминания в Telegram ставятся отдельно: 07_reminders.sql
-- (нужны расширения pg_cron и pg_net).
-- Уже установленную базу обновляют по порядку: 08_hardening_v3.sql,
-- 09_visit_duration.sql (длительность визита), 10_antiflood_fix.sql
-- (обход анти-спама), 11_cancel_by_code.sql (отмена по коду заявки),
-- 12_server_pricing.sql (цену считает сервер) и — уже ПОСЛЕ выкладки
-- нового сайта — 13_lock_anon_insert.sql (закрыть прямую вставку).
-- ============================================================
