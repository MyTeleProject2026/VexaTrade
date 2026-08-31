const required=['DB_HOST','DB_PORT','DB_USER','DB_PASSWORD','DB_NAME','JWT_SECRET','VEXA_ACCOUNT_SSO_CONFIG','FRONTEND_URL'];
const missing=required.filter(key=>!String(process.env[key]||'').trim());
if(process.env.NODE_ENV==='production'&&missing.length){console.error(`Missing production environment variables: ${missing.join(', ')}`);process.exit(1);}
if(process.env.VEXA_ACCOUNT_SSO_CONFIG){try{const c=JSON.parse(process.env.VEXA_ACCOUNT_SSO_CONFIG);for(const key of ['clientId','clientSecret','redirectUri'])if(!String(c[key]||'').trim())throw new Error(`VEXA_ACCOUNT_SSO_CONFIG.${key} is required`);if(c.redirectUri!=='https://www.vexatrade-v.2bd.net/auth/callback')throw new Error('VexaAccount redirect URI must be the production VexaTrade callback');}catch(e){console.error(`Invalid VEXA_ACCOUNT_SSO_CONFIG: ${e.message}`);process.exit(1);}}
console.log(`Production configuration check passed (${required.length} required variables present).`);
