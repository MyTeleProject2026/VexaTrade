import { useEffect, useMemo, useState } from "react";
import { RefreshCw, Search } from "lucide-react";
import { adminApi, getApiErrorMessage } from "../../services/api";

function formatFee(value) {
  const num = Number(value || 0);
  if (!Number.isFinite(num)) return "0.00000000";
  return num.toFixed(8);
}

function getStatusBadge(status) {
  const value = String(status || "").toLowerCase();

  if (value === "active") {
    return "border border-emerald-500/20 bg-emerald-500/10 text-emerald-300";
  }

  if (value === "inactive") {
    return "border border-amber-500/20 bg-amber-500/10 text-amber-300";
  }

  return "border border-white/10 bg-white/5 text-slate-300";
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

function DetailBox({ label, value, valueClassName = "text-white" }) {
  return (
    <div className="rounded-xl border border-white/10 bg-slate-900/50 p-3">
      <div className="text-[11px] uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className={`mt-1 text-sm ${valueClassName}`}>{value}</div>
    </div>
  );
}

export default function AdminWithdrawalFeesPage() {
  const token =
    localStorage.getItem("adminToken") ||
    localStorage.getItem("admin_token") ||
    "";

  const [fees, setFees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [form, setForm] = useState({
    coin: "USDT",
    network: "TRC20",
    fee_amount: "0",
    fee_type: "fixed",
    status: "active",
  });

  useEffect(() => {
    loadFees(true);
  }, [token]);

  async function loadFees(isFirstLoad = false) {
    try {
      if (isFirstLoad) setLoading(true);
      else setRefreshing(true);

      setError("");

      const res = await adminApi.getWithdrawalFees(token);
      setFees(Array.isArray(res.data?.data) ? res.data.data : []);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  function resetForm() {
    setForm({
      coin: "USDT",
      network: "TRC20",
      fee_amount: "0",
      fee_type: "fixed",
      status: "active",
    });
    setEditingId(null);
  }

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  function handleEdit(item) {
    setEditingId(item.id);
    setForm({
      coin: String(item.coin || "").toUpperCase(),
      network: String(item.network || "").toUpperCase(),
      fee_amount: String(item.fee_amount ?? "0"),
      fee_type: String(item.fee_type || "fixed").toLowerCase(),
      status: String(item.status || "active").toLowerCase(),
    });
    setError("");
    setSuccess("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSubmit(e) {
    e.preventDefault();

    const coin = String(form.coin || "").trim().toUpperCase();
    const network = String(form.network || "").trim().toUpperCase();
    const feeAmount = Number(form.fee_amount || 0);
    const feeType = String(form.fee_type || "fixed").trim().toLowerCase();
    const status = String(form.status || "active").trim().toLowerCase();

    if (!coin) {
      setError("Coin is required.");
      setSuccess("");
      return;
    }

    if (!network) {
      setError("Network is required.");
      setSuccess("");
      return;
    }

    if (!Number.isFinite(feeAmount) || feeAmount < 0) {
      setError("Fee amount must be zero or greater.");
      setSuccess("");
      return;
    }

    if (!["fixed", "percent"].includes(feeType)) {
      setError("Fee type must be fixed or percent.");
      setSuccess("");
      return;
    }

    if (!["active", "inactive"].includes(status)) {
      setError("Status must be active or inactive.");
      setSuccess("");
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      await adminApi.saveWithdrawalFee(
        {
          id: editingId || undefined,
          coin,
          network,
          fee_amount: feeAmount,
          fee_type: feeType,
          status,
        },
        token
      );

      setSuccess(
        editingId
          ? `Withdrawal fee #${editingId} updated successfully.`
          : "Withdrawal fee added successfully."
      );

      resetForm();
      await loadFees(false);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(item) {
    const confirmed = window.confirm(
      `Are you sure you want to remove ${item.coin} ${item.network} withdrawal fee?`
    );
    if (!confirmed) return;

    try {
      setDeletingId(item.id);
      setError("");
      setSuccess("");

      if (typeof adminApi.deleteWithdrawalFee !== "function") {
        throw new Error("deleteWithdrawalFee API function is missing in services/api.js");
      }

      await adminApi.deleteWithdrawalFee(item.id, token);
      setSuccess(`Withdrawal fee #${item.id} removed successfully.`);

      if (editingId === item.id) {
        resetForm();
      }

      await loadFees(false);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setDeletingId(null);
    }
  }

  const filteredFees = useMemo(() => {
    const term = search.trim().toLowerCase();

    return fees.filter((item) => {
      const currentStatus = String(item.status || "").toLowerCase();

      if (statusFilter !== "all" && currentStatus !== statusFilter) {
        return false;
      }

      if (!term) return true;

      const haystack = [
        item.id,
        item.coin,
        item.network,
        item.fee_amount,
        item.fee_type,
        item.status,
      ]
        .map((value) => String(value ?? "").toLowerCase())
        .join(" ");

      return haystack.includes(term);
    });
  }, [fees, search, statusFilter]);

  const summary = useMemo(() => {
    return {
      total: fees.length,
      active: fees.filter(
        (item) => String(item.status || "").toLowerCase() === "active"
      ).length,
      inactive: fees.filter(
        (item) => String(item.status || "").toLowerCase() === "inactive"
      ).length,
      networks: new Set(
        fees.map(
          (item) =>
            `${String(item.coin || "").toUpperCase()}-${String(
              item.network || ""
            ).toUpperCase()}`
        )
      ).size,
    };
  }, [fees]);

  if (loading) {
    return (
      <div className="rounded-[24px] border border-white/10 bg-slate-900/70 p-5 text-sm text-slate-300">
        Loading withdrawal fees...
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <section className="rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(124,58,237,0.10),transparent_18%),linear-gradient(180deg,#111827_0%,#020617_100%)] p-5 shadow-xl">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.32em] text-violet-300">
              Withdrawal Fees
            </p>
            <h1 className="mt-2 text-2xl font-bold text-white sm:text-3xl">
              Withdrawal Fee Control
            </h1>
            <p className="mt-2 text-sm text-slate-400">
              Add, edit, and manage withdrawal fee values by coin and network.
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
              {refreshing ? "Refreshing..." : "Fee Control Ready"}
            </span>

            <button
              type="button"
              onClick={() => loadFees(false)}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-white/5"
            >
              <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
              Refresh
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Total Rows" value={summary.total} />
        <StatCard title="Active" value={summary.active} tone="text-emerald-300" />
        <StatCard title="Inactive" value={summary.inactive} tone="text-amber-300" />
        <StatCard title="Coin Networks" value={summary.networks} tone="text-cyan-300" />
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

      <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
        <section className="rounded-[24px] border border-white/10 bg-slate-900/70 p-4 shadow-xl sm:p-5">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">
                {editingId ? "Edit Withdrawal Fee" : "Add Withdrawal Fee"}
              </h2>
              <p className="mt-1 text-sm text-slate-400">
                Configure fee value, fee type, and status.
              </p>
            </div>

            {editingId ? (
              <button
                type="button"
                onClick={resetForm}
                className="rounded-xl border border-white/10 px-4 py-2 text-xs font-semibold text-white transition hover:bg-white/5"
              >
                Cancel Edit
              </button>
            ) : null}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm text-slate-300">Coin</label>
                <input
                  type="text"
                  name="coin"
                  value={form.coin}
                  onChange={handleChange}
                  placeholder="USDT / BTC / ETH"
                  className="w-full rounded-xl border border-white/10 bg-slate-800 px-3 py-2.5 text-sm text-white outline-none focus:border-violet-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm text-slate-300">Network</label>
                <input
                  type="text"
                  name="network"
                  value={form.network}
                  onChange={handleChange}
                  placeholder="TRC20 / ERC20 / BEP20"
                  className="w-full rounded-xl border border-white/10 bg-slate-800 px-3 py-2.5 text-sm text-white outline-none focus:border-violet-500"
                />
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <div>
                <label className="mb-2 block text-sm text-slate-300">Fee Amount</label>
                <input
                  type="number"
                  min="0"
                  step="0.00000001"
                  name="fee_amount"
                  value={form.fee_amount}
                  onChange={handleChange}
                  placeholder="0.00000000"
                  className="w-full rounded-xl border border-white/10 bg-slate-800 px-3 py-2.5 text-sm text-white outline-none focus:border-violet-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm text-slate-300">Fee Type</label>
                <select
                  name="fee_type"
                  value={form.fee_type}
                  onChange={handleChange}
                  className="w-full rounded-xl border border-white/10 bg-slate-800 px-3 py-2.5 text-sm text-white outline-none focus:border-violet-500"
                >
                  <option value="fixed">fixed</option>
                  <option value="percent">percent</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm text-slate-300">Status</label>
                <select
                  name="status"
                  value={form.status}
                  onChange={handleChange}
                  className="w-full rounded-xl border border-white/10 bg-slate-800 px-3 py-2.5 text-sm text-white outline-none focus:border-violet-500"
                >
                  <option value="active">active</option>
                  <option value="inactive">inactive</option>
                </select>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4 space-y-2 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-500">Coin / Network</span>
                <span className="text-white">
                  {String(form.coin || "").toUpperCase()} {String(form.network || "").toUpperCase()}
                </span>
              </div>

              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-500">Fee Amount</span>
                <span className="text-cyan-300">{formatFee(form.fee_amount)}</span>
              </div>

              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-500">Fee Type</span>
                <span className="text-white">{form.fee_type}</span>
              </div>

              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-500">Status</span>
                <span
                  className={
                    String(form.status || "").toLowerCase() === "active"
                      ? "text-emerald-300"
                      : "text-amber-300"
                  }
                >
                  {form.status}
                </span>
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-xl bg-violet-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-400 disabled:opacity-60"
            >
              {saving
                ? editingId
                  ? "Updating..."
                  : "Saving..."
                : editingId
                ? "Update Withdrawal Fee"
                : "Add Withdrawal Fee"}
            </button>
          </form>
        </section>

        <section className="rounded-[24px] border border-white/10 bg-slate-900/70 p-4 shadow-xl sm:p-5">
          <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">Saved Withdrawal Fees</h2>
              <p className="mt-1 text-sm text-slate-400">
                Manage all configured fee rows.
              </p>
            </div>

            <span className="rounded-full border border-white/10 bg-slate-950/80 px-3 py-1 text-[11px] text-slate-300">
              {filteredFees.length} Result{filteredFees.length === 1 ? "" : "s"}
            </span>
          </div>

          <div className="mb-4 grid gap-3 lg:grid-cols-[1.1fr_0.55fr]">
            <div className="relative">
              <Search
                size={14}
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"
              />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by coin, network, fee..."
                className="w-full rounded-xl border border-white/10 bg-slate-800 py-2.5 pl-10 pr-4 text-sm text-white outline-none focus:border-violet-500"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-xl border border-white/10 bg-slate-800 px-3 py-2.5 text-sm text-white outline-none focus:border-violet-500"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          <div className="space-y-3 max-h-[760px] overflow-y-auto pr-1">
            {filteredFees.length ? (
              filteredFees.map((item) => (
                <div
                  key={item.id}
                  className="rounded-2xl border border-white/10 bg-slate-800/60 px-4 py-4"
                >
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="font-semibold text-white">
                          {String(item.coin || "").toUpperCase()} {String(item.network || "").toUpperCase()}
                        </div>

                        <span className="rounded-full border border-white/10 bg-slate-950/80 px-3 py-1 text-[11px] text-slate-300">
                          ID #{item.id}
                        </span>

                        <span
                          className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${getStatusBadge(
                            item.status
                          )}`}
                        >
                          {item.status}
                        </span>
                      </div>

                      <div className="mt-3 grid gap-3 md:grid-cols-3">
                        <DetailBox
                          label="Fee Amount"
                          value={formatFee(item.fee_amount)}
                          valueClassName="text-cyan-300 font-semibold"
                        />
                        <DetailBox label="Fee Type" value={item.fee_type || "fixed"} />
                        <DetailBox label="Status" value={item.status || "--"} />
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 sm:flex-row xl:flex-col">
                      <button
                        type="button"
                        onClick={() => handleEdit(item)}
                        className="rounded-xl border border-white/10 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-white/5"
                      >
                        Edit
                      </button>

                      <button
                        type="button"
                        disabled={deletingId === item.id}
                        onClick={() => handleDelete(item)}
                        className="rounded-xl bg-rose-500/10 px-4 py-2.5 text-xs font-semibold text-rose-300 transition hover:bg-rose-500/20 disabled:opacity-50"
                      >
                        {deletingId === item.id ? "Removing..." : "Delete"}
                      </button>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-white/10 bg-slate-800/40 px-4 py-8 text-center text-sm text-slate-400">
                No withdrawal fees found.
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}