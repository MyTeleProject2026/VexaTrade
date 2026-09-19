import { useEffect,useState } from "react";
import { adminApi,getApiErrorMessage } from "../../services/api";
import useToast from "../../components/ToastNotification";

export default function AdminSpotTradePage(){
 const token=localStorage.getItem("adminToken")||localStorage.getItem("admin_token")||"";
 const {addToast}=useToast();
 const [enabled,setEnabled]=useState(true),[max,setMax]=useState("100000"),[min,setMin]=useState("10"),[slippage,setSlippage]=useState("100"),[loading,setLoading]=useState(true),[saving,setSaving]=useState(false);
 useEffect(()=>{let alive=true;adminApi.getSpotTradeSettings(token).then(r=>{if(!alive)return;const d=r.data?.data||{};setEnabled(d.trading_enabled!==false);setMax(String(d.max_order_usdt||100000));setMin(String(d.min_order_usdt||10));setSlippage(String(d.max_slippage_bps||100));}).catch(e=>addToast(getApiErrorMessage(e),"error")).finally(()=>alive&&setLoading(false));return()=>{alive=false}},[token]);
 async function save(e){e.preventDefault();setSaving(true);try{const r=await adminApi.updateSpotTradeSettings({trading_enabled:enabled,max_order_usdt:Number(max),min_order_usdt:Number(min),max_slippage_bps:Number(slippage)},token);if(!r.data?.success)throw new Error(r.data?.message||"Unable to save");addToast("Spot trading controls saved","success")}catch(e){addToast(getApiErrorMessage(e),"error")}finally{setSaving(false)}}
 if(loading)return <div className="rounded-2xl border border-white/10 bg-[#0a0e1a] p-5 text-sm text-slate-300">Loading spot trading controls...</div>;
 return <div className="space-y-5">
  <section className="rounded-3xl border border-white/10 bg-[#0a0e1a] p-5"><div className="text-[10px] uppercase tracking-[0.3em] text-cyan-300">Trading Operations</div><h1 className="mt-2 text-2xl font-bold text-white">Spot / Long-Term Trade</h1><p className="mt-2 text-sm text-slate-500">Control the separate spot market-order mode without changing existing short-term trade rules.</p></section>
  <form onSubmit={save} className="rounded-3xl border border-white/10 bg-[#0a0e1a] p-5 space-y-5">
   <label className="flex items-center justify-between rounded-2xl border border-white/10 bg-[#050812] p-4"><span><span className="block text-sm font-semibold">Spot trading</span><span className="block mt-1 text-xs text-slate-500">Allow users to submit spot market orders.</span></span><input type="checkbox" checked={enabled} onChange={e=>setEnabled(e.target.checked)} className="h-5 w-5"/></label>
   <div><label className="text-xs text-slate-500">Maximum order value (USDT)</label><input type="number" min="1" step="0.01" value={max} onChange={e=>setMax(e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-[#050812] px-3 py-3 text-sm text-white"/></div>
   <div className="grid gap-4 sm:grid-cols-2">
    <label className="block"><span className="text-xs text-slate-500">Minimum order value (USDT)</span><input type="number" min="0.00000001" step="0.01" value={min} onChange={e=>setMin(e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-[#050812] px-3 py-3 text-sm text-white"/></label>
    <label className="block"><span className="text-xs text-slate-500">Maximum review-price slippage (bps)</span><input type="number" min="1" max="10000" step="1" value={slippage} onChange={e=>setSlippage(e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-[#050812] px-3 py-3 text-sm text-white"/><span className="mt-1 block text-[10px] text-slate-600">100 bps = 1%. Orders are rejected if the live fill price moves beyond this limit from the user's review quote.</span></label>
   </div>
   <div className="rounded-2xl border border-cyan-400/10 bg-cyan-400/5 p-4 text-xs text-slate-400"><div className="font-semibold text-cyan-300">Execution policy</div><p className="mt-2">Market orders execute against the server's current public market price and settle into the VexaTrade asset ledger. The existing short-term duration/payout rules are not used by this mode.</p></div>
   <button disabled={saving} className="w-full rounded-xl bg-cyan-400 py-3 text-sm font-bold text-black disabled:opacity-40">{saving?"Saving...":"Save Spot Controls"}</button>
  </form>
 </div>
}
