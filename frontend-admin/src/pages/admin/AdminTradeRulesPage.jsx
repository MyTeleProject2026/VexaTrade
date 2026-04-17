import { useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { adminApi, getApiErrorMessage } from "../../services/api";

function formatPercent(v) {
  return `${Number(v || 0)}%`;
}

function StatCard({ title, value, tone = "text-white" }) {
  return (
    <div className="rounded-[24px] border border-white/10 bg-slate-900/70 p-4 shadow-xl">
      <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
        {title}
      </div>
      <div className={`mt-3 text-2xl font-semibold sm:text-3xl ${tone}`}>
        {value}
      </div>
    </div>
  );
}

function DetailRow({ label, value, valueClassName = "text-white" }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-slate-500">{label}</span>
      <span className={`text-right text-sm ${valueClassName}`}>{value}</span>
    </div>
  );
}

export default function AdminTradeRulesPage() {
  const token =
    localStorage.getItem("adminToken") ||
    localStorage.getItem("admin_token") ||
    "";

  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    loadRules(true);
  }, [token]);

  async function loadRules(isInitial = false) {
    try {
      if (isInitial) setLoading(true);
      else setRefreshing(true);

      setError("");

      const res = await adminApi.getTradeRules(token);
      setRules(Array.isArray(res.data?.data) ? res.data.data : []);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  function handleChange(id, field, value) {
    setRules((prev) =>
      prev.map((r) =>
        r.id === id ? { ...r, [field]: value } : r
      )
    );
  }

  async function handleSave(rule) {
    try {
      setSavingId(rule.id);
      setError("");
      setSuccess("");

      await adminApi.updateTradeRule(
        rule.id,
        {
          timer_seconds: Number(rule.timer_seconds),
          min_amount: Number(rule.min_amount || 0),
          max_amount: Number(rule.max_amount || 0),
          payout_percent: Number(rule.payout_percent),
          status: rule.status,
        },
        token
      );

      setSuccess(`Rule ${rule.timer_seconds}s updated successfully.`);
      await loadRules(false);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setSavingId(null);
    }
  }

  const summary = useMemo(() => {
    return {
      total: rules.length,
      active: rules.filter(
        (item) => String(item.status || "").toLowerCase() === "active"
      ).length,
      inactive: rules.filter(
        (item) => String(item.status || "").toLowerCase() === "inactive"
      ).length,
      highestPayout:
        rules.length > 0
          ? Math.max(...rules.map((item) => Number(item.payout_percent || 0)))
          : 0,
    };
  }, [rules]);

  if (loading) {
    return (
      <div className="rounded-[24px] border border-white/10 bg-slate-900/70 p-5 text-sm text-slate-300">
        Loading trade rules...
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <section className="rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(124,58,237,0.10),transparent_18%),linear-gradient(180deg,#111827_0%,#020617_100%)] p-5 shadow-xl">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.32em] text-violet-300">
              Trade Rules
            </p>
            <h1 className="mt-2 text-2xl font-bold text-white sm:text-3xl">
              Trade Rules
            </h1>
            <p className="mt-2 text-sm text-slate-400">
              Adjust payout ratios, limits, and active trading configurations.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span
              className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${
                refreshing
                  ? "border-cyan-500/20 bg-cyan-500/10 text-cyan-300"
                  : "border-white/10 bg-slate-950/70 text-slate-300"
              }`}
            >
              <span
                className={`mr-2 inline-block h-2.5 w-2.5 rounded-full ${
                  refreshing ? "animate-pulse bg-cyan-400" : "bg-emerald-400"
                }`}
              />
              {refreshing ? "Refreshing..." : "Rules Ready"}
            </span>

            <button
              type="button"
              onClick={() => loadRules(false)}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-white/5"
            >
              <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
              Refresh
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Total Rules" value={summary.total} />
        <StatCard title="Active" value={summary.active} tone="text-emerald-300" />
        <StatCard title="Inactive" value={summary.inactive} tone="text-amber-300" />
        <StatCard title="Highest Payout" value={`${summary.highestPayout}%`} tone="text-cyan-300" />
      </section>

      {error ? (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300">
          {error}
        </div>
      ) : null}

      {success ? (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm text-emerald-300">
          {success}
        </div>
      ) : null}

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {rules.map((rule) => (
          <div
            key={rule.id}
            className="rounded-[24px] border border-white/10 bg-slate-900/70 p-4 shadow-xl"
          >
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-white">
                {rule.timer_seconds}s
              </h2>

              <span
                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                  String(rule.status || "").toLowerCase() === "active"
                    ? "bg-emerald-500/10 text-emerald-300"
                    : "bg-amber-500/10 text-amber-300"
                }`}
              >
                {rule.status}
              </span>
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <label className="mb-2 block text-sm text-slate-300">
                  Min Amount
                </label>
                <input
                  type="number"
                  value={rule.min_amount || ""}
                  onChange={(e) =>
                    handleChange(rule.id, "min_amount", e.target.value)
                  }
                  placeholder="Min Amount"
                  className="w-full rounded-xl border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-violet-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm text-slate-300">
                  Max Amount
                </label>
                <input
                  type="number"
                  value={rule.max_amount || ""}
                  onChange={(e) =>
                    handleChange(rule.id, "max_amount", e.target.value)
                  }
                  placeholder="Max Amount"
                  className="w-full rounded-xl border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-violet-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm text-slate-300">
                  Payout %
                </label>
                <input
                  type="number"
                  value={rule.payout_percent}
                  onChange={(e) =>
                    handleChange(rule.id, "payout_percent", e.target.value)
                  }
                  placeholder="Payout %"
                  className="w-full rounded-xl border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-violet-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm text-slate-300">
                  Status
                </label>
                <select
                  value={rule.status}
                  onChange={(e) =>
                    handleChange(rule.id, "status", e.target.value)
                  }
                  className="w-full rounded-xl border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-violet-500"
                >
                  <option value="active">active</option>
                  <option value="inactive">inactive</option>
                </select>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/40 p-4 text-sm space-y-2">
              <DetailRow label="Timer" value={`${rule.timer_seconds}s`} />
              <DetailRow
                label="Current Payout"
                value={formatPercent(rule.payout_percent)}
                valueClassName="text-cyan-300"
              />
              <DetailRow label="Min Amount" value={rule.min_amount || 0} />
              <DetailRow label="Max Amount" value={rule.max_amount || 0} />
            </div>

            <button
              onClick={() => handleSave(rule)}
              disabled={savingId === rule.id}
              className="mt-4 w-full rounded-xl bg-violet-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-400 disabled:opacity-50"
            >
              {savingId === rule.id ? "Saving..." : "Save Rule"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}