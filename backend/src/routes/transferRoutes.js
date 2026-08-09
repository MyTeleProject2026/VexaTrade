// backend/src/routes/transferRoutes.js
const express = require('express');
const router = express.Router();
const QRCode = require('qrcode');
const pool = require('../../db');
const { authUser } = require('../middleware/auth');
const { createError, createTransactionLog, createUserNotification } = require('../utils/helpers');

// ─── GET /api/user/qr-code ──────────────────────────────────────────
router.get('/user/qr-code', authUser, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const [userRows] = await pool.execute(`SELECT uid, email FROM users WHERE id = ?`, [userId]);
    if (!userRows.length) return res.status(404).json({ success: false, message: "User not found" });
    const userUid = userRows[0].uid;
    const userEmail = userRows[0].email;
    const [qrRows] = await pool.execute(`SELECT id, qr_data, qr_code_base64 FROM user_qr_codes WHERE user_id = ?`, [userId]);
    let qrCodeBase64 = null;
    let qrData = null;
    if (qrRows.length && qrRows[0].qr_code_base64) {
      qrCodeBase64 = qrRows[0].qr_code_base64;
      qrData = qrRows[0].qr_data;
    } else {
      const newQrData = JSON.stringify({ type: "VexaTrade_transfer", uid: userUid, name: userEmail, generatedAt: new Date().toISOString() });
      const qrBuffer = await QRCode.toBuffer(newQrData, { width: 300, margin: 2, color: { dark: '#000000', light: '#FFFFFF' }, type: 'png' });
      qrCodeBase64 = qrBuffer.toString('base64');
      qrData = newQrData;
      if (qrRows.length) {
        await pool.execute(`UPDATE user_qr_codes SET qr_data = ?, qr_code_base64 = ?, updated_at = NOW() WHERE user_id = ?`, [qrData, qrCodeBase64, userId]);
      } else {
        await pool.execute(`INSERT INTO user_qr_codes (user_id, qr_data, qr_code_base64) VALUES (?, ?, ?)`, [userId, qrData, qrCodeBase64]);
      }
    }
    res.json({ success: true, data: { qr_code_base64: `data:image/png;base64,${qrCodeBase64}`, qr_data: qrData } });
  } catch (error) { next(error); }
});

// ─── GET /api/user/by-uid/:uid ──────────────────────────────────────
router.get('/user/by-uid/:uid', authUser, async (req, res, next) => {
  try {
    const { uid } = req.params;
    const [rows] = await pool.execute(`SELECT id, uid, name, email FROM users WHERE uid = ?`, [uid]);
    if (!rows.length) return res.status(404).json({ success: false, message: "User not found" });
    res.json({ success: true, data: { id: rows[0].id, uid: rows[0].uid, name: rows[0].name, email: rows[0].email } });
  } catch (error) { next(error); }
});

// ─── POST /api/user/transfer ────────────────────────────────────────
router.post('/user/transfer', authUser, async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const { recipientUid, amount, note } = req.body;
    const senderId = req.user.id;
    if (!recipientUid) return res.status(400).json({ success: false, message: "Recipient UID required" });
    const transferAmount = Number(amount);
    if (!Number.isFinite(transferAmount) || transferAmount <= 0) return res.status(400).json({ success: false, message: "Invalid amount" });
    if (transferAmount < 1) return res.status(400).json({ success: false, message: "Minimum transfer is 1 USDT" });
    await connection.beginTransaction();
    const [senderRows] = await connection.execute(`SELECT id, uid, name, email, balance FROM users WHERE id = ? FOR UPDATE`, [senderId]);
    if (!senderRows.length) { await connection.rollback(); return res.status(404).json({ success: false, message: "Sender not found" }); }
    const sender = senderRows[0];
    const [recipientRows] = await connection.execute(`SELECT id, uid, name, email, balance FROM users WHERE uid = ? FOR UPDATE`, [recipientUid]);
    if (!recipientRows.length) { await connection.rollback(); return res.status(404).json({ success: false, message: "Recipient not found" }); }
    const recipient = recipientRows[0];
    if (sender.id === recipient.id) { await connection.rollback(); return res.status(400).json({ success: false, message: "Cannot transfer to yourself" }); }
    const senderBalance = Number(sender.balance || 0);
    if (senderBalance < transferAmount) { await connection.rollback(); return res.status(400).json({ success: false, message: "Insufficient balance" }); }
    await connection.execute(`UPDATE users SET balance = balance - ?, updated_at = NOW() WHERE id = ?`, [transferAmount, sender.id]);
    await connection.execute(`UPDATE users SET balance = balance + ?, updated_at = NOW() WHERE id = ?`, [transferAmount, recipient.id]);
    await createTransactionLog(connection, { userId: sender.id, type: "transfer_sent", amount: transferAmount, status: "completed", referenceId: recipient.id, note: `Transfer to ${recipient.uid}${note ? ` - ${note}` : ""}` });
    await createTransactionLog(connection, { userId: recipient.id, type: "transfer_received", amount: transferAmount, status: "completed", referenceId: sender.id, note: `Transfer from ${sender.uid}${note ? ` - ${note}` : ""}` });
    const [transferResult] = await connection.execute(
      `INSERT INTO user_transfers (sender_id, receiver_id, amount, currency, status, note, created_at, completed_at)
       VALUES (?, ?, ?, 'USDT', 'completed', ?, NOW(), NOW())`,
      [sender.id, recipient.id, transferAmount, note || null]
    );
    await createUserNotification(connection, { userId: recipient.id, title: "Transfer Received", message: `You received ${transferAmount} USDT from ${sender.name || sender.email}`, type: "funds" });
    await createUserNotification(connection, { userId: sender.id, title: "Transfer Sent", message: `You sent ${transferAmount} USDT to ${recipient.name || recipient.email}`, type: "funds" });
    await connection.commit();
    res.json({ success: true, message: "Transfer completed", data: { transfer_id: transferResult.insertId, from: sender.uid, to: recipient.uid, amount: transferAmount, remaining_balance: senderBalance - transferAmount } });
  } catch (error) { await connection.rollback(); next(error); } finally { connection.release(); }
});

// ─── GET /api/user/transfers ────────────────────────────────────────
router.get('/user/transfers', authUser, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const [rows] = await pool.execute(
      `SELECT ut.*, s.uid as sender_uid, s.name as sender_name, s.email as sender_email,
              r.uid as receiver_uid, r.name as receiver_name, r.email as receiver_email
       FROM user_transfers ut
       LEFT JOIN users s ON s.id = ut.sender_id
       LEFT JOIN users r ON r.id = ut.receiver_id
       WHERE ut.sender_id = ? OR ut.receiver_id = ?
       ORDER BY ut.created_at DESC LIMIT 100`,
      [userId, userId]
    );
    const formattedTransfers = rows.map(transfer => ({
      id: transfer.id,
      amount: Number(transfer.amount),
      currency: transfer.currency,
      status: transfer.status,
      note: transfer.note,
      created_at: transfer.created_at,
      is_sent: transfer.sender_id === userId,
      sender: { uid: transfer.sender_uid, name: transfer.sender_name, email: transfer.sender_email },
      receiver: { uid: transfer.receiver_uid, name: transfer.receiver_name, email: transfer.receiver_email },
    }));
    res.json({ success: true, data: formattedTransfers });
  } catch (error) { next(error); }
});

module.exports = router;
