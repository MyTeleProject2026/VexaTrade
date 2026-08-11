// backend/services/emailService.js
const axios = require('axios');

const BREVO_API_KEY = process.env.KEPLERS_PASSWORD || process.env.SMTP_PASS;
const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';
const FROM_EMAIL = process.env.FROM_EMAIL || 'vexatradeblockchainecosystem@gmail.com';
const FROM_NAME = process.env.MAIL_FROM_NAME || 'VexaTrade';

async function sendEmail({ to, subject, html }) {
  console.log(`📧 [sendEmail] Attempting to send email to: ${to}`);
  console.log(`📧 [sendEmail] Using FROM: ${FROM_NAME} <${FROM_EMAIL}>`);
  
  if (!BREVO_API_KEY) {
    console.error('❌ [sendEmail] No Brevo API key found. Please set KEPLERS_PASSWORD or SMTP_PASS.');
    console.log(`📧 [sendEmail] FAKE EMAIL (no API key) - To: ${to}, Subject: ${subject}`);
    return false;
  }

  try {
    const response = await axios.post(
      BREVO_API_URL,
      {
        sender: { name: FROM_NAME, email: FROM_EMAIL },
        to: [{ email: to }],
        subject: subject,
        htmlContent: html,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'api-key': BREVO_API_KEY,
        },
        timeout: 30000,
      }
    );
    console.log(`✅ [sendEmail] Email sent successfully to ${to}`);
    console.log(`✅ [sendEmail] Brevo response:`, response.status, response.statusText);
    return true;
  } catch (error) {
    console.error(`❌ [sendEmail] Failed to send email to ${to}:`);
    console.error(`❌ [sendEmail] Error details:`, error.response?.data || error.message);
    if (error.response?.data) {
      console.error(`❌ [sendEmail] Brevo API error:`, JSON.stringify(error.response.data, null, 2));
    }
    return false;
  }
}

async function sendOtpEmail({ to, code }) {
  console.log(`📧 [sendOtpEmail] Preparing OTP email for: ${to}, code: ${code}`);
  
  const html = `
    <div style="font-family: Arial, sans-serif; padding: 24px; background: #0b0b0b; color: #ffffff;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h1 style="color: #06b6d4; margin: 0;">VexaTrade</h1>
        <p style="color: #64748b; margin: 4px 0 0;">Secure Trading Platform</p>
      </div>
      <div style="background: #1a1a2e; border-radius: 16px; padding: 24px; border: 1px solid #2d2d44;">
        <h2 style="margin: 0 0 16px; color: #ffffff;">Email Verification</h2>
        <p style="margin: 0 0 16px; color: #cbd5e1;">Your 6-digit verification code is:</p>
        <div style="font-size: 36px; font-weight: 700; letter-spacing: 12px; color: #06b6d4; text-align: center; background: #0d0d1a; padding: 16px; border-radius: 12px; margin: 16px 0;">
          ${code}
        </div>
        <p style="margin: 16px 0 0; color: #94a3b8; font-size: 14px;">This code expires in <strong style="color: #ffffff;">10 minutes</strong>.</p>
        <p style="margin: 8px 0 0; color: #64748b; font-size: 12px;">If you didn't request this, please ignore this email.</p>
      </div>
      <div style="text-align: center; margin-top: 24px; color: #475569; font-size: 12px;">
        <p>VexaTrade - Your trusted trading platform</p>
      </div>
    </div>
  `;
  
  return sendEmail({ to, subject: '🔐 VexaTrade Email Verification Code', html });
}

async function sendPasswordResetEmail({ to, resetLink }) {
  const html = `
    <div style="font-family: Arial, sans-serif; padding: 24px; background: #0b0b0b; color: #ffffff;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h1 style="color: #06b6d4; margin: 0;">VexaTrade</h1>
      </div>
      <div style="background: #1a1a2e; border-radius: 16px; padding: 24px; border: 1px solid #2d2d44;">
        <h2 style="margin: 0 0 16px; color: #ffffff;">Reset Your Password</h2>
        <p style="margin: 0 0 16px; color: #cbd5e1;">Click the link below to reset your password. This link expires in 1 hour.</p>
        <a href="${resetLink}" style="display: inline-block; background: #06b6d4; color: #000000; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 16px 0;">
          Reset Password
        </a>
        <p style="margin: 16px 0 0; color: #94a3b8; font-size: 14px;">If you didn't request this, please ignore this email.</p>
      </div>
    </div>
  `;
  
  return sendEmail({ to, subject: '🔑 VexaTrade Password Reset', html });
}

module.exports = { sendEmail, sendOtpEmail, sendPasswordResetEmail };
