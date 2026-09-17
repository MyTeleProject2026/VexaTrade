// backend/services/emailService.js
const nodemailer = require('nodemailer');
const axios = require('axios');

// One email service is used by OTP, email verification, 2FA, notifications and
// password-recovery integrations. Keep provider credentials separate so a
// Brevo API key is never accidentally used as an SMTP password (or vice versa).
const trim = value => String(value || '').trim();
const configuredSmtpHost = trim(process.env.BREVO_SMTP_HOST || process.env.SMTP_HOST);
const configuredSmtpPort = Number(process.env.BREVO_SMTP_PORT || process.env.SMTP_PORT || 587);
const brevoSmtpUser = trim(process.env.BREVO_SMTP_USER || process.env.BREVO_USER);
const brevoSmtpKey = trim(process.env.BREVO_SMTP_KEY || process.env.BREVO_SMTP_PASSWORD || process.env.BREVO_SMTP_PASS);
const genericSmtpUser = trim(process.env.SMTP_USER);
const genericSmtpPass = trim(process.env.SMTP_PASS || process.env.SMTP_KEY);
const gmailUser = trim(process.env.GMAIL_USER);
const gmailAppPassword = trim(process.env.GMAIL_APP_PASSWORD);
const fromEmail = trim(process.env.BREVO_EMAIL || process.env.FROM_EMAIL || gmailUser || brevoSmtpUser || genericSmtpUser);
const fromName = trim(process.env.MAIL_FROM_NAME || 'VexaTrade');
const brevoApiKey = trim(process.env.BREVO_API_KEY);
const brevoApiUrl = 'https://api.brevo.com/v3/smtp/email';

const providers = [];
if (brevoSmtpUser && brevoSmtpKey && fromEmail) {
  providers.push({ name: 'brevo-smtp', host: configuredSmtpHost || 'smtp-relay.brevo.com', ports: configuredSmtpHost && configuredSmtpPort ? [configuredSmtpPort] : [587, 2525], user: brevoSmtpUser, pass: brevoSmtpKey });
}
if (genericSmtpUser && genericSmtpPass && fromEmail && configuredSmtpHost) {
  providers.push({ name: 'smtp', host: configuredSmtpHost, ports: [configuredSmtpPort, configuredSmtpPort === 587 ? 2525 : 587], user: genericSmtpUser, pass: genericSmtpPass });
}
if (gmailUser && gmailAppPassword) {
  providers.push({ name: 'gmail-smtp', host: 'smtp.gmail.com', ports: [465, 587], user: gmailUser, pass: gmailAppPassword });
}

const transporters = new Map();

function maskEmail(value) {
  const email = trim(value);
  const at = email.indexOf('@');
  if (at <= 1) return '***';
  return `${email.slice(0, 1)}***${email.slice(at)}`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;').replace(/'/g, '&#39;');
}

function getTransporter(provider, port) {
  const key = `${provider.name}:${port}`;
  if (!transporters.has(key)) {
    transporters.set(key, nodemailer.createTransport({
      host: provider.host,
      port,
      secure: port === 465,
      auth: { user: provider.user, pass: provider.pass },
      connectionTimeout: 12000,
      greetingTimeout: 12000,
      socketTimeout: 15000,
      tls: { minVersion: 'TLSv1.2', servername: provider.host },
    }));
  }
  return transporters.get(key);
}

function isRetryableNetworkError(error) {
  return ['ETIMEDOUT', 'ECONNRESET', 'ECONNREFUSED', 'EHOSTUNREACH', 'ENETUNREACH', 'ESOCKET', 'EAI_AGAIN'].includes(String(error?.code || '').toUpperCase());
}

function formatError(error) {
  return String(error?.response?.data?.message || error?.response?.data?.code || error?.response?.data || error?.code || error?.message || 'Unknown email delivery error');
}

async function sendViaSmtp({ to, subject, html, text }) {
  let lastError = null;
  for (const provider of providers) {
    for (const port of provider.ports) {
      try {
        const info = await getTransporter(provider, port).sendMail({
          from: `\"${fromName}\" <${fromEmail}>`,
          to,
          subject,
          text,
          html,
        });
        console.info(`[email] ${provider.name} accepted to ${maskEmail(to)} port=${port} messageId=${info.messageId || 'accepted'}`);
        return true;
      } catch (error) {
        lastError = error;
        console.error(`[email] ${provider.name} failed to ${maskEmail(to)} port=${port}: ${formatError(error)}`);
        // Authentication/rejection errors are not fixed by another SMTP port.
        if (!isRetryableNetworkError(error)) break;
      }
    }
  }
  if (lastError) throw lastError;
  return false;
}

