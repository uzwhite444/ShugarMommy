-- ============================================================
-- SHUGAR MOMMY — реальная занятость слотов
-- Выполните один раз в Supabase SQL Editor.
--
-- Что делает:
--   1) Таблица blocked_slots — ручная блокировка времени админом
--      (обед, отпуск, личные дела). Виден всем, редактирует только админ.
--   2) Публичная функция booked_slots(date) — возвращает занятое время
--      из подтверждённых записей, НЕ раскрывая персональные данные.
--      Клиент видит только «занято», без имени и телефона.
-- ============================================================

-- 1. Ручные блокировки -------------------------------------------------
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

-- Создавать/удалять блокировки может только вошедший админ.
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

-- 2. Занятое время из записей -----------------------------------------
-- SECURITY DEFINER: обходит RLS таблицы bookings, но отдаёт ТОЛЬКО
-- время и мастера — никаких имён, телефонов и комментариев.
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
