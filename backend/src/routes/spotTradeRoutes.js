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
  const [profiles]=await pool.execute("SELECT id,name FROM spot_trade_settlement_profiles WHERE status='active' ORDER BY id DESC LIMIT 1");
  const activeSettlementProfile=profiles[0]||null;
  res.json({success:true,data:{tradingEnabled:settings.trading_enabled!=="false",maxOrderUsdt:Number(settings.max_order_usdt||100000),minOrderUsdt:Number(settings.min_order_usdt||10),maxSlippageBps:Number(settings.max_slippage_bps||100),tradingFeeBps:Number(settings.trading_fee_bps||0),quoteTtlSeconds:Number(settings.quote_ttl_seconds||15),maxOrdersPerDay:Number(settings.max_orders_per_day||0),buyEnabled:settings.buy_enabled!=="false",sellEnabled:settings.sell_enabled!=="false",maintenanceMessage:String(settings.maintenance_message||""),supportedOrderTypes:["market"],supportedPairs:String(settings.supported_pairs||"BTCUSDT,ETHUSDT,SOLUSDT,BNBUSDT,XRPUSDT,DOGEUSDT,ADAUSDT,AVAXUSDT,LINKUSDT").split(",").map(v=>v.trim().toUpperCase()).filter(Boolean),settlementModel:String(settings.settlement_model||"market_execution"),settlementPriceSource:String(settings.settlement_price_source||"binance_public_market"),settlementReceiptRequired:settings.settlement_receipt_required!=="false",pnlEnabled:settings.pnl_enabled!=="false",pnlReference:String(settings.pnl_reference||"live_market"),pnlRefreshSeconds:Number(settings.pnl_refresh_seconds||5),realizedPnlOnSell:settings.realized_pnl_on_sell!=="false",winThresholdBps:Number(settings.win_threshold_bps||1),lossThresholdBps:Number(settings.loss_threshold_bps||1),manualOutcomeOverride:false,activeSettlementProfile}});
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
  const cfg=Object.fromEntries(settings.map(r=>[r.setting_key,r.setting_value]));
  if(cfg.trading_enabled==="false")throw createError(403,cfg.maintenance_message||"Spot trading is temporarily disabled");
  if(String(cfg.settlement_model||"market_execution")!=="market_execution")throw createError(503,"Spot settlement policy is unavailable");
  if(String(cfg.settlement_price_source||"binance_public_market")!=="binance_public_market")throw createError(503,"Spot market price source is unavailable");
  if(String(cfg.settlement_receipt_required||"true")!=="true")throw createError(503,"Spot settlement receipts are required");
  const supportedPairs=String(cfg.supported_pairs||"BTCUSDT,ETHUSDT,SOLUSDT,BNBUSDT,XRPUSDT,DOGEUSDT,ADAUSDT,AVAXUSDT,LINKUSDT").split(",").map(v=>v.trim().toUpperCase()).filter(Boolean); if(!supportedPairs.includes(symbol))throw createError(400,"This trading pair is not currently enabled"); if(side==="buy"&&cfg.buy_enabled==="false")throw createError(403,"Buy orders are currently disabled"); if(side==="sell"&&cfg.sell_enabled==="false")throw createError(403,"Sell orders are currently disabled"); const price=await getBinancePrice(symbol); if(!Number.isFinite(price)||price<=0)throw createError(503,"Live market price is unavailable. Please try again.");
  const quoteAmount=quantity*price,max=Number(cfg.max_order_usdt||100000),winThresholdBps=Number(cfg.win_threshold_bps||1),lossThresholdBps=Number(cfg.loss_threshold_bps||1),min=Number(cfg.min_order_usdt||10),slippageBps=Number(cfg.max_slippage_bps||100),feeBps=Math.max(0,Number(cfg.trading_fee_bps||0)),quoteTtl=Number(cfg.quote_ttl_seconds||15);
  if(quoteAmount<min)throw createError(400,`Order is below the current ${min} USDT minimum`);
  if(quoteAmount>max)throw createError(400,`Order exceeds the current ${max} USDT maximum`);
  if(Number.isFinite(requestedPrice)&&requestedPrice>0){
    const deviationBps=Math.abs(price-requestedPrice)/requestedPrice*10000;
    if(deviationBps>slippageBps)throw createError(409,`Market price moved beyond the allowed ${slippageBps} bps limit. Review the order again.`);
  }
  if(Number(req.body.quoteAgeSeconds||0)>quoteTtl)throw createError(409,"The review quote expired. Please review the order again."); if(Number(cfg.max_orders_per_day||0)>0){const [daily]=await db.execute("SELECT COUNT(*) AS count FROM spot_orders WHERE user_id=? AND created_at>=CURDATE() FOR UPDATE",[req.user.id]);if(Number(daily[0]?.count||0)>=Number(cfg.max_orders_per_day))throw createError(429,"Your daily Spot order limit has been reached.");} const feeAmount=quoteAmount*feeBps/10000; const base=symbol.endsWith("USDT")?symbol.slice(0,-4):""; if(!base)throw createError(400,"Unsupported quote asset");
  const usdt=await ensureAssetRow(db,req.user.id,"USDT"),baseAsset=await ensureAssetRow(db,req.user.id,base);
  // Create the canonical order record before ledger movement so every financial
  // ledger entry has a concrete, auditable spot_order reference.
  const [pendingOrder]=await db.execute(
   `INSERT INTO spot_orders(user_id,symbol,side,order_type,quantity,requested_price,status,idempotency_key,request_hash,created_at,updated_at)
    VALUES(?,?,?,?,?,?, 'pending', ?, ?, NOW(), NOW())`,
   [req.user.id,symbol,side,type,quantity,Number.isFinite(requestedPrice)&&requestedPrice>0?requestedPrice:null,idempotencyKey,requestHash]
  );
  const spotOrderId=pendingOrder.insertId;
  let realizedPnl=null,realizedPnlPct=null,outcome=null;
  if(side==="buy"){
   if(Number(usdt.available_balance)<quoteAmount+feeAmount)throw createError(400,"Insufficient USDT available balance including trading fee");
   const [usdtDebit]=await db.execute("UPDATE user_assets SET available_balance=available_balance-? WHERE user_id=? AND coin='USDT' AND available_balance>=?",[quoteAmount+feeAmount,req.user.id,quoteAmount+feeAmount]); if(usdtDebit.affectedRows!==1)throw createError(400,"Insufficient USDT available balance including trading fee");
   const oldBaseBalance=Number(baseAsset.available_balance||0),oldAvgPrice=Number(baseAsset.avg_price||0);
   const newBaseBalance=oldBaseBalance+quantity;
   const newAvgPrice=newBaseBalance>0?((oldBaseBalance*oldAvgPrice)+(quantity*price))/newBaseBalance:price;
   const [baseCredit]=await db.execute("UPDATE user_assets SET available_balance=?,avg_price=? WHERE user_id=? AND coin=?",[newBaseBalance,newAvgPrice,req.user.id,base]); if(baseCredit.affectedRows!==1)throw createError(409,`Unable to credit ${base} spot balance`);
   await syncTotal(db,req.user.id,"USDT");await syncTotal(db,req.user.id,base);
   await recordLedger(db,{userId:req.user.id,coin:"USDT",network:"INTERNAL",bucket:"available",entryType:"spot_buy_debit",amount:quoteAmount+feeAmount,referenceType:"spot_order",referenceId:spotOrderId,note:`${symbol} market buy`});
   await recordLedger(db,{userId:req.user.id,coin:base,network:"INTERNAL",bucket:"available",entryType:"spot_buy_credit",amount:quantity,referenceType:"spot_order",note:`${symbol} market buy`}); if(feeAmount>0)await recordLedger(db,{userId:req.user.id,coin:"USDT",network:"INTERNAL",bucket:"available",entryType:"spot_trading_fee",amount:feeAmount,referenceType:"spot_order",referenceId:spotOrderId,note:`${symbol} trading fee`});
  }else{
   if(Number(baseAsset.available_balance)<quantity)throw createError(400,`Insufficient ${base} available balance`);
   const costBasisPrice=Number(baseAsset.avg_price||0);
   realizedPnl=(costBasisPrice>0&&cfg.realized_pnl_on_sell!=="false")?((price-costBasisPrice)*quantity-feeAmount):null;
   realizedPnlPct=(costBasisPrice>0&&realizedPnl!==null)?(realizedPnl/(costBasisPrice*quantity))*100:null;
   const pnlBps=(costBasisPrice>0&&realizedPnl!==null)?(realizedPnl/(costBasisPrice*quantity))*10000:0;
   outcome=realizedPnl===null?null:(pnlBps>=winThresholdBps?"win":pnlBps<=-lossThresholdBps?"loss":"breakeven");
   const [baseDebit]=await db.execute("UPDATE user_assets SET available_balance=available_balance-?,avg_price=CASE WHEN available_balance-? <= 0 THEN 0 ELSE avg_price END WHERE user_id=? AND coin=? AND available_balance>=?",[quantity,quantity,req.user.id,base,quantity]); if(baseDebit.affectedRows!==1)throw createError(400,`Insufficient ${base} available balance`);
   const [usdtCredit]=await db.execute("UPDATE user_assets SET available_balance=available_balance+? WHERE user_id=? AND coin='USDT'",[quoteAmount-feeAmount,req.user.id]); if(usdtCredit.affectedRows!==1)throw createError(409,"Unable to credit USDT spot balance");
   await syncTotal(db,req.user.id,base);await syncTotal(db,req.user.id,"USDT");
   await recordLedger(db,{userId:req.user.id,coin:base,network:"INTERNAL",bucket:"available",entryType:"spot_sell_debit",amount:quantity,referenceType:"spot_order",referenceId:spotOrderId,note:`${symbol} market sell`});
   await recordLedger(db,{userId:req.user.id,coin:"USDT",network:"INTERNAL",bucket:"available",entryType:"spot_sell_credit",amount:quoteAmount-feeAmount,referenceType:"spot_order",note:`${symbol} market sell`}); if(feeAmount>0)await recordLedger(db,{userId:req.user.id,coin:"USDT",network:"INTERNAL",bucket:"available",entryType:"spot_trading_fee",amount:feeAmount,referenceType:"spot_order",note:`${symbol} trading fee`});
  }
  const [result]=await db.execute(
   `UPDATE spot_orders SET execution_price=?,quote_amount=?,status='filled',cost_basis_price=?,realized_pnl=?,realized_pnl_pct=?,outcome=?,filled_at=NOW(),updated_at=NOW() WHERE id=? AND status='pending'`,
   [price,quoteAmount,side==='sell'?(Number(baseAsset.avg_price||0)||null):null,side==='sell'?realizedPnl:null,side==='sell'?realizedPnlPct:null,side==='sell'?outcome:null,spotOrderId]
  );
  if(result.affectedRows!==1)throw createError(409,"Unable to finalize spot order");
  await createTransactionLog(db,{userId:req.user.id,type:side==="buy"?"spot_buy":"spot_sell",amount:quoteAmount,status:"completed",referenceId:spotOrderId,note:`${symbol} ${side} market order filled at ${price}`});
  await db.commit();res.json({success:true,message:"Spot order filled",data:{orderId:spotOrderId,symbol,side,orderType:type,quantity,executionPrice:price,quoteAmount,feeAmount,feeBps,costBasisPrice:side==='sell'?(Number(baseAsset.avg_price||0)||null):null,realizedPnl:side==='sell'?realizedPnl:null,realizedPnlPct:side==='sell'?realizedPnlPct:null,outcome:side==='sell'?outcome:null,status:"filled",filledAt:new Date().toISOString()}});
 }catch(e){try{await db.rollback()}catch(_){}next(e)}finally{db.release()}
});
module.exports=router;