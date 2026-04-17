import { useEffect, useMemo, useState } from "react";
import { RefreshCw, Search, ImageOff, ExternalLink } from "lucide-react";
import { adminApi, getApiErrorMessage } from "../../services/api";

const RAW_API_BASE =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

const FILE_BASE_URL = RAW_API_BASE.replace(/\/api\/?$/, "");

function formatAmount(value) {
  const num = Number(value || 0);
  if (!Number.isFinite(num)) return "0.00";
  return num.toFixed(2);
}

function formatDateTime(value) {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function getStatusBadge(status) {
  const value = String(status || "").toLowerCase();

  if (value === "pending") {
    return "border border-yellow-500/20 bg-yellow-500/10 text-yellow-300";
  }
  if (value === "approved") {
    return "border border-emerald-500/20 bg-emerald-500/10 text-emerald-300";
  }
  if (value === "rejected") {
    return "border border-rose-500/20 bg-rose-500/10 text-rose-300";
  }

  return "border border-white/10 bg-white/5 text-slate-300";
}

function DepositStatCard({ title, value, tone = "text-white" }) {
  return (
    <div className="rounded-[24px] border border-white/10 bg-slate-900/70 p-4 shadow-xl">
      <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">{title}</div>
      <div className={`mt-3 text-2xl font-bold sm:text-3xl ${tone}`}>{value}</div>
    </div>
  );
}

function InfoItem({ label, value, breakAll = false, valueClassName = "text-white" }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
      <div className="text-[11px] uppercase tracking-wide text-slate-400">{label}</div>
      <div className={`mt-2 text-sm ${breakAll ? "break-all" : "break-words"} ${valueClassName}`}>
        {value}
      </div>
    </div>
  );
}

function DepositProofImage({ src, alt }) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div className="flex h-52 w-full flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-slate-950/60 text-slate-500 sm:h-64">
        <ImageOff size={24} />
        <div className="mt-2 text-sm">Proof image not available</div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-950/60">
      <img
        src={src}
        alt={alt}
        onError={() => setFailed(true)}
        className="h-52 w-full object-cover sm:h-64"
      />
    </div>
  );
}

