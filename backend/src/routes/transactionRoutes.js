// backend/src/routes/transactionRoutes.js
const express = require('express');
const router = express.Router();
const pool = require('../../db');
const { authUser } = require('../middleware/auth');

// ─── GET /api/transactions ──────────────────────────────────────────
// Unified transactions endpoint - combines all transaction types
router.get('/transactions', authUser, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { type, limit = 50, offset = 0 } = req.query;

    // Get deposits
    const [deposits] = await pool.execute(`
      SELECT 
        id,
        'deposit' as type,
        amount,
        status,
        created_at as date,
        payment_method as method,
        reference as reference,
        'Deposit' as description
      FROM deposits 
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT 100
    `, [userId]);

    // Get withdrawals
    const [withdrawals] = await pool.execute(`
      SELECT 
        id,
        'withdrawal' as type,
        amount,
        status,
        created_at as date,
        withdrawal_method as method,
        reference as reference,
        'Withdrawal' as description
      FROM withdrawals 
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT 100
    `, [userId]);

    // Get trades
    const [trades] = await pool.execute(`
      SELECT 
        id,
        'trade' as type,
        amount,
        status,
        created_at as date,
        trade_type as method,
        CONCAT('Trade ', trade_type) as description
      FROM trades 
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT 100
    `, [userId]);

    // Get transfers (sent and received)
    const [transfers] = await pool.execute(`
      SELECT 
        ut.id,
        'transfer' as type,
        ut.amount,
        ut.status,
        ut.created_at as date,
        CASE 
          WHEN ut.sender_id = ? THEN CONCAT('Sent to ', r.uid)
          ELSE CONCAT('Received from ', s.uid)
        END as method,
        ut.note as reference,
        CONCAT('Transfer ', 
          CASE 
            WHEN ut.sender_id = ? THEN 'sent'
            ELSE 'received'
          END
        ) as description
      FROM user_transfers ut
      LEFT JOIN users s ON s.id = ut.sender_id
      LEFT JOIN users r ON r.id = ut.receiver_id
      WHERE ut.sender_id = ? OR ut.receiver_id = ?
      ORDER BY ut.created_at DESC
      LIMIT 100
    `, [userId, userId, userId, userId]);

    // Get funds transactions
    const [funds] = await pool.execute(`
      SELECT 
        id,
        'fund' as type,
        amount,
        status,
        created_at as date,
        plan_name as method,
        reference,
        CONCAT('Fund Plan: ', plan_name) as description
      FROM user_funds
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT 100
    `, [userId]);

    // Combine all transactions
    let allTransactions = [
      ...deposits.map(t => ({ 
        ...t, 
        date: t.date || t.created_at,
        amount: Number(t.amount)
      })),
      ...withdrawals.map(t => ({ 
        ...t, 
        date: t.date || t.created_at,
        amount: Number(t.amount)
      })),
      ...trades.map(t => ({ 
        ...t, 
        date: t.date || t.created_at,
        amount: Number(t.amount)
      })),
      ...transfers.map(t => ({ 
        ...t, 
        date: t.date || t.created_at,
        amount: Number(t.amount)
      })),
      ...funds.map(t => ({ 
        ...t, 
        date: t.date || t.created_at,
        amount: Number(t.amount)
      }))
    ];

    // Filter by type if specified
    if (type && type !== 'all') {
      allTransactions = allTransactions.filter(t => t.type === type);
    }

    // Sort by date (newest first)
    allTransactions.sort((a, b) => new Date(b.date) - new Date(a.date));

    // Apply pagination
    const total = allTransactions.length;
    const paginated = allTransactions.slice(Number(offset), Number(offset) + Number(limit));

    // Calculate counts by type
    const counts = {
      total: total,
      deposit: deposits.length,
      withdrawal: withdrawals.length,
      trade: trades.length,
      transfer: transfers.length,
      fund: funds.length
    };

    res.json({
      success: true,
      data: {
        transactions: paginated,
        pagination: {
          total,
          limit: Number(limit),
          offset: Number(offset)
        },
        counts
      }
    });

  } catch (error) {
    console.error('Error fetching transactions:', error);
    next(error);
  }
});

// ─── GET /api/transactions/summary ──────────────────────────────────
router.get('/transactions/summary', authUser, async (req, res, next) => {
  try {
    const userId = req.user.id;

    // Get total deposits
    const [depositTotal] = await pool.execute(
      `SELECT SUM(amount) as total FROM deposits WHERE user_id = ? AND status = 'completed'`,
      [userId]
    );

    // Get total withdrawals
    const [withdrawalTotal] = await pool.execute(
      `SELECT SUM(amount) as total FROM withdrawals WHERE user_id = ? AND status = 'completed'`,
      [userId]
    );

    // Get total trades volume
    const [tradeTotal] = await pool.execute(
      `SELECT SUM(amount) as total FROM trades WHERE user_id = ? AND status = 'completed'`,
      [userId]
    );

    // Get pending transactions count
    const [pendingDeposits] = await pool.execute(
      `SELECT COUNT(*) as count FROM deposits WHERE user_id = ? AND status = 'pending'`,
      [userId]
    );
    const [pendingWithdrawals] = await pool.execute(
      `SELECT COUNT(*) as count FROM withdrawals WHERE user_id = ? AND status = 'pending'`,
      [userId]
    );

    // Get recent transactions (last 30 days)
    const [recent] = await pool.execute(`
      (SELECT 'deposit' as type, amount, status, created_at as date FROM deposits WHERE user_id = ? AND created_at > DATE_SUB(NOW(), INTERVAL 30 DAY))
      UNION ALL
      (SELECT 'withdrawal' as type, amount, status, created_at as date FROM withdrawals WHERE user_id = ? AND created_at > DATE_SUB(NOW(), INTERVAL 30 DAY))
      UNION ALL
      (SELECT 'trade' as type, amount, status, created_at as date FROM trades WHERE user_id = ? AND created_at > DATE_SUB(NOW(), INTERVAL 30 DAY))
      UNION ALL
      (SELECT 'transfer' as type, amount, status, created_at as date FROM user_transfers WHERE sender_id = ? OR receiver_id = ? AND created_at > DATE_SUB(NOW(), INTERVAL 30 DAY))
      ORDER BY date DESC
      LIMIT 10
    `, [userId, userId, userId, userId, userId]);

    res.json({
      success: true,
      data: {
        totals: {
          deposits: Number(depositTotal[0]?.total || 0),
          withdrawals: Number(withdrawalTotal[0]?.total || 0),
          trades: Number(tradeTotal[0]?.total || 0)
        },
        pending: {
          deposits: pendingDeposits[0]?.count || 0,
          withdrawals: pendingWithdrawals[0]?.count || 0
        },
        recent: recent || []
      }
    });

  } catch (error) {
    console.error('Error fetching transaction summary:', error);
    next(error);
  }
});

module.exports = router;
