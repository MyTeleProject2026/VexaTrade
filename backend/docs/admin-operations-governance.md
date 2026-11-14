# VexaTrade admin operations and user-control requirements

This document records the platform-wide operating rule: **user requests and platform capabilities are subject to explicit administrator review and control**. It is a product and engineering requirement, not a claim that every module already has a complete admin control screen.

## 1. Financial request review

The admin console must provide searchable queues and individual detail views for:

- Deposits: review evidence, verify supported on-chain transfers, approve or reject with a reason, and view the resulting ledger entry.
- Withdrawals: review eligibility, available/reserved balances, destination, fees and risk checks; approve or reject; and track settlement separately from approval.
- Profit withdrawals and other payout requests: approve, reject, hold, or request clarification, with a clear status history.
- Other balance-affecting requests (internal transfers, funding/credit requests, refunds, adjustments): expose an explicit review workflow where the feature is enabled.

No user request should be silently marked completed. Approval, rejection, hold, cancellation, and actual settlement are distinct states and actions.

## 2. Financial integrity rules

- A deposit approval must use a supported server-side chain verifier. A screenshot, user-entered TXID, admin note, or UI verification result alone is not proof of payment.
- A withdrawal approval authorizes the request; it does not claim that an external transfer has been sent. Settlement requires a configured payout process and independent receipt evidence.
- Rejection/cancellation must release any reserved funds exactly once and in the same database transaction as the status change.
- Every balance movement must use the asset ledger; do not edit displayed balances directly.
- Use idempotency, row locking, duplicate-reference protection, and rollback-safe database transactions.
- Never bypass identity, security, legal, or compliance requirements through a generic admin override. Any permitted exception must be explicit, authorized, reasoned, and auditable.

## 3. User and feature controls

The admin console should support both platform-wide and per-user controls for each enabled module, including (as applicable):

- Account access: activate, suspend, restrict, or restore a user.
- Deposits and withdrawals: enable/disable requests, set limits, pause a network, and control review requirements.
- Transfers, conversions, asset access, and address management.
- Trading and other product modules, where legally and operationally enabled.
- Funding, loan, profit, joint-account, KYC, and support workflows.
- Notifications and user-facing access to individual modules.

Controls must be explicit, reversible where appropriate, and scoped. A platform-wide emergency pause must not erase pending requests or ledger history. Per-user overrides must state which platform default they override.

## 4. Admin authorization and auditability

- Enforce server-side role/permission checks on every admin mutation; hiding a button in the frontend is not authorization.
- Apply least privilege. Separate request review, financial settlement, user administration, and configuration permissions where practical.
- Require a reason for approvals, rejections, holds, manual adjustments, and access restrictions.
- Record actor, target user, request/reference ID, prior state, new state, timestamp, reason, and relevant evidence in an append-only audit trail.
- Notify affected users when a decision materially changes their request or account access.
- For high-value or sensitive actions, support configurable dual approval (maker/checker) rather than a single administrator approving their own action.

## 5. Required request lifecycle

A standard reviewable request should support:

`pending -> approved -> settled/completed`

and, where applicable:

`pending -> rejected`
`pending -> on_hold -> pending`
`approved -> cancelled` (only before settlement and with safe reservation release)

Each transition must validate the current state server-side. Settled/completed requests must not be re-approved, rejected, or paid a second time.

## 6. Implementation status

This is the target governance model. Existing functionality must be audited module by module before claiming full coverage. The deposit-verification PR currently addresses the deposit review path and preserves a separate, fail-closed withdrawal settlement path. The remaining per-user feature switches, platform-wide module controls, role matrix, and complete cross-module review queues require separate implementation and tests.