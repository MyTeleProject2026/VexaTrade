const express=require('express');
const router=express.Router();
const pool=require('../../db');
const {authAdmin}=require('../middleware/auth');
const {createError,createTransactionLog,createUserNotification,createAuditLog}=require('../utils/helpers');
const {creditAssetBalance,releaseReservedAsset,consumeReservedAsset,debitAvailableAsset}=require('../../services/assetLedgerService');

// Canonical ledger-aware deposit settlement.
router.post('/operations/deposits/:id/approve',authAdmin,async(req,res,next)=>{
 const c=await pool.getConnection();try{
  await c.beginTransaction();
  const [rows]=await c.execute('SELECT * FROM deposits WHERE id=? FOR UPDATE',[Number(req.params.id)]);
  if(!rows.length)throw createError(404,'Deposit not found');
  const d=rows[0];if(String(d.status).toLowerCase()!=='pending')throw createError(409,'Deposit is no longer pending');
  const amount=Number(d.amount);if(!Number.isFinite(amount)||amount<=0)throw createError(400,'Invalid deposit amount');
  const coin=String(d.coin||'USDT').trim().toUpperCase(),network=String(d.network||'INTERNAL').trim().toUpperCase();
  await creditAssetBalance(c,{userId:d.user_id,coin,network,amount,referenceType:'deposit',referenceId:d.id,note:'Approved deposit credit'});
  await c.execute("UPDATE deposits SET status='approved',approved_at=COALESCE(approved_at,NOW()),updated_at=NOW() WHERE id=?",[d.id]);
  await createTransactionLog(c,{userId:d.user_id,type:'deposit',amount,status:'completed',referenceId:d.id,note:`${coin}/${network} deposit approved`});
  await createAuditLog(c,{adminId:req.admin.id,action:'deposit_approved',targetUserId:d.user_id,referenceId:d.id,note:`${amount} ${coin}/${network}`});
  await createUserNotification(c,{userId:d.user_id,title:'Deposit approved',message:`${amount} ${coin} is now available in your wallet.`,type:'general'});
  await c.commit();res.json({success:true,message:'Deposit approved and asset credited'});
 }catch(e){await c.rollback();next(e)}finally{c.release()}
});

router.post('/operations/deposits/:id/reject',authAdmin,async(req,res,next)=>{
 const c=await pool.getConnection();try{
  const note=String(req.body.note||'Deposit rejected');await c.beginTransaction();
  const [rows]=await c.execute('SELECT * FROM deposits WHERE id=? FOR UPDATE',[Number(req.params.id)]);
  if(!rows.length)throw createError(404,'Deposit not found');const d=rows[0];
  if(String(d.status).toLowerCase()!=='pending')throw createError(409,'Deposit is no longer pending');
  await c.execute("UPDATE deposits SET status='rejected',updated_at=NOW() WHERE id=?",[d.id]);
  await createAuditLog(c,{adminId:req.admin.id,action:'deposit_rejected',targetUserId:d.user_id,referenceId:d.id,note});
  await createUserNotification(c,{userId:d.user_id,title:'Deposit request update',message:note,type:'security'});
  await c.commit();res.json({success:true,message:'Deposit rejected'});
 }catch(e){await c.rollback();next(e)}finally{c.release()}
});

router.post('/operations/withdrawals/:id/reject',authAdmin,async(req,res,next)=>{
 const c=await pool.getConnection();try{
  const note=String(req.body.note||'Withdrawal rejected');await c.beginTransaction();
  const [rows]=await c.execute('SELECT * FROM withdrawals WHERE id=? FOR UPDATE',[Number(req.params.id)]);
  if(!rows.length)throw createError(404,'Withdrawal not found');const w=rows[0];
  if(!['pending_authorization','pending','authorized','pending_joint_authorization','pending_settlement'].includes(String(w.status).toLowerCase()))throw createError(409,'Withdrawal cannot be rejected');
  const reservedAmount=Number((Number(w.amount)+Number(w.fee_amount||0)).toFixed(18));
  await releaseReservedAsset(c,{userId:w.user_id,coin:w.coin,network:w.network,amount:reservedAmount,referenceType:'withdrawal',referenceId:w.id,note});
  await c.execute("UPDATE withdrawals SET status='rejected',updated_at=NOW() WHERE id=?",[w.id]);
  await createAuditLog(c,{adminId:req.admin.id,action:'withdrawal_rejected',targetUserId:w.user_id,referenceId:w.id,note});
  await createUserNotification(c,{userId:w.user_id,title:'Withdrawal rejected',message:`${reservedAmount} ${w.coin} reservation was released. ${note}`,type:'security'});
  await c.commit();res.json({success:true,message:'Withdrawal rejected and reserved asset released'});
 }catch(e){await c.rollback();next(e)}finally{c.release()}
});

