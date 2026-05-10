import { useEffect, useMemo, useState } from "react";
import {
  Landmark,
  Percent,
  CalendarClock,
  Wallet,
  FileText,
  RefreshCw,
} from "lucide-react";
import { loanApi, getApiErrorMessage } from "../services/api";
import { useNotification } from "../hooks/useNotification";

function formatAmount(value, digits = 2) {
  const num = Number(value || 0);
  if (!Number.isFinite(num)) return "0.00";
  return num.toFixed(digits);
}

function SummaryRow({ label, value, valueClass = "text-white" }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm text-slate-400">{label}</span>
      <span className={`text-sm font-semibold ${valueClass}`}>{value}</span>
    </div>
  );
}

export default function LoanPage() {
  const token =
    localStorage.getItem("userToken") ||
    localStorage.getItem("token") ||
    localStorage.getItem("accessToken") ||
    "";

  const { showSuccess, showError, showVoucher } = useNotification();

  const [loanSettings, setLoanSettings] = useState({
    title: "Flexible Loan Request",
    subtitle:
      "Submit your request and preview repayment automatically based on the current platform loan settings.",
    note:
      "Loan request text, interest rate, and Interest periods are automated via our integrated Blockchain AI system.",
    interestRate: 0.15,
    interestType: "weekly",
  });

  const [form, setForm] = useState({
    amount: "",
    durationCount: 1,
    reason: "",
    repaymentSource: "",
    note: "",
  });

  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const calculated = useMemo(() => {
    const amount = Number(form.amount || 0);
    const durationCount = Number(form.durationCount || 1);
    const rate = Number(loanSettings.interestRate || 0);

    if (!Number.isFinite(amount) || amount <= 0) {
      return {
        interestPerPeriod: 0,
        totalInterest: 0,
        totalRepayment: 0,
      };
    }

    const interestPerPeriod = amount * (rate / 100);
    const totalInterest = interestPerPeriod * durationCount;
    const totalRepayment = amount + totalInterest;

    return {
      interestPerPeriod,
      totalInterest,
      totalRepayment,
    };
  }, [form.amount, form.durationCount, loanSettings.interestRate]);

  async function loadLoanHistory(silent = false) {
    try {
      if (!silent) setLoadingHistory(true);
      else setRefreshing(true);

      const res = await loanApi.getLoans(token);
      setHistory(Array.isArray(res?.data?.data) ? res.data.data : []);
    } catch (err) {
      console.error("Loan history load failed:", err);
    } finally {
      setLoadingHistory(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadLoanHistory();
  }, []);

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((prev) => ({
      ...prev,
      [name]: name === "durationCount" ? Number(value) : value,
    }));

    setSuccess("");
    setError("");
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const amount = Number(form.amount || 0);

    if (!Number.isFinite(amount) || amount <= 0) {
      showError("Please enter a valid loan amount.");
      return;
    }

    try {
      setSubmitting(true);
      setError("");
      setSuccess("");

      const payload = {
        amount,
        note: [
          form.reason ? `Reason: ${form.reason}` : "",
          form.repaymentSource
            ? `Repayment Source: ${form.repaymentSource}`
            : "",
          form.note ? `Additional Note: ${form.note}` : "",
          `Duration Count: ${form.durationCount}`,
          `Interest Type Preview: ${loanSettings.interestType}`,
        ]
          .filter(Boolean)
          .join(" | "),
      };

      const res = await loanApi.apply(payload, token);
      const responseData = res?.data?.data || {};

      showSuccess(res?.data?.message || `Loan request submitted successfully. Amount: ${formatAmount(amount)} USDT.`);

      showVoucher({
        title: "Loan Request Submitted",
        type: "loan",
        transactionId: responseData.id,
        data: {
          id: responseData.id,
          amount: amount,
          interestRate: responseData.interestRate || loanSettings.interestRate,
          interestType: responseData.interestType || loanSettings.interestType,
          interestAmount: responseData.interestAmount || calculated.totalInterest,
          totalRepayment: responseData.totalRepayment || calculated.totalRepayment,
          status: "Pending",
        },
      });

      setForm({
        amount: "",
        durationCount: 1,
        reason: "",
        repaymentSource: "",
        note: "",
      });

      if (responseData?.interestRate || responseData?.interest_rate) {
        setLoanSettings((prev) => ({
          ...prev,
          interestRate:
            Number(responseData.interestRate || responseData.interest_rate) ||
            prev.interestRate,
        }));
      }

      if (responseData?.interestType || responseData?.interest_type) {
        setLoanSettings((prev) => ({
          ...prev,
          interestType:
            responseData.interestType || responseData.interest_type || prev.interestType,
        }));
      }

      await loadLoanHistory(true);
    } catch (err) {
      showError(getApiErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  function renderStatusClass(status) {
    const value = String(status || "").toLowerCase();

    if (value === "approved") {
      return "border-emerald-500/20 bg-emerald-500/10 text-emerald-300";
    }
    if (value === "pending") {
      return "border-amber-500/20 bg-amber-500/10 text-amber-300";
    }
    if (value === "rejected") {
      return "border-red-500/20 bg-red-500/10 text-red-300";
    }

    return "border-white/10 bg-white/[0.04] text-slate-300";
  }

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <section className="rounded-3xl border border-white/10 bg-[#0a0e1a]/90 p-5 shadow-xl sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-300">
              <Landmark size={24} />
            </div>

            <div>
              <div className="text-xs uppercase tracking-[0.35em] text-slate-400">
                Loan Center
              </div>
              <h1 className="mt-2 text-2xl font-bold text-white sm:text-3xl">
                {loanSettings.title}
              </h1>
              <p className="mt-2 text-sm text-slate-400">
                {loanSettings.subtitle}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => loadLoanHistory(true)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] text-white transition hover:bg-white/[0.06]"
          >
            <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
          </button>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-3xl border border-white/10 bg-[#0a0e1a]/90 p-5 shadow-xl">
          <div className="flex items-center gap-3 text-sm text-slate-400">
            <Percent size={18} className="text-cyan-300" />
            Interest Rate
          </div>
          <div className="mt-3 text-3xl font-bold text-cyan-300">
            {loanSettings.interestRate}%
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-[#0a0e1a]/90 p-5 shadow-xl">
          <div className="flex items-center gap-3 text-sm text-slate-400">
            <CalendarClock size={18} className="text-amber-300" />
            Interest Type
          </div>
          <div className="mt-3 text-3xl font-bold capitalize text-amber-300">
            {loanSettings.interestType}
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-[#0a0e1a]/90 p-5 shadow-xl">
          <div className="flex items-center gap-3 text-sm text-slate-400">
            <Wallet size={18} className="text-emerald-300" />
            Interest / Period
          </div>
          <div className="mt-3 text-3xl font-bold text-emerald-300">
            {formatAmount(calculated.interestPerPeriod)}
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-[#0a0e1a]/90 p-5 shadow-xl">
          <div className="flex items-center gap-3 text-sm text-slate-400">
            <FileText size={18} className="text-violet-300" />
            Total Repayment
          </div>
          <div className="mt-3 text-3xl font-bold text-violet-300">
            {formatAmount(calculated.totalRepayment)}
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1fr_0.95fr]">
        <section className="rounded-3xl border border-white/10 bg-[#0a0e1a]/90 p-5 shadow-xl sm:p-6">
          <h2 className="text-xl font-semibold text-white">Loan Request Form</h2>
          <p className="mt-2 text-sm text-slate-400">
            Fill in the request information below. Interest and repayment are calculated automatically.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label className="mb-2 block text-sm text-slate-300">
                Loan Amount
              </label>
              <input
                type="number"
                name="amount"
                min="0"
                step="0.01"
                value={form.amount}
                onChange={handleChange}
                placeholder="Enter requested amount"
                className="w-full rounded-2xl border border-white/10 bg-slate-800 px-4 py-3 text-white outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm text-slate-300">
                Duration Count ({loanSettings.interestType})
              </label>
              <input
                type="number"
                name="durationCount"
                min="1"
                step="1"
                value={form.durationCount}
                onChange={handleChange}
                className="w-full rounded-2xl border border-white/10 bg-slate-800 px-4 py-3 text-white outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm text-slate-300">
                Loan Reason
              </label>
              <textarea
                name="reason"
                value={form.reason}
                onChange={handleChange}
                rows={4}
                placeholder="Explain why you are requesting this loan"
                className="w-full rounded-2xl border border-white/10 bg-slate-800 px-4 py-3 text-white outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm text-slate-300">
                Repayment Source
              </label>
              <input
                type="text"
                name="repaymentSource"
                value={form.repaymentSource}
                onChange={handleChange}
                placeholder="Salary / trading profit / business / other"
                className="w-full rounded-2xl border border-white/10 bg-slate-800 px-4 py-3 text-white outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm text-slate-300">
                Additional Note
              </label>
              <textarea
                name="note"
                value={form.note}
                onChange={handleChange}
                rows={3}
                placeholder="Optional note"
                className="w-full rounded-2xl border border-white/10 bg-slate-800 px-4 py-3 text-white outline-none focus:border-cyan-500"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-2xl bg-cyan-500 px-5 py-3 font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? "Submitting..." : "Submit Loan Request"}
            </button>
          </form>
        </section>

        <div className="space-y-6">
          <section className="rounded-3xl border border-white/10 bg-[#0a0e1a]/90 p-5 shadow-xl sm:p-6">
            <h2 className="text-xl font-semibold text-white">Repayment Preview</h2>
            <p className="mt-2 text-sm text-slate-400">
              Interest is calculated automatically by our integrated Blockchain AI system.
            </p>

            <div className="mt-6 space-y-4">
              <div className="rounded-2xl border border-white/10 bg-slate-800/60 p-4">
                <SummaryRow
                  label="Loan Amount"
                  value={`${formatAmount(form.amount || 0)} USDT`}
                />
                <div className="mt-3">
                  <SummaryRow
                    label={`Interest Rate (${loanSettings.interestType})`}
                    value={`${loanSettings.interestRate}%`}
                    valueClass="text-cyan-300"
                  />
                </div>
                <div className="mt-3">
                  <SummaryRow
                    label={`Interest / ${loanSettings.interestType}`}
                    value={`${formatAmount(calculated.interestPerPeriod)} USDT`}
                    valueClass="text-amber-300"
                  />
                </div>
                <div className="mt-3">
                  <SummaryRow
                    label="Duration Count"
                    value={String(form.durationCount || 1)}
                    valueClass="text-violet-300"
                  />
                </div>
                <div className="mt-3">
                  <SummaryRow
                    label="Total Interest"
                    value={`${formatAmount(calculated.totalInterest)} USDT`}
                    valueClass="text-rose-300"
                  />
                </div>
                <div className="mt-3 border-t border-white/10 pt-3">
                  <SummaryRow
                    label="Total Repayment"
                    value={`${formatAmount(calculated.totalRepayment)} USDT`}
                    valueClass="text-emerald-300"
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-dashed border-white/10 bg-slate-800/30 p-4 text-sm text-slate-400">
                {loanSettings.note}
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-[#0a0e1a]/90 p-5 shadow-xl sm:p-6">
            <h2 className="text-xl font-semibold text-white">Loan History</h2>
            <p className="mt-2 text-sm text-slate-400">
              Your recent submitted loan requests.
            </p>

            <div className="mt-5 space-y-3">
              {loadingHistory ? (
                <div className="rounded-2xl border border-white/10 bg-slate-800/40 px-4 py-4 text-sm text-slate-400">
                  Loading loan history...
                </div>
              ) : history.length ? (
                history.slice(0, 5).map((item) => (
                  <div
                    key={item.id}
                    className="rounded-2xl border border-white/10 bg-slate-800/40 px-4 py-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="text-sm font-semibold text-white">
                          {formatAmount(item.amount)} USDT
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          {item.created_at
                            ? new Date(item.created_at).toLocaleString()
                            : "-"}
                        </div>
                      </div>

                      <span
                        className={`rounded-full border px-3 py-1 text-xs font-semibold ${renderStatusClass(
                          item.status
                        )}`}
                      >
                        {String(item.status || "pending").replaceAll("_", " ")}
                      </span>
                    </div>

                    <div className="mt-3 text-xs text-slate-400">
                      Interest: {formatAmount(item.interest_amount || 0)} USDT
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-white/10 bg-slate-800/40 px-4 py-4 text-sm text-slate-400">
                  No loan history yet.
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
