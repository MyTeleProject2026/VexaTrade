const { createError } = require('../src/utils/helpers');

const ASSET_PRECISION = 18;
const normalizeCoin = value => String(value || '').trim().toUpperCase();
const normalizeNetwork = value => String(value || '').trim().toUpperCase() || 'INTERNAL';

async function ensureAssetRow(connection, userId, coin) {
  const [rows] = await connection.execute('SELECT * FROM user_assets WHERE user_id = ? AND coin = ? FOR UPDATE',[userId,coin]);
  if (rows.length) return rows[0];
  await connection.execute('INSERT INTO user_assets (user_id, coin, balance, avg_price, available_balance, reserved_balance, pending_balance) VALUES (?, ?, 0, 0, 0, 0, 0)',[userId,coin]);
  const [created] = await connection.execute('SELECT * FROM user_assets WHERE user_id = ? AND coin = ? FOR UPDATE',[userId,coin]);
  return created[0];
}
async function syncTotal(connection,userId,coin){ await connection.execute('UPDATE user_assets SET balance = available_balance + reserved_balance + pending_balance WHERE user_id=? AND coin=?',[userId,coin]); }
async function recordLedger(connection,{userId,coin,network,bucket,entryType,amount,referenceType,referenceId,note}){
  const normalizedCoin=normalizeCoin(coin), normalizedNetwork=normalizeNetwork(network), value=Number(amount);
  await connection.execute(`INSERT INTO asset_ledger_entries (user_id,coin,network,bucket,entry_type,amount,reference_type,reference_id,note) VALUES (?,?,?,?,?,?,?,?,?)`,[userId,normalizedCoin,normalizedNetwork,bucket,entryType,value,referenceType||null,referenceId||null,note||null]);
  try { await connection.execute(`INSERT INTO financial_audit_events (user_id,action,coin,network,amount,reference_type,reference_id,metadata) VALUES (?,?,?,?,?,?,?,JSON_OBJECT('bucket',?, 'entry_type',?, 'note',?))`,[userId,entryType,normalizedCoin,normalizedNetwork,value,referenceType||null,referenceId||null,bucket,entryType,note||null]); } catch (_) { /* migration may not yet be applied; ledger remains authoritative */ }
}
async function creditAssetBalance(connection,{userId,coin,network,amount,referenceType,referenceId,note}){
  coin=normalizeCoin(coin);network=normalizeNetwork(network);amount=Number(amount);if(!coin||!Number.isFinite(amount)||amount<=0)throw createError(400,'Invalid asset credit');
  await ensureAssetRow(connection,userId,coin);const [u]=await connection.execute('UPDATE user_assets SET available_balance=available_balance+? WHERE user_id=? AND coin=?',[amount,userId,coin]);if(u.affectedRows!==1)throw createError(409,`Unable to credit ${coin} balance`);await syncTotal(connection,userId,coin);await recordLedger(connection,{userId,coin,network,bucket:'available',entryType:'ecosystem_credit',amount,referenceType,referenceId,note});
}
async function debitAvailableAsset(connection,{userId,coin,network,amount,referenceType,referenceId,note}){
  coin=normalizeCoin(coin);network=normalizeNetwork(network);amount=Number(amount);if(!coin||!Number.isFinite(amount)||amount<=0)throw createError(400,'Invalid asset debit');
  await ensureAssetRow(connection,userId,coin);const [u]=await connection.execute('UPDATE user_assets SET available_balance=available_balance-? WHERE user_id=? AND coin=? AND available_balance>=?',[amount,userId,coin,amount]);if(u.affectedRows!==1)throw createError(400,`Insufficient ${coin} available balance`);await syncTotal(connection,userId,coin);await recordLedger(connection,{userId,coin,network,bucket:'available',entryType:'ecosystem_debit',amount,referenceType,referenceId,note});
}
async function moveAvailableToPending(connection,{userId,coin,network,amount,entryType='asset_pending',referenceType,referenceId,note}){
  coin=normalizeCoin(coin);network=normalizeNetwork(network);amount=Number(amount);if(!coin||!Number.isFinite(amount)||amount<=0)throw createError(400,'Invalid pending asset amount');
  await ensureAssetRow(connection,userId,coin);const [u]=await connection.execute('UPDATE user_assets SET available_balance=available_balance-?,pending_balance=pending_balance+? WHERE user_id=? AND coin=? AND available_balance>=?',[amount,amount,userId,coin,amount]);if(u.affectedRows!==1)throw createError(400,`Insufficient ${coin} available balance`);await syncTotal(connection,userId,coin);await recordLedger(connection,{userId,coin,network,bucket:'pending',entryType,amount,referenceType,referenceId,note});
}
async function increasePendingAsset(connection,{userId,coin,network,amount,entryType='pending_increase',referenceType,referenceId,note}){
  coin=normalizeCoin(coin);network=normalizeNetwork(network);amount=Number(amount);if(!coin||!Number.isFinite(amount)||amount<=0)throw createError(400,'Invalid pending asset increase');
  await ensureAssetRow(connection,userId,coin);const [u]=await connection.execute('UPDATE user_assets SET pending_balance=pending_balance+? WHERE user_id=? AND coin=?',[amount,userId,coin]);if(u.affectedRows!==1)throw createError(409,`Unable to increase pending ${coin} balance`);await syncTotal(connection,userId,coin);await recordLedger(connection,{userId,coin,network,bucket:'pending',entryType,amount,referenceType,referenceId,note});
}
async function movePendingToAvailable(connection,{userId,coin,network,amount,entryType='asset_pending_release',referenceType,referenceId,note}){
  coin=normalizeCoin(coin);network=normalizeNetwork(network);amount=Number(amount);if(!coin||!Number.isFinite(amount)||amount<=0)throw createError(400,'Invalid pending release amount');
  await ensureAssetRow(connection,userId,coin);const [u]=await connection.execute('UPDATE user_assets SET pending_balance=pending_balance-?,available_balance=available_balance+? WHERE user_id=? AND coin=? AND pending_balance>=?',[amount,amount,userId,coin,amount]);if(u.affectedRows!==1)throw createError(409,`Unable to release pending ${coin} balance`);await syncTotal(connection,userId,coin);await recordLedger(connection,{userId,coin,network,bucket:'available',entryType,amount,referenceType,referenceId,note});
}
async function reserveAssetBalance(connection,{userId,coin,network,amount,referenceType,referenceId,note}){
  coin=normalizeCoin(coin);network=normalizeNetwork(network);amount=Number(amount);if(!coin||!Number.isFinite(amount)||amount<=0)throw createError(400,'Invalid asset reservation');
  await ensureAssetRow(connection,userId,coin);const [u]=await connection.execute('UPDATE user_assets SET available_balance=available_balance-?,reserved_balance=reserved_balance+? WHERE user_id=? AND coin=? AND available_balance>=?',[amount,amount,userId,coin,amount]);if(u.affectedRows!==1)throw createError(400,`Insufficient ${coin} available balance`);await syncTotal(connection,userId,coin);await recordLedger(connection,{userId,coin,network,bucket:'reserved',entryType:'withdrawal_reserve',amount,referenceType,referenceId,note});
}
async function releaseReservedAsset(connection,{userId,coin,network,amount,referenceType,referenceId,note}){
  coin=normalizeCoin(coin);network=normalizeNetwork(network);amount=Number(amount);if(!coin||!Number.isFinite(amount)||amount<=0)throw createError(400,'Invalid asset release');
  await ensureAssetRow(connection,userId,coin);const [u]=await connection.execute('UPDATE user_assets SET reserved_balance=reserved_balance-?,available_balance=available_balance+? WHERE user_id=? AND coin=? AND reserved_balance>=?',[amount,amount,userId,coin,amount]);if(u.affectedRows!==1)throw createError(409,`Unable to release reserved ${coin} balance`);await syncTotal(connection,userId,coin);await recordLedger(connection,{userId,coin,network,bucket:'available',entryType:'withdrawal_release',amount,referenceType,referenceId,note});
}
async function consumeReservedAsset(connection,{userId,coin,network,amount,referenceType,referenceId,note}){
  coin=normalizeCoin(coin);network=normalizeNetwork(network);amount=Number(amount);if(!coin||!Number.isFinite(amount)||amount<=0)throw createError(400,'Invalid reserved asset settlement');
  await ensureAssetRow(connection,userId,coin);const [u]=await connection.execute('UPDATE user_assets SET reserved_balance=reserved_balance-? WHERE user_id=? AND coin=? AND reserved_balance>=?',[amount,userId,coin,amount]);if(u.affectedRows!==1)throw createError(409,'Unable to settle reserved asset balance');await syncTotal(connection,userId,coin);await recordLedger(connection,{userId,coin,network,bucket:'reserved',entryType:'withdrawal_settlement',amount,referenceType,referenceId,note});
}
async function consumePendingAsset(connection,{userId,coin,network,amount,referenceType,referenceId,note}){
  coin=normalizeCoin(coin);network=normalizeNetwork(network);amount=Number(amount);if(!coin||!Number.isFinite(amount)||amount<=0)throw createError(400,'Invalid pending asset settlement');
  await ensureAssetRow(connection,userId,coin);const [u]=await connection.execute('UPDATE user_assets SET pending_balance=pending_balance-? WHERE user_id=? AND coin=? AND pending_balance>=?',[amount,userId,coin,amount]);if(u.affectedRows!==1)throw createError(409,'Unable to settle pending asset balance');await syncTotal(connection,userId,coin);await recordLedger(connection,{userId,coin,network,bucket:'pending',entryType:'asset_consumed',amount,referenceType,referenceId,note});
}
module.exports={ensureAssetRow,recordLedger,creditAssetBalance,debitAvailableAsset,moveAvailableToPending,increasePendingAsset,movePendingToAvailable,reserveAssetBalance,releaseReservedAsset,consumeReservedAsset,consumePendingAsset,normalizeCoin,normalizeNetwork,ASSET_PRECISION};
