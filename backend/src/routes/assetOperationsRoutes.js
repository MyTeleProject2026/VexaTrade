const express = require('express');
const router = express.Router();
const pool = require('../../db');
const { authAdmin } = require('../middleware/auth');
const { createError, createTransactionLog, createUserNotification, createAuditLog } = require('../utils/helpers');
const { creditAssetBalance, debitAvailableAsset } = require('../../services/assetLedgerService');

router.post('/operations/users/:id/assets/credit', authAdmin, async (req,res,next)=>{
  const connection=await pool.getConnection();
  try{
    const userId=Number(req.params.id), amount=Number(req.body.amount||0);
    const coin=String(req.body.coin||'USDT').trim().toUpperCase();
    const network=String(req.body.network||'INTERNAL').trim().toUpperCase();
    const note=String(req.body.note||'').trim();
    if(!Number.isInteger(userId)||userId<=0) throw createError(400,'Invalid user id');
    if(!coin||!network||!Number.isFinite(amount)||amount<=0) throw createError(400,'Coin, network and positive amount required');
    await connection.beginTransaction();
    const [users]=await connection.execute('SELECT id FROM users WHERE id=? FOR UPDATE',[userId]);
    if(!users.length) throw createError(404,'User not found');
    await creditAssetBalance(connection,{userId,coin,network,amount,referenceType:'operations_credit',referenceId:userId,note:note||'Ecosystem asset credit'});
    await createTransactionLog(connection,{userId,type:'ecosystem_asset_credit',amount,status:'completed',referenceId:userId,note:`${coin}/${network}: ${note||'Ecosystem asset credit'}`});
    await createAuditLog(connection,{adminId:req.admin.id,action:'ecosystem_asset_credit',targetUserId:userId,referenceId:userId,note:`${coin} ${network} +${amount}; ${note}`});
    await createUserNotification(connection,{userId,title:'Asset balance updated',message:`${amount} ${coin} was credited to your available balance.`,type:'general'});
    await connection.commit();
    res.json({success:true,message:'Asset credited',data:{userId,coin,network,amount}});
  }catch(e){await connection.rollback();next(e)}finally{connection.release()}
});

router.post('/operations/users/:id/assets/debit', authAdmin, async (req,res,next)=>{
  const connection=await pool.getConnection();
  try{
    const userId=Number(req.params.id), amount=Number(req.body.amount||0);
    const coin=String(req.body.coin||'USDT').trim().toUpperCase();
    const network=String(req.body.network||'INTERNAL').trim().toUpperCase();
    const note=String(req.body.note||'').trim();
    if(!Number.isInteger(userId)||userId<=0) throw createError(400,'Invalid user id');
    if(!coin||!network||!Number.isFinite(amount)||amount<=0) throw createError(400,'Coin, network and positive amount required');
    await connection.beginTransaction();
    const [users]=await connection.execute('SELECT id FROM users WHERE id=? FOR UPDATE',[userId]);
    if(!users.length) throw createError(404,'User not found');
    await debitAvailableAsset(connection,{userId,coin,network,amount,referenceType:'operations_debit',referenceId:userId,note:note||'Ecosystem asset debit'});
    await createTransactionLog(connection,{userId,type:'ecosystem_asset_debit',amount,status:'completed',referenceId:userId,note:`${coin}/${network}: ${note||'Ecosystem asset debit'}`});
    await createAuditLog(connection,{adminId:req.admin.id,action:'ecosystem_asset_debit',targetUserId:userId,referenceId:userId,note:`${coin} ${network} -${amount}; ${note}`});
    await createUserNotification(connection,{userId,title:'Asset balance updated',message:`${amount} ${coin} was removed from your available balance.`,type:'security'});
    await connection.commit();
    res.json({success:true,message:'Asset debited',data:{userId,coin,network,amount}});
  }catch(e){await connection.rollback();next(e)}finally{connection.release()}
});

router.get('/operations/users/:id/assets',authAdmin,async(req,res,next)=>{try{
  const userId=Number(req.params.id);
  const [rows]=await pool.execute('SELECT coin,balance,available_balance,reserved_balance,pending_balance,avg_price FROM user_assets WHERE user_id=? ORDER BY coin',[userId]);
  res.json({success:true,data:rows});
}catch(e){next(e)}});

module.exports=router;
