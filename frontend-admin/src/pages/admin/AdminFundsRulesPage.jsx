import { useEffect, useMemo, useState } from "react";
import { RefreshCw, Lock, Users, UserPlus, UserMinus } from "lucide-react";
import { adminApi, getApiErrorMessage } from "../../services/api";
import useToast from "../../components/ToastNotification";

function StatCard({ title, value, tone = "text-white" }) {
  return (
    <div className="rounded-[24px] border border-white/10 bg-[#111111] p-4 shadow-xl">
      <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">{title}</div>
      <div className={`mt-3 text-2xl font-semibold sm:text-3xl ${tone}`}>{value}</div>
    </div>
  );
}

function DetailRow({ label, value, valueClassName = "text-white" }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-slate-500">{label}</span>
      <span className={`text-right text-sm ${valueClassName}`}>{value}</span>
    </div>
  );
}

// User Assignment Modal Component
function UserAssignmentModal({ isOpen, onClose, plan, onAssign, onRemove, assignedUsers, addToast }) {
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(false);

  if (!isOpen || !plan) return null;

  const handleAssign = async () => {
    if (!userId) {
      addToast("Please enter a User ID", "error");
      return;
    }
    setLoading(true);
    await onAssign(plan.id, userId);
    setUserId("");
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#111111] p-5 shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <Users size={18} className="text-cyan-400" />
            <h2 className="text-lg font-bold text-white">Assign Users to Plan</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">✕</button>
        </div>

        <div className="pt-4">
          <p className="text-sm text-slate-300 mb-3">Plan: <span className="font-semibold text-white">{plan.name}</span></p>
          
          <div className="mb-4">
            <label className="mb-2 block text-sm text-slate-300">Assigned Users</label>
            <div className="max-h-40 overflow-y-auto space-y-2 rounded-xl border border-white/10 bg-black/40 p-3">
              {assignedUsers.length === 0 ? (
                <p className="text-xs text-slate-500 text-center">No users assigned yet</p>
              ) : (
                assignedUsers.map((user) => (
                  <div key={user.id} className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-slate-800/50 p-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-white truncate">{user.name || user.email}</div>
                      <div className="text-xs text-slate-400">UID: {user.uid} | ID: {user.user_id}</div>
                    </div>
                    <button
                      onClick={() => onRemove(plan.id, user.user_id)}
                      className="rounded-lg bg-red-500/10 px-2 py-1 text-xs font-semibold text-red-300"
                    >
                      <UserMinus size={14} className="inline mr-1" /> Remove
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm text-slate-300">Add User by ID</label>
            <div className="flex gap-2">
              <input
                type="number"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder="Enter User ID"
                className="flex-1 rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400"
              />
              <button
                onClick={handleAssign}
                disabled={loading}
                className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-black hover:bg-cyan-400"
              >
                <UserPlus size={16} className="inline mr-1" /> Add
              </button>
            </div>
          </div>
        </div>

        <div className="mt-5 flex justify-end">
          <button onClick={onClose} className="rounded-lg border border-white/10 px-4 py-2 text-sm text-white">Close</button>
        </div>
      </div>
    </div>
  );
}

const EMPTY_FORM = {
  name: "",
  duration_days: 2,
  min_amount: 0,
  max_amount: "",
  min_daily_profit_percent: 0,
  max_daily_profit_percent: 0,
  user_limit_count: "",
  status: "active",
  admin_note: "",
  admin_note_background_image: "",
  additional_notes: "",
  disclaimer: "",
  is_private: 0,
  compound_percentage: 100,
};

export default function AdminFundsRulesPage() {
  const token = localStorage.getItem("adminToken") || localStorage.getItem("admin_token") || "";
  const { addToast, ToastContainer } = useToast();

  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [createForm, setCreateForm] = useState(EMPTY_FORM);
  const [showUserModal, setShowUserModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [assignedUsers, setAssignedUsers] = useState([]);

  useEffect(() => {
    loadRules(true);
  }, [token]);

  async function loadRules(isInitial = false) {
    try {
      if (isInitial) setLoading(true);
      else setRefreshing(true);
      setError("");
      const res = await adminApi.getFundRules(token);
      setRules(Array.isArray(res.data?.data) ? res.data.data : []);
      if (!isInitial) addToast("Fund rules refreshed successfully", "success");
    } catch (err) {
      const errorMsg = getApiErrorMessage(err);
      setError(errorMsg);
      addToast(errorMsg, "error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function loadAssignedUsers(planId) {
    try {
      const res = await adminApi.getAssignedUsers(planId, token);
      setAssignedUsers(Array.isArray(res.data?.data) ? res.data.data : []);
    } catch (err) {
      setAssignedUsers([]);
    }
  }

  async function openUserModal(rule) {
    setSelectedPlan(rule);
    await loadAssignedUsers(rule.id);
    setShowUserModal(true);
  }

  async function assignUserToPlan(planId, userId) {
    try {
      await adminApi.assignUserToPrivatePlan(planId, { userId }, token);
      addToast("User assigned successfully", "success");
      await loadAssignedUsers(planId);
      await loadRules(false);
    } catch (err) {
      addToast(getApiErrorMessage(err), "error");
    }
  }

  async function removeUserFromPlan(planId, userId) {
    try {
      await adminApi.removeUserFromPrivatePlan(planId, userId, token);
      addToast("User removed successfully", "success");
      await loadAssignedUsers(planId);
      await loadRules(false);
    } catch (err) {
      addToast(getApiErrorMessage(err), "error");
    }
  }

  function handleChange(id, field, value) {
    setRules((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  }

  function handleCreateChange(field, value) {
    setCreateForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSave(rule) {
    try {
      setSavingId(rule.id);
      setError("");
      setSuccess("");
      await adminApi.updateFundRule(rule.id, {
        name: rule.name,
        duration_days: Number(rule.duration_days),
        min_amount: Number(rule.min_amount || 0),
        max_amount: rule.max_amount === "" || rule.max_amount === null ? null : Number(rule.max_amount),
        min_daily_profit_percent: Number(rule.min_daily_profit_percent || 0),
        max_daily_profit_percent: Number(rule.max_daily_profit_percent || 0),
        user_limit_count: rule.user_limit_count === "" || rule.user_limit_count === null ? null : Number(rule.user_limit_count),
        status: rule.status,
        admin_note: rule.admin_note || null,
        admin_note_background_image: rule.admin_note_background_image || null,
        additional_notes: rule.additional_notes || null,
        disclaimer: rule.disclaimer || null,
        is_private: rule.is_private || 0,
        compound_percentage: rule.compound_percentage || 100,
      }, token);
      addToast(`${rule.name} updated successfully.`, "success");
      await loadRules(false);
    } catch (err) {
      addToast(getApiErrorMessage(err), "error");
    } finally {
      setSavingId(null);
    }
  }

  async function handleCreateRule() {
    if (!createForm.name || !createForm.name.trim()) {
      addToast("Rule name is required", "error");
      return;
    }
    if (!createForm.duration_days || createForm.duration_days <= 0) {
      addToast("Duration days must be greater than 0", "error");
      return;
    }
    try {
      setCreating(true);
      await adminApi.createFundRule({
        name: createForm.name,
        duration_days: Number(createForm.duration_days),
        min_amount: Number(createForm.min_amount || 0),
        max_amount: createForm.max_amount === "" ? null : Number(createForm.max_amount),
        min_daily_profit_percent: Number(createForm.min_daily_profit_percent || 0),
        max_daily_profit_percent: Number(createForm.max_daily_profit_percent || 0),
        user_limit_count: createForm.user_limit_count === "" ? null : Number(createForm.user_limit_count),
        status: createForm.status,
        admin_note: createForm.admin_note || null,
        admin_note_background_image: createForm.admin_note_background_image || null,
        additional_notes: createForm.additional_notes || null,
        disclaimer: createForm.disclaimer || null,
        is_private: createForm.is_private || 0,
        compound_percentage: createForm.compound_percentage || 100,
      }, token);
      addToast("Fund rule created successfully.", "success");
      setCreateForm(EMPTY_FORM);
      await loadRules(false);
    } catch (err) {
      addToast(getApiErrorMessage(err), "error");
    } finally {
      setCreating(false);
    }
  }

  async function handleDeleteRule(id) {
    if (!window.confirm(`Delete fund rule #${id}?`)) return;
    try {
      setSavingId(id);
      await adminApi.deleteFundRule(id, token);
      addToast(`Fund rule #${id} deleted successfully.`, "success");
      await loadRules(false);
    } catch (err) {
      addToast(getApiErrorMessage(err), "error");
    } finally {
      setSavingId(null);
    }
  }

  const summary = useMemo(() => ({
    total: rules.length,
    active: rules.filter((item) => String(item.status || "").toLowerCase() === "active").length,
    inactive: rules.filter((item) => String(item.status || "").toLowerCase() === "inactive").length,
    highestMaxRate: rules.length > 0 ? Math.max(...rules.map((item) => Number(item.max_daily_profit_percent || 0))) : 0,
  }), [rules]);

  if (loading) {
    return <div className="rounded-[24px] border border-white/10 bg-[#111111] p-5 text-sm text-slate-300">Loading fund rules...</div>;
  }

  return (
    <div className="space-y-5">
      <ToastContainer />
      <UserAssignmentModal
        isOpen={showUserModal}
        onClose={() => { setShowUserModal(false); setSelectedPlan(null); setAssignedUsers([]); }}
        plan={selectedPlan}
        onAssign={assignUserToPlan}
        onRemove={removeUserFromPlan}
        assignedUsers={assignedUsers}
        addToast={addToast}
      />

      <section className="rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(163,230,53,0.10),transparent_18%),linear-gradient(180deg,#081223_0%,#020617_100%)] p-5 shadow-xl">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.32em] text-cyan-300">Funds Rules</p>
            <h1 className="mt-2 text-2xl font-bold text-white sm:text-3xl">Funds Rules</h1>
            <p className="mt-2 text-sm text-slate-400">Adjust duration, limits, daily profit ranges, status, notes, private plans, and compound settings.</p>
          </div>
          <button onClick={() => loadRules(false)} className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-xs font-semibold text-white hover:bg-white/5">
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} /> Refresh
          </button>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Total Rules" value={summary.total} />
        <StatCard title="Active" value={summary.active} tone="text-emerald-300" />
        <StatCard title="Inactive" value={summary.inactive} tone="text-amber-300" />
        <StatCard title="Highest Max Rate" value={`${summary.highestMaxRate}%`} tone="text-cyan-300" />
      </section>

      {error && <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300">{error}</div>}
      {success && <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm text-emerald-300">{success}</div>}

      {/* Create Form */}
      <section className="rounded-[24px] border border-white/10 bg-[#111111] p-4 shadow-xl">
        <h2 className="text-lg font-semibold text-white">Create Fund Rule</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <input type="text" value={createForm.name} onChange={(e) => handleCreateChange("name", e.target.value)} placeholder="Rule name" className="rounded-xl border border-white/10 bg-[#0a0e1a] px-3 py-2.5 text-sm text-white outline-none" />
          <input type="number" value={createForm.duration_days} onChange={(e) => handleCreateChange("duration_days", e.target.value)} placeholder="Duration days" className="rounded-xl border border-white/10 bg-[#0a0e1a] px-3 py-2.5 text-sm text-white outline-none" />
          <input type="number" value={createForm.min_amount} onChange={(e) => handleCreateChange("min_amount", e.target.value)} placeholder="Min amount" className="rounded-xl border border-white/10 bg-[#0a0e1a] px-3 py-2.5 text-sm text-white outline-none" />
          <input type="number" value={createForm.max_amount} onChange={(e) => handleCreateChange("max_amount", e.target.value)} placeholder="Max amount" className="rounded-xl border border-white/10 bg-[#0a0e1a] px-3 py-2.5 text-sm text-white outline-none" />
          <input type="number" value={createForm.min_daily_profit_percent} onChange={(e) => handleCreateChange("min_daily_profit_percent", e.target.value)} placeholder="Min daily %" className="rounded-xl border border-white/10 bg-[#0a0e1a] px-3 py-2.5 text-sm text-white outline-none" />
          <input type="number" value={createForm.max_daily_profit_percent} onChange={(e) => handleCreateChange("max_daily_profit_percent", e.target.value)} placeholder="Max daily %" className="rounded-xl border border-white/10 bg-[#0a0e1a] px-3 py-2.5 text-sm text-white outline-none" />
          <input type="number" value={createForm.user_limit_count} onChange={(e) => handleCreateChange("user_limit_count", e.target.value)} placeholder="User limit count" className="rounded-xl border border-white/10 bg-[#0a0e1a] px-3 py-2.5 text-sm text-white outline-none" />
          <select value={createForm.status} onChange={(e) => handleCreateChange("status", e.target.value)} className="rounded-xl border border-white/10 bg-[#0a0e1a] px-3 py-2.5 text-sm text-white outline-none">
            <option value="active">active</option><option value="inactive">inactive</option>
          </select>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <textarea value={createForm.admin_note} onChange={(e) => handleCreateChange("admin_note", e.target.value)} placeholder="Admin Note" rows="3" className="rounded-xl border border-white/10 bg-[#0a0e1a] px-3 py-2 text-sm text-white outline-none" />
          <input type="text" value={createForm.admin_note_background_image} onChange={(e) => handleCreateChange("admin_note_background_image", e.target.value)} placeholder="Background Image URL" className="rounded-xl border border-white/10 bg-[#0a0e1a] px-3 py-2 text-sm text-white outline-none" />
          <textarea value={createForm.additional_notes} onChange={(e) => handleCreateChange("additional_notes", e.target.value)} placeholder="Additional Information" rows="2" className="rounded-xl border border-white/10 bg-[#0a0e1a] px-3 py-2 text-sm text-white outline-none" />
          <textarea value={createForm.disclaimer} onChange={(e) => handleCreateChange("disclaimer", e.target.value)} placeholder="Disclaimer / Risk Warning" rows="2" className="rounded-xl border border-white/10 bg-[#0a0e1a] px-3 py-2 text-sm text-white outline-none" />
          <label className="flex items-center gap-2"><input type="checkbox" checked={createForm.is_private === 1} onChange={(e) => handleCreateChange("is_private", e.target.checked ? 1 : 0)} className="rounded border-white/10 bg-[#0a0e1a]" /><span className="text-sm text-slate-300">Private Plan</span></label>
          <div><label className="mb-1 block text-sm text-slate-300">Compound Percentage (%)</label><input type="number" min="0" max="100" step="1" value={createForm.compound_percentage} onChange={(e) => handleCreateChange("compound_percentage", e.target.value)} className="w-full rounded-xl border border-white/10 bg-[#0a0e1a] px-3 py-2 text-sm text-white outline-none" /></div>
        </div>
        <button onClick={handleCreateRule} disabled={creating} className="mt-4 rounded-xl bg-cyan-500 px-4 py-2.5 text-sm font-semibold text-black hover:bg-cyan-400 disabled:opacity-50">{creating ? "Creating..." : "Create Rule"}</button>
      </section>

      {/* Rules List */}
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {rules.map((rule) => (
          <div key={rule.id} className="rounded-[24px] border border-white/10 bg-[#111111] p-4 shadow-xl">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                {rule.is_private === 1 && <Lock size={14} className="text-amber-400" />}
                <h2 className="text-lg font-semibold text-white">{rule.name}</h2>
              </div>
              <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${String(rule.status || "").toLowerCase() === "active" ? "bg-emerald-500/10 text-emerald-300" : "bg-amber-500/10 text-amber-300"}`}>{rule.status}</span>
            </div>

            <div className="mt-4 space-y-3">
              <div><label className="mb-2 block text-sm text-slate-300">Name</label><input type="text" value={rule.name || ""} onChange={(e) => handleChange(rule.id, "name", e.target.value)} className="w-full rounded-xl border border-white/10 bg-[#0a0e1a] px-3 py-2 text-sm text-white outline-none" /></div>
              <div><label className="mb-2 block text-sm text-slate-300">Duration Days</label><input type="number" value={rule.duration_days || ""} onChange={(e) => handleChange(rule.id, "duration_days", e.target.value)} className="w-full rounded-xl border border-white/10 bg-[#0a0e1a] px-3 py-2 text-sm text-white outline-none" /></div>
              <div><label className="mb-2 block text-sm text-slate-300">Min Amount</label><input type="number" value={rule.min_amount || ""} onChange={(e) => handleChange(rule.id, "min_amount", e.target.value)} className="w-full rounded-xl border border-white/10 bg-[#0a0e1a] px-3 py-2 text-sm text-white outline-none" /></div>
              <div><label className="mb-2 block text-sm text-slate-300">Max Amount</label><input type="number" value={rule.max_amount ?? ""} onChange={(e) => handleChange(rule.id, "max_amount", e.target.value)} className="w-full rounded-xl border border-white/10 bg-[#0a0e1a] px-3 py-2 text-sm text-white outline-none" /></div>
              <div className="grid gap-3 md:grid-cols-2"><div><label className="mb-2 block text-sm text-slate-300">Min Daily %</label><input type="number" value={rule.min_daily_profit_percent || ""} onChange={(e) => handleChange(rule.id, "min_daily_profit_percent", e.target.value)} className="w-full rounded-xl border border-white/10 bg-[#0a0e1a] px-3 py-2 text-sm text-white outline-none" /></div><div><label className="mb-2 block text-sm text-slate-300">Max Daily %</label><input type="number" value={rule.max_daily_profit_percent || ""} onChange={(e) => handleChange(rule.id, "max_daily_profit_percent", e.target.value)} className="w-full rounded-xl border border-white/10 bg-[#0a0e1a] px-3 py-2 text-sm text-white outline-none" /></div></div>
              <div><label className="mb-2 block text-sm text-slate-300">Usage Limit</label><input type="number" value={rule.user_limit_count ?? ""} onChange={(e) => handleChange(rule.id, "user_limit_count", e.target.value)} className="w-full rounded-xl border border-white/10 bg-[#0a0e1a] px-3 py-2 text-sm text-white outline-none" /></div>
              <div><label className="mb-2 block text-sm text-slate-300">Status</label><select value={rule.status} onChange={(e) => handleChange(rule.id, "status", e.target.value)} className="w-full rounded-xl border border-white/10 bg-[#0a0e1a] px-3 py-2 text-sm text-white outline-none"><option value="active">active</option><option value="inactive">inactive</option></select></div>
              <div><label className="mb-2 block text-sm text-slate-300">Admin Note</label><textarea value={rule.admin_note || ""} onChange={(e) => handleChange(rule.id, "admin_note", e.target.value)} rows="3" className="w-full rounded-xl border border-white/10 bg-[#0a0e1a] px-3 py-2 text-sm text-white outline-none" /></div>
              <div><label className="mb-2 block text-sm text-slate-300">Note Background Image URL</label><input type="text" value={rule.admin_note_background_image || ""} onChange={(e) => handleChange(rule.id, "admin_note_background_image", e.target.value)} className="w-full rounded-xl border border-white/10 bg-[#0a0e1a] px-3 py-2 text-sm text-white outline-none" /></div>
              <div><label className="mb-2 block text-sm text-slate-300">Additional Notes</label><textarea value={rule.additional_notes || ""} onChange={(e) => handleChange(rule.id, "additional_notes", e.target.value)} rows="2" className="w-full rounded-xl border border-white/10 bg-[#0a0e1a] px-3 py-2 text-sm text-white outline-none" /></div>
              <div><label className="mb-2 block text-sm text-slate-300">Disclaimer</label><textarea value={rule.disclaimer || ""} onChange={(e) => handleChange(rule.id, "disclaimer", e.target.value)} rows="2" className="w-full rounded-xl border border-white/10 bg-[#0a0e1a] px-3 py-2 text-sm text-white outline-none" /></div>
              <label className="flex items-center gap-2"><input type="checkbox" checked={rule.is_private === 1} onChange={(e) => handleChange(rule.id, "is_private", e.target.checked ? 1 : 0)} className="rounded border-white/10 bg-[#0a0e1a]" /><span className="text-sm text-slate-300">Private Plan</span></label>
              <div><label className="mb-2 block text-sm text-slate-300">Compound Percentage (%)</label><input type="number" min="0" max="100" step="1" value={rule.compound_percentage ?? 100} onChange={(e) => handleChange(rule.id, "compound_percentage", e.target.value)} className="w-full rounded-xl border border-white/10 bg-[#0a0e1a] px-3 py-2 text-sm text-white outline-none" /></div>
            </div>

            <div className="mt-4 rounded-2xl border border-white/10 bg-black/40 p-4 text-sm space-y-2">
              <DetailRow label="Duration" value={`${rule.duration_days} days`} />
              <DetailRow label="Daily Profit" value={`${Number(rule.min_daily_profit_percent || 0)}% - ${Number(rule.max_daily_profit_percent || 0)}%`} valueClassName="text-cyan-300" />
              <DetailRow label="Min Amount" value={rule.min_amount || 0} />
              <DetailRow label="Max Amount" value={rule.max_amount == null ? "Unlimited" : rule.max_amount} />
              <DetailRow label="Usage Limit" value={rule.user_limit_count == null ? "No limit" : rule.user_limit_count} />
              {rule.compound_percentage !== undefined && <DetailRow label="Compound %" value={`${rule.compound_percentage}%`} valueClassName="text-cyan-300" />}
              {rule.is_private === 1 && <DetailRow label="Type" value="Private Plan" valueClassName="text-amber-300" />}
            </div>

            {rule.is_private === 1 && (
              <button onClick={() => openUserModal(rule)} className="mt-3 w-full rounded-lg bg-cyan-500/10 py-2 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/20">
                <Users size={14} className="inline mr-1" /> Manage Assigned Users
              </button>
            )}

            <div className="mt-4 grid grid-cols-2 gap-2">
              <button onClick={() => handleSave(rule)} disabled={savingId === rule.id} className="rounded-xl bg-cyan-500 px-4 py-2.5 text-sm font-semibold text-black hover:bg-cyan-400 disabled:opacity-50">{savingId === rule.id ? "Saving..." : "Save Rule"}</button>
              <button onClick={() => handleDeleteRule(rule.id)} disabled={savingId === rule.id} className="rounded-xl bg-rose-500/10 px-4 py-2.5 text-sm font-semibold text-rose-300 hover:bg-rose-500/20 disabled:opacity-50">{savingId === rule.id ? "Processing..." : "Delete"}</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
