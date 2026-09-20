// Static financial contract guard. No production calls and no data mutation.
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const contracts = [
  ['Trade','src/routes/tradeRoutes.js','/trades/place',false],
  ['Deposit','src/routes/depositRoutes.js','/deposits/request',true],
  ['Withdraw','src/routes/withdrawalRoutes.js','/withdrawals/request',true],
  ['Convert','src/routes/convertRoutes.js','/convert/execute',true],
  ['Transfer','src/routes/transferRoutes.js','/user/transfer',true],
  ['Funds','src/routes/fundsRoutes.js','/funds/apply',true],
  ['Loan','src/routes/loanRoutes.js','/loans/apply',true],
  ['Profit Withdrawal','src/routes/profitWithdrawalRoutes.js','/withdraw/profit-request',true],
];
for (const [label,file,route,secure] of contracts) {
  const source = read(file);
  if (!source.includes(route)) throw new Error(`[${label}] missing route ${route}`);
  if (!source.includes('authUser')) throw new Error(`[${label}] authUser middleware missing`);
  if (secure && !source.includes('transactionSecurity(')) throw new Error(`[${label}] transaction-security gate missing`);
  if (label !== 'Trade' && !source.includes('Idempotency-Key')) throw new Error(`[${label}] idempotency contract missing`);
}
const spot=read('src/routes/spotTradeRoutes.js');
for (const route of ['/spot/settings','/spot/orders']) if (!spot.includes(route)) throw new Error('[Spot] missing route '+route);
if (!spot.includes('transactionSecurity("spot-trade")') && !spot.includes("transactionSecurity('spot-trade')")) throw new Error('[Spot] transaction-security gate missing');
if (!spot.includes('Idempotency-Key')) throw new Error('[Spot] idempotency contract missing');
if (!spot.includes('getBinancePrice')) throw new Error('[Spot] live market price source missing');
if (!spot.includes('spot_buy_debit') || !spot.includes('spot_sell_debit')) throw new Error('[Spot] asset-ledger settlement missing');
if (spot.includes('manualOutcomeOverride') && spot.includes('manualOutcomeOverride=true')) throw new Error('[Spot] manual outcome override must remain disabled');
if (!spot.includes('realized_pnl') || !spot.includes('outcome')) throw new Error('[Spot] realized P/L outcome settlement missing');

const trade=read('src/routes/tradeRoutes.js');
if (trade.includes("transactionSecurity('trade')")) throw new Error('[Trade] secure transaction gate must remain removed');
if (!trade.includes('requestedEntryPrice') || !trade.includes('entryPrice')) throw new Error('[Trade] live clicked entry-price contract missing');
const ledger=read('services/assetLedgerService.js');
for (const fn of ['debitAvailableAsset','creditAssetBalance','reserveAssetBalance','moveAvailableToPending']) if (!ledger.includes(fn)) throw new Error(`[Ledger] missing ${fn}`);
const security=read('src/routes/securityRoutes.js');
for (const route of ['/user/2fa/setup','/user/2fa/enable','/user/2fa/verify','/user/2fa/recovery','/user/2fa/recovery/regenerate','/user/2fa/disable']) if (!security.includes(route)) throw new Error(`[2FA] missing ${route}`);
const email=read('services/emailService.js');
if (!email.includes('sendOtpEmail') || !email.includes('sendPasswordResetEmail')) throw new Error('[Email] delivery functions missing');
const server=read('server.js');
for (const route of ['tradeRoutes','depositRoutes','withdrawalRoutes','convertRoutes','transferRoutes','fundsRoutes','loanRoutes','profitWithdrawalRoutes','walletRoutes','supportRoutes','chatRoutes']) if (!server.includes(route)) throw new Error(`[Server] route wiring missing: ${route}`);
const admin=read('src/routes/adminControlCenterRoutes.js');
for (const control of ['support','assets','assetLedger','loans']) if (!admin.includes(control)) throw new Error(`[Admin] control surface missing: ${control}`);
const userApi=fs.readFileSync(path.join(root,'../frontend-user/src/services/api.js'),'utf8');
for (const apiRoute of ['/api/spot/orders','/api/deposits/request','/api/withdrawals/request','/api/convert/execute','/api/user/transfer','/api/funds/apply','/api/loans/apply','/api/withdraw/profit-request','/api/transactions']) if (!userApi.includes(apiRoute)) throw new Error(`[Frontend API] missing ${apiRoute}`);
console.log('VexaTrade financial contract validation passed.');
