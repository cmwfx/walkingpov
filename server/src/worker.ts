import 'dotenv/config';
import crypto from 'node:crypto';
import { supabaseAdmin } from './config/supabase.js';
import { sendEmail } from './services/email.js';
import { makePaymentReviewEmail, PaymentDecision } from './services/paymentReviewEmail.js';

const workerId = crypto.randomUUID();
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function formatPaymentReviewEmail(row: { kind: string; outbox_id: string; recipient: string; subject: string; text_body: string; html_body: string }) {
  if (row.kind !== 'payment_review') return row;

  const { data: outbox, error: outboxError } = await supabaseAdmin
    .from('email_outbox')
    .select('created_at')
    .eq('id', row.outbox_id)
    .maybeSingle();
  if (outboxError || !outbox?.created_at) return row;

  const decision: PaymentDecision = row.subject === 'Your CandidFan membership is active' ? 'approved' : 'denied';
  const createdAt = new Date(outbox.created_at).getTime();
  const lowerBound = new Date(createdAt - 120000).toISOString();
  const upperBound = new Date(createdAt + 120000).toISOString();
  const { data: user, error: userError } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('email', row.recipient)
    .maybeSingle();
  if (userError || !user) return row;

  const { data: payment, error: paymentError } = await supabaseAdmin
    .from('payment_requests')
    .select('notes')
    .eq('user_id', user.id)
    .eq('status', decision)
    .gte('reviewed_at', lowerBound)
    .lte('reviewed_at', upperBound)
    .order('reviewed_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (paymentError || !payment) return row;

  const email = makePaymentReviewEmail(decision, payment.notes);
  return { ...row, subject: email.subject, text_body: email.text, html_body: email.html };
}

async function runOnce() {
  const { data, error } = await supabaseAdmin.rpc('claim_next_email', { p_worker_id: workerId });
  if (error) {
    console.error('email-claim-failed');
    return false;
  }
  const row = data?.[0];
  if (!row) return false;
  try {
    const email = await formatPaymentReviewEmail(row);
    await sendEmail({ to: email.recipient, subject: email.subject, text: email.text_body, html: email.html_body });
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
