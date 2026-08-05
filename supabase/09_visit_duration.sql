-- ============================================================
-- SHUGAR MOMMY — длительность визита (duration_min)
--
-- Выполните ВЕСЬ этот файл в Supabase → SQL Editor → Run.
-- Он ОБНОВЛЯЕТ уже установленную базу. Скрипт безопасно перезапускать.
--
-- На ПУСТОЙ базе сначала выполните setup-all.sql — этот файл ожидает,
-- что таблица bookings уже существует.
--
-- Что чинит:
--   Раньше запись занимала ровно одну получасовую ячейку. «Ноги полностью»
--   идут 50 минут, а «ноги + глубокое бикини» — 90, поэтому клиентка могла
--   записаться на 10:30 к тому же мастеру, который занят с 10:00 до 11:30.
--   Теперь база хранит длительность, а сайт закрывает все получасовки,
--   которые визит занимает.
-- ============================================================

-- ============================================================
-- 1. КОЛОНКА ДЛИТЕЛЬНОСТИ
--
-- NULL допустим: записи, созданные до этого обновления, сайт считает
-- получасовыми. Верхняя граница — реальный «полный комплекс» с запасом.
-- ============================================================

alter table public.bookings
  add column if not exists duration_min integer default 30
  check (duration_min is null or duration_min between 5 and 600);

-- ============================================================
-- 2. ЗАНЯТОСТЬ СЛОТОВ — теперь отдаёт и длительность
--
-- Тип результата функции меняется, поэтому старую версию нужно удалить:
-- create or replace не умеет менять набор возвращаемых колонок.
-- DROP снимает и права, поэтому GRANT ниже обязателен.
--
-- SECURITY DEFINER обходит RLS таблицы bookings, но функция отдаёт
-- ТОЛЬКО время, мастера и длительность — никаких имён, телефонов,
-- комментариев. Вызывается формой записи без входа (anon).
-- ============================================================

drop function if exists public.booked_slots(date);

create function public.booked_slots(target_date date)
returns table (visit_time text, master text, duration_min integer)
language sql
security definer
set search_path = public
stable
as $function$
  select b.visit_time, b.master, coalesce(b.duration_min, 30)
  from public.bookings b
  where b.visit_date = target_date
    and b.status in ('new', 'confirmed');
$function$;

revoke all on function public.booked_slots(date) from public;
grant execute on function public.booked_slots(date) to anon, authenticated;

notify pgrst, 'reload schema';

-- ============================================================
-- ГОТОВО. Проверка: запрос ниже должен вернуть три колонки
-- (visit_time, master, duration_min), а не ошибку.
-- ============================================================
select * from public.booked_slots(current_date);
