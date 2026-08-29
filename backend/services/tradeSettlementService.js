// backend/services/tradeSettlementService.js
const pool = require('../db');
const { getBinancePrice } = require('./tradeService');
const { movePendingToAvailable, creditAssetBalance, recordLedger } = require('./assetLedgerService');

async function settleExpiredTrades(limit = 100) {
  const connection = await pool.getConnection();
  let settled = 0;
  try {
    const [trades] = await connection.execute(
      `SELECT id,user_id,pair,direction,amount,entry_price,payout_percent
       FROM trades WHERE status='open' AND end_time <= NOW()
       ORDER BY end_time ASC LIMIT ?`, [Number(limit)]
    );
    for (const trade of trades) {
      await connection.beginTransaction();
      try {
        const [locked] = await connection.execute('SELECT * FROM trades WHERE id=? FOR UPDATE',[trade.id]);
        const current = locked[0];
        if (!current || current.status !== 'open' || new Date(current.end_time).getTime() > Date.now()) { await connection.rollback(); continue; }

        let exitPrice;
        try { exitPrice = Number(await getBinancePrice(current.pair)); } catch (_) { throw new Error('Market price unavailable; settlement deferred'); }
        if (!Number.isFinite(exitPrice) || exitPrice <= 0 || !Number(current.entry_price)) { throw new Error('Invalid market price for settlement'); }

        const won = current.direction === 'bullish' ? exitPrice > Number(current.entry_price) : exitPrice < Number(current.entry_price);
        const tied = exitPrice === Number(current.entry_price);
        const stake = Number(current.amount);
        const profit = won ? Number((stake * Number(current.payout_percent || 0) / 100).toFixed(18)) : 0;

        if (won || tied) {
          await movePendingToAvailable(connection,{userId:current.user_id,coin:'USDT',network:'INTERNAL',amount:stake,entryType:'trade_stake_return',referenceType:'trade',referenceId:current.id,note:tied?'Trade tie: stake returned':'Winning trade: stake returned'});
          if (won && profit > 0) await creditAssetBalance(connection,{userId:current.user_id,coin:'USDT',network:'INTERNAL',amount:profit,referenceType:'trade',referenceId:current.id,note:'Market-settled trade profit'});
        } else {
          const [u] = await connection.execute(
            `UPDATE user_assets SET pending_balance=pending_balance-?, balance=available_balance+reserved_balance+pending_balance-?
             WHERE user_id=? AND coin='USDT' AND pending_balance>=?`,
            [stake, stake, current.user_id, stake]
          );
          if (u.affectedRows !== 1) throw new Error('Pending trade stake unavailable');
          await connection.execute('UPDATE user_assets SET balance=available_balance+reserved_balance+pending_balance WHERE user_id=? AND coin=?',[current.user_id,'USDT']);
          await recordLedger(connection,{userId:current.user_id,coin:'USDT',network:'INTERNAL',bucket:'settled',entryType:'trade_loss_settlement',amount:stake,referenceType:'trade',referenceId:current.id,note:'Market-settled losing trade'});
        }

        const result = tied ? 'tie' : (won ? 'win' : 'loss');
        await connection.execute(`UPDATE trades SET status='completed',result=?,exit_price=?,settled_at=NOW() WHERE id=?`,[result,exitPrice,current.id]);
        await connection.commit();
        settled++;
      } catch (error) {
        await connection.rollback();
        if (!/settlement deferred/.test(error.message)) console.error('Trade settlement failed', trade.id, error.message);
      }
    }
  } finally { connection.release(); }
  return settled;
}

module.exports = { settleExpiredTrades };