export default function AdminDepositsPage() {
  const token =
    localStorage.getItem("adminToken") ||
    localStorage.getItem("admin_token") ||
    "";

  const [deposits, setDeposits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    fetchDeposits(true);
  }, [token]);

  useEffect(() => {
    if (!token) return;

    const interval = setInterval(() => {
      fetchDeposits(false, true);
    }, 5000);

    return () => clearInterval(interval);
  }, [token]);

  async function fetchDeposits(isFirstLoad = false, silentRefresh = false) {
    try {
      if (isFirstLoad) setLoading(true);
      if (silentRefresh) setRefreshing(true);

      setError("");
      const res = await adminApi.getDeposits(token);
      setDeposits(Array.isArray(res.data?.data) ? res.data.data : []);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function handleApprove(id) {
    const confirmed = window.confirm("Approve this deposit?");
    if (!confirmed) return;

    try {
      setActionLoading(`approve-${id}`);
      setError("");
      setSuccess("");

      await adminApi.approveDeposit(id, {}, token);
      setSuccess(`Deposit #${id} approved successfully.`);
      await fetchDeposits(false, false);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setActionLoading("");
    }
  }

  async function handleReject(id) {
    const confirmed = window.confirm("Reject this deposit?");
    if (!confirmed) return;

    try {
      setActionLoading(`reject-${id}`);
      setError("");
      setSuccess("");

      await adminApi.rejectDeposit(id, {}, token);
      setSuccess(`Deposit #${id} rejected successfully.`);
      await fetchDeposits(false, false);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setActionLoading("");
    }
  }

  function getProofUrl(proof) {
    if (!proof) return "";
    if (String(proof).startsWith("http")) return proof;
    return `${FILE_BASE_URL}${proof}`;
  }

  const filteredDeposits = useMemo(() => {
    const term = search.trim().toLowerCase();

    return deposits.filter((deposit) => {
      const currentStatus = String(deposit.status || "").toLowerCase();

      if (statusFilter !== "all" && currentStatus !== statusFilter) {
        return false;
      }

      if (!term) return true;

      const haystack = [
        deposit.id,
        deposit.user_id,
        deposit.coin,
        deposit.network,
        deposit.amount,
        deposit.txid,
        deposit.status,
        deposit.created_at,
        deposit.note,
        deposit.admin_note,
      ]
        .map((value) => String(value ?? "").toLowerCase())
        .join(" ");

      return haystack.includes(term);
    });
  }, [deposits, search, statusFilter]);

  const summary = useMemo(() => {
    const pending = deposits.filter(
      (item) => String(item.status || "").toLowerCase() === "pending"
    ).length;
    const approved = deposits.filter(
      (item) => String(item.status || "").toLowerCase() === "approved"
    ).length;
    const rejected = deposits.filter(
      (item) => String(item.status || "").toLowerCase() === "rejected"
    ).length;
    const totalAmount = deposits.reduce(
      (sum, item) => sum + Number(item.amount || 0),
      0
    );

    return {
      total: deposits.length,
      pending,
      approved,
      rejected,
      totalAmount: formatAmount(totalAmount),
    };
  }, [deposits]);

  if (loading) {
    return (
      <div className="rounded-[24px] border border-white/10 bg-slate-900/70 p-5 text-sm text-slate-300">
        Loading deposits...
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <section className="rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(34,197,94,0.08),transparent_18%),linear-gradient(180deg,#111827_0%,#020617_100%)] p-5 shadow-xl">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.32em] text-violet-300">
              Admin Deposits
            </p>
            <h1 className="mt-2 text-2xl font-bold text-white sm:text-3xl">
              Deposit Management
            </h1>
            <p className="mt-2 text-sm text-slate-400">
              Review payment proof, verify wallet deposits, and approve or reject requests.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
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
              {refreshing ? "Refreshing..." : "Live Monitoring"}
            </span>

            <button
              type="button"
              onClick={() => fetchDeposits(false, true)}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/5"
            >
              <RefreshCw size={15} className={refreshing ? "animate-spin" : ""} />
              Refresh
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <DepositStatCard title="Total" value={summary.total} />
        <DepositStatCard title="Pending" value={summary.pending} tone="text-yellow-300" />
        <DepositStatCard title="Approved" value={summary.approved} tone="text-emerald-300" />
        <DepositStatCard title="Rejected" value={summary.rejected} tone="text-rose-300" />
        <DepositStatCard title="Amount" value={summary.totalAmount} tone="text-cyan-300" />
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

      <section className="rounded-[24px] border border-white/10 bg-slate-900/70 p-4 shadow-xl sm:p-5">
        <div className="grid gap-3 lg:grid-cols-[1fr_auto_auto]">
          <div className="relative">
            <Search
              size={15}
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by ID, user, coin, network, txid..."
              className="w-full rounded-2xl border border-white/10 bg-slate-800 py-3 pl-11 pr-4 text-sm text-white outline-none focus:border-violet-500"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-2xl border border-white/10 bg-slate-800 px-4 py-3 text-sm text-white outline-none focus:border-violet-500"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>

          <div className="flex items-center rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-300">
            {filteredDeposits.length} Result{filteredDeposits.length === 1 ? "" : "s"}
          </div>
        </div>
      </section>

      <section className="space-y-4">
        {filteredDeposits.length ? (
          filteredDeposits.map((deposit) => {
            const status = String(deposit.status || "").toLowerCase();
            const isPending = status === "pending";
            const proofUrl = getProofUrl(deposit.proof);

            return (
              <div
                key={deposit.id}
                className="rounded-[24px] border border-white/10 bg-slate-900/70 p-4 shadow-xl sm:p-5"
              >
                <div className="grid gap-5 2xl:grid-cols-[1.15fr_0.85fr]">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-3">
                      <h2 className="text-lg font-semibold text-white sm:text-xl">
                        Deposit #{deposit.id}
                      </h2>

                      <span className="rounded-full border border-white/10 bg-slate-950/80 px-3 py-1 text-[11px] text-slate-300">
                        User #{deposit.user_id}
                      </span>

                      <span
                        className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${getStatusBadge(
                          status
                        )}`}
                      >
                        {status}
                      </span>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      <InfoItem label="Coin" value={deposit.coin || "--"} />
                      <InfoItem label="Network" value={deposit.network || "--"} />
                      <InfoItem
                        label="Amount"
                        value={formatAmount(deposit.amount)}
                        valueClassName="text-cyan-300 font-semibold"
                      />
                      <InfoItem label="Created" value={formatDateTime(deposit.created_at)} />
                    </div>

                    <div className="mt-3 grid gap-3 xl:grid-cols-2">
                      <InfoItem label="TXID" value={deposit.txid || "--"} breakAll />
                      <InfoItem label="Note" value={deposit.note || deposit.admin_note || "--"} />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-base font-semibold text-white">
                          Payment Proof
                        </div>

                        {proofUrl ? (
                          <a
                            href={proofUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/5"
                          >
                            <ExternalLink size={14} />
                            Open Image
                          </a>
                        ) : null}
                      </div>

                      <div className="mt-4">
                        <DepositProofImage
                          src={proofUrl}
                          alt={`Deposit proof ${deposit.id}`}
                        />
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-1">
                      <button
                        type="button"
                        disabled={!isPending || actionLoading === `approve-${deposit.id}`}
                        onClick={() => handleApprove(deposit.id)}
                        className="rounded-2xl bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-300 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {actionLoading === `approve-${deposit.id}`
                          ? "Approving..."
                          : "Approve Deposit"}
                      </button>

                      <button
                        type="button"
                        disabled={!isPending || actionLoading === `reject-${deposit.id}`}
                        onClick={() => handleReject(deposit.id)}
                        className="rounded-2xl bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-300 transition hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {actionLoading === `reject-${deposit.id}`
                          ? "Rejecting..."
                          : "Reject Deposit"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="rounded-[24px] border border-white/10 bg-slate-900/70 px-4 py-10 text-center text-sm text-slate-400 shadow-xl">
            No deposits found.
          </div>
        )}
      </section>
    </div>
  );
}