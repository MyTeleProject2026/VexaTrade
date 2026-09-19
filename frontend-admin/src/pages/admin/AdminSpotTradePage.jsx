import { useEffect,useState } from "react";
import { AlertTriangle, RefreshCw, Save, ShieldCheck, SlidersHorizontal, LockKeyhole } from "lucide-react";
import { adminApi,getApiErrorMessage } from "../../services/api";
import useToast from "../../components/ToastNotification";

const DEFAULT_PAIRS="BTCUSDT,ETHUSDT,SOLUSDT,BNBUSDT,XRPUSDT,DOGEUSDT,ADAUSDT,AVAXUSDT,LINKUSDT";
const token=()=>localStorage.getItem("adminToken")||localStorage.getItem("admin_token")||"";

const defaults={
  enabled:true,min:"10",max:"100000",slippage:"100",fee:"0",ttl:"15",daily:"0",
  buy:true,sell:true,pairs:DEFAULT_PAIRS,message:"",
  settlementModel:"market_execution",priceSource:"binance_public_market",receipt:true,pnlEnabled:true,pnlReference:"live_market",pnlRefreshSeconds:"5",realizedPnlOnSell:true
};

export default function AdminSpotTradePage(){
 const t=token(),{addToast}=useToast();
 const [form,setForm]=useState(defaults),[loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[refreshing,setRefreshing]=useState(false),[previewSide,setPreviewSide]=useState("buy"),[previewAmount,setPreviewAmount]=useState("100"),[previewPrice,setPreviewPrice]=useState("100");

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
    receipt:d.settlement_receipt_required!==false,pnlEnabled:d.pnl_enabled!==false,pnlReference:String(d.pnl_reference||"live_market"),pnlRefreshSeconds:String(d.pnl_refresh_seconds??5),realizedPnlOnSell:d.realized_pnl_on_sell!==false
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
    settlement_receipt_required:form.receipt,pnl_enabled:form.pnlEnabled,pnl_reference:form.pnlReference,pnl_refresh_seconds:Number(form.pnlRefreshSeconds),realized_pnl_on_sell:form.realizedPnlOnSell,manual_outcome_override:false
   },t);
   addToast("Spot / Long-Term controls and settlement policy saved.","success");
   await load(true);
  }catch(e){addToast(getApiErrorMessage(e),"error")}
  finally{setSaving(false)}
 }

 if(loading)return <div className="rounded-2xl border border-white/10 bg-[#0a0e1a] p-5 text-sm text-slate-300">Loading Spot / Long-Term controls...</div>;

 return <div className="space-y-3">
  <section className="rounded-3xl border border-white/10 bg-[#0a0e1a] p-4">
   <div className="text-[10px] uppercase tracking-[0.3em] text-cyan-300">Trading Control Center</div>
   <h1 className="mt-1 text-xl font-bold text-white">Spot / Long-Term Trade</h1>
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

   <section className="rounded-2xl border border-emerald-400/15 bg-emerald-400/5 p-4 space-y-3">
    <div className="flex items-center gap-2 text-xs font-semibold text-emerald-300"><SlidersHorizontal size={15}/>P/L settlement display controls</div>
    <p className="text-[10px] leading-4 text-slate-400">These controls define how objective market P/L is displayed and refreshed. They cannot force a user's WIN or LOSS.</p>
    <div className="grid gap-3 md:grid-cols-3">
      <label className="flex items-center justify-between rounded-xl bg-[#050812] p-3 text-xs"><span><b className="block">Live P/L enabled</b><span className="text-[9px] text-slate-500">Show unrealized market P/L.</span></span><input type="checkbox" checked={form.pnlEnabled} onChange={e=>set("pnlEnabled",e.target.checked)}/></label>
      <label className="rounded-xl bg-[#050812] p-3"><span className="text-[10px] text-slate-500">Reference</span><select value={form.pnlReference} onChange={e=>set("pnlReference",e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-[#0a0e1a] px-3 py-2 text-xs text-white"><option value="live_market">Live public market</option></select></label>
      <label className="rounded-xl bg-[#050812] p-3"><span className="text-[10px] text-slate-500">Refresh interval (sec)</span><input type="number" min="1" max="60" value={form.pnlRefreshSeconds} onChange={e=>set("pnlRefreshSeconds",e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-[#0a0e1a] px-3 py-2 text-xs text-white"/></label>
    </div>
    <label className="flex items-center justify-between rounded-xl bg-[#050812] p-3 text-xs"><span><b className="block">Realize P/L on market sell</b><span className="text-[9px] text-slate-500">Realized result is based on actual execution price.</span></span><input type="checkbox" checked={form.realizedPnlOnSell} onChange={e=>set("realizedPnlOnSell",e.target.checked)}/></label>
   </section>

   <section className="rounded-2xl border border-violet-400/15 bg-violet-400/5 p-4 space-y-3">
    <div className="flex items-center gap-2 text-xs font-semibold text-violet-300"><SlidersHorizontal size={15}/>Settlement & P/L preview</div>
    <p className="text-[10px] leading-4 text-slate-400">This preview uses the same configured market-execution fee model shown to users. It is a calculator only; it never changes a user's result or creates an order.</p>
    <div className="grid gap-2 md:grid-cols-3">
      <label className="rounded-xl bg-[#050812] p-3"><span className="text-[10px] text-slate-500">Scenario</span><select value={previewSide} onChange={e=>setPreviewSide(e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-[#0a0e1a] px-3 py-2 text-xs text-white"><option value="buy">Buy</option><option value="sell">Sell</option></select></label>
      <label className="rounded-xl bg-[#050812] p-3"><span className="text-[10px] text-slate-500">Quantity</span><input inputMode="decimal" value={previewAmount} onChange={e=>setPreviewAmount(e.target.value.replace(/[^0-9.]/g,""))} className="mt-2 w-full rounded-xl border border-white/10 bg-[#0a0e1a] px-3 py-2 text-xs text-white"/></label>
      <label className="rounded-xl bg-[#050812] p-3"><span className="text-[10px] text-slate-500">Market price</span><input inputMode="decimal" value={previewPrice} onChange={e=>setPreviewPrice(e.target.value.replace(/[^0-9.]/g,""))} className="mt-2 w-full rounded-xl border border-white/10 bg-[#0a0e1a] px-3 py-2 text-xs text-white"/></label>
    </div>
    {(() => {
      const q=Number(previewAmount)||0,p=Number(previewPrice)||0,notional=q*p,feeAmount=notional*(Number(form.fee)||0)/10000,net=previewSide==="buy"?notional+feeAmount:notional-feeAmount;
      return <div className="grid grid-cols-3 gap-2 text-[10px]">
        <div className="rounded-xl bg-[#050812] p-3"><span className="text-slate-500">Notional</span><b className="mt-1 block text-white">{notional.toLocaleString(undefined,{maximumFractionDigits:8})} USDT</b></div>
        <div className="rounded-xl bg-[#050812] p-3"><span className="text-slate-500">Fee</span><b className="mt-1 block text-white">{feeAmount.toLocaleString(undefined,{maximumFractionDigits:8})} USDT</b></div>
        <div className="rounded-xl bg-[#050812] p-3"><span className="text-slate-500">{previewSide==="buy"?"Total debit":"Net credit"}</span><b className="mt-1 block text-cyan-300">{net.toLocaleString(undefined,{maximumFractionDigits:8})} USDT</b></div>
      </div>
    })()}
    <div className="rounded-xl border border-violet-400/10 bg-violet-400/5 p-3 text-[10px] leading-4 text-slate-500">P/L for a held asset is mark-to-market against the live public market price and becomes realized only through a later market sell. Admin cannot force a WIN or LOSS result for an individual user.</div>
   </section>

   <section className="rounded-2xl border border-violet-400/15 bg-violet-400/5 p-4">
    <div className="flex items-center gap-2 text-xs font-semibold text-violet-300"><SlidersHorizontal size={15}/>Transparent P/L & settlement controls</div>
    <div className="mt-3 grid gap-2 sm:grid-cols-3">
      <div className="rounded-xl bg-[#050812] p-3"><div className="text-[9px] uppercase text-slate-600">Valuation</div><b className="text-[11px] text-white">Live mark-to-market</b><p className="mt-1 text-[9px] leading-4 text-slate-600">Unrealized P/L follows the public market price.</p></div>
      <div className="rounded-xl bg-[#050812] p-3"><div className="text-[9px] uppercase text-slate-600">Realization</div><b className="text-[11px] text-white">On market sell</b><p className="mt-1 text-[9px] leading-4 text-slate-600">Realized P/L is produced by the actual execution price.</p></div>
      <div className="rounded-xl bg-[#050812] p-3"><div className="text-[9px] uppercase text-slate-600">Reference</div><b className="text-[11px] text-white">Public market source</b><p className="mt-1 text-[9px] leading-4 text-slate-600">Execution remains server-validated and receipt-backed.</p></div>
    </div>
    <div className="mt-3 rounded-xl border border-violet-400/10 bg-[#050812] p-3 text-[9px] leading-4 text-slate-500">Administrators can configure trading availability, supported pairs, minimum/maximum order size, slippage, fees, quote lifetime and daily limits. Individual user WIN/LOSS forcing is not part of Spot/Long-Term settlement.</div>
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
