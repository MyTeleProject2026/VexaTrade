const express=require('express');
const router=express.Router();
const pool=require('../../db');
const {authAdmin}=require('../middleware/auth');
const {createError,createTransactionLog,createUserNotification,createAuditLog}=require('../utils/helpers');
const {creditAssetBalance,releaseReservedAsset,consumeReservedAsset,debitAvailableAsset,movePendingToAvailable}=require('../../services/assetLedgerService');
const {verifyTronUsdtDeposit,claimVerifiedDeposit}=require('../../services/tronVerificationService');

let treasuryTransferTableReady = false;
let treasuryTransferTablePromise = null;
async function ensureTreasuryTransferTable() {
  if (treasuryTransferTableReady) return;
  if (!treasuryTransferTablePromise) {
    treasuryTransferTablePromise = pool.execute(`
      CREATE TABLE IF NOT EXISTS treasury_outbound_requests (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        request_key VARCHAR(80) NOT NULL,
        coin VARCHAR(24) NOT NULL,
        network VARCHAR(32) NOT NULL,
        destination_kind VARCHAR(24) NOT NULL,
        destination_address VARCHAR(255) NOT NULL,
        destination_label VARCHAR(120) NULL,
        amount DECIMAL(36,18) NOT NULL,
        status VARCHAR(40) NOT NULL DEFAULT 'awaiting_funding',
        txid VARCHAR(160) NULL,
        note VARCHAR(500) NULL,
        created_by BIGINT UNSIGNED NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_treasury_outbound_request_key (request_key),
        KEY idx_treasury_outbound_status_created (status, created_at),
        KEY idx_treasury_outbound_destination (network, destination_address)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `).then(() => { treasuryTransferTableReady = true; }).catch((err) => {
      treasuryTransferTablePromise = null;
      throw err;
    });
  }
  await treasuryTransferTablePromise;
}
function validateDestinationAddress(network, address) {
  const n = String(network || '').trim().toUpperCase();
  const a = String(address || '').trim();
  if (['TRON','TRC20'].includes(n)) return /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(a);
  if (['ETHEREUM','ERC20','BSC','BEP20','POLYGON','POLYGON POS'].includes(n)) return /^0x[a-fA-F0-9]{40}$/.test(a);
  if (['BITCOIN','BTC'].includes(n)) return /^(bc1[ac-hj-np-z02-9]{11,71}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})$/i.test(a);
  return false;
}
function isSupportedAssetNetwork(coin, network) {
  const c = String(coin || '').trim().toUpperCase();
  const n = String(network || '').trim().toUpperCase();
  const allowed = {
    TRON: ['USDT','TRX'], TRC20: ['USDT'],
    ETHEREUM: ['ETH','USDT'], ERC20: ['USDT'],
    BSC: ['BNB','USDT'], BEP20: ['USDT'],
    POLYGON: ['POL','USDT'], 'POLYGON POS': ['POL','USDT'],
    BITCOIN: ['BTC'], BTC: ['BTC']
  };
  return Boolean(allowed[n] && allowed[n].includes(c));
}
function isPositiveDecimal18(value) {
  const s = String(value ?? '').trim();
  if (!/^(?:0|[1-9]\d{0,17})(?:\.\d{1,18})?$/.test(s)) return false;
  return /[1-9]/.test(s);
}

// Owner workspace: create a persistent pending outbound intent only.
// This endpoint deliberately does not create an external balance, sign, or broadcast a transaction.
router.get('/operations/treasury/transfers', authAdmin, async (req, res, next) => {
  try {
    await ensureTreasuryTransferTable();
    const [rows] = await pool.execute(
      'SELECT id, request_key, coin, network, destination_kind, destination_address, destination_label, amount, status, txid, note, created_by, created_at, updated_at FROM treasury_outbound_requests ORDER BY id DESC LIMIT 100'
    );
    res.json({ success: true, data: rows, settlementEnabled: false, message: 'Requests are internal pending intents; external balances change only after a real, confirmed transfer.' });
  } catch (e) { next(e); }
});

