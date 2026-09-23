// depositVerificationService.js
// Manual deposit verification with atomic asset-ledger settlement.
// The multi-asset ledger is authoritative; users.balance is never mutated here.

require('dotenv').config();
const pool = require('./db');
const { createError, createTransactionLog, createUserNotification, createAuditLog } = require('./src/utils/helpers');
const { creditAssetBalance } = require('./services/assetLedgerService');

const DEFAULT_TOLERANCE_PERCENT = 10;
const DEFAULT_MIN_DEPOSIT = 0.01;

function extractPrefixSuffix(address) {
  if (!address) return { prefix: '', suffix: '' };
  const clean = String(address).trim();
  return { prefix: clean.substring(0, Math.min(4, clean.length)), suffix: clean.substring(Math.max(0, clean.length - 4)) };
}

async function syncVerificationSettingsFromWallets() {
  console.log('[Sync] Updating verification settings from deposit wallets...');
  try {
    const [wallets] = await pool.execute(`SELECT network, address FROM deposit_wallets WHERE status = 'active' ORDER BY network ASC`);
    const networkAddresses = {};
    for (const wallet of wallets) {
      const network = String(wallet.network || 'ERC20').trim().toUpperCase();
      if (!networkAddresses[network]) networkAddresses[network] = [];
      if (wallet.address) networkAddresses[network].push(wallet.address);
    }
    for (const [network, addresses] of Object.entries(networkAddresses)) {
      if (!addresses.length) continue;
      const { prefix, suffix } = extractPrefixSuffix(addresses[0]);
      if (!prefix || !suffix) continue;
      await pool.execute(`INSERT INTO network_verification_settings
        (network, explorer_api_url, address_prefix, address_suffix, token_type, is_active, updated_at)
        VALUES (?, 'https://api.etherscan.io/api', ?, ?, 'token', 1, NOW())
        ON DUPLICATE KEY UPDATE address_prefix=VALUES(address_prefix), address_suffix=VALUES(address_suffix), is_active=1, updated_at=NOW()`,
        [network, prefix, suffix]);
    }
    const activeNetworks = Object.keys(networkAddresses);
    if (activeNetworks.length) {
      await pool.execute(`UPDATE network_verification_settings SET is_active=0 WHERE network NOT IN (${activeNetworks.map(() => '?').join(',')})`, activeNetworks);
    } else {
      await pool.execute(`UPDATE network_verification_settings SET is_active=0`);
    }
    console.log('[Sync] Verification settings synchronized successfully.');
  } catch (error) {
    console.error('[Sync] Error:', error.message);
  }
}

async function getNetworkSettings(network) {
  try {
    const [rows] = await pool.execute(`SELECT * FROM network_verification_settings WHERE network=? AND is_active=1 LIMIT 1`, [String(network || '').trim().toUpperCase()]);
    return rows[0] || null;
  } catch (_) { return null; }
}

async function updateNetworkSetting(id, updates) {
  const allowed = new Set(['network','explorer_api_url','api_key','address_prefix','address_suffix','token_type','contract_address','tolerance_percent','minimum_deposit','is_active']);
  const fields=[]; const values=[];
  for (const [key,val] of Object.entries(updates || {})) {
    if (!allowed.has(key)) continue;
    fields.push(`${key}=?`); values.push(val);
  }
  if (!fields.length) return null;
  values.push(Number(id));
  await pool.execute(`UPDATE network_verification_settings SET ${fields.join(', ')}, updated_at=NOW() WHERE id=?`, values);
  const [rows] = await pool.execute(`SELECT * FROM network_verification_settings WHERE id=?`, [Number(id)]);
  return rows[0] || null;
}

async function getAllNetworkSettings() {
  const [rows] = await pool.execute(`SELECT * FROM network_verification_settings ORDER BY network ASC`);
  return rows;
}

