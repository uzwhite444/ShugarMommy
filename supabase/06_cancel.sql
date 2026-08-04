-- ============================================================
-- SHUGAR MOMMY — отмена записи клиенткой через сайт
-- Выполните один раз в Supabase SQL Editor.
--
-- Клиентка вводит свой телефон и дату визита. Функция отменяет её
-- активные записи на эту дату. Личные данные наружу НЕ отдаются —
-- возвращается только количество отменённых записей.
--
-- Ключ доступа: телефон + дата. Номер нормализуется (только цифры),
-- поэтому формат ввода не важен: +998 90 123-45-67 = 998901234567.
-- ============================================================

create or replace function public.cancel_booking(customer_phone text, target_date date)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  digits text;
  affected integer;
begin
  digits := regexp_replace(coalesce(customer_phone, ''), '\D', '', 'g');

  -- Слишком короткий номер — не пытаемся угадывать, ничего не отменяем.
  if char_length(digits) < 7 then
    return 0;
  end if;

  update public.bookings b
  set status = 'cancelled'
  where b.visit_date = target_date
    and b.status in ('new', 'confirmed')
    and regexp_replace(b.phone, '\D', '', 'g') = digits;

  get diagnostics affected = row_count;
  return affected;
end;
$$;

revoke all on function public.cancel_booking(text, date) from public;
grant execute on function public.cancel_booking(text, date) to anon, authenticated;
