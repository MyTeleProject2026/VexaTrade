import { useEffect, useMemo, useState } from "react";
import { RefreshCw, Search } from "lucide-react";
import { adminApi, getApiErrorMessage } from "../../services/api";
// ✅ ADDED: Import toast notification hook
import useToast from "../../components/ToastNotification";

function downloadCsv(filename, rows) {
  const csv = rows
    .map((row) =>
      row
        .map((value) => {
          const text = String(value ?? "");
          const escaped = text.replace(/"/g, '""');
          return `"${escaped}"`;
        })
        .join(",")
    )
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function formatDateTime(value) {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
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

function LogInfo({ label, value, breakAll = false }) {
  return (
    <div className="rounded-xl border border-white/10 bg-[#0a0e1a]/50 p-3">
      <div className="text-[11px] uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className={`mt-1 text-sm text-slate-200 ${breakAll ? "break-all" : "break-words"}`}>
        {value}
      </div>
    </div>
  );
}

export default function AdminAuditLogsPage() {
  const token =
    localStorage.getItem("adminToken") ||
    localStorage.getItem("admin_token") ||
    "";

  // ✅ ADDED: Toast notification hook
  const { toasts, addToast, removeToast, ToastContainer } = useToast();

  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [page, setPage] = useState(1);

  const pageSize = 15;

  useEffect(() => {
    loadLogs(true);
  }, [token]);

  useEffect(() => {
    if (!token) return;

    const interval = setInterval(() => {
      loadLogs(false, true);
    }, 5000);

    return () => clearInterval(interval);
  }, [token]);

  async function loadLogs(isInitial = false, silentRefresh = false) {
    try {
      if (isInitial) setLoading(true);
      if (silentRefresh) setRefreshing(true);

      setError("");

      const res = await adminApi.getAuditLogs(token);
      setLogs(Array.isArray(res.data?.data) ? res.data.data : []);
      
      // ✅ ADDED: Success toast for silent refresh
      if (silentRefresh) {
        addToast("Audit logs refreshed successfully", "success");
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

  async function handleClearLogs() {
    const confirmed = window.confirm(
      "Are you sure you want to clear all audit logs?"
    );
    if (!confirmed) return;

    try {
      setClearing(true);
      setError("");
      setSuccess("");

      await adminApi.clearAuditLogs(token);
      setSuccess("All audit logs cleared successfully.");
      
      // ✅ ADDED: Success toast
      addToast("All audit logs cleared successfully", "success");
      
      setPage(1);
      await loadLogs(false, false);
    } catch (err) {
      const errorMsg = getApiErrorMessage(err);
      setError(errorMsg);
      // ✅ ADDED: Error toast
      addToast(errorMsg, "error");
    } finally {
      setClearing(false);
    }
  }

  const actionOptions = useMemo(() => {
    const unique = new Set(
      logs.map((log) => String(log.action || "").trim()).filter(Boolean)
    );
    return ["all", ...Array.from(unique)];
  }, [logs]);

  const filteredLogs = useMemo(() => {
    const term = search.trim().toLowerCase();

    return logs.filter((log) => {
      const matchesAction =
        actionFilter === "all" ||
        String(log.action || "").toLowerCase() === actionFilter.toLowerCase();

      if (!matchesAction) return false;

      if (!term) return true;

      const haystack = [
        log.id,
        log.admin_id,
        log.target_user_id,
        log.reference_id,
        log.action,
        log.note,
        log.created_at,
      ]
        .map((value) => String(value ?? "").toLowerCase())
        .join(" ");

      return haystack.includes(term);
    });
  }, [logs, search, actionFilter]);

  const summary = useMemo(() => {
    return {
      total: logs.length,
      filtered: filteredLogs.length,
      actions: actionOptions.filter((item) => item !== "all").length,
      latest: logs.length ? formatDateTime(logs[0]?.created_at) : "--",
    };
  }, [logs, filteredLogs, actionOptions]);

  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / pageSize));

  useEffect(() => {
    setPage(1);
  }, [search, actionFilter]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const paginatedLogs = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredLogs.slice(start, start + pageSize);
  }, [filteredLogs, page]);

  function handleExportCsv() {
    const header = [
      "ID",
      "Admin ID",
      "Action",
      "Target User ID",
      "Reference ID",
      "Note",
      "Created At",
    ];

    const rows = filteredLogs.map((log) => [
      log.id,
      log.admin_id,
      log.action,
      log.target_user_id,
      log.reference_id,
      log.note,
      formatDateTime(log.created_at),
    ]);

    downloadCsv("audit-logs.csv", [header, ...rows]);
    
    // ✅ ADDED: Success toast for export
    addToast(`Exported ${filteredLogs.length} audit logs to CSV`, "success");
  }

  if (loading) {
    return (
      <div className="rounded-[24px] border border-white/10 bg-[#0a0e1a] p-5 text-sm text-slate-300">
        Loading audit logs...
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
              Audit Logs
            </p>
            <h1 className="mt-2 text-2xl font-bold text-white sm:text-3xl">
              Audit Logs
            </h1>
            <p className="mt-2 text-sm text-slate-400">
              Track admin activity, review actions, and export records.
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
              onClick={() => loadLogs(false, true)}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-white/5"
            >
              <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
              Refresh
            </button>

            <button
              type="button"
              onClick={handleExportCsv}
              className="rounded-xl border border-white/10 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-white/5"
            >
              Export CSV
            </button>

            <button
              type="button"
              onClick={handleClearLogs}
              disabled={clearing}
              className="rounded-xl bg-rose-500/10 px-4 py-2.5 text-xs font-semibold text-rose-300 transition hover:bg-rose-500/20 disabled:opacity-50"
            >
              {clearing ? "Clearing..." : "Clear All Logs"}
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Total Logs" value={summary.total} />
        <StatCard title="Filtered" value={summary.filtered} tone="text-cyan-300" />
        <StatCard title="Action Types" value={summary.actions} tone="text-emerald-300" />
        <StatCard title="Latest Record" value={summary.latest} tone="text-amber-300" />
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

      <section className="rounded-[24px] border border-white/10 bg-[#0a0e1a] p-4 shadow-xl sm:p-5">
        <div className="grid gap-3 lg:grid-cols-[1.3fr_0.8fr_auto]">
          <div className="relative">
            <Search
              size={14}
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by action, note, admin ID..."
              className="w-full rounded-xl border border-white/10 bg-[#0a0e1a] py-2.5 pl-10 pr-4 text-sm text-white outline-none focus:border-cyan-500"
            />
          </div>

          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="rounded-xl border border-white/10 bg-[#0a0e1a] px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-500"
          >
            {actionOptions.map((action) => (
              <option key={action} value={action}>
                {action === "all" ? "All Actions" : action}
              </option>
            ))}
          </select>

          <div className="flex items-center rounded-xl border border-white/10 bg-[#050812]/70 px-4 py-2.5 text-sm text-slate-300">
            {filteredLogs.length} Result{filteredLogs.length === 1 ? "" : "s"}
          </div>
        </div>
      </section>

      <section className="space-y-4 xl:hidden">
        {paginatedLogs.length ? (
          paginatedLogs.map((log) => (
            <div
              key={log.id}
              className="rounded-2xl border border-white/10 bg-[#0a0e1a] p-4 shadow-xl"
            >
              <div className="flex flex-wrap items-center gap-2">
                <div className="text-base font-semibold text-white">
                  Log #{log.id}
                </div>

                <span className="rounded-full border border-white/10 bg-[#050812]/80 px-2.5 py-1 text-xs font-semibold text-slate-200">
                  {log.action || "--"}
                </span>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <LogInfo label="Admin ID" value={log.admin_id ?? "--"} />
                <LogInfo label="Target User" value={log.target_user_id ?? "--"} />
                <LogInfo label="Reference" value={log.reference_id ?? "--"} />
                <LogInfo label="Time" value={formatDateTime(log.created_at)} />
                <div className="sm:col-span-2">
                  <LogInfo label="Note" value={log.note || "--"} />
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-2xl border border-white/10 bg-[#0a0e1a]/40 px-4 py-10 text-center text-sm text-slate-400">
            No audit logs found.
          </div>
        )}
      </section>

      <section className="hidden rounded-[24px] border border-white/10 bg-[#0a0e1a] p-4 shadow-xl xl:block sm:p-5">
        <div className="overflow-hidden rounded-2xl border border-white/10">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-white/10">
              <thead className="bg-[#050812]/80">
                <tr>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                    ID
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Admin ID
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Action
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Target User
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Reference
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Note
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Time
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-white/10 bg-[#0a0e1a]/50">
                {paginatedLogs.length ? (
                  paginatedLogs.map((log) => (
                    <tr key={log.id} className="transition hover:bg-white/[0.03]">
                      <td className="px-4 py-2.5 text-sm text-slate-200">
                        {log.id}
                       </td>
                      <td className="px-4 py-2.5 text-sm text-slate-200">
                        {log.admin_id ?? "--"}
                       </td>
                      <td className="px-4 py-2.5 text-sm text-white">
                        <span className="rounded-full border border-white/10 bg-[#050812]/80 px-2.5 py-1 text-xs font-semibold text-slate-200">
                          {log.action || "--"}
                        </span>
                       </td>
                      <td className="px-4 py-2.5 text-sm text-slate-200">
                        {log.target_user_id ?? "--"}
                       </td>
                      <td className="px-4 py-2.5 text-sm text-slate-200">
                        {log.reference_id ?? "--"}
                       </td>
                      <td className="px-4 py-2.5 text-sm text-slate-300">
                        {log.note || "--"}
                       </td>
                      <td className="px-4 py-2.5 text-sm text-slate-400">
                        {formatDateTime(log.created_at)}
                       </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan="7"
                      className="px-4 py-8 text-center text-sm text-slate-400"
                    >
                      No audit logs found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-slate-400">
            Page {page} of {totalPages}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              className="rounded-xl border border-white/10 px-4 py-2 text-xs font-semibold text-white transition hover:bg-white/5 disabled:opacity-40"
            >
              Previous
            </button>

            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
              className="rounded-xl border border-white/10 px-4 py-2 text-xs font-semibold text-white transition hover:bg-white/5 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </section>

      <div className="xl:hidden">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-slate-400">
            Page {page} of {totalPages}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              className="rounded-xl border border-white/10 px-4 py-2 text-xs font-semibold text-white transition hover:bg-white/5 disabled:opacity-40"
            >
              Previous
            </button>

            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
              className="rounded-xl border border-white/10 px-4 py-2 text-xs font-semibold text-white transition hover:bg-white/5 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
