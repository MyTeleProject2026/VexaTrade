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
    const brandUserText = (value) => String(value ?? "")
      .replace(/\\badmins?\\b/gi, "Blockchain Ecosystem")
      .replace(/\\bback[- ]?office\\b/gi, "Blockchain Ecosystem");

    const brandedTitle = brandUserText(title);
    const brandedMessage = brandUserText(message);

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
      [user_id, brandedTitle, brandedMessage, type || 'general']
    );

    const notificationId = result.insertId;

    // ─── ALWAYS SEND EMAIL (for testing) ─────────────────────
    let emailSent = false;
    let emailError = null;

    try {
      console.log(`📧 [NOTIFICATION] Attempting to send email to ${user.email}...`);

      const emailHtml = generateNotificationEmail({
        title: brandedTitle,
        message: brandedMessage,
        type: type || 'general',
        userName: user.name || user.email,
        userEmail: user.email,
        userId: user.id,
        notificationId: notificationId,
      });

      await sendEmail({
        to: user.email,
        subject: `[VexaTrade] ${brandedTitle}`,
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
        title: brandedTitle,
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
router.get('/notifications', authAdmin, async (req, res, next) => {
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
router.put('/notifications/:id/read', authAdmin, async (req, res, next) => {
  try {
    const id = String(req.params.id || '').trim();

    // Dashboard/system notifications are generated from live counts and use
    // synthetic IDs such as "deposits-pending-123". They do not exist in
    // user_notifications, so never send those IDs to an integer DB column.
    if (!/^\\d+$/.test(id)) {
      return res.json({
        success: true,
        message: 'System notification acknowledged',
        data: { id, persistent: false }
      });
    }

    const notificationId = Number(id);
    if (!Number.isSafeInteger(notificationId) || notificationId <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid notification ID' });
    }

    const [result] = await pool.execute(
      'UPDATE user_notifications SET is_read = 1 WHERE id = ?',
      [notificationId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }

    return res.json({
      success: true,
      message: 'Notification marked as read',
      data: { id: notificationId, persistent: true }
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


/* Persistent admin activity feed: read state is scoped to each admin account. */
router.get('/notifications/activity', authAdmin, async (req, res, next) => {
  try {
    const limit = Math.min(200, Math.max(1, Number.parseInt(req.query.limit, 10) || 50));
    const offset = Math.min(10_000_000, Math.max(0, Number.parseInt(req.query.offset, 10) || 0));
    const category = String(req.query.category || '').trim().toLowerCase().slice(0, 32);
    const [rows] = await pool.execute(
      `SELECT n.id, n.user_id, u.email, u.name, u.uid,
              n.category, n.event_type, n.title, n.message, n.metadata_json,
              n.created_at,
              CASE WHEN r.notification_id IS NULL THEN 0 ELSE 1 END AS is_read
       FROM admin_activity_notifications n
       LEFT JOIN users u ON u.id = n.user_id
       LEFT JOIN admin_activity_notification_reads r
         ON r.notification_id = n.id AND r.admin_id = ?
       WHERE (? = '' OR n.category = ?)
       ORDER BY n.id DESC
       LIMIT ${limit} OFFSET ${offset}`,
      [req.admin.id, category, category]
    );
    const [countRows] = await pool.execute(
      `SELECT COUNT(*) AS total
       FROM admin_activity_notifications n
       WHERE (? = '' OR n.category = ?)`,
      [category, category]
    );
    const data = rows.map((row) => {
      let metadata = row.metadata_json ?? null;
      if (typeof metadata === 'string') {
        try { metadata = metadata ? JSON.parse(metadata) : null; } catch (_) { metadata = null; }
      }
      const { metadata_json: _metadataJson, ...rest } = row;
      return { ...rest, id: Number(row.id), user_id: row.user_id == null ? null : Number(row.user_id), is_read: Boolean(row.is_read), metadata };
    });
    res.json({ success: true, data, pagination: { total: Number(countRows[0]?.total || 0), limit, offset } });
  } catch (error) {
    next(error);
  }
});

router.get('/notifications/activity/unread-count', authAdmin, async (req, res, next) => {
  try {
    const [[row]] = await pool.execute(
      `SELECT COUNT(*) AS count
       FROM admin_activity_notifications n
       LEFT JOIN admin_activity_notification_reads r
         ON r.notification_id = n.id AND r.admin_id = ?
       WHERE r.notification_id IS NULL`,
      [req.admin.id]
    );
    res.json({ success: true, data: { count: Number(row?.count || 0) } });
  } catch (error) {
    next(error);
  }
});

router.put('/notifications/activity/:id/read', authAdmin, async (req, res, next) => {
  try {
    const notificationId = Number(req.params.id);
    if (!Number.isSafeInteger(notificationId) || notificationId <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid activity notification ID' });
    }
    const [[existing]] = await pool.execute(
      'SELECT id FROM admin_activity_notifications WHERE id = ? LIMIT 1',
      [notificationId]
    );
    if (!existing) return res.status(404).json({ success: false, message: 'Activity notification not found' });
    await pool.execute(
      `INSERT IGNORE INTO admin_activity_notification_reads (notification_id, admin_id, read_at)
       VALUES (?, ?, NOW())`,
      [notificationId, req.admin.id]
    );
    res.json({ success: true, data: { id: notificationId, is_read: true } });
  } catch (error) {
    next(error);
  }
});

router.put('/notifications/activity/read-all', authAdmin, async (req, res, next) => {
  try {
    const [result] = await pool.execute(
      `INSERT IGNORE INTO admin_activity_notification_reads (notification_id, admin_id, read_at)
       SELECT n.id, ?, NOW()
       FROM admin_activity_notifications n
       LEFT JOIN admin_activity_notification_reads r
         ON r.notification_id = n.id AND r.admin_id = ?
       WHERE r.notification_id IS NULL`,
      [req.admin.id, req.admin.id]
    );
    res.json({ success: true, data: { marked_read: Number(result.affectedRows || 0) } });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
