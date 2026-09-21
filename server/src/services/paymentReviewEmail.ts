import { escapeHtml } from './email.js';

export type PaymentDecision = 'approved' | 'denied';

export function makePaymentReviewEmail(decision: PaymentDecision, rawNotes: string | null) {
  const notes = rawNotes?.trim() || '';
  const heading = decision === 'approved' ? 'Payment approved' : 'Payment review complete';
  const message = decision === 'approved'
    ? 'Your CandidFan payment was approved. Sign in to access your lifetime membership.'
    : 'Your CandidFan payment was reviewed. Sign in to review the result and contact support if you need help.';
  const subject = decision === 'approved'
    ? 'Your CandidFan membership is active'
    : 'Your CandidFan payment review is complete';
  const noteText = notes ? `\n\nMessage from CandidFan support:\n${notes}` : '';
  const noteHtml = notes ? `
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0 0;">
                  <tr>
                    <td style="padding:16px 18px;background:#0f172a;border:1px solid #6d3fc0;border-radius:12px;">
                      <div style="margin:0 0 8px;color:#d58cff;font-size:13px;line-height:20px;font-weight:700;">Message from CandidFan support</div>
                      <div style="color:#e5e7eb;font-size:15px;line-height:24px;white-space:pre-wrap;">${escapeHtml(notes)}</div>
                    </td>
                  </tr>
                </table>` : '';

  return {
    subject,
    text: `${message}${noteText}`,
    html: `<!doctype html>
<html lang="en">
  <body style="margin:0;background:#0b1224;color:#e5e7eb;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0b1224;">
      <tr>
        <td align="center" style="padding:40px 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#141d33;border:1px solid #2b3852;border-radius:16px;">
            <tr>
              <td style="padding:28px 32px 12px;">
                <div style="font-size:22px;line-height:28px;font-weight:700;color:#d58cff;">CandidFan</div>
              </td>
            </tr>
            <tr>
              <td style="padding:12px 32px 32px;">
                <h1 style="margin:0;color:#f8fafc;font-size:24px;line-height:32px;font-weight:700;">${heading}</h1>
                <p style="margin:16px 0 0;color:#a9b7d0;font-size:16px;line-height:25px;">${message}</p>${noteHtml}
                <p style="margin:24px 0 0;"><a href="https://candidfan.com/dashboard" style="display:inline-block;padding:12px 18px;background:#7c3aed;color:#ffffff;text-decoration:none;border-radius:8px;font-size:15px;line-height:20px;font-weight:700;">Open CandidFan</a></p>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 32px 24px;border-top:1px solid #253149;">
                <p style="margin:0;color:#71809b;font-size:12px;line-height:19px;">CandidFan &middot; Payment review</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`,
  };
}
