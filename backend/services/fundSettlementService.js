const pool = require('../db');
const { toNumber, createTransactionLog, createUserNotification } = require('../src/utils/helpers');
const {
  creditAssetBalance,
  increasePendingAsset,
  movePendingToAvailable,
} = require('./assetLedgerService');

/**
 * Settles at most one profit day per active fund per execution.
 * The USDT fund principal lives in the pending ledger bucket. When profit is
 * compounded, the compounded portion is explicitly added to pending before
 * the final principal release so the ledger can never release more than it
 * actually holds.
 */
async function settleDailyFunds() {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [activeFunds] = await connection.execute(`
      SELECT
        uf.id, uf.user_id, uf.plan_id, uf.amount, uf.locked_principal,
        uf.selected_daily_profit_percent, uf.total_days, uf.current_day,
        uf.earned_profit, uf.status, uf.started_at, uf.ends_at,
        uf.last_profit_at, uf.completed_at, uf.created_at,
        uf.is_compounded, uf.original_principal, uf.compound_percentage,
        fp.name AS plan_name, fp.compound_percentage AS plan_compound_percentage
      FROM user_funds uf
      INNER JOIN fund_plans fp ON fp.id = uf.plan_id
      WHERE uf.status = 'active'
      ORDER BY uf.id ASC
    `);

    const now = new Date();
    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);

    let creditedCount = 0;
    let completedCount = 0;

    for (const fund of activeFunds) {
      const totalDays = Number(fund.total_days || 0);
      let currentDay = Number(fund.current_day || 0);
      let currentPrincipal = Number(fund.locked_principal || fund.amount || 0);
      let originalPrincipal = Number(fund.original_principal || fund.amount || 0);

      let compoundPercentage = Number(fund.compound_percentage);
      if (!Number.isFinite(compoundPercentage) || compoundPercentage === 0) {
        compoundPercentage = Number(fund.plan_compound_percentage);
      }
      if (!Number.isFinite(compoundPercentage) || compoundPercentage === 0) {
        compoundPercentage = 100;
      }
      compoundPercentage = Math.min(100, Math.max(0, compoundPercentage));

      if (currentDay === 0 && !fund.is_compounded) {
        originalPrincipal = currentPrincipal;
        await connection.execute(
          `UPDATE user_funds
           SET original_principal = ?, is_compounded = 1, compound_percentage = ?
           WHERE id = ?`,
          [originalPrincipal, compoundPercentage, fund.id]
        );
      }

      if (totalDays <= 0) continue;

      const [alreadyLogged] = await connection.execute(
        `SELECT id FROM fund_profit_logs
         WHERE user_fund_id = ? AND day_number = ?
         LIMIT 1 FOR UPDATE`,
        [fund.id, currentDay + 1]
      );
      if (alreadyLogged.length) continue;

      const lastCreditDate = fund.last_profit_at
        ? new Date(fund.last_profit_at)
        : new Date(fund.started_at);
      lastCreditDate.setHours(0, 0, 0, 0);

      const startDate = new Date(fund.started_at);
      startDate.setHours(0, 0, 0, 0);
      if (todayDate <= startDate) continue;
      if (lastCreditDate >= todayDate) continue;
      if (currentDay >= totalDays) continue;

      const nextDay = currentDay + 1;
      if (nextDay > totalDays) continue;

      const dailyRate = toNumber(fund.selected_daily_profit_percent);
      if (!Number.isFinite(dailyRate) || dailyRate < 0) continue;

      const dailyProfit = Number(((currentPrincipal * dailyRate) / 100).toFixed(10));
      const compoundAmount = Number((dailyProfit * compoundPercentage / 100).toFixed(10));
      const profitToWallet = Number((dailyProfit - compoundAmount).toFixed(10));
      const nextEarnedProfit = Number((toNumber(fund.earned_profit) + dailyProfit).toFixed(10));
      const newPrincipal = Number((currentPrincipal + compoundAmount).toFixed(10));

      // Persist the profit-day state and ledger movements in the same DB transaction.
      // Compounded profit becomes pending principal; wallet profit becomes available USDT.
      if (compoundAmount > 0) {
        await increasePendingAsset(connection, {
          userId: fund.user_id,
          coin: 'USDT',
          network: 'INTERNAL',
          amount: compoundAmount,
          entryType: 'fund_profit_compound',
          referenceType: 'user_fund',
          referenceId: fund.id,
          note: `Compounded ${compoundAmount} USDT into ${fund.plan_name}`,
        });
      }

      // Synchronize the user's profit target from this same settlement event.
      // This records earned profit consistently even when part of the profit is compounded;
      // spendable withdrawal remains capped by the authoritative USDT available balance.
      if (dailyProfit > 0) {
        await connection.execute(
          `UPDATE user_targets
           SET current_profit = LEAST(target_amount, current_profit + ?),
               status = CASE
                 WHEN current_profit + ? >= target_amount THEN 'achieved'
                 ELSE 'active'
               END,
               updated_at = NOW()
           WHERE user_id = ? AND status = 'active'`,
          [dailyProfit, dailyProfit, fund.user_id]
        );
      }

      if (profitToWallet > 0) {
        await creditAssetBalance(connection, {
          userId: fund.user_id,
          coin: 'USDT',
          network: 'INTERNAL',
          amount: profitToWallet,
          referenceType: 'user_fund_profit',
          referenceId: fund.id,
          note: `Daily profit from ${fund.plan_name}`,
        });
        await createTransactionLog(connection, {
          userId: fund.user_id,
          type: 'funds_profit',
          amount: profitToWallet,
          status: 'completed',
          referenceId: fund.id,
          note: `Daily profit of ${profitToWallet} USDT from ${fund.plan_name}`,
        });
      }

      await connection.execute(
        `UPDATE user_funds
         SET current_day = ?, earned_profit = ?, locked_principal = ?,
             last_profit_at = ?, updated_at = NOW()
         WHERE id = ?`,
        [nextDay, nextEarnedProfit, newPrincipal, now, fund.id]
      );

      await connection.execute(
        `INSERT INTO fund_profit_logs
         (user_fund_id, user_id, day_number, profit_percent, profit_amount,
          compound_percentage, compounded_amount, wallet_amount, credited_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [fund.id, fund.user_id, nextDay, dailyRate, dailyProfit, compoundPercentage, compoundAmount, profitToWallet, now]
      );

      creditedCount += 1;

      if (nextDay >= totalDays) {
        const totalReturn = newPrincipal;
        const totalProfitEarned = Number((totalReturn - originalPrincipal).toFixed(10));

        // pending now contains the original principal plus every compounded amount.
        await movePendingToAvailable(connection, {
          userId: fund.user_id,
          coin: 'USDT',
          network: 'INTERNAL',
          amount: totalReturn,
          entryType: 'fund_principal_return',
          referenceType: 'user_fund',
          referenceId: fund.id,
          note: `Principal return from ${fund.plan_name}`,
        });

        await connection.execute(
          `UPDATE user_funds
           SET status = 'completed', completed_at = ?, updated_at = NOW()
           WHERE id = ?`,
          [now, fund.id]
        );

        await createTransactionLog(connection, {
          userId: fund.user_id,
          type: 'funds_return',
          amount: totalReturn,
          status: 'completed',
          referenceId: fund.id,
          note: `Fund principal return from ${fund.plan_name}`,
        });

        completedCount += 1;

        await createUserNotification(connection, {
          userId: fund.user_id,
          title: 'Fund Completed',
          message: `${fund.plan_name} completed. Total return: ${totalReturn.toFixed(2)} USDT (Profit: ${totalProfitEarned.toFixed(2)} USDT)`,
          type: 'funds',
        });
      }
    }

    await connection.commit();
    return { success: true, creditedCount, completedCount, processedAt: now };
  } catch (error) {
    await connection.rollback();
    console.error('settleDailyFunds error:', error);
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = { settleDailyFunds };
