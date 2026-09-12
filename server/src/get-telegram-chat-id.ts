import 'dotenv/config';

const token = process.env.TELEGRAM_BOT_TOKEN || '';
if (!token) throw new Error('TELEGRAM_BOT_TOKEN is required');

const response = await fetch(`https://api.telegram.org/bot${token}/getUpdates`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ limit: 100, allowed_updates: ['message'] }),
  signal: AbortSignal.timeout(10_000),
});
const payload = await response.json().catch(() => null) as { ok?: boolean; result?: unknown } | null;
if (!response.ok || !payload?.ok || !Array.isArray(payload.result)) throw new Error('Unable to read Telegram updates');

const privateChatIds = payload.result
  .map((update) => {
    if (!update || typeof update !== 'object' || !('message' in update)) return null;
    const message = update.message;
    if (!message || typeof message !== 'object' || !('chat' in message)) return null;
    const chat = message.chat;
    if (!chat || typeof chat !== 'object' || chat.type !== 'private' || typeof chat.id !== 'number') return null;
    return chat.id;
  })
  .filter((chatId): chatId is number => chatId !== null);

const chatId = privateChatIds.at(-1);
if (chatId === undefined) throw new Error('No private chat found; send /start to the bot first');
console.log(`TELEGRAM_CHAT_ID=${chatId}`);
