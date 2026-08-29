// backend/services/emailService.js
const axios = require('axios');

const BREVO_API_KEY = process.env.BREVO_API_KEY || process.env.KEPLERS_PASSWORD || process.env.SMTP_PASS;
const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';
const FROM_EMAIL = process.env.FROM_EMAIL || 'vexatradeblockchainecosystem@gmail.com';
const FROM_NAME = process.env.MAIL_FROM_NAME || 'VexaTrade';

function maskEmail(value) {
  const email = String(value || '').trim();
  const at = email.indexOf('@');
  if (at <= 1) return '***';
  return `${email.slice(0, 1)}***${email.slice(at)}`;
}

async function sendEmail({ to, subject, html }) {
  const recipient = String(to || '').trim();
  if (!recipient || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
    throw new Error('Valid recipient email is required');
  }
  if (!BREVO_API_KEY) {
    // Security-sensitive messages must never silently succeed when delivery is unavailable.
    throw new Error('Email delivery is not configured');
  }

  try {
    const response = await axios.post(BREVO_API_URL, {
      sender: { name: FROM_NAME, email: FROM_EMAIL },
      to: [{ email: recipient }],
      subject: String(subject || 'VexaTrade notification'),
      htmlContent: String(html || ''),
    }, {
      headers: { 'Content-Type': 'application/json', 'api-key': BREVO_API_KEY },
      timeout: 15000,
    });
    console.info(`[email] delivered to ${maskEmail(recipient)} status=${response.status}`);
    return true;
  } catch (error) {
    console.error(`[email] delivery failed to ${maskEmail(recipient)}:`, error.response?.data?.message || error.message);
    return false;
  }
}

async function sendOtpEmail({ to, code, purpose = 'verification' }) {
  const safePurpose = String(purpose || 'verification').replace(/[^a-z0-9 _-]/gi, '').slice(0, 60);
  const html = `
    <div style="font-family:Arial,sans-serif;padding:32px;background:#09090b;color:#fff">
      <div style="max-width:560px;margin:auto;background:#15151b;border:1px solid #2b2b35;border-radius:20px;padding:30px">
        <h1 style="margin:0 0 8px">VexaTrade</h1>
        <p style="color:#a1a1aa">Secure account verification</p>
        <p>Your verification code for <strong>${safePurpose}</strong> is:</p>
        <div style="font-size:36px;font-weight:700;letter-spacing:10px;text-align:center;padding:18px;margin:22px 0;background:#0b0b10;border-radius:14px">${String(code)}</div>
        <p style="color:#a1a1aa">This code expires in 10 minutes. Never share it with anyone.</p>
        <p style="color:#71717a;font-size:12px">If you did not request this code, secure your account immediately.</p>
      </div>
    </div>`;
  return sendEmail({ to, subject: 'VexaTrade security verification code', html });
}

async function sendPasswordResetEmail({ to, resetLink }) {
  const html = `<div style="font-family:Arial,sans-serif;padding:32px;background:#09090b;color:#fff"><div style="max-width:560px;margin:auto;background:#15151b;border:1px solid #2b2b35;border-radius:20px;padding:30px"><h1>VexaTrade</h1><h2>Reset your password</h2><p>This secure link expires in 1 hour.</p><a href="${String(resetLink)}" style="display:inline-block;padding:13px 22px;background:#fff;color:#000;border-radius:9px;text-decoration:none;font-weight:700">Reset Password</a><p style="color:#a1a1aa">If you did not request this, ignore this message.</p></div></div>`;
  return sendEmail({ to, subject: 'VexaTrade password reset', html });
}

module.exports = { sendEmail, sendOtpEmail, sendPasswordResetEmail };