# Tether (USD₮) protocol support

Last reviewed: 2026-10-13. This matrix follows Tether's current public [Supported Protocols and Integration Guidelines](https://tether.to/en/supported-protocols/). Re-check that page before enabling deposits, withdrawals, or settlement because supported networks and redemption terms can change.

## Contract supplied for review

The pasted Solidity source is a legacy Solidity 0.4.18 ERC-20-style token implementation with owner-controlled pause, blacklist, issue/redeem, fee parameters, and a deprecated-contract forwarding mechanism. It is useful for understanding the interface, but it is **not enough to establish a deployed contract's identity**.

The pasted creation bytecode appears to encode constructor arguments including name `Tether USD`, symbol `USDT`, decimals `6`, and an initial raw supply of `10,000,000` units (10 tokens at 6 decimals). Those values do not prove that the bytecode is the official Ethereum USD₮ deployment. Never use pasted bytecode or an ABI alone to select a production token address. Verify the network, contract address, verified source, and token metadata against Tether's official page and the relevant explorer.

## Current official USD₮ protocol list vs VexaTrade implementation

| Protocol / network | Official USD₮ identifier from Tether | VexaTrade implementation status |
|---|---|---|
| Ethereum ERC-20 | `0xdAC17F958D2ee523a2206206994597C13D831ec7` | EVM wallet transfer path and token metadata configured |
| TRON TRC-20 | `TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t` | TRON wallet transfer path configured; server-side owner verification is currently limited to TRC-20 |
| Avalanche C-Chain ERC-20 | `0x9702230a8ea53601f5cd2dc00fdbc13d4df4a8c7` | EVM wallet transfer path and token metadata configured |
| Kava EVM ERC-20 | `0x919C1c267BC06a7039e03fcc2eF738525769109c` | EVM wallet transfer path and token metadata configured |
| Celo ERC-20 | `0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e` | EVM wallet transfer path and token metadata configured |
| Kaia ERC-20 | `0xd077a400968890eacc75cdc901f0356c943e4fdb` | EVM wallet transfer path and token metadata configured |
| Liquid Network | USD₮ asset ID: `ce091c998b83c78bb71a632313ba3760f1763d9cfcffae02258ffa9865a37bd2` | Not implemented as a native Liquid asset integration |
| Solana | `Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB` | Not implemented as an SPL-token transfer integration |
| Polkadot AssetHub | Asset ID `1984` | Not implemented as an AssetHub integration |
| Tezos | Contract `KT1XnTn74bUtxHfDtBmm2bGZAQfhPbvKWR8o`, token ID `0` | Not implemented as a Tezos FA token integration |
| NEAR | `usdt.tether-token.near` | Not implemented as a NEAR fungible-token integration |
| TON | `EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs` | Not implemented as a TON Jetton integration |
| Aptos | USD₮ token contract `0xf73e887a8754f540ee6e1a93bdc6dde2af69fc7ca5de32013e89dd44244473cb`; token object asset ID `0x357b0b74bc833e95a115ad22604854d6b0fca151cecd94111770e5d6ffc9dc2b` | Not implemented as an Aptos fungible-asset integration |
| BNB Smart Chain | Current Tether page lists XAU₮, not an official USD₮ contract address | Do not label the configured Binance-Peg token address as an official Tether USD₮ contract without separate authoritative confirmation |
| Polygon | Not listed in Tether's current supported-protocol list | Treat existing configuration as legacy/unconfirmed, not as a currently confirmed Tether-supported integration |

“Configured” means the frontend has a network/token configuration and a user-approved wallet submission path. It does **not** mean the full deposit/withdrawal lifecycle, server-side settlement, confirmations, reconciliation, or production deployment has been verified.

## Legacy / deprecated protocols and assets

Tether's current page says it is no longer issuing or obligated to redeem USD₮ on **Kusama, Bitcoin Cash SLP, Omni Layer, EOS/Vaulta, and Algorand**. The page also lists historical/deprecated integration references for those protocols, as well as **EUR₮ on Ethereum** and **CNH₮ on Ethereum and TRON**. Do not silently present these as currently supported/redeemable USD₮ networks. In particular, Omni USD₮ is identified by property ID `31`; do not treat arbitrary Omni property IDs as Tether USD₮.

## Legacy ERC-20 transfer behavior

Tether documents that its current Ethereum USD₮ contract does not return a Boolean value from `transfer`. A smart contract integrating USD₮ should use OpenZeppelin `SafeERC20` (or equivalent optional-return handling) rather than assuming every ERC-20 returns `true`.

That note applies to **contract-to-contract integrations**. VexaTrade's browser wallet sender submits an EOA transaction and confirms it using the actual transaction hash and on-chain receipt/logs; it must not treat a wallet's successful submission response alone as final settlement.

## Required release checks before enabling a network

- Confirm the exact chain/network and official token identifier from Tether's current support page.
- Confirm token address/asset ID and decimals on the correct explorer; never infer them from the symbol `USDT`.
- For deposits, verify the actual transaction receipt and token transfer event from the configured contract/asset, destination, amount, and required confirmations.
- Keep testnet configurations isolated from mainnet.
- Keep non-EVM protocols disabled until their native wallet, transaction parsing, and server-side verification adapters exist.
- Keep owner settlement fail-closed until independent server-side verification succeeds.
- Do not claim that public address balances prove wallet ownership or an exchange-account balance.

Official reference: https://tether.to/en/supported-protocols/