router.post('/operations/treasury/transfers', authAdmin, async (req, res, next) => {
  try {
    await ensureTreasuryTransferTable();
    const coin = String(req.body?.coin || '').trim().toUpperCase();
    const network = String(req.body?.network || '').trim().toUpperCase();
    const destinationKind = String(req.body?.destination_kind || '').trim().toLowerCase();
    const destinationAddress = String(req.body?.destination_address || '').trim();
    const destinationLabel = String(req.body?.destination_label || '').trim().slice(0, 120) || null;
    const note = String(req.body?.note || '').trim().slice(0, 500) || null;
    const amountText = String(req.body?.amount ?? '').trim();
    const amount = Number(amountText);
    const requestKey = String(req.body?.request_key || '').trim();
    if (!/^[A-Z0-9]{2,24}$/.test(coin)) return res.status(400).json({ success: false, message: 'Choose a supported coin symbol.' });
    if (!network || network.length > 32) return res.status(400).json({ success: false, message: 'Choose a blockchain network.' });
    if (!isSupportedAssetNetwork(coin, network)) return res.status(400).json({ success: false, message: 'This coin is not supported on the selected network. Check the asset/network pair before creating a request.' });
    if (!['wallet','exchange'].includes(destinationKind)) return res.status(400).json({ success: false, message: 'Destination type must be wallet or exchange.' });
    if (!validateDestinationAddress(network, destinationAddress)) return res.status(400).json({ success: false, message: 'Destination address format does not match a supported network. This format check does not prove ownership or account credit.' });
    if (!isPositiveDecimal18(amountText)) return res.status(400).json({ success: false, message: 'Enter a positive amount with up to 18 integer digits and up to 18 decimal places.' });
    if (!/^VXT-[A-F0-9]{24}$/.test(requestKey)) return res.status(400).json({ success: false, message: 'A valid unique internal request reference is required.' });
    const [existing] = await pool.execute('SELECT id, request_key, coin, network, destination_kind, destination_address, destination_label, amount, status, txid, note, created_by, created_at FROM treasury_outbound_requests WHERE request_key=? LIMIT 1', [requestKey]);
    if (existing.length) return res.status(200).json({ success: true, duplicate: true, data: existing[0], message: 'Existing pending request returned. No duplicate request was created.' });
    let result;
    try {
      [result] = await pool.execute(
        `INSERT INTO treasury_outbound_requests
          (request_key, coin, network, destination_kind, destination_address, destination_label, amount, status, txid, note, created_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'awaiting_funding', NULL, ?, ?, NOW(), NOW())`,
        [requestKey, coin, network, destinationKind, destinationAddress, destinationLabel, amountText, note, Number(req.admin.id)]
      );
    } catch (insertError) {
      // Concurrent retries can both pass the pre-insert lookup. The unique key
      // remains authoritative: return the existing request instead of creating
      // a second payment intent or exposing a duplicate-key server error.
      if (insertError.code === 'ER_DUP_ENTRY') {
        const [duplicateRows] = await pool.execute(
          'SELECT id, request_key, coin, network, destination_kind, destination_address, destination_label, amount, status, txid, note, created_by, created_at FROM treasury_outbound_requests WHERE request_key=? LIMIT 1',
          [requestKey]
        );
        if (duplicateRows.length) return res.status(200).json({ success: true, duplicate: true, data: duplicateRows[0], message: 'Existing pending request returned. No duplicate request was created.' });
      }
      throw insertError;
    }
    await createAuditLog(pool, { adminId: req.admin.id, action: 'treasury_outbound_request_created', referenceId: result.insertId, note: `${amountText} ${coin}/${network}; awaiting funding; no transaction broadcast` });
    const [rows] = await pool.execute('SELECT id, request_key, coin, network, destination_kind, destination_address, destination_label, amount, status, txid, note, created_by, created_at, updated_at FROM treasury_outbound_requests WHERE id=? LIMIT 1', [result.insertId]);
    res.status(201).json({ success: true, data: rows[0], settlementEnabled: false, message: 'Pending outbound request created. No funds were sent, no external balance was created, and no blockchain TXID exists yet.' });
  } catch (e) { next(e); }
});

// Admin-only treasury readiness. Bitget Wallet is a wallet interface, not a configured server-side custody/signing service.
router.get('/operations/treasury/status',authAdmin,async(req,res)=>{
  res.json({
    success:true,
    data:{
      provider:'Bitget Wallet',
      treasuryConfigured:false,
      signingConfigured:false,
      broadcastConfigured:false,
      outboundSettlementReady:false,
      enabledOutboundNetworks:[],
      verifiedInboundAdapters:['USDT/TRC20 (TRON mainnet)'],
      missing:[
        'Treasury wallet address and ownership verification',
        'A supported, authenticated signing/broadcast integration for each enabled chain',
        'Chain-specific confirmed-receipt verification and idempotent settlement',
        'Per-network asset/contract allowlist and treasury fee policy'
      ],
      message:'Outbound transfers remain disabled. Bitget Wallet connection alone does not configure a server treasury or authorize server-side signing.'
    }
  });
});

