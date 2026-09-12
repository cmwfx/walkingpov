export type TelegramNotificationKind = 'payment_submitted' | 'support_ticket_created';

const telegramApiBase = 'https://api.telegram.org';
const telegramRequestTimeoutMs = 10_000;

const messages: Record<TelegramNotificationKind, string> = {
  payment_submitted: 'CandidFan: New payment submitted for review.',
  support_ticket_created: 'CandidFan: New support ticket submitted.',
};

export class TelegramDeliveryError extends Error {
  constructor(public readonly code: string, public readonly retryAfterSeconds: number | null = null) {
    super(code);
    this.name = 'TelegramDeliveryError';
  }
}

export function telegramMessageFor(kind: TelegramNotificationKind) {
  return messages[kind];
}

export function isTelegramConfigured() {
  const token = process.env.TELEGRAM_BOT_TOKEN || '';
  const chatId = process.env.TELEGRAM_CHAT_ID || '';
  return token.length > 0 && token.length <= 256 && /^-?\d+$/.test(chatId);
}

function retryAfterFrom(payload: unknown) {
  if (!payload || typeof payload !== 'object' || !('parameters' in payload)) return null;
  const parameters = payload.parameters;
  if (!parameters || typeof parameters !== 'object' || !('retry_after' in parameters)) return null;
  const retryAfter = parameters.retry_after;
  return typeof retryAfter === 'number' && Number.isInteger(retryAfter) && retryAfter > 0 ? Math.min(retryAfter, 21_600) : null;
}

export async function sendTelegramNotification(kind: TelegramNotificationKind) {
  const token = process.env.TELEGRAM_BOT_TOKEN || '';
  const chatId = process.env.TELEGRAM_CHAT_ID || '';
  if (!isTelegramConfigured()) throw new TelegramDeliveryError('telegram_not_configured');

  let response: Response;
  try {
    response = await fetch(`${telegramApiBase}/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: telegramMessageFor(kind) }),
      signal: AbortSignal.timeout(telegramRequestTimeoutMs),
    });
  } catch {
    throw new TelegramDeliveryError('telegram_request_failed');
  }

  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload || typeof payload !== 'object' || !('ok' in payload) || payload.ok !== true) {
    throw new TelegramDeliveryError(response.status === 429 ? 'telegram_rate_limited' : 'telegram_api_failed', retryAfterFrom(payload));
  }
}
