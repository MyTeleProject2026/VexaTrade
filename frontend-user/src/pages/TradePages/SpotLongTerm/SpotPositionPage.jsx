import { useEffect,useMemo,useState } from "react";
import { Activity,ArrowRightLeft,ChartCandlestick,ShieldCheck,Wallet,Clock3 } from "lucide-react";
import { useNavigate,useParams } from "react-router-dom";
import MarketChart from "../../../components/MarketChart";
import OrderBook from "../../../components/OrderBook";
import { spotTradeApi,userApi,getApiErrorMessage } from "../../../services/api";

const ACTIVE="vexa_spot_long_term_active_position";
const RECEIPT="vexa_spot_long_term_receipt";
const token=()=>localStorage.getItem("userToken")||localStorage.getItem("token")||localStorage.getItem("accessToken")||"";
const money=v=>Number(v||0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:8});
const qty=v=>Number(v||0).toLocaleString(undefined,{maximumFractionDigits:8});
const listOf=v=>Array.isArray(v)?v:Array.isArray(v?.orders)?v.orders:Array.isArray(v?.data)?v.data:[];
const baseOf=s=>{const x=String(s||"").toUpperCase();return x.endsWith("USDT")?x.slice(0,-4):x};

export default function SpotPositionPage(){
 const navigate=useNavigate();
 const {symbol="BTCUSDT"}=useParams();
 const pair=String(symbol||"BTCUSDT").toUpperCase();
 const base=baseOf(pair);
 const auth=token();
 const [position,setPosition]=useState(null),[orders,setOrders]=useState([]),[assets,setAssets]=useState([]),[settings,setSettings]=useState(null);
 const [price,setPrice]=useState(0),[now,setNow]=useState(Date.now()),[error,setError]=useState(""),[syncing,setSyncing]=useState(false);

 useEffect(()=>{try{const p=JSON.parse(sessionStorage.getItem(ACTIVE)||"null");if(p)setPosition(p)}catch{}},[]);
 useEffect(()=>{const id=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(id)},[]);

 useEffect(()=>{
  let dead=false,ws;
  try{
   ws=new WebSocket("wss://stream.binance.com:9443/ws/"+pair.toLowerCase()+"@ticker");
   ws.onmessage=e=>{try{const p=Number(JSON.parse(e.data)?.c);if(!dead&&p>0)setPrice(p)}catch{}};
   ws.onerror=()=>{if(!dead)setError("Live market stream disconnected; waiting for a fresh quote.")};
  }catch{setError("Unable to connect to the live market stream.")}
  return()=>{dead=true;try{ws?.close()}catch{}};
 },[pair]);

 const load=async()=>{
  setSyncing(true);
  try{
   const [o,a,s]=await Promise.all([spotTradeApi.orders(auth),userApi.getUserAssets(auth),spotTradeApi.settings(auth)]);
   setOrders(listOf(o.data?.data));
   const ad=a.data?.data;
   setAssets(Array.isArray(ad?.assets)?ad.assets:Array.isArray(ad)?ad:[]);
   setSettings(s.data?.data||null);
   setError("");
  }catch(e){setError(getApiErrorMessage(e))}
  finally{setSyncing(false)}
 };
 useEffect(()=>{void load();const interval=Math.max(1000,Number(settings?.pnlRefreshSeconds||5)*1000);const id=setInterval(()=>void load(),interval);return()=>clearInterval(id)},[auth,settings?.pnlRefreshSeconds]);

 const latest=useMemo(()=>{
  if(position)return position;
  return orders.find(o=>String(o?.symbol||"").toUpperCase()===pair&&String(o?.side||"").toLowerCase()==="buy")||null;
 },[position,orders,pair]);

 const entry=Number(latest?.executionPrice??latest?.execution_price??0);
 const amount=Number(latest?.quantity||0);
 const openedAt=latest?.filledAt||latest?.filled_at||latest?.createdAt||latest?.created_at||null;
 const openedMs=openedAt?new Date(openedAt).getTime():now;
 const elapsed=Math.max(0,Math.floor((now-openedMs)/1000));
 const elapsedFmt=`${String(Math.floor(elapsed/3600)).padStart(2,"0")}:${String(Math.floor((elapsed%3600)/60)).padStart(2,"0")}:${String(elapsed%60).padStart(2,"0")}`;
 const side=String(latest?.side||"buy").toLowerCase();
 const livePnl=entry>0&&price>0?(side==="buy"?(price-entry)*amount:(entry-price)*amount):0;
 const livePct=entry>0&&price>0?(side==="buy"?(price-entry)/entry:(entry-price)/entry)*100:0;
 const asset=assets.find(a=>String(a?.coin||a?.symbol||"").toUpperCase()===base);
 const balance=Number(asset?.available_balance??asset?.availableBalance??asset?.balance??0);
 const locked=Number(asset?.locked_balance??asset?.lockedBalance??asset?.locked??0);
 const pnlEnabled=settings?.pnlEnabled!==false;
 const status=String(latest?.status||"filled").toLowerCase();
 const outcome=String(latest?.outcome||"").toLowerCase();

 useEffect(()=>{
  if(!position||side!=="sell")return;
  sessionStorage.setItem(RECEIPT,JSON.stringify(position));
  sessionStorage.removeItem(ACTIVE);
  navigate("/trade/spot/long-term/result",{replace:true});
 },[position,side,navigate]);

 if(!latest){
  return <div className="fixed inset-0 z-[90] flex items-center justify-center bg-[#030712] p-5 text-xs text-slate-400">Preparing live Spot / Long-Term position…</div>;
 }

 return <div className="fixed inset-0 z-[90] min-h-screen overflow-y-auto bg-[#030712] text-white">
  <header className="sticky top-0 z-30 border-b border-white/10 bg-[#050812]/95 px-4 py-3 backdrop-blur-xl sm:px-6 lg:px-8">
   <div className="flex items-center justify-between gap-4">
    <div className="min-w-0">
     <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[.32em] text-cyan-300"><Activity size={13}/>LIVE POSITION · SPOT / LONG-TERM</div>
     <div className="mt-1 flex items-center gap-2"><h1 className="text-xl font-black sm:text-2xl">{pair}</h1><span className={side==="buy"?"rounded-full bg-emerald-400/10 px-2 py-1 text-[8px] font-bold text-emerald-300":"rounded-full bg-red-400/10 px-2 py-1 text-[8px] font-bold text-red-300"}>{side.toUpperCase()}</span></div>
     <div className="mt-1 text-[9px] text-slate-500">Market position remains open until the user executes the corresponding market sell. No browser-side settlement.</div>
    </div>
    <div className="shrink-0 text-right">
     <div className="text-[8px] uppercase tracking-[.25em] text-slate-600">LIVE MARKET</div>
     <div className="text-3xl font-black tabular-nums text-cyan-300 sm:text-5xl">{price?money(price):"Streaming…"}</div>
     <div className="mt-1 text-[8px] text-emerald-300">● LIVE TICK · {new Date(now).toLocaleTimeString()}</div>
    </div>
   </div>
  </header>

  <main className="w-full p-3 sm:p-5 lg:p-7">
   <section className="grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(360px,.55fr)]">
    <div className="min-w-0 space-y-4">
     <section className="rounded-[32px] border border-cyan-400/20 bg-[radial-gradient(circle_at_top,rgba(34,211,238,.15),transparent_58%),#0a0e1a] p-4 shadow-[0_28px_100px_rgba(0,0,0,.42)] sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
       <div><div className="text-[9px] font-bold uppercase tracking-[.3em] text-cyan-300">FULL-SCREEN LIVE POSITION</div><div className="mt-1 text-sm font-bold text-white">{pair} · {side.toUpperCase()} · {status.toUpperCase()}</div></div>
       <div className="flex items-center gap-2 rounded-full border border-emerald-400/15 bg-emerald-400/5 px-3 py-1.5 text-[9px] font-bold text-emerald-300"><span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400"/>POSITION LIVE</div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
       <div className="rounded-2xl bg-[#050812] p-3"><div className="text-[8px] uppercase text-slate-600">ENTRY PRICE</div><b className="mt-1 block text-base sm:text-lg">{money(entry)}</b></div>
       <div className="rounded-2xl bg-[#050812] p-3"><div className="text-[8px] uppercase text-slate-600">LIVE PRICE</div><b className="mt-1 block text-base text-cyan-300 sm:text-lg">{price?money(price):"—"}</b></div>
       <div className="rounded-2xl bg-[#050812] p-3"><div className="text-[8px] uppercase text-slate-600">LIVE P/L</div><b className={livePnl>=0?"mt-1 block text-base text-emerald-300 sm:text-lg":"mt-1 block text-base text-red-300 sm:text-lg"}>{pnlEnabled?(livePnl>=0?"+":"")+money(livePnl):"Hidden"}</b></div>
       <div className="rounded-2xl bg-[#050812] p-3"><div className="text-[8px] uppercase text-slate-600">MARKET MOVE</div><b className={livePct>=0?"mt-1 block text-base text-emerald-300 sm:text-lg":"mt-1 block text-base text-red-300 sm:text-lg"}>{pnlEnabled?(livePct>=0?"+":"")+livePct.toFixed(3)+"%":"Hidden"}</b></div>
      </div>

      <div className="mt-4 rounded-3xl border border-white/10 bg-[#050812] p-2 sm:p-3">
       <div className="mb-2 flex items-center justify-between px-2"><div className="flex items-center gap-2 text-[10px] font-bold"><ChartCandlestick size={15} className="text-cyan-300"/>LIVE MARKET MOVEMENT</div><div className="text-[8px] text-slate-600">Price updates continuously · UI clock {elapsedFmt}</div></div>
       <MarketChart symbol={pair} interval="1m" height={520}/>
      </div>

      <div className="mt-4"><OrderBook symbol={pair} currentPrice={price}/></div>
     </section>
    </div>

    <aside className="space-y-4">
     <section className="rounded-[28px] border border-cyan-400/20 bg-[#0a0e1a] p-4 sm:p-5">
      <div className="flex items-center gap-2 text-xs font-black"><Clock3 size={15} className="text-cyan-300"/>LIVE POSITION TIMER</div>
      <div className="mt-3 rounded-2xl border border-white/5 bg-[#050812] p-5 text-center">
       <div className="text-[8px] uppercase tracking-[.28em] text-slate-600">POSITION AGE</div>
       <div className="mt-1 text-4xl font-black tabular-nums text-cyan-300">{elapsedFmt}</div>
       <div className="mt-1 text-[9px] text-slate-500">Running every second while this position remains open.</div>
      </div>
      <div className="mt-3 space-y-2 text-[10px]">
       <div className="flex justify-between"><span className="text-slate-600">Order ID</span><b>#{latest?.orderId||latest?.id||latest?.order_id||"—"}</b></div>
       <div className="flex justify-between"><span className="text-slate-600">Pair</span><b>{pair}</b></div>
       <div className="flex justify-between"><span className="text-slate-600">Quantity</span><b>{qty(amount)} {base}</b></div>
       <div className="flex justify-between"><span className="text-slate-600">Entry</span><b>{money(entry)} USDT</b></div>
       <div className="flex justify-between"><span className="text-slate-600">Current</span><b className="text-cyan-300">{price?money(price):"—"} USDT</b></div>
       <div className="flex justify-between"><span className="text-slate-600">P/L policy</span><b>{pnlEnabled?"Live market":"Disabled"}</b></div>
       <div className="flex justify-between"><span className="text-slate-600">Status</span><b className="text-emerald-300">{status}</b></div>
       {outcome&&<div className="flex justify-between"><span className="text-slate-600">Outcome</span><b>{outcome}</b></div>}
      </div>
     </section>

     <section className="rounded-[28px] border border-white/10 bg-[#0a0e1a] p-4 sm:p-5">
      <div className="flex items-center gap-2 text-xs font-black"><Wallet size={15} className="text-cyan-300"/>LIVE WALLET STATE</div>
      <div className="mt-3 grid grid-cols-2 gap-2">
       <div className="rounded-2xl bg-[#050812] p-3"><div className="text-[8px] text-slate-600">{base} AVAILABLE</div><b className="mt-1 block text-sm">{qty(balance)}</b></div>
       <div className="rounded-2xl bg-[#050812] p-3"><div className="text-[8px] text-slate-600">{base} LOCKED</div><b className="mt-1 block text-sm">{qty(locked)}</b></div>
       <div className="rounded-2xl bg-[#050812] p-3"><div className="text-[8px] text-slate-600">POSITION VALUE</div><b className="mt-1 block text-sm">{money(amount*price)} USDT</b></div>
       <div className="rounded-2xl bg-[#050812] p-3"><div className="text-[8px] text-slate-600">P/L %</div><b className={livePct>=0?"mt-1 block text-sm text-emerald-300":"mt-1 block text-sm text-red-300"}>{pnlEnabled?(livePct>=0?"+":"")+livePct.toFixed(3)+"%":"—"}</b></div>
      </div>
     </section>

     <section className="rounded-[28px] border border-amber-400/10 bg-amber-400/5 p-4 text-[10px] leading-5 text-slate-500">
      <div className="flex items-center gap-2 font-bold text-amber-300"><ShieldCheck size={14}/>SERVER-AUTHORITATIVE POSITION</div>
      <p className="mt-2">The browser only displays the live market and position state. Execution, balances, fees and realized P/L remain controlled by the backend market-order API. There is no X/close control and no fake client-side WIN/LOSS settlement.</p>
      <div className="mt-3 flex items-center gap-2 text-slate-400"><ArrowRightLeft size={13}/>Use the existing Spot Order flow to execute a real market sell when you want to close the position.</div>
     </section>
     {error&&<div className="rounded-2xl border border-red-500/15 bg-red-500/10 p-3 text-[10px] text-red-300">{error}</div>}
    </aside>
   </section>
  </main>
 </div>;
}
