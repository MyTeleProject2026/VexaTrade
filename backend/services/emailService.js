// backend/services/emailService.js
const nodemailer = require('nodemailer');
const axios = require('axios');

// Production email delivery supports the same Brevo SMTP configuration used by
// VexaAccount, plus the existing Brevo HTTP API configuration as a fallback.
// Do not use generic password variables as a Brevo API key: SMTP credentials
// and HTTP API credentials are different secrets.
const SMTP_HOST = String(process.env.BREVO_SMTP_HOST || process.env.SMTP_HOST || 'smtp-relay.brevo.com')
  .trim()
  .replace(/^smtps?:\/\//i, '')
  .replace(/\/$/, '');
const configuredPort = Number(process.env.BREVO_SMTP_PORT || process.env.SMTP_PORT || 587);
const SMTP_USER = String(process.env.BREVO_SMTP_USER || process.env.SMTP_USER || '').trim();
const SMTP_PASS = String(process.env.BREVO_SMTP_KEY || process.env.SMTP_PASS || process.env.SMTP_KEY || '').trim();
const FROM_EMAIL = String(process.env.BREVO_EMAIL || process.env.FROM_EMAIL || process.env.GMAIL_USER || '').trim();
const FROM_NAME = String(process.env.MAIL_FROM_NAME || 'VexaTrade').trim();
const BREVO_API_KEY = String(process.env.BREVO_API_KEY || '').trim();
const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';

const smtpPorts = configuredPort === 2525
  ? [2525, 587]
  : configuredPort === 465
    ? [465, 587, 2525]
    : [configuredPort, 2525];

const transporters = new Map();

function maskEmail(value) {
  const email = String(value || '').trim();
  const at = email.indexOf('@');
  if (at <= 1) return '***';
  return `${email.slice(0, 1)}***${email.slice(at)}`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getSmtpTransporter(port) {
  if (!SMTP_USER || !SMTP_PASS || !FROM_EMAIL) return null;
  if (!transporters.has(port)) {
    transporters.set(port, nodemailer.createTransport({
      host: SMTP_HOST,
      port,
      secure: port === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
      connectionTimeout: 12000,
      greetingTimeout: 12000,
      socketTimeout: 15000,
      tls: { minVersion: 'TLSv1.2', servername: SMTP_HOST },
    }));
  }
  return transporters.get(port);
}

function isRetryableNetworkError(error) {
  return [
    'ETIMEDOUT', 'ECONNRESET', 'ECONNREFUSED', 'EHOSTUNREACH',
    'ENETUNREACH', 'ESOCKET', 'EAI_AGAIN'
  ].includes(String(error?.code || '').toUpperCase());
}

function formatError(error) {
  return String(error?.response?.data?.message || error?.response || error?.code || error?.message || 'Unknown email delivery error');
}

async function sendViaSmtp({ to, subject, html }) {
  if (!SMTP_USER || !SMTP_PASS || !FROM_EMAIL) return false;

  let lastError = null;
  for (const port of smtpPorts) {
    const transporter = getSmtpTransporter(port);
    try {
      const info = await transporter.sendMail({
        from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
        to,
        subject,
        html,
      });
      console.info(`[email] SMTP accepted to ${maskEmail(to)} port=${port} messageId=${info.messageId || 'accepted'}`);
      return true;
    } catch (error) {
      lastError = error;
      console.error(`[email] SMTP delivery failed to ${maskEmail(to)} port=${port}: ${formatError(error)}`);
      if (!isRetryableNetworkError(error)) break;
    }
  }

  if (lastError) throw lastError;
  return false;
}

async function sendViaBrevoApi({ to, subject, html }) {
  if (!BREVO_API_KEY || !FROM_EMAIL) return false;
  try {
    const response = await axios.post(BREVO_API_URL, {
      sender: { name: FROM_NAME, email: FROM_EMAIL },
      to: [{ email: to }],
      subject,
      htmlContent: html,
    }, {
      headers: { 'Content-Type': 'application/json', 'api-key': BREVO_API_KEY },
      timeout: 12000,
    });
    console.info(`[email] Brevo API accepted to ${maskEmail(to)} status=${response.status}`);
    return true;
  } catch (error) {
    console.error(`[email] Brevo API delivery failed to ${maskEmail(to)}: ${formatError(error)}`);
    throw error;
  }
}

async function sendEmail({ to, subject, html }) {
  const recipient = String(to || '').trim();
  if (!recipient || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
    throw new Error('Valid recipient email is required');
  }

  const payload = {
    to: recipient,
    subject: String(subject || 'VexaTrade notification'),
    html: String(html || ''),
  };

  // SMTP is the primary path because it matches the production VexaAccount
  // email configuration. If SMTP is unavailable, the existing Brevo HTTP API
  // remains a supported fallback.
  let smtpError = null;
  try {
    if (await sendViaSmtp(payload)) return true;
  } catch (error) {
    smtpError = error;
  }

  try {
    if (await sendViaBrevoApi(payload)) return true;
  } catch (apiError) {
    if (smtpError) {
      const combined = new Error(`Email delivery failed: SMTP=${formatError(smtpError)}; BrevoAPI=${formatError(apiError)}`);
      combined.code = 'EMAIL_SEND_FAILED';
      throw combined;
    }
    throw apiError;
  }

  const error = new Error('Email delivery is not configured. Configure BREVO_SMTP_USER, BREVO_SMTP_KEY, BREVO_EMAIL (or BREVO_API_KEY + FROM_EMAIL).');
  error.code = 'EMAIL_PROVIDER_NOT_CONFIGURED';
  throw error;
}

async function sendOtpEmail({ to, code, purpose = 'verification' }) {
  const safePurpose = escapeHtml(String(purpose || 'verification').replace(/[^a-z0-9 _-]/gi, '').slice(0, 60));
  const safeCode = escapeHtml(String(code || ''));
  const html = `
    <div style="font-family:Arial,sans-serif;padding:32px;background:#09090b;color:#fff">
      <div style="max-width:560px;margin:auto;background:#15151b;border:1px solid #2b2b35;border-radius:20px;padding:30px">
        <h1 style="margin:0 0 8px">VexaTrade</h1>
        <p style="color:#a1a1aa">Secure account verification</p>
        <p>Your verification code for <strong>${safePurpose}</strong> is:</p>
        <div style="font-size:36px;font-weight:700;letter-spacing:10px;text-align:center;padding:18px;margin:22px 0;background:#0b0b10;border-radius:14px">${safeCode}</div>
        <p style="color:#a1a1aa">This code expires in 10 minutes. Never share it with anyone.</p>
        <p style="color:#71717a;font-size:12px">If you did not request this code, secure your account immediately.</p>
      </div>
    </div>`;
  return sendEmail({ to, subject: 'VexaTrade security verification code', html });
}

async function sendPasswordResetEmail({ to, resetLink }) {
  const safeLink = escapeHtml(resetLink);
  const html = `<div style="font-family:Arial,sans-serif;padding:32px;background:#09090b;color:#fff"><div style="max-width:560px;margin:auto;background:#15151b;border:1px solid #2b2b35;border-radius:20px;padding:30px"><h1>VexaTrade</h1><h2>Reset your password</h2><p>This secure link expires in 1 hour.</p><a href="${safeLink}" style="display:inline-block;padding:13px 22px;background:#fff;color:#000;border-radius:9px;text-decoration:none;font-weight:700">Reset Password</a><p style="color:#a1a1aa">If you did not request this, ignore this message.</p></div></div>`;
  return sendEmail({ to, subject: 'VexaTrade password reset', html });
}

module.exports = { sendEmail, sendOtpEmail, sendPasswordResetEmail };