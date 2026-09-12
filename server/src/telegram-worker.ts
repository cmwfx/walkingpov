import 'dotenv/config';
import crypto from 'node:crypto';
import { supabaseAdmin } from './config/supabase.js';
import { isTelegramConfigured, sendTelegramNotification, TelegramDeliveryError, type TelegramNotificationKind } from './services/telegram.js';

const workerId = crypto.randomUUID();
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function runOnce() {
  const { data, error } = await supabaseAdmin.rpc('claim_next_telegram', { p_worker_id: workerId });
  if (error) {
    console.error('telegram-claim-failed');
    return false;
  }
  const row = data?.[0] as { outbox_id: string; kind: TelegramNotificationKind } | undefined;
  if (!row) return false;

  try {
    await sendTelegramNotification(row.kind);
    const { error: markError } = await supabaseAdmin.rpc('mark_telegram_sent', { p_outbox_id: row.outbox_id });
    if (markError) {
      console.error('telegram-mark-sent-failed');
      return true;
    }
    console.log('telegram-alert-sent');
  } catch (error) {
    const retryAfterSeconds = error instanceof TelegramDeliveryError ? error.retryAfterSeconds : null;
    const errorCode = error instanceof TelegramDeliveryError ? error.code : 'telegram_delivery_failed';
    const { error: markError } = await supabaseAdmin.rpc('mark_telegram_failed', {
      p_outbox_id: row.outbox_id,
      p_error_code: errorCode,
      p_retry_after_seconds: retryAfterSeconds,
    });
    if (markError) console.error('telegram-mark-failed');
    console.error('telegram-alert-delivery-failed');
  }
  return true;
}

async function main() {
  console.log('candidfan-telegram-worker-ready');
  while (true) {
    if (!isTelegramConfigured()) {
      console.error('telegram-worker-not-configured');
      await sleep(60_000);
      continue;
    }
    const worked = await runOnce();
    if (!worked) await sleep(5_000);
  }
}

void main().catch(() => {
  console.error('telegram-worker-stopped');
  process.exitCode = 1;
});
