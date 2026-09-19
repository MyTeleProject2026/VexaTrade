import { useEffect,useState } from "react";
import { AlertTriangle, RefreshCw, Save, ShieldCheck, SlidersHorizontal, LockKeyhole } from "lucide-react";
import { adminApi,getApiErrorMessage } from "../../services/api";
import useToast from "../../components/ToastNotification";

const DEFAULT_PAIRS="BTCUSDT,ETHUSDT,SOLUSDT,BNBUSDT,XRPUSDT,DOGEUSDT,ADAUSDT,AVAXUSDT,LINKUSDT";
const token=()=>localStorage.getItem("adminToken")||localStorage.getItem("admin_token")||"";

const defaults={
  enabled:true,min:"10",max:"100000",slippage:"100",fee:"0",ttl:"15",daily:"0",
  buy:true,sell:true,pairs:DEFAULT_PAIRS,message:"",
  settlementModel:"market_execution",priceSource:"binance_public_market",receipt:true
};

export default function AdminSpotTradePage(){
 const t=token(),{addToast}=useToast();
 const [form,setForm]=useState(defaults),[loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[refreshing,setRefreshing]=useState(false);

 async function load(initial=true){
  if(initial)setLoading(true);else setRefreshing(true);
  try{
   const r=await adminApi.getSpotTradeSettings(t),d=r.data?.data||{};
   setForm({
    enabled:d.trading_enabled!==false,
    min:String(d.min_order_usdt??10),max:String(d.max_order_usdt??100000),
    slippage:String(d.max_slippage_bps??100),fee:String(d.trading_fee_bps??0),
    ttl:String(d.quote_ttl_seconds??15),daily:String(d.max_orders_per_day??0),
    buy:d.buy_enabled!==false,sell:d.sell_enabled!==false,
    pairs:String(d.supported_pairs||DEFAULT_PAIRS),message:String(d.maintenance_message||""),
    settlementModel:String(d.settlement_model||"market_execution"),
    priceSource:String(d.settlement_price_source||"binance_public_market"),
    receipt:d.settlement_receipt_required!==false
   });
  }catch(e){addToast(getApiErrorMessage(e),"error")}
  finally{setLoading(false);setRefreshing(false)}
 }
 useEffect(()=>{load(true)},[t]);
 const set=(k,v)=>setForm(p=>({...p,[k]:v}));
 const resetDefaults=()=>setForm(defaults);

 async function save(e){
  e.preventDefault();
  const min=Number(form.min),max=Number(form.max),slip=Number(form.slippage),fee=Number(form.fee),ttl=Number(form.ttl),daily=Number(form.daily);
  const pairs=form.pairs.split(",").map(v=>v.trim().toUpperCase()).filter(Boolean);
  if(!Number.isFinite(min)||min<=0||!Number.isFinite(max)||max<=min||!Number.isFinite(slip)||slip<=0||slip>10000||!Number.isFinite(fee)||fee<0||fee>1000||!Number.isInteger(ttl)||ttl<5||ttl>120||!Number.isInteger(daily)||daily<0||daily>10000||!pairs.length)
   return addToast("Check limits, fee, quote TTL, daily limit and supported pairs.","error");
  if(form.settlementModel!=="market_execution"||form.priceSource!=="binance_public_market"||!form.receipt)
   return addToast("Spot settlement must remain market-based with public market pricing and receipts enabled.","error");
  setSaving(true);
  try{
   await adminApi.updateSpotTradeSettings({
    trading_enabled:form.enabled,min_order_usdt:min,max_order_usdt:max,max_slippage_bps:slip,
    trading_fee_bps:fee,quote_ttl_seconds:ttl,max_orders_per_day:daily,buy_enabled:form.buy,
    sell_enabled:form.sell,supported_pairs:pairs.join(","),maintenance_message:form.message,
    settlement_model:form.settlementModel,settlement_price_source:form.priceSource,
    settlement_receipt_required:form.receipt,manual_outcome_override:false
   },t);
   addToast("Spot / Long-Term controls and settlement policy saved.","success");
   await load(true);
  }catch(e){addToast(getApiErrorMessage(e),"error")}
  finally{setSaving(false)}
 }

 if(loading)return <div className="rounded-2xl border border-white/10 bg-[#0a0e1a] p-5 text-sm text-slate-300">Loading Spot / Long-Term controls...</div>;

 return <div className="space-y-5">
  <section className="rounded-3xl border border-white/10 bg-[#0a0e1a] p-5">
   <div className="text-[10px] uppercase tracking-[0.3em] text-cyan-300">Trading Control Center</div>
   <h1 className="mt-1 text-2xl font-bold text-white">Spot / Long-Term Trade</h1>
   <p className="mt-2 text-sm text-slate-500">Independent controls for the user Spot terminal. Existing Short-Term Trade Rules remain separate and unchanged.</p>
   <div className="mt-4 grid gap-2 sm:grid-cols-3">
    <div className="rounded-2xl bg-[#050812] p-3"><div className="text-[9px] uppercase text-slate-500">Execution</div><b className="text-xs text-white">Live market</b></div>
    <div className="rounded-2xl bg-[#050812] p-3"><div className="text-[9px] uppercase text-slate-500">Settlement</div><b className="text-xs text-emerald-300">Objective price</b></div>
    <div className="rounded-2xl bg-[#050812] p-3"><div className="text-[9px] uppercase text-slate-500">Outcome override</div><b className="text-xs text-slate-400">Disabled</b></div>
   </div>
  </section>

  <form onSubmit={save} className="space-y-4 rounded-3xl border border-white/10 bg-[#0a0e1a] p-5">
   <section className="space-y-3">
    <div className="flex items-center gap-2 text-xs font-semibold text-white"><SlidersHorizontal size={15} className="text-cyan-300"/>Execution controls</div>
    <label className="flex items-center justify-between rounded-2xl bg-[#050812] p-4">
     <span><b className="block text-sm">Trading enabled</b><span className="text-[10px] text-slate-500">Master switch for new Spot orders.</span></span>
     <input type="checkbox" checked={form.enabled} onChange={e=>set("enabled",e.target.checked)} className="h-5 w-5"/>
    </label>
    <div className="grid gap-3 md:grid-cols-3">
     <label className="rounded-2xl bg-[#050812] p-3"><span className="text-[10px] text-slate-500">Trading fee (bps)</span><input type="number" min="0" max="1000" step="1" value={form.fee} onChange={e=>set("fee",e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-[#0a0e1a] px-3 py-3 text-sm text-white"/><span className="mt-1 block text-[9px] text-slate-600">100 bps = 1%</span></label>
     <label className="rounded-2xl bg-[#050812] p-3"><span className="text-[10px] text-slate-500">Quote TTL (seconds)</span><input type="number" min="5" max="120" value={form.ttl} onChange={e=>set("ttl",e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-[#0a0e1a] px-3 py-3 text-sm text-white"/></label>
     <label className="rounded-2xl bg-[#050812] p-3"><span className="text-[10px] text-slate-500">Daily order limit</span><input type="number" min="0" max="10000" value={form.daily} onChange={e=>set("daily",e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-[#0a0e1a] px-3 py-3 text-sm text-white"/><span className="mt-1 block text-[9px] text-slate-600">0 = unlimited</span></label>
    </div>
    <div className="grid gap-3 md:grid-cols-2">
     <label className="rounded-2xl bg-[#050812] p-3"><span className="text-[10px] text-slate-500">Supported pairs</span><input value={form.pairs} onChange={e=>set("pairs",e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-[#0a0e1a] px-3 py-3 text-xs text-white"/><span className="mt-1 block text-[9px] text-slate-600">Comma-separated symbols.</span></label>
     <label className="rounded-2xl bg-[#050812] p-3"><span className="text-[10px] text-slate-500">Disabled-state message</span><input value={form.message} onChange={e=>set("message",e.target.value)} maxLength="255" className="mt-2 w-full rounded-xl border border-white/10 bg-[#0a0e1a] px-3 py-3 text-xs text-white"/></label>
    </div>
    <div className="grid grid-cols-2 gap-2">
     <label className="flex items-center justify-between rounded-xl bg-[#050812] p-3 text-xs">Allow Buy<input type="checkbox" checked={form.buy} onChange={e=>set("buy",e.target.checked)}/></label>
     <label className="flex items-center justify-between rounded-xl bg-[#050812] p-3 text-xs">Allow Sell<input type="checkbox" checked={form.sell} onChange={e=>set("sell",e.target.checked)}/></label>
    </div>
    <div className="grid gap-3 md:grid-cols-3">
     <label className="rounded-2xl bg-[#050812] p-3"><span className="text-[10px] text-slate-500">Minimum order (USDT)</span><input type="number" min="0.01" step="0.01" value={form.min} onChange={e=>set("min",e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-[#0a0e1a] px-3 py-3 text-sm text-white"/></label>
     <label className="rounded-2xl bg-[#050812] p-3"><span className="text-[10px] text-slate-500">Maximum order (USDT)</span><input type="number" min="0.01" step="0.01" value={form.max} onChange={e=>set("max",e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-[#0a0e1a] px-3 py-3 text-sm text-white"/></label>
     <label className="rounded-2xl bg-[#050812] p-3"><span className="text-[10px] text-slate-500">Max review slippage (bps)</span><input type="number" min="1" max="10000" step="1" value={form.slippage} onChange={e=>set("slippage",e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-[#0a0e1a] px-3 py-3 text-sm text-white"/></label>
    </div>
   </section>

   <section className="rounded-2xl border border-cyan-400/15 bg-cyan-400/5 p-4 space-y-3">
    <div className="flex items-center gap-2 text-xs font-semibold text-cyan-300"><ShieldCheck size={15}/>Settlement policy</div>
    <p className="text-[10px] leading-4 text-slate-400">Spot orders are real market buy/sell executions. They do not use a binary WIN/LOSS contract. Final execution value comes from the server market price and the configured slippage/fee rules.</p>
    <div className="grid gap-3 md:grid-cols-2">
     <label className="rounded-xl bg-[#050812] p-3"><span className="text-[10px] text-slate-500">Settlement model</span><select value={form.settlementModel} onChange={e=>set("settlementModel",e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-[#0a0e1a] px-3 py-3 text-xs text-white"><option value="market_execution">Market execution · objective</option></select></label>
     <label className="rounded-xl bg-[#050812] p-3"><span className="text-[10px] text-slate-500">Settlement price source</span><select value={form.priceSource} onChange={e=>set("priceSource",e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-[#0a0e1a] px-3 py-3 text-xs text-white"><option value="binance_public_market">Public Binance market price</option></select></label>
    </div>
    <label className="flex items-center justify-between rounded-xl bg-[#050812] p-3 text-xs"><span><b className="block">Settlement receipt required</b><span className="text-[9px] text-slate-500">Keeps execution price, fee, quantity and order ID visible to the user.</span></span><input type="checkbox" checked={form.receipt} onChange={e=>set("receipt",e.target.checked)}/></label>
   </section>

   <section className="rounded-2xl border border-amber-400/15 bg-amber-400/5 p-4">
    <div className="flex items-center gap-2 text-xs font-semibold text-amber-300"><LockKeyhole size={15}/>WIN / LOSS protection</div>
    <p className="mt-2 text-[10px] leading-4 text-slate-400">Per-user or per-order forced WIN/LOSS outcomes are intentionally unavailable. A trading platform should not be able to change a customer's result after the order is placed. If a future regulated product needs an outcome-based settlement model, it must use a documented market rule and an independently verifiable reference price.</p>
    <div className="mt-3 flex items-center gap-2 text-[10px] text-slate-300"><AlertTriangle size={13} className="text-amber-300"/>Manual outcome override: <b className="text-slate-400">disabled</b></div>
   </section>

   <div className="flex flex-wrap gap-2">
    <button type="button" onClick={()=>load(false)} disabled={refreshing||saving} className="rounded-xl border border-white/10 px-4 py-3 text-xs disabled:opacity-40"><RefreshCw size={14} className={refreshing?"inline mr-1 animate-spin":"inline mr-1"}/>Refresh</button>
    <button type="button" onClick={resetDefaults} disabled={saving} className="rounded-xl border border-white/10 px-4 py-3 text-xs disabled:opacity-40">Reset form</button>
    <button disabled={saving} className="flex-1 rounded-xl bg-cyan-400 py-3 text-sm font-bold text-black disabled:opacity-40"><Save size={15} className="mr-1 inline"/>{saving?"Saving...":"Save Controls & Settlement Policy"}</button>
   </div>
  </form>
 </div>;
}
