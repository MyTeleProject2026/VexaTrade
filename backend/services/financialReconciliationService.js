const pool = require('../db');

async function reconcileFinancialState(connection = pool) {
  const [assetMismatches] = await connection.execute(`
    SELECT user_id, coin, balance, available_balance, reserved_balance, pending_balance,
      (available_balance + reserved_balance + pending_balance) AS calculated_balance
    FROM user_assets
    WHERE ABS(balance - (available_balance + reserved_balance + pending_balance)) > 0.000000000000000001
      OR available_balance < 0 OR reserved_balance < 0 OR pending_balance < 0
    ORDER BY user_id, coin
  `);

  const [fundMismatches] = await connection.execute(`
    SELECT uf.id, uf.user_id, uf.status, uf.locked_principal,
      COALESCE((SELECT SUM(CASE
        WHEN entry_type='fund_principal_lock' THEN amount
        WHEN entry_type='fund_principal_return' AND reference_type='user_fund' THEN -amount
        ELSE 0 END)
        FROM asset_ledger_entries le
        WHERE le.user_id=uf.user_id AND le.reference_type='user_fund' AND le.reference_id=uf.id),0) AS ledger_principal
    FROM user_funds uf
    WHERE (uf.status='active' AND ABS(uf.locked_principal - COALESCE((SELECT SUM(CASE
        WHEN entry_type='fund_principal_lock' THEN amount
        WHEN entry_type='fund_principal_return' AND reference_type='user_fund' THEN -amount
        ELSE 0 END)
        FROM asset_ledger_entries le
        WHERE le.user_id=uf.user_id AND le.reference_type='user_fund' AND le.reference_id=uf.id),0)) > 0.000000000000000001)
       OR (uf.status='completed' AND COALESCE((SELECT SUM(CASE
        WHEN entry_type='fund_principal_lock' THEN amount
        WHEN entry_type='fund_principal_return' AND reference_type='user_fund' THEN -amount
        ELSE 0 END)
        FROM asset_ledger_entries le
        WHERE le.user_id=uf.user_id AND le.reference_type='user_fund' AND le.reference_id=uf.id),0) <> 0)
    ORDER BY uf.id
  `);

  const [duplicateKeys] = await connection.execute(`
    SELECT 'deposits' table_name,user_id,idempotency_key,COUNT(*) copies FROM deposits WHERE idempotency_key IS NOT NULL GROUP BY user_id,idempotency_key HAVING COUNT(*)>1
    UNION ALL SELECT 'withdrawals',user_id,idempotency_key,COUNT(*) FROM withdrawals WHERE idempotency_key IS NOT NULL GROUP BY user_id,idempotency_key HAVING COUNT(*)>1
    UNION ALL SELECT 'conversions',user_id,idempotency_key,COUNT(*) FROM convert_transactions WHERE idempotency_key IS NOT NULL GROUP BY user_id,idempotency_key HAVING COUNT(*)>1
    UNION ALL SELECT 'transfers',sender_id,idempotency_key,COUNT(*) FROM user_transfers WHERE idempotency_key IS NOT NULL GROUP BY sender_id,idempotency_key HAVING COUNT(*)>1
  `);

  return {healthy:!assetMismatches.length&&!fundMismatches.length&&!duplicateKeys.length,checkedAt:new Date().toISOString(),assetMismatches,fundMismatches,duplicateKeys};
}
module.exports={reconcileFinancialState};