// Verify a deposit against confirmed TRON mainnet data without mutating balances.
router.post('/operations/deposits/:id/verify',authAdmin,async(req,res,next)=>{try{
 const id=Number(req.params.id);if(!Number.isInteger(id)||id<=0)throw createError(400,'Invalid deposit id');
 const [rows]=await pool.execute('SELECT * FROM deposits WHERE id=? LIMIT 1',[id]);if(!rows.length)throw createError(404,'Deposit not found');
 const d=rows[0];if(String(d.status||'').toLowerCase()!=='pending')throw createError(409,'Only pending deposits can be verified');
 const coin=String(d.coin||'').trim().toUpperCase(),network=String(d.network||'').trim().toUpperCase();
 if(coin!=='USDT'||!['TRC20','TRON'].includes(network))throw createError(409,'Live automatic verification is currently enabled only for USDT on TRON TRC20. Other assets remain locked until their network adapter is configured.');
 const [wallets]=await pool.execute("SELECT address FROM deposit_wallets WHERE UPPER(coin)='USDT' AND UPPER(network) IN ('TRC20','TRON') AND status='active' ORDER BY id DESC LIMIT 1");
 if(!wallets.length||!wallets[0].address)throw createError(503,'No active TRON USDT treasury deposit address is configured');
 const result=await verifyTronUsdtDeposit({txid:d.txid,recipientAddress:wallets[0].address,expectedAmount:d.amount});
 if(!result.verified)return res.status(422).json({success:false,verified:false,message:result.reason,details:result});
 res.json({success:true,verified:true,message:'Confirmed TRON USDT deposit matches the configured treasury address and requested amount.',data:{deposit_id:id,...result}});
}catch(e){next(e)}});

// Canonical ledger-aware deposit settlement.
router.post('/operations/deposits/:id/approve',authAdmin,async(req,res,next)=>{const c=await pool.getConnection();try{await c.beginTransaction();const [rows]=await c.execute('SELECT * FROM deposits WHERE id=? FOR UPDATE',[Number(req.params.id)]);if(!rows.length)throw createError(404,'Deposit not found');const d=rows[0];if(String(d.status).toLowerCase()!=='pending')throw createError(409,'Deposit is no longer pending');const amount=Number(d.amount);if(!Number.isFinite(amount)||amount<=0)throw createError(400,'Invalid deposit amount');const coin=String(d.coin||'USDT').trim().toUpperCase(),requestedNetwork=String(d.network||'INTERNAL').trim().toUpperCase();if(coin!=='USDT'||!['TRC20','TRON'].includes(requestedNetwork))throw createError(409,'Deposit credit is locked for this asset/network until a verified blockchain adapter is configured.');const network='TRC20';const [wallets]=await c.execute("SELECT address FROM deposit_wallets WHERE UPPER(coin)='USDT' AND UPPER(network) IN ('TRC20','TRON') AND status='active' ORDER BY id DESC LIMIT 1");if(!wallets.length||!wallets[0].address)throw createError(503,'No active TRON USDT treasury deposit address is configured');const verification=await verifyTronUsdtDeposit({txid:d.txid,recipientAddress:wallets[0].address,expectedAmount:d.amount});if(!verification.verified)throw createError(422,'Deposit not credited: '+verification.reason);const [duplicates]=await c.execute("SELECT id FROM deposits WHERE id<>? AND LOWER(txid)=LOWER(?) AND status='approved' LIMIT 1 FOR UPDATE",[d.id,d.txid]);if(duplicates.length)throw createError(409,'This blockchain transaction has already been credited to another deposit request');await claimVerifiedDeposit(c,{txid:verification.txid,depositId:d.id,userId:d.user_id,coin,network,amount:d.amount});await creditAssetBalance(c,{userId:d.user_id,coin,network,amount,referenceType:'deposit',referenceId:d.id,note:'Approved deposit credit'});await c.execute("UPDATE deposits SET status='approved',approved_at=COALESCE(approved_at,NOW()),updated_at=NOW() WHERE id=?",[d.id]);await createTransactionLog(c,{userId:d.user_id,type:'deposit',amount,status:'completed',referenceId:d.id,note:`${coin}/${network} deposit approved`});await createAuditLog(c,{adminId:req.admin.id,action:'deposit_approved',targetUserId:d.user_id,referenceId:d.id,note:`${amount} ${coin}/${network}`});await createUserNotification(c,{userId:d.user_id,title:'Deposit approved',message:`${amount} ${coin} is now available in your wallet.`,type:'general'});await c.commit();res.json({success:true,message:'Deposit approved and asset credited'});}catch(e){await c.rollback();next(e)}finally{c.release()}});

