# VexaBanks Owner Control System + VexaScan

The Transaction Tools frontend now contains the VexaBanks internal simulated asset system and VexaScan explorer.

## Internal ledger model

- VexaBanks maintains a dedicated internal virtual-asset ledger, separate from VexaTrade's existing external/public-chain adapters and trading ledger.
- Simulated networks include VexaTRON, VexaETH, VexaBNB, VexaSOL, VexaDOGE and VexaAVAX.
- The internal token registry uses `VXB-TOKEN:` identifiers. These are **not** public token contracts or mints.
- Internal account addresses use the `VXB1_` prefix. They are not TRON/EVM/Solana public addresses.
- Internal transactions use `VXB-TX-` IDs and VexaScan blocks use `VXB-BLOCK-` hashes. These are internal records, not public-chain TXIDs or block hashes.
- Simulated deposits move from a system issuance account into the VexaBanks owner HOLD account. Admin approval moves the virtual units to a user's VexaBanks available account; rejection moves them to the internal burn account.
- Simulated withdrawals reserve the user's available units. Admin approval transfers units only between VexaBanks internal accounts; rejection releases the reserve.
- Every ledger transaction writes equal debit and credit journal entries and is included in a SHA-256-linked internal block sequence.

## User platform

The authenticated user route is `/vexabanks`. It displays each user's internal asset balances, available/reserved/hold amounts, generated VexaBanks addresses, deposit requests, withdrawal requests, and VexaScan internal TXIDs.

User deposit and withdrawal requests are internal simulation requests. A deposit is not available to the user until the owner approves it. A withdrawal does not broadcast funds to a public chain.

## Owner control panel

The VexaBanks owner console is the default Transaction Tools workspace. It supports:
- Global VexaBanks ledger overview and account totals.
- Pending virtual deposit and withdrawal review queues.
- Owner HOLD account visibility.
- Per-user VexaBanks account freeze/unfreeze.
- Audited virtual asset issuance for internal testing.
- Internal token/network registry.
- VexaScan transaction, address and block lookup.
- VexaScan internal block-link and double-entry journal verification.

## Market reference prices

The owner console can display public market price references for BTC, ETH, BNB, TRX, SOL, DOGE and AVAX. The source is labeled as public market data. Price references do not create or revalue VexaBanks assets and do not imply public-chain settlement.

## Public-chain reference tools

The existing public network lookup views are separate reference utilities. They do not fund, verify, or settle VexaBanks virtual assets. The VexaBanks owner page does not initiate connected-wallet transfers or public-chain broadcasts.

## Deployment and local development

- Render Static Site root: `frontend-transaction-tools`
- Build: `npm install && npm run build`
- Publish directory: `dist`

```bash
npm install
npm run dev
npm test
npm run build
```

All VexaBanks/VexaScan balances and records are simulated internal data. Do not represent VXB addresses, token references, TXIDs or block hashes as real public blockchain artifacts.
