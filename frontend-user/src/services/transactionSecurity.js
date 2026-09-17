import axios from "axios";
const API_BASE_URL=import.meta.env.VITE_API_BASE_URL||"https://vexatrade-5ycu.onrender.com";
// Email delivery may legitimately take longer than normal API calls because the
// backend can try SMTP and then the provider HTTP API. Do not abort the OTP
// request while the server is still delivering it.
const TIMEOUT_MS=30000;
const getToken=()=>localStorage.getItem("userToken")||localStorage.getItem("token")||localStorage.getItem("accessToken")||"";
const client=axios.create({baseURL:API_BASE_URL,timeout:TIMEOUT_MS,headers:{"Content-Type":"application/json"}});
client.interceptors.request.use(config=>{const token=getToken();if(token)config.headers.Authorization=`Bearer ${token}`;return config;});
let requestSecurityUi=null;
const inFlight=new Map();
export function registerTransactionSecurityUi(handler){requestSecurityUi=handler;return()=>{if(requestSecurityUi===handler)requestSecurityUi=null;};}
export function requestTransactionSecurity(action,label,idempotencyKey){const key=String(action||"transaction");const requestKey=String(idempotencyKey||"").trim();if(!requestKey) return Promise.reject(new Error("A transaction request key is required for secure authorization."));if(inFlight.has(key))return Promise.reject(new Error(`${label||action||"Transaction"} authorization is already in progress.`));if(typeof requestSecurityUi!=="function")return Promise.reject(new Error("Transaction security interface is not available. Please reload VexaTrade and try again."));const promise=requestSecurityUi({action,label:label||action,idempotencyKey:requestKey}).finally(()=>inFlight.delete(key));inFlight.set(key,promise);return promise;}
export async function startTransactionSecurity(action,idempotencyKey){const requestKey=String(idempotencyKey||"").trim();const response=await client.post("/api/security/transaction/start",{action,idempotencyKey:requestKey},{headers:{"Idempotency-Key":requestKey}});return response.data?.data||{};}
export async function resendTransactionSecurity(challengeId,action,idempotencyKey){const requestKey=String(idempotencyKey||"").trim();const response=await client.post("/api/security/transaction/resend",{challengeId,action,idempotencyKey:requestKey},{headers:{"Idempotency-Key":requestKey}});return response.data?.data||{};}
export async function verifyTransactionEmail(challengeId,code){const response=await client.post("/api/security/transaction/verify-email",{challengeId,code});return response.data||{};}
export async function verifyTransaction2FA(challengeId,code){const response=await client.post("/api/security/transaction/verify-2fa",{challengeId,code});return response.data||{};}
export async function verifyTransactionPasscode(challengeId,passcode){const response=await client.post("/api/security/transaction/verify-passcode",{challengeId,passcode});return response.data||{};}
export async function authorizeTransactionSecurity(challengeId,idempotencyKey){const requestKey=String(idempotencyKey||"").trim();const response=await client.post("/api/security/transaction/authorize",{challengeId,idempotencyKey:requestKey},{headers:{"Idempotency-Key":requestKey}});return response.data?.data||{};}
export function getTransactionSecurityHeader(token){return token?{"X-Transaction-Security":token}:{};}
