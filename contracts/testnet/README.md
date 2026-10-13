# VexaUSD Test Token (testnet only)

This contract is a transparent test asset for developing and QA-testing VexaTrade transfer screens.

- Token name: `VexaUSD Test Token`
- Symbol: `vUSD-TEST`
- Decimals: 6
- Intended environment: public EVM testnets only (for example, Sepolia)
- No real-world value; not issued by Tether; not USDT; not redeemable.
- Minting is restricted to the deployer/owner and is for testnet demonstrations.
- Never display this token as USDt/USDT, a real deposit, a confirmed payment, or an exchange account balance.
- A testnet transaction hash is genuine evidence of a testnet transaction only. It is not a mainnet payment proof.
- Mainnet transactions still require a real funded sender wallet, gas, user authorization, broadcast, and chain receipt verification.

## Deployment

1. Deploy `VexaUSDTestToken.sol` to an EVM testnet using a wallet you control and explicitly select the test network.
2. Keep the deployer's signing keys in the wallet; never paste private keys or seed phrases into VexaTrade or chat.
3. Call `mintTestTokens(recipient, amountInSmallestUnits)` from the deployer account.
4. Verify the contract address and transaction hash in that testnet's explorer.
5. Add the token to a wallet only with the testnet selected. Wallet display support varies; centralized exchanges generally do not credit arbitrary test tokens.

## Status semantics for the app

- `Draft`: local request only, no chain transaction.
- `Awaiting funding`: sender lacks token or gas; no TXID.
- `Awaiting wallet approval`: not broadcast; no TXID.
- `Pending on testnet`: broadcast and a real testnet TXID exists.
- `Confirmed on testnet`: receipt and configured confirmation threshold verified.
- `Failed`: chain reports failure or verification fails.

Do not fabricate transaction hashes. A TXID is obtained only after a real transaction is signed and broadcast by the chain/network.