router.post('/operations/withdrawals/:id/settle',authAdmin,async(req,res,next)=>{
 const c=await pool.getConnection();try{
  const txid=String(req.body.txid||'').trim(),note=String(req.body.note||'Manual treasury settlement');
  if(!txid)throw createError(400,'Actual settlement transaction reference required');await c.beginTransaction();
  const [rows]=await c.execute('SELECT * FROM withdrawals WHERE id=? FOR UPDATE',[Number(req.params.id)]);
  if(!rows.length)throw createError(404,'Withdrawal not found');const w=rows[0];
  if(String(w.status).toLowerCase()!=='settlement_processing')throw createError(409,'Withdrawal must be in settlement_processing before completion');
  const reservedAmount=Number((Number(w.amount)+Number(w.fee_amount||0)).toFixed(18));
  await consumeReservedAsset(c,{userId:w.user_id,coin:w.coin,network:w.network,amount:reservedAmount,referenceType:'withdrawal',referenceId:w.id,note:'Actual settlement reference: '+txid+'; '+note});
  await c.execute("UPDATE withdrawals SET status='completed',txid=?,updated_at=NOW() WHERE id=?",[txid,w.id]);
  await createAuditLog(c,{adminId:req.admin.id,action:'withdrawal_settled',targetUserId:w.user_id,referenceId:w.id,note:`${w.coin}/${w.network}; reference ${txid}`});
  await createUserNotification(c,{userId:w.user_id,title:'Withdrawal completed',message:`Your ${w.coin} withdrawal was settled. Transaction reference: ${txid}`,type:'general'});
  await c.commit();res.json({success:true,message:'Withdrawal settled',data:{id:w.id,status:'completed',txid}});
 }catch(e){await c.rollback();next(e)}finally{c.release()}
});

// Backward-compatible admin endpoints intercept legacy users.balance mutations.
router.post('/admin/users/:id/add-funds',authAdmin,async(req,res,next)=>{
 const c=await pool.getConnection();try{
  const userId=Number(req.params.id),amount=Number(req.body.amount||0),note=String(req.body.note||'').trim();
  if(!Number.isInteger(userId)||userId<=0)throw createError(400,'Invalid user id');if(!Number.isFinite(amount)||amount<=0)throw createError(400,'Invalid amount');
  await c.beginTransaction();const [users]=await c.execute('SELECT id FROM users WHERE id=? FOR UPDATE',[userId]);if(!users.length)throw createError(404,'User not found');
  await creditAssetBalance(c,{userId,coin:'USDT',network:'INTERNAL',amount,referenceType:'admin_credit',referenceId:userId,note:note||`Manual USDT credit by admin ${req.admin.id}`});
  await createTransactionLog(c,{userId,type:'admin_credit',amount,status:'completed',referenceId:userId,note:note||`Manual USDT credit by admin ${req.admin.id}`});
  await createAuditLog(c,{adminId:req.admin.id,action:'add_user_funds_ledger',targetUserId:userId,referenceId:userId,note:note||`Added ${amount} USDT`});
  await createUserNotification(c,{userId,title:'Balance updated',message:`Admin added ${amount} USDT to your available wallet balance.`,type:'general'});
  await c.commit();res.json({success:true,message:'Funds added to USDT asset ledger',data:{coin:'USDT',amount}});
 }catch(e){await c.rollback();next(e)}finally{c.release()}
});

router.post('/admin/users/:id/decrease-funds',authAdmin,async(req,res,next)=>{
 const c=await pool.getConnection();try{
  const userId=Number(req.params.id),amount=Number(req.body.amount||0),note=String(req.body.note||'').trim();
  if(!Number.isInteger(userId)||userId<=0)throw createError(400,'Invalid user id');if(!Number.isFinite(amount)||amount<=0)throw createError(400,'Invalid amount');
  await c.beginTransaction();const [users]=await c.execute('SELECT id FROM users WHERE id=? FOR UPDATE',[userId]);if(!users.length)throw createError(404,'User not found');
  await debitAvailableAsset(c,{userId,coin:'USDT',network:'INTERNAL',amount,referenceType:'admin_debit',referenceId:userId,note:note||`Manual USDT debit by admin ${req.admin.id}`});
  await createTransactionLog(c,{userId,type:'admin_debit',amount,status:'completed',referenceId:userId,note:note||`Manual USDT debit by admin ${req.admin.id}`});
  await createAuditLog(c,{adminId:req.admin.id,action:'decrease_user_funds_ledger',targetUserId:userId,referenceId:userId,note:note||`Decreased ${amount} USDT`});
  await createUserNotification(c,{userId,title:'Balance updated',message:`Admin decreased ${amount} USDT from your available wallet balance.`,type:'security'});
  await c.commit();res.json({success:true,message:'Funds decreased from USDT asset ledger',data:{coin:'USDT',amount}});
 }catch(e){await c.rollback();next(e)}finally{c.release()}
});

