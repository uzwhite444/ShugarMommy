-- ============================================================
-- SHUGAR MOMMY — закрытие обхода анти-спама
--
-- Выполните ВЕСЬ этот файл в Supabase → SQL Editor → Run.
-- Скрипт безопасно перезапускать.
--
-- ЧТО БЫЛО НЕ ТАК
-- Анти-спам сверял записи по последним 9 цифрам телефона и, если цифр
-- было меньше девяти, ВЫХОДИЛ БЕЗ ЕДИНОЙ ПРОВЕРКИ. Достаточно было
-- указать телефон вроде «1234567» — и лимиты переставали действовать
-- полностью. Проверено на боевой базе: 6 заявок подряд вместо 3.
-- Так можно было забить весь календарь на недели вперёд и завалить
-- Telegram студии мусором.
--
-- ЧТО ИЗМЕНИЛОСЬ
-- Короткий или нецифровой телефон больше не пропуск, а отдельная
-- корзина: такие записи считаются по ТОЧНОМУ совпадению строки.
-- Нормальный номер по-прежнему сверяется по последним 9 цифрам,
-- чтобы «+998 90 123-45-67» и «90 123 45 67» были одним человеком.
-- ============================================================

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
  -- Ключ сравнения: последние 9 цифр у нормального номера, иначе —
  -- сама строка. Второе гарантирует, что мусорный телефон считается
  -- вместе с такими же мусорными, а не обходит проверку.
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

-- ============================================================
-- Телефон должен содержать хотя бы 7 цифр, иначе позвонить по нему
-- нельзя, а значит запись бесполезна и студии, и клиентке.
-- NOT VALID: уже сохранённые записи не мешают выполнить файл.
-- ============================================================

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

notify pgrst, 'reload schema';

-- ============================================================
-- ГОТОВО. Проверка: должно вернуть 0 — записей с негодным телефоном нет.
-- ============================================================
select count(*) as bad_phones_should_be_zero
from public.bookings
where char_length(regexp_replace(phone, '[^0-9]', '', 'g')) < 7;
