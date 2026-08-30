const express=require('express');
const router=express.Router();
const pool=require('../../db');
const {authAdmin}=require('../middleware/auth');
const {createError,createTransactionLog,createUserNotification,createAuditLog}=require('../utils/helpers');
const {creditAssetBalance,releaseReservedAsset,consumeReservedAsset}=require('../../services/assetLedgerService');

router.post('/operations/deposits/:id/approve',authAdmin,async(req,res,next)=>{
 const c=await pool.getConnection();
 try{
  await c.beginTransaction();
  const [rows]=await c.execute('SELECT * FROM deposits WHERE id=? FOR UPDATE',[Number(req.params.id)]);
  if(!rows.length)throw createError(404,'Deposit not found');
  const d=rows[0]; if(String(d.status).toLowerCase()!=='pending')throw createError(409,'Deposit is no longer pending');
  await c.execute("UPDATE deposits SET status='approved', approved_at=NOW() WHERE id=?",[d.id]);
  await creditAssetBalance(c,{userId:d.user_id,coin:d.coin,network:d.network,amount:Number(d.amount),referenceType:'deposit',referenceId:d.id,note:'Approved deposit credit'});
  await createTransactionLog(c,{userId:d.user_id,type:'deposit',amount:Number(d.amount),status:'completed',referenceId:d.id,note:`${d.coin}/${d.network} deposit approved`});
  await createAuditLog(c,{adminId:req.admin.id,action:'deposit_approved',targetUserId:d.user_id,referenceId:d.id,note:`${d.amount} ${d.coin}/${d.network}`});
  await createUserNotification(c,{userId:d.user_id,title:'Deposit approved',message:`${d.amount} ${d.coin} is now available in your wallet.`,type:'general'});
  await c.commit();res.json({success:true,message:'Deposit approved and asset credited'});
 }catch(e){await c.rollback();next(e)}finally{c.release()}
});

router.post('/operations/deposits/:id/reject',authAdmin,async(req,res,next)=>{
 const c=await pool.getConnection();try{
  const note=String(req.body.note||'Deposit rejected');
  await c.beginTransaction();
  const [rows]=await c.execute('SELECT * FROM deposits WHERE id=? FOR UPDATE',[Number(req.params.id)]);
  if(!rows.length)throw createError(404,'Deposit not found');const d=rows[0];
  if(String(d.status).toLowerCase()!=='pending')throw createError(409,'Deposit is no longer pending');
  await c.execute("UPDATE deposits SET status='rejected' WHERE id=?",[d.id]);
  await createAuditLog(c,{adminId:req.admin.id,action:'deposit_rejected',targetUserId:d.user_id,referenceId:d.id,note});
  await createUserNotification(c,{userId:d.user_id,title:'Deposit request update',message:note,type:'security'});
  await c.commit();res.json({success:true,message:'Deposit rejected'});
 }catch(e){await c.rollback();next(e)}finally{c.release()}
});

router.post('/operations/withdrawals/:id/reject',authAdmin,async(req,res,next)=>{
 const c=await pool.getConnection();try{
  const note=String(req.body.note||'Withdrawal rejected');
  await c.beginTransaction();
  const [rows]=await c.execute('SELECT * FROM withdrawals WHERE id=? FOR UPDATE',[Number(req.params.id)]);
  if(!rows.length)throw createError(404,'Withdrawal not found');const w=rows[0];
  if(!['pending_authorization','pending','authorized'].includes(String(w.status).toLowerCase()))throw createError(409,'Withdrawal cannot be rejected');
  const reservedAmount=Number(w.amount)+Number(w.fee_amount||0);
  await releaseReservedAsset(c,{userId:w.user_id,coin:w.coin,network:w.network,amount:reservedAmount,referenceType:'withdrawal',referenceId:w.id,note});
  await c.execute("UPDATE withdrawals SET status='rejected', updated_at=NOW() WHERE id=?",[w.id]);
  await createAuditLog(c,{adminId:req.admin.id,action:'withdrawal_rejected',targetUserId:w.user_id,referenceId:w.id,note});
  await createUserNotification(c,{userId:w.user_id,title:'Withdrawal rejected',message:`${reservedAmount} ${w.coin} reservation was released. ${note}`,type:'security'});
  await c.commit();res.json({success:true,message:'Withdrawal rejected and reserved asset released'});
 }catch(e){await c.rollback();next(e)}finally{c.release()}
});

router.post('/operations/withdrawals/:id/settle',authAdmin,async(req,res,next)=>{
 const c=await pool.getConnection();try{
  const txid=String(req.body.txid||'').trim(), note=String(req.body.note||'Manual treasury settlement');
  if(!txid)throw createError(400,'Actual settlement transaction reference required');
  await c.beginTransaction();
  const [rows]=await c.execute('SELECT * FROM withdrawals WHERE id=? FOR UPDATE',[Number(req.params.id)]);
  if(!rows.length)throw createError(404,'Withdrawal not found');const w=rows[0];
  if(String(w.status).toLowerCase()!=='settlement_processing')throw createError(409,'Withdrawal must be in settlement_processing before completion');
  const reservedAmount=Number(w.amount)+Number(w.fee_amount||0);
  await consumeReservedAsset(c,{userId:w.user_id,coin:w.coin,network:w.network,amount:reservedAmount,referenceType:'withdrawal',referenceId:w.id,note:'Actual settlement reference: '+txid+'; '+note});
  await c.execute("UPDATE withdrawals SET status='completed', txid=?, updated_at=NOW() WHERE id=?",[txid,w.id]);
  await createAuditLog(c,{adminId:req.admin.id,action:'withdrawal_settled',targetUserId:w.user_id,referenceId:w.id,note:`${w.coin}/${w.network}; reference ${txid}`});
  await createUserNotification(c,{userId:w.user_id,title:'Withdrawal completed',message:`Your ${w.coin} withdrawal was settled. Transaction reference: ${txid}`,type:'general'});
  await c.commit();res.json({success:true,message:'Withdrawal settled',data:{id:w.id,status:'completed',txid}});
 }catch(e){await c.rollback();next(e)}finally{c.release()}
});

module.exports=router;