router.post('/admin/deposits/:id/approve',authAdmin,async(req,res,next)=>{
 const c=await pool.getConnection();try{
  const depositId=Number(req.params.id),adminNote=String(req.body?.admin_note||req.body?.note||'').trim();await c.beginTransaction();
  const [rows]=await c.execute('SELECT * FROM deposits WHERE id=? FOR UPDATE',[depositId]);if(!rows.length)throw createError(404,'Deposit not found');const d=rows[0];
  if(String(d.status).toLowerCase()!=='pending')throw createError(409,'Deposit already processed');const amount=Number(d.amount||0);if(!Number.isFinite(amount)||amount<=0)throw createError(400,'Invalid deposit amount');
  const coin=String(d.coin||'USDT').trim().toUpperCase(),network=String(d.network||'INTERNAL').trim().toUpperCase();
  await creditAssetBalance(c,{userId:d.user_id,coin,network,amount,referenceType:'deposit',referenceId:d.id,note:adminNote||'Approved by admin'});
  await c.execute("UPDATE deposits SET status='approved',admin_note=?,approved_at=COALESCE(approved_at,NOW()),updated_at=NOW() WHERE id=?",[adminNote||'Approved by admin',depositId]);
  await createTransactionLog(c,{userId:d.user_id,type:'deposit_approved',amount,status:'completed',referenceId:d.id,note:adminNote||`Deposit #${d.id} approved by admin`});
  await createAuditLog(c,{adminId:req.admin.id,action:'approve_deposit_ledger',targetUserId:d.user_id,referenceId:d.id,note:adminNote||`Approved deposit #${d.id}`});
  await createUserNotification(c,{userId:d.user_id,title:'Deposit approved',message:`Your deposit of ${amount} ${coin} has been credited to your wallet.`,type:'general'});
  await c.commit();res.json({success:true,message:'Deposit approved and asset credited'});
 }catch(e){await c.rollback();next(e)}finally{c.release()}
});

// Legacy withdrawal approval is a state transition only; funds were reserved by the user request.
router.post('/admin/withdrawals/:id/approve',authAdmin,async(req,res,next)=>{
 const c=await pool.getConnection();try{
  const withdrawalId=Number(req.params.id),note=String(req.body?.admin_note||req.body?.note||'Settlement authorization approved').trim();await c.beginTransaction();
  const [rows]=await c.execute('SELECT * FROM withdrawals WHERE id=? FOR UPDATE',[withdrawalId]);if(!rows.length)throw createError(404,'Withdrawal not found');const w=rows[0];const status=String(w.status||'').toLowerCase();
  if(status==='pending_settlement'){await c.rollback();return res.json({success:true,message:'Withdrawal already authorized for settlement',data:{id:w.id,status}});}
  if(!['pending','pending_authorization','authorized'].includes(status))throw createError(409,'Withdrawal is not awaiting approval');
  await c.execute("UPDATE withdrawals SET status='pending_settlement',authorization_status='authorized',admin_note=?,updated_at=NOW() WHERE id=?",[note,withdrawalId]);
  await createTransactionLog(c,{userId:w.user_id,type:'withdrawal_authorized',amount:Number(w.amount||0)+Number(w.fee_amount||0),status:'authorized',referenceId:w.id,note});
  await createAuditLog(c,{adminId:req.admin.id,action:'approve_withdrawal_ledger',targetUserId:w.user_id,referenceId:w.id,note});
  await createUserNotification(c,{userId:w.user_id,title:'Withdrawal approved',message:'Your withdrawal is approved and ready for settlement.',type:'general'});
  await c.commit();res.json({success:true,message:'Withdrawal authorized for settlement',data:{id:w.id,status:'pending_settlement'}});
 }catch(e){await c.rollback();next(e)}finally{c.release()}
});

module.exports=router;
