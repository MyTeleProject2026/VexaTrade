// backend/services/emailService.js
const nodemailer = require('nodemailer');

function getMailTransporter() {
  // Priority: Keplers SMTP if configured, fallback to Gmail
  if (process.env.KEPLERS_SMTP_HOST && process.env.KEPLERS_EMAIL && process.env.KEPLERS_PASSWORD) {
    return nodemailer.createTransport({
      host: process.env.KEPLERS_SMTP_HOST,
      port: parseInt(process.env.KEPLERS_SMTP_PORT) || 587,
      secure: false,
      auth: {
        user: process.env.KEPLERS_EMAIL,
        pass: process.env.KEPLERS_PASSWORD,
      },
    });
  }
  
  // Fallback to Gmail
  if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD.replace(/\s/g, ''),
      },
    });
  }
  
  console.error("❌ No mail service configured. Please set KEPLERS_* or GMAIL_* environment variables.");
  return null;
}

async function sendEmail({ to, subject, html }) {
  const transporter = getMailTransporter();
  
  if (!transporter) {
    console.error(`❌ Mail service not configured. Cannot send email to ${to}.`);
    return false;
  }

  const fromName = process.env.MAIL_FROM_NAME || "CryptoPulse";
  const fromEmail = process.env.KEPLERS_EMAIL || process.env.GMAIL_USER;

  const mailOptions = {
    from: `"${fromName}" <${fromEmail}>`,
    to: to,
    subject: subject,
    html: html,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`✅ Email sent successfully to ${to}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to send email to ${to}:`, error.message);
    return false;
  }
}

async function sendOtpEmail({ to, code }) {
  const html = `
    <div style="font-family: Arial, sans-serif; padding: 24px; background: #0b0b0b; color: #ffffff;">
      <h2 style="margin:0 0 16px;">VexaTrade Verification</h2>
      <p style="margin:0 0 16px;">Your 6-digit verification code is:</p>
      <div style="font-size:32px; font-weight:700; letter-spacing:8px; color:#a3e635; margin:16px 0;">
        ${code}
      </div>
      <p style="margin:16px 0 0; color:#cbd5e1;">This code expires in 10 minutes.</p>
    </div>
  `;
  
  return sendEmail({ to, subject: 'VexaTrade Email Verification Code', html });
}

async function sendPasswordResetEmail({ to, resetLink }) {
  const html = `
    <div style="font-family: Arial, sans-serif; padding: 24px; background: #0b0b0b; color: #ffffff;">
      <h2 style="margin:0 0 16px;">Reset Your Password</h2>
      <p style="margin:0 0 16px;">Click the link below to reset your password. This link expires in 1 hour.</p>
      <a href="${resetLink}" style="display: inline-block; background: #a3e635; color: #000000; padding: 12px 24px; text-decoration: none; border-radius: 12px; font-weight: bold; margin: 16px 0;">
        Reset Password
      </a>
      <p style="margin:16px 0 0; color:#cbd5e1;">If you didn't request this, please ignore this email.</p>
    </div>
  `;
  
  return sendEmail({ to, subject: 'VexaTrade Password Reset', html });
}

module.exports = { sendEmail, sendOtpEmail, sendPasswordResetEmail, getMailTransporter };