router.post('/operations/deposits/:id/reject',authAdmin,async(req,res,next)=>{const c=await pool.getConnection();try{const note=String(req.body.note||'Deposit rejected');await c.beginTransaction();const [rows]=await c.execute('SELECT * FROM deposits WHERE id=? FOR UPDATE',[Number(req.params.id)]);if(!rows.length)throw createError(404,'Deposit not found');const d=rows[0];if(String(d.status).toLowerCase()!=='pending')throw createError(409,'Deposit is no longer pending');await c.execute("UPDATE deposits SET status='rejected',updated_at=NOW() WHERE id=?",[d.id]);await createAuditLog(c,{adminId:req.admin.id,action:'deposit_rejected',targetUserId:d.user_id,referenceId:d.id,note});await createUserNotification(c,{userId:d.user_id,title:'Deposit request update',message:note,type:'security'});await c.commit();res.json({success:true,message:'Deposit rejected'});}catch(e){await c.rollback();next(e)}finally{c.release()}});

router.post('/operations/withdrawals/:id/reject',authAdmin,async(req,res,next)=>{const c=await pool.getConnection();try{const note=String(req.body.note||'Withdrawal rejected');await c.beginTransaction();const [rows]=await c.execute('SELECT * FROM withdrawals WHERE id=? FOR UPDATE',[Number(req.params.id)]);if(!rows.length)throw createError(404,'Withdrawal not found');const w=rows[0];if(!['pending_authorization','pending','authorized','pending_joint_authorization','pending_settlement','settlement_processing'].includes(String(w.status).toLowerCase()))throw createError(409,'Withdrawal cannot be rejected');const reservedAmount=Number((Number(w.amount)+Number(w.fee_amount||0)).toFixed(18));await releaseReservedAsset(c,{userId:w.user_id,coin:w.coin,network:w.network,amount:reservedAmount,referenceType:'withdrawal',referenceId:w.id,note});await c.execute("UPDATE withdrawals SET status='rejected',updated_at=NOW() WHERE id=?",[w.id]);await createAuditLog(c,{adminId:req.admin.id,action:'withdrawal_rejected',targetUserId:w.user_id,referenceId:w.id,note});await createUserNotification(c,{userId:w.user_id,title:'Withdrawal rejected',message:`${reservedAmount} ${w.coin} reservation was released. ${note}`,type:'security'});await c.commit();res.json({success:true,message:'Withdrawal rejected and reserved asset released'});}catch(e){await c.rollback();next(e)}finally{c.release()}});

// Fail closed until a configured blockchain/exchange adapter can broadcast and verify receipts.
// A manually entered transaction hash is not proof of settlement and must never debit the ledger.
router.post('/operations/withdrawals/:id/settle',authAdmin,async(req,res)=>res.status(503).json({success:false,code:'BLOCKCHAIN_SETTLEMENT_NOT_CONFIGURED',message:'Withdrawal completion is disabled until a treasury provider is configured to broadcast the transfer and verify its confirmed receipt. No funds were settled and no transaction hash was accepted.'}));

// Ledger-authoritative compatibility endpoint for the existing Super Admin fund controls.
router.post('/admin/funds/:id/complete',authAdmin,async(req,res,next)=>{const c=await pool.getConnection();try{const fundId=Number(req.params.id);const note=String(req.body?.note||req.body?.admin_note||'Manual fund completion').trim();if(!Number.isInteger(fundId)||fundId<=0)throw createError(400,'Invalid fund id');await c.beginTransaction();const [rows]=await c.execute(`SELECT uf.*,fp.name plan_name FROM user_funds uf LEFT JOIN fund_plans fp ON fp.id=uf.plan_id WHERE uf.id=? FOR UPDATE`,[fundId]);if(!rows.length)throw createError(404,'Fund not found');const fund=rows[0];const status=String(fund.status||'').toLowerCase();if(status==='completed'){await c.rollback();return res.json({success:true,message:'Fund already completed',data:{id:fund.id,status:'completed'}});}if(status!=='active')throw createError(409,'Only active funds can be completed');const principal=Number(fund.locked_principal||fund.amount||0);if(!Number.isFinite(principal)||principal<=0)throw createError(409,'Fund principal is invalid');await movePendingToAvailable(c,{userId:fund.user_id,coin:'USDT',network:'INTERNAL',amount:principal,entryType:'fund_principal_return',referenceType:'user_fund',referenceId:fund.id,note});await c.execute(`UPDATE user_funds SET status='completed',completed_at=NOW(),updated_at=NOW() WHERE id=?`,[fund.id]);await createTransactionLog(c,{userId:fund.user_id,type:'funds_return',amount:principal,status:'completed',referenceId:fund.id,note:`${note}: ${fund.plan_name||'Fund'}`});await createAuditLog(c,{adminId:req.admin.id,action:'complete_fund_ledger',targetUserId:fund.user_id,referenceId:fund.id,note:`Returned ${principal} USDT from ${fund.plan_name||'Fund'}`});await createUserNotification(c,{userId:fund.user_id,title:'Fund completed',message:`${fund.plan_name||'Your fund'} was completed and ${principal.toFixed(2)} USDT was returned to your available wallet.`,type:'funds'});await c.commit();res.json({success:true,message:'Fund completed and principal returned to ledger',data:{id:fund.id,status:'completed',principal_returned:principal}});}catch(e){await c.rollback();next(e)}finally{c.release()}});

