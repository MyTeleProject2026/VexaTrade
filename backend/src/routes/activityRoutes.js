// backend/src/routes/activityRoutes.js
const express = require('express');
const router = express.Router();
const pool = require('../../db');
const { authUser } = require('../middleware/auth');
const { createError } = require('../utils/helpers');

let targetTableReady = false;
let targetTablePromise = null;

async function ensureTargetTable() {
  if (targetTableReady) return;
  if (!targetTablePromise) {
    targetTablePromise = pool.execute(`
      CREATE TABLE IF NOT EXISTS user_targets (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        user_id BIGINT UNSIGNED NOT NULL,
        target_amount DECIMAL(36,18) NOT NULL DEFAULT 0,
        current_profit DECIMAL(36,18) NOT NULL DEFAULT 0,
        status VARCHAR(32) NOT NULL DEFAULT 'active',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        INDEX idx_user_targets_user_status (user_id, status),
        INDEX idx_user_targets_created (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `).then(() => {
      targetTableReady = true;
    }).finally(() => {
      targetTablePromise = null;
    });
  }
  await targetTablePromise;
}

// GET /api/user/target
router.get('/user/target', authUser, async (req, res, next) => {
  try {
    await ensureTargetTable();
    const [rows] = await pool.execute(
      `SELECT id,user_id,target_amount,current_profit,status,created_at,updated_at
       FROM user_targets
       WHERE user_id=? AND status='active'
       ORDER BY id DESC LIMIT 1`,
      [req.user.id]
    );
    res.json({
      success: true,
      data: {
        hasTarget: rows.length > 0,
        target: rows[0] || null,
      },
    });
  } catch (e) {
    next(e);
  }
});

// POST /api/user/target/set
router.post('/user/target/set', authUser, async (req, res, next) => {
  try {
    const targetAmount = Number(req.body?.targetAmount ?? req.body?.target_amount ?? 0);
    if (!Number.isFinite(targetAmount) || targetAmount < 100) {
      throw createError(400, 'Minimum target amount is 100 USDT');
    }

    await ensureTargetTable();
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      await connection.execute(
        `UPDATE user_targets SET status='completed',updated_at=NOW()
         WHERE user_id=? AND status='active'`,
        [req.user.id]
      );
      const [result] = await connection.execute(
        `INSERT INTO user_targets (user_id,target_amount,current_profit,status,created_at,updated_at)
         VALUES (?,?,0,'active',NOW(),NOW())`,
        [req.user.id, targetAmount]
      );
      await connection.commit();
      res.json({
        success: true,
        message: 'Target set successfully',
        data: {
          id: result.insertId,
          targetAmount,
          currentProfit: 0,
          status: 'active',
        },
      });
    } catch (e) {
      await connection.rollback();
      throw e;
    } finally {
      connection.release();
    }
  } catch (e) {
    next(e);
  }
});

// POST /api/user/target/update-profit
router.post('/user/target/update-profit', authUser, async (req, res, next) => {
  try {
    const profitAmount = Number(req.body?.profitAmount ?? req.body?.profit_amount ?? 0);
    if (!Number.isFinite(profitAmount)) throw createError(400, 'Valid profit amount required');
    await ensureTargetTable();

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [rows] = await connection.execute(
        `SELECT id,target_amount,current_profit,status
         FROM user_targets
         WHERE user_id=? AND status='active'
         ORDER BY id DESC LIMIT 1 FOR UPDATE`,
        [req.user.id]
      );
      if (!rows.length) {
        await connection.commit();
        return res.json({ success: true, data: { hasTarget: false, target: null } });
      }

      const target = rows[0];
      const currentProfit = Number(target.current_profit || 0) + profitAmount;
      const targetAmount = Number(target.target_amount || 0);
      const status = currentProfit >= targetAmount ? 'achieved' : 'active';
      await connection.execute(
        `UPDATE user_targets SET current_profit=?,status=?,updated_at=NOW() WHERE id=?`,
        [currentProfit, status, target.id]
      );
      await connection.commit();
      res.json({
        success: true,
        data: {
          hasTarget: true,
          target: { ...target, current_profit: currentProfit, status },
        },
      });
    } catch (e) {
      await connection.rollback();
      throw e;
    } finally {
      connection.release();
    }
  } catch (e) {
    next(e);
  }
});

// GET /api/transactions
router.get('/transactions', authUser, async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      `SELECT id,type,amount,status,reference_id,note,created_at,updated_at
       FROM transactions
       WHERE user_id=?
       ORDER BY id DESC LIMIT 200`,
      [req.user.id]
    );
    res.json({ success: true, data: rows });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
