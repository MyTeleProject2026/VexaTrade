# Deposit verification configuration

VexaTrade credits an external deposit only after a server-side verifier confirms the
transaction on the relevant mainnet. A screenshot, user-supplied destination address,
or transaction hash by itself is never sufficient.

## Supported approval pairs

- USDT / TRC20 (or legacy TRON network label): existing TRON solidified-node verifier.
- USDT / ERC20: Ethereum Mainnet USDT contract and confirmed Transfer logs.
- ETH or ETHEREUM / ETH: successful Ethereum Mainnet native-value transfer.

Other asset/network combinations remain blocked until a dedicated verifier is
implemented and tested.

## Ethereum Mainnet configuration

Set the following backend environment variables on the API deployment:

- `ETHEREUM_RPC_URL`: HTTPS JSON-RPC endpoint connected to Ethereum Mainnet.
- `ETHEREUM_MIN_CONFIRMATIONS`: optional positive integer; defaults to 12.

The verifier checks `eth_chainId` and fails closed unless it is Ethereum Mainnet
(chain ID 1). The ERC20 verifier is pinned to the official Ethereum Mainnet USDT
contract and the ERC20 Transfer event. The native ETH verifier checks the actual
transaction destination and exact wei value. Both require a successful mined receipt
and the configured confirmation threshold.

Do not configure an RPC endpoint for a test network. Do not enable ERC20 or ETH
deposit networks in the admin UI until the matching active treasury address is
configured and the API deployment has the Mainnet RPC setting.

## Approval lifecycle

1. The user submits a deposit request with the transaction hash and selected network.
2. The admin review page can run a read-only chain verification.
3. The approve endpoint always repeats verification; a prior UI check is not trusted.
4. The backend locks the pending deposit row, claims the transaction hash uniquely,
   credits the asset ledger, updates the deposit, writes audit/transaction records,
   and notifies the user in one database transaction.
5. Duplicate transaction claims or already-processed requests are rejected.

The backend deployment must run the updated code before the new verification endpoint
is available. No existing deposit is automatically approved by this change.
