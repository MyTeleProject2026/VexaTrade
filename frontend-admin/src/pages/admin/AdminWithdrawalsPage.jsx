import { useEffect, useMemo, useState } from "react";
import { RefreshCw, Search } from "lucide-react";
import { adminApi, getApiErrorMessage } from "../../services/api";

function formatAmount(v) {
  const num = Number(v || 0);
  if (!Number.isFinite(num)) return "0.00";
  return num.toFixed(2);
}

function formatTime(date) {
  if (!date) return "--";
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleString();
}

function getStatusClass(status) {
  const value = String(status || "").toLowerCase();

  if (value === "approved" || value === "completed" || value === "success") {
    return "border border-emerald-500/20 bg-emerald-500/10 text-emerald-300";
  }

  if (value === "rejected" || value === "failed") {
    return "border border-rose-500/20 bg-rose-500/10 text-rose-300";
  }

  return "border border-amber-500/20 bg-amber-500/10 text-amber-300";
}

function StatCard({ label, value, tone = "text-white" }) {
  return (
    <div className="rounded-[24px] border border-white/10 bg-[#0a0e1a] p-4 shadow-xl">
      <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
        {label}
      </div>
      <div className={`mt-3 text-2xl font-bold sm:text-3xl ${tone}`}>{value}</div>
    </div>
  );
}

function InfoBox({ label, value, valueClassName = "text-white", breakAll = false }) {
  return (
    <div className="rounded-xl border border-white/10 bg-[#0a0e1a]/50 p-3">
      <div className="text-[11px] uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className={`mt-1 text-sm ${breakAll ? "break-all" : "break-words"} ${valueClassName}`}>
        {value}
      </div>
    </div>
  );
}

