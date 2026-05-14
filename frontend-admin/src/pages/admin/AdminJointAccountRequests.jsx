import { useEffect, useState } from "react";
import { RefreshCw, CheckCircle, XCircle, Users } from "lucide-react";
import { adminApi, getApiErrorMessage } from "../../services/api";
// ✅ ADDED: Import toast notification hook
import useToast from "../components/ToastNotification";

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export default function AdminJointAccountRequests() {
  const token = localStorage.getItem("adminToken") || localStorage.getItem("admin_token") || "";

  // ✅ ADDED: Toast notification hook
  const { toasts, addToast, removeToast, ToastContainer } = useToast();

  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [processingId, setProcessingId] = useState(null);

  async function loadRequests() {
    try {
      setRefreshing(true);
      setError("");
      const res = await adminApi.getJointAccountRequests(token);
      setRequests(Array.isArray(res.data?.data) ? res.data.data : []);
      
      // ✅ ADDED: Success toast for refresh
      addToast("Joint account requests refreshed successfully", "success");
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

  useEffect(() => {
    loadRequests();
  }, []);

  async function handleApprove(id) {
    try {
      setProcessingId(id);
      setError("");
      await adminApi.approveJointAccountRequest(id, {}, token);
      const successMsg = "Joint account approved successfully!";
      setSuccess(successMsg);
      // ✅ ADDED: Success toast
      addToast(successMsg, "success");
      await loadRequests();
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      const errorMsg = getApiErrorMessage(err);
      setError(errorMsg);
      // ✅ ADDED: Error toast
      addToast(errorMsg, "error");
    } finally {
      setProcessingId(null);
    }
  }

  async function handleReject(id) {
    try {
      setProcessingId(id);
      setError("");
      await adminApi.rejectJointAccountRequest(id, {}, token);
      const successMsg = "Joint account request rejected.";
      setSuccess(successMsg);
      // ✅ ADDED: Success toast
      addToast(successMsg, "success");
      await loadRequests();
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      const errorMsg = getApiErrorMessage(err);
      setError(errorMsg);
      // ✅ ADDED: Error toast
      addToast(errorMsg, "error");
    } finally {
      setProcessingId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ✅ ADDED: Toast Container */}
      <ToastContainer />

      <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900/80 to-slate-950/80 p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-xs uppercase tracking-wider text-indigo-400">Admin Control</div>
            <h1 className="mt-2 text-3xl font-bold text-white">Joint Account Requests</h1>
            <p className="mt-2 text-sm text-slate-400">
              Review and manage user requests to create joint accounts.
            </p>
          </div>
          <button
            onClick={loadRequests}
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
          >
            <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
          {success}
        </div>
      )}

      <div className="rounded-3xl border border-white/10 bg-[#0a0e1a] shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="border-b border-white/10 bg-[#050812]/40 text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-5 py-4">Requester</th>
                <th className="px-5 py-4">Partner</th>
                <th className="px-5 py-4">KYC Number</th>
                <th className="px-5 py-4">Requested On</th>
                <th className="px-5 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {requests.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-5 py-10 text-center text-slate-500">
                    No pending joint account requests.
                  </td>
                </tr>
              ) : (
                requests.map((req) => (
                  <tr key={req.id} className="border-b border-white/5 text-sm text-slate-300">
                    <td className="px-5 py-4">
                      <div className="font-semibold text-white">{req.requester_email}</div>
                      <div className="text-xs text-slate-500">UID: {req.requester_uid}</div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="font-semibold text-white">{req.partner_email}</div>
                      <div className="text-xs text-slate-500">UID: {req.partner_uid}</div>
                    </td>
                    <td className="px-5 py-4">
                      {req.partner_kyc_number || <span className="text-slate-500">Not provided</span>}
                    </td>
                    <td className="px-5 py-4 text-slate-400">{formatDate(req.created_at)}</td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleApprove(req.id)}
                          disabled={processingId === req.id}
                          className="inline-flex items-center gap-1 rounded-xl bg-emerald-500/20 px-3 py-1.5 text-sm font-semibold text-emerald-300 transition hover:bg-emerald-500/30 disabled:opacity-50"
                        >
                          <CheckCircle size={14} />
                          Approve
                        </button>
                        <button
                          onClick={() => handleReject(req.id)}
                          disabled={processingId === req.id}
                          className="inline-flex items-center gap-1 rounded-xl bg-red-500/20 px-3 py-1.5 text-sm font-semibold text-red-300 transition hover:bg-red-500/30 disabled:opacity-50"
                        >
                          <XCircle size={14} />
                          Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
