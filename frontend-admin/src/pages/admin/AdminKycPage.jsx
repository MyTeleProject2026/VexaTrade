import { useEffect, useMemo, useState } from "react";
import { RefreshCw, ShieldCheck, CheckCircle2, XCircle, Clock3 } from "lucide-react";
import { adminApi, getApiErrorMessage } from "../../services/api";
// ✅ ADDED: Import toast notification hook
import useToast from "../components/ToastNotification";

function StatusBadge({ status }) {
  const value = String(status || "").toLowerCase();

  const styles =
    value === "approved"
      ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
      : value === "rejected"
      ? "border-red-500/20 bg-red-500/10 text-red-300"
      : "border-amber-500/20 bg-amber-500/10 text-amber-300";

  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${styles}`}>
      {status || "pending"}
    </span>
  );
}

function StatCard({ title, value, color, icon: Icon }) {
  return (
    <div className="rounded-[24px] border border-white/10 bg-[#0a0e1a] p-4 shadow-xl">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
          {title}
        </div>
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.04] text-slate-300">
          <Icon size={15} />
        </div>
      </div>
      <div className={`mt-3 text-2xl font-bold sm:text-3xl ${color}`}>{value}</div>
    </div>
  );
}

function buildImageUrl(path) {
  if (!path) return "";
  const base =
    import.meta.env.VITE_API_BASE_URL || "https://VexaTrade-4rhe.onrender.com";
  return `${base}${path}`;
}

export default function AdminKycPage() {
  const token =
    localStorage.getItem("adminToken") ||
    localStorage.getItem("admin_token") ||
    "";

  // ✅ ADDED: Toast notification hook
  const { toasts, addToast, removeToast, ToastContainer } = useToast();

  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(null);
  const [adminNote, setAdminNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    loadKyc();
  }, []);

  async function loadKyc(silent = false) {
    try {
      if (!silent) setLoading(true);
      else setRefreshing(true);

      setError("");

      const res = await adminApi.getKycSubmissions(token);
      const rows = res.data?.data || [];

      setItems(rows);

      if (rows.length > 0) {
        setSelected((prev) => {
          if (!prev) return rows[0];
          const matched = rows.find((item) => item.id === prev.id);
          return matched || rows[0];
        });

        setAdminNote((prev) => {
          if (prev && selected?.id) return prev;
          return rows[0]?.admin_note || "";
        });
      } else {
        setSelected(null);
        setAdminNote("");
      }
      
      // ✅ ADDED: Success toast for silent refresh
      if (silent) {
        addToast("KYC submissions refreshed successfully", "success");
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

  function handleSelect(item) {
    setSelected(item);
    setAdminNote(item?.admin_note || "");
  }

  async function handleApprove() {
    if (!selected) return;

    try {
      setActionLoading("approve");
      setError("");

      await adminApi.approveKyc(
        selected.id,
        { admin_note: adminNote },
        token
      );

      const successMsg = `KYC submission #${selected.id} approved successfully`;
      // ✅ ADDED: Success toast
      addToast(successMsg, "success");
      await loadKyc(true);
    } catch (err) {
      const errorMsg = getApiErrorMessage(err);
      setError(errorMsg);
      // ✅ ADDED: Error toast
      addToast(errorMsg, "error");
    } finally {
      setActionLoading("");
    }
  }

  async function handleReject() {
    if (!selected) return;

    try {
      setActionLoading("reject");
      setError("");

      await adminApi.rejectKyc(
        selected.id,
        { admin_note: adminNote },
        token
      );

      const successMsg = `KYC submission #${selected.id} rejected`;
      // ✅ ADDED: Success toast
      addToast(successMsg, "success");
      await loadKyc(true);
    } catch (err) {
      const errorMsg = getApiErrorMessage(err);
      setError(errorMsg);
      // ✅ ADDED: Error toast
      addToast(errorMsg, "error");
    } finally {
      setActionLoading("");
    }
  }

  const summary = useMemo(() => {
    return {
      total: items.length,
      pending: items.filter(
        (item) => String(item.verification_status || "").toLowerCase() === "pending"
      ).length,
      approved: items.filter(
        (item) => String(item.verification_status || "").toLowerCase() === "approved"
      ).length,
      rejected: items.filter(
        (item) => String(item.verification_status || "").toLowerCase() === "rejected"
      ).length,
    };
  }, [items]);

  if (loading) {
    return (
      <div className="rounded-[24px] border border-white/10 bg-[#0a0e1a] p-5 text-sm text-slate-300">
        Loading KYC submissions...
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* ✅ ADDED: Toast Container */}
      <ToastContainer />

      <section className="rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.10),transparent_18%),linear-gradient(180deg,#111827_0%,#020617_100%)] p-5 shadow-xl">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-[0.32em] text-cyan-300">
              Identity Review
            </div>
            <h1 className="mt-2 text-2xl font-bold text-white sm:text-3xl">
              KYC Verification
            </h1>
            <p className="mt-2 text-sm text-slate-400">
              Review identity records, compare documents, and approve or reject submissions.
            </p>
          </div>

          <button
            type="button"
            onClick={() => loadKyc(true)}
            className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/[0.08]"
          >
            <RefreshCw size={15} className={refreshing ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </section>

      {error ? (
        <div className="rounded-2xl bg-red-500/10 px-4 py-3 text-sm text-red-300 border border-red-500/20">
          {error}
        </div>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Total" value={summary.total} color="text-white" icon={ShieldCheck} />
        <StatCard title="Pending" value={summary.pending} color="text-amber-300" icon={Clock3} />
        <StatCard title="Approved" value={summary.approved} color="text-emerald-300" icon={CheckCircle2} />
        <StatCard title="Rejected" value={summary.rejected} color="text-rose-300" icon={XCircle} />
      </section>

      <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="rounded-[24px] border border-white/10 bg-[#0a0e1a] p-4 shadow-xl sm:p-5">
          <h2 className="text-lg font-semibold text-white">KYC Submission List</h2>
          <p className="mt-2 text-sm text-slate-400">
            Open a submission to review identity details and documents.
          </p>

          <div className="mt-4 space-y-2.5">
            {items.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-[#050812]/60 p-4 text-sm text-slate-400">
                No KYC submissions found.
              </div>
            ) : (
              items.map((item) => {
                const active = selected?.id === item.id;

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelect(item)}
                    className={[
                      "w-full rounded-2xl border p-4 text-left transition",
                      active
                        ? "border-cyan-400/30 bg-cyan-500/10"
                        : "border-white/10 bg-[#050812]/60 hover:bg-white/[0.03]",
                    ].join(" ")}
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <div className="text-sm font-semibold text-white">
                          {item.name ||
                            `${item.first_name || ""} ${item.last_name || ""}`.trim() ||
                            "Unnamed User"}
                        </div>

                        <div className="mt-1 text-[11px] text-slate-400">
                          UID: {item.uid || "-"} · {item.email || "-"}
                        </div>

                        <div className="mt-2 text-sm text-slate-300">
                          {item.document_type || "-"} · {item.residence_country || "-"}
                        </div>
                      </div>

                      <StatusBadge status={item.verification_status} />
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div className="rounded-[24px] border border-white/10 bg-[#0a0e1a] p-4 shadow-xl sm:p-5">
          <h2 className="text-lg font-semibold text-white">Submission Details</h2>

          {!selected ? (
            <div className="mt-4 rounded-2xl border border-white/10 bg-[#050812]/60 p-4 text-sm text-slate-400">
              Select a submission to review details.
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-[#050812]/60 p-4">
                  <div className="text-[11px] text-slate-500">User</div>
                  <div className="mt-1 text-sm text-white">{selected.name || "-"}</div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-[#050812]/60 p-4">
                  <div className="text-[11px] text-slate-500">UID</div>
                  <div className="mt-1 text-sm text-white">{selected.uid || "-"}</div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-[#050812]/60 p-4">
                  <div className="text-[11px] text-slate-500">Email</div>
                  <div className="mt-1 text-sm text-white">{selected.email || "-"}</div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-[#050812]/60 p-4">
                  <div className="text-[11px] text-slate-500">Status</div>
                  <div className="mt-2">
                    <StatusBadge status={selected.verification_status} />
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-[#050812]/60 p-4">
                  <div className="text-[11px] text-slate-500">Residence Country</div>
                  <div className="mt-1 text-sm text-white">{selected.residence_country || "-"}</div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-[#050812]/60 p-4">
                  <div className="text-[11px] text-slate-500">Document Type</div>
                  <div className="mt-1 text-sm text-white">{selected.document_type || "-"}</div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-[#050812]/60 p-4 sm:col-span-2">
                  <div className="text-[11px] text-slate-500">Document Number</div>
                  <div className="mt-1 text-sm text-white">{selected.document_number || "-"}</div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-[#050812]/60 p-4">
                  <div className="mb-3 text-[11px] text-slate-500">Front Document</div>

                  {selected.document_front_url ? (
                    <img
                      src={buildImageUrl(selected.document_front_url)}
                      alt="Front document"
                      className="h-52 w-full rounded-2xl object-cover"
                    />
                  ) : (
                    <div className="rounded-2xl border border-dashed border-white/10 p-6 text-sm text-slate-500">
                      No front image
                    </div>
                  )}
                </div>

                <div className="rounded-2xl border border-white/10 bg-[#050812]/60 p-4">
                  <div className="mb-3 text-[11px] text-slate-500">Back Document</div>

                  {selected.document_back_url ? (
                    <img
                      src={buildImageUrl(selected.document_back_url)}
                      alt="Back document"
                      className="h-52 w-full rounded-2xl object-cover"
                    />
                  ) : (
                    <div className="rounded-2xl border border-dashed border-white/10 p-6 text-sm text-slate-500">
                      No back image
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">
                  Admin Note
                </label>

                <textarea
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                  rows={4}
                  placeholder="Write approval or rejection note..."
                  className="w-full rounded-2xl border border-white/10 bg-[#050812] px-4 py-3 text-sm text-white outline-none"
                />
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={handleApprove}
                  disabled={actionLoading === "approve"}
                  className="flex-1 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-60"
                >
                  {actionLoading === "approve" ? "Approving..." : "Approve KYC"}
                </button>

                <button
                  type="button"
                  onClick={handleReject}
                  disabled={actionLoading === "reject"}
                  className="flex-1 rounded-2xl bg-red-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-red-500 disabled:opacity-60"
                >
                  {actionLoading === "reject" ? "Rejecting..." : "Reject KYC"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
