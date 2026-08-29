// backend/src/routes/jointAccountRoutes.js
const express = require('express');
const router = express.Router();
const pool = require('../../db');
const { authUser, authAdmin } = require('../middleware/auth');
const { createError, createUserNotification, createAuditLog } = require('../utils/helpers');

// ─── User ───────────────────────────────────────────────────────────
router.get('/joint-account/status', authUser, async (req, res, next) => {
  try {
    const [userRows] = await pool.execute(`SELECT uid FROM users WHERE id = ?`, [req.user.id]);
    if (!userRows.length) return res.status(404).json({ success: false, message: "User not found" });
    const userUid = userRows[0].uid;
    const [jointRows] = await pool.execute(`SELECT * FROM joint_accounts WHERE (user1_uid = ? OR user2_uid = ?) AND status = 'active'`, [userUid, userUid]);
    const [pendingRows] = await pool.execute(`SELECT * FROM joint_account_requests WHERE (requester_uid = ? OR partner_uid = ?) AND status = 'pending'`, [userUid, userUid]);
    res.json({ success: true, data: { hasJointAccount: jointRows.length > 0, jointAccount: jointRows[0] || null, pendingRequest: pendingRows[0] || null } });
  } catch (error) { next(error); }
});

router.post('/joint-account/request', authUser, async (req, res, next) => {
  try {
    const { partnerEmail, partnerKycNumber } = req.body;
    const [requesterRows] = await pool.execute(`SELECT id, uid, email FROM users WHERE id = ?`, [req.user.id]);
    if (!requesterRows.length) throw createError(404, "User not found");
    const requester = requesterRows[0];
    if (!partnerEmail) throw createError(400, "Partner email required");
    const normalizedEmail = partnerEmail.trim().toLowerCase();
    const [partnerRows] = await pool.execute(`SELECT id, uid, email, kyc_status FROM users WHERE LOWER(email) = ? LIMIT 1`, [normalizedEmail]);
    if (!partnerRows.length) throw createError(404, "Partner not found");
    const partner = partnerRows[0];
    if (partner.uid === requester.uid) throw createError(400, "Cannot request with yourself");
    if (partner.kyc_status !== "approved") throw createError(400, "Partner KYC required");
    const [requesterActive] = await pool.execute(`SELECT id FROM joint_accounts WHERE (user1_uid = ? OR user2_uid = ?) AND status = 'active' LIMIT 1`, [requester.uid, requester.uid]);
    if (requesterActive.length) throw createError(400, "Already in a joint account");
    const [partnerActive] = await pool.execute(`SELECT id FROM joint_accounts WHERE (user1_uid = ? OR user2_uid = ?) AND status = 'active' LIMIT 1`, [partner.uid, partner.uid]);
    if (partnerActive.length) throw createError(400, "Partner is already in a joint account");
    const [existing] = await pool.execute(`SELECT id FROM joint_account_requests WHERE ((requester_uid = ? AND partner_uid = ?) OR (requester_uid = ? AND partner_uid = ?)) AND status = 'pending' LIMIT 1`, [requester.uid, partner.uid, partner.uid, requester.uid]);
    if (existing.length) throw createError(400, "Request already pending");
    const [result] = await pool.execute(
      `INSERT INTO joint_account_requests (requester_uid, requester_email, partner_uid, partner_email, partner_kyc_number, status, requester_id, partner_id)
       VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)`,
      [requester.uid, requester.email, partner.uid, partner.email, partnerKycNumber || null, requester.id, partner.id]
    );
    res.json({ success: true, message: "Joint account request sent", data: { requestId: result.insertId } });
  } catch (error) { next(error); }
});

