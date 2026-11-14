import { useEffect, useState } from "react";
import { RefreshCw, Save, ShieldCheck } from "lucide-react";
import { adminApi, getApiErrorMessage } from "../../services/api";
import useToast from "../../components/ToastNotification";

const FIELDS=[
  ["payout_rate","Payout rate (%)","number"],["platform_spread_fee","Cash-out spread fee","number"],
  ["risk_free_rate","Risk-free rate","number"],["implied_volatility","Implied volatility","number"],
  ["max_stake_usdt","Maximum stake (USDT)","number"],["supported_pairs","Supported markets","text"],
];
const TOGGLES=[
  ["enabled","New Digital Options orders"],
  ["cashout_enabled","Early cash-out"],
  ["auto_settlement_enabled","Automatic maturity settlement"],
  ["manual_outcome_override","Admin WIN / LOSS / REFUND controls"],
];

export default function AdminDigitalOptionsRulesPage(){
 const token=localStorage.getItem("adminToken")||localStorage.getItem("admin_token")||"";
 const {addToast,ToastContainer}=useToast();
 const [settings,setSettings]=useState({});
 const [loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[refreshing,setRefreshing]=useState(false);

 const load=async(initial=true)=>{
  try{
   initial?setLoading(true):setRefreshing(true);
   const r=await adminApi.getDigitalOptionsSettings(token);
   const next={};
   for(const x of r.data?.data||[]) next[x.setting_key]=String(x.setting_value);
   setSettings(next);
  }catch(e){addToast(getApiErrorMessage(e),"error")}
  finally{setLoading(false);setRefreshing(false)}
 };
 useEffect(()=>{load(true)},[]);
 const set=(k,v)=>setSettings(p=>({...p,[k]:v}));
 const save=async()=>{
  try{
   setSaving(true);
   const payload={...settings};
   for(const [k] of FIELDS)if(k!=="supported_pairs")payload[k]=Number(settings[k]);
   for(const [k] of TOGGLES)payload[k]=settings[k]==="true";
   await adminApi.updateDigitalOptionsSettings(payload,token);
   addToast("Long-Horizon Digital Options rules saved and applied to the live engine.","success");
   await load(true);
  }catch(e){addToast(getApiErrorMessage(e),"error")}
  finally{setSaving(false)}
 };

 if(loading)return <div className="rounded-3xl border border-white/10 bg-[#0a0e1a] p-5 text-sm text-slate-300">Loading Digital Options rules...</div>;

 return <div className="space-y-4 text-xs">
  <ToastContainer/>
  <section className="rounded-3xl border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(124,58,237,.10),transparent_25%),#0a0e1a] p-4 sm:p-5">
   <div className="text-[9px] uppercase tracking-[.3em] text-cyan-300">Trading &amp; Funds Control · Rules</div>
   <div className="mt-1 flex items-center justify-between gap-3"><div><h1 className="text-xl font-bold text-white sm:text-2xl">Long-Horizon Digital Options Rules</h1><p className="mt-1 text-[10px] leading-4 text-slate-500">Authoritative settings for order placement, Black-Scholes probability inputs, cash-out and maturity settlement.</p></div><button onClick={()=>load(false)} disabled={refreshing} className="rounded-xl border border-white/10 px-3 py-2 text-[9px]"><RefreshCw size={13} className={refreshing?"mr-1 inline animate-spin":"mr-1 inline"}/>Refresh</button></div>
  </section>

  <section className="rounded-3xl border border-white/10 bg-[#0a0e1a] p-4">
   <div className="flex items-center gap-2 text-xs font-bold text-white"><ShieldCheck size={15} className="text-cyan-300"/>Market &amp; pricing rules</div>
   <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
    {FIELDS.map(([key,label,type])=><label key={key} className="rounded-xl bg-[#050812] p-3 text-[9px] text-slate-500">{label}<input type={type} value={settings[key]??""} onChange={e=>set(key,e.target.value)} className="mt-1.5 w-full rounded-lg border border-white/10 bg-[#0a0e1a] px-2.5 py-2.5 text-xs text-white"/></label>)}
   </div>
  </section>

  <section className="rounded-3xl border border-emerald-400/10 bg-[#0a0e1a] p-4">
   <div className="text-xs font-bold text-emerald-300">Settlement &amp; outcome controls</div>
   <div className="mt-3 grid gap-2 sm:grid-cols-2">
    {TOGGLES.map(([key,label])=><label key={key} className="flex items-center justify-between rounded-xl bg-[#050812] p-3 text-[9px] text-slate-300"><span>{label}<span className="mt-1 block text-[8px] text-slate-600">{key==="manual_outcome_override"?"Required before the admin WIN / LOSS / REFUND buttons can execute.":"Server-side master control."}</span></span><select value={settings[key]??"false"} onChange={e=>set(key,e.target.value)} className="rounded-lg border border-white/10 bg-[#0a0e1a] px-2 py-1.5 text-[9px] text-white"><option value="true">Enabled</option><option value="false">Disabled</option></select></label>)}
   </div>
  </section>

  <section className="rounded-3xl border border-amber-400/10 bg-amber-400/5 p-4">
   <div className="text-xs font-bold text-amber-300">Control flow</div>
   <div className="mt-2 grid gap-2 md:grid-cols-3 text-[9px] text-slate-500">
    <div className="rounded-xl bg-[#050812] p-3"><b className="text-white">1 · Configure</b><p className="mt-1">Set markets, stake limits, payout and model inputs.</p></div>
    <div className="rounded-xl bg-[#050812] p-3"><b className="text-white">2 · Apply</b><p className="mt-1">Save settings to the server-side control table used by the engine.</p></div>
    <div className="rounded-xl bg-[#050812] p-3"><b className="text-white">3 · Settle</b><p className="mt-1">Automatic maturity settlement remains market-price based; manual actions require the explicit override switch.</p></div>
   </div>
  </section>

  <button disabled={saving} onClick={save} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-cyan-400 py-3 text-[11px] font-bold text-black disabled:opacity-40"><Save size={14}/>{saving?"Saving rules...":"Save & Apply Digital Options Rules"}</button>
 </div>;
}
