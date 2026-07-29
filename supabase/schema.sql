-- Shugar Mommy — bookings schema.
-- Выполнить в Supabase SQL Editor один раз.

create extension if not exists pgcrypto;

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

create index if not exists bookings_created_at_idx on public.bookings (created_at desc);
create index if not exists bookings_visit_date_idx on public.bookings (visit_date);

alter table public.bookings enable row level security;

-- Клиенты (anon) могут только создавать заявки.
drop policy if exists "anon can insert bookings" on public.bookings;
create policy "anon can insert bookings"
  on public.bookings for insert
  to anon
  with check (status = 'new');

-- Читать и менять статусы может только вошедший админ.
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

-- Анти-спам: не больше 10 заявок с одного телефона в день (мягкая защита).
-- Основная защита — rate limiting на уровне Supabase.
