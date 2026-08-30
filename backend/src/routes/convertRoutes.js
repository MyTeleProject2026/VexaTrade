// backend/src/routes/convertRoutes.js
const express=require('express');
const router=express.Router();
const crypto=require('crypto');
const pool=require('../../db');
const {authUser}=require('../middleware/auth');
const {createError,getSupportedConvertCoins,createTransactionLog,createUserNotification}=require('../utils/helpers');
const {getBinancePrice}=require('../../services/tradeService');
const {debitAvailableAsset,creditAssetBalance}=require('../../services/assetLedgerService');

const getIdempotencyKey=req=>String(req.get('Idempotency-Key')||req.body.idempotencyKey||'').trim().slice(0,128);
const requestHash=(fromCoin,toCoin,fromAmount)=>crypto.createHash('sha256').update(`${fromCoin}|${toCoin}|${fromAmount}`).digest('hex');

router.post('/convert/execute',authUser,async(req,res,next)=>{const c=await pool.getConnection();try{
 const fromCoin=String(req.body.fromCoin||'').trim().toUpperCase(),toCoin=String(req.body.toCoin||'').trim().toUpperCase(),fromAmount=Number(req.body.fromAmount||0),idempotencyKey=getIdempotencyKey(req);
 const supported=getSupportedConvertCoins(); if(!fromCoin||!toCoin||fromCoin===toCoin)throw createError(400,'Invalid coin selection'); if(!supported.includes(fromCoin)||!supported.includes(toCoin))throw createError(400,'Unsupported coin'); if(!Number.isFinite(fromAmount)||fromAmount<=0)throw createError(400,'Invalid amount');
 const hash=requestHash(fromCoin,toCoin,fromAmount); await c.beginTransaction();
 if(idempotencyKey){const [existing]=await c.execute('SELECT id,from_coin,to_coin,from_amount,from_price_usdt,to_price_usdt,gross_usdt_value,fee_percent,fee_usdt,net_usdt_value,receive_amount,status FROM convert_transactions WHERE user_id=? AND idempotency_key=? LIMIT 1 FOR UPDATE',[req.user.id,idempotencyKey]);if(existing.length){await c.commit();return res.json({success:true,message:'Existing conversion returned',data:{id:existing[0].id,fromCoin:existing[0].from_coin,toCoin:existing[0].to_coin,fromAmount:existing[0].from_amount,fromPriceUsdt:existing[0].from_price_usdt,toPriceUsdt:existing[0].to_price_usdt,grossUsdtValue:existing[0].gross_usdt_value,feePercent:existing[0].fee_percent,feeUsdt:existing[0].fee_usdt,netUsdtValue:existing[0].net_usdt_value,receiveAmount:existing[0].receive_amount,replayed:true,status:existing[0].status}})}}
 let feePct=.2;const [sr]=await c.execute("SELECT setting_value FROM platform_settings WHERE setting_key='default_convert_fee_percent' LIMIT 1");if(sr.length)feePct=Number(sr[0].setting_value||.2);
 const fp=fromCoin==='USDT'?1:Number(await getBinancePrice(`${fromCoin}USDT`)),tp=toCoin==='USDT'?1:Number(await getBinancePrice(`${toCoin}USDT`));if(!fp||!tp)throw createError(400,'Price unavailable');
 const gross=Number((fromAmount*fp).toFixed(8)),fee=Number((gross*feePct/100).toFixed(8)),net=Number((gross-fee).toFixed(8)),receive=Number((net/tp).toFixed(8));if(receive<=0)throw createError(400,'Invalid receive amount');
 const [u]=await c.execute('SELECT id,status FROM users WHERE id=? FOR UPDATE',[req.user.id]);if(!u.length)throw createError(404,'User not found');if(['disabled','frozen'].includes(String(u[0].status||'').toLowerCase()))throw createError(403,'User not active');
 const [result]=await c.execute(`INSERT INTO convert_transactions(user_id,from_coin,to_coin,from_amount,from_price_usdt,to_price_usdt,gross_usdt_value,fee_percent,fee_usdt,net_usdt_value,receive_amount,status,idempotency_key,request_hash,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,'completed',?,?,NOW(),NOW())`,[req.user.id,fromCoin,toCoin,fromAmount,fp,tp,gross,feePct,fee,net,receive,idempotencyKey||null,hash]);
 await debitAvailableAsset(c,{userId:req.user.id,coin:fromCoin,network:'INTERNAL',amount:fromAmount,referenceType:'convert',referenceId:result.insertId,note:`Convert ${fromCoin} to ${toCoin}`});
 await creditAssetBalance(c,{userId:req.user.id,coin:toCoin,network:'INTERNAL',amount:receive,referenceType:'convert',referenceId:result.insertId,note:`Converted ${fromCoin} to ${toCoin}`});
 await createTransactionLog(c,{userId:req.user.id,type:'convert',amount:gross,status:'completed',referenceId:result.insertId,note:`Converted ${fromAmount} ${fromCoin} to ${receive} ${toCoin}`});
 await createUserNotification(c,{userId:req.user.id,title:'Convert completed',message:`Converted ${fromAmount} ${fromCoin} to ${receive} ${toCoin}. Fee: ${fee} USDT.`,type:'funds'});await c.commit();
 res.json({success:true,message:'Conversion completed',data:{id:result.insertId,fromCoin,toCoin,fromAmount,fromPriceUsdt:fp,toPriceUsdt:tp,grossUsdtValue:gross,feePercent:feePct,feeUsdt:fee,netUsdtValue:net,receiveAmount:receive,status:'completed'}});
}catch(e){await c.rollback();next(e)}finally{c.release()}});
router.get('/convert/history',authUser,async(req,res,next)=>{try{const [rows]=await pool.execute('SELECT * FROM convert_transactions WHERE user_id=? ORDER BY id DESC LIMIT 200',[req.user.id]);res.json({success:true,data:rows})}catch(e){next(e)}});
module.exports=router;