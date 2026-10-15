# VexaTrade TRON testnet token integration (VDEMO)

## Purpose and safety boundary

`VexaDemoTRC20.sol` is a transparent test token for exercising wallet connection, TRC-20-compatible transfers, TXID capture, explorer lookup, confirmation tracking, and owner review on **TRON Nile testnet only**.

- Name: `Vexa Demo Token`
- Symbol: `VDEMO`
- Decimals: 6
- No real-world value, not redeemable, not issued by Tether, and not USDT.
- Owner-only minting with a fixed maximum supply; owner can pause transfers.
- Do not market or display VDEMO as USDt/USDT, a real deposit, payment proof, or an exchange account balance.

A custom token contract cannot make counterfeit USDT appear as real USDT in unrelated wallets or centralized exchange accounts. Exchanges independently monitor their own deposit addresses and decide which assets to credit. A transaction hash exists only after a real signed transaction is broadcast. An internal VexaTrade reference is never a TXID.

## Testnet deployment and QA

1. Use a dedicated testnet wallet. Do not use a treasury or mainnet key.
2. Compile `VexaDemoTRC20.sol` with Solidity 0.8.20 or a compatible compiler.
3. Deploy to TRON Nile testnet using a trusted TRON-compatible development tool.
4. Obtain testnet TRX from a public/official testnet faucet for deployment and transaction fees.
5. Verify the contract on the applicable TRON testnet explorer.
6. Configure the app with the deployed contract address and explicitly show **TRON NILE TESTNET · VDEMO · NO REAL VALUE**.
7. Mint test tokens to test addresses, then perform transfers that are signed and approved by the test wallet.
8. Capture the actual testnet TXID returned after broadcast. Independently query the correct testnet and verify the contract, destination, amount, receipt, and confirmation threshold.

## Status semantics

- `Draft`: internal request only; no chain transaction and no TXID.
- `Awaiting funding`: sender lacks tokens or network fee; no TXID.
- `Awaiting wallet approval`: user has not signed/broadcast; no TXID.
- `Broadcast`: signed transaction submitted; TXID recorded.
- `Pending confirmations`: transaction is found on the correct network but the confirmation threshold is not met.
- `Confirmed`: successful receipt, expected token transfer event, correct recipient and amount, and required confirmations are verified.
- `Failed`: transaction reverted or verification failed.
- `Owner reviewed`: a separate internal review flag; it does not change blockchain finality or unlock third-party funds.

## Mainnet production rules

- Never deploy or present this demo token as official USDT.
- Real USDT TRC-20 transfers require the official token contract, a sender that actually holds sufficient USDT, sufficient TRX/network resources, and explicit signing authorization.
- The app cannot bypass the sender's balance or fees. If funds or fees are insufficient, remain blocked/awaiting funding and do not fabricate a TXID.
- Owner review can update VexaTrade's own workflow status only. It cannot freeze, hold, or unlock funds in an unrelated wallet or exchange.
- A public deposit address exposes on-chain transfers, not an exchange's private main-account balance. Exchange crediting is controlled by that exchange; private account balances require the account owner's authorized API integration.
- Never collect seed phrases or private keys in the web app. Keep any production signer in an audited, access-controlled signing service.

## Acceptance checks

- Reject wrong network and wrong token contract.
- Always show network and contract address.
- Never label an internal reference as a TXID.
- TXID appears only after actual broadcast.
- Pending status is derived from an observed on-chain transaction.
- Confirmation checks receipt status, expected token transfer event, recipient, amount, and confirmation count.
- A failed/reverted transaction never credits an internal ledger.
- Testnet token balances are clearly labeled as having no real value.
