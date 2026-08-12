-- ============================================================
-- SHUGAR MOMMY — отмена записи ТОЛЬКО по коду заявки
--
-- Выполните ВЕСЬ этот файл в Supabase → SQL Editor → Run.
-- Скрипт безопасно перезапускать.
--
-- ЧТО БЫЛО НЕ ТАК
-- cancel_booking(телефон, дата) была доступна публичным anon-ключом и
-- отменяла запись, зная только НОМЕР и ДАТУ. Номер клиентки виден в
-- переписке, в сторис, в чате студии; дат в неделе семь. То есть чужую
-- запись мог снять кто угодно, и сколько угодно раз подряд.
-- Хуже того, функция возвращала число отменённых записей: по ответу
-- было видно, есть ли у конкретного номера визит на конкретную дату.
-- Это уже не отмена, а справочная по клиенткам студии.
--
-- ЧТО ИЗМЕНИЛОСЬ
-- 1. Старая функция УДАЛЕНА. Пока она существует, дыра открыта, поэтому
--    здесь именно drop, а не «оставим на всякий случай».
-- 2. Новая cancel_booking_by_code(код, телефон) требует ДВА фактора:
--    код заявки (первые 8 знаков id — то, что видит только сама
--    клиентка) И телефон, с которого делалась запись. Одного из них
--    недостаточно: перехваченная ссылка с кодом без телефона бесполезна,
--    известный телефон без кода — тоже.
-- 3. Ответ — одно слово: ok / not_found / throttled. Ни числа записей,
--    ни подсказки, что именно не совпало.
-- 4. Подбор кода ограничен: 5 неудачных попыток на номер за 15 минут.
--
-- ПОЧЕМУ 8 ЗНАКОВ
-- Это первая группа UUID до дефиса: 16^8 = 4 294 967 296 вариантов.
-- Половина пространства — 2,15 млрд попыток на ОДИН телефон. Даже без
-- ограничения это 3,4 года при 20 запросах в секунду (и всё-таки только
-- 8 месяцев при 100 — поэтому ограничение обязательно). С ограничением
-- 5 попыток / 15 минут = 480 в сутки выходит порядка 12 000 лет.
-- Длиннее делать незачем: код диктуют по телефону, и каждый лишний
-- знак — это ошибки при диктовке, а не безопасность.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Счётчик неудачных попыток (защита от подбора кода)
-- ------------------------------------------------------------

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

-- ------------------------------------------------------------
-- 2. Старая небезопасная отмена — удалить
-- ------------------------------------------------------------

drop function if exists public.cancel_booking(text, date);

-- ------------------------------------------------------------
-- 3. Отмена по коду заявки + телефону
-- ------------------------------------------------------------

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
  -- зависеть от настроек экранирования строк в SQL Editor.
  -- Приводим к нижнему регистру и выкидываем всё лишнее — клиентка может
  -- прислать «3F7A-9C21», «3f7a 9c21» или вообще весь id из ссылки.
  code := regexp_replace(lower(coalesce(booking_code, '')), '[^0-9a-f]', '', 'g');
  digits := regexp_replace(coalesce(customer_phone, ''), '[^0-9]', '', 'g');

  -- Заведомо негодный ввод: попытка не засчитывается — подбором это быть
  -- не может, а честную клиентку с опечаткой блокировать не за что.
  if char_length(code) < 8 or char_length(digits) < 7 then
    return 'not_found';
  end if;

  code := left(code, 8);
  -- Тот же ключ сравнения, что у анти-спама (10_antiflood_fix.sql): запись,
  -- сделанную как «+998 90 123-45-67», отменяет ввод «90 123 45 67».
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

  -- Уборка: таблица не должна расти вечно. Дешевле здесь, чем отдельным кроном.
  delete from public.cancel_attempts where last_failed_at < now() - interval '1 day';

  return 'not_found';
end;
$function$;

revoke all on function public.cancel_booking_by_code(text, text) from public;
-- Вызывается клиенткой с сайта без входа — доступ остаётся публичным,
-- но теперь он ничего не даёт без кода заявки.
grant execute on function public.cancel_booking_by_code(text, text) to anon, authenticated;

notify pgrst, 'reload schema';

-- ============================================================
-- ПРОВЕРКА
-- ============================================================

-- 1. Старой функции быть не должно — ожидается 0.
select count(*) as old_cancel_booking_should_be_zero
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'cancel_booking';

-- 2. Выдуманный код на выдуманный номер ничего не отменяет — ожидается not_found.
select public.cancel_booking_by_code('00000000', '+998 90 000-00-00') as wrong_code_should_be_not_found;

-- 3. Коды действующих записей — их видно только админу. По этому списку
--    можно назвать код клиентке, которая записалась ДО этого обновления
--    и кода не знает.
select
  upper(left(id::text, 4)) || '-' || upper(substr(id::text, 5, 4)) as booking_code,
  customer_name,
  phone,
  visit_date,
  visit_time
from public.bookings
where status in ('new', 'confirmed')
  and visit_date >= (now() at time zone 'Asia/Tashkent')::date
order by visit_date, visit_time;