async function verifyDepositManually(deposit) {
  const depositId=Number(deposit?.id);
  const coin=String(deposit?.coin || 'USDT').trim().toUpperCase();
  const network=String(deposit?.network || 'INTERNAL').trim().toUpperCase();
  const amount=Number(deposit?.amount);
  const proof=deposit?.proof;
  const txid=String(deposit?.txid || '').trim();

  if (!proof || ['null','undefined'].includes(String(proof).toLowerCase())) return {success:false,reason:'Transaction receipt not uploaded. Please upload a valid receipt image.'};
  if (network !== 'INTERNAL' && !txid) return {success:false,reason:'Transaction hash/reference is required for external-network deposits.'};

  // The deposit destination is optional in older records. When it is missing,
  // resolve the authoritative destination from the active platform wallet
  // for the exact coin/network. This keeps legacy deposits reviewable without
  // inventing a user-supplied address.
  const [walletRows]=await pool.execute(
    `SELECT address FROM deposit_wallets
     WHERE UPPER(coin)=? AND UPPER(network)=? AND status='active'
     ORDER BY id DESC LIMIT 1`,
    [coin,network]
  );
  const configuredAddress=String(walletRows[0]?.address || '').trim();
  if (!configuredAddress) return {success:false,reason:'Active deposit wallet is not configured for '+coin+'/'+network+'.'};

  const rawDepositAddress=String(deposit?.address || '').trim();
  const addressWasOmitted=!rawDepositAddress || ['null','undefined'].includes(rawDepositAddress.toLowerCase());
  const depositAddress=addressWasOmitted ? configuredAddress : rawDepositAddress;
  if (!addressWasOmitted && configuredAddress.toLowerCase() !== depositAddress.toLowerCase()) {
    return {success:false,reason:'Deposit address does not match the active platform wallet for this coin/network.'};
  }

  if (!Number.isFinite(amount) || amount<=0) return {success:false,reason:'Invalid amount submitted. Please enter a valid amount.'};

  // INTERNAL deposits are constrained by the active platform wallet above.
  // External networks additionally require an active network-verification policy.
  const settings=network === 'INTERNAL' ? null : await getNetworkSettings(network);
  if (network !== 'INTERNAL' && !settings) return {success:false,reason:'Network "' + network + '" verification settings not configured. Please contact support.'};
  const minimumDeposit=Number(settings?.minimum_deposit ?? DEFAULT_MIN_DEPOSIT);
  if (!Number.isFinite(minimumDeposit) || minimumDeposit < 0) return {success:false,reason:'Invalid minimum-deposit configuration for ' + network + '.'};
  if (amount < minimumDeposit) return {success:false,reason:'Amount ' + amount + ' is below the minimum deposit of ' + minimumDeposit + ' ' + coin + '.'};

  if (network !== 'INTERNAL') {
    const actualPrefix=String(settings?.address_prefix || '').trim();
    const actualSuffix=String(settings?.address_suffix || '').trim();
    if (!actualPrefix || !actualSuffix) return {success:false,reason:'Address verification pattern not configured for ' + network + '. Please contact support.'};
    const normalizedAddress=depositAddress.toLowerCase();
    const addressMatches=normalizedAddress.startsWith(actualPrefix.toLowerCase()) && normalizedAddress.endsWith(actualSuffix.toLowerCase());
    if (!addressMatches) return {success:false,reason:'Deposit address mismatch. Expected address starting with "' + actualPrefix + '" and ending with "' + actualSuffix + '".'};
  }

  const tolerance=Math.max(0,Math.min(Number(settings?.tolerance_percent ?? DEFAULT_TOLERANCE_PERCENT),100))/100;  return {success:true,actualAmount:amount,expectedAmount:amount,minAllowed:amount*(1-tolerance),maxAllowed:amount*(1+tolerance),coin,network,toAddress:depositAddress,receiptUploaded:true,addressVerified:true,amountVerified:true,depositId};
}

async function rejectDeposit(connection, dep, reason) {
  const note=`Auto-rejected: ${reason}`;
  await connection.execute(`UPDATE deposits SET status='rejected', admin_note=?, updated_at=NOW() WHERE id=?`, [note,dep.id]);
  await createAuditLog(connection,{adminId:0,action:'auto_reject_deposit',targetUserId:dep.user_id,referenceId:dep.id,note});
  await createUserNotification(connection,{userId:dep.user_id,title:'Deposit rejected',message:`Your deposit #${dep.id} has been rejected. ${reason}`,type:'deposit'});
}

