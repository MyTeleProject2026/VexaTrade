const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { authenticator } = require('otplib');

const APP_NAME = 'VexaTrade';
const ENC_ALGO = 'aes-256-gcm';

function key() {
  const raw = process.env.TWO_FACTOR_ENCRYPTION_KEY || '';
  if (!raw) throw new Error('TWO_FACTOR_ENCRYPTION_KEY is required for 2FA');
  const buf = /^[0-9a-f]{64}$/i.test(raw) ? Buffer.from(raw, 'hex') : Buffer.from(raw, 'base64');
  if (buf.length !== 32) throw new Error('TWO_FACTOR_ENCRYPTION_KEY must decode to 32 bytes');
  return buf;
}
function encryptSecret(secret) {
  const iv = crypto.randomBytes(12), cipher = crypto.createCipheriv(ENC_ALGO, key(), iv);
  const encrypted = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString('base64'), tag.toString('base64'), encrypted.toString('base64')].join('.');
}
function decryptSecret(value) {
  const [iv64, tag64, data64] = String(value||'').split('.');
  if (!iv64 || !tag64 || !data64) throw new Error('Invalid encrypted 2FA secret');
  const decipher = crypto.createDecipheriv(ENC_ALGO, key(), Buffer.from(iv64,'base64'));
  decipher.setAuthTag(Buffer.from(tag64,'base64'));
  return Buffer.concat([decipher.update(Buffer.from(data64,'base64')), decipher.final()]).toString('utf8');
}
function generateSetup(label) {
  const secret = authenticator.generateSecret();
  return { secret, otpauthUrl: authenticator.keyuri(String(label||'user'), APP_NAME, secret) };
}
function verifyToken(secret, token) {
  const value = String(token||'').replace(/\s/g,'');
  return /^\d{6}$/.test(value) && authenticator.verify({ token:value, secret });
}
function recoveryCodes(count=8) {
  return Array.from({length:count},()=>crypto.randomBytes(5).toString('hex').toUpperCase().match(/.{1,5}/g).join('-'));
}
async function hashRecoveryCodes(codes) { return Promise.all(codes.map(code=>bcrypt.hash(code,12))); }
async function verifyRecoveryCode(code, hash) { return bcrypt.compare(String(code||'').trim().toUpperCase(), hash); }
module.exports={generateSetup,verifyToken,encryptSecret,decryptSecret,recoveryCodes,hashRecoveryCodes,verifyRecoveryCode};
