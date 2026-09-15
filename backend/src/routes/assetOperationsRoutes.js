const express = require('express');
const router = express.Router();
const pool = require('../../db');
const { authAdmin } = require('../middleware/auth');
const { createError, createTransactionLog, createUserNotification, createAuditLog } = require('../utils/helpers');
const { creditAssetBalance, debitAvailableAsset } = require('../../services/assetLedgerService');

let assetColumnsCache = null;
let assetColumnsCacheAt = 0;

async function getAssetColumns() {
  const now = Date.now();
  if (assetColumnsCache && now - assetColumnsCacheAt < 60000) return assetColumnsCache;
  try {
    const [rows] = await pool.query('SHOW COLUMNS FROM user_assets');
    assetColumnsCache = new Set(rows.map((row) => String(row.Field || row.field || '')));
  } catch (_) {
    assetColumnsCache = new Set();
  }
  assetColumnsCacheAt = now;
  return assetColumnsCache;
}

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
  }catch(e){try{await connection.rollback()}catch(_){} next(e)}finally{connection.release()}
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
  }catch(e){try{await connection.rollback()}catch(_){} next(e)}finally{connection.release()}
});

router.get('/operations/users/:id/assets',authAdmin,async(req,res,next)=>{
  try{
    const userId=Number(req.params.id);
    if(!Number.isInteger(userId)||userId<=0) throw createError(400,'Invalid user id');
    const columns=await getAssetColumns();
    if(!columns.has('coin')) throw createError(503,'Asset ledger is not available on this deployment');

    const selectable=['coin'];
    for(const column of ['balance','available_balance','reserved_balance','pending_balance','avg_price','updated_at']){
      if(columns.has(column)) selectable.push(column);
    }
    const [rows]=await pool.execute(
      `SELECT ${selectable.join(', ')} FROM user_assets WHERE user_id=? ORDER BY coin`,
      [userId]
    );
    const data=rows.map((row)=>({
      ...row,
      balance:Number(row.balance||0),
      available_balance:Number(row.available_balance ?? row.balance ?? 0),
      reserved_balance:Number(row.reserved_balance||0),
      pending_balance:Number(row.pending_balance||0),
      avg_price:Number(row.avg_price||0),
    }));
    res.json({success:true,data});
  }catch(e){next(e)}
});

module.exports=router;
