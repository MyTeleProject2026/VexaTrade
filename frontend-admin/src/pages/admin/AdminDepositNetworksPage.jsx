import { useEffect, useMemo, useState } from "react";
import { RefreshCw, Search, ImageOff, QrCode, Copy } from "lucide-react";
import { adminApi, getApiErrorMessage } from "../../services/api";

const RAW_API_BASE =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

const FILE_BASE_URL = RAW_API_BASE.replace(/\/api\/?$/, "");

const DEFAULT_FORM = {
  coin: "USDT",
  network: "TRC20",
  display_label: "USDT TRC20",
  address: "",
  minimum_deposit: 0,
  sort_order: 0,
  qr_image_url: "",
  status: "active",
};

function formatAmount(value) {
  const num = Number(value || 0);
  if (!Number.isFinite(num)) return "0.00";
  return num.toFixed(2);
}

function resolveImageUrl(url) {
  if (!url) return "";
  if (String(url).startsWith("http://") || String(url).startsWith("https://")) {
    return url;
  }
  return `${FILE_BASE_URL}${url}`;
}

function getStatusClass(status) {
  const value = String(status || "").toLowerCase();

  if (value === "active") {
    return "border border-emerald-500/20 bg-emerald-500/10 text-emerald-300";
  }

  if (value === "inactive") {
    return "border border-amber-500/20 bg-amber-500/10 text-amber-300";
  }

  return "border border-white/10 bg-white/5 text-slate-300";
}

function StatCard({ label, value, tone = "text-white" }) {
  return (
    <div className="rounded-[24px] border border-white/10 bg-slate-900/70 p-4 shadow-xl">
      <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
        {label}
      </div>
      <div className={`mt-3 text-2xl font-bold sm:text-3xl ${tone}`}>{value}</div>
    </div>
  );
}

function PreviewRow({ label, value, toneClass = "text-white" }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-slate-500">{label}</span>
      <span className={`text-right text-sm ${toneClass}`}>{value}</span>
    </div>
  );
}

function ImagePreview({ src, alt }) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div className="flex h-32 w-32 flex-col items-center justify-center rounded-xl border border-dashed border-white/10 bg-slate-950/40 text-slate-500 sm:h-36 sm:w-36">
        <ImageOff size={22} />
        <span className="mt-2 text-xs">QR not available</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      onError={() => setFailed(true)}
      className="h-32 w-32 rounded-xl border border-white/10 bg-white object-contain p-2 sm:h-36 sm:w-36"
    />
  );
}

