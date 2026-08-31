# VexaTrade production completion

## Central VexaAccount SSO

VexaTrade now supports a single backend environment variable for its complete VexaAccount SSO client configuration:

`VEXA_ACCOUNT_SSO_CONFIG`

Production value shape:

`{"url":"https://api-vexaaccount.onrender.com","clientId":"<VEXAACCOUNT_CLIENT_ID>","clientSecret":"<VEXAACCOUNT_CLIENT_SECRET>","redirectUri":"https://www.vexatrade-v.2bd.net/auth/callback","timeoutMs":10000}`

The frontend needs only its normal API base URL; VexaAccount client secrets are never exposed to the browser.

The VexaAccount client must whitelist exactly:

`https://www.vexatrade-v.2bd.net/auth/callback`

The SSO flow is:

VexaTrade user login -> VexaAccount authorization -> VexaTrade `/auth/callback` -> VexaTrade backend token exchange -> local VexaTrade session -> dashboard.

This is one configuration variable, not a long-lived master user JWT. Access tokens remain short-lived and are scoped by VexaAccount.

## Production verification

1. Configure the VexaAccount production SSO client.
2. Put the resulting client ID and secret inside `VEXA_ACCOUNT_SSO_CONFIG` on the VexaTrade backend Render service.
3. Set `JWT_SECRET` and database variables on the backend.
4. Set `VITE_API_BASE_URL=https://vexatrade-5ycu.onrender.com` on the VexaTrade user frontend.
5. Deploy both services.
6. Open `https://www.vexatrade-v.2bd.net/login` and choose VexaAccount.
7. Complete VexaAccount authentication and verify the redirect returns to `/auth/callback`.
8. Confirm dashboard access, refresh, logout, and login again.
9. Run `node scripts/financialReconciliation.js` against production and require `healthy: true` before real financial traffic.
