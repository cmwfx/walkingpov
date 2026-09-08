import nodemailer from 'nodemailer';
import { supabaseAdmin } from '../config/supabase.js';
import { BRAND } from '../config/brand.js';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: process.env.SMTP_SECURE === 'true',
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

function escapeHtml(value: unknown) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] || char));
}

function template(title: string, body: string) {
  return '<!doctype html><html><body style="margin:0;background:#0b1020;color:#e5e7eb;font-family:Arial,sans-serif"><main style="max-width:600px;margin:32px auto;background:#111827;border:1px solid #293449;border-radius:16px;overflow:hidden"><header style="padding:28px;background:linear-gradient(135deg,#7c3aed,#2563eb)"><h1 style="margin:0;color:white;font-size:24px">' + escapeHtml(title) + '</h1></header><section style="padding:28px;line-height:1.6">' + body + '</section><footer style="padding:20px 28px;color:#94a3b8;border-top:1px solid #293449;font-size:13px">Replies happen on the CandidFan website. This outgoing address is not monitored.</footer></main></body></html>';
}

async function sendOutbox(row: any) {
  const payload = row.payload || {};
  let body = '';
  if (row.kind === 'payment_review' && payload.status === 'approved') {
    body = '<p>Your payment was approved and lifetime access is now active.</p><p><a href="' + BRAND.domain + '/login" style="color:#a78bfa">Log in to watch CandidFan</a></p>';
  } else if (row.kind === 'payment_review') {
    body = '<p>We could not approve this payment submission yet.</p><p>Please log in and review the notes or submit updated proof.</p>';
  } else {
    body = '<p>There is a new reply on your CandidFan support ticket.</p><p><a href="' + BRAND.domain + '/support" style="color:#a78bfa">Open your support tickets</a></p>';
  }
  await transporter.sendMail({ from: BRAND.sender, to: row.recipient, subject: row.subject, html: template(row.subject, body) });
}

let running = false;

export async function processEmailOutbox() {
  if (running) return;
  running = true;
  try {
    await supabaseAdmin.from('email_outbox').update({ status: 'failed', last_error: 'Recovered after process restart' }).eq('status', 'sending');
    const { data: rows, error } = await supabaseAdmin
      .from('email_outbox')
      .select('*')
      .in('status', ['pending', 'failed'])
      .lte('next_attempt_at', new Date().toISOString())
      .order('created_at')
      .limit(5);
    if (error) throw error;
    for (const row of rows || []) {
      const { data: claimed } = await supabaseAdmin.from('email_outbox').update({ status: 'sending', attempts: row.attempts + 1 }).eq('id', row.id).in('status', ['pending', 'failed']).select('*').maybeSingle();
      if (!claimed) continue;
      try {
        await sendOutbox(claimed);
        await supabaseAdmin.from('email_outbox').update({ status: 'sent', sent_at: new Date().toISOString(), last_error: null }).eq('id', row.id);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Email delivery failed';
        const delayMinutes = Math.min(60, 2 ** Math.min(6, claimed.attempts));
        await supabaseAdmin.from('email_outbox').update({ status: 'failed', last_error: message.slice(0, 1000), next_attempt_at: new Date(Date.now() + delayMinutes * 60 * 1000).toISOString() }).eq('id', row.id);
        console.error('email delivery failed', { id: row.id, message });
      }
    }
  } catch (error) {
    console.error('email outbox worker failed', error);
  } finally {
    running = false;
  }
}

export function startEmailWorker() {
  void processEmailOutbox();
  return setInterval(() => void processEmailOutbox(), 15_000);
}

