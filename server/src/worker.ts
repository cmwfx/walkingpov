import 'dotenv/config';
import crypto from 'node:crypto';
import { supabaseAdmin } from './config/supabase.js';
import { sendEmail } from './services/email.js';

const workerId = crypto.randomUUID();
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function runOnce() {
  const { data, error } = await supabaseAdmin.rpc('claim_next_email', { p_worker_id: workerId });
  if (error) {
    console.error('email-claim-failed');
    return false;
  }
  const row = data?.[0];
  if (!row) return false;
  try {
    await sendEmail({ to: row.recipient, subject: row.subject, text: row.text_body, html: row.html_body });
    await supabaseAdmin.rpc('mark_email_sent', { p_outbox_id: row.outbox_id });
    console.log('email-sent');
  } catch {
    await supabaseAdmin.rpc('mark_email_failed', { p_outbox_id: row.outbox_id, p_error_code: 'smtp_delivery_failed' });
    console.error('email-delivery-failed');
  }
  return true;
}

async function main() {
  console.log('candidfan-email-worker-ready');
  while (true) {
    const worked = await runOnce();
    if (!worked) await sleep(5000);
  }
}

void main().catch(() => {
  console.error('email-worker-stopped');
  process.exitCode = 1;
});