async function sendViaBrevoApi({ to, subject, html, text }) {
  if (!brevoApiKey || !fromEmail) return false;
  try {
    const response = await axios.post(brevoApiUrl, {
      sender: { name: fromName, email: fromEmail },
      to: [{ email: to }],
      subject,
      textContent: text,
      htmlContent: html,
    }, {
      headers: { 'Content-Type': 'application/json', 'api-key': brevoApiKey },
      timeout: 12000,
    });
    console.info(`[email] Brevo API accepted to ${maskEmail(to)} status=${response.status}`);
    return true;
  } catch (error) {
    console.error(`[email] Brevo API failed to ${maskEmail(to)}: ${formatError(error)}`);
    throw error;
  }
}

async function sendEmail({ to, subject, html, text }) {
  const recipient = trim(to).toLowerCase();
  if (!recipient || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) throw new Error('Valid recipient email is required');
  const payload = { to: recipient, subject: trim(subject) || 'VexaTrade notification', html: String(html || ''), text: String(text || '') };

  let smtpError = null;
  try {
    if (await sendViaSmtp(payload)) return true;
  } catch (error) {
    smtpError = error;
  }

  try {
    if (await sendViaBrevoApi(payload)) return true;
  } catch (apiError) {
    const combined = new Error(`Email delivery failed: SMTP=${smtpError ? formatError(smtpError) : 'not configured'}; BrevoAPI=${formatError(apiError)}`);
    combined.code = 'EMAIL_SEND_FAILED';
    combined.cause = apiError;
    throw combined;
  }

  const error = new Error('Email delivery is not configured. Configure Brevo SMTP/API or Gmail SMTP credentials.');
  error.code = 'EMAIL_PROVIDER_NOT_CONFIGURED';
  throw error;
}

async function sendOtpEmail({ to, code, purpose = 'verification' }) {
  const safePurpose = escapeHtml(trim(purpose).replace(/[^a-z0-9 _-]/gi, '').slice(0, 60) || 'verification');
  const safeCode = escapeHtml(code);
  const text = `VexaTrade security verification\n\nYour code for ${safePurpose} is: ${code}\n\nThis code expires in 10 minutes. Never share it with anyone.`;
  const html = `<div style=\"font-family:Arial,sans-serif;padding:32px;background:#09090b;color:#fff\"><div style=\"max-width:560px;margin:auto;background:#15151b;border:1px solid #2b2b35;border-radius:20px;padding:30px\"><h1 style=\"margin:0 0 8px\">VexaTrade</h1><p style=\"color:#a1a1aa\">Secure account verification</p><p>Your verification code for <strong>${safePurpose}</strong> is:</p><div style=\"font-size:36px;font-weight:700;letter-spacing:10px;text-align:center;padding:18px;margin:22px 0;background:#0b0b10;border-radius:14px\">${safeCode}</div><p style=\"color:#a1a1aa\">This code expires in 10 minutes. Never share it with anyone.</p><p style=\"color:#71717a;font-size:12px\">If you did not request this code, secure your account immediately.</p></div></div>`;
  return sendEmail({ to, subject: 'VexaTrade security verification code', html, text });
}

async function sendPasswordResetEmail({ to, resetLink }) {
  const safeLink = escapeHtml(resetLink);
  const text = `VexaTrade password reset\n\nReset your password using this link:\n${resetLink}\n\nThis link expires in 1 hour. If you did not request this, ignore this message.`;
  const html = `<div style=\"font-family:Arial,sans-serif;padding:32px;background:#09090b;color:#fff\"><div style=\"max-width:560px;margin:auto;background:#15151b;border:1px solid #2b2b35;border-radius:20px;padding:30px\"><h1>VexaTrade</h1><h2>Reset your password</h2><p>This secure link expires in 1 hour.</p><a href=\"${safeLink}\" style=\"display:inline-block;padding:13px 22px;background:#fff;color:#000;border-radius:9px;text-decoration:none;font-weight:700\">Reset Password</a><p style=\"color:#a1a1aa\">If you did not request this, ignore this message.</p></div></div>`;
  return sendEmail({ to, subject: 'VexaTrade password reset', html, text });
}

module.exports = { sendEmail, sendOtpEmail, sendPasswordResetEmail };