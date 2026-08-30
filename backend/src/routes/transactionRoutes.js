// backend/src/routes/transactionRoutes.js
const express=require('express');
const router=express.Router();
const pool=require('../../db');
const {authUser}=require('../middleware/auth');

const safeLimit=(value,max=100)=>Math.min(Math.max(Number.parseInt(value,10)||50,1),max);
const normalizeRows=(rows,type)=>rows.map(row=>({...row,type,amount:Number(row.amount||0),coin:row.coin||row.currency||'USDT',network:row.network||'INTERNAL',date:row.date||row.created_at}));

router.get('/transactions',authUser,async(req,res,next)=>{try{
 const userId=req.user.id, type=String(req.query.type||'all'),limit=safeLimit(req.query.limit),offset=Math.max(Number.parseInt(req.query.offset,10)||0,0);
 const [deposits,withdrawals,trades,transfers,funds,converts]=await Promise.all([
  pool.execute("SELECT id,amount,coin,network,status,created_at,date,txid AS reference,'Deposit' description FROM deposits WHERE user_id=? ORDER BY created_at DESC LIMIT 100",[userId]).then(x=>x[0]),
  pool.execute("SELECT id,amount,coin,network,status,created_at,txid AS reference,'Withdrawal' description FROM withdrawals WHERE user_id=? ORDER BY created_at DESC LIMIT 100",[userId]).then(x=>x[0]),
  pool.execute("SELECT id,amount,'USDT' coin,'INTERNAL' network,status,result,entry_price,exit_price,payout_percent,created_at,'Trade' description FROM trades WHERE user_id=? ORDER BY created_at DESC LIMIT 100",[userId]).then(x=>x[0]),
  pool.execute(`SELECT ut.id,ut.amount,ut.currency coin,'INTERNAL' network,ut.status,ut.created_at,ut.note reference,CASE WHEN ut.sender_id=? THEN CONCAT('Transfer sent to ',r.uid) ELSE CONCAT('Transfer received from ',s.uid) END description FROM user_transfers ut LEFT JOIN users s ON s.id=ut.sender_id LEFT JOIN users r ON r.id=ut.receiver_id WHERE ut.sender_id=? OR ut.receiver_id=? ORDER BY ut.created_at DESC LIMIT 100`,[userId,userId,userId]).then(x=>x[0]),
  pool.execute("SELECT id,amount,'USDT' coin,'INTERNAL' network,status,plan_name,created_at,CONCAT('Fund Plan: ',plan_name) description FROM user_funds WHERE user_id=? ORDER BY created_at DESC LIMIT 100",[userId]).then(x=>x[0]),
  pool.execute("SELECT id,from_amount amount,from_coin coin,'INTERNAL' network,status,to_coin,receive_amount,fee_usdt,fee_percent,created_at,CONCAT('Converted ',from_coin,' to ',to_coin) description FROM convert_transactions WHERE user_id=? ORDER BY created_at DESC LIMIT 100",[userId]).then(x=>x[0])
 ]);
 let all=[...normalizeRows(deposits,'deposit'),...normalizeRows(withdrawals,'withdrawal'),...normalizeRows(trades,'trade'),...normalizeRows(transfers,'transfer'),...normalizeRows(funds,'fund'),...normalizeRows(converts,'convert')];
 if(type!=='all')all=all.filter(x=>x.type===type||(type==='funds'&&x.type==='fund'));
 all.sort((a,b)=>new Date(b.created_at||b.date||0)-new Date(a.created_at||a.date||0));
 const total=all.length,transactions=all.slice(offset,offset+limit);
 res.json({success:true,data:transactions,pagination:{total,limit,offset},counts:{total,deposit:deposits.length,withdrawal:withdrawals.length,trade:trades.length,transfer:transfers.length,fund:funds.length,convert:converts.length}});
}catch(e){next(e)}});

router.get('/transactions/summary',authUser,async(req,res,next)=>{try{
 const userId=req.user.id;
 const [[depositTotal],[withdrawalTotal],[tradeTotal],[pendingDeposits],[pendingWithdrawals]]=await Promise.all([
  pool.execute("SELECT COALESCE(SUM(amount),0) total FROM deposits WHERE user_id=? AND status IN ('completed','approved')",[userId]).then(x=>x[0]),
  pool.execute("SELECT COALESCE(SUM(amount),0) total FROM withdrawals WHERE user_id=? AND status='completed'",[userId]).then(x=>x[0]),
  pool.execute("SELECT COALESCE(SUM(amount),0) total FROM trades WHERE user_id=? AND status='completed'",[userId]).then(x=>x[0]),
  pool.execute("SELECT COUNT(*) count FROM deposits WHERE user_id=? AND status='pending'",[userId]).then(x=>x[0]),
  pool.execute("SELECT COUNT(*) count FROM withdrawals WHERE user_id=? AND status IN ('pending_joint_authorization','pending_settlement','settlement_processing')",[userId]).then(x=>x[0])
 ]);
 res.json({success:true,data:{totals:{deposits:Number(depositTotal.total||0),withdrawals:Number(withdrawalTotal.total||0),trades:Number(tradeTotal.total||0)},pending:{deposits:Number(pendingDeposits.count||0),withdrawals:Number(pendingWithdrawals.count||0)}}});
}catch(e){next(e)}});

module.exports=router;
