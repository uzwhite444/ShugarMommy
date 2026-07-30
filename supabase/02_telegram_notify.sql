-- ============================================================
-- SHUGAR MOMMY — Telegram-уведомление о новой записи
-- Работает прямо в Postgres через pg_net (Edge Functions не нужны).
--
-- ПЕРЕД ЗАПУСКОМ:
--   1) Замените BOT_TOKEN на токен бота из @BotFather
--   2) Замените CHAT_ID на ваш Telegram chat id
--   3) Выполните весь скрипт в Supabase SQL Editor
--
-- Как получить значения:
--   a) В Telegram откройте @BotFather → /newbot → скопируйте токен.
--   b) Откройте своего бота → Start → напишите любое сообщение.
--   c) Откройте в браузере:
--      https://api.telegram.org/bot<TOKEN>/getUpdates
--      Найдите "chat":{"id":123456789,...} — это ваш chat id.
-- ============================================================

create extension if not exists pg_net with schema extensions;

-- Конфиг в одну строку — закрыт RLS, виден только definer-функциям.
create table if not exists public.notification_config (
  id text primary key,
  bot_token text not null,
  chat_id text not null
);
alter table public.notification_config enable row level security;
-- Политик нет намеренно: таблица недоступна anon/authenticated через REST.

-- ВАЖНО: реальные значения вписывайте только в SQL Editor, не в репозиторий.
insert into public.notification_config (id, bot_token, chat_id)
values ('telegram', 'BOT_TOKEN', 'CHAT_ID')
on conflict (id) do update set
  bot_token = excluded.bot_token,
  chat_id   = excluded.chat_id;

-- Триггер: форматирует сообщение и шлёт POST в Telegram.
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
  -- Пользовательские поля экранируются для parse_mode=HTML, иначе <, >, &
  -- из имени/комментария позволили бы вставить теги в сообщение админу.
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