// Ledger-authoritative compatibility endpoint for the existing Super Admin cancellation control.
router.post('/admin/funds/:id/cancel',authAdmin,async(req,res,next)=>{const c=await pool.getConnection();try{const fundId=Number(req.params.id);const note=String(req.body?.note||req.body?.admin_note||'Fund cancelled by admin').trim();if(!Number.isInteger(fundId)||fundId<=0)throw createError(400,'Invalid fund id');await c.beginTransaction();const [rows]=await c.execute(`SELECT uf.*,fp.name plan_name FROM user_funds uf LEFT JOIN fund_plans fp ON fp.id=uf.plan_id WHERE uf.id=? FOR UPDATE`,[fundId]);if(!rows.length)throw createError(404,'Fund not found');const fund=rows[0];const status=String(fund.status||'').toLowerCase();if(status==='cancelled'){await c.rollback();return res.json({success:true,message:'Fund already cancelled',data:{id:fund.id,status:'cancelled'}});}if(status!=='active')throw createError(409,'Only active funds can be cancelled');const principal=Number(fund.locked_principal||fund.amount||0);if(!Number.isFinite(principal)||principal<=0)throw createError(409,'Fund principal is invalid');await movePendingToAvailable(c,{userId:fund.user_id,coin:'USDT',network:'INTERNAL',amount:principal,entryType:'fund_principal_return',referenceType:'user_fund',referenceId:fund.id,note});await c.execute(`UPDATE user_funds SET status='cancelled',completed_at=NOW(),updated_at=NOW() WHERE id=?`,[fund.id]);await createTransactionLog(c,{userId:fund.user_id,type:'funds_return',amount:principal,status:'completed',referenceId:fund.id,note:`${note}: ${fund.plan_name||'Fund'}`});await createAuditLog(c,{adminId:req.admin.id,action:'cancel_fund_ledger',targetUserId:fund.user_id,referenceId:fund.id,note:`Returned ${principal} USDT from ${fund.plan_name||'Fund'}`});await createUserNotification(c,{userId:fund.user_id,title:'Fund cancelled',message:`${fund.plan_name||'Your fund'} was cancelled and ${principal.toFixed(2)} USDT was returned to your available wallet.`,type:'funds'});await c.commit();res.json({success:true,message:'Fund cancelled and principal returned to ledger',data:{id:fund.id,status:'cancelled',principal_returned:principal}});}catch(e){await c.rollback();next(e)}finally{c.release()}});

// Backward-compatible admin endpoints intercept legacy users.balance mutations.
router.post('/admin/users/:id/add-funds',authAdmin,async(req,res,next)=>{const c=await pool.getConnection();try{const userId=Number(req.params.id),amount=Number(req.body.amount||0),note=String(req.body.note||'').trim();if(!Number.isInteger(userId)||userId<=0)throw createError(400,'Invalid user id');if(!Number.isFinite(amount)||amount<=0)throw createError(400,'Invalid amount');await c.beginTransaction();const [users]=await c.execute('SELECT id FROM users WHERE id=? FOR UPDATE',[userId]);if(!users.length)throw createError(404,'User not found');await creditAssetBalance(c,{userId,coin:'USDT',network:'INTERNAL',amount,referenceType:'admin_credit',referenceId:userId,note:note||`Manual USDT credit by admin ${req.admin.id}`});await createTransactionLog(c,{userId,type:'admin_credit',amount,status:'completed',referenceId:userId,note:note||`Manual USDT credit by admin ${req.admin.id}`});await createAuditLog(c,{adminId:req.admin.id,action:'add_user_funds_ledger',targetUserId:userId,referenceId:userId,note:note||`Added ${amount} USDT`});await createUserNotification(c,{userId,title:'Balance updated',message:`Admin added ${amount} USDT to your available wallet balance.`,type:'general'});await c.commit();res.json({success:true,message:'Funds added to USDT asset ledger',data:{coin:'USDT',amount}});}catch(e){await c.rollback();next(e)}finally{c.release()}});