export default function AdminDepositNetworksPage() {
  const token =
    localStorage.getItem("adminToken") ||
    localStorage.getItem("admin_token") ||
    "";

  const [networks, setNetworks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingQr, setUploadingQr] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [editingId, setEditingId] = useState(null);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [filters, setFilters] = useState({
    search: "",
    status: "all",
    coin: "all",
  });

  const [form, setForm] = useState(DEFAULT_FORM);

  useEffect(() => {
    fetchNetworks(true);
  }, [token]);

  async function fetchNetworks(isInitial = false) {
    try {
      if (isInitial) setLoading(true);
      else setRefreshing(true);

      setError("");

      const res = await adminApi.getDepositNetworks(token);
      setNetworks(Array.isArray(res.data?.data) ? res.data.data : []);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  function resetForm() {
    setForm(DEFAULT_FORM);
    setEditingId(null);
  }

  function handleChange(e) {
    const { name, value } = e.target;

    setForm((prev) => ({
      ...prev,
      [name]:
        name === "minimum_deposit" || name === "sort_order"
          ? value === ""
            ? ""
            : Number(value)
          : value,
    }));
  }

  function handleFilterChange(e) {
    const { name, value } = e.target;
    setFilters((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  async function handleQrUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingQr(true);
      setError("");
      setSuccess("");

      const formData = new FormData();
      formData.append("qr", file);

      const res = await adminApi.uploadDepositNetworkQr(formData, token);
      const uploadedUrl = res.data?.url || res.data?.data?.url || "";

      setForm((prev) => ({
        ...prev,
        qr_image_url: uploadedUrl,
      }));

      setSuccess("QR image uploaded successfully.");
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setUploadingQr(false);
      e.target.value = "";
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();

    if (!String(form.coin || "").trim()) {
      setError("Coin is required.");
      return;
    }

    if (!String(form.network || "").trim()) {
      setError("Network is required.");
      return;
    }

    if (!String(form.address || "").trim()) {
      setError("Wallet address is required.");
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const payload = {
        coin: String(form.coin || "").trim().toUpperCase(),
        network: String(form.network || "").trim().toUpperCase(),
        display_label: String(form.display_label || "").trim(),
        address: String(form.address || "").trim(),
        minimum_deposit: Number(form.minimum_deposit || 0),
        sort_order: Number(form.sort_order || 0),
        qr_image_url: String(form.qr_image_url || "").trim(),
        status: String(form.status || "active").trim().toLowerCase(),
      };

      if (editingId) {
        await adminApi.updateDepositNetwork(editingId, payload, token);
        setSuccess(`Deposit network #${editingId} updated successfully.`);
      } else {
        await adminApi.createDepositNetwork(payload, token);
        setSuccess("Deposit network created successfully.");
      }

      resetForm();
      await fetchNetworks(false);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  function handleEdit(item) {
    setEditingId(item.id);
    setForm({
      coin: item.coin || "",
      network: item.network || "",
      display_label:
        item.display_label || `${item.coin || ""} ${item.network || ""}`.trim(),
      address: item.address || "",
      minimum_deposit: Number(item.minimum_deposit || 0),
      sort_order: Number(item.sort_order || 0),
      qr_image_url: item.qr_image_url || "",
      status: String(item.status || "active").toLowerCase(),
    });

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  async function handleDelete(id) {
    const confirmed = window.confirm(
      `Are you sure you want to remove deposit network #${id}?`
    );
    if (!confirmed) return;

    try {
      setDeletingId(id);
      setError("");
      setSuccess("");

      await adminApi.deleteDepositNetwork(id, token);
      setSuccess(`Deposit network #${id} removed successfully.`);

      if (editingId === id) {
        resetForm();
      }

      await fetchNetworks(false);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setDeletingId(null);
    }
  }

  async function copyAddress(address) {
    try {
      await navigator.clipboard.writeText(address || "");
      setSuccess("Address copied successfully.");
    } catch {
      setError("Failed to copy address.");
    }
  }

  const coinOptions = useMemo(() => {
    const set = new Set(
      networks.map((item) => String(item.coin || "").trim()).filter(Boolean)
    );
    return ["all", ...Array.from(set)];
  }, [networks]);

  const filteredNetworks = useMemo(() => {
    const term = String(filters.search || "").trim().toLowerCase();

    return networks.filter((item) => {
      const itemStatus = String(item.status || "").toLowerCase();
      const itemCoin = String(item.coin || "");

      if (filters.status !== "all" && itemStatus !== filters.status) {
        return false;
      }

      if (filters.coin !== "all" && itemCoin !== filters.coin) {
        return false;
      }

      if (!term) return true;

      const haystack = [
        item.id,
        item.coin,
        item.network,
        item.display_label,
        item.address,
        item.minimum_deposit,
        item.sort_order,
        item.status,
      ]
        .map((value) => String(value ?? "").toLowerCase())
        .join(" ");

      return haystack.includes(term);
    });
  }, [networks, filters]);

  const stats = useMemo(() => {
    return {
      total: networks.length,
      active: networks.filter(
        (item) => String(item.status || "").toLowerCase() === "active"
      ).length,
      inactive: networks.filter(
        (item) => String(item.status || "").toLowerCase() === "inactive"
      ).length,
      withQr: networks.filter((item) => Boolean(item.qr_image_url)).length,
    };
  }, [networks]);

  if (loading) {
    return (
      <div className="rounded-[24px] border border-white/10 bg-slate-900/70 p-5 text-sm text-slate-300">
        Loading deposit networks...
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <section className="rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(124,58,237,0.10),transparent_18%),linear-gradient(180deg,#111827_0%,#020617_100%)] p-5 shadow-xl">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.32em] text-violet-300">
              Deposit Networks
            </p>
            <h1 className="mt-2 text-2xl font-bold text-white sm:text-3xl">
              Wallet Address Management
            </h1>
            <p className="mt-2 text-sm text-slate-400">
              Manage deposit addresses, QR images, labels, minimum limits, and network status.
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
              {refreshing ? "Refreshing..." : "Ready"}
            </span>

            <button
              type="button"
              onClick={() => fetchNetworks(false)}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/5"
            >
              <RefreshCw size={15} className={refreshing ? "animate-spin" : ""} />
              Refresh
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total" value={stats.total} />
        <StatCard label="Active" value={stats.active} tone="text-emerald-300" />
        <StatCard label="Inactive" value={stats.inactive} tone="text-amber-300" />
        <StatCard label="With QR" value={stats.withQr} tone="text-cyan-300" />
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

      <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
        <section className="rounded-[24px] border border-white/10 bg-slate-900/70 p-4 shadow-xl sm:p-5">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">
                {editingId ? `Edit Network #${editingId}` : "Add Deposit Network"}
              </h2>
              <p className="mt-1 text-sm text-slate-400">
                {editingId
                  ? "Update your saved deposit network information."
                  : "Create a new deposit network for user deposits."}
              </p>
            </div>

            {editingId ? (
              <button
                type="button"
                onClick={resetForm}
                className="rounded-2xl border border-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/5"
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
                  name="coin"
                  value={form.coin}
                  onChange={handleChange}
                  placeholder="Coin"
                  className="w-full rounded-2xl border border-white/10 bg-slate-800 px-4 py-3 text-sm text-white outline-none focus:border-violet-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm text-slate-300">Network</label>
                <input
                  name="network"
                  value={form.network}
                  onChange={handleChange}
                  placeholder="Network"
                  className="w-full rounded-2xl border border-white/10 bg-slate-800 px-4 py-3 text-sm text-white outline-none focus:border-violet-500"
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm text-slate-300">Display Label</label>
              <input
                name="display_label"
                value={form.display_label}
                onChange={handleChange}
                placeholder="Display Label"
                className="w-full rounded-2xl border border-white/10 bg-slate-800 px-4 py-3 text-sm text-white outline-none focus:border-violet-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm text-slate-300">Wallet Address</label>
              <textarea
                name="address"
                value={form.address}
                onChange={handleChange}
                placeholder="Paste wallet address"
                rows={4}
                className="w-full rounded-2xl border border-white/10 bg-slate-800 px-4 py-3 text-sm text-white outline-none focus:border-violet-500"
              />
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm text-slate-300">Minimum Deposit</label>
                <input
                  type="number"
                  name="minimum_deposit"
                  min="0"
                  step="0.01"
                  value={form.minimum_deposit}
                  onChange={handleChange}
                  placeholder="Minimum Deposit"
                  className="w-full rounded-2xl border border-white/10 bg-slate-800 px-4 py-3 text-sm text-white outline-none focus:border-violet-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm text-slate-300">Sort Order</label>
                <input
                  type="number"
                  name="sort_order"
                  min="0"
                  step="1"
                  value={form.sort_order}
                  onChange={handleChange}
                  placeholder="Sort Order"
                  className="w-full rounded-2xl border border-white/10 bg-slate-800 px-4 py-3 text-sm text-white outline-none focus:border-violet-500"
                />
              </div>
            </div>

            <div className="space-y-3 rounded-2xl border border-white/10 bg-slate-900/50 p-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">
                  Upload QR Image
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleQrUpload}
                  className="block w-full text-sm text-slate-300 file:mr-4 file:rounded-xl file:border-0 file:bg-violet-500 file:px-4 file:py-2 file:font-semibold file:text-white hover:file:bg-violet-400"
                />
              </div>

              {uploadingQr ? (
                <div className="text-sm text-cyan-300">Uploading QR image...</div>
              ) : null}

              <div>
                <label className="mb-2 block text-sm text-slate-300">QR Image URL</label>
                <input
                  name="qr_image_url"
                  value={form.qr_image_url}
                  onChange={handleChange}
                  placeholder="QR Image URL"
                  className="w-full rounded-2xl border border-white/10 bg-slate-800 px-4 py-3 text-sm text-white outline-none focus:border-violet-500"
                />
              </div>

              {form.qr_image_url ? (
                <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                  <div className="mb-3 flex items-center gap-2 text-sm text-slate-400">
                    <QrCode size={16} />
                    QR Preview
                  </div>
                  <div className="flex justify-center sm:justify-start">
                    <ImagePreview
                      src={resolveImageUrl(form.qr_image_url)}
                      alt="QR preview"
                    />
                  </div>
                </div>
              ) : null}
            </div>

            <div>
              <label className="mb-2 block text-sm text-slate-300">Status</label>
              <select
                name="status"
                value={form.status}
                onChange={handleChange}
                className="w-full rounded-2xl border border-white/10 bg-slate-800 px-4 py-3 text-sm text-white outline-none focus:border-violet-500"
              >
                <option value="active">active</option>
                <option value="inactive">inactive</option>
              </select>
            </div>

            <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4 text-sm space-y-2">
              <PreviewRow
                label="Coin / Network"
                value={`${String(form.coin || "").toUpperCase()} ${String(form.network || "").toUpperCase()}`}
              />
              <PreviewRow
                label="Minimum Deposit"
                value={formatAmount(form.minimum_deposit)}
                toneClass="text-cyan-300"
              />
              <PreviewRow label="Sort Order" value={Number(form.sort_order || 0)} />
              <PreviewRow
                label="Status"
                value={form.status}
                toneClass={
                  String(form.status || "").toLowerCase() === "active"
                    ? "text-emerald-300"
                    : "text-amber-300"
                }
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-2xl bg-violet-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-violet-400 disabled:opacity-60"
            >
              {saving
                ? editingId
                  ? "Updating..."
                  : "Saving..."
                : editingId
                ? "Update Deposit Network"
                : "Save Deposit Network"}
            </button>
          </form>
        </section>

        <section className="rounded-[24px] border border-white/10 bg-slate-900/70 p-4 shadow-xl sm:p-5">
          <div className="mb-5 flex flex-col gap-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">Saved Deposit Networks</h2>
                <p className="mt-1 text-sm text-slate-400">
                  Review, edit, and remove existing deposit wallet networks.
                </p>
              </div>

              <span className="rounded-full border border-white/10 bg-slate-950/80 px-3 py-1 text-[11px] text-slate-300">
                {filteredNetworks.length} Network{filteredNetworks.length === 1 ? "" : "s"}
              </span>
            </div>

            <div className="grid gap-3 lg:grid-cols-[1fr_auto_auto]">
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
                  placeholder="Search by coin, network, label..."
                  className="w-full rounded-2xl border border-white/10 bg-slate-800 py-3 pl-11 pr-4 text-sm text-white outline-none focus:border-violet-500"
                />
              </div>

              <select
                name="status"
                value={filters.status}
                onChange={handleFilterChange}
                className="rounded-2xl border border-white/10 bg-slate-800 px-4 py-3 text-sm text-white outline-none focus:border-violet-500"
              >
                <option value="all">All Status</option>
                <option value="active">active</option>
                <option value="inactive">inactive</option>
              </select>

              <select
                name="coin"
                value={filters.coin}
                onChange={handleFilterChange}
                className="rounded-2xl border border-white/10 bg-slate-800 px-4 py-3 text-sm text-white outline-none focus:border-violet-500"
              >
                {coinOptions.map((coin) => (
                  <option key={coin} value={coin}>
                    {coin === "all" ? "All Coins" : coin}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-4 max-h-[900px] overflow-y-auto pr-1">
            {filteredNetworks.length ? (
              filteredNetworks.map((item) => (
                <div
                  key={item.id}
                  className="rounded-2xl border border-white/10 bg-slate-800/60 p-4"
                >
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="font-semibold text-white">
                            {item.display_label || `${item.coin} ${item.network}`}
                          </div>
                          <span className="rounded-full border border-white/10 bg-slate-950/80 px-2.5 py-1 text-[11px] text-slate-300">
                            ID #{item.id}
                          </span>
                          <span
                            className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${getStatusClass(
                              item.status
                            )}`}
                          >
                            {item.status}
                          </span>
                        </div>

                        <div className="mt-2 text-[11px] text-slate-400">
                          {item.coin} • {item.network}
                        </div>

                        <div className="mt-3 break-all rounded-2xl border border-white/10 bg-slate-900/50 px-4 py-3 text-sm text-slate-300">
                          {item.address || "--"}
                        </div>

                        <div className="mt-3">
                          <button
                            type="button"
                            onClick={() => copyAddress(item.address)}
                            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/5"
                          >
                            <Copy size={14} />
                            Copy Address
                          </button>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleEdit(item)}
                          className="rounded-xl border border-cyan-500/20 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-300 transition hover:bg-cyan-500/20"
                        >
                          Edit
                        </button>

                        <button
                          type="button"
                          disabled={deletingId === item.id}
                          onClick={() => handleDelete(item.id)}
                          className="rounded-xl bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-300 transition hover:bg-rose-500/20 disabled:opacity-50"
                        >
                          {deletingId === item.id ? "Removing..." : "Remove"}
                        </button>
                      </div>
                    </div>

                    <div className="grid gap-3 md:grid-cols-3">
                      <div className="rounded-xl border border-white/10 bg-slate-900/50 p-3">
                        <div className="text-[11px] uppercase tracking-wide text-slate-500">
                          Minimum Deposit
                        </div>
                        <div className="mt-1 text-sm text-cyan-300">
                          {formatAmount(item.minimum_deposit || 0)}
                        </div>
                      </div>

                      <div className="rounded-xl border border-white/10 bg-slate-900/50 p-3">
                        <div className="text-[11px] uppercase tracking-wide text-slate-500">
                          Sort Order
                        </div>
                        <div className="mt-1 text-sm text-white">
                          {Number(item.sort_order || 0)}
                        </div>
                      </div>

                      <div className="rounded-xl border border-white/10 bg-slate-900/50 p-3">
                        <div className="text-[11px] uppercase tracking-wide text-slate-500">
                          QR Status
                        </div>
                        <div className="mt-1 text-sm text-white">
                          {item.qr_image_url ? "Uploaded" : "No QR"}
                        </div>
                      </div>
                    </div>

                    {item.qr_image_url ? (
                      <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                        <div className="mb-3 text-sm text-slate-400">QR Image</div>
                        <div className="flex justify-center sm:justify-start">
                          <ImagePreview
                            src={resolveImageUrl(item.qr_image_url)}
                            alt={`${item.display_label || item.coin} QR`}
                          />
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-white/10 bg-slate-800/40 px-4 py-8 text-center text-sm text-slate-400">
                No deposit networks found.
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}