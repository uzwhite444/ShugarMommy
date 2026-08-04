-- ============================================================
-- SHUGAR MOMMY — источник заявки (откуда пришла клиентка)
-- Выполните один раз в Supabase SQL Editor.
--
-- Добавляет колонку source: Instagram, Telegram, Google, Прямой заход
-- или UTM-метка рекламной кампании. Видно в админке и в отчётах.
-- ============================================================

alter table public.bookings
  add column if not exists source text
  check (source is null or char_length(source) <= 120);
