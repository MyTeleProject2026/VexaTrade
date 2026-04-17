import { useEffect, useMemo, useState } from "react";
import { adminApi, getApiErrorMessage } from "../../services/api";
import {
  Landmark,
  Percent,
  CalendarRange,
  RefreshCw,
  Save,
  AlertCircle,
  CheckCircle2,
  Settings2,
  BadgeDollarSign,
} from "lucide-react";

function formatPercent(value) {
  const num = Number(value || 0);
  if (!Number.isFinite(num)) return "0.00";
  return num.toFixed(2);
}

function getCycleDescription(type) {
  const value = String(type || "").toLowerCase();

  if (value === "daily") {
    return "Interest is applied every day for newly approved loans.";
  }

  if (value === "weekly") {
    return "Interest is applied every week for newly approved loans.";
  }

  if (value === "monthly") {
    return "Interest is applied every month for newly approved loans.";
  }

  if (value === "yearly") {
    return "Interest is applied every year for newly approved loans.";
  }

  return "Configure the repayment interest cycle for new loan requests.";
}

function StatCard({ title, value, tone = "text-white" }) {
  return (
    <div className="rounded-[24px] border border-white/10 bg-[#0a0e1a] p-4 shadow-xl">
      <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
        {title}
      </div>
      <div className={`mt-3 text-2xl font-semibold sm:text-3xl ${tone}`}>
        {value}
      </div>
    </div>
  );
}

export default function AdminLoanSettingsPage() {
  const token =
    localStorage.getItem("adminToken") ||
    localStorage.getItem("admin_token") ||
    "";

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [form, setForm] = useState({
    interest_rate: "0.15",
    interest_type: "weekly",
  });

  useEffect(() => {
    loadSettings({ initial: true });
  }, []);

  const previewText = useMemo(() => {
    return `Users will be charged ${formatPercent(
      form.interest_rate
    )}% interest per ${form.interest_type}.`;
  }, [form.interest_rate, form.interest_type]);

  async function loadSettings(options = {}) {
    const { initial = false } = options;

    try {
      setError("");
      setSuccess("");

      if (initial) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      const res = await adminApi.getLoanSettings(token);
      const data = res?.data?.data || {};

      setForm({
        interest_rate: String(data.interest_rate ?? "0.15"),
        interest_type: data.interest_type || "weekly",
      });
    } catch (err) {
      setError(getApiErrorMessage(err) || "Failed to load loan settings");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  function handleChange(e) {
    const { name, value } = e.target;

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  async function handleSave() {
    try {
      setSaving(true);
      setError("");
      setSuccess("");

      await adminApi.updateLoanSettings(
        {
          interest_rate: Number(form.interest_rate || 0),
          interest_type: String(form.interest_type || "weekly"),
        },
        token
      );

      setSuccess("Loan settings saved successfully.");
      await loadSettings();
    } catch (err) {
      setError(getApiErrorMessage(err) || "Failed to save loan settings");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-[24px] border border-white/10 bg-[#0a0e1a] p-5 text-sm text-slate-300">
        Loading loan settings...
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <section className="rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(124,58,237,0.10),transparent_18%),linear-gradient(180deg,#111827_0%,#020617_100%)] p-5 shadow-xl">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.32em] text-cyan-300">
              Loan Settings
            </p>
            <h1 className="mt-2 flex items-center gap-2 text-2xl font-bold text-white sm:text-3xl">
              <Settings2 className="h-6 w-6 text-cyan-300" />
              Interest Configuration
            </h1>
            <p className="mt-2 text-sm text-slate-400">
              Set the global interest rate and cycle used for all new loan requests.
            </p>
          </div>

          <button
            type="button"
            onClick={() => loadSettings()}
            disabled={refreshing}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </section>

      {error ? (
        <section className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-red-300 shadow-lg">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-semibold">Something went wrong</p>
              <p className="mt-1 text-sm">{error}</p>
            </div>
          </div>
        </section>
      ) : null}

      {success ? (
        <section className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-emerald-300 shadow-lg">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-semibold">Saved</p>
              <p className="mt-1 text-sm">{success}</p>
            </div>
          </div>
        </section>
      ) : null}

      <section className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        <StatCard
          title="Interest Rate"
          value={`${formatPercent(form.interest_rate)}%`}
          tone="text-cyan-300"
        />

        <StatCard
          title="Interest Type"
          value={form.interest_type}
          tone="text-cyan-300"
        />

        <StatCard
          title="Loan Module"
          value="Active"
          tone="text-white"
        />
      </section>

      <section className="rounded-[24px] border border-white/10 bg-[#0a0e1a] p-4 shadow-xl sm:p-5">
        <div className="grid gap-5 xl:grid-cols-[1.3fr_0.9fr]">
          <div className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-300">
                  <BadgeDollarSign className="h-4 w-4 text-cyan-300" />
                  Interest Rate (%)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  name="interest_rate"
                  value={form.interest_rate}
                  onChange={handleChange}
                  className="w-full rounded-xl border border-white/10 bg-[#0a0e1a] px-3 py-2.5 text-sm text-white outline-none transition focus:border-cyan-500"
                  placeholder="Enter interest rate"
                />
                <p className="mt-2 text-xs text-slate-500">
                  Example: 0.15 means 0.15% interest.
                </p>
              </div>

              <div>
                <label className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-300">
                  <CalendarRange className="h-4 w-4 text-cyan-300" />
                  Interest Type
                </label>
                <select
                  name="interest_type"
                  value={form.interest_type}
                  onChange={handleChange}
                  className="w-full rounded-xl border border-white/10 bg-[#0a0e1a] px-3 py-2.5 text-sm text-white outline-none transition focus:border-cyan-500"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                </select>
                <p className="mt-2 text-xs text-slate-500">
                  Choose how often the configured interest cycle is applied.
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#050812]/50 p-4">
              <p className="text-[11px] uppercase tracking-[0.25em] text-slate-500">
                Preview
              </p>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                Users will be charged{" "}
                <span className="font-semibold text-cyan-300">
                  {formatPercent(form.interest_rate)}%
                </span>{" "}
                interest per{" "}
                <span className="font-semibold capitalize text-cyan-300">
                  {form.interest_type}
                </span>
                .
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="text-[11px] uppercase tracking-[0.25em] text-slate-500">
                Cycle Description
              </p>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                {getCycleDescription(form.interest_type)}
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="text-[11px] uppercase tracking-[0.25em] text-slate-500">
                Current Configuration
              </p>
              <div className="mt-3 space-y-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-400">Interest Rate</span>
                  <span className="font-semibold text-cyan-300">
                    {formatPercent(form.interest_rate)}%
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-400">Interest Type</span>
                  <span className="font-semibold capitalize text-cyan-300">
                    {form.interest_type}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row xl:flex-col">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-500 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Save Settings
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => loadSettings()}
                disabled={refreshing || saving}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
                Reload
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}