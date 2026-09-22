import { useEffect,useMemo,useState } from "react";
import { Activity,Clock3,TrendingDown,TrendingUp,Wallet } from "lucide-react";
import { useNavigate } from "react-router-dom";
import MarketChart from "../../../components/MarketChart";
import OrderBook from "../../../components/OrderBook";
import { tradeApi } from "../../../services/api";
import TradeSectionLayout from "../TradeSectionLayout";

const KEY="vexa_short_term_active_position";
const token=()=>localStorage.getItem("userToken")||localStorage.getItem("token")||localStorage.getItem("accessToken")||"";
const endOf=t=>t?.endTime||t?.end_time||t?.endsAt||t?.ends_at||t?.expiresAt||t?.expires_at||null;
const startOf=t=>t?.startTime||t?.start_time||t?.createdAt||t?.created_at||null;
const left=(end,now)=>{const ms=new Date(end||0).getTime()-now;return Number.isFinite(ms)?Math.max(0,Math.ceil(ms/1000)):0};
const fmt=s=>{const n=Math.max(0,Math.floor(Number(s)||0));return `${String(Math.floor(n/60)).padStart(2,"0")}:${String(n%60).padStart(2,"0")}`};
const price=v=>Number(v||0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:8});
const pct=v=>`${v>=0?"+":""}${Number(v||0).toFixed(2)}%`;

export default function ShortTermPositionPage(){
 const navigate=useNavigate();
 const [trade,setTrade]=useState(null),[live,setLive]=useState(0),[now,setNow]=useState(Date.now()),[error,setError]=useState(""),[settling,setSettling]=useState(false);
 const auth=token();
 useEffect(()=>{try{const x=JSON.parse(sessionStorage.getItem(KEY)||"null");if(!x){navigate("/trade/short-term/trade",{replace:true});return}setTrade(x)}catch{navigate("/trade/short-term/trade",{replace:true})}},[navigate]);
 useEffect(()=>{const id=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(id)},[]);
 useEffect(()=>{if(!trade?.pair)return;let closed=false,ws;try{ws=new WebSocket(`wss://stream.binance.com:9443/ws/${String(trade.pair).toLowerCase()}@ticker`);ws.onmessage=e=>{try{const p=Number(JSON.parse(e.data)?.c);if(!closed&&p>0)setLive(p)}catch{}};ws.onerror=()=>{if(!closed)setError("Live market stream disconnected; waiting for the next quote.")}}catch{setError("Unable to connect to live market stream.")}return()=>{closed=true;try{ws?.close()}catch{}}},[trade]);
 const remaining=trade?left(endOf(trade),now):0;
 const elapsed=trade&&startOf(trade)?Math.max(0,Math.floor((now-new Date(startOf(trade)).getTime())/1000)):0;
 const entry=Number(trade?.entryPrice||trade?.entry_price||0),amount=Number(trade?.amount||0);
 const move=entry>0&&live>0?((live-entry)/entry)*100:0;
 useEffect(()=>{if(!trade||remaining>0||settling)return;setSettling(true);const id=Number(trade.id||trade.tradeId||0);let cancelled=false;let attempts=0;const check=async()=>{if(cancelled)return;attempts++;try{const r=await tradeApi.history(auth);const rows=Array.isArray(r.data?.data)?r.data.data:[];const done=rows.find(x=>Number(x?.id)===id&&["win","loss","tie","completed","settled"].includes(String(x?.result||x?.status||"").toLowerCase()));if(done){sessionStorage.setItem("vexa_short_term_receipt",JSON.stringify(done));sessionStorage.removeItem(KEY);navigate("/trade/short-term/result",{replace:true});return}}catch{}if(attempts<30)setTimeout(check,1000);else{sessionStorage.removeItem(KEY);navigate("/trade/short-term/history",{replace:true})}};void check();return()=>{cancelled=true}},[remaining,trade,auth,navigate,settling]);
 if(!trade)return <TradeSectionLayout title="Live Position" subtitle="Preparing live position" mode="short"><div className="rounded-2xl bg-[#0a0e1a] p-4 text-xs text-slate-400">Preparing live position…</div></TradeSectionLayout>;
 const isBuy=String(trade.direction||"bullish").toLowerCase()==="bullish";
 return <TradeSectionLayout title="Live Position" subtitle="Short-Term position · live market and countdown" mode="short"><div className="space-y-2.5">
  <section className="rounded-2xl border border-cyan-400/20 bg-[#0a0e1a] p-3"><div className="flex items-center justify-between"><div><div className="text-[8px] uppercase tracking-[.25em] text-cyan-300">LIVE POSITION</div><h1 className="mt-1 text-lg font-bold">{trade.pair}</h1><div className={isBuy?"text-[9px] text-emerald-300":"text-[9px] text-red-300"}>{isBuy?"BUY / BULLISH":"SELL / BEARISH"} · SETTLEMENT PENDING</div></div><div className="text-right"><div className="text-[8px] text-slate-500">TIME LEFT</div><div className="text-3xl font-bold tabular-nums text-cyan-300">{fmt(remaining)}</div><div className="text-[8px] text-slate-600">Elapsed {elapsed}s</div></div></div>
   <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full bg-cyan-400 transition-[width] duration-700" style={{width:`${Math.max(0,Math.min(100,(remaining/Math.max(1,Number(trade.timer||trade.timer_seconds||60)))*100))}%`}}/></div>
   <div className="mt-3 grid grid-cols-2 gap-1.5 sm:grid-cols-4"><div className="rounded-xl bg-[#050812] p-2"><div className="text-[8px] text-slate-600">STAKE</div><b className="text-xs">{amount.toFixed(2)} USDT</b></div><div className="rounded-xl bg-[#050812] p-2"><div className="text-[8px] text-slate-600">ENTRY</div><b className="text-xs">{price(entry)}</b></div><div className="rounded-xl bg-[#050812] p-2"><div className="text-[8px] text-slate-600">LIVE MARKET</div><b className="text-xs text-cyan-300">{live?price(live):"Streaming…"}</b></div><div className="rounded-xl bg-[#050812] p-2"><div className="text-[8px] text-slate-600">MARKET MOVE</div><b className={move>=0?"text-xs text-emerald-300":"text-xs text-red-300"}>{pct(move)}</b></div></div>
  </section>
  <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#0a0e1a] p-2.5"><MarketChart symbol={trade.pair} interval="1m" height={260}/></section>
  <OrderBook symbol={trade.pair} currentPrice={live}/>
  {error&&<div className="rounded-xl bg-red-500/10 p-2 text-[9px] text-red-300">{error}</div>}
  <div className="rounded-xl border border-amber-400/10 bg-amber-400/5 p-2.5 text-[9px] text-slate-500"><Clock3 size={12} className="mr-1 inline text-amber-300"/>{settling?"Timer completed. Waiting for authoritative WIN/LOSS settlement receipt…":"The position stays here until the server expiry time. No close button and no manual Live View action are available."}</div>
 </div></TradeSectionLayout>;
}