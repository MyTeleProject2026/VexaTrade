const express = require("express");
const crypto = require("crypto");
const router = express.Router();
const pool = require("../../db");
const { authUser } = require("../middleware/auth");
const { createError, createTransactionLog } = require("../utils/helpers");
const { getBinancePrice } = require("../../services/tradeService");
const { ensureAssetRow, syncTotal, recordLedger } = require("../../services/assetLedgerService");
const { transactionSecurity } = require("../middleware/transactionSecurity");

const keyOf = req => String(req.get("Idempotency-Key") || req.body?.idempotencyKey || "").trim().slice(0,128);
const hashOf = (symbol,side,type,quantity,price) => crypto.createHash("sha256").update([symbol,side,type,quantity,price||""].join("|")).digest("hex");

router.get("/spot/settings",authUser,async(req,res,next)=>{
 try{
  const [rows]=await pool.execute("SELECT setting_key,setting_value FROM spot_trade_settings WHERE status='active'");
  const settings=Object.fromEntries(rows.map(r=>[r.setting_key,r.setting_value]));
  res.json({success:true,data:{tradingEnabled:settings.trading_enabled!=="false",maxOrderUsdt:Number(settings.max_order_usdt||100000),minOrderUsdt:Number(settings.min_order_usdt||10),maxSlippageBps:Number(settings.max_slippage_bps||100),supportedOrderTypes:["market"],supportedPairs:["BTCUSDT","ETHUSDT","SOLUSDT","BNBUSDT","XRPUSDT","DOGEUSDT","ADAUSDT","AVAXUSDT","LINKUSDT"]}});
 }catch(e){next(e)}
});
router.get("/spot/orders",authUser,async(req,res,next)=>{
 try{const [rows]=await pool.execute("SELECT * FROM spot_orders WHERE user_id=? ORDER BY id DESC LIMIT 200",[req.user.id]);res.json({success:true,data:rows})}catch(e){next(e)}
});
router.post("/spot/orders",authUser,transactionSecurity("spot-trade"),async(req,res,next)=>{
 const db=await pool.getConnection();
 try{
  const symbol=String(req.body.symbol||"").trim().toUpperCase(),side=String(req.body.side||"").trim().toLowerCase(),type=String(req.body.orderType||"market").trim().toLowerCase(),quantity=Number(req.body.quantity),requestedPrice=Number(req.body.price),idempotencyKey=keyOf(req);
  if(!/^[A-Z0-9]{6,24}$/.test(symbol))throw createError(400,"Invalid trading pair");
  if(!["buy","sell"].includes(side))throw createError(400,"Side must be buy or sell");
  if(type!=="market")throw createError(400,"Only market orders are currently enabled");
  if(!Number.isFinite(quantity)||quantity<=0)throw createError(400,"Invalid quantity");
  if(!idempotencyKey)throw createError(400,"Idempotency-Key is required");
  const requestHash=hashOf(symbol,side,type,quantity,requestedPrice); await db.beginTransaction();
  const [existing]=await db.execute("SELECT * FROM spot_orders WHERE user_id=? AND idempotency_key=? LIMIT 1 FOR UPDATE",[req.user.id,idempotencyKey]);
  if(existing.length){if(existing[0].request_hash!==requestHash)throw createError(409,"Idempotency-Key was already used for a different spot order");await db.commit();return res.json({success:true,message:"Existing spot order returned",data:{...existing[0],replayed:true}})}
  const [settings]=await db.execute("SELECT setting_key,setting_value FROM spot_trade_settings WHERE status='active'");
  const cfg=Object.fromEntries(settings.map(r=>[r.setting_key,r.setting_value])); if(cfg.trading_enabled==="false")throw createError(403,"Spot trading is temporarily disabled");
  const price=await getBinancePrice(symbol); if(!Number.isFinite(price)||price<=0)throw createError(503,"Live market price is unavailable. Please try again.");
  const quoteAmount=quantity*price,max=Number(cfg.max_order_usdt||100000),min=Number(cfg.min_order_usdt||10),slippageBps=Number(cfg.max_slippage_bps||100);
  if(quoteAmount<min)throw createError(400,`Order is below the current ${min} USDT minimum`);
  if(quoteAmount>max)throw createError(400,`Order exceeds the current ${max} USDT maximum`);
  if(Number.isFinite(requestedPrice)&&requestedPrice>0){
    const deviationBps=Math.abs(price-requestedPrice)/requestedPrice*10000;
    if(deviationBps>slippageBps)throw createError(409,`Market price moved beyond the allowed ${slippageBps} bps limit. Review the order again.`);
  }
  const base=symbol.endsWith("USDT")?symbol.slice(0,-4):""; if(!base)throw createError(400,"Unsupported quote asset");
  const usdt=await ensureAssetRow(db,req.user.id,"USDT"),baseAsset=await ensureAssetRow(db,req.user.id,base);
  if(side==="buy"){
   if(Number(usdt.available_balance)<quoteAmount)throw createError(400,"Insufficient USDT available balance");
   await db.execute("UPDATE user_assets SET available_balance=available_balance-? WHERE user_id=? AND coin='USDT' AND available_balance>=?",[quoteAmount,req.user.id,quoteAmount]);
   await db.execute("UPDATE user_assets SET available_balance=available_balance+? WHERE user_id=? AND coin=?",[quantity,req.user.id,base]);
   await syncTotal(db,req.user.id,"USDT");await syncTotal(db,req.user.id,base);
   await recordLedger(db,{userId:req.user.id,coin:"USDT",network:"INTERNAL",bucket:"available",entryType:"spot_buy_debit",amount:quoteAmount,referenceType:"spot_order",note:`${symbol} market buy`});
   await recordLedger(db,{userId:req.user.id,coin:base,network:"INTERNAL",bucket:"available",entryType:"spot_buy_credit",amount:quantity,referenceType:"spot_order",note:`${symbol} market buy`});
  }else{
   if(Number(baseAsset.available_balance)<quantity)throw createError(400,`Insufficient ${base} available balance`);
   await db.execute("UPDATE user_assets SET available_balance=available_balance-? WHERE user_id=? AND coin=? AND available_balance>=?",[quantity,req.user.id,base,quantity]);
   await db.execute("UPDATE user_assets SET available_balance=available_balance+? WHERE user_id=? AND coin='USDT'",[quoteAmount,req.user.id]);
   await syncTotal(db,req.user.id,base);await syncTotal(db,req.user.id,"USDT");
   await recordLedger(db,{userId:req.user.id,coin:base,network:"INTERNAL",bucket:"available",entryType:"spot_sell_debit",amount:quantity,referenceType:"spot_order",note:`${symbol} market sell`});
   await recordLedger(db,{userId:req.user.id,coin:"USDT",network:"INTERNAL",bucket:"available",entryType:"spot_sell_credit",amount:quoteAmount,referenceType:"spot_order",note:`${symbol} market sell`});
  }
  const [result]=await db.execute(`INSERT INTO spot_orders(user_id,symbol,side,order_type,quantity,requested_price,execution_price,quote_amount,status,idempotency_key,request_hash,filled_at) VALUES(?,?,?,?,?,?,?,?, 'filled',?,?,NOW())`,[req.user.id,symbol,side,type,quantity,Number.isFinite(requestedPrice)&&requestedPrice>0?requestedPrice:null,price,quoteAmount,idempotencyKey,requestHash]);
  await createTransactionLog(db,{userId:req.user.id,type:side==="buy"?"spot_buy":"spot_sell",amount:quoteAmount,status:"completed",referenceId:result.insertId,note:`${symbol} ${side} market order filled at ${price}`});
  await db.commit();res.json({success:true,message:"Spot order filled",data:{orderId:result.insertId,symbol,side,orderType:type,quantity,executionPrice:price,quoteAmount,status:"filled",filledAt:new Date().toISOString()}});
 }catch(e){try{await db.rollback()}catch(_){}next(e)}finally{db.release()}
});
module.exports=router;