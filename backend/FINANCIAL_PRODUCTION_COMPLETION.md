# VexaTrade financial production completion

Run `node scripts/financialReconciliation.js` against the production database before enabling real financial traffic. It checks asset bucket totals, negative balances, fund principal accounting, and duplicate idempotency keys.

Required backend production variables are documented in `backend/.env.example`. Never commit real secrets.

VexaAccount SSO acceptance flow: VexaTrade login -> VexaAccount authorization -> VexaTrade callback -> VexaTrade session -> dashboard -> logout. A live interactive login cannot be simulated by a source-code commit; it must be executed against deployed services with real configured credentials.
