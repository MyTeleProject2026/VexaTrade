import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { adminApi, getApiErrorMessage } from "../../services/api";
import useToast from "../../components/ToastNotification";

function formatMoney(value) {
  const num = Number(value || 0);
  if (!Number.isFinite(num)) return "0.00";
  return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDateTime(value) {
  if (!value) return "--";
  const date = new Date(value);
  if (isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function getStatusClass(status) {
  const value = String(status || "").toLowerCase();
  if (value === "pending") return "bg-amber-500/10 text-amber-300 border border-amber-500/20";
  if (value === "approved") return "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20";
  if (value === "rejected") return "bg-rose-500/10 text-rose-300 border border-rose-500/20";
  return "bg-slate-500/10 text-slate-300";
}

export default function AdminProfitWithdrawalRequestsPage() {
  const token = localStorage.getItem("adminToken") || localStorage.getItem("admin_token") || "";
  const { addToast, ToastContainer } = useToast();
  
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionId, setActionId] = useState(null);
  
  async function loadRequests() {
    try {
      setRefreshing(true);
      const res = await adminApi.getProfitWithdrawalRequests(token);
      setRequests(Array.isArray(res.data?.data) ? res.data.data : []);
    } catch (err) {
      addToast(getApiErrorMessage(err), "error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }
  
  async function handleApprove(id) {
    const confirmed = window.confirm("Approve this profit withdrawal request?");
    if (!confirmed) return;
    
    try {
      setActionId(id);
      await adminApi.approveProfitWithdrawal(id, token);
      addToast("Withdrawal approved successfully", "success");
      await loadRequests();
    } catch (err) {
      addToast(getApiErrorMessage(err), "error");
    } finally {
      setActionId(null);
    }
  }
  
  async function handleReject(id) {
    const confirmed = window.confirm("Reject this profit withdrawal request?");
    if (!confirmed) return;
    
    try {
      setActionId(id);
      await adminApi.rejectProfitWithdrawal(id, token);
      addToast("Withdrawal rejected", "info");
      await loadRequests();
    } catch (err) {
      addToast(getApiErrorMessage(err), "error");
    } finally {
      setActionId(null);
    }
  }
  
  useEffect(() => {
    loadRequests();
    const interval = setInterval(loadRequests, 10000);
    return () => clearInterval(interval);
  }, []);
  
  const pendingRequests = requests.filter(r => r.status === "pending");
  const approvedRequests = requests.filter(r => r.status === "approved");
  const rejectedRequests = requests.filter(r => r.status === "rejected");
  
  if (loading) {
    return <div className="rounded-2xl border border-white/10 bg-[#0a0e1a] p-5">Loading requests...</div>;
  }
  
  return (
    <div className="space-y-5">
      <ToastContainer />
      
      <section className="rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(163,230,53,0.10),transparent_18%)] p-5">
        <div>
          <p className="text-[10px] uppercase tracking-[0.32em] text-lime-300">Profit Withdrawals</p>
          <h1 className="mt-2 text-2xl font-bold text-white">Profit Withdrawal Requests</h1>
          <p className="mt-2 text-sm text-slate-400">Users requesting to withdraw from their profits before target is achieved.</p>
        </div>
      </section>
      
      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-white/10 bg-[#0a0e1a] p-4 text-center">
          <div className="text-2xl font-bold text-amber-300">{pendingRequests.length}</div>
          <div className="text-xs text-slate-400">Pending</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-[#0a0e1a] p-4 text-center">
          <div className="text-2xl font-bold text-emerald-300">{approvedRequests.length}</div>
          <div className="text-xs text-slate-400">Approved</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-[#0a0e1a] p-4 text-center">
          <div className="text-2xl font-bold text-rose-300">{rejectedRequests.length}</div>
          <div className="text-xs text-slate-400">Rejected</div>
        </div>
      </div>
      
      <div className="flex justify-end">
        <button onClick={loadRequests} className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-xs text-white">
          <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>
      
      <div className="space-y-3">
        {pendingRequests.length === 0 && approvedRequests.length === 0 && rejectedRequests.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-[#0a0e1a] p-8 text-center text-slate-400">
            No withdrawal requests found.
          </div>
        ) : (
          <>
            {pendingRequests.map((req) => (
              <div key={req.id} className="rounded-2xl border border-white/10 bg-[#0a0e1a] p-4">
                <div className="flex flex-wrap justify-between items-start gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-semibold text-white">#{req.id}</span>
                      <span className={`rounded-full px-2 py-1 text-xs ${getStatusClass(req.status)}`}>
                        {req.status}
                      </span>
                    </div>
                    <div className="mt-2 text-sm text-slate-400">
                      User: <span className="text-white">{req.name || req.email}</span> (UID: {req.uid})
                    </div>
                    <div className="text-sm text-slate-400">User ID: #{req.user_id}</div>
                    <div className="mt-2 text-2xl font-bold text-cyan-300">{formatMoney(req.amount)} USDT</div>
                    <div className="text-xs text-slate-500">Current Profit: {formatMoney(req.current_profit || 0)} USDT</div>
                    <div className="text-xs text-slate-500">Requested: {formatDateTime(req.created_at)}</div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleApprove(req.id)}
                      disabled={actionId === req.id}
                      className="rounded-xl bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-50"
                    >
                      {actionId === req.id ? "Processing..." : "Approve"}
                    </button>
                    <button
                      onClick={() => handleReject(req.id)}
                      disabled={actionId === req.id}
                      className="rounded-xl bg-rose-500/10 px-4 py-2 text-sm font-semibold text-rose-300 hover:bg-rose-500/20 disabled:opacity-50"
                    >
                      {actionId === req.id ? "Processing..." : "Reject"}
                    </button>
                  </div>
                </div>
              </div>
            ))}
            
            {approvedRequests.length > 0 && (
              <div className="mt-5">
                <h3 className="text-sm font-semibold text-white mb-3">Approved Requests</h3>
                {approvedRequests.slice(0, 5).map((req) => (
                  <div key={req.id} className="rounded-xl border border-white/10 bg-[#0a0e1a]/50 p-3 mb-2">
                    <div className="flex justify-between">
                      <span className="text-white">#{req.id}</span>
                      <span className="text-emerald-300">{formatMoney(req.amount)} USDT</span>
                    </div>
                    <div className="text-xs text-slate-500">{req.name || req.email}</div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
