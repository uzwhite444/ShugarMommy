-- ============================================================
-- SHUGAR MOMMY — право удалять заявки для админа
-- Выполните один раз в Supabase SQL Editor.
-- Нужно для кнопки «Удалить» в админ-панели (тестовые/спам-заявки).
-- ============================================================

drop policy if exists "authenticated can delete bookings" on public.bookings;
create policy "authenticated can delete bookings"
  on public.bookings for delete
  to authenticated
  using (true);
