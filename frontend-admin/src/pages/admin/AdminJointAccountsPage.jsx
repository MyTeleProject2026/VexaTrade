import { useEffect, useState } from "react";
import { RefreshCw, Trash2, Users, Link2, Link2Off } from "lucide-react";
import { adminApi, getApiErrorMessage } from "../../services/api";
// ✅ ADDED: Import toast notification hook
import useToast from "../components/ToastNotification";

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function StatusBadge({ status }) {
  const value = String(status || "").toLowerCase();
  
  if (value === "active") {
    return <span className="rounded-full bg-emerald-500/20 px-2 py-1 text-xs font-semibold text-emerald-300">Active</span>;
  }
  return <span className="rounded-full bg-red-500/20 px-2 py-1 text-xs font-semibold text-red-300">Disconnected</span>;
}

export default function AdminJointAccountsPage() {
  const token = localStorage.getItem("adminToken") || localStorage.getItem("admin_token") || "";
  
  // ✅ ADDED: Toast notification hook
  const { toasts, addToast, removeToast, ToastContainer } = useToast();
  
  const [jointAccounts, setJointAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [actionId, setActionId] = useState(null);
  
  useEffect(() => {
    loadJointAccounts();
  }, []);
  
  async function loadJointAccounts() {
    try {
      setLoading(true);
      setError("");
      const res = await adminApi.getJointAccounts(token);
      setJointAccounts(Array.isArray(res.data?.data) ? res.data.data : []);
      
      // ✅ ADDED: Success toast for refresh
      if (!loading) {
        addToast("Joint accounts refreshed successfully", "success");
      }
    } catch (err) {
      const errorMsg = getApiErrorMessage(err);
      setError(errorMsg);
      // ✅ ADDED: Error toast
      addToast(errorMsg, "error");
    } finally {
      setLoading(false);
    }
  }
  
  async function handleDisconnect(id) {
    const confirmed = window.confirm("Are you sure you want to disconnect this joint account? Both users will be notified.");
    if (!confirmed) return;
    
    try {
      setActionId(id);
      setError("");
      setSuccess("");
      
      await adminApi.disconnectJointAccount(id, token);
      const successMsg = "Joint account disconnected successfully";
      setSuccess(successMsg);
      // ✅ ADDED: Success toast
      addToast(successMsg, "success");
      await loadJointAccounts();
    } catch (err) {
      const errorMsg = getApiErrorMessage(err);
      setError(errorMsg);
      // ✅ ADDED: Error toast
      addToast(errorMsg, "error");
    } finally {
      setActionId(null);
    }
  }
  
  if (loading) {
    return (
      <div className="rounded-[24px] border border-white/10 bg-[#0a0e1a] p-5 text-sm text-slate-300">
        Loading joint accounts...
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
              Joint Accounts
            </p>
            <h1 className="mt-2 text-2xl font-bold text-white sm:text-3xl">
              Joint Account Management
            </h1>
            <p className="mt-2 text-sm text-slate-400">
              View and manage all joint account connections between users.
            </p>
          </div>
          
          <button
            onClick={loadJointAccounts}
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/[0.08]"
          >
            <RefreshCw size={15} className={refreshing ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </section>
      
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
      
      <div className="rounded-[24px] border border-white/10 bg-[#0a0e1a] shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="border-b border-white/10 bg-[#050812]/40 text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-5 py-4">Account ID</th>
                <th className="px-5 py-4">User 1</th>
                <th className="px-5 py-4">User 2</th>
                <th className="px-5 py-4">Approved On</th>
                <th className="px-5 py-4">Status</th>
                <th className="px-5 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {jointAccounts.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-5 py-10 text-center text-slate-500">
                    No joint accounts found.
                  </td>
                </tr>
              ) : (
                jointAccounts.map((account) => (
                  <tr key={account.id} className="border-b border-white/5 text-sm text-slate-300">
                    <td className="px-5 py-4 font-mono text-xs">{account.account_id}</td>
                    <td className="px-5 py-4">
                      <div className="font-semibold text-white">{account.user1_name || account.user1_uid}</div>
                      <div className="text-xs text-slate-500">{account.user1_email}</div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="font-semibold text-white">{account.user2_name || account.user2_uid}</div>
                      <div className="text-xs text-slate-500">{account.user2_email}</div>
                    </td>
                    <td className="px-5 py-4 text-slate-400">{formatDate(account.approved_at)}</td>
                    <td className="px-5 py-4"><StatusBadge status={account.status} /></td>
                    <td className="px-5 py-4 text-right">
                      {account.status === "active" && (
                        <button
                          onClick={() => handleDisconnect(account.id)}
                          disabled={actionId === account.id}
                          className="inline-flex items-center gap-1 rounded-xl bg-red-500/10 px-3 py-1.5 text-sm font-semibold text-red-300 transition hover:bg-red-500/20 disabled:opacity-50"
                        >
                          <Link2Off size={14} />
                          Disconnect
                        </button>
                      )}
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
