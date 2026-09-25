const express = require('express');
const router = express.Router();
const pool = require('../../db');
const { authUser, authAdmin } = require('../middleware/auth');
const { transactionSecurity } = require('../middleware/transactionSecurity');
const { createError } = require('../utils/helpers');
const {
  placeDigitalOption,
  listActiveDigitalOptions,
  cashoutDigitalOption,
  getSettings,
  adminOverrideDigitalOption,
} = require('../../services/digitalOptionEngine');

router.get('/digital-options/settings', authUser, async (req,res,next)=>{
  try {
    const connection = await pool.getConnection();
    try {
      const settings = await getSettings(connection);
      res.json({success:true,data:settings});
    } finally { connection.release(); }
  } catch(e){ next(e); }
});

router.post('/digital-options/place', authUser, transactionSecurity('digital-options'), async (req,res,next)=>{
  try {
    const idempotencyKey=String(req.get('Idempotency-Key')||req.body?.idempotencyKey||'').trim();
    if(!idempotencyKey) throw createError(400,'Idempotency-Key is required');
    const trade=await placeDigitalOption({
      userId:req.user.id,
      pair:req.body?.pair,
      direction:req.body?.direction,
      timeframeCode:req.body?.timeframeCode,
      stake:req.body?.stake,
      strikePrice:req.body?.strikePrice,
      idempotencyKey,
    });
    res.status(201).json({success:true,data:trade});
  } catch(e){ next(e); }
});

router.get('/digital-options/history', authUser, async (req,res,next)=>{
  try {
    const [rows] = await pool.execute(
      `SELECT id,asset_pair,direction,entry_spot_price,strike_price,stake_amount,payout_rate,timeframe_code,duration_seconds,created_at,expiration_time,status,settlement_price,payout_amount,settlement_mode,settled_at
       FROM digital_options_trades
       WHERE user_id=?
       ORDER BY created_at DESC
       LIMIT 200`,
      [req.user.id]
    );
    res.json({success:true,data:rows});
  } catch(e){ next(e); }
});

router.get('/digital-options/active', authUser, async (req,res,next)=>{
  try { res.json({success:true,data:await listActiveDigitalOptions(req.user.id)}); } catch(e){ next(e); }
});

router.post('/digital-options/cashout/:id', authUser, transactionSecurity('digital-options-cashout'), async (req,res,next)=>{
  try {
    const id=Number(req.params.id);
    if(!Number.isInteger(id)||id<=0) throw createError(400,'Invalid Digital Option id');
    res.json({success:true,data:await cashoutDigitalOption({userId:req.user.id,tradeId:id})});
  } catch(e){ next(e); }
});

router.get('/admin/digital-options/pending', authAdmin, async (req,res,next)=>{
  try {
    const [rows]=await pool.execute(
      `SELECT t.*,u.email,u.name FROM digital_options_trades t JOIN users u ON u.id=t.user_id WHERE t.status='ACTIVE' ORDER BY t.expiration_time ASC LIMIT 500`
    );
    res.json({success:true,data:rows});
  } catch(e){ next(e); }
});

router.get('/admin/digital-options/settings', authAdmin, async (req,res,next)=>{
  try {
    const [rows]=await pool.execute('SELECT setting_key,setting_value,status,updated_by,updated_at FROM digital_options_settings ORDER BY setting_key');
    res.json({success:true,data:rows});
  } catch(e){ next(e); }
});

router.put('/admin/digital-options/settings', authAdmin, async (req,res,next)=>{
  const connection=await pool.getConnection();
  try {
    await connection.beginTransaction();
    const allowed=['enabled','payout_rate','platform_spread_fee','risk_free_rate','implied_volatility','max_stake_usdt','cashout_enabled','auto_settlement_enabled','manual_outcome_override','supported_pairs'];
    for(const key of allowed){
      if(req.body?.[key]===undefined) continue;
      let value=req.body[key];
      if(['enabled','cashout_enabled','auto_settlement_enabled','manual_outcome_override'].includes(key)) value=value?'true':'false';
      else if(['payout_rate','platform_spread_fee','risk_free_rate','implied_volatility','max_stake_usdt'].includes(key)) {
        value=String(Number(value));
        if(!Number.isFinite(Number(value))) throw createError(400,`Invalid setting: ${key}`);
      } else value=String(value);
      await connection.execute(
        'INSERT INTO digital_options_settings(setting_key,setting_value,status,updated_by,updated_at) VALUES (?,?,\'active\',?,NOW()) ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value),updated_by=VALUES(updated_by),updated_at=NOW()',
        [key,value,req.admin.id]
      );
    }
    await connection.commit();
    res.json({success:true,message:'Digital Options settings updated'});
  }catch(e){try{await connection.rollback();}catch(_){}next(e);}finally{connection.release();}
});

router.post('/admin/digital-options/override', authAdmin, async (req,res,next)=>{
  try {
    const tradeId=Number(req.body?.tradeId);
    if(!Number.isInteger(tradeId)||tradeId<=0) throw createError(400,'Invalid trade id');
    const data=await adminOverrideDigitalOption({
      adminId:req.admin.id,tradeId,outcome:req.body?.outcome,note:req.body?.note
    });
    res.json({success:true,data});
  }catch(e){next(e);}
});

module.exports=router;