import { useEffect, useMemo, useState } from "react";
import { adminApi, getApiErrorMessage } from "../../services/api";
import {
  Landmark,
  Mail,
  Wallet,
  CalendarClock,
  BadgeDollarSign,
  CheckCircle2,
  XCircle,
  RefreshCw,
  AlertCircle,
  Clock3,
  User2,
} from "lucide-react";
// ✅ ADDED: Import toast notification hook
import useToast from "../../components/ToastNotification";

function formatAmount(value) {
  const num = Number(value || 0);
  if (!Number.isFinite(num)) return "0.00";
  return num.toFixed(2);
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function getStatusClasses(status) {
  const value = String(status || "").toLowerCase();

  if (value === "approved") {
    return "border border-emerald-500/20 bg-emerald-500/10 text-emerald-300";
  }

  if (value === "rejected") {
    return "border border-red-500/20 bg-red-500/10 text-red-300";
  }

  if (value === "pending") {
    return "border border-amber-500/20 bg-amber-500/10 text-amber-300";
  }

  return "border border-slate-500/20 bg-slate-500/10 text-slate-300";
}

function StatCard({ title, value, tone = "text-white" }) {
  return (
    <div className="rounded-[24px] border border-white/10 bg-[#0a0e1a] p-4 shadow-xl">
      <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">{title}</div>
      <div className={`mt-3 text-2xl font-semibold sm:text-3xl ${tone}`}>{value}</div>
    </div>
  );
}

export default function AdminLoanPage() {
  const token =
    localStorage.getItem("adminToken") ||
    localStorage.getItem("admin_token") ||
    "";

  // ✅ ADDED: Toast notification hook
  const { toasts, addToast, removeToast, ToastContainer } = useToast();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loans, setLoans] = useState([]);
  const [error, setError] = useState("");
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [actionType, setActionType] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    loadLoans({ initial: true });
  }, []);

  const summary = useMemo(() => {
    const total = loans.length;
    const pending = loans.filter(
      (loan) => String(loan.status || "").toLowerCase() === "pending"
    ).length;
    const approved = loans.filter(
      (loan) => String(loan.status || "").toLowerCase() === "approved"
    ).length;
    const rejected = loans.filter(
      (loan) => String(loan.status || "").toLowerCase() === "rejected"
    ).length;

    return { total, pending, approved, rejected };
  }, [loans]);

  async function loadLoans(options = {}) {
    const { initial = false } = options;

    try {
      setError("");
      setSuccessMessage("");

      if (initial) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      const res = await adminApi.getLoans(token);
      setLoans(Array.isArray(res?.data?.data) ? res.data.data : []);
      
      // ✅ ADDED: Success toast for refresh
      if (!initial) {
        addToast("Loans refreshed successfully", "success");
      }
    } catch (err) {
      const errorMsg = getApiErrorMessage(err) || "Failed to load loans";
      setError(errorMsg);
      // ✅ ADDED: Error toast
      addToast(errorMsg, "error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function approve(id) {
    try {
      setError("");
      setSuccessMessage("");
      setActionLoadingId(id);
      setActionType("approve");

      await adminApi.approveLoan(id, {}, token);
      const successMsg = `Loan #${id} approved successfully`;
      setSuccessMessage(successMsg);
      // ✅ ADDED: Success toast
      addToast(successMsg, "success");
      await loadLoans();
    } catch (err) {
      const errorMsg = getApiErrorMessage(err) || "Failed to approve loan";
      setError(errorMsg);
      // ✅ ADDED: Error toast
      addToast(errorMsg, "error");
    } finally {
      setActionLoadingId(null);
      setActionType("");
    }
  }

  async function reject(id) {
    try {
      setError("");
      setSuccessMessage("");
      setActionLoadingId(id);
      setActionType("reject");

      await adminApi.rejectLoan(id, {}, token);
      const successMsg = `Loan #${id} rejected successfully`;
      setSuccessMessage(successMsg);
      // ✅ ADDED: Success toast
      addToast(successMsg, "success");
      await loadLoans();
    } catch (err) {
      const errorMsg = getApiErrorMessage(err) || "Failed to reject loan";
      setError(errorMsg);
      // ✅ ADDED: Error toast
      addToast(errorMsg, "error");
    } finally {
      setActionLoadingId(null);
      setActionType("");
    }
  }

  if (loading) {
    return (
      <div className="rounded-[24px] border border-white/10 bg-[#0a0e1a] p-5 text-sm text-slate-300">
        Loading loan requests...
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* ✅ ADDED: Toast Container */}
      <ToastContainer />

      <section className="rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(124,58,237,0.10),transparent_18%),linear-gradient(180deg,#111827_0%,#020617_100%)] p-5 shadow-xl">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.32em] text-cyan-300">
              Loan Management
            </p>
            <h1 className="mt-2 flex items-center gap-2 text-2xl font-bold text-white sm:text-3xl">
              <Landmark className="h-6 w-6 text-cyan-300" />
              Loan Requests
            </h1>
            <p className="mt-2 text-sm text-slate-400">
              Review user loan requests, approve valid requests, and reject unsupported applications.
            </p>
          </div>

          <button
            onClick={() => loadLoans()}
            disabled={refreshing}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Total Requests" value={summary.total} />
        <StatCard title="Pending" value={summary.pending} tone="text-amber-300" />
        <StatCard title="Approved" value={summary.approved} tone="text-emerald-300" />
        <StatCard title="Rejected" value={summary.rejected} tone="text-red-300" />
      </section>

      {error && (
        <section className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-red-300 shadow-lg">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-semibold">Something went wrong</p>
              <p className="mt-1 text-sm">{error}</p>
            </div>
          </div>
        </section>
      )}

      {successMessage && (
        <section className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-emerald-300 shadow-lg">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-semibold">Success</p>
              <p className="mt-1 text-sm">{successMessage}</p>
            </div>
          </div>
        </section>
      )}

      {loans.length === 0 ? (
        <section className="rounded-[24px] border border-dashed border-white/10 bg-[#0a0e1a]/60 p-8 text-center shadow-lg">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5">
            <Landmark className="h-6 w-6 text-slate-400" />
          </div>
          <h2 className="mt-4 text-lg font-semibold text-white">No loan requests</h2>
          <p className="mt-2 text-sm text-slate-400">
            New loan applications will appear here once users submit them.
          </p>
        </section>
      ) : (
        <section className="space-y-4">
          {loans.map((loan) => {
            const status = String(loan.status || "pending").toLowerCase();
            const isPending = status === "pending";
            const isProcessing = actionLoadingId === loan.id;

            return (
              <article
                key={loan.id}
                className="rounded-[24px] border border-white/10 bg-[#0a0e1a] p-4 shadow-xl sm:p-5"
              >
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-semibold text-white">
                        Loan #{loan.id}
                      </h2>
                      <span
                        className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${getStatusClasses(
                          status
                        )}`}
                      >
                        {status}
                      </span>
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-3 text-sm text-slate-300 sm:grid-cols-2 xl:grid-cols-3">
                      <div className="flex items-start gap-2">
                        <Mail className="mt-0.5 h-4 w-4 text-slate-400" />
                        <div className="min-w-0">
                          <p className="text-[11px] uppercase tracking-wide text-slate-500">
                            Email
                          </p>
                          <p className="break-all text-white">{loan.email || "-"}</p>
                        </div>
                      </div>

                      <div className="flex items-start gap-2">
                        <User2 className="mt-0.5 h-4 w-4 text-slate-400" />
                        <div className="min-w-0">
                          <p className="text-[11px] uppercase tracking-wide text-slate-500">
                            Name
                          </p>
                          <p className="text-white">{loan.name || "-"}</p>
                        </div>
                      </div>

                      <div className="flex items-start gap-2">
                        <Wallet className="mt-0.5 h-4 w-4 text-slate-400" />
                        <div>
                          <p className="text-[11px] uppercase tracking-wide text-slate-500">
                            Amount
                          </p>
                          <p className="font-semibold text-cyan-300">
                            {formatAmount(loan.amount)} USDT
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start gap-2">
                        <BadgeDollarSign className="mt-0.5 h-4 w-4 text-slate-400" />
                        <div>
                          <p className="text-[11px] uppercase tracking-wide text-slate-500">
                            Interest Rate
                          </p>
                          <p className="text-white">
                            {formatAmount(loan.interest_rate)}%
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start gap-2">
                        <Clock3 className="mt-0.5 h-4 w-4 text-slate-400" />
                        <div>
                          <p className="text-[11px] uppercase tracking-wide text-slate-500">
                            Interest Type
                          </p>
                          <p className="text-white">
                            {loan.interest_type || "-"}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start gap-2">
                        <CalendarClock className="mt-0.5 h-4 w-4 text-slate-400" />
                        <div>
                          <p className="text-[11px] uppercase tracking-wide text-slate-500">
                            Created
                          </p>
                          <p className="text-white">
                            {formatDate(loan.created_at)}
                          </p>
                        </div>
                      </div>
                    </div>

                    {!!loan.note && (
                      <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-3">
                        <p className="text-[11px] uppercase tracking-wide text-slate-500">
                          User Note
                        </p>
                        <p className="mt-2 whitespace-pre-wrap text-sm text-slate-300">
                          {loan.note}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="flex w-full shrink-0 flex-col gap-2 sm:flex-row xl:w-auto xl:flex-col">
                    <button
                      onClick={() => approve(loan.id)}
                      disabled={!isPending || isProcessing}
                      className="inline-flex min-w-[130px] items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isProcessing && actionType === "approve" ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4" />
                      )}
                      Approve
                    </button>

                    <button
                      onClick={() => reject(loan.id)}
                      disabled={!isPending || isProcessing}
                      className="inline-flex min-w-[130px] items-center justify-center gap-2 rounded-xl bg-red-500 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-red-400 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isProcessing && actionType === "reject" ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        <XCircle className="h-4 w-4" />
                      )}
                      Reject
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      )}
    </div>
  );
}
