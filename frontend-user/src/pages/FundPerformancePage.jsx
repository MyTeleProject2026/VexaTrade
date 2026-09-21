import { useEffect,useState } from "react";
import { useNavigate,useParams } from "react-router-dom";
import { ArrowLeft, FileClock, ReceiptText, History, ShieldCheck } from "lucide-react";
import FundsLiveActivity from "../components/funds/FundsLiveActivity";
import { fundsApi } from "../services/api";
const token=()=>localStorage.getItem("userToken")||localStorage.getItem("token")||localStorage.getItem("accessToken")||"";
const money=v=>Number(v||0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:8});
export default function FundPerformancePage(){
 const {fundId}=useParams(); const nav=useNavigate(); const [fund,setFund]=useState(null); const [loading,setLoading]=useState(true); const [error,setError]=useState("");
 useEffect(()=>{let mounted=true;setLoading(true);fundsApi.getById(fundId,token()).then(r=>{if(mounted)setFund(r?.data?.data||null)}).catch(e=>mounted&&setError(e?.response?.data?.message||"Fund could not be loaded.")).finally(()=>mounted&&setLoading(false));return()=>{mounted=false}},[fundId]);
 return <div className="min-h-screen bg-[#050812] p-3 pb-24 sm:p-5"><div className="mx-auto max-w-6xl">
  <button onClick={()=>nav("/funds/active")} className="mb-3 inline-flex items-center gap-1 text-xs text-slate-400"><ArrowLeft size={13}/> Active Trust Funds</button>
  {loading?<div className="rounded-xl border border-white/10 bg-[#0a0e1a] p-4 text-xs text-slate-400">Loading Fund…</div>:!fund?<div className="rounded-xl border border-white/10 bg-[#0a0e1a] p-4 text-xs text-slate-400">{error||"Trust Fund not found."}</div>:<>
   <div className="rounded-2xl border border-white/10 bg-[#0a0e1a] p-4 shadow-lg">
    <div className="flex items-start justify-between gap-3"><div><div className="text-[9px] uppercase tracking-widest text-cyan-300">Fund #{fund.id}</div><h1 className="mt-1 text-xl font-bold text-white">{fund.plan_name||"Trust Fund Plan"}</h1><div className="mt-1 text-[10px] text-slate-500">{fund.total_days} days · {String(fund.status||"").toUpperCase()}</div></div><ShieldCheck size={18} className="text-emerald-400"/></div>
    <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 text-[10px]"><div className="rounded-lg bg-[#050812] p-2"><span className="text-slate-500">Principal</span><b className="block text-white">{money(fund.locked_principal)} USDT</b></div><div className="rounded-lg bg-[#050812] p-2"><span className="text-slate-500">Earned profit</span><b className="block text-emerald-300">+{money(fund.earned_profit)} USDT</b></div><div className="rounded-lg bg-[#050812] p-2"><span className="text-slate-500">Daily rate</span><b className="block text-cyan-300">{Number(fund.selected_daily_profit_percent||0).toFixed(4)}%</b></div><div className="rounded-lg bg-[#050812] p-2"><span className="text-slate-500">Progress</span><b className="block text-white">Day {fund.display_current_day ?? fund.current_day ?? 0}/{fund.total_days||0}</b></div></div>
    <div className="mt-3 flex flex-wrap gap-2"><button onClick={()=>nav(`/funds/active/${fund.id}/profits`)} className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2.5 py-1.5 text-[10px] text-slate-300"><FileClock size={11}/> Profit history</button><button onClick={()=>nav(`/funds/active/${fund.id}/transactions`)} className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2.5 py-1.5 text-[10px] text-slate-300"><ReceiptText size={11}/> Transactions</button>{String(fund.status).toLowerCase()==="completed"&&<button onClick={()=>nav(`/funds/history/voucher/${fund.id}`)} className="inline-flex items-center gap-1 rounded-lg border border-cyan-400/20 px-2.5 py-1.5 text-[10px] text-cyan-300"><History size={11}/> Voucher</button>}</div>
   </div>
   {String(fund.status).toLowerCase()==="active"&&<div className="mt-3"><FundsLiveActivity compact onFundClick={id=>nav(`/funds/active/${id}/performance`)}/></div>}
  </>}
 </div></div>
}