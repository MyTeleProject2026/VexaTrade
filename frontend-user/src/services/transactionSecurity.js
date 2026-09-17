import axios from "axios";
const API_BASE_URL=import.meta.env.VITE_API_BASE_URL||"https://vexatrade-5ycu.onrender.com";
const TIMEOUT_MS=8000;
const getToken=()=>localStorage.getItem("userToken")||localStorage.getItem("token")||localStorage.getItem("accessToken")||"";
const client=axios.create({baseURL:API_BASE_URL,timeout:TIMEOUT_MS,headers:{"Content-Type":"application/json"}});
client.interceptors.request.use(config=>{const token=getToken();if(token)config.headers.Authorization=`Bearer ${token}`;return config;});
let requestSecurityUi=null;
const inFlight=new Map();
export function registerTransactionSecurityUi(handler){requestSecurityUi=handler;return()=>{if(requestSecurityUi===handler)requestSecurityUi=null;};}
export function requestTransactionSecurity(action,label){const key=String(action||"transaction");if(inFlight.has(key))return Promise.reject(new Error(`${label||action||"Transaction"} authorization is already in progress.`));if(typeof requestSecurityUi!=="function")return Promise.reject(new Error("Transaction security interface is not available. Please reload VexaTrade and try again."));const promise=requestSecurityUi({action,label:label||action}).finally(()=>inFlight.delete(key));inFlight.set(key,promise);return promise;}
export async function startTransactionSecurity(action){const response=await client.post("/api/security/transaction/start",{action});return response.data?.data||{};}
export async function verifyTransactionEmail(challengeId,code){const response=await client.post("/api/security/transaction/verify-email",{challengeId,code});return response.data||{};}
export async function verifyTransaction2FA(challengeId,code){const response=await client.post("/api/security/transaction/verify-2fa",{challengeId,code});return response.data||{};}
export async function verifyTransactionPasscode(challengeId,passcode){const response=await client.post("/api/security/transaction/verify-passcode",{challengeId,passcode});return response.data||{};}
export async function authorizeTransactionSecurity(challengeId){const response=await client.post("/api/security/transaction/authorize",{challengeId});return response.data?.data||{};}
export function getTransactionSecurityHeader(token){return token?{"X-Transaction-Security":token}:{};}