router.get('/joint-account/combined-balance', authUser, async (req, res, next) => {
  try {
    const [userRows] = await pool.execute(`SELECT id, uid, balance FROM users WHERE id = ?`, [req.user.id]);
    if (!userRows.length) return res.json({ success: true, data: { hasJointAccount: false, combinedBalance: 0, userBalance: 0, partnerBalance: 0, partnerName: null } });
    const currentUser = userRows[0];
    const [jointRows] = await pool.execute(`SELECT * FROM joint_accounts WHERE (user1_uid = ? OR user2_uid = ?) AND status = 'active' LIMIT 1`, [currentUser.uid, currentUser.uid]);
    if (!jointRows.length) {
      return res.json({ success: true, data: { hasJointAccount: false, combinedBalance: Number(currentUser.balance || 0), userBalance: Number(currentUser.balance || 0), partnerBalance: 0, partnerName: null } });
    }
    const joint = jointRows[0];
    const partnerUid = joint.user1_uid === currentUser.uid ? joint.user2_uid : joint.user1_uid;
    const [partnerRows] = await pool.execute(`SELECT id, uid, name, balance FROM users WHERE uid = ? LIMIT 1`, [partnerUid]);
    let partnerBalance = 0;
    let partnerName = null;
    if (partnerRows.length) {
      partnerBalance = Number(partnerRows[0].balance || 0);
      partnerName = partnerRows[0].name || partnerRows[0].uid;
    }
    const combinedBalance = Number(currentUser.balance || 0) + partnerBalance;
    res.json({ success: true, data: { hasJointAccount: true, combinedBalance, userBalance: Number(currentUser.balance || 0), partnerBalance, partnerName, partnerUid, accountId: joint.account_id } });
  } catch (error) { next(error); }
});

// ─── Admin ──────────────────────────────────────────────────────────
router.get('/admin/joint-account-requests', authAdmin, async (req, res, next) => {
  try {
    const [rows] = await pool.execute(`SELECT * FROM joint_account_requests WHERE status = 'pending' ORDER BY created_at DESC`);
    res.json({ success: true, data: rows });
  } catch (error) { next(error); }
});

router.post('/admin/joint-account-requests/:id/approve', authAdmin, async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const requestId = req.params.id;
    await connection.beginTransaction();
    const [requestRows] = await connection.execute(`SELECT * FROM joint_account_requests WHERE id = ? AND status = 'pending' FOR UPDATE`, [requestId]);
    if (!requestRows.length) throw createError(404, "Request not found");
    const request = requestRows[0];
    const [requesterUser] = await connection.execute(`SELECT id, uid FROM users WHERE uid = ? FOR UPDATE`, [request.requester_uid]);
    const [partnerUser] = await connection.execute(`SELECT id, uid FROM users WHERE uid = ? FOR UPDATE`, [request.partner_uid]);
    if (!requesterUser.length || !partnerUser.length) throw createError(404, "User not found");
    const [existingJoint] = await connection.execute(`SELECT id FROM joint_accounts WHERE ((user1_uid = ? AND user2_uid = ?) OR (user1_uid = ? AND user2_uid = ?)) AND status = 'active' LIMIT 1 FOR UPDATE`, [request.requester_uid, request.partner_uid, request.partner_uid, request.requester_uid]);
    if (existingJoint.length) throw createError(409, "Users already have an active joint account");
    const [requesterOtherJoint] = await connection.execute(`SELECT id FROM joint_accounts WHERE (user1_uid = ? OR user2_uid = ?) AND status = 'active' LIMIT 1 FOR UPDATE`, [request.requester_uid, request.requester_uid]);
    const [partnerOtherJoint] = await connection.execute(`SELECT id FROM joint_accounts WHERE (user1_uid = ? OR user2_uid = ?) AND status = 'active' LIMIT 1 FOR UPDATE`, [request.partner_uid, request.partner_uid]);
    if (requesterOtherJoint.length || partnerOtherJoint.length) throw createError(409, "One of these users is already in an active joint account");
    const accountId = `JA${Date.now()}${cryptoSafeRandomSuffix()}`;
    await connection.execute(`INSERT INTO joint_accounts (account_id, user1_uid, user2_uid, status, approved_at) VALUES (?, ?, ?, 'active', NOW())`, [accountId, request.requester_uid, request.partner_uid]);
    await connection.execute(`UPDATE joint_account_requests SET status = 'approved', updated_at = NOW() WHERE id = ?`, [requestId]);
    await createUserNotification(connection, { userId: requesterUser[0].id, title: "Joint Account Approved", message: `Your joint account with ${request.partner_email} has been approved!`, type: "joint_account" });
    await createUserNotification(connection, { userId: partnerUser[0].id, title: "Joint Account Approved", message: `Your joint account with ${request.requester_email} has been approved!`, type: "joint_account" });
    await connection.commit();
    res.json({ success: true, message: "Joint account approved" });
  } catch (error) { await connection.rollback(); next(error); } finally { connection.release(); }
});

