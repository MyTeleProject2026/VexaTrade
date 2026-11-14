import { useEffect, useMemo, useState } from "react";
import { RefreshCw, ShieldCheck, Trophy, XCircle, RotateCcw, Save } from "lucide-react";
import { adminApi, getApiErrorMessage } from "../../services/api";
import useToast from "../../components/ToastNotification";

const DEFAULTS = {
  enabled: "true",
  payout_rate: "88",
  platform_spread_fee: "0.03",
  risk_free_rate: "0.04",
  implied_volatility: "0.60",
  max_stake_usdt: "50000",
  cashout_enabled: "true",
  auto_settlement_enabled: "true",
  manual_outcome_override: "false",
  supported_pairs: "BTCUSDT,ETHUSDT",
};

const boolKeys = new Set(["enabled","cashout_enabled","auto_settlement_enabled","manual_outcome_override"]);

export default function AdminDigitalOptionsPage() {
  const token = localStorage.getItem("adminToken") || localStorage.getItem("admin_token") || "";
  const { addToast, ToastContainer } = useToast();
  const [rows,setRows]=useState([]);
  const [settings,setSettings]=useState(DEFAULTS);
  const [loading,setLoading]=useState(true);
  const [refreshing,setRefreshing]=useState(false);
  const [saving,setSaving]=useState(false);

  const load=async(initial=false)=>{
    try{
      initial?setLoading(true):setRefreshing(true);
      const [queue,config]=await Promise.all([
        adminApi.getDigitalOptionsPending(token),
        adminApi.getDigitalOptionsSettings(token),
      ]);
      setRows(Array.isArray(queue.data?.data)?queue.data.data:[]);
      const next={...DEFAULTS};
      for(const item of config.data?.data||[]) next[item.setting_key]=String(item.setting_value);
      setSettings(next);
    }catch(e){addToast(getApiErrorMessage(e),"error")}
    finally{setLoading(false);setRefreshing(false)}
  };

  useEffect(()=>{load(true)},[]);

  const stats=useMemo(()=>({
    active:rows.length,
    call:rows.filter(x=>String(x.direction).toUpperCase()==="CALL").length,
    put:rows.filter(x=>String(x.direction).toUpperCase()==="PUT").length,
    stake:rows.reduce((n,x)=>n+Number(x.stake_amount||0),0),
  }),[rows]);

  const update=(key,value)=>setSettings(p=>({...p,[key]:value}));

  const save=async()=>{
    try{
      setSaving(true);
      await adminApi.updateDigitalOptionsSettings({
        ...settings,
        payout_rate:Number(settings.payout_rate),
        platform_spread_fee:Number(settings.platform_spread_fee),
        risk_free_rate:Number(settings.risk_free_rate),
        implied_volatility:Number(settings.implied_volatility),
        max_stake_usdt:Number(settings.max_stake_usdt),
        enabled:settings.enabled==="true",
        cashout_enabled:settings.cashout_enabled==="true",
        auto_settlement_enabled:settings.auto_settlement_enabled==="true",
        manual_outcome_override:settings.manual_outcome_override==="true",
      },token);
      addToast("Long-Horizon Digital Options control settings saved.","success");
      await load(true);
    }catch(e){addToast(getApiErrorMessage(e),"error")}
    finally{setSaving(false)}
  };

  const override=async(tradeId,outcome)=>{
    if(settings.manual_outcome_override!=="true"){
      addToast("Manual settlement is disabled. Enable it in the control settings first.","error"); return;
    }
    if(!window.confirm(`Apply ${outcome.replace("FORCE_","")} settlement to Digital Option #${tradeId}?`)) return;
    try{
      await adminApi.overrideDigitalOption({tradeId,outcome,note:"Admin settlement console action"},token);
      addToast(`Digital Option #${tradeId} settled as ${outcome.replace("FORCE_","")}.`,"success");
      await load(true);
    }catch(e){addToast(getApiErrorMessage(e),"error")}
  };

  if(loading)return <div className="rounded-3xl border border-white/10 bg-[#0a0e1a] p-5 text-sm text-slate-300">Loading Long-Horizon Digital Options control...</div>;

  return <div className="space-y-4 text-xs">
    <ToastContainer/>
    <section className="rounded-3xl border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,.10),transparent_25%),#0a0e1a] p-4 sm:p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div><div className="text-[9px] uppercase tracking-[.3em] text-cyan-300">Trading Control Center · Long Horizon</div><h1 className="mt-1 text-xl font-bold text-white sm:text-2xl">Long-Horizon Digital Options</h1><p className="mt-1 text-[10px] leading-4 text-slate-500">Live active positions, settlement controls and audited WIN / LOSS / REFUND actions.</p></div>
        <button onClick={()=>load()} disabled={refreshing} className="rounded-xl border border-white/10 px-3 py-2 text-[10px] text-white"><RefreshCw size={13} className={refreshing?"mr-1 inline animate-spin":"mr-1 inline"}/>Refresh live queue</button>
      </div>
    </section>

    <section className="grid gap-2 sm:grid-cols-4">
      <div className="rounded-2xl border border-white/10 bg-[#0a0e1a] p-3"><span className="text-[9px] text-slate-500">Active</span><b className="mt-1 block text-xl text-amber-300">{stats.active}</b></div>
      <div className="rounded-2xl border border-white/10 bg-[#0a0e1a] p-3"><span className="text-[9px] text-slate-500">CALL</span><b className="mt-1 block text-xl text-emerald-300">{stats.call}</b></div>
      <div className="rounded-2xl border border-white/10 bg-[#0a0e1a] p-3"><span className="text-[9px] text-slate-500">PUT</span><b className="mt-1 block text-xl text-rose-300">{stats.put}</b></div>
      <div className="rounded-2xl border border-white/10 bg-[#0a0e1a] p-3"><span className="text-[9px] text-slate-500">Reserved stake</span><b className="mt-1 block text-xl text-cyan-300">{stats.stake.toLocaleString(undefined,{maximumFractionDigits:2})} USDT</b></div>
    </section>

    <section className="rounded-3xl border border-white/10 bg-[#0a0e1a] p-4">
      <div className="flex items-center justify-between gap-2"><div><h2 className="font-bold text-white">Settlement Control Console</h2><p className="mt-1 text-[9px] text-slate-500">Every manual settlement is executed by the server ledger and recorded in Digital Options audit history.</p></div><ShieldCheck size={18} className="text-cyan-300"/></div>
      <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {rows.map(t=> <article key={t.id} className="rounded-2xl border border-white/8 bg-[#050812] p-3">
          <div className="flex items-start justify-between gap-2"><div><b className="text-white">#{t.id} · {t.asset_pair}</b><div className="mt-1 text-[9px] text-slate-500">{t.email} · {t.direction} · {t.timeframe_code}</div></div><span className="rounded-full bg-amber-400/10 px-2 py-1 text-[8px] text-amber-300">ACTIVE</span></div>
          <div className="mt-3 grid grid-cols-2 gap-1 text-[9px]"><div className="rounded-lg bg-[#0a0e1a] p-2">Stake<b className="block text-white">{Number(t.stake_amount).toFixed(2)} USDT</b></div><div className="rounded-lg bg-[#0a0e1a] p-2">Strike<b className="block text-white">{Number(t.strike_price).toLocaleString()}</b></div><div className="rounded-lg bg-[#0a0e1a] p-2">Entry<b className="block text-white">{Number(t.entry_spot_price).toLocaleString()}</b></div><div className="rounded-lg bg-[#0a0e1a] p-2">Expires<b className="block text-white">{new Date(t.expiration_time).toLocaleString()}</b></div></div>
          <div className="mt-2 grid grid-cols-3 gap-1">
            <button disabled={settings.manual_outcome_override!=="true"} onClick={()=>override(t.id,"FORCE_WIN")} className="rounded-lg bg-emerald-400/10 py-2 text-[9px] font-bold text-emerald-300 disabled:cursor-not-allowed disabled:opacity-30"><Trophy size={11} className="mr-1 inline"/>WIN</button>
            <button disabled={settings.manual_outcome_override!=="true"} onClick={()=>override(t.id,"FORCE_LOSS")} className="rounded-lg bg-rose-400/10 py-2 text-[9px] font-bold text-rose-300 disabled:cursor-not-allowed disabled:opacity-30"><XCircle size={11} className="mr-1 inline"/>LOSS</button>
            <button disabled={settings.manual_outcome_override!=="true"} onClick={()=>override(t.id,"FORCE_REFUND")} className="rounded-lg bg-cyan-400/10 py-2 text-[9px] font-bold text-cyan-300 disabled:cursor-not-allowed disabled:opacity-30"><RotateCcw size={11} className="mr-1 inline"/>REFUND</button>
          </div>
        </article>)}
      </div>
      {!rows.length&&<div className="mt-3 rounded-2xl border border-white/5 bg-[#050812] p-5 text-center text-[9px] text-slate-600">No active Long-Horizon Digital Options are awaiting settlement.</div>}
    </section>

    <section className="rounded-3xl border border-cyan-400/10 bg-[#0a0e1a] p-4">
      <div className="flex items-center justify-between"><div><h2 className="font-bold text-white">Live Settlement Settings</h2><p className="mt-1 text-[9px] text-slate-500">These values are persisted server-side and consumed by the order, cash-out and settlement engines.</p></div><Save size={16} className="text-cyan-300"/></div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {[["payout_rate","Payout rate (%)"],["platform_spread_fee","Cash-out spread fee"],["risk_free_rate","Risk-free rate"],["implied_volatility","Implied volatility"],["max_stake_usdt","Maximum stake (USDT)"],["supported_pairs","Supported markets"]].map(([key,label])=><label key={key} className="rounded-xl bg-[#050812] p-3 text-[9px] text-slate-500">{label}<input value={settings[key]??""} onChange={e=>update(key,e.target.value)} className="mt-1.5 w-full rounded-lg border border-white/10 bg-[#0a0e1a] px-2.5 py-2 text-xs text-white"/></label>)}
      </div>
      <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {[["enabled","Trading enabled"],["cashout_enabled","Early cash-out enabled"],["auto_settlement_enabled","Automatic expiry settlement"],["manual_outcome_override","Manual WIN / LOSS / REFUND controls"]].map(([key,label])=><label key={key} className="flex items-center justify-between rounded-xl bg-[#050812] p-3 text-[9px] text-slate-300">{label}<select value={settings[key]} onChange={e=>update(key,e.target.value)} className="ml-2 rounded-lg border border-white/10 bg-[#0a0e1a] px-2 py-1.5 text-[9px] text-white"><option value="true">Enabled</option><option value="false">Disabled</option></select></label>)}
      </div>
      <button disabled={saving} onClick={save} className="mt-3 w-full rounded-xl bg-cyan-400 py-2.5 text-[10px] font-bold text-black disabled:opacity-40">{saving?"Saving...":"Save live Digital Options controls"}</button>
    </section>
  </div>;
}
