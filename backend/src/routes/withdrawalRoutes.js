// backend/src/routes/withdrawalRoutes.js
const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const router = express.Router();
const pool = require('../../db');
const { authUser } = require('../middleware/auth');
const { createError, createTransactionLog, createUserNotification } = require('../utils/helpers');
const { getWithdrawalFeeConfig, calculateWithdrawalFee } = require('../../services/tradeService');
const { reserveAssetBalance } = require('../../services/assetLedgerService');
const { verifyToken, decryptSecret } = require('../../services/twoFactorService');
const { sendOtpEmail } = require('../../services/emailService');

const otpHash = value => crypto.createHash('sha256').update(String(value)).digest('hex');
const otpCode = () => String(crypto.randomInt(0,1000000)).padStart(6,'0');

async function verifyTransactionPasscode(connection,userId,supplied){
 const passcode=String(supplied||'').trim();if(!/^\d{4,12}$/.test(passcode))return false;
 const [rows]=await connection.execute('SELECT passcode FROM users WHERE id=? LIMIT 1',[userId]);
 if(!rows.length||!rows[0].passcode)return false;const stored=String(rows[0].passcode);
 if(stored.startsWith('$2'))return bcrypt.compare(passcode,stored);return false;
}
async function verifyTwoFactor(connection,userId,token){
 const [rows]=await connection.execute('SELECT secret_encrypted,enabled FROM user_two_factor WHERE user_id=? LIMIT 1',[userId]);
 if(!rows.length||!Number(rows[0].enabled))return {required:false,verified:true};
 return {required:true,verified:verifyToken(decryptSecret(rows[0].secret_encrypted),token)};
}
async function jointPartner(connection,userId){
 const [u]=await connection.execute('SELECT uid FROM users WHERE id=?',[userId]);if(!u.length)return null;
 const [j]=await connection.execute("SELECT * FROM joint_accounts WHERE (user1_uid=? OR user2_uid=?) AND status='active' LIMIT 1",[u[0].uid,u[0].uid]);
 if(!j.length)return null;const partnerUid=j[0].user1_uid===u[0].uid?j[0].user2_uid:j[0].user1_uid;
 const [p]=await connection.execute('SELECT id,email,name,uid,email_verified FROM users WHERE uid=? LIMIT 1',[partnerUid]);
 return p.length?p[0]:null;
}

router.post('/withdrawals/request',authUser,async(req,res,next)=>{
 const connection=await pool.getConnection();
 try{
  const coin=String(req.body.coin||'').trim().toUpperCase(),network=String(req.body.network||'').trim().toUpperCase(),address=String(req.body.wallet_address||req.body.address||'').trim(),amount=Number(req.body.amount||0);
  if(!coin||!network||!address||!Number.isFinite(amount)||amount<=0)throw createError(400,'Coin, network, address and positive amount are required');
  await connection.beginTransaction();
  const [users]=await connection.execute('SELECT id,status FROM users WHERE id=? FOR UPDATE',[req.user.id]);if(!users.length)throw createError(404,'User not found');
  if(['disabled','frozen'].includes(String(users[0].status||'').toLowerCase()))throw createError(403,'User account not active');
  if(!await verifyTransactionPasscode(connection,req.user.id,req.body.transactionPasscode??req.body.passcode))throw createError(401,'Valid transaction passcode required');
  const twofa=await verifyTwoFactor(connection,req.user.id,req.body.twoFactorCode??req.body.twofaCode);
  if(twofa.required&&!twofa.verified)throw createError(401,'Valid authenticator code required');
  const feeConfig=await getWithdrawalFeeConfig(connection,coin,network),feeAmount=calculateWithdrawalFee(amount,feeConfig),feeType=String(feeConfig?.fee_type||'fixed').toLowerCase();
  const totalDeduction=Number((amount+feeAmount).toFixed(18)),netAmount=Number(Math.max(0,amount-(feeType==='percent'?amount*Number(feeConfig?.fee_amount||0)/100:Number(feeConfig?.fee_amount||0))).toFixed(18));
  const partner=await jointPartner(connection,req.user.id);
  const status=partner?'pending_joint_authorization':'pending_settlement';
  const [result]=await connection.execute(`INSERT INTO withdrawals (user_id,coin,network,address,amount,fee_amount,fee_type,net_amount,status,authorization_status,two_factor_verified_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,NOW(),NOW())`,[req.user.id,coin,network,address,amount,feeAmount,feeType,netAmount,status,partner?'joint_required':'authorized',twofa.required?new Date():null]);
  await reserveAssetBalance(connection,{userId:req.user.id,coin,network,amount:totalDeduction,referenceType:'withdrawal',referenceId:result.insertId,note:`${coin} ${network} withdrawal reservation`});
  if(partner){
   if(!Number(partner.email_verified))throw createError(400,'Joint account partner must have a verified email');
   const code=otpCode(),expiresAt=new Date(Date.now()+10*60*1000);
   const [auth]=await connection.execute(`INSERT INTO joint_withdrawal_authorizations(withdrawal_id,requesting_user_id,required_user_id,otp_hash,expires_at,created_at,updated_at) VALUES(?,?,?,?,?,NOW(),NOW())`,[result.insertId,req.user.id,partner.id,otpHash(code),expiresAt]);
   await connection.execute('UPDATE withdrawals SET joint_authorization_id=? WHERE id=?',[auth.insertId,result.insertId]);
   await connection.commit();
   const delivered=await sendOtpEmail({to:partner.email,code,purpose:'joint withdrawal authorization'});
   if(!delivered){await pool.execute("UPDATE withdrawals SET status='authorization_delivery_failed',authorization_status='delivery_failed',updated_at=NOW() WHERE id=?",[result.insertId]);return res.status(503).json({success:false,message:'Joint authorization code could not be delivered. Reserved funds remain protected until cancellation.'});}
   await createUserNotification(pool,{userId:partner.id,title:'Joint Withdrawal Authorization Required',message:`A joint account withdrawal requires your authorization. Check your verified email for the one-time code.`,type:'security'});
   return res.json({success:true,message:'Withdrawal requires joint account authorization',data:{id:result.insertId,status:'pending_joint_authorization',authorization:'joint_partner_email_otp',coin,network,amount,feeAmount,netAmount,totalDeduction}});
  }
  await createTransactionLog(connection,{userId:req.user.id,type:'withdrawal_request',amount:totalDeduction,status:'authorized',referenceId:result.insertId,note:`${coin} ${network} withdrawal authorized; asset reserved`});
  await connection.commit();
  res.json({success:true,message:'Withdrawal authorized for settlement',data:{id:result.insertId,status:'pending_settlement',authorization:'complete',coin,network,amount,feeAmount,netAmount,totalDeduction,settlement:'manual_treasury'}});
 }catch(error){await connection.rollback();next(error)}finally{connection.release()}
});

