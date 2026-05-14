import { useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { adminApi, getApiErrorMessage } from "../../services/api";
// ✅ ADDED: Import toast notification hook
import useToast from "../components/ToastNotification";

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

function DetailRow({ label, value, valueClassName = "text-white" }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-slate-500">{label}</span>
      <span className={`text-right text-sm ${valueClassName}`}>{value}</span>
    </div>
  );
}

const EMPTY_FORM = {
  name: "",
  duration_days: 2,
  min_amount: 0,
  max_amount: "",
  min_daily_profit_percent: 0,
  max_daily_profit_percent: 0,
  user_limit_count: "",
  status: "active",
};

export default function AdminFundsRulesPage() {
  const token =
    localStorage.getItem("adminToken") ||
    localStorage.getItem("admin_token") ||
    "";

  // ✅ ADDED: Toast notification hook
  const { toasts, addToast, removeToast, ToastContainer } = useToast();

  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [createForm, setCreateForm] = useState(EMPTY_FORM);

  useEffect(() => {
    loadRules(true);
  }, [token]);

  async function loadRules(isInitial = false) {
    try {
      if (isInitial) setLoading(true);
      else setRefreshing(true);

      setError("");

      const res = await adminApi.getFundRules(token);
      setRules(Array.isArray(res.data?.data) ? res.data.data : []);
      
      // ✅ ADDED: Success toast for silent refresh
      if (!isInitial) {
        addToast("Fund rules refreshed successfully", "success");
      }
    } catch (err) {
      const errorMsg = getApiErrorMessage(err);
      setError(errorMsg);
      // ✅ ADDED: Error toast
      addToast(errorMsg, "error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  function handleChange(id, field, value) {
    setRules((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: value } : r))
    );
  }

  function handleCreateChange(field, value) {
    setCreateForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  }

  async function handleSave(rule) {
    try {
      setSavingId(rule.id);
      setError("");
      setSuccess("");

      await adminApi.updateFundRule(
        rule.id,
        {
          name: rule.name,
          duration_days: Number(rule.duration_days),
          min_amount: Number(rule.min_amount || 0),
          max_amount:
            rule.max_amount === "" || rule.max_amount === null
              ? null
              : Number(rule.max_amount),
          min_daily_profit_percent: Number(rule.min_daily_profit_percent || 0),
          max_daily_profit_percent: Number(rule.max_daily_profit_percent || 0),
          user_limit_count:
            rule.user_limit_count === "" || rule.user_limit_count === null
              ? null
              : Number(rule.user_limit_count),
          status: rule.status,
        },
        token
      );

      const successMsg = `${rule.name} updated successfully.`;
      setSuccess(successMsg);
      // ✅ ADDED: Success toast
      addToast(successMsg, "success");
      await loadRules(false);
    } catch (err) {
      const errorMsg = getApiErrorMessage(err);
      setError(errorMsg);
      // ✅ ADDED: Error toast
      addToast(errorMsg, "error");
    } finally {
      setSavingId(null);
    }
  }

  async function handleCreateRule() {
    // ✅ ADDED: Validation
    if (!createForm.name || !createForm.name.trim()) {
      const errorMsg = "Rule name is required";
      setError(errorMsg);
      addToast(errorMsg, "error");
      return;
    }

    if (!createForm.duration_days || createForm.duration_days <= 0) {
      const errorMsg = "Duration days must be greater than 0";
      setError(errorMsg);
      addToast(errorMsg, "error");
      return;
    }

    try {
      setCreating(true);
      setError("");
      setSuccess("");

      await adminApi.createFundRule(
        {
          name: createForm.name,
          duration_days: Number(createForm.duration_days),
          min_amount: Number(createForm.min_amount || 0),
          max_amount:
            createForm.max_amount === "" ? null : Number(createForm.max_amount),
          min_daily_profit_percent: Number(createForm.min_daily_profit_percent || 0),
          max_daily_profit_percent: Number(createForm.max_daily_profit_percent || 0),
          user_limit_count:
            createForm.user_limit_count === ""
              ? null
              : Number(createForm.user_limit_count),
          status: createForm.status,
        },
        token
      );

      const successMsg = "Fund rule created successfully.";
      setSuccess(successMsg);
      // ✅ ADDED: Success toast
      addToast(successMsg, "success");
      setCreateForm(EMPTY_FORM);
      await loadRules(false);
    } catch (err) {
      const errorMsg = getApiErrorMessage(err);
      setError(errorMsg);
      // ✅ ADDED: Error toast
      addToast(errorMsg, "error");
    } finally {
      setCreating(false);
    }
  }

  async function handleDeleteRule(id) {
    const confirmed = window.confirm(`Delete fund rule #${id}?`);
    if (!confirmed) return;

    try {
      setSavingId(id);
      setError("");
      setSuccess("");

      await adminApi.deleteFundRule(id, token);
      const successMsg = `Fund rule #${id} deleted successfully.`;
      setSuccess(successMsg);
      // ✅ ADDED: Success toast
      addToast(successMsg, "success");
      await loadRules(false);
    } catch (err) {
      const errorMsg = getApiErrorMessage(err);
      setError(errorMsg);
      // ✅ ADDED: Error toast
      addToast(errorMsg, "error");
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
      highestMaxRate:
        rules.length > 0
          ? Math.max(...rules.map((item) => Number(item.max_daily_profit_percent || 0)))
          : 0,
    };
  }, [rules]);

  if (loading) {
    return (
      <div className="rounded-[24px] border border-white/10 bg-[#111111] p-5 text-sm text-slate-300">
        Loading fund rules...
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* ✅ ADDED: Toast Container */}
      <ToastContainer />

      <section className="rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(163,230,53,0.10),transparent_18%),linear-gradient(180deg,#081223_0%,#020617_100%)] p-5 shadow-xl">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.32em] text-lime-300">
              Funds Rules
            </p>
            <h1 className="mt-2 text-2xl font-bold text-white sm:text-3xl">
              Funds Rules
            </h1>
            <p className="mt-2 text-sm text-slate-400">
              Adjust duration, limits, daily profit ranges, status, and deletion.
            </p>
          </div>

          <button
            type="button"
            onClick={() => loadRules(false)}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-white/5"
          >
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Total Rules" value={summary.total} />
        <StatCard title="Active" value={summary.active} tone="text-emerald-300" />
        <StatCard title="Inactive" value={summary.inactive} tone="text-amber-300" />
        <StatCard title="Highest Max Rate" value={`${summary.highestMaxRate}%`} tone="text-lime-300" />
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

      <section className="rounded-[24px] border border-white/10 bg-[#111111] p-4 shadow-xl">
        <h2 className="text-lg font-semibold text-white">Create Fund Rule</h2>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <input
            type="text"
            value={createForm.name}
            onChange={(e) => handleCreateChange("name", e.target.value)}
            placeholder="Rule name"
            className="rounded-xl border border-white/10 bg-[#0a0e1a] px-3 py-2.5 text-sm text-white outline-none"
          />
          <input
            type="number"
            value={createForm.duration_days}
            onChange={(e) => handleCreateChange("duration_days", e.target.value)}
            placeholder="Duration days"
            className="rounded-xl border border-white/10 bg-[#0a0e1a] px-3 py-2.5 text-sm text-white outline-none"
          />
          <input
            type="number"
            value={createForm.min_amount}
            onChange={(e) => handleCreateChange("min_amount", e.target.value)}
            placeholder="Min amount"
            className="rounded-xl border border-white/10 bg-[#0a0e1a] px-3 py-2.5 text-sm text-white outline-none"
          />
          <input
            type="number"
            value={createForm.max_amount}
            onChange={(e) => handleCreateChange("max_amount", e.target.value)}
            placeholder="Max amount"
            className="rounded-xl border border-white/10 bg-[#0a0e1a] px-3 py-2.5 text-sm text-white outline-none"
          />
          <input
            type="number"
            value={createForm.min_daily_profit_percent}
            onChange={(e) => handleCreateChange("min_daily_profit_percent", e.target.value)}
            placeholder="Min daily %"
            className="rounded-xl border border-white/10 bg-[#0a0e1a] px-3 py-2.5 text-sm text-white outline-none"
          />
          <input
            type="number"
            value={createForm.max_daily_profit_percent}
            onChange={(e) => handleCreateChange("max_daily_profit_percent", e.target.value)}
            placeholder="Max daily %"
            className="rounded-xl border border-white/10 bg-[#0a0e1a] px-3 py-2.5 text-sm text-white outline-none"
          />
          <input
            type="number"
            value={createForm.user_limit_count}
            onChange={(e) => handleCreateChange("user_limit_count", e.target.value)}
            placeholder="User limit count"
            className="rounded-xl border border-white/10 bg-[#0a0e1a] px-3 py-2.5 text-sm text-white outline-none"
          />
          <select
            value={createForm.status}
            onChange={(e) => handleCreateChange("status", e.target.value)}
            className="rounded-xl border border-white/10 bg-[#0a0e1a] px-3 py-2.5 text-sm text-white outline-none"
          >
            <option value="active">active</option>
            <option value="inactive">inactive</option>
          </select>
        </div>

        <button
          type="button"
          onClick={handleCreateRule}
          disabled={creating}
          className="mt-4 rounded-xl bg-lime-400 px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-lime-300 disabled:opacity-50"
        >
          {creating ? "Creating..." : "Create Rule"}
        </button>
      </section>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {rules.map((rule) => (
          <div
            key={rule.id}
            className="rounded-[24px] border border-white/10 bg-[#111111] p-4 shadow-xl"
          >
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-white">
                {rule.name}
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
                <label className="mb-2 block text-sm text-slate-300">Name</label>
                <input
                  type="text"
                  value={rule.name || ""}
                  onChange={(e) => handleChange(rule.id, "name", e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-[#0a0e1a] px-3 py-2 text-sm text-white outline-none"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm text-slate-300">Duration Days</label>
                <input
                  type="number"
                  value={rule.duration_days || ""}
                  onChange={(e) => handleChange(rule.id, "duration_days", e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-[#0a0e1a] px-3 py-2 text-sm text-white outline-none"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm text-slate-300">Min Amount</label>
                <input
                  type="number"
                  value={rule.min_amount || ""}
                  onChange={(e) => handleChange(rule.id, "min_amount", e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-[#0a0e1a] px-3 py-2 text-sm text-white outline-none"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm text-slate-300">Max Amount</label>
                <input
                  type="number"
                  value={rule.max_amount ?? ""}
                  onChange={(e) => handleChange(rule.id, "max_amount", e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-[#0a0e1a] px-3 py-2 text-sm text-white outline-none"
                />
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm text-slate-300">Min Daily %</label>
                  <input
                    type="number"
                    value={rule.min_daily_profit_percent || ""}
                    onChange={(e) =>
                      handleChange(rule.id, "min_daily_profit_percent", e.target.value)
                    }
                    className="w-full rounded-xl border border-white/10 bg-[#0a0e1a] px-3 py-2 text-sm text-white outline-none"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm text-slate-300">Max Daily %</label>
                  <input
                    type="number"
                    value={rule.max_daily_profit_percent || ""}
                    onChange={(e) =>
                      handleChange(rule.id, "max_daily_profit_percent", e.target.value)
                    }
                    className="w-full rounded-xl border border-white/10 bg-[#0a0e1a] px-3 py-2 text-sm text-white outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm text-slate-300">Usage Limit</label>
                <input
                  type="number"
                  value={rule.user_limit_count ?? ""}
                  onChange={(e) => handleChange(rule.id, "user_limit_count", e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-[#0a0e1a] px-3 py-2 text-sm text-white outline-none"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm text-slate-300">Status</label>
                <select
                  value={rule.status}
                  onChange={(e) => handleChange(rule.id, "status", e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-[#0a0e1a] px-3 py-2 text-sm text-white outline-none"
                >
                  <option value="active">active</option>
                  <option value="inactive">inactive</option>
                </select>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-white/10 bg-black/40 p-4 text-sm space-y-2">
              <DetailRow label="Duration" value={`${rule.duration_days} days`} />
              <DetailRow
                label="Daily Profit"
                value={`${Number(rule.min_daily_profit_percent || 0)}% - ${Number(
                  rule.max_daily_profit_percent || 0
                )}%`}
                valueClassName="text-lime-300"
              />
              <DetailRow label="Min Amount" value={rule.min_amount || 0} />
              <DetailRow
                label="Max Amount"
                value={rule.max_amount == null ? "Unlimited" : rule.max_amount}
              />
              <DetailRow
                label="Usage Limit"
                value={rule.user_limit_count == null ? "No limit" : rule.user_limit_count}
              />
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                onClick={() => handleSave(rule)}
                disabled={savingId === rule.id}
                className="rounded-xl bg-lime-400 px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-lime-300 disabled:opacity-50"
              >
                {savingId === rule.id ? "Saving..." : "Save Rule"}
              </button>

              <button
                onClick={() => handleDeleteRule(rule.id)}
                disabled={savingId === rule.id}
                className="rounded-xl bg-rose-500/10 px-4 py-2.5 text-sm font-semibold text-rose-300 transition hover:bg-rose-500/20 disabled:opacity-50"
              >
                {savingId === rule.id ? "Processing..." : "Delete"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
