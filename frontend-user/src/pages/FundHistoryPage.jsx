import { useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, FileText } from "lucide-react";
import { Link } from "react-router-dom";
import { fundsApi } from "../services/api";

const token = () =>
  localStorage.getItem("userToken") ||
  localStorage.getItem("token") ||
  localStorage.getItem("accessToken") ||
  "";

const money = (v) =>
  Number(v || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  });

export default function FundHistoryPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fundsApi
      .history(token())
      .then((r) => setRows(Array.isArray(r?.data?.data) ? r.data.data : []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-[#050812] p-3 pb-24 sm:p-5">
      <div className="mx-auto max-w-6xl">
        <Link to="/funds" className="mb-3 inline-flex items-center gap-1 text-xs text-slate-400">
          <ArrowLeft size={13} /> Funds Center
        </Link>
        <div className="mb-3">
          <h1 className="text-xl font-bold text-white">Funds History</h1>
          <p className="text-[10px] text-slate-500">
            Completed and historical Fund records from the Vexa Blockchain Ecosystem.
          </p>
        </div>

        {loading ? (
          <div className="rounded-xl border border-white/10 bg-[#0a0e1a] p-4 text-xs text-slate-400">
            Loading…
          </div>
        ) : !rows.length ? (
          <div className="rounded-xl border border-white/10 bg-[#0a0e1a] p-6 text-center text-xs text-slate-500">
            No fund history yet.
          </div>
        ) : (
          <div className="grid gap-2 lg:grid-cols-2">
            {rows.map((r) => (
              <div key={r.id} className="rounded-xl border border-white/10 bg-[#0a0e1a] p-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold text-white">{r.plan_name || "Fund Plan"}</div>
                    <div className="text-[9px] text-slate-500">Fund #{r.id}</div>
                  </div>
                  <span className="rounded-full bg-emerald-400/10 px-2 py-1 text-[9px] font-semibold text-emerald-300">
                    {String(r.status || "").toUpperCase()}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-[10px]">
                  <div>
                    <div className="text-slate-500">Principal</div>
                    <div className="text-white">{money(r.locked_principal)} USDT</div>
                  </div>
                  <div>
                    <div className="text-slate-500">Profit</div>
                    <div className="text-emerald-300">+{money(r.earned_profit)} USDT</div>
                  </div>
                  <div>
                    <div className="text-slate-500">Received</div>
                    <div className="text-cyan-300">{money(r.total_received)} USDT</div>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-2 text-[9px] text-slate-500">
                  <CheckCircle2 size={11} className="text-emerald-400" />
                  {r.completed_at ? new Date(r.completed_at).toLocaleString() : "—"}
                  <FileText size={11} className="ml-auto" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}