router.post('/admin/users/:id/decrease-funds',authAdmin,async(req,res,next)=>{const c=await pool.getConnection();try{const userId=Number(req.params.id),amount=Number(req.body.amount||0),note=String(req.body.note||'').trim();if(!Number.isInteger(userId)||userId<=0)throw createError(400,'Invalid user id');if(!Number.isFinite(amount)||amount<=0)throw createError(400,'Invalid amount');await c.beginTransaction();const [users]=await c.execute('SELECT id FROM users WHERE id=? FOR UPDATE',[userId]);if(!users.length)throw createError(404,'User not found');await debitAvailableAsset(c,{userId,coin:'USDT',network:'INTERNAL',amount,referenceType:'admin_debit',referenceId:userId,note:note||`Manual USDT debit by admin ${req.admin.id}`});await createTransactionLog(c,{userId,type:'admin_debit',amount,status:'completed',referenceId:userId,note:note||`Manual USDT debit by admin ${req.admin.id}`});await createAuditLog(c,{adminId:req.admin.id,action:'decrease_user_funds_ledger',targetUserId:userId,referenceId:userId,note:note||`Decreased ${amount} USDT`});await createUserNotification(c,{userId,title:'Balance updated',message:`Admin decreased ${amount} USDT from your available wallet balance.`,type:'security'});await c.commit();res.json({success:true,message:'Funds decreased from USDT asset ledger',data:{coin:'USDT',amount}});}catch(e){await c.rollback();next(e)}finally{c.release()}});

router.post('/admin/deposits/:id/approve',authAdmin,async(req,res,next)=>{
 const c=await pool.getConnection();
 try {
  const depositId=Number(req.params.id);
  const adminNote=String(req.body?.admin_note||req.body?.note||'').trim();
  if(!Number.isInteger(depositId)||depositId<=0)throw createError(400,'Invalid deposit id');
  await c.beginTransaction();
  const [rows]=await c.execute('SELECT * FROM deposits WHERE id=? FOR UPDATE',[depositId]);
  if(!rows.length)throw createError(404,'Deposit not found');
  const d=rows[0];
  if(String(d.status||'').toLowerCase()!=='pending')throw createError(409,'Deposit already processed');
  const amount=Number(d.amount||0);
  if(!Number.isFinite(amount)||amount<=0)throw createError(400,'Invalid deposit amount');
  const coin=String(d.coin||'USDT').trim().toUpperCase();
  const requestedNetwork=String(d.network||'').trim().toUpperCase();
  if(coin!=='USDT'||!['TRC20','TRON'].includes(requestedNetwork))throw createError(409,'Deposit credit is locked until a confirmed on-chain verifier is configured for this asset and network.');
  const [wallets]=await c.execute("SELECT address FROM deposit_wallets WHERE UPPER(coin)='USDT' AND UPPER(network) IN ('TRC20','TRON') AND status='active' ORDER BY id DESC LIMIT 1");
  if(!wallets.length||!wallets[0].address)throw createError(503,'No active TRON USDT treasury deposit address is configured');
  const verification=await verifyTronUsdtDeposit({txid:d.txid,recipientAddress:wallets[0].address,expectedAmount:d.amount});
  if(!verification.verified)throw createError(422,'Deposit not credited: '+verification.reason);
  const [duplicates]=await c.execute("SELECT id FROM deposits WHERE id<>? AND LOWER(txid)=LOWER(?) AND status='approved' LIMIT 1 FOR UPDATE",[d.id,d.txid]);
  if(duplicates.length)throw createError(409,'This blockchain transaction has already been credited to another deposit request');
  await claimVerifiedDeposit(c,{txid:verification.txid,depositId:d.id,userId:d.user_id,coin,network:'TRC20',amount:d.amount});
  await creditAssetBalance(c,{userId:d.user_id,coin,network:'TRC20',amount,referenceType:'deposit_admin_approval',referenceId:d.id,note:adminNote||'Verified TRON USDT deposit approved by admin; TXID '+verification.txid});
  await c.execute("UPDATE deposits SET status='approved',admin_note=?,approved_at=COALESCE(approved_at,NOW()),updated_at=NOW() WHERE id=?",[adminNote||'Verified on-chain deposit approved',depositId]);
  await createTransactionLog(c,{userId:d.user_id,type:'deposit_approved',amount,status:'completed',referenceId:d.id,note:'Verified TRON USDT deposit TXID '+verification.txid});
  await createAuditLog(c,{adminId:req.admin.id,action:'approve_deposit_ledger',targetUserId:d.user_id,referenceId:d.id,note:adminNote||'Verified on-chain deposit approved; TXID '+verification.txid});
  await createUserNotification(c,{userId:d.user_id,title:'Deposit approved',message:'Your confirmed TRON USDT deposit has been credited to your wallet.',type:'general'});
  await c.commit();
  res.json({success:true,message:'Verified on-chain deposit approved and asset credited',data:{depositId,coin,network:'TRC20',txid:verification.txid,verified:true}});
 } catch(e) { await c.rollback(); next(e); }
 finally { c.release(); }
});

