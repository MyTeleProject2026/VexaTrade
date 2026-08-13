// backend/src/routes/adminNotifications.js
const express = require('express');
const router = express.Router();
const pool = require('../../db');
const { authAdmin } = require('../middleware/auth');
const { sendEmail } = require('../../services/emailService');
const { generateNotificationEmail } = require('../../services/emailTemplates');

// ──────────────────────────────────────────────────────────────
// POST: Send notification to user (with email ALWAYS)
// ──────────────────────────────────────────────────────────────
router.post('/notifications/send', authAdmin, async (req, res, next) => {
  try {
    const { user_id, title, message, type, send_email } = req.body;

    // 📩 Log full request
    console.log('📩 [NOTIFICATION] Received:', {
      user_id,
      title,
      type,
      send_email,
      raw_body: req.body,
    });

    // ─── Validate input ──────────────────────────────────────
    if (!user_id || !title || !message) {
      return res.status(400).json({
        success: false,
        message: 'user_id, title, and message are required'
      });
    }

    // ─── Check if user exists ────────────────────────────────
    const [userRows] = await pool.query(
      'SELECT id, email, name, uid FROM users WHERE id = ?',
      [user_id]
    );

    if (userRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const user = userRows[0];

    // ─── Insert in-app notification ──────────────────────────
    const [result] = await pool.query(
      `INSERT INTO user_notifications (user_id, title, message, type, is_read, created_at)
       VALUES (?, ?, ?, ?, 0, NOW())`,
      [user_id, title, message, type || 'general']
    );

    const notificationId = result.insertId;

    // ─── ALWAYS SEND EMAIL (for testing) ─────────────────────
    let emailSent = false;
    let emailError = null;

    try {
      console.log(`📧 [NOTIFICATION] Attempting to send email to ${user.email}...`);

      const emailHtml = generateNotificationEmail({
        title,
        message,
        type: type || 'general',
        userName: user.name || user.email,
        userEmail: user.email,
        userId: user.id,
        notificationId: notificationId,
      });

      await sendEmail({
        to: user.email,
        subject: `[VexaTrade] ${title}`,
        html: emailHtml,
      });

      emailSent = true;
      console.log(`✅ [NOTIFICATION] Email sent to ${user.email}`);

      // ─── Log email sent ──────────────────────────────────
      await pool.query(
        `INSERT INTO notification_email_logs (notification_id, user_id, email, status, sent_at)
         VALUES (?, ?, ?, 'sent', NOW())`,
        [notificationId, user_id, user.email]
      );

    } catch (err) {
      emailError = err.message;
      console.error(`❌ [NOTIFICATION] Email failed for ${user.email}:`, err.message);
      if (err.response?.data) {
        console.error('   Brevo error details:', JSON.stringify(err.response.data, null, 2));
      }

      // ─── Log email failure ────────────────────────────────
      await pool.query(
        `INSERT INTO notification_email_logs (notification_id, user_id, email, status, error_message, sent_at)
         VALUES (?, ?, ?, 'failed', ?, NOW())`,
        [notificationId, user_id, user.email, err.message]
      );
    }

    // ─── Response ─────────────────────────────────────────────
    res.json({
      success: true,
      message: emailSent
        ? 'Notification sent successfully (with email)'
        : 'Notification saved, but email failed',
      data: {
        notification_id: notificationId,
        user_id: user_id,
        title: title,
        type: type || 'general',
        email_sent: emailSent,
        email_error: emailError,
      }
    });

  } catch (error) {
    console.error('❌ [NOTIFICATION] Unhandled error:', error);
    next(error);
  }
});
      
// ──────────────────────────────────────────────────────────────
// GET: System notifications for admin dashboard
// ──────────────────────────────────────────────────────────────
router.get('/admin/notifications', authAdmin, async (req, res, next) => {
  try {
    const notifications = [];

    // ─── Pending KYC ──────────────────────────────────────
    const [pendingKyc] = await pool.execute(
      "SELECT COUNT(*) as count FROM user_kyc WHERE verification_status = 'pending'"
    );
    if (pendingKyc[0]?.count > 0) {
      notifications.push({
        id: `kyc-pending-${Date.now()}`,
        type: "kyc",
        title: "Pending KYC Submissions",
        message: `${pendingKyc[0].count} user(s) have pending KYC verification.`,
        is_read: false,
        created_at: new Date().toISOString()
      });
    }

    // ─── Pending Deposits ──────────────────────────────────
    const [pendingDeposits] = await pool.execute(
      "SELECT COUNT(*) as count FROM deposits WHERE status = 'pending'"
    );
    if (pendingDeposits[0]?.count > 0) {
      notifications.push({
        id: `deposits-pending-${Date.now()}`,
        type: "deposit",
        title: "Pending Deposits",
        message: `${pendingDeposits[0].count} deposit request(s) awaiting approval.`,
        is_read: false,
        created_at: new Date().toISOString()
      });
    }

    // ─── Pending Withdrawals ──────────────────────────────
    const [pendingWithdrawals] = await pool.execute(
      "SELECT COUNT(*) as count FROM withdrawals WHERE status = 'pending'"
    );
    if (pendingWithdrawals[0]?.count > 0) {
      notifications.push({
        id: `withdrawals-pending-${Date.now()}`,
        type: "withdraw",
        title: "Pending Withdrawals",
        message: `${pendingWithdrawals[0].count} withdrawal request(s) awaiting approval.`,
        is_read: false,
        created_at: new Date().toISOString()
      });
    }

    // ─── Pending Loans ────────────────────────────────────
    const [pendingLoans] = await pool.execute(
      "SELECT COUNT(*) as count FROM loans WHERE status = 'pending'"
    );
    if (pendingLoans[0]?.count > 0) {
      notifications.push({
        id: `loans-pending-${Date.now()}`,
        type: "loan",
        title: "Pending Loan Requests",
        message: `${pendingLoans[0].count} loan request(s) awaiting approval.`,
        is_read: false,
        created_at: new Date().toISOString()
      });
    }

    // ─── Pending Joint Accounts ────────────────────────────
    const [pendingJoint] = await pool.execute(
      "SELECT COUNT(*) as count FROM joint_account_requests WHERE status = 'pending'"
    );
    if (pendingJoint[0]?.count > 0) {
      notifications.push({
        id: `joint-pending-${Date.now()}`,
        type: "joint_account",
        title: "Pending Joint Account Requests",
        message: `${pendingJoint[0].count} joint account request(s) awaiting approval.`,
        is_read: false,
        created_at: new Date().toISOString()
      });
    }

    // ─── Sort by date (newest first) ──────────────────────
    notifications.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    res.json({ success: true, data: notifications });
  } catch (error) {
    console.error('❌ [Admin Notifications] Error:', error);
    next(error);
  }
});

// ──────────────────────────────────────────────────────────────
// PUT: Mark system notification as read
// ──────────────────────────────────────────────────────────────
router.put('/admin/notifications/:id/read', authAdmin, async (req, res, next) => {
  // System notifications are dynamic (read state is not stored)
  // Just return success
  try {
    const { id } = req.params;

    const [result] = await pool.query(
      'UPDATE user_notifications SET is_read = 1 WHERE id = ?',
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    res.json({
      success: true,
      message: 'Notification marked as read'
    });
  } catch (error) {
    next(error);
  }
});


// ──────────────────────────────────────────────────────────────


// ──────────────────────────────────────────────────────────────
// GET: Notification history (admin)
// ──────────────────────────────────────────────────────────────
router.get('/notifications/history', authAdmin, async (req, res, next) => {
  try {
    const { limit = 50, offset = 0 } = req.query;

    const [rows] = await pool.query(
      `SELECT n.id, n.user_id, u.email, u.name, u.uid,
              n.title, n.message, n.type, n.is_read, n.created_at,
              l.status as email_status, l.sent_at as email_sent_at
       FROM user_notifications n
       LEFT JOIN users u ON u.id = n.user_id
       LEFT JOIN notification_email_logs l ON l.notification_id = n.id
       ORDER BY n.created_at DESC
       LIMIT ? OFFSET ?`,
      [Number(limit), Number(offset)]
    );

    const [countRows] = await pool.query(
      'SELECT COUNT(*) as total FROM user_notifications'
    );

    res.json({
      success: true,
      data: rows,
      pagination: {
        total: countRows[0]?.total || 0,
        limit: Number(limit),
        offset: Number(offset)
      }
    });
  } catch (error) {
    next(error);
  }
});

// ──────────────────────────────────────────────────────────────
// GET: User notifications (for user activity page)
// ──────────────────────────────────────────────────────────────
router.get('/notifications/user/:userId', authAdmin, async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    const [rows] = await pool.query(
      `SELECT id, title, message, type, is_read, created_at
       FROM user_notifications
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [userId, Number(limit), Number(offset)]
    );

    const [countRows] = await pool.query(
      'SELECT COUNT(*) as total FROM user_notifications WHERE user_id = ?',
      [userId]
    );

    res.json({
      success: true,
      data: rows,
      pagination: {
        total: countRows[0]?.total || 0,
        limit: Number(limit),
        offset: Number(offset)
      }
    });
  } catch (error) {
    next(error);
  }
});

// ──────────────────────────────────────────────────────────────
// PUT: Mark notification as read
// ──────────────────────────────────────────────────────────────
router.put('/notifications/:id/read', authAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;

    const [result] = await pool.query(
      'UPDATE user_notifications SET is_read = 1 WHERE id = ?',
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    res.json({
      success: true,
      message: 'Notification marked as read'
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
