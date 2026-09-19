import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeftRight, CheckCircle2, RefreshCw, Wallet } from "lucide-react";
import { useNavigate } from "react-router-dom";
import MarketChart from "../components/MarketChart";
import OrderBook from "../components/OrderBook";
import { spotTradeApi, userApi, getApiErrorMessage } from "../services/api";
import { createActionIdempotencyKey, runSingleUserAction } from "../services/actionRequest";
import { useNotification } from "../hooks/useNotification";

const PAIRS=["BTCUSDT","ETHUSDT","SOLUSDT","BNBUSDT","XRPUSDT","DOGEUSDT","ADAUSDT","AVAXUSDT","LINKUSDT"];
const token=()=>localStorage.getItem("userToken")||localStorage.getItem("token")||localStorage.getItem("accessToken")||"";

function money(v){return Number(v||0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:8});}
function baseOf(symbol){return String(symbol||"").endsWith("USDT")?String(symbol).slice(0,-4):String(symbol||"");}
function assetRows(payload){
 const data=payload?.data||{};
 return Array.isArray(data?.assets)?data.assets:Array.isArray(data)?data:[];
}

export default function SpotTradingPage(){
 const navigate=useNavigate(), auth=token(), {showSuccess,showError}=useNotification();
 const [pair,setPair]=useState("BTCUSDT"),[side,setSide]=useState("buy"),[quantity,setQuantity]=useState(""),[price,setPrice]=useState(0);
 const [settings,setSettings]=useState(null),[orders,setOrders]=useState([]),[assets,setAssets]=useState([]),[wallet,setWallet]=useState({balance:0});
 const [quoteAt,setQuoteAt]=useState(0);
 const [loading,setLoading]=useState(true),[refreshing,setRefreshing]=useState(false),[processing,setProcessing]=useState(false),[receipt,setReceipt]=useState(null),[error,setError]=useState(""),[step,setStep]=useState("form");
 const actionKey=useRef(null),socketRef=useRef(null);

 async function loadData(showSpinner=false){
  if(showSpinner)setRefreshing(true);
  const results=await Promise.allSettled([spotTradeApi.settings(auth),spotTradeApi.orders(auth),userApi.getUserAssets(auth),userApi.getWalletSummary(auth)]);
  if(results[0].status==="fulfilled")setSettings(results[0].value.data?.data||null);
  if(results[1].status==="fulfilled")setOrders(Array.isArray(results[1].value.data?.data)?results[1].value.data.data:[]);
  if(results[2].status==="fulfilled")setAssets(assetRows(results[2].value.data));
  if(results[3].status==="fulfilled")setWallet(results[3].value.data?.data||{balance:0});
  if(showSpinner)setRefreshing(false);
 }

 useEffect(()=>{let alive=true;loadData(false).finally(()=>{if(alive)setLoading(false)});return()=>{alive=false}},[auth]);

 useEffect(()=>{let closed=false;setPrice(0);socketRef.current?.close();
  let ws=null;
  try{ws=new WebSocket(`wss://stream.binance.com:9443/ws/${pair.toLowerCase()}@ticker`);socketRef.current=ws;
   ws.onmessage=e=>{try{const d=JSON.parse(e.data);const p=Number(d.c);if(!closed&&p>0){setPrice(p);setQuoteAt(Date.now())}}catch{}};
  }catch{}
  return()=>{closed=true;try{ws?.close()}catch{}if(socketRef.current===ws)socketRef.current=null};
 },[pair]);

 const base=baseOf(pair);
 const baseBalance=useMemo(()=>{
  const row=assets.find(a=>String(a?.coin||a?.symbol||"").toUpperCase()===base.toUpperCase());
  return Number(row?.available_balance??row?.availableBalance??row?.balance??0);
 },[assets,base]);
 const usdtBalance=Number(wallet?.balance||assets.find(a=>String(a?.coin||"").toUpperCase()==="USDT")?.available_balance||0);
 const total=Number(quantity||0)*Number(price||0);
 const max=Number(settings?.maxOrderUsdt||100000);
 const min=Number(settings?.minOrderUsdt||10);
 const maxSlippageBps=Number(settings?.maxSlippageBps||100);
 const maxByBalance=side==="buy"?usdtBalance:(baseBalance*Number(price||0));
 const canReview=settings?.tradingEnabled!==false&&price>0&&Number(quantity)>0&&total>=min&&total<=max&&total<=maxByBalance&&!processing;
 const quoteAgeSeconds=quoteAt?Math.max(0,Math.floor((Date.now()-quoteAt)/1000)):null;

 function setPercent(percent){
  const availableQuote=side==="buy"?usdtBalance:(baseBalance*Number(price||0));
  if(!Number.isFinite(availableQuote)||availableQuote<=0||!price)return;
  const quote=Math.min(max,availableQuote)*percent/100;
  if(quote<min){setError(`Selected amount is below the ${money(min)} USDT minimum.`);return}
  setQuantity(String(Number((quote/price).toFixed(8))));
  setError("");setStep("form");
 }
 function review(){
  if(!canReview){
   if(!price){setError("Live market price is not connected.");return}
   if(total<min){setError(`Minimum order value is ${money(min)} USDT.`);return}
   if(total>max){setError(`Maximum order value is ${money(max)} USDT.`);return}
   if(total>maxByBalance){setError(side==="buy"?"Insufficient USDT available balance.":"Insufficient asset balance.");return}
   setError("Check the order values and try again.");return
  }
  setError("");setStep("review");
 }
 async function submit(){
  if(!canReview)return;
  const key=actionKey.current||(actionKey.current=createActionIdempotencyKey("spot-order"));
  setProcessing(true);setError("");
  try{
   const res=await runSingleUserAction("spot-market-order",()=>spotTradeApi.placeMarket({symbol:pair,side,quantity:Number(quantity),price,idempotencyKey:key},auth));
   const data=res.data?.data;if(!data)throw new Error(res.data?.message||"Spot order was not completed");
   setReceipt(data);setOrders(prev=>[data,...prev].slice(0,50));setQuantity("");setStep("form");
   const quote=Number(data.quoteAmount||0);
   if(side==="buy"){
     setWallet(prev=>({...prev,balance:Math.max(0,Number(prev.balance||0)-quote)}));
     setAssets(prev=>prev.map(a=>String(a?.coin||a?.symbol||"").toUpperCase()===base.toUpperCase()?{...a,available_balance:Number(a?.available_balance??a?.availableBalance??a?.balance??0)+Number(data.quantity||quantity)}:a));
   }else{
     setWallet(prev=>({...prev,balance:Number(prev.balance||0)+quote}));
     setAssets(prev=>prev.map(a=>String(a?.coin||a?.symbol||"").toUpperCase()===base.toUpperCase()?{...a,available_balance:Math.max(0,Number(a?.available_balance??a?.availableBalance??a?.balance??0)-Number(data.quantity||quantity))}:a));
   }
   showSuccess?.("Spot order filled");
  }catch(e){const msg=getApiErrorMessage(e);setError(msg);showError?.(msg);}
  finally{setProcessing(false);actionKey.current=null;}
 }

 if(loading)return <div className="min-h-screen bg-[#050812] p-4 text-slate-300"><div className="mx-auto max-w-5xl rounded-2xl border border-white/10 bg-[#0a0e1a] p-4 text-sm">Loading Spot / Long-Term trading...</div></div>;

 return <div className="min-h-screen bg-[#050812] p-3 pb-24 text-white sm:p-4">
  <div className="mx-auto max-w-6xl space-y-3">
   <header className="rounded-2xl border border-white/10 bg-[#0a0e1a] p-3">
    <div className="flex items-start justify-between gap-3">
     <div><div className="text-[10px] uppercase tracking-[0.28em] text-cyan-300">Trade · Option 2</div><h1 className="mt-1 text-lg font-bold">Spot / Long-Term</h1><p className="mt-1 text-[10px] leading-4 text-slate-500">Market orders exchange USDT and supported assets. The acquired asset remains in your VexaTrade wallet until you sell or convert it.</p></div>
     <button type="button" onClick={()=>loadData(true)} disabled={refreshing} className="rounded-xl border border-white/10 bg-white/5 p-2 text-slate-300 disabled:opacity-50" aria-label="Refresh spot data"><RefreshCw size={15} className={refreshing?"animate-spin":""}/></button>
    </div>
    <div className="mt-3 grid grid-cols-2 gap-1 rounded-xl bg-[#050812] p-1">
     <button type="button" onClick={()=>navigate("/trade")} className="rounded-lg py-2 text-[11px] font-semibold text-slate-400">Short-Term</button>
     <button type="button" className="rounded-lg bg-cyan-400 py-2 text-[11px] font-bold text-[#031016]">Spot / Long-Term</button>
    </div>
   </header>

   <div className="grid grid-cols-3 gap-1.5 text-center text-[9px] uppercase tracking-wider">
    <div className="rounded-xl border border-cyan-400/20 bg-cyan-400/5 p-2 text-cyan-300">1 · Configure</div>
    <div className={`rounded-xl border p-2 ${step==="review"?"border-cyan-400/20 bg-cyan-400/5 text-cyan-300":"border-white/10 bg-[#0a0e1a] text-slate-500"}`}>2 · Review</div>
    <div className={`rounded-xl border p-2 ${receipt?"border-emerald-400/20 bg-emerald-400/5 text-emerald-300":"border-white/10 bg-[#0a0e1a] text-slate-500"}`}>3 · Result</div>
   </div>

   <section className="grid gap-3 lg:grid-cols-[1.35fr_.65fr]">
    <div className="space-y-3">
     <section className="rounded-2xl border border-white/10 bg-[#0a0e1a] p-3">
      <div className="flex items-center justify-between gap-2"><select value={pair} onChange={e=>{setPair(e.target.value);setStep("form");setError("")}} className="rounded-xl border border-white/10 bg-[#050812] px-3 py-2 text-sm font-bold outline-none">{PAIRS.map(p=><option key={p}>{p}</option>)}</select><div className="text-right"><div className="text-[9px] text-slate-500">Live price</div><div className="text-lg font-bold">{price?money(price):"Connecting..."}</div></div></div>
      <div className="mt-3"><MarketChart symbol={pair} interval="5m" height={220}/></div>
     </section>
     <OrderBook symbol={pair} currentPrice={price} />
    </div>

    <section className="rounded-2xl border border-white/10 bg-[#0a0e1a] p-3">
     <div className="flex items-center justify-between"><div><div className="text-[10px] uppercase tracking-wider text-slate-500">Market order</div><div className="mt-0.5 text-xs text-slate-400">Current execution price</div></div><ArrowLeftRight size={16} className="text-cyan-300"/></div>
     <div className="mt-3 grid grid-cols-2 gap-1 rounded-xl bg-[#050812] p-1">
      <button type="button" onClick={()=>{setSide("buy");setStep("form");setError("")}} className={`rounded-lg py-2.5 text-xs font-bold ${side==="buy"?"bg-emerald-400 text-black":"text-slate-400"}`}>Buy</button>
      <button type="button" onClick={()=>{setSide("sell");setStep("form");setError("")}} className={`rounded-lg py-2.5 text-xs font-bold ${side==="sell"?"bg-red-400 text-white":"text-slate-400"}`}>Sell</button>
     </div>
     <div className="mt-3 grid grid-cols-2 gap-2">
      <div className="rounded-xl border border-white/10 bg-[#050812] p-2"><div className="text-[9px] text-slate-500">USDT available</div><div className="mt-1 text-xs font-bold">{money(usdtBalance)}</div></div>
      <div className="rounded-xl border border-white/10 bg-[#050812] p-2"><div className="text-[9px] text-slate-500">{base} available</div><div className="mt-1 text-xs font-bold">{money(baseBalance)}</div></div>
     </div>
     <label className="mt-3 block text-[10px] uppercase tracking-wider text-slate-500">Quantity ({base})</label>
     <input value={quantity} disabled={step==="review"} onChange={e=>setQuantity(e.target.value.replace(/[^0-9.]/g,""))} inputMode="decimal" placeholder="0.00" className="mt-1 w-full rounded-xl border border-white/10 bg-[#050812] px-3 py-3 text-sm outline-none focus:border-cyan-400"/>
     <div className="mt-2 flex justify-between text-xs"><span className="text-slate-500">Estimated total</span><span>{money(total)} USDT</span></div>
     <div className="mt-1 flex justify-between text-[10px] text-slate-600"><span>Order limits</span><span>{money(min)} – {money(max)} USDT</span></div>
     <div className="mt-2 grid grid-cols-4 gap-1">
      {[25,50,75,100].map(pct=><button key={pct} type="button" disabled={!price||processing} onClick={()=>setPercent(pct)} className="rounded-lg border border-white/10 bg-white/5 py-1.5 text-[10px] font-semibold text-slate-300 disabled:opacity-40">{pct}%</button>)}
     </div>
     <div className="mt-2 flex items-center justify-between text-[9px] text-slate-600"><span>Price quote {quoteAgeSeconds===null?"not connected":`${quoteAgeSeconds}s ago`}</span><span>Max slippage {maxSlippageBps} bps</span></div>
     {error&&<div className="mt-3 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-[11px] text-red-300">{error}</div>}
     {step==="form"&&<button disabled={!canReview} onClick={review} className="mt-4 w-full rounded-2xl bg-cyan-400 py-3 text-sm font-bold text-black disabled:opacity-40">Review {side==="buy"?"Buy":"Sell"} Order</button>}
     {step==="review"&&<div className="mt-4 rounded-2xl border border-cyan-400/20 bg-cyan-400/5 p-3"><div className="text-[10px] uppercase tracking-widest text-cyan-300">Step 2 · Confirm</div><div className="mt-3 space-y-2 text-xs"><div className="flex justify-between"><span className="text-slate-500">Market</span><span>{pair}</span></div><div className="flex justify-between"><span className="text-slate-500">Side</span><span>{side.toUpperCase()}</span></div><div className="flex justify-between"><span className="text-slate-500">Quantity</span><span>{quantity} {base}</span></div><div className="flex justify-between"><span className="text-slate-500">Observed price</span><span>{money(price)}</span></div><div className="flex justify-between font-semibold"><span>Estimated total</span><span>{money(total)} USDT</span></div>
<div className="flex justify-between text-[10px]"><span className="text-slate-500">Quote age</span><span>{quoteAgeSeconds===null?"—":`${quoteAgeSeconds}s`}</span></div></div><div className="mt-3 rounded-xl border border-amber-400/10 bg-amber-400/5 p-2 text-[10px] leading-4 text-slate-500">The backend obtains the live execution price when the single Confirm action is submitted, so the final fill can differ from this observed quote.</div><button disabled={processing} onClick={submit} className="mt-3 w-full rounded-xl bg-emerald-400 py-3 text-sm font-bold text-black disabled:opacity-40">{processing?"Processing...":"Confirm & Execute"}</button><button disabled={processing} onClick={()=>setStep("form")} className="mt-2 w-full rounded-xl border border-white/10 py-2.5 text-xs text-slate-300">Back</button></div>}
    </section>
   </section>

   <section className="rounded-2xl border border-white/10 bg-[#0a0e1a] p-3">
    <div className="flex items-center justify-between"><div><h2 className="text-sm font-semibold">Spot order history</h2><p className="text-[10px] text-slate-500">Filled market orders and execution records</p></div><span className="text-[10px] text-slate-600">{orders.length} records</span></div>
    <div className="mt-3 space-y-2">{orders.length?orders.slice(0,30).map((o,i)=><div key={o.id||o.orderId||i} className="rounded-xl border border-white/10 bg-[#050812] p-3"><div className="flex justify-between text-xs"><span>{o.symbol}</span><span className={String(o.side).toLowerCase()==="buy"?"text-emerald-300":"text-red-300"}>{String(o.side||"").toUpperCase()}</span></div><div className="mt-1 grid grid-cols-3 gap-2 text-[10px]"><span className="text-slate-500">{o.quantity}</span><span className="text-slate-400">@ {money(o.execution_price||o.executionPrice)}</span><span className="text-right text-slate-500">{o.status||"filled"}</span></div></div>):<div className="py-6 text-center text-xs text-slate-600">No spot orders yet.</div>}</div>
   </section>

   <section className="rounded-2xl border border-white/10 bg-[#0a0e1a] p-3">
    <div className="flex items-center gap-2 text-xs font-semibold"><Wallet size={15} className="text-cyan-300"/>How Spot / Long-Term works</div>
    <div className="mt-2 grid gap-2 sm:grid-cols-3"><div className="rounded-xl bg-[#050812] p-3 text-[10px] leading-4 text-slate-500"><b className="text-white">1. Choose</b><br/>Select asset and Buy/Sell.</div><div className="rounded-xl bg-[#050812] p-3 text-[10px] leading-4 text-slate-500"><b className="text-white">2. Review</b><br/>Check quantity and observed market quote.</div><div className="rounded-xl bg-[#050812] p-3 text-[10px] leading-4 text-slate-500"><b className="text-white">3. Own / sell</b><br/>A filled buy credits the asset to your wallet; a sell debits it.</div></div>
   </section>
  </div>

  {receipt&&<div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/75 p-4"><div className="w-full max-w-sm rounded-3xl border border-emerald-400/20 bg-[#080d19] p-5"><CheckCircle2 className="mx-auto text-emerald-300" size={42}/><div className="mt-2 text-center text-[10px] uppercase tracking-widest text-emerald-300">Step 3 · Completed</div><h2 className="mt-1 text-center text-xl font-bold">Order Filled</h2><div className="mt-4 space-y-2 rounded-2xl bg-[#050812] p-4 text-xs"><div className="flex justify-between"><span className="text-slate-500">Pair</span><span>{receipt.symbol}</span></div><div className="flex justify-between"><span className="text-slate-500">Side</span><span>{String(receipt.side).toUpperCase()}</span></div><div className="flex justify-between"><span className="text-slate-500">Quantity</span><span>{receipt.quantity}</span></div><div className="flex justify-between"><span className="text-slate-500">Execution price</span><span>{money(receipt.executionPrice)}</span></div><div className="flex justify-between"><span className="text-slate-500">Quote</span><span>{money(receipt.quoteAmount)} USDT</span></div><div className="flex justify-between"><span className="text-slate-500">Order ID</span><span>#{receipt.orderId||receipt.id||"—"}</span></div></div><button onClick={()=>setReceipt(null)} className="mt-4 w-full rounded-xl bg-cyan-400 py-3 text-sm font-bold text-black">Done</button></div></div>}
 </div>;
}
