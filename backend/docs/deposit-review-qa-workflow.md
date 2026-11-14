# Deposit review QA workflow (non-monetary)

## Purpose

This document defines a safe, isolated workflow for exercising the administrator's deposit-review interface with synthetic evidence. It is for internal software QA only. It does not authorize or implement crediting real assets, accepting historical receipts as proof of funds, or enabling withdrawals.

## Scope boundary

- Use synthetic fixture records and clearly synthetic transaction identifiers.
- Keep QA records in a test-only store or test database that cannot write to production deposit, asset-ledger, transaction, withdrawal, or user-balance tables.
- Do not call production settlement functions such as `approveDeposit`, `creditAssetBalance`, or any route that changes a user's asset balance.
- Do not treat an uploaded image, a manually entered transaction hash, or an admin decision as proof that an on-chain transfer occurred.
- Do not make a QA record eligible for withdrawal, transfer, trading stake, or any other spendable operation.
- Never mix QA fixtures with live pending deposits. A visible QA label and environment-level separation are required.

## QA-only state model

1. `pending_review`: a synthetic fixture has been created and awaits an admin review.
2. `evidence_reviewed`: an admin has inspected the fixture's attached sample evidence. This is an administrative review result only; it is not chain verification and has no monetary effect.
3. `rejected`: the fixture was rejected, with a required reason.
4. `duplicate_flagged`: the fixture's synthetic identifier matches another fixture in the QA namespace; it remains non-monetary and cannot be approved as a deposit.

There is intentionally no `credited`, `settled`, or `withdrawable` state in this QA workflow.

## Required audit fields

Every review action should record:

- QA fixture ID (not a production deposit ID)
- actor/admin ID
- previous and next QA state
- action timestamp
- reason or review note
- synthetic evidence reference
- environment marker identifying the QA store

Audit records must not contain passwords, session tokens, OTPs, private keys, or other secrets.

## Synthetic test cases

- A pending fixture can be opened and marked `evidence_reviewed`; no asset balance changes.
- A pending fixture can be rejected only with a non-empty reason.
- Reusing a synthetic transaction identifier flags a duplicate in the QA namespace.
- A fixture marked `evidence_reviewed` cannot be represented as chain-verified or credited.
- Requests to invoke production approval, ledger-credit, withdrawal, or settlement code from the QA workflow are rejected.
- QA records are not returned by production deposit or user-balance APIs.

## ERC20 receipt currently awaiting review

A USDT/ERC20 submission must remain pending unless the production backend has a genuine, independently verified Ethereum/ERC20 deposit-verification implementation for the configured token contract and destination wallet. The existing USDT/TRON-only approval path must not be reused for ERC20 and must not be weakened to accept manual evidence.

For a real network verifier, implementation review must separately establish chain ID, token contract address, destination address, transaction success, token-transfer event, exact token amount/decimals, confirmation/finality policy, and duplicate transaction/log protection. Until those checks are implemented and tested, the record remains uncredited.

## Acceptance criteria

- QA actions are visibly and persistently labeled as non-monetary.
- QA storage is isolated from production financial tables and APIs.
- No QA action invokes a production ledger-credit or settlement function.
- Duplicate detection and review audit history are covered by automated tests.
- Production deposit approval remains fail-closed for unsupported asset/network pairs.
