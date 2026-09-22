import appApiClient from "./api";
import { requestTransactionSecurity } from "./transactionSecurity";

const ACTIONS={"/api/deposits/request":["deposit","Deposit authorization"],"/api/withdrawals/request":["withdrawal","Withdrawal authorization"],"/api/convert/execute":["convert","Conversion authorization"],"/api/user/transfer":["transfer","Transfer authorization"],"/api/funds/apply":["funds","Funds authorization"],"/api/spot/orders":["spot-trade","Spot trade authorization"],"/api/loans/apply":["loan","Loan authorization"],"/api/withdraw/profit-request":["profit-withdrawal","Profit withdrawal authorization"]};
const actionFor=url=>ACTIONS[String(url||"").split("?")[0]]||null;
const makeKey=action=>`${action}-${typeof crypto!=="undefined"&&crypto.randomUUID?crypto.randomUUID():`${Date.now()}-${Math.random().toString(36).slice(2)}`}`.slice(0,128);
let installed=false;

// Spot / Long-Term order creation is an execution step, not a generic transaction
// receipt. Its own full-screen position/result flow owns the user-visible result.
// Security authorization is still emitted normally.
const isPositionOwnedAction=action=>action==="spot-trade";

const emitFlow=(action,phase)=>{
  if(typeof window!=="undefined" && !isPositionOwnedAction(action)){
    window.dispatchEvent(new CustomEvent("vexa:transaction-flow",{detail:{action,phase}}));
  }
};

const emitTransactionComplete=(action,responseData)=>{
  if(typeof window==="undefined"||["deposit","withdrawal","spot-trade"].includes(action))return;
  window.dispatchEvent(new CustomEvent("vexa:transaction-complete",{
    detail:{
      action,
      status:responseData?.data?.status||responseData?.status||"completed",
      data:responseData?.data||responseData||{}
    }
  }));
};

const getConfigKey=config=>String(config?.headers?.["Idempotency-Key"]||config?.headers?.["idempotency-key"]||config?.data?.idempotencyKey||"").trim();

export function installGlobalTransactionSecurityInterceptor(){
  if(installed||typeof window==="undefined")return;
  installed=true;

  appApiClient.interceptors.request.use(async config=>{
    const method=String(config.method||"get").toLowerCase();
    const security=["post","put","patch","delete"].includes(method)?actionFor(config.url):null;
    if(security&&!config.__vexaSecurityHandled){
      const requestKey=getConfigKey(config)||makeKey(security[0]);
      config.headers={...(config.headers||{}),"Idempotency-Key":requestKey};
      if(!config.headers["X-Transaction-Security"]){
        const result=await requestTransactionSecurity(security[0],security[1],requestKey);
        if(!result?.transactionSecurityToken)throw new Error("Transaction security authorization was not completed");
        if(result.idempotencyKey&&result.idempotencyKey!==requestKey)throw new Error("Transaction security request key changed unexpectedly");
        config.headers["X-Transaction-Security"]=result.transactionSecurityToken;
        if(config.data&&typeof config.data==="object"&&!(config.data instanceof FormData)){
          config.data={...config.data,transactionPasscode:result.transactionPasscode||"",twoFactorCode:result.twoFactorCode||"",idempotencyKey:requestKey};
        }
      }
      emitFlow(security[0],"processing");
      config.__vexaSecurityHandled=true;
    }
    return config;
  });

  appApiClient.interceptors.response.use(response=>{
    const security=actionFor(response.config?.url);
    if(security){
      emitFlow(security[0],"complete");
      emitTransactionComplete(security[0],response.data);
    }
    return response;
  },error=>Promise.reject(error));

  const originalFetch=window.fetch.bind(window);
  window.fetch=async(input,init={})=>{
    const url=typeof input==="string"?input:input?.url||"";
    const method=String(init.method||(typeof input!=="string"?input?.method:"GET")||"GET").toUpperCase();
    const security=["POST","PUT","PATCH","DELETE"].includes(method)?actionFor(url):null;
    if(!security)return originalFetch(input,init);
    const headers=new Headers(init.headers||(typeof input!=="string"?input?.headers:undefined));
    if(headers.get("X-Transaction-Security"))return originalFetch(input,init);
    const requestKey=headers.get("Idempotency-Key")||makeKey(security[0]);
    headers.set("Idempotency-Key",requestKey);
    const result=await requestTransactionSecurity(security[0],security[1],requestKey);
    if(!result?.transactionSecurityToken)throw new Error("Transaction security authorization was not completed");
    if(result.idempotencyKey&&result.idempotencyKey!==requestKey)throw new Error("Transaction security request key changed unexpectedly");
    headers.set("X-Transaction-Security",result.transactionSecurityToken);
    emitFlow(security[0],"processing");
    if(typeof init.body==="string"){
      try{
        const body=JSON.parse(init.body);
        body.transactionPasscode=result.transactionPasscode||body.transactionPasscode||"";
        body.twoFactorCode=result.twoFactorCode||body.twoFactorCode||"";
        body.idempotencyKey=requestKey;
        init={...init,body:JSON.stringify(body),headers};
      }catch{init={...init,headers};}
    }else init={...init,headers};
    const response=await originalFetch(input,init);
    if(response.ok){
      try{
        const payload=await response.clone().json();
        emitFlow(security[0],"complete");
        emitTransactionComplete(security[0],payload);
      }catch{
        emitFlow(security[0],"complete");
        emitTransactionComplete(security[0],{});
      }
    }
    return response;
  };
}
