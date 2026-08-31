const required=['DB_HOST','DB_PORT','DB_USER','DB_PASSWORD','DB_NAME','JWT_SECRET','VEXA_ACCOUNT_URL','VEXA_ACCOUNT_CLIENT_ID','VEXA_ACCOUNT_CLIENT_SECRET','VEXA_ACCOUNT_REDIRECT_URI','VEXA_ACCOUNT_SSO_STATE_SECRET','FRONTEND_URL'];
const missing=required.filter(key=>!String(process.env[key]||'').trim());
if(process.env.NODE_ENV==='production'&&missing.length){console.error(`Missing production environment variables: ${missing.join(', ')}`);process.exit(1);}
console.log(`Production configuration check passed (${required.length} required variables present).`);
