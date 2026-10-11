# VexaTrade Transaction Tools

A separately deployable, mobile-first static site for public blockchain lookups, wallet token balance checks, and clearly labeled internal transaction references.

## Deploy on Render
- Service type: **Static Site**
- Repository: `MyTeleProject2026/VexaTrade`
- Branch: `master`
- Root directory: `frontend-transaction-tools`
- Build command: `npm install && npm run build`
- Publish directory: `dist`

## Current capabilities
- Generates internal references explicitly marked as internal IDs, not blockchain transaction hashes.
- Looks up TRON transaction data through the public TronGrid API; public availability and rate limits may vary.
- Reads public USDT TRC20 token balance for a TRON wallet address where provider data is available.
- Explorer shortcuts for TRON, Ethereum, BNB Smart Chain, Bitcoin, and Polygon.
- Simulated receipt preview is marked DEMO and never claims to be an actual payment.
- Does not request or store private keys, seed phrases, exchange passwords, or wallet signing credentials.

## Production boundary
This is a static frontend. It cannot create a real on-chain transaction, authorize transfers, or update VexaTrade customer balances. Those actions require an authenticated backend, validated chain data, duplicate protection, and atomic ledger updates. Never treat a user-entered hash or frontend-generated reference as proof of payment.

## Provider security
The initial live lookup adapter is TRON Mainnet through `https://api.trongrid.io`. For production reliability, use a protected server-side provider proxy. Never ship private API credentials in browser code or frontend environment variables.

## Local development
```bash
npm install
npm run dev
npm run build
```