// Legacy withdrawal approval is a state transition only; funds were reserved by the user request.
router.post('/admin/withdrawals/:id/approve',authAdmin,async(req,res,next)=>{const c=await pool.getConnection();try{const withdrawalId=Number(req.params.id),note=String(req.body?.admin_note||req.body?.note||'Settlement authorization approved').trim();await c.beginTransaction();const [rows]=await c.execute('SELECT * FROM withdrawals WHERE id=? FOR UPDATE',[withdrawalId]);if(!rows.length)throw createError(404,'Withdrawal not found');const w=rows[0];const status=String(w.status||'').toLowerCase();if(status==='settlement_processing'){await c.rollback();return res.json({success:true,message:'Withdrawal is already in settlement processing',data:{id:w.id,status}});}if(!['pending','pending_authorization','authorized','pending_settlement'].includes(status))throw createError(409,'Withdrawal is not awaiting settlement authorization');await c.execute("UPDATE withdrawals SET status='settlement_processing',authorization_status='authorized',admin_note=?,updated_at=NOW() WHERE id=?",[note,withdrawalId]);await createTransactionLog(c,{userId:w.user_id,type:'withdrawal_settlement_processing',amount:Number(w.amount||0)+Number(w.fee_amount||0),status:'processing',referenceId:w.id,note});await createAuditLog(c,{adminId:req.admin.id,action:'begin_withdrawal_settlement',targetUserId:w.user_id,referenceId:w.id,note});await createUserNotification(c,{userId:w.user_id,title:'Withdrawal settlement started',message:'Your withdrawal has entered settlement processing.',type:'general'});await c.commit();res.json({success:true,message:'Withdrawal moved to settlement processing',data:{id:w.id,status:'settlement_processing'}});}catch(e){await c.rollback();next(e)}finally{c.release()}});