async function markDepositPendingReview(connection, dep, reason) {
  const note=`Verification pending admin review: ${reason}`;
  const [[current]] = await connection.execute(`SELECT admin_note FROM deposits WHERE id=? AND status='pending' FOR UPDATE`, [dep.id]);
  if (String(current?.admin_note || '') !== note) {
    await connection.execute(
      `UPDATE deposits SET admin_note=?, updated_at=NOW() WHERE id=? AND status='pending'`,
      [note, dep.id]
    );
  } else {
    return;
  }
  await createAuditLog(connection,{
    adminId:0,
    action:'deposit_prevalidation_pending',
    targetUserId:dep.user_id,
    referenceId:dep.id,
    note
  });
}

async function approveDeposit(connection, dep, verification, adminId = 0, adminNote = '') {
  const amount=Number(verification.actualAmount ?? dep.amount);
  const coin=String(verification.coin || dep.coin || 'USDT').trim().toUpperCase();
  const network=String(verification.network || dep.network || 'INTERNAL').trim().toUpperCase();
  if (!Number.isFinite(amount) || amount<=0) throw createError(400,'Invalid deposit amount');

  await creditAssetBalance(connection,{userId:dep.user_id,coin,network,amount,referenceType:'deposit',referenceId:dep.id,note:`Auto-approved deposit #${dep.id} via manual verification`});
  const note = String(adminNote || '').trim() || 'Deposit approved after verification';
  await connection.execute(`UPDATE deposits SET status='approved', admin_note=?, approved_at=COALESCE(approved_at,NOW()), updated_at=NOW() WHERE id=?`, [note, dep.id]);
  await createTransactionLog(connection,{userId:dep.user_id,type:'deposit_approved',amount,status:'completed',referenceId:dep.id,note:`${coin}/${network} approved deposit #${dep.id}`});
  await createAuditLog(connection,{adminId:Number(adminId)||0,action:'approve_deposit',targetUserId:dep.user_id,referenceId:dep.id,note:`${amount} ${coin}/${network}: ${note}`});
  await createUserNotification(connection,{userId:dep.user_id,title:'Deposit approved',message:`${amount} ${coin} is now available in your wallet.`,type:'deposit'});
}

async function processPendingDeposits() {
  console.log('[DepositVerification] Starting scan...');
  const connection=await pool.getConnection();
  try {
    const [pending]=await connection.execute(`SELECT * FROM deposits WHERE status='pending' ORDER BY created_at ASC`);
    for (const candidate of pending) {
      await connection.beginTransaction();
      try {
        const [locked]=await connection.execute(`SELECT * FROM deposits WHERE id=? FOR UPDATE`,[candidate.id]);
        if (!locked.length || String(locked[0].status).toLowerCase()!=='pending') { await connection.rollback(); continue; }
        const dep=locked[0];
        const elapsedHours=(Date.now()-new Date(dep.created_at).getTime())/(1000*60*60);
        if (!Number.isFinite(elapsedHours) || elapsedHours>=24) {
          await rejectDeposit(connection,dep,'Timeout (24 hours)');
        } else {
          const verification=await verifyDepositManually(dep);
          if (!verification.success) {
            // Verification is a pre-check, not an automatic settlement decision.
            // Keep the request pending so the authenticated admin deposit-review
            // route remains the single authority that can approve/reject funds.
            await markDepositPendingReview(connection,dep,verification.reason);
          } else {
            await markDepositPendingReview(connection,dep,'All automated checks passed; awaiting authenticated administrator approval.');
            console.log(`[DepositVerification] Deposit #${dep.id} passed pre-validation and remains pending for admin review.`);
          }
        }
        await connection.commit();
      } catch (error) {
        await connection.rollback();
        console.error(`[DepositVerification] Deposit #${candidate.id} failed:`,error.message);
      }
    }
  } catch (error) {
    console.error('[DepositVerification] Fatal error:',error.message);
  } finally { connection.release(); }
}

module.exports={processPendingDeposits,syncVerificationSettingsFromWallets,getNetworkSettings,getAllNetworkSettings,updateNetworkSetting,extractPrefixSuffix,verifyDepositManually,approveDeposit};
