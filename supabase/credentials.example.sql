-- ============================================================
-- SHUGAR MOMMY — ключи Telegram (шаблон)
--
-- 1. Скопируйте этот файл рядом под именем credentials.local.sql
-- 2. Подставьте свои значения вместо BOT_TOKEN и CHAT_ID
-- 3. Выполните credentials.local.sql в Supabase → SQL Editor → Run
--
-- credentials.local.sql в .gitignore — реальные ключи не попадут в GitHub.
-- Этот файл нужен один раз после setup-all.sql, и ещё раз — если смените
-- бота или чат. Все остальные скрипты его не трогают.
--
-- Где взять значения:
--   BOT_TOKEN — @BotFather → ваш бот → API Token
--   CHAT_ID   — напишите боту любое сообщение и откройте
--               https://api.telegram.org/bot<ТОКЕН>/getUpdates
--               нужное число лежит в "chat":{"id": ...}
-- ============================================================

insert into public.notification_config (id, bot_token, chat_id)
values ('telegram', 'BOT_TOKEN', 'CHAT_ID')
on conflict (id) do update set
  bot_token = excluded.bot_token,
  chat_id   = excluded.chat_id;

-- Проверка: должна вернуться одна строка со скрытым токеном.
select id, left(bot_token, 8) || '…' as bot_token_preview, chat_id
from public.notification_config
where id = 'telegram';
