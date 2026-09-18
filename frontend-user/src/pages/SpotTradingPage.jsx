import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeftRight, CheckCircle2, Clock3, RefreshCw, TrendingDown, TrendingUp } from "lucide-react";
import { spotTradeApi, getApiErrorMessage } from "../services/api";
import { createActionIdempotencyKey, runSingleUserAction } from "../services/actionRequest";
import { useNotification } from "../hooks/useNotification";

const PAIRS=["BTCUSDT","ETHUSDT","SOLUSDT","BNBUSDT","XRPUSDT","DOGEUSDT","ADAUSDT","AVAXUSDT","LINKUSDT"];
const token=()=>localStorage.getItem("userToken")||localStorage.getItem("token")||localStorage.getItem("accessToken")||"";

function money(v){return Number(v||0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:8});}

export default function SpotTradingPage(){
 const auth=token(), {showSuccess,showError}=useNotification();
 const [pair,setPair]=useState("BTCUSDT"),[side,setSide]=useState("buy"),[quantity,setQuantity]=useState(""),[price,setPrice]=useState(0);
 const [settings,setSettings]=useState(null),[orders,setOrders]=useState([]),[loading,setLoading]=useState(true),[processing,setProcessing]=useState(false),[receipt,setReceipt]=useState(null),[error,setError]=useState(""),[step,setStep]=useState("form");
 const actionKey=useRef(null),socketRef=useRef(null);

 useEffect(()=>{let alive=true;
  Promise.allSettled([spotTradeApi.settings(auth),spotTradeApi.orders(auth)]).then(([s,o])=>{if(!alive)return;if(s.status==="fulfilled")setSettings(s.value.data?.data||null);if(o.status==="fulfilled")setOrders(Array.isArray(o.value.data?.data)?o.value.data.data:[]);}).finally(()=>{if(alive)setLoading(false)});
  return()=>{alive=false};
 },[auth]);

 useEffect(()=>{let closed=false;setPrice(0);socketRef.current?.close();
  const symbol=pair.toLowerCase(), ws=new WebSocket(`wss://stream.binance.com:9443/ws/${symbol}@ticker`);socketRef.current=ws;
  ws.onmessage=e=>{try{const d=JSON.parse(e.data);const p=Number(d.c);if(!closed&&p>0)setPrice(p)}catch{}};
  ws.onerror=()=>{};ws.onclose=()=>{};
  return()=>{closed=true;ws.close();if(socketRef.current===ws)socketRef.current=null};
 },[pair]);

 const total=Number(quantity||0)*Number(price||0);
 const max=Number(settings?.maxOrderUsdt||100000);
 const canSubmit=settings?.tradingEnabled!==false&&price>0&&Number(quantity)>0&&total<=max&&!processing;

 function review(){ if(canSubmit) setStep("review"); }
 async function submit(){
  if(!canSubmit)return;
  const key=actionKey.current||(actionKey.current=createActionIdempotencyKey("spot-order"));
  setProcessing(true);setError("");
  try{
   const res=await runSingleUserAction("spot-market-order",()=>spotTradeApi.placeMarket({symbol:pair,side,quantity:Number(quantity),price,idempotencyKey:key},auth));
   const data=res.data?.data;if(!data)throw new Error(res.data?.message||"Spot order was not completed");
   setReceipt(data);setOrders(prev=>[data,...prev].slice(0,50));setQuantity("");setStep("form");showSuccess?.("Spot order filled");
  }catch(e){const msg=getApiErrorMessage(e);setError(msg);showError?.(msg);}
  finally{setProcessing(false);actionKey.current=null;}
 }

 if(loading)return <div className="min-h-screen bg-[#050812] p-4 text-slate-300">Loading spot trading...</div>;
 return <div className="min-h-screen bg-[#050812] p-4 pb-24 text-white">
  <div className="mx-auto max-w-2xl space-y-4">
   <header className="rounded-3xl border border-white/10 bg-[#0a0e1a] p-4">
    <div className="text-[10px] uppercase tracking-[0.28em] text-cyan-300">Spot / Long-Term</div>
    <h1 className="mt-1 text-2xl font-bold">Spot Trading</h1>
    <p className="mt-1 text-xs text-slate-500">Buy or sell supported assets at the current public market price. Orders are settled through VexaTrade's wallet ledger.</p>
   </header>

   <section className="rounded-3xl border border-white/10 bg-[#0a0e1a] p-4">
    <div className="grid grid-cols-2 gap-2">
     <button onClick={()=>setSide("buy")} className={`rounded-xl py-3 text-sm font-bold ${side==="buy"?"bg-emerald-500 text-black":"bg-white/5 text-slate-400"}`}>Buy</button>
     <button onClick={()=>setSide("sell")} className={`rounded-xl py-3 text-sm font-bold ${side==="sell"?"bg-red-500 text-white":"bg-white/5 text-slate-400"}`}>Sell</button>
    </div>
    <label className="mt-4 block text-xs text-slate-500">Market</label>
    <select value={pair} onChange={e=>setPair(e.target.value)} className="mt-1 w-full rounded-xl border border-white/10 bg-[#050812] px-3 py-3 text-sm">
      {PAIRS.map(p=><option key={p}>{p}</option>)}
    </select>
    <div className="mt-4 rounded-2xl border border-white/10 bg-[#050812] p-4">
      <div className="flex items-center justify-between"><span className="text-xs text-slate-500">Live market price</span><span className="text-[10px] text-emerald-300">LIVE</span></div>
      <div className="mt-2 text-2xl font-bold">{price?money(price):"Connecting..."}</div>
    </div>
    <label className="mt-4 block text-xs text-slate-500">Quantity ({pair.endsWith("USDT")?pair.slice(0,-4):pair})</label>
    <input value={quantity} onChange={e=>setQuantity(e.target.value.replace(/[^0-9.]/g,""))} inputMode="decimal" placeholder="0.00" className="mt-1 w-full rounded-xl border border-white/10 bg-[#050812] px-3 py-3 text-sm outline-none focus:border-cyan-400"/>
    <div className="mt-3 flex justify-between text-xs"><span className="text-slate-500">Estimated total</span><span>{money(total)} USDT</span></div>
    <div className="mt-1 flex justify-between text-[10px] text-slate-600"><span>Maximum</span><span>{money(max)} USDT</span></div>
    {error&&<div className="mt-3 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-300">{error}</div>}
    {step==="form" ? <button disabled={!canSubmit} onClick={review} className="mt-4 w-full rounded-2xl bg-cyan-400 py-3 text-sm font-bold text-black disabled:opacity-40">Review {side==="buy"?"Buy":"Sell"} Order</button> : <div className="mt-4 rounded-2xl border border-cyan-400/20 bg-cyan-400/5 p-4"><div className="text-xs uppercase tracking-widest text-cyan-300">Order review</div><div className="mt-3 space-y-2 text-xs"><div className="flex justify-between"><span className="text-slate-500">Market</span><span>{pair}</span></div><div className="flex justify-between"><span className="text-slate-500">Side</span><span>{side.toUpperCase()}</span></div><div className="flex justify-between"><span className="text-slate-500">Quantity</span><span>{quantity}</span></div><div className="flex justify-between"><span className="text-slate-500">Live execution price</span><span>{money(price)}</span></div><div className="flex justify-between font-semibold"><span>Estimated total</span><span>{money(total)} USDT</span></div></div><button disabled={processing} onClick={submit} className="mt-4 w-full rounded-xl bg-emerald-400 py-3 text-sm font-bold text-black disabled:opacity-40">{processing?"Processing...":"Confirm Order"}</button><button disabled={processing} onClick={()=>setStep("form")} className="mt-2 w-full rounded-xl border border-white/10 py-2.5 text-xs text-slate-300">Back</button></div>}
    
    <p className="mt-2 text-center text-[10px] text-slate-600">Your existing VexaTrade transaction-security layer may request additional verification before submission.</p>
   </section>

   <section className="rounded-3xl border border-white/10 bg-[#0a0e1a] p-4">
    <div className="flex items-center justify-between"><h2 className="font-semibold">Order history</h2><RefreshCw size={15} className="text-slate-500"/></div>
    <div className="mt-3 space-y-2">{orders.length?orders.slice(0,20).map((o,i)=><div key={o.id||o.orderId||i} className="rounded-xl border border-white/10 bg-[#050812] p-3">
      <div className="flex justify-between text-xs"><span>{o.symbol}</span><span className={String(o.side).toLowerCase()==="buy"?"text-emerald-300":"text-red-300"}>{String(o.side||"").toUpperCase()}</span></div>
      <div className="mt-1 flex justify-between text-[10px] text-slate-500"><span>{o.quantity} @ {money(o.execution_price||o.executionPrice)}</span><span>{o.status||"filled"}</span></div>
    </div>):<div className="py-6 text-center text-xs text-slate-600">No spot orders yet.</div>}</div>
   </section>
  </div>
  {receipt&&<div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/75 p-4"><div className="w-full max-w-sm rounded-3xl border border-emerald-400/20 bg-[#080d19] p-5">
    <CheckCircle2 className="mx-auto text-emerald-300" size={42}/><h2 className="mt-3 text-center text-xl font-bold">Order Filled</h2>
    <div className="mt-4 space-y-2 rounded-2xl bg-[#050812] p-4 text-xs"><div className="flex justify-between"><span className="text-slate-500">Pair</span><span>{receipt.symbol}</span></div><div className="flex justify-between"><span className="text-slate-500">Side</span><span>{String(receipt.side).toUpperCase()}</span></div><div className="flex justify-between"><span className="text-slate-500">Quantity</span><span>{receipt.quantity}</span></div><div className="flex justify-between"><span className="text-slate-500">Execution price</span><span>{money(receipt.executionPrice)}</span></div><div className="flex justify-between"><span className="text-slate-500">Quote</span><span>{money(receipt.quoteAmount)} USDT</span></div></div>
    <button onClick={()=>setReceipt(null)} className="mt-4 w-full rounded-xl bg-cyan-400 py-3 text-sm font-bold text-black">Done</button>
  </div></div>}
 </div>;
}
