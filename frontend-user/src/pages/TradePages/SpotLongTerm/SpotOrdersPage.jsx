import { useEffect,useRef,useState } from "react";
import { Activity, ClipboardList, RefreshCw } from "lucide-react";
import { spotTradeApi } from "../../../services/api";
import TradeSectionLayout from "../TradeSectionLayout";

const token=()=>localStorage.getItem("userToken")||localStorage.getItem("token")||localStorage.getItem("accessToken")||"";

function liveTime(value){
  if(!value) return "—";
  try{return new Date(value).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit",second:"2-digit"});}catch{return String(value);}
}

export default function SpotOrdersPage(){
  const [rows,setRows]=useState([]),[loading,setLoading]=useState(true),[refreshing,setRefreshing]=useState(false),[error,setError]=useState("");
  const pollingRef=useRef(false);

  const load=async(showSpinner=false)=>{
    if(pollingRef.current)return;
    pollingRef.current=true;
    if(showSpinner)setRefreshing(true);
    try{
      const r=await spotTradeApi.orders(token());
      setRows(Array.isArray(r.data?.data)?r.data.data:[]);
      setError("");
    }catch(e){if(showSpinner)setError(e?.message||"Unable to load Spot orders");}
    finally{pollingRef.current=false;if(showSpinner)setRefreshing(false);setLoading(false);}
  };

  useEffect(()=>{
    void load();
    const interval=setInterval(()=>void load(false),1000);
    return()=>clearInterval(interval);
  },[]);

  return <TradeSectionLayout title="Spot Orders" subtitle="Live server execution and order stream" mode="spot">
    <section className="rounded-2xl border border-white/10 bg-[#0a0e1a]/90 p-3 shadow-[0_12px_35px_rgba(0,0,0,0.2)]">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-semibold">
          <ClipboardList size={15} className="text-cyan-300"/>Orders
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/15 bg-emerald-400/5 px-1.5 py-0.5 text-[8px] text-emerald-300">
            <Activity size={9}/> LIVE 1s
          </span>
        </div>
        <button onClick={()=>load(true)} disabled={refreshing} className="rounded-xl border border-white/10 bg-white/[0.03] p-2 text-slate-400 transition hover:border-cyan-300/20 hover:bg-cyan-300/[0.05] hover:text-cyan-200 active:scale-[0.98]">
          <RefreshCw size={13} className={refreshing?"animate-spin":""}/>
        </button>
      </div>
      {error&&<div className="mt-2 rounded-lg border border-red-500/15 bg-red-500/10 p-2 text-[9px] text-red-300">{error}</div>}
      <div className="mt-3 space-y-2">
        {!loading&&!rows.length&&<div className="py-10 text-center text-[10px] text-slate-600">No Spot orders yet.</div>}
        {rows.map((o,i)=>{
          const status=String(o.status||"filled").toLowerCase();
          const filled=["filled","completed","settled"].includes(status);
          return <div key={o.id||i} className="rounded-xl border border-white/5 bg-[#050812] p-3 text-[10px]">
            <div className="flex items-center justify-between gap-2">
              <div className="font-semibold"><span className="text-white">{o.symbol||"—"}</span> <span className={String(o.side||"").toLowerCase()==="buy"?"text-emerald-300":"text-red-300"}>· {String(o.side||"").toUpperCase()}</span></div>
              <span className={filled?"text-emerald-300":"text-amber-300"}>{filled?"✓ FILLED":"● "+String(o.status||"PENDING").toUpperCase()}</span>
            </div>
            <div className="mt-1 grid grid-cols-3 gap-2 text-[9px]">
              <div><span className="text-slate-600">Qty</span><div className="text-slate-300">{o.quantity??"—"}</div></div>
              <div><span className="text-slate-600">Execution</span><div className="text-cyan-300">{o.execution_price||o.executionPrice||"—"}</div></div>
              <div><span className="text-slate-600">Time</span><div className="text-slate-400">{liveTime(o.filled_at||o.updated_at||o.created_at)}</div></div>
            </div>
            <div className="mt-2 flex items-center justify-between border-t border-white/5 pt-2 text-[8px] text-slate-600">
              <span>Order #{o.id}</span><span>{o.outcome?String(o.outcome).toUpperCase():"MARKET EXECUTION"}</span>
            </div>
          </div>;
        })}
      </div>
    </section>
  </TradeSectionLayout>;
}