export default function AdminWithdrawalsPage() {
  const token =
    localStorage.getItem("adminToken") ||
    localStorage.getItem("admin_token") ||
    "";

  const [withdrawals, setWithdrawals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [filters, setFilters] = useState({
    search: "",
    status: "all",
    coin: "all",
    network: "all",
  });

  useEffect(() => {
    fetchWithdrawals(true);
  }, [token]);

  useEffect(() => {
    if (!token) return;

    const interval = setInterval(() => {
      fetchWithdrawals(false, true);
    }, 5000);

    return () => clearInterval(interval);
  }, [token]);

  async function fetchWithdrawals(isInitial = false, silentRefresh = false) {
    try {
      if (isInitial) setLoading(true);
      if (silentRefresh) setRefreshing(true);

      setError("");
      const res = await adminApi.getWithdrawals(token);
      setWithdrawals(Array.isArray(res.data?.data) ? res.data.data : []);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function handleApprove(id) {
    const confirmed = window.confirm("Approve this withdrawal?");
    if (!confirmed) return;

    try {
      setActionLoading(`approve-${id}`);
      setError("");
      setSuccess("");

      await adminApi.approveWithdrawal(id, {}, token);
      setSuccess(`Withdrawal #${id} approved successfully.`);
      await fetchWithdrawals(false, false);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setActionLoading("");
    }
  }

  async function handleReject(id) {
    const confirmed = window.confirm(
      "Reject this withdrawal? User balance will be refunded."
    );
    if (!confirmed) return;

    try {
      setActionLoading(`reject-${id}`);
      setError("");
      setSuccess("");

      await adminApi.rejectWithdrawal(id, {}, token);
      setSuccess(`Withdrawal #${id} rejected and refunded successfully.`);
      await fetchWithdrawals(false, false);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setActionLoading("");
    }
  }

  function handleFilterChange(e) {
    const { name, value } = e.target;
    setFilters((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  const coinOptions = useMemo(() => {
    const set = new Set(
      withdrawals.map((item) => String(item.coin || "").trim()).filter(Boolean)
    );
    return ["all", ...Array.from(set)];
  }, [withdrawals]);

  const networkOptions = useMemo(() => {
    const set = new Set(
      withdrawals.map((item) => String(item.network || "").trim()).filter(Boolean)
    );
    return ["all", ...Array.from(set)];
  }, [withdrawals]);

  const filteredWithdrawals = useMemo(() => {
    const term = String(filters.search || "").trim().toLowerCase();

    return withdrawals.filter((item) => {
      const status = String(item.status || "").toLowerCase();
      const coin = String(item.coin || "");
      const network = String(item.network || "");

      if (filters.status !== "all" && status !== filters.status) return false;
      if (filters.coin !== "all" && coin !== filters.coin) return false;
      if (filters.network !== "all" && network !== filters.network) return false;

      if (!term) return true;

      const haystack = [
        item.id,
        item.user_id,
        item.coin,
        item.network,
        item.amount,
        item.address,
        item.wallet_address,
        item.txid,
        item.status,
        item.created_at,
        item.note,
        item.admin_note,
      ]
        .map((value) => String(value ?? "").toLowerCase())
        .join(" ");

      return haystack.includes(term);
    });
  }, [withdrawals, filters]);

  const stats = useMemo(() => {
    return {
      total: withdrawals.length,
      pending: withdrawals.filter(
        (item) => String(item.status || "").toLowerCase() === "pending"
      ).length,
      approved: withdrawals.filter(
        (item) => String(item.status || "").toLowerCase() === "approved"
      ).length,
      rejected: withdrawals.filter(
        (item) => String(item.status || "").toLowerCase() === "rejected"
      ).length,
      amount: withdrawals.reduce((sum, item) => sum + Number(item.amount || 0), 0),
    };
  }, [withdrawals]);

  if (loading) {
    return (
      <div className="rounded-[24px] border border-white/10 bg-[#0a0e1a] p-5 text-sm text-slate-300">
        Loading withdrawals...
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <section className="rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(124,58,237,0.10),transparent_18%),linear-gradient(180deg,#111827_0%,#020617_100%)] p-5 shadow-xl">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.32em] text-cyan-300">
              Withdrawals
            </p>
            <h1 className="mt-2 text-2xl font-bold text-white sm:text-3xl">
              Withdrawal Management
            </h1>
            <p className="mt-2 text-sm text-slate-400">
              Review wallet destinations and approve or reject outgoing transfer requests.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span
              className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${
                refreshing
                  ? "border-cyan-500/20 bg-cyan-500/10 text-cyan-300"
                  : "border-white/10 bg-[#050812]/70 text-slate-300"
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
              onClick={() => fetchWithdrawals(false, true)}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/5"
            >
              <RefreshCw size={15} className={refreshing ? "animate-spin" : ""} />
              Refresh
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Total" value={stats.total} />
        <StatCard label="Pending" value={stats.pending} tone="text-amber-300" />
        <StatCard label="Approved" value={stats.approved} tone="text-emerald-300" />
        <StatCard label="Rejected" value={stats.rejected} tone="text-rose-300" />
        <StatCard
          label="Amount"
          value={`${formatAmount(stats.amount)} USDT`}
          tone="text-cyan-300"
        />
      </section>

      {error ? (
        <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
          {error}
        </div>
      ) : null}

      {success ? (
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
          {success}
        </div>
      ) : null}

      <section className="rounded-[24px] border border-white/10 bg-[#0a0e1a] p-4 shadow-xl sm:p-5">
        <div className="grid gap-3 lg:grid-cols-4">
          <div className="relative">
            <Search
              size={15}
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"
            />
            <input
              type="text"
              name="search"
              value={filters.search}
              onChange={handleFilterChange}
              placeholder="Search by ID, user, coin, address..."
              className="w-full rounded-2xl border border-white/10 bg-[#0a0e1a] py-3 pl-11 pr-4 text-sm text-white outline-none focus:border-cyan-500"
            />
          </div>

          <select
            name="status"
            value={filters.status}
            onChange={handleFilterChange}
            className="rounded-2xl border border-white/10 bg-[#0a0e1a] px-4 py-3 text-sm text-white outline-none focus:border-cyan-500"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>

          <select
            name="coin"
            value={filters.coin}
            onChange={handleFilterChange}
            className="rounded-2xl border border-white/10 bg-[#0a0e1a] px-4 py-3 text-sm text-white outline-none focus:border-cyan-500"
          >
            {coinOptions.map((coin) => (
              <option key={coin} value={coin}>
                {coin === "all" ? "All Coins" : coin}
              </option>
            ))}
          </select>

          <select
            name="network"
            value={filters.network}
            onChange={handleFilterChange}
            className="rounded-2xl border border-white/10 bg-[#0a0e1a] px-4 py-3 text-sm text-white outline-none focus:border-cyan-500"
          >
            {networkOptions.map((network) => (
              <option key={network} value={network}>
                {network === "all" ? "All Networks" : network}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-white sm:text-xl">
            Withdrawal Requests
          </h2>
          <span className="rounded-full border border-white/10 bg-[#050812]/80 px-3 py-1 text-[11px] text-slate-300">
            {filteredWithdrawals.length} Record{filteredWithdrawals.length === 1 ? "" : "s"}
          </span>
        </div>

        {filteredWithdrawals.length === 0 ? (
          <div className="rounded-[24px] border border-white/10 bg-[#0a0e1a]/40 px-4 py-10 text-center text-sm text-slate-400">
            No withdrawals found.
          </div>
        ) : (
          filteredWithdrawals.map((w) => {
            const status = String(w.status || "").toLowerCase();
            const isPending = status === "pending";
            const address = w.wallet_address || w.address || "--";

            return (
              <div
                key={w.id}
                className="rounded-[24px] border border-white/10 bg-[#0a0e1a] p-4 shadow-xl sm:p-5"
              >
                <div className="grid gap-5 2xl:grid-cols-[1.15fr_0.85fr]">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-3">
                      <h3 className="text-lg font-semibold text-white sm:text-xl">
                        Withdrawal #{w.id}
                      </h3>

                      <span className="rounded-full border border-white/10 bg-[#050812]/80 px-3 py-1 text-[11px] text-slate-300">
                        User #{w.user_id}
                      </span>

                      <span
                        className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${getStatusClass(
                          status
                        )}`}
                      >
                        {status || "pending"}
                      </span>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      <InfoBox label="Coin" value={w.coin || "--"} />
                      <InfoBox label="Network" value={w.network || "--"} />
                      <InfoBox
                        label="Amount"
                        value={formatAmount(w.amount)}
                        valueClassName="text-cyan-300 font-semibold"
                      />
                      <InfoBox label="Time" value={formatTime(w.created_at)} />
                    </div>

                    <div className="mt-3 grid gap-3 xl:grid-cols-2">
                      <InfoBox label="Address" value={address} breakAll />
                      <InfoBox
                        label="TXID / Note"
                        value={w.txid || w.admin_note || w.note || "--"}
                        breakAll
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="rounded-2xl border border-white/10 bg-[#050812]/40 p-4">
                      <div className="text-base font-semibold text-white">
                        Request Summary
                      </div>

                      <div className="mt-4 space-y-3">
                        <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#0a0e1a]/50 px-4 py-3">
                          <span className="text-slate-400">User ID</span>
                          <span className="text-white">#{w.user_id}</span>
                        </div>

                        <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#0a0e1a]/50 px-4 py-3">
                          <span className="text-slate-400">Amount</span>
                          <span className="font-semibold text-cyan-300">
                            {formatAmount(w.amount)} USDT
                          </span>
                        </div>

                        <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#0a0e1a]/50 px-4 py-3">
                          <span className="text-slate-400">Status</span>
                          <span className="text-white capitalize">{status || "pending"}</span>
                        </div>
                      </div>
                    </div>

                    {isPending ? (
                      <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-1">
                        <button
                          type="button"
                          disabled={actionLoading === `approve-${w.id}`}
                          onClick={() => handleApprove(w.id)}
                          className="rounded-2xl bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-300 transition hover:bg-emerald-500/20 disabled:opacity-50"
                        >
                          {actionLoading === `approve-${w.id}` ? "Approving..." : "Approve"}
                        </button>

                        <button
                          type="button"
                          disabled={actionLoading === `reject-${w.id}`}
                          onClick={() => handleReject(w.id)}
                          className="rounded-2xl bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-300 transition hover:bg-rose-500/20 disabled:opacity-50"
                        >
                          {actionLoading === `reject-${w.id}` ? "Rejecting..." : "Reject"}
                        </button>
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-white/10 bg-[#0a0e1a]/50 px-4 py-4 text-center text-sm text-slate-400">
                        This request has already been processed.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </section>
    </div>
  );
}