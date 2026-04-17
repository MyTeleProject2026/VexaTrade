import { useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { adminApi, getApiErrorMessage } from "../../services/api";

function formatMoney(value) {
  const num = Number(value || 0);
  if (!Number.isFinite(num)) return "0.00";
  return num.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDateTime(value) {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function StatCard({ title, value, tone = "text-white" }) {
  return (
    <div className="rounded-[24px] border border-white/10 bg-[#111111] p-4 shadow-xl">
      <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
        {title}
      </div>
      <div className={`mt-3 text-2xl font-semibold sm:text-3xl ${tone}`}>
        {value}
      </div>
    </div>
  );
}

function DetailBox({ label, value, valueClassName = "text-white" }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/40 p-3">
      <div className="text-[11px] uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className={`mt-1 text-sm ${valueClassName}`}>{value}</div>
    </div>
  );
}

function getStatusClass(status) {
  const value = String(status || "").toLowerCase();

  if (value === "active") {
    return "bg-amber-500/10 text-amber-300 border border-amber-500/20";
  }
  if (value === "completed") {
    return "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20";
  }
  if (value === "cancelled") {
    return "bg-rose-500/10 text-rose-300 border border-rose-500/20";
  }

  return "bg-sky-500/10 text-sky-300 border border-sky-500/20";
}

export default function AdminFundsPage() {
  const token =
    localStorage.getItem("adminToken") ||
    localStorage.getItem("admin_token") ||
    "";

  const [funds, setFunds] = useState([]);
  const [summary, setSummary] = useState({
    total_funds: 0,
    active_funds: 0,
    completed_funds: 0,
    total_funded_amount: 0,
    total_earned_profit: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionId, setActionId] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    loadFunds(true);
  }, [token]);

  async function loadFunds(isInitial = false) {
    try {
      if (isInitial) setLoading(true);
      else setRefreshing(true);

      setError("");

      const [fundsRes, summaryRes] = await Promise.all([
        adminApi.getFunds(token),
        adminApi.getFundsSummary(token),
      ]);

      setFunds(Array.isArray(fundsRes.data?.data) ? fundsRes.data.data : []);
      setSummary(summaryRes.data?.data || {});
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function handleDeleteFund(id) {
    const confirmed = window.confirm(`Delete fund #${id}?`);
    if (!confirmed) return;

    try {
      setActionId(id);
      setError("");
      setSuccess("");

      await adminApi.deleteFund(id, token);
      setSuccess(`Fund #${id} deleted successfully.`);
      await loadFunds(false);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setActionId(null);
    }
  }

  async function handleCompleteFund(id) {
    const confirmed = window.confirm(`Complete fund #${id}?`);
    if (!confirmed) return;

    try {
      setActionId(id);
      setError("");
      setSuccess("");

      await adminApi.completeFund(id, {}, token);
      setSuccess(`Fund #${id} completed successfully.`);
      await loadFunds(false);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setActionId(null);
    }
  }

  async function handleCancelFund(id) {
    const confirmed = window.confirm(`Cancel fund #${id}?`);
    if (!confirmed) return;

    try {
      setActionId(id);
      setError("");
      setSuccess("");

      await adminApi.cancelFund(id, {}, token);
      setSuccess(`Fund #${id} cancelled successfully.`);
      await loadFunds(false);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setActionId(null);
    }
  }

  const stats = useMemo(() => {
    return {
      total: Number(summary.total_funds || funds.length || 0),
      active:
        Number(summary.active_funds || 0) ||
        funds.filter((item) => String(item.status).toLowerCase() === "active").length,
      completed:
        Number(summary.completed_funds || 0) ||
        funds.filter((item) => String(item.status).toLowerCase() === "completed").length,
      totalFunded: Number(summary.total_funded_amount || 0),
      totalProfit: Number(summary.total_earned_profit || 0),
    };
  }, [summary, funds]);

  if (loading) {
    return (
      <div className="rounded-[24px] border border-white/10 bg-[#111111] p-5 text-sm text-slate-300">
        Loading funds...
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <section className="rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(163,230,53,0.10),transparent_18%),linear-gradient(180deg,#081223_0%,#020617_100%)] p-5 shadow-xl">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.32em] text-lime-300">
              Admin Funds
            </p>
            <h1 className="mt-2 text-2xl font-bold text-white sm:text-3xl">
              Funds Control
            </h1>
            <p className="mt-2 text-sm text-slate-400">
              Monitor active user funds, profits, completion, cancellation, and deletion.
            </p>
          </div>

          <button
            type="button"
            onClick={() => loadFunds(false)}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-white/5"
          >
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <StatCard title="Total Funds" value={stats.total} />
        <StatCard title="Active" value={stats.active} tone="text-amber-300" />
        <StatCard title="Completed" value={stats.completed} tone="text-emerald-300" />
        <StatCard
          title="Funded Amount"
          value={`${formatMoney(stats.totalFunded)} USDT`}
          tone="text-cyan-300"
        />
        <StatCard
          title="Earned Profit"
          value={`${formatMoney(stats.totalProfit)} USDT`}
          tone="text-lime-300"
        />
      </section>

      {error ? (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      ) : null}

      {success ? (
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
          {success}
        </div>
      ) : null}

      <section className="space-y-4">
        {funds.length ? (
          funds.map((fund) => {
            const totalReceive =
              Number(fund.locked_principal || fund.amount || 0) +
              Number(fund.earned_profit || 0);

            const fundStatus = String(fund.status || "").toLowerCase();
            const isCompleted = fundStatus === "completed";
            const isCancelled = fundStatus === "cancelled";
            const disableComplete = actionId === fund.id || isCompleted || isCancelled;
            const disableCancel = actionId === fund.id || isCompleted || isCancelled;

            return (
              <div
                key={fund.id}
                className="rounded-[24px] border border-white/10 bg-[#111111] p-4 shadow-xl"
              >
                <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
                    <DetailBox label="Fund" value={`#${fund.id}`} />
                    <DetailBox label="User" value={`#${fund.user_id}`} />
                    <DetailBox label="Plan" value={fund.plan_name || "--"} />
                    <DetailBox
                      label="Amount"
                      value={`${formatMoney(fund.locked_principal || fund.amount)} USDT`}
                      valueClassName="text-cyan-300"
                    />
                    <DetailBox
                      label="Profit"
                      value={`+${formatMoney(fund.earned_profit)} USDT`}
                      valueClassName="text-emerald-300"
                    />
                    <DetailBox
                      label="Total"
                      value={`${formatMoney(totalReceive)} USDT`}
                      valueClassName="text-lime-300"
                    />
                    <DetailBox
                      label="Daily Rate"
                      value={`${Number(fund.selected_daily_profit_percent || 0).toFixed(2)}%`}
                    />
                    <DetailBox
                      label="Progress"
                      value={`${fund.current_day || 0}/${fund.total_days || 0}`}
                    />
                    <DetailBox
                      label="Started"
                      value={formatDateTime(fund.started_at)}
                    />
                    <DetailBox
                      label="Ends"
                      value={formatDateTime(fund.ends_at)}
                    />
                    <DetailBox
                      label="Completed"
                      value={formatDateTime(fund.completed_at)}
                    />
                    <DetailBox
                      label="Status"
                      value={
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusClass(
                            fund.status
                          )}`}
                        >
                          {fund.status}
                        </span>
                      }
                    />
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row">
                    <button
                      type="button"
                      disabled={disableComplete}
                      onClick={() => handleCompleteFund(fund.id)}
                      className={`rounded-xl px-3 py-2 text-xs font-semibold transition ${
                        disableComplete
                          ? "cursor-not-allowed bg-emerald-500/5 text-emerald-300/40"
                          : "bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20"
                      }`}
                    >
                      {actionId === fund.id ? "Processing..." : "Complete"}
                    </button>

                    <button
                      type="button"
                      disabled={disableCancel}
                      onClick={() => handleCancelFund(fund.id)}
                      className={`rounded-xl px-3 py-2 text-xs font-semibold transition ${
                        disableCancel
                          ? "cursor-not-allowed bg-amber-500/5 text-amber-300/40"
                          : "bg-amber-500/10 text-amber-300 hover:bg-amber-500/20"
                      }`}
                    >
                      {actionId === fund.id ? "Processing..." : "Cancel"}
                    </button>

                    <button
                      type="button"
                      disabled={actionId === fund.id}
                      onClick={() => handleDeleteFund(fund.id)}
                      className="rounded-xl bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-300 transition hover:bg-rose-500/20 disabled:opacity-50"
                    >
                      {actionId === fund.id ? "Processing..." : "Delete"}
                    </button>
                  </div>
                </div>

                {isCompleted ? (
                  <div className="mt-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
                    This fund is already completed. You can delete it if needed.
                  </div>
                ) : null}

                {isCancelled ? (
                  <div className="mt-3 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
                    This fund is already cancelled. You can delete it if needed.
                  </div>
                ) : null}
              </div>
            );
          })
        ) : (
          <div className="rounded-2xl border border-white/10 bg-[#111111] px-4 py-8 text-center text-sm text-slate-400">
            No funds found.
          </div>
        )}
      </section>
    </div>
  );
}