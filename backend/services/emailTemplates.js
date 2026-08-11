// backend/src/services/emailTemplates.js

/**
 * Generate a beautiful HTML email template for notification emails.
 * Supports different types with custom colors and icons.
 *
 * @param {Object} params
 * @param {string} params.title - Notification title
 * @param {string} params.message - Notification message (plain text)
 * @param {string} params.type - Notification type (security, verification_code, system, funds, general, trade)
 * @param {string} params.userName - User's name
 * @param {string} params.userEmail - User's email address
 * @param {number} params.userId - User ID (optional)
 * @param {number} params.notificationId - Notification ID (optional)
 * @returns {string} HTML email body
 */
function generateNotificationEmail({
  title,
  message,
  type = 'general',
  userName = 'User',
  userEmail = '',
  userId = null,
  notificationId = null,
}) {
  // ─── Type configurations ──────────────────────────────────────────
  const typeConfig = {
    security: {
      color: '#06b6d4',
      icon: '🔒',
      label: 'Security Alert',
    },
    verification_code: {
      color: '#8b5cf6',
      icon: '📧',
      label: 'Verification',
    },
    system: {
      color: '#f59e0b',
      icon: '⚙️',
      label: 'System Update',
    },
    funds: {
      color: '#10b981',
      icon: '💰',
      label: 'Funds Update',
    },
    general: {
      color: '#06b6d4',
      icon: '📢',
      label: 'Announcement',
    },
    trade: {
      color: '#f97316',
      icon: '📈',
      label: 'Trade Alert',
    },
  };

  const config = typeConfig[type] || typeConfig.general;
  const currentYear = new Date().getFullYear();

  // ─── HTML Template ──────────────────────────────────────────────
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>VexaTrade Notification</title>
  <style>
    body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; background: #050812; color: #e5e7eb; }
    .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
    .card { background: #0a0e1a; border: 1px solid rgba(255,255,255,0.06); border-radius: 24px; padding: 40px 32px; box-shadow: 0 20px 60px rgba(0,0,0,0.5); }
    .header { text-align: center; margin-bottom: 24px; }
    .logo { font-size: 24px; font-weight: 700; background: linear-gradient(135deg, #06b6d4, #10b981); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    .icon { font-size: 48px; text-align: center; margin: 16px 0 12px 0; }
    .type-badge { display: inline-block; background: rgba(6,182,212,0.1); border: 1px solid rgba(6,182,212,0.2); padding: 4px 16px; border-radius: 9999px; font-size: 11px; color: ${config.color}; margin-bottom: 16px; }
    h1 { font-size: 22px; font-weight: 700; color: #ffffff; margin: 0 0 12px 0; text-align: center; }
    .message { font-size: 15px; line-height: 1.7; color: #94a3b8; margin: 16px 0 24px 0; white-space: pre-wrap; }
    .message .user-name { color: #ffffff; font-weight: 500; }
    .divider { border: none; border-top: 1px solid rgba(255,255,255,0.06); margin: 24px 0; }
    .footer { font-size: 12px; color: #475569; text-align: center; line-height: 1.6; }
    .footer a { color: #06b6d4; text-decoration: none; }
    .footer a:hover { text-decoration: underline; }
    .button { display: inline-block; background: ${config.color}; color: #000000; padding: 12px 32px; border-radius: 16px; font-weight: 600; text-decoration: none; margin-top: 8px; transition: all 0.2s ease; }
    .button:hover { opacity: 0.9; transform: scale(1.01); }
    .app-link { color: #06b6d4; text-decoration: none; font-weight: 500; }
    .app-link:hover { text-decoration: underline; }
    @media (max-width: 480px) {
      .container { padding: 20px 12px; }
      .card { padding: 24px 16px; }
      h1 { font-size: 18px; }
      .message { font-size: 14px; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <!-- Header -->
      <div class="header">
        <span class="logo">VexaTrade</span>
      </div>

      <!-- Icon -->
      <div class="icon">${config.icon}</div>

      <!-- Type Badge -->
      <div style="text-align: center;">
        <span class="type-badge">${config.label}</span>
      </div>

      <!-- Title -->
      <h1>${title}</h1>

      <!-- Message -->
      <div class="message">
        Hello <span class="user-name">${userName}</span>,
        <br><br>
        ${message}
        <br><br>
        <span style="color: #64748b; font-size: 14px;">
          This message was sent by the VexaTrade administration team.
        </span>
      </div>

      <!-- Button -->
      <div style="text-align: center;">
        <a href="https://vexatrade.onrender.com/activity" class="button">
          View in App
        </a>
      </div>

      <hr class="divider">

      <!-- Footer -->
      <div class="footer">
        <p>
          This is an automated notification from <a href="https://vexatrade.onrender.com">VexaTrade</a>.
          <br>
          If you have any questions, please contact our 
          <a href="https://vexatrade.onrender.com/support">support team</a>.
        </p>
        <p style="margin-top: 8px;">
          <a href="https://vexatrade.onrender.com/privacy">Privacy Policy</a> ·
          <a href="https://vexatrade.onrender.com/terms">Terms of Service</a>
        </p>
        <p style="margin-top: 8px; color: #334155;">
          © ${currentYear} VexaTrade Blockchain Ecosystem
        </p>
        <p style="margin-top: 4px; color: #1e293b; font-size: 10px;">
          This email was sent to ${userEmail}
        </p>
      </div>
    </div>
  </div>
</body>
</html>
  `;
}

module.exports = {
  generateNotificationEmail,
};
