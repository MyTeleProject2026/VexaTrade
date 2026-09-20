import { useEffect,useMemo,useState } from "react";
import { useNavigate,useParams } from "react-router-dom";
import { ArrowLeft,RefreshCw } from "lucide-react";
import { userApi,getApiErrorMessage } from "../services/api";
import { useNotification } from "../hooks/useNotification";
const date=v=>{const d=new Date(v);return Number.isNaN(d.getTime())?"—":d.toLocaleString();};
export default function AssetHistoryPage(){
 const {coin:raw}=useParams();const coin=String(raw||"").toUpperCase();const nav=useNavigate();const {showError}=useNotification();const token=localStorage.getItem("userToken")||localStorage.getItem("token")||localStorage.getItem("accessToken")||"";
 const [rows,setRows]=useState([]),[loading,setLoading]=useState(true),[refreshing,setRefreshing]=useState(false),[error,setError]=useState("");
 async function load(silent){try{silent?setRefreshing(true):setLoading(true);setError("");const r=await userApi.getTransactions(token);const d=r?.data?.data||r?.data;setRows(Array.isArray(d)?d:(Array.isArray(d?.transactions)?d.transactions:[]));}catch(e){setError(getApiErrorMessage(e));if(!silent)showError(getApiErrorMessage(e));}finally{setLoading(false);setRefreshing(false);}}
 useEffect(()=>{load(false);},[]);
 const filtered=useMemo(()=>rows.filter(t=>JSON.stringify(t).toUpperCase().includes(coin)),[rows,coin]);
 return <div className="min-h-screen bg-[#050812] px-3 pb-24 pt-3 text-white sm:px-5 xl:pb-8"><div className="mx-auto max-w-[1000px] space-y-4">
 <header className="flex items-center gap-3"><button onClick={()=>nav("/assets/"+encodeURIComponent(coin))} className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10"><ArrowLeft size={19}/></button><div className="flex-1"><div className="text-lg font-bold">{coin} History</div><div className="text-xs text-slate-500">Wallet activity for this asset</div></div><button onClick={()=>load(true)} className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10"><RefreshCw size={17} className={refreshing?"animate-spin":""}/></button></header>
 {error&&<div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300">{error}</div>}
 {loading?<div className="rounded-2xl bg-[#0a0e1a] p-5 text-sm text-slate-400">Loading history...</div>:filtered.length===0?<div className="rounded-2xl border border-white/10 bg-[#0a0e1a] p-8 text-center text-sm text-slate-400">No {coin} transactions found.</div>:<div className="space-y-2">{filtered.map((t,i)=><div key={t.id||t.transaction_id||i} className="rounded-2xl border border-white/10 bg-[#0a0e1a] p-4"><div className="flex items-start justify-between gap-3"><div><div className="text-sm font-semibold capitalize">{String(t.type||t.transaction_type||t.title||"Transaction").replace(/_/g," ")}</div><div className="mt-1 text-xs text-slate-500">{date(t.created_at||t.createdAt||t.timestamp||t.date)}</div></div><div className="text-right text-sm font-semibold">{t.amount??t.value??"—"} {t.coin||t.asset||coin}</div></div><div className="mt-2 text-xs text-slate-500">{t.status||"completed"}{t.reference_id?" • Ref "+t.reference_id:""}</div></div>)}</div>}
 </div></div>;
}