-- ============================================================
-- SHUGAR MOMMY — напоминания клиенткам за час до визита
-- Выполните ВЕСЬ файл в Supabase SQL Editor → Run.
--
-- Как это работает:
--   1. После записи клиентка нажимает «Включить напоминание» —
--      открывается бот со ссылкой t.me/Shugarr_Mommy_bot?start=<id>.
--   2. Она жмёт Start, бот запоминает её chat_id (см. Edge Function).
--   3. Планировщик раз в 5 минут ищет визиты, до которых остался
--      примерно час, и отправляет напоминание с кнопкой отмены.
--
-- Часовой пояс студии — Asia/Tashkent (UTC+5).
-- ============================================================

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

-- Куда слать напоминание и не отправляли ли уже.
alter table public.bookings
  add column if not exists telegram_chat_id text
  check (telegram_chat_id is null or char_length(telegram_chat_id) <= 32);

alter table public.bookings
  add column if not exists reminder_sent_at timestamptz;

-- ------------------------------------------------------------
-- Привязка Telegram клиентки к записи (вызывает Edge Function)
-- ------------------------------------------------------------
create or replace function public.link_telegram(booking_id uuid, chat_id text)
returns boolean
language plpgsql
security definer
set search_path = public
as $function$
declare
  affected integer;
begin
  update public.bookings
  set telegram_chat_id = chat_id
  where id = booking_id
    and status in ('new', 'confirmed');
  get diagnostics affected = row_count;
  return affected > 0;
end;
$function$;

revoke all on function public.link_telegram(uuid, text) from public;
-- В Supabase роли anon и authenticated получают EXECUTE явно, поэтому
-- «revoke from public» их НЕ отзывает — нужен отдельный revoke. Иначе
-- любой, кто знает id записи, перенаправил бы напоминание (имя, услуги,
-- мастер, время) в свой Telegram публичным anon-ключом.
revoke execute on function public.link_telegram(uuid, text) from anon, authenticated;
-- Вызывается только сервисным ключом из Edge Function.
grant execute on function public.link_telegram(uuid, text) to service_role;

-- ------------------------------------------------------------
-- Отправка напоминаний
-- ------------------------------------------------------------
create or replace function public.send_visit_reminders()
returns integer
language plpgsql
security definer
set search_path = public, extensions
as $function$
declare
  cfg record;
  b record;
  visit_at timestamptz;
  msg text;
  sent integer := 0;
begin
  select bot_token into cfg from public.notification_config where id = 'telegram';
  if cfg is null or cfg.bot_token is null then
    return 0;
  end if;

  for b in
    select id, customer_name, services, master, visit_date, visit_time, telegram_chat_id
    from public.bookings
    where status in ('new', 'confirmed')
      and telegram_chat_id is not null
      and reminder_sent_at is null
      and visit_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
      and visit_date between (now() at time zone 'Asia/Tashkent')::date
                         and ((now() at time zone 'Asia/Tashkent') + interval '1 day')::date
  loop
    -- Момент визита в реальном времени (местное время студии). Старые записи
    -- могли сохранить невозможное время, поэтому приведение типа обёрнуто:
    -- испорченная строка пропускается, а не роняет весь проход крона.
    begin
      visit_at := (b.visit_date::text || ' ' || b.visit_time || ':00')::timestamp
                  at time zone 'Asia/Tashkent';
    exception when others then
      raise warning 'send_visit_reminders: запись % — некорректное время (%)', b.id, sqlerrm;
      visit_at := null;
    end;

    continue when visit_at is null;

    -- Окно 45–75 минут до визита: планировщик ходит каждые 5 минут,
    -- поэтому каждая запись попадает в него ровно один раз.
    continue when visit_at - now() > interval '75 minutes'
              or visit_at - now() < interval '45 minutes';

    begin
      msg := format(
        E'⏰ <b>Напоминание о визите</b>\n\n%s, ждём вас через час!\n\n✨ %s\n👩‍🔬 %s\n🕐 Сегодня в %s\n\nЕсли планы изменились — отмените запись на сайте: https://shugarmommy.vercel.app/#/cancel',
        replace(replace(replace(coalesce(b.customer_name, ''), '&', '&amp;'), '<', '&lt;'), '>', '&gt;'),
        replace(replace(replace(coalesce(b.services, '—'), '&', '&amp;'), '<', '&lt;'), '>', '&gt;'),
        replace(replace(replace(coalesce(b.master, 'мастер студии'), '&', '&amp;'), '<', '&lt;'), '>', '&gt;'),
        b.visit_time
      );

      perform net.http_post(
        url := 'https://api.telegram.org/bot' || cfg.bot_token || '/sendMessage',
        body := jsonb_build_object(
          'chat_id', b.telegram_chat_id,
          'text', msg,
          'parse_mode', 'HTML',
          'disable_web_page_preview', true
        ),
        headers := '{"Content-Type": "application/json"}'::jsonb
      );

      update public.bookings set reminder_sent_at = now() where id = b.id;
      sent := sent + 1;
    exception when others then
      -- Одна проблемная запись не должна отменять рассылку остальным.
      raise warning 'send_visit_reminders: запись % пропущена (%)', b.id, sqlerrm;
    end;
  end loop;

  return sent;
end;
$function$;

revoke all on function public.send_visit_reminders() from public;
-- Вызывается только планировщиком pg_cron: «revoke from public» не отзывает
-- явные гранты Supabase для anon и authenticated, поэтому убираем их отдельно.
revoke execute on function public.send_visit_reminders() from anon, authenticated;

-- ------------------------------------------------------------
-- Планировщик: каждые 5 минут
-- ------------------------------------------------------------
select cron.unschedule('shugarmommy-visit-reminders')
where exists (select 1 from cron.job where jobname = 'shugarmommy-visit-reminders');

select cron.schedule(
  'shugarmommy-visit-reminders',
  '*/5 * * * *',
  $cron$ select public.send_visit_reminders(); $cron$
);

notify pgrst, 'reload schema';

-- Проверка: задача должна появиться в списке.
select jobname, schedule, active from cron.job where jobname = 'shugarmommy-visit-reminders';
