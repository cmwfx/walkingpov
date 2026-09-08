import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: process.env.SMTP_SECURE === 'true',
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[character] || character));
}

export async function sendEmail(input: { to: string; subject: string; text: string; html: string }) {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS || !process.env.SMTP_FROM) {
    throw new Error('smtp_not_configured');
  }
  return transporter.sendMail({ from: process.env.SMTP_FROM, ...input });
}

export function makeTestEmail() {
  return {
    subject: 'CandidFan labeled SMTP test',
    text: 'This is the authorized CandidFan SMTP delivery test.',
    html: '<p>This is the authorized CandidFan SMTP delivery test.</p>',
  };
}
