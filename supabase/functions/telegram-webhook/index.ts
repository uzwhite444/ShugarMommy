// ============================================================
// SHUGAR MOMMY — Telegram webhook
//
// Единственная задача: когда клиентка открывает бота по ссылке
// t.me/Shugarr_Mommy_bot?start=<booking_id> и жмёт «Старт»,
// запомнить её chat_id, чтобы за час до визита прислать напоминание.
//
// КАК ЗАДЕПЛОИТЬ (2 минуты, без установки чего-либо):
//   1. Supabase Dashboard → Edge Functions → Deploy a new function
//   2. Имя функции: telegram-webhook
//   3. Вставьте этот файл целиком → Deploy
//   4. Снимите галочку «Verify JWT» в настройках функции
//      (Telegram не умеет присылать JWT).
// ============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
/** Общий секрет: Telegram присылает его в заголовке, чужие запросы отсекаются. */
const WEBHOOK_SECRET = Deno.env.get('TELEGRAM_WEBHOOK_SECRET') ?? '';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function reply(chatId: number | string, text: string): Promise<void> {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    }),
  });
}

Deno.serve(async (req) => {
  if (WEBHOOK_SECRET && req.headers.get('x-telegram-bot-api-secret-token') !== WEBHOOK_SECRET) {
    return new Response('forbidden', { status: 403 });
  }

  let update: {
    message?: { chat?: { id?: number }; text?: string };
  };
  try {
    update = await req.json();
  } catch {
    return new Response('ok'); // Telegram не должен ретраить мусор.
  }

  const chatId = update.message?.chat?.id;
  const text = (update.message?.text ?? '').trim();
  if (!chatId || !text.startsWith('/start')) {
    return new Response('ok');
  }

  const payload = text.slice('/start'.length).trim();

  // Просто «Старт» без ссылки с записи — объясняем, что делать.
  if (!UUID_RE.test(payload)) {
    await reply(
      chatId,
      'Здравствуйте! Это бот студии <b>Shugar Mommy</b>.\n\nЧтобы получать напоминание за час до визита, запишитесь на сайте и нажмите там кнопку «Напомнить в Telegram».\n\nhttps://shugarmommy.vercel.app',
    );
    return new Response('ok');
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data, error } = await supabase.rpc('link_telegram', {
    booking_id: payload,
    chat_id: String(chatId),
  });

  if (error) {
    console.error('link_telegram failed:', error.message);
    await reply(chatId, 'Не получилось подключить напоминание. Напишите нам, мы поможем.');
    return new Response('ok');
  }

  await reply(
    chatId,
    data
      ? '✅ Готово! Напомним о визите за час.\n\nЕсли планы изменятся, запись можно отменить на сайте: https://shugarmommy.vercel.app/#/cancel'
      : 'Эта запись уже неактивна. Если нужно записаться заново — ждём вас на сайте: https://shugarmommy.vercel.app',
  );

  return new Response('ok');
});
