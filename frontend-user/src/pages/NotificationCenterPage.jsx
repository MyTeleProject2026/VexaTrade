import { useCallback, useEffect, useState } from "react";
import { Bell, CheckCheck, RefreshCw } from "lucide-react";
import { userApi, getApiErrorMessage } from "../services/api";

const request = (promise, timeout = 7000) => Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error("Request timed out")), timeout))]);

export default function NotificationCenterPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await request(userApi.getNotifications());
      const rows = response?.data?.data ?? response?.data ?? [];
      setItems(Array.isArray(rows) ? rows : []);
    } catch (err) { setError(getApiErrorMessage(err)); setItems([]); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  const markAll = async () => {
    const unread = items.filter((item) => !item.read_at && !item.is_read);
    if (!unread.length) return;
    await Promise.allSettled(unread.map((item) => userApi.markNotificationRead(item.id)));
    load();
  };
  return (
    <div className="min-h-full bg-[#050812] px-3 py-4 text-white sm:px-5">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center justify-between gap-3">
          <div><div className="text-[10px] uppercase tracking-[0.28em] text-cyan-300">Account center</div><h1 className="mt-1 text-xl font-bold">Notifications</h1></div>
          <div className="flex gap-2"><button type="button" onClick={markAll} className="inline-flex items-center gap-1 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-[11px] font-semibold text-slate-200"><CheckCheck size={14} /> Mark all</button><button type="button" onClick={load} disabled={loading} className="rounded-xl border border-white/10 bg-white/[0.04] p-2 text-slate-200"><RefreshCw size={14} className={loading ? "animate-spin" : ""} /></button></div>
        </div>
        {error ? <div className="mt-3 rounded-xl border border-amber-400/20 bg-amber-400/5 px-3 py-2 text-xs text-amber-200">{error}</div> : null}
        <div className="mt-4 space-y-2">
          {!loading && !items.length ? <div className="rounded-2xl border border-white/10 bg-[#081223] p-8 text-center text-xs text-slate-400"><Bell size={24} className="mx-auto mb-2 text-slate-500" />No notifications right now.</div> : null}
          {items.map((item) => {
            const unread = !item.read_at && !item.is_read;
            return <button key={item.id} type="button" onClick={() => unread && userApi.markNotificationRead(item.id).then(load).catch(() => {})} className={`w-full rounded-2xl border p-4 text-left transition ${unread ? "border-cyan-400/15 bg-cyan-400/[0.06]" : "border-white/10 bg-[#081223]"}`}><div className="flex gap-3"><div className="rounded-xl bg-white/[0.05] p-2 text-cyan-300"><Bell size={16} /></div><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><h2 className="text-sm font-semibold text-white">{item.title || "VexaTrade notification"}</h2>{unread ? <span className="h-2 w-2 rounded-full bg-cyan-300" /> : null}</div><p className="mt-1 text-xs leading-5 text-slate-400">{item.message || item.body || ""}</p><div className="mt-2 text-[10px] text-slate-600">{item.created_at || item.createdAt || ""}</div></div></div></button>;
          })}
        </div>
      </div>
    </div>
  );
}