router.post('/withdrawals/:id/joint-authorize',authUser,async(req,res,next)=>{
 const connection=await pool.getConnection();
 try{
  const withdrawalId=Number(req.params.id),code=String(req.body.code||'').trim();if(!Number.isInteger(withdrawalId)||withdrawalId<=0||!/^\d{6}$/.test(code))throw createError(400,'Valid withdrawal ID and 6-digit code required');
  await connection.beginTransaction();
  const [rows]=await connection.execute(`SELECT jwa.*,w.user_id,w.status,w.coin,w.network,w.amount FROM joint_withdrawal_authorizations jwa JOIN withdrawals w ON w.id=jwa.withdrawal_id WHERE jwa.withdrawal_id=? FOR UPDATE`,[withdrawalId]);
  if(!rows.length)throw createError(404,'Joint authorization not found');const auth=rows[0];
  if(auth.required_user_id!==req.user.id)throw createError(403,'Only the other joint account holder can authorize this withdrawal');
  if(auth.consumed_at||auth.verified_at)throw createError(400,'Authorization already used');
  if(new Date(auth.expires_at).getTime()<Date.now())throw createError(400,'Authorization code expired');
  if(Number(auth.attempts)>=5)throw createError(429,'Too many authorization attempts');
  if(otpHash(code)!==auth.otp_hash){await connection.execute('UPDATE joint_withdrawal_authorizations SET attempts=attempts+1,updated_at=NOW() WHERE id=?',[auth.id]);throw createError(401,'Invalid authorization code');}
  await connection.execute('UPDATE joint_withdrawal_authorizations SET verified_at=NOW(),consumed_at=NOW(),updated_at=NOW() WHERE id=?',[auth.id]);
  await connection.execute("UPDATE withdrawals SET status='pending_settlement',authorization_status='authorized',updated_at=NOW() WHERE id=?",[withdrawalId]);
  await createTransactionLog(connection,{userId:auth.user_id,type:'withdrawal_joint_authorized',amount:auth.amount,status:'authorized',referenceId:withdrawalId,note:`${auth.coin} ${auth.network} withdrawal authorized by joint account holder`});
  await createUserNotification(connection,{userId:auth.user_id,title:'Joint Withdrawal Authorized',message:'Your joint account holder authorized the withdrawal. It is ready for settlement.',type:'security'});
  await connection.commit();res.json({success:true,message:'Joint withdrawal authorized',data:{id:withdrawalId,status:'pending_settlement'}});
 }catch(error){await connection.rollback();next(error)}finally{connection.release()}
});

router.get('/withdrawals/pending-joint-authorizations',authUser,async(req,res,next)=>{try{const [rows]=await pool.execute('SELECT w.id,w.coin,w.network,w.address,w.amount,w.fee_amount,w.net_amount,w.status,w.created_at,jwa.expires_at,jwa.attempts FROM joint_withdrawal_authorizations jwa JOIN withdrawals w ON w.id=jwa.withdrawal_id WHERE jwa.required_user_id=? AND jwa.verified_at IS NULL AND jwa.consumed_at IS NULL AND jwa.expires_at>NOW() ORDER BY w.id DESC',[req.user.id]);res.json({success:true,data:rows})}catch(error){next(error)}});

router.get('/withdrawals',authUser,async(req,res,next)=>{try{const [rows]=await pool.execute('SELECT * FROM withdrawals WHERE user_id=? ORDER BY id DESC',[req.user.id]);res.json({success:true,data:rows})}catch(error){next(error)}});
module.exports=router;