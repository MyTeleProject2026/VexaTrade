import { useEffect, useState } from "react";
import { ShieldCheck, Mail, Clock, RefreshCw } from "lucide-react";
import { withdrawalApi, getApiErrorMessage } from "../services/api";
import { useNotification } from "../hooks/useNotification";

const tokenFromStorage = () => localStorage.getItem("userToken") || localStorage.getItem("token") || localStorage.getItem("accessToken") || "";

function formatAmount(value, coin) {
  return `${Number(value || 0).toLocaleString(undefined,{maximumFractionDigits:8})} ${coin || ""}`;
}

export default function JointWithdrawalAuthorization() {
  const token = tokenFromStorage();
  const { showSuccess, showError } = useNotification();
  const [items, setItems] = useState([]);
  const [codes, setCodes] = useState({});
  const [loading, setLoading] = useState(true);
  const [submittingId, setSubmittingId] = useState(null);

  const load = async (silent=false) => {
    if (!token) return;
    if (!silent) setLoading(true);
    try {
      const res = await withdrawalApi.pendingJointAuthorizations(token);
      setItems(Array.isArray(res.data?.data) ? res.data.data : []);
    } catch (error) {
      if (!silent) showError(getApiErrorMessage(error, "Unable to load joint withdrawal authorizations."));
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const authorize = async (item) => {
    const code = String(codes[item.id] || "").trim();
    if (!/^\d{6}$/.test(code)) {
      showError("Enter the 6-digit authorization code sent to your verified email.");
      return;
    }
    setSubmittingId(item.id);
    try {
      await withdrawalApi.jointAuthorize(item.id, { code }, token);
      showSuccess("Joint withdrawal authorized successfully. It is now ready for settlement.");
      setCodes((current) => ({ ...current, [item.id]: "" }));
      await load(true);
    } catch (error) {
      showError(getApiErrorMessage(error, "Joint withdrawal authorization failed."));
    } finally {
      setSubmittingId(null);
    }
  };

  if (loading) {
    return <div className="rounded-[28px] border border-white/10 bg-[#0a0e1a] p-5 text-slate-400">Loading authorization requests…</div>;
  }

  if (!items.length) return null;

  return (
    <section className="rounded-[28px] border border-amber-400/20 bg-amber-400/[0.04] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.25)]">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div className="flex gap-3">
          <div className="rounded-2xl bg-amber-400/10 p-3 text-amber-300"><ShieldCheck size={22}/></div>
          <div>
            <h2 className="font-semibold text-white">Joint Account Authorization Required</h2>
            <p className="mt-1 text-sm text-slate-400">Review each withdrawal and enter the one-time code delivered to your verified email.</p>
          </div>
        </div>
        <button onClick={() => load()} className="rounded-xl border border-white/10 p-2 text-slate-300 hover:bg-white/5" aria-label="Refresh authorizations"><RefreshCw size={18}/></button>
      </div>

      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.id} className="rounded-2xl border border-white/10 bg-[#070b14] p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="font-medium text-white">{formatAmount(item.amount, item.coin)}</div>
                <div className="mt-1 text-xs text-slate-500">{item.network} • Withdrawal #{item.id}</div>
              </div>
              <div className="flex items-center gap-1 text-xs text-amber-300"><Clock size={14}/> Expires {new Date(item.expires_at).toLocaleString()}</div>
            </div>
            <div className="mb-3 break-all rounded-xl bg-white/[0.03] p-3 text-xs text-slate-400">{item.address}</div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative flex-1">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16}/>
                <input value={codes[item.id] || ""} onChange={(e)=>setCodes((current)=>({...current,[item.id]:e.target.value.replace(/\D/g,"").slice(0,6)}))} inputMode="numeric" autoComplete="one-time-code" placeholder="6-digit email authorization code" className="w-full rounded-xl border border-white/10 bg-[#0a0e1a] py-3 pl-10 pr-3 text-white outline-none focus:border-amber-400/60"/>
              </div>
              <button disabled={submittingId===item.id} onClick={()=>authorize(item)} className="rounded-xl bg-amber-400 px-5 py-3 text-sm font-semibold text-black transition hover:bg-amber-300 disabled:opacity-60">{submittingId===item.id?"Authorizing…":"Authorize Withdrawal"}</button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
