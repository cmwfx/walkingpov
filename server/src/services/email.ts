import nodemailer from 'nodemailer';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
}

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const getBaseTemplate = (title: string, content: string) => `
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 30px; text-align: center; background: linear-gradient(135deg, #4169E1 0%, #5B7FE8 100%);">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">
                ${title}
              </h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 40px;">
              ${content}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px; background-color: #f7fafc; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0; color: #a0aec0; font-size: 13px; line-height: 18px; text-align: center;">
                If you have any questions, please contact support.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
`;

export const sendEmail = async ({ to, subject, html }: EmailOptions) => {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
    console.warn('SMTP credentials not found. Skipping email send.');
    return;
  }

  const info = await transporter.sendMail({
    from: process.env.SMTP_FROM || '"VaultTube" <noreply@vaulttube.com>',
    to,
    subject,
    html,
  });

  console.log('Message sent: %s', info.messageId);
  return info;
};

export const sendApprovalEmail = async (email: string) => {
  const title = 'Payment Approved!';
  const content = `
    <h2 style="margin: 0 0 16px; color: #1a202c; font-size: 20px; font-weight: 600;">
      Access Granted
    </h2>
    <p style="margin: 0 0 24px; color: #4a5568; font-size: 16px; line-height: 24px;">
      Great news! Your payment has been reviewed and approved.
    </p>
    <p style="margin: 0 0 24px; color: #4a5568; font-size: 16px; line-height: 24px;">
      You can now log in to your account and enjoy lifetime access to all premium content.
    </p>
    <div style="text-align: center; margin: 32px 0;">
      <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/login" style="display: inline-block; background-color: #4169E1; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 600;">
        Login Now
      </a>
    </div>
  `;

  return sendEmail({
    to: email,
    subject: 'Payment Approved - WalkingPOV',
    html: getBaseTemplate(title, content),
  });
};

export const sendDenialEmail = async (email: string, reason?: string) => {
  const title = 'Payment Update';
  const content = `
    <h2 style="margin: 0 0 16px; color: #1a202c; font-size: 20px; font-weight: 600;">
      Payment Review Status
    </h2>
    <p style="margin: 0 0 24px; color: #4a5568; font-size: 16px; line-height: 24px;">
      We reviewed your payment submission, but unfortunately, we could not approve it at this time.
    </p>
    ${reason ? `
    <div style="background-color: #fff5f5; border-left: 4px solid #fc8181; padding: 16px; margin-bottom: 24px;">
      <p style="margin: 0; color: #c53030; font-weight: 500;">Reason:</p>
      <p style="margin: 4px 0 0; color: #2d3748;">${reason}</p>
    </div>
    ` : ''}
    <p style="margin: 0 0 24px; color: #4a5568; font-size: 16px; line-height: 24px;">
      Please double-check your payment proof. If you believe this is a mistake, please log in and resubmit your payment proof.
    </p>
    <div style="text-align: center; margin: 32px 0;">
      <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/login" style="display: inline-block; background-color: #718096; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 600;">
        Login to Resubmit
      </a>
    </div>
  `;

  return sendEmail({
    to: email,
    subject: 'Action Required: Payment Review - WalkingPOV',
    html: getBaseTemplate(title, content),
  });
};