function cryptoSafeRandomSuffix() {
  return Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
}

router.post('/admin/joint-account-requests/:id/reject', authAdmin, async (req, res, next) => {
  try {
    const requestId = req.params.id;
    const { admin_note } = req.body;
    const [requestRows] = await pool.execute(`SELECT * FROM joint_account_requests WHERE id = ? AND status = 'pending'`, [requestId]);
    if (!requestRows.length) throw createError(404, "Request not found");
    await pool.execute(`UPDATE joint_account_requests SET status = 'rejected', admin_note = ?, updated_at = NOW() WHERE id = ?`, [admin_note || null, requestId]);
    res.json({ success: true, message: "Joint account request rejected" });
  } catch (error) { next(error); }
});

router.post('/admin/joint-accounts/:id/disconnect', authAdmin, async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const jointAccountId = Number(req.params.id);
    if (!Number.isInteger(jointAccountId) || jointAccountId <= 0) throw createError(400, "Invalid joint account ID");
    await connection.beginTransaction();
    const [jointRows] = await connection.execute(`SELECT * FROM joint_accounts WHERE id = ? AND status = 'active' FOR UPDATE`, [jointAccountId]);
    if (!jointRows.length) throw createError(404, "Joint account not found");
    const joint = jointRows[0];
    const [users] = await connection.execute(`SELECT id, uid, name FROM users WHERE uid IN (?, ?)`, [joint.user1_uid, joint.user2_uid]);
    const userByUid = new Map(users.map(user => [user.uid, user]));
    await connection.execute(`UPDATE joint_accounts SET status = 'inactive', updated_at = NOW() WHERE id = ?`, [jointAccountId]);
    const user1 = userByUid.get(joint.user1_uid);
    const user2 = userByUid.get(joint.user2_uid);
    if (user1) await createUserNotification(connection, { userId: user1.id, title: "Joint Account Disconnected", message: `Your joint account with ${user2?.name || joint.user2_uid} has been disconnected.`, type: "security" });
    if (user2) await createUserNotification(connection, { userId: user2.id, title: "Joint Account Disconnected", message: `Your joint account with ${user1?.name || joint.user1_uid} has been disconnected.`, type: "security" });
    await createAuditLog(connection, { adminId: req.admin.id, action: "disconnect_joint_account", referenceId: jointAccountId, note: `Disconnected joint account #${jointAccountId}` });
    await connection.commit();
    res.json({ success: true, message: "Joint account disconnected" });
  } catch (error) { await connection.rollback(); next(error); } finally { connection.release(); }
});

router.get('/admin/joint-accounts', authAdmin, async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      `SELECT ja.*, u1.name as user1_name, u1.email as user1_email, u2.name as user2_name, u2.email as user2_email
       FROM joint_accounts ja
       LEFT JOIN users u1 ON u1.uid = ja.user1_uid
       LEFT JOIN users u2 ON u2.uid = ja.user2_uid
       ORDER BY ja.created_at DESC`
    );
    res.json({ success: true, data: rows });
  } catch (error) { next(error); }
});

module.exports = router;