const nodemailer = require('nodemailer');

const transport = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587', 10),
  secure: process.env.SMTP_SECURE === 'true',
  auth: process.env.SMTP_USER
    ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    : undefined,
});

if (process.env.NODE_ENV !== 'test' && process.env.SMTP_HOST) {
  transport
    .verify()
    .then(() => console.log('Email server connected'))
    .catch((err) => console.warn(`Email server connection failed: ${err.message}`));
}

async function sendEmail(to, subject, html) {
  const from = process.env.EMAIL_FROM || process.env.SMTP_USER;
  await transport.sendMail({ from, to, subject, html });
}

/**
 * Send OTP via email for the 3-step OTP login flow.
 */
async function sendOtpEmail(to, otpCode, expiryMinutes) {
  const subject = 'Your One-Time Password (OTP) - Middleware';
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;
                border:1px solid #e0e0e0;border-radius:8px;padding:32px;">
      <h2 style="color:#333;margin-bottom:8px;">Login Verification</h2>
      <p style="color:#555;">
        Use the OTP below to complete your sign-in.
        It expires in <strong>${expiryMinutes} minutes</strong>.
      </p>
      <div style="text-align:center;margin:32px 0;">
        <span style="font-size:40px;font-weight:bold;letter-spacing:12px;
                     color:#1a1a2e;background:#f4f4f8;padding:16px 24px;
                     border-radius:8px;display:inline-block;">
          ${otpCode}
        </span>
      </div>
      <p style="color:#888;font-size:13px;">
        If you did not attempt to log in, please ignore this email
        or contact your administrator immediately.
      </p>
    </div>
  `;
  await sendEmail(to, subject, html);
}

module.exports = { sendEmail, sendOtpEmail };