// Owner-controlled internal transfer queue. INTERNAL transfers are ledger movements, not blockchain broadcasts.
router.get('/operations/transfers/pending',authAdmin,async(req,res,next)=>{try{const [rows]=await pool.execute("SELECT ut.id,ut.sender_id,ut.receiver_id,ut.amount,ut.currency,ut.status,ut.note,ut.created_at,s.uid sender_uid,s.name sender_name,r.uid receiver_uid,r.name receiver_name FROM user_transfers ut JOIN users s ON s.id=ut.sender_id JOIN users r ON r.id=ut.receiver_id WHERE ut.status='pending_owner_approval' ORDER BY ut.created_at ASC LIMIT 200");res.json({success:true,data:rows.map(x=>({...x,amount:Number(x.amount)}))});}catch(e){next(e)}});
router.post('/operations/transfers/:id/approve',authAdmin,async(req,res,next)=>{const c=await pool.getConnection();try{const transferId=Number(req.params.id),note=String(req.body?.note||'Internal transfer approved by owner').trim();if(!Number.isInteger(transferId)||transferId<=0)throw createError(400,'Invalid transfer id');await c.beginTransaction();const [rows]=await c.execute('SELECT * FROM user_transfers WHERE id=? FOR UPDATE',[transferId]);if(!rows.length)throw createError(404,'Transfer not found');const t=rows[0];if(String(t.status||'').toLowerCase()!=='pending_owner_approval')throw createError(409,'Transfer is no longer awaiting owner approval');const coin=String(t.currency||'USDT').trim().toUpperCase(),network='INTERNAL',amount=Number(t.amount);if(!Number.isFinite(amount)||amount<=0)throw createError(409,'Transfer amount is invalid');const [users]=await c.execute('SELECT id,uid,name,status FROM users WHERE id IN (?,?) ORDER BY id FOR UPDATE',[t.sender_id,t.receiver_id]);if(users.length!==2)throw createError(409,'Transfer sender or recipient no longer exists');const sender=users.find(u=>Number(u.id)===Number(t.sender_id)),receiver=users.find(u=>Number(u.id)===Number(t.receiver_id));if(!sender||!receiver)throw createError(409,'Transfer participants could not be resolved');if(['disabled','frozen'].includes(String(receiver.status||'').toLowerCase()))throw createError(409,'Recipient account is not active');await consumeReservedAsset(c,{userId:t.sender_id,coin,network,amount,referenceType:'transfer',referenceId:t.id,note:'Owner approved internal transfer'});await creditAssetBalance(c,{userId:t.receiver_id,coin,network,amount,referenceType:'transfer',referenceId:t.id,note:'Owner approved internal transfer'});await c.execute("UPDATE user_transfers SET status='completed',completed_at=NOW() WHERE id=? AND status='pending_owner_approval'",[t.id]);await createTransactionLog(c,{userId:t.sender_id,type:'transfer_sent',amount,status:'completed',referenceId:t.id,note:`Transfer ${amount} ${coin} to ${receiver.uid}; ${note}`});await createTransactionLog(c,{userId:t.receiver_id,type:'transfer_received',amount,status:'completed',referenceId:t.id,note:`Transfer ${amount} ${coin} from ${sender.uid}; ${note}`});await createAuditLog(c,{adminId:req.admin.id,action:'internal_transfer_approved',targetUserId:t.sender_id,referenceId:t.id,note:`${amount} ${coin} from ${sender.uid} to ${receiver.uid}; ${note}`});await createUserNotification(c,{userId:t.receiver_id,title:'Transfer received',message:`You received ${amount} ${coin} from ${sender.name||sender.uid} after owner approval.`,type:'funds'});await createUserNotification(c,{userId:t.sender_id,title:'Transfer approved',message:`Your transfer of ${amount} ${coin} to ${receiver.uid} is complete.`,type:'funds'});await c.commit();res.json({success:true,message:'Owner-approved internal transfer completed',data:{id:t.id,status:'completed',coin,network,amount,from:sender.uid,to:receiver.uid,transaction_type:'internal_ledger_transfer',blockchain_txid:null}});}catch(e){try{await c.rollback()}catch(_){}next(e)}finally{c.release()}});
router.post('/operations/transfers/:id/reject',authAdmin,async(req,res,next)=>{const c=await pool.getConnection();try{const transferId=Number(req.params.id),note=String(req.body?.note||'Internal transfer rejected by owner').trim();if(!Number.isInteger(transferId)||transferId<=0)throw createError(400,'Invalid transfer id');await c.beginTransaction();const [rows]=await c.execute('SELECT * FROM user_transfers WHERE id=? FOR UPDATE',[transferId]);if(!rows.length)throw createError(404,'Transfer not found');const t=rows[0];if(String(t.status||'').toLowerCase()!=='pending_owner_approval')throw createError(409,'Transfer is no longer awaiting owner approval');await releaseReservedAsset(c,{userId:t.sender_id,coin:String(t.currency||'USDT').trim().toUpperCase(),network:'INTERNAL',amount:Number(t.amount),referenceType:'transfer',referenceId:t.id,note});await c.execute("UPDATE user_transfers SET status='rejected',completed_at=NULL WHERE id=? AND status='pending_owner_approval'",[t.id]);await createTransactionLog(c,{userId:t.sender_id,type:'transfer_rejected',amount:Number(t.amount),status:'rejected',referenceId:t.id,note});await createAuditLog(c,{adminId:req.admin.id,action:'internal_transfer_rejected',targetUserId:t.sender_id,referenceId:t.id,note});await createUserNotification(c,{userId:t.sender_id,title:'Transfer rejected',message:`Your transfer request was rejected. Reserved ${t.amount} ${t.currency} has been returned to your available balance. ${note}`,type:'security'});await c.commit();res.json({success:true,message:'Transfer rejected and reserved funds released',data:{id:t.id,status:'rejected'}});}catch(e){try{await c.rollback()}catch(_){}next(e)}finally{c.release()}});

module.exports=router;