const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const pool = require('../../db');
const { authUser, authAdmin } = require('../middleware/auth');
const { transactionSecurity } = require('../middleware/transactionSecurity');
const { createError, createTransactionLog, createUserNotification, createAuditLog } = require('../utils/helpers');
const {
  ensureLegacyUsdtAvailable,
  getUserUsdtAvailable,
  reserveAssetBalance,
  releaseReservedAsset,
  consumeReservedAsset,
} = require('../../services/assetLedgerService');

const idempotencyKey = (req) =>
  String(req.get('Idempotency-Key') || req.body?.idempotencyKey || '').trim().slice(0, 128);

const requestHash = (amount) =>
  crypto.createHash('sha256').update(String(amount)).digest('hex');

let readyPromise = null;

async function ensureTable() {
  if (!readyPromise) {
    readyPromise = (async () => {
      await pool.execute(`
        CREATE TABLE IF NOT EXISTS profit_withdrawal_requests (
          id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
          user_id BIGINT UNSIGNED NOT NULL,
          amount DECIMAL(36,18) NOT NULL,
          status VARCHAR(32) NOT NULL DEFAULT 'pending',
          request_hash CHAR(64) NULL,
          idempotency_key VARCHAR(128) NULL,
          admin_note TEXT NULL,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          approved_at DATETIME NULL,
          rejected_at DATETIME NULL,
          settled_at DATETIME NULL,
          PRIMARY KEY(id),
          UNIQUE KEY uq_profit_withdrawal_user_key(user_id,idempotency_key),
          KEY idx_profit_withdrawal_user_status(user_id,status),
          KEY idx_profit_withdrawal_status_created(status,created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
      try {
        await pool.execute(`
          ALTER TABLE profit_withdrawal_requests
          ADD COLUMN settled_at DATETIME NULL
        `);
      } catch (error) {
        if (!/duplicate|exists/i.test(String(error?.message || ''))) throw error;
      }
    })().catch((error) => {
      readyPromise = null;
      throw error;
    });
  }
  await readyPromise;
}

async function getSettings(connection) {
  try {
    const [rows] = await connection.execute(`
      SELECT min_withdrawal_from_profit,max_withdrawal_from_profit,
             allow_withdrawal_before_target,restriction_message
      FROM platform_withdrawal_settings
      WHERE id=1 LIMIT 1
    `);
    return rows[0] || {};
  } catch (_) {
    return {};
  }
}

async function availableProfit(connection, userId, excludeRequestId = null) {
  const [[target]] = await connection.execute(
    `SELECT id,target_amount,current_profit,status
     FROM user_targets
     WHERE user_id=? AND status IN ('active','achieved')
     ORDER BY id DESC
     LIMIT 1 FOR UPDATE`,
    [userId]
  );

  // Both pending and approved requests have already reserved wallet USDT.
  // They must remain excluded from the next request until rejected or settled.
  const [[committed]] = await connection.execute(
    `SELECT COALESCE(SUM(amount),0) committed_amount
     FROM profit_withdrawal_requests
     WHERE user_id=?
       AND status IN ('pending','approved')
       AND (? IS NULL OR id<>?)`,
    [userId, excludeRequestId, excludeRequestId]
  );

  const availableWallet = await getUserUsdtAvailable(connection, userId);
  const currentProfit = Number(target?.current_profit || 0);
  const committedAmount = Number(committed?.committed_amount || 0);

  // user_targets.current_profit is the canonical profit entitlement fed by
  // every real profit-producing settlement (short-term trades and fund profits).
  // Pending/approved requests are excluded because their USDT is already
  // reserved. Final settlement atomically reduces current_profit, so historical
  // settled requests must not be subtracted a second time.
  const targetAvailable = Math.max(0, currentProfit - committedAmount);
  const available = Math.min(targetAvailable, Math.max(0, Number(availableWallet)));

  return {
    target: target || null,
    currentProfit,
    pendingProfit: committedAmount,
    walletAvailable: Number(availableWallet.toFixed(18)),
    earnedWalletProfit: Number(currentProfit.toFixed(18)),
    withdrawnProfit: 0,
    available: Number(available.toFixed(18)),
  };
}

router.get('/withdraw/profit-availability', authUser, async (req, res, next) => {
  try {
    await ensureTable();
    const db = await pool.getConnection();
    try {
      await db.beginTransaction();
      const funds = await availableProfit(db, req.user.id);
      await db.commit();
      res.json({
        success: true,
        data: {
          currentProfit: funds.currentProfit,
          pendingProfit: funds.pendingProfit,
          walletAvailable: funds.walletAvailable,
          earnedWalletProfit: funds.earnedWalletProfit,
          withdrawnProfit: funds.withdrawnProfit,
          walletReserved: funds.walletReserved,
          walletPending: funds.walletPending,
          walletTotal: funds.walletTotal,
          availableProfit: funds.available,        },
      });
    } catch (error) {
      try { await db.rollback(); } catch (_) {}
      throw error;
    } finally {
      db.release();
    }
  } catch (error) {
    next(error);
  }
});

router.post('/withdraw/profit-request', authUser, transactionSecurity('profit-withdrawal'), async (req, res, next) => {
  const db = await pool.getConnection();
  try {
    await ensureTable();

    const amount = Number(req.body?.amount);
    const key = idempotencyKey(req);

    if (!Number.isFinite(amount) || amount <= 0) {
      throw createError(400, 'Valid profit withdrawal amount required');
    }
    if (!key) {
      throw createError(400, 'Idempotency-Key header is required');
    }

    await db.beginTransaction();

    const settings = await getSettings(db);
    const min = Number(settings.min_withdrawal_from_profit || 0);
    const max = settings.max_withdrawal_from_profit == null
      ? null
      : Number(settings.max_withdrawal_from_profit);

    if (min > 0 && amount < min) {
      throw createError(400, `Minimum profit withdrawal is ${min} USDT`);
    }
    if (max != null && Number.isFinite(max) && amount > max) {
      throw createError(400, `Maximum profit withdrawal is ${max} USDT`);
    }

    const hash = requestHash(amount);
    const [existing] = await db.execute(
      `SELECT id,amount,status,request_hash
       FROM profit_withdrawal_requests
       WHERE user_id=? AND idempotency_key=?
       LIMIT 1 FOR UPDATE`,
      [req.user.id, key]
    );

    if (existing.length) {
      if (existing[0].request_hash !== hash) {
        throw createError(409, 'Idempotency-Key was already used for a different profit withdrawal');
      }
      await db.commit();
      return res.json({
        success: true,
        message: 'Existing profit withdrawal request returned',
        data: { ...existing[0], replayed: true },
      });
    }

    const funds = await availableProfit(db, req.user.id);
    if (!funds.target) {
      throw createError(400, 'No active target with available profit');
    }

    const targetAmount = Number(funds.target.target_amount || 0);
    const targetReached =
      String(funds.target.status || '').toLowerCase() === 'achieved' ||
      (targetAmount > 0 && Number(funds.currentProfit) >= targetAmount);

    if (!targetReached && Number(settings.allow_withdrawal_before_target || 0) !== 1) {
      throw createError(
        403,
        settings.restriction_message ||
          'Profit withdrawals are not currently allowed before the target is achieved'
      );
    }

    if (amount > funds.available) {
      throw createError(
        400,
        `Only ${funds.available.toFixed(8)} USDT of profit is currently available for withdrawal`
      );
    }

    await ensureLegacyUsdtAvailable(db, req.user.id);

    const [result] = await db.execute(
      `INSERT INTO profit_withdrawal_requests
       (user_id,amount,status,request_hash,idempotency_key,created_at,updated_at)
       VALUES(?,?, 'pending',?,?,NOW(),NOW())`,
      [req.user.id, amount, hash, key]
    );

    await reserveAssetBalance(db, {
      userId: req.user.id,
      coin: 'USDT',
      network: 'INTERNAL',
      amount,
      referenceType: 'profit_withdrawal',
      referenceId: result.insertId,
      note: 'Profit withdrawal reserved pending admin review',
    });

    await createTransactionLog(db, {
      userId: req.user.id,
      type: 'profit_withdrawal_request',
      amount,
      status: 'pending',
      referenceId: result.insertId,
      note: 'Profit withdrawal submitted for admin review',
    });

    await createUserNotification(db, {
      userId: req.user.id,
      title: 'Profit withdrawal submitted',
      message: `Your ${amount.toFixed(2)} USDT profit withdrawal request is pending admin review.`,
      type: 'withdrawal',
    });

    await db.commit();

    res.json({
      success: true,
      message: 'Profit withdrawal request submitted for review',
      data: {
        id: result.insertId,
        amount,
        status: 'pending',
        currentProfit: funds.currentProfit,
        pendingProfit: funds.pendingProfit + amount,
        availableProfit: funds.available - amount,
        walletAvailable: funds.walletAvailable,
      },
    });
  } catch (error) {
    try { await db.rollback(); } catch (_) {}
    next(error);
  } finally {
    db.release();
  }
});

router.get('/withdraw/profit-history', authUser, async (req, res, next) => {
  try {
    await ensureTable();
    const [rows] = await pool.execute(
      `SELECT id,amount,status,admin_note,created_at,updated_at,
              approved_at,rejected_at,settled_at
       FROM profit_withdrawal_requests
       WHERE user_id=?
       ORDER BY id DESC LIMIT 100`,
      [req.user.id]
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
});

router.get('/admin/profit-withdrawal-requests', authAdmin, async (req, res, next) => {
  try {
    await ensureTable();
    const [rows] = await pool.execute(
      `SELECT p.id,p.user_id,p.amount,p.status,p.admin_note,
              p.created_at,p.updated_at,p.approved_at,p.rejected_at,p.settled_at,
              u.uid,u.name,u.email,
              COALESCE((
                SELECT current_profit
                FROM user_targets t
                WHERE t.user_id=p.user_id AND t.status IN ('active','achieved')
                ORDER BY t.id DESC LIMIT 1
              ),0) current_profit,
              COALESCE((
                SELECT available_balance
                FROM user_assets a
                WHERE a.user_id=p.user_id AND a.coin='USDT'
                LIMIT 1
              ),0) available_usdt,
              COALESCE((
                SELECT reserved_balance
                FROM user_assets a
                WHERE a.user_id=p.user_id AND a.coin='USDT'
                LIMIT 1
              ),0) reserved_usdt
       FROM profit_withdrawal_requests p
       LEFT JOIN users u ON u.id=p.user_id
       ORDER BY p.id DESC LIMIT 200`
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
});

router.post('/admin/profit-withdrawal-requests/:id/approve', authAdmin, async (req, res, next) => {
  const db = await pool.getConnection();
  try {
    await ensureTable();

    const requestId = Number(req.params.id);
    if (!Number.isInteger(requestId) || requestId <= 0) {
      throw createError(400, 'Invalid request ID');
    }

    await db.beginTransaction();

    const [[request]] = await db.execute(
      'SELECT * FROM profit_withdrawal_requests WHERE id=? FOR UPDATE',
      [requestId]
    );

    if (!request) throw createError(404, 'Profit withdrawal request not found');
    if (request.status !== 'pending') {
      throw createError(409, `Request is already ${request.status}`);
    }

    const funds = await availableProfit(db, request.user_id, requestId);
    if (!funds.target) throw createError(409, 'User has no active target');
    if (Number(request.amount) > funds.available) {
      throw createError(409, 'Requested profit is no longer available');
    }

    const [[walletBefore]] = await db.execute(
      `SELECT available_balance,reserved_balance,pending_balance,balance
       FROM user_assets
       WHERE user_id=? AND coin='USDT'
       LIMIT 1 FOR UPDATE`,
      [request.user_id]
    );

    if (Number(walletBefore?.reserved_balance || 0) < Number(request.amount)) {
      throw createError(409, 'Reserved USDT for this profit withdrawal is no longer available');
    }

    // Approval only authorizes the payout. It does not consume the reserved
    // ledger amount yet. Settlement is the point at which the external/manual
    // treasury payout is actually completed.
    await db.execute(
      `UPDATE profit_withdrawal_requests
       SET status='approved',approved_at=NOW(),updated_at=NOW()
       WHERE id=? AND status='pending'`,
      [requestId]
    );

    await createTransactionLog(db, {
      userId: request.user_id,
      type: 'profit_withdrawal_approved',
      amount: Number(request.amount),
      status: 'approved',
      referenceId: requestId,
      note: 'Profit withdrawal approved; reserved USDT remains locked until treasury settlement',
    });

    await createUserNotification(db, {
      userId: request.user_id,
      title: 'Profit withdrawal approved',
      message: `Your ${Number(request.amount).toFixed(2)} USDT profit withdrawal was approved and is ready for payout settlement.`,
      type: 'withdrawal',
    });

    await createAuditLog(db, {
      adminId: req.admin.id,
      action: 'approve_profit_withdrawal',
      referenceId: requestId,
      targetUserId: request.user_id,
      note: `Approved profit withdrawal request ${requestId}; awaiting settlement`,
    });

    await db.commit();

    res.json({
      success: true,
      message: 'Profit withdrawal approved and reserved for settlement',
      data: { id: requestId, status: 'approved', amount: Number(request.amount) },
    });
  } catch (error) {
    try { await db.rollback(); } catch (_) {}
    next(error);
  } finally {
    db.release();
  }
});

router.post('/admin/profit-withdrawal-requests/:id/settle', authAdmin, async (req, res, next) => {
  const db = await pool.getConnection();
  try {
    await ensureTable();

    const requestId = Number(req.params.id);
    if (!Number.isInteger(requestId) || requestId <= 0) {
      throw createError(400, 'Invalid request ID');
    }

    const note = String(
      req.body?.note || req.body?.settlement_note || ''
    ).trim().slice(0, 2000) || 'Manual treasury payout completed';

    await db.beginTransaction();

    const [[request]] = await db.execute(
      'SELECT * FROM profit_withdrawal_requests WHERE id=? FOR UPDATE',
      [requestId]
    );

    if (!request) throw createError(404, 'Profit withdrawal request not found');
    if (request.status !== 'approved') {
      throw createError(409, `Only approved requests can be settled; current status is ${request.status}`);
    }

    const [[wallet]] = await db.execute(
      `SELECT reserved_balance
       FROM user_assets
       WHERE user_id=? AND coin='USDT'
       LIMIT 1 FOR UPDATE`,
      [request.user_id]
    );

    if (Number(wallet?.reserved_balance || 0) < Number(request.amount)) {
      throw createError(409, 'Reserved USDT for this profit withdrawal is no longer available');
    }

    const [[target]] = await db.execute(
      `SELECT id,current_profit
       FROM user_targets
       WHERE user_id=? AND status IN ('active','achieved')
       ORDER BY id DESC LIMIT 1 FOR UPDATE`,
      [request.user_id]
    );

    if (!target || Number(target.current_profit || 0) < Number(request.amount)) {
      throw createError(409, 'User profit balance is no longer sufficient for this payout');
    }

    const [targetUpdate] = await db.execute(
      `UPDATE user_targets
       SET current_profit=GREATEST(0,current_profit-?),updated_at=NOW()
       WHERE id=? AND current_profit>=?`,
      [request.amount, target.id, request.amount]
    );

    if (!targetUpdate.affectedRows) {
      throw createError(409, 'Unable to reserve the requested profit for settlement');
    }

    await consumeReservedAsset(db, {
      userId: request.user_id,
      coin: 'USDT',
      network: 'INTERNAL',
      amount: Number(request.amount),
      referenceType: 'profit_withdrawal',
      referenceId: requestId,
      note: note,
    });

    await db.execute(
      `UPDATE profit_withdrawal_requests
       SET status='settled',admin_note=?,settled_at=NOW(),updated_at=NOW()
       WHERE id=? AND status='approved'`,
      [note, requestId]
    );

    await createTransactionLog(db, {
      userId: request.user_id,
      type: 'profit_withdrawal_settled',
      amount: Number(request.amount),
      status: 'completed',
      referenceId: requestId,
      note,
    });

    await createUserNotification(db, {
      userId: request.user_id,
      title: 'Profit payout completed',
      message: `Your ${Number(request.amount).toFixed(2)} USDT profit payout has been settled.`,
      type: 'withdrawal',
    });

    await createAuditLog(db, {
      adminId: req.admin.id,
      action: 'settle_profit_withdrawal',
      referenceId: requestId,
      targetUserId: request.user_id,
      note,
    });

    await db.commit();

    res.json({
      success: true,
      message: 'Profit payout settled successfully',
      data: { id: requestId, status: 'settled', amount: Number(request.amount) },
    });
  } catch (error) {
    try { await db.rollback(); } catch (_) {}
    next(error);
  } finally {
    db.release();
  }
});

router.post('/admin/profit-withdrawal-requests/:id/reject', authAdmin, async (req, res, next) => {
  const db = await pool.getConnection();
  try {
    await ensureTable();

    const requestId = Number(req.params.id);
    if (!Number.isInteger(requestId) || requestId <= 0) {
      throw createError(400, 'Invalid request ID');
    }

    await db.beginTransaction();

    const [[request]] = await db.execute(
      'SELECT * FROM profit_withdrawal_requests WHERE id=? FOR UPDATE',
      [requestId]
    );

    if (!request) throw createError(404, 'Profit withdrawal request not found');
    if (request.status !== 'pending') {
      throw createError(409, `Request is already ${request.status}`);
    }

    const note = String(
      req.body?.note || req.body?.admin_note || ''
    ).trim().slice(0, 2000) || null;

    await releaseReservedAsset(db, {
      userId: request.user_id,
      coin: 'USDT',
      network: 'INTERNAL',
      amount: Number(request.amount),
      referenceType: 'profit_withdrawal',
      referenceId: requestId,
      note: 'Rejected profit withdrawal reservation released',
    });

    await db.execute(
      `UPDATE profit_withdrawal_requests
       SET status='rejected',admin_note=?,rejected_at=NOW(),updated_at=NOW()
       WHERE id=? AND status='pending'`,
      [note, requestId]
    );

    await createTransactionLog(db, {
      userId: request.user_id,
      type: 'profit_withdrawal_rejected',
      amount: Number(request.amount),
      status: 'rejected',
      referenceId: requestId,
      note: note || 'Profit withdrawal rejected by administrator',
    });

    await createUserNotification(db, {
      userId: request.user_id,
      title: 'Profit withdrawal rejected',
      message: note
        ? `Your profit withdrawal was rejected: ${note}`
        : 'Your profit withdrawal request was rejected by an administrator.',
      type: 'withdrawal',
    });

    await createAuditLog(db, {
      adminId: req.admin.id,
      action: 'reject_profit_withdrawal',
      referenceId: requestId,
      targetUserId: request.user_id,
      note: `Rejected profit withdrawal request ${requestId}`,
    });

    await db.commit();

    res.json({
      success: true,
      message: 'Profit withdrawal rejected',
      data: { id: requestId, status: 'rejected' },
    });
  } catch (error) {
    try { await db.rollback(); } catch (_) {}
    next(error);
  } finally {
    db.release();
  }
});

module.exports = router;
