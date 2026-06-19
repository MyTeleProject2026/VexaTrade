// frontend-admin/src/pages/admin/AdminFundsRulesPage.jsx
import { useEffect, useMemo, useState } from "react";
import { RefreshCw, Lock, Users, UserPlus, UserMinus, Edit, Code, FileText } from "lucide-react";
import { adminApi, getApiErrorMessage } from "../../services/api";
import useToast from "../../components/ToastNotification";

// ---------- Stat Card ----------
function StatCard({ title, value, tone = "text-white" }) {
  return (
    <div className="rounded-[24px] border border-white/10 bg-[#111111] p-4 shadow-xl">
      <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">{title}</div>
      <div className={`mt-3 text-2xl font-semibold sm:text-3xl ${tone}`}>{value}</div>
    </div>
  );
}

// ---------- Detail Row ----------
function DetailRow({ label, value, valueClassName = "text-white" }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-slate-500">{label}</span>
      <span className={`text-right text-sm ${valueClassName}`}>{value}</span>
    </div>
  );
}

// ---------- Reusable Plan Card ----------
function PlanCard({
  rule,
  onSave,
  onDelete,
  onAssignUsers,
  savingId,
  showAssignButton = false,
}) {
  const [localRule, setLocalRule] = useState(rule);

  useEffect(() => {
    setLocalRule(rule);
  }, [rule]);

  const handleChange = (field, value) => {
    setLocalRule((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    onSave(localRule);
  };

  // Determine if this rule uses HTML mode (has html_content)
  const isHtmlMode = localRule.html_content && localRule.html_content.trim() !== "";

  return (
    <div className="rounded-[24px] border border-white/10 bg-[#111111] p-4 shadow-xl">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {rule.is_private === 1 && <Lock size={14} className="text-amber-400" />}
          <h2 className="text-lg font-semibold text-white">{localRule.name || "Unnamed Plan"}</h2>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
          String(localRule.status || "").toLowerCase() === "active"
            ? "bg-emerald-500/10 text-emerald-300"
            : "bg-amber-500/10 text-amber-300"
        }`}>
          {localRule.status}
        </span>
      </div>

      <div className="mt-4 space-y-4">
        {/* Basic fields */}
        <div>
          <label className="mb-2 block text-sm text-slate-300">Name</label>
          <input
            type="text"
            value={localRule.name || ""}
            onChange={(e) => handleChange("name", e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-[#0a0e1a] px-3 py-2 text-sm text-white outline-none"
          />
        </div>

        {/* If HTML mode is active, show the HTML content preview */}
        {isHtmlMode && (
          <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-3">
            <div className="flex items-center gap-2 text-cyan-300 text-xs mb-2">
              <Code size={14} /> HTML Mode Active
            </div>
            <div className="max-h-40 overflow-y-auto text-xs text-slate-400 font-mono whitespace-pre-wrap break-all">
              {localRule.html_content.substring(0, 300)}...
            </div>
          </div>
        )}

        {/* If normal mode, show individual fields */}
        {!isHtmlMode && (
          <>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm text-slate-300">Duration Days</label>
                <input
                  type="number"
                  value={localRule.duration_days || ""}
                  onChange={(e) => handleChange("duration_days", e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-[#0a0e1a] px-3 py-2 text-sm text-white outline-none"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm text-slate-300">Usage Limit</label>
                <input
                  type="number"
                  value={localRule.user_limit_count ?? ""}
                  onChange={(e) => handleChange("user_limit_count", e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-[#0a0e1a] px-3 py-2 text-sm text-white outline-none"
                />
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm text-slate-300">Min Amount</label>
                <input
                  type="number"
                  value={localRule.min_amount || ""}
                  onChange={(e) => handleChange("min_amount", e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-[#0a0e1a] px-3 py-2 text-sm text-white outline-none"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm text-slate-300">Max Amount</label>
                <input
                  type="number"
                  value={localRule.max_amount ?? ""}
                  onChange={(e) => handleChange("max_amount", e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-[#0a0e1a] px-3 py-2 text-sm text-white outline-none"
                />
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm text-slate-300">Min Daily %</label>
                <input
                  type="number"
                  value={localRule.min_daily_profit_percent || ""}
                  onChange={(e) => handleChange("min_daily_profit_percent", e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-[#0a0e1a] px-3 py-2 text-sm text-white outline-none"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm text-slate-300">Max Daily %</label>
                <input
                  type="number"
                  value={localRule.max_daily_profit_percent || ""}
                  onChange={(e) => handleChange("max_daily_profit_percent", e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-[#0a0e1a] px-3 py-2 text-sm text-white outline-none"
                />
              </div>
            </div>
            <div>
              <label className="mb-2 block text-sm text-slate-300">Status</label>
              <select
                value={localRule.status}
                onChange={(e) => handleChange("status", e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-[#0a0e1a] px-3 py-2 text-sm text-white outline-none"
              >
                <option value="active">active</option>
                <option value="inactive">inactive</option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm text-slate-300">Admin Note</label>
              <textarea
                value={localRule.admin_note || ""}
                onChange={(e) => handleChange("admin_note", e.target.value)}
                rows="3"
                className="w-full rounded-xl border border-white/10 bg-[#0a0e1a] px-3 py-2 text-sm text-white outline-none"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm text-slate-300">Note Background Image URL</label>
              <input
                type="text"
                value={localRule.admin_note_background_image || ""}
                onChange={(e) => handleChange("admin_note_background_image", e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-[#0a0e1a] px-3 py-2 text-sm text-white outline-none"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm text-slate-300">Additional Information</label>
              <textarea
                value={localRule.additional_notes || ""}
                onChange={(e) => handleChange("additional_notes", e.target.value)}
                rows="3"
                className="w-full rounded-xl border border-white/10 bg-[#0a0e1a] px-3 py-2 text-sm text-white outline-none"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm text-slate-300">Disclaimer / Risk Warning</label>
              <textarea
                value={localRule.disclaimer || ""}
                onChange={(e) => handleChange("disclaimer", e.target.value)}
                rows="3"
                className="w-full rounded-xl border border-white/10 bg-[#0a0e1a] px-3 py-2 text-sm text-white outline-none"
              />
            </div>
          </>
        )}

        {/* Private plan toggle and compound percentage */}
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={localRule.is_private === 1}
            onChange={(e) => handleChange("is_private", e.target.checked ? 1 : 0)}
            className="rounded border-white/10 bg-[#0a0e1a]"
          />
          <span className="text-sm text-slate-300">Private Plan</span>
        </label>
        <div>
          <label className="mb-2 block text-sm text-slate-300">Compound Percentage (%)</label>
          <input
            type="number"
            min="0"
            max="100"
            step="1"
            value={localRule.compound_percentage ?? 100}
            onChange={(e) => handleChange("compound_percentage", e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-[#0a0e1a] px-3 py-2 text-sm text-white outline-none"
          />
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-white/10 bg-black/40 p-4 text-sm space-y-2">
        <DetailRow label="Duration" value={`${localRule.duration_days} days`} />
        <DetailRow
          label="Daily Profit"
          value={`${Number(localRule.min_daily_profit_percent || 0)}% - ${Number(localRule.max_daily_profit_percent || 0)}%`}
          valueClassName="text-cyan-300"
        />
        <DetailRow label="Min Amount" value={localRule.min_amount || 0} />
        <DetailRow label="Max Amount" value={localRule.max_amount == null ? "Unlimited" : localRule.max_amount} />
        <DetailRow label="Usage Limit" value={localRule.user_limit_count == null ? "No limit" : localRule.user_limit_count} />
        {localRule.compound_percentage !== undefined && (
          <DetailRow label="Compound %" value={`${localRule.compound_percentage}%`} valueClassName="text-cyan-300" />
        )}
        {localRule.is_private === 1 && <DetailRow label="Type" value="Private Plan" valueClassName="text-amber-300" />}
        {localRule.html_content && (
          <DetailRow label="Mode" value="HTML" valueClassName="text-purple-300" />
        )}
      </div>

      {showAssignButton && localRule.is_private === 1 && (
        <button
          onClick={() => onAssignUsers(localRule)}
          className="mt-3 w-full rounded-lg bg-cyan-500/10 py-2 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/20"
        >
          <Users size={14} className="inline mr-1" /> Manage Assigned Users
        </button>
      )}

      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          onClick={handleSave}
          disabled={savingId === localRule.id}
          className="rounded-xl bg-cyan-500 px-4 py-2.5 text-sm font-semibold text-black hover:bg-cyan-400 disabled:opacity-50"
        >
          {savingId === localRule.id ? "Saving..." : "Save Rule"}
        </button>
        <button
          onClick={() => onDelete(localRule.id)}
          disabled={savingId === localRule.id}
          className="rounded-xl bg-rose-500/10 px-4 py-2.5 text-sm font-semibold text-rose-300 hover:bg-rose-500/20 disabled:opacity-50"
        >
          {savingId === localRule.id ? "Processing..." : "Delete"}
        </button>
      </div>
    </div>
  );
}

// ---------- Modal for per-plan user assignment ----------
function AssignUserModal({
  isOpen,
  plan,
  assignedUsers,
  onAssign,
  onRemove,
  onClose,
  addToast,
}) {
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(false);

  if (!isOpen || !plan) return null;

  const handleAssign = async () => {
    if (!userId) {
      addToast("Please enter a User ID", "error");
      return;
    }
    setLoading(true);
    await onAssign(plan.id, parseInt(userId));
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

// ---------- Modal for per-user private plans editing ----------
function UserPrivatePlansModal({
  isOpen,
  user,
  plans,
  allPrivatePlans,
  onClose,
  onSavePlan,
  onDeletePlan,
  onAssignPlanToUser,
  onUnassignPlanFromUser,
  savingId,
  addToast,
}) {
  const [selectedPlanToAdd, setSelectedPlanToAdd] = useState("");

  if (!isOpen || !user) return null;

  const assignedPlanIds = plans.map((p) => p.id);
  const availablePlans = allPrivatePlans.filter((p) => !assignedPlanIds.includes(p.id));

  const handleAssign = async () => {
    if (!selectedPlanToAdd) {
      addToast("Please select a plan to assign", "error");
      return;
    }
    await onAssignPlanToUser(user.user_id, selectedPlanToAdd);
    setSelectedPlanToAdd("");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 overflow-y-auto">
      <div className="w-full max-w-4xl rounded-2xl border border-white/10 bg-[#111111] p-5 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div>
            <h2 className="text-lg font-bold text-white">
              Private Plans for {user.name} (UID: {user.uid})
            </h2>
            <p className="text-sm text-slate-400">Manage all private plans assigned to this user.</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-xl">✕</button>
        </div>

        {/* Assign new plan */}
        <div className="mt-4 flex items-end gap-3 flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <label className="mb-1 block text-sm text-slate-300">Assign new private plan</label>
            <select
              value={selectedPlanToAdd}
              onChange={(e) => setSelectedPlanToAdd(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-[#0a0e1a] px-3 py-2 text-sm text-white outline-none"
            >
              <option value="">Select a plan...</option>
              {availablePlans.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <button
            onClick={handleAssign}
            className="rounded-xl bg-cyan-500 px-4 py-2 text-sm font-semibold text-black hover:bg-cyan-400"
          >
            <UserPlus size={16} className="inline mr-1" /> Assign
          </button>
        </div>

        {/* List of assigned plans */}
        <div className="mt-6 grid gap-5 md:grid-cols-2">
          {plans.length === 0 ? (
            <p className="text-slate-400 col-span-2">No private plans assigned to this user yet.</p>
          ) : (
            plans.map((plan) => (
              <div key={plan.id} className="relative">
                <PlanCard
                  rule={plan}
                  onSave={onSavePlan}
                  onDelete={onDeletePlan}
                  savingId={savingId}
                  showAssignButton={false}
                />
                <button
                  onClick={() => onUnassignPlanFromUser(user.user_id, plan.id)}
                  className="absolute top-2 right-2 rounded-full bg-red-500/20 p-1 text-red-300 hover:bg-red-500/30"
                  title="Remove this plan from user"
                >
                  <UserMinus size={16} />
                </button>
              </div>
            ))
          )}
        </div>

        <div className="mt-5 flex justify-end">
          <button onClick={onClose} className="rounded-lg border border-white/10 px-4 py-2 text-sm text-white">Close</button>
        </div>
      </div>
    </div>
  );
}

// ---------- Main Component ----------
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
  html_content: "",
};

export default function AdminFundsRulesPage() {
  const token = localStorage.getItem("adminToken") || localStorage.getItem("admin_token") || "";
  const { addToast, ToastContainer } = useToast();

  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState(EMPTY_FORM);
  const [activeTab, setActiveTab] = useState("public");
  const [contentMode, setContentMode] = useState("normal"); // "normal" or "html"

  // For per-plan assignment modal
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedPlanForAssign, setSelectedPlanForAssign] = useState(null);
  const [assignedUsers, setAssignedUsers] = useState([]);

  // For per-user private plans modal
  const [usersWithPlans, setUsersWithPlans] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);

  useEffect(() => {
    loadAllData();
  }, [token]);

  async function loadAllData() {
    try {
      setLoading(true);
      const res = await adminApi.getFundRules(token);
      setRules(Array.isArray(res.data?.data) ? res.data.data : []);
      await loadUsersWithPrivatePlans();
    } catch (err) {
      addToast(getApiErrorMessage(err), "error");
    } finally {
      setLoading(false);
    }
  }

  async function loadUsersWithPrivatePlans() {
    try {
      const res = await adminApi.getUsersWithPrivatePlans(token);
      setUsersWithPlans(Array.isArray(res.data?.data) ? res.data.data : []);
    } catch (err) {
      setUsersWithPlans([]);
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

  async function openAssignUserModal(plan) {
    setSelectedPlanForAssign(plan);
    await loadAssignedUsers(plan.id);
    setShowAssignModal(true);
  }

  async function assignUserToPlan(planId, userId) {
    try {
      await adminApi.assignUserToPrivatePlan(planId, { userId }, token);
      addToast("User assigned successfully", "success");
      await loadAssignedUsers(planId);
      await loadAllData();
    } catch (err) {
      addToast(getApiErrorMessage(err), "error");
    }
  }

  async function removeUserFromPlan(planId, userId) {
    try {
      await adminApi.removeUserFromPrivatePlan(planId, userId, token);
      addToast("User removed successfully", "success");
      await loadAssignedUsers(planId);
      await loadAllData();
    } catch (err) {
      addToast(getApiErrorMessage(err), "error");
    }
  }

  async function openUserModal(user) {
    setSelectedUser(user);
    setIsUserModalOpen(true);
  }

  async function assignPlanToUser(userId, planId) {
    try {
      await adminApi.assignUserToPrivatePlan(planId, { userId }, token);
      addToast("Plan assigned to user successfully", "success");
      await loadAllData();
      if (selectedUser && selectedUser.user_id === userId) {
        const refreshedUser = usersWithPlans.find(u => u.user_id === userId);
        setSelectedUser(refreshedUser);
      }
    } catch (err) {
      addToast(getApiErrorMessage(err), "error");
    }
  }

  async function unassignPlanFromUser(userId, planId) {
    try {
      await adminApi.removeUserFromPrivatePlan(planId, userId, token);
      addToast("Plan removed from user successfully", "success");
      await loadAllData();
      if (selectedUser && selectedUser.user_id === userId) {
        const refreshedUser = usersWithPlans.find(u => u.user_id === userId);
        setSelectedUser(refreshedUser);
      }
    } catch (err) {
      addToast(getApiErrorMessage(err), "error");
    }
  }

  function handleCreateChange(field, value) {
    setCreateForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleCreateRule() {
    if (!createForm.name || !createForm.name.trim()) {
      addToast("Rule name is required", "error");
      return;
    }

    // If HTML mode is active, require html_content
    if (contentMode === "html" && (!createForm.html_content || !createForm.html_content.trim())) {
      addToast("HTML content is required when HTML mode is selected", "error");
      return;
    }

    if (contentMode === "normal" && !createForm.duration_days) {
      addToast("Duration days must be greater than 0", "error");
      return;
    }

    try {
      setCreating(true);
      await adminApi.createFundRule({
        name: createForm.name,
        duration_days: contentMode === "html" ? 0 : Number(createForm.duration_days || 0),
        min_amount: contentMode === "html" ? 0 : Number(createForm.min_amount || 0),
        max_amount: contentMode === "html" ? null : (createForm.max_amount === "" ? null : Number(createForm.max_amount)),
        min_daily_profit_percent: contentMode === "html" ? 0 : Number(createForm.min_daily_profit_percent || 0),
        max_daily_profit_percent: contentMode === "html" ? 0 : Number(createForm.max_daily_profit_percent || 0),
        user_limit_count: contentMode === "html" ? null : (createForm.user_limit_count === "" ? null : Number(createForm.user_limit_count)),
        status: createForm.status || "active",
        admin_note: contentMode === "html" ? null : (createForm.admin_note || null),
        admin_note_background_image: contentMode === "html" ? null : (createForm.admin_note_background_image || null),
        additional_notes: contentMode === "html" ? null : (createForm.additional_notes || null),
        disclaimer: contentMode === "html" ? null : (createForm.disclaimer || null),
        is_private: createForm.is_private || 0,
        compound_percentage: createForm.compound_percentage || 100,
        html_content: contentMode === "html" ? createForm.html_content : null,
      }, token);
      addToast("Fund rule created successfully.", "success");
      setCreateForm(EMPTY_FORM);
      setContentMode("normal");
      await loadAllData();
    } catch (err) {
      addToast(getApiErrorMessage(err), "error");
    } finally {
      setCreating(false);
    }
  }

  async function handleSavePlan(updatedRule) {
    try {
      setSavingId(updatedRule.id);
      await adminApi.updateFundRule(updatedRule.id, {
        name: updatedRule.name,
        duration_days: Number(updatedRule.duration_days || 0),
        min_amount: Number(updatedRule.min_amount || 0),
        max_amount: updatedRule.max_amount === "" || updatedRule.max_amount === null ? null : Number(updatedRule.max_amount),
        min_daily_profit_percent: Number(updatedRule.min_daily_profit_percent || 0),
        max_daily_profit_percent: Number(updatedRule.max_daily_profit_percent || 0),
        user_limit_count: updatedRule.user_limit_count === "" || updatedRule.user_limit_count === null ? null : Number(updatedRule.user_limit_count),
        status: updatedRule.status,
        admin_note: updatedRule.admin_note || null,
        admin_note_background_image: updatedRule.admin_note_background_image || null,
        additional_notes: updatedRule.additional_notes || null,
        disclaimer: updatedRule.disclaimer || null,
        is_private: updatedRule.is_private || 0,
        compound_percentage: updatedRule.compound_percentage || 100,
        html_content: updatedRule.html_content || null,
      }, token);
      addToast(`${updatedRule.name} updated successfully.`, "success");
      await loadAllData();
      if (selectedUser) {
        const refreshedUser = usersWithPlans.find(u => u.user_id === selectedUser.user_id);
        setSelectedUser(refreshedUser);
      }
    } catch (err) {
      addToast(getApiErrorMessage(err), "error");
    } finally {
      setSavingId(null);
    }
  }

  async function handleDeletePlan(planId) {
    if (!window.confirm(`Delete this plan?`)) return;
    try {
      setSavingId(planId);
      await adminApi.deleteFundRule(planId, token);
      addToast(`Plan deleted successfully.`, "success");
      await loadAllData();
      if (selectedUser) {
        const refreshedUser = usersWithPlans.find(u => u.user_id === selectedUser.user_id);
        setSelectedUser(refreshedUser);
      }
    } catch (err) {
      addToast(getApiErrorMessage(err), "error");
    } finally {
      setSavingId(null);
    }
  }

  async function refreshData() {
    setRefreshing(true);
    await loadAllData();
    setRefreshing(false);
  }

  const publicRules = useMemo(() => rules.filter(r => r.is_private !== 1), [rules]);
  const privateRules = useMemo(() => rules.filter(r => r.is_private === 1), [rules]);

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

      {/* Header */}
      <section className="rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(163,230,53,0.10),transparent_18%),linear-gradient(180deg,#081223_0%,#020617_100%)] p-5 shadow-xl">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.32em] text-cyan-300">Funds Rules</p>
            <h1 className="mt-2 text-2xl font-bold text-white sm:text-3xl">Funds Rules</h1>
            <p className="mt-2 text-sm text-slate-400">Manage public and private fund plans with Normal or HTML mode.</p>
          </div>
          <button onClick={refreshData} className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-xs font-semibold text-white hover:bg-white/5">
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} /> Refresh
          </button>
        </div>
      </section>

      {/* Stats */}
      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Total Rules" value={summary.total} />
        <StatCard title="Active" value={summary.active} tone="text-emerald-300" />
        <StatCard title="Inactive" value={summary.inactive} tone="text-amber-300" />
        <StatCard title="Highest Max Rate" value={`${summary.highestMaxRate}%`} tone="text-cyan-300" />
      </section>

      {/* Tabs */}
      <div className="flex border-b border-white/10">
        <button
          onClick={() => setActiveTab("public")}
          className={`px-6 py-3 text-sm font-semibold transition ${
            activeTab === "public"
              ? "border-b-2 border-cyan-400 text-cyan-300"
              : "text-slate-400 hover:text-white"
          }`}
        >
          📂 Public Plans
        </button>
        <button
          onClick={() => setActiveTab("private")}
          className={`px-6 py-3 text-sm font-semibold transition ${
            activeTab === "private"
              ? "border-b-2 border-cyan-400 text-cyan-300"
              : "text-slate-400 hover:text-white"
          }`}
        >
          🔒 Private Plans
        </button>
      </div>

      {/* ----- PUBLIC PLANS TAB ----- */}
      {activeTab === "public" && (
        <>
          {/* Create Public Form with Mode Toggle */}
          <section className="rounded-[24px] border border-white/10 bg-[#111111] p-4 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">Create Public Fund Rule</h2>
              <div className="flex rounded-lg border border-white/10 overflow-hidden bg-[#0a0e1a]">
                <button
                  type="button"
                  onClick={() => setContentMode("normal")}
                  className={`px-4 py-2 text-sm font-medium flex items-center gap-2 transition ${
                    contentMode === "normal"
                      ? "bg-cyan-500/20 text-cyan-300"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <FileText size={16} /> Normal Mode
                </button>
                <button
                  type="button"
                  onClick={() => setContentMode("html")}
                  className={`px-4 py-2 text-sm font-medium flex items-center gap-2 transition ${
                    contentMode === "html"
                      ? "bg-cyan-500/20 text-cyan-300"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <Code size={16} /> HTML Mode
                </button>
              </div>
            </div>

            {/* Name - always visible */}
            <div className="mb-4">
              <label className="mb-2 block text-sm text-slate-300">Rule Name</label>
              <input
                type="text"
                value={createForm.name}
                onChange={(e) => handleCreateChange("name", e.target.value)}
                placeholder="Enter fund plan name"
                className="w-full rounded-xl border border-white/10 bg-[#0a0e1a] px-3 py-2.5 text-sm text-white outline-none"
              />
            </div>

            {/* Normal Mode Fields */}
            {contentMode === "normal" && (
              <>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <input type="number" value={createForm.duration_days} onChange={(e) => handleCreateChange("duration_days", e.target.value)} placeholder="Duration days" className="rounded-xl border border-white/10 bg-[#0a0e1a] px-3 py-2.5 text-sm text-white outline-none" />
                  <input type="number" value={createForm.min_amount} onChange={(e) => handleCreateChange("min_amount", e.target.value)} placeholder="Min amount" className="rounded-xl border border-white/10 bg-[#0a0e1a] px-3 py-2.5 text-sm text-white outline-none" />
                  <input type="number" value={createForm.max_amount} onChange={(e) => handleCreateChange("max_amount", e.target.value)} placeholder="Max amount" className="rounded-xl border border-white/10 bg-[#0a0e1a] px-3 py-2.5 text-sm text-white outline-none" />
                  <input type="number" value={createForm.min_daily_profit_percent} onChange={(e) => handleCreateChange("min_daily_profit_percent", e.target.value)} placeholder="Min daily %" className="rounded-xl border border-white/10 bg-[#0a0e1a] px-3 py-2.5 text-sm text-white outline-none" />
                  <input type="number" value={createForm.max_daily_profit_percent} onChange={(e) => handleCreateChange("max_daily_profit_percent", e.target.value)} placeholder="Max daily %" className="rounded-xl border border-white/10 bg-[#0a0e1a] px-3 py-2.5 text-sm text-white outline-none" />
                  <input type="number" value={createForm.user_limit_count} onChange={(e) => handleCreateChange("user_limit_count", e.target.value)} placeholder="User limit count" className="rounded-xl border border-white/10 bg-[#0a0e1a] px-3 py-2.5 text-sm text-white outline-none" />
                  <select value={createForm.status} onChange={(e) => handleCreateChange("status", e.target.value)} className="rounded-xl border border-white/10 bg-[#0a0e1a] px-3 py-2.5 text-sm text-white outline-none">
                    <option value="active">active</option><option value="inactive">inactive</option>
                  </select>
                  <input type="text" value={createForm.admin_note_background_image} onChange={(e) => handleCreateChange("admin_note_background_image", e.target.value)} placeholder="Background Image URL" className="rounded-xl border border-white/10 bg-[#0a0e1a] px-3 py-2.5 text-sm text-white outline-none" />
                </div>
                <div className="mt-4 grid gap-4">
                  <div>
                    <label className="mb-2 block text-sm text-slate-300">Admin Note</label>
                    <textarea value={createForm.admin_note} onChange={(e) => handleCreateChange("admin_note", e.target.value)} placeholder="Write admin note here..." rows="3" className="w-full rounded-xl border border-white/10 bg-[#0a0e1a] px-3 py-2 text-sm text-white outline-none" />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm text-slate-300">Additional Information</label>
                    <textarea value={createForm.additional_notes} onChange={(e) => handleCreateChange("additional_notes", e.target.value)} placeholder="Write additional info..." rows="3" className="w-full rounded-xl border border-white/10 bg-[#0a0e1a] px-3 py-2 text-sm text-white outline-none" />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm text-slate-300">Disclaimer / Risk Warning</label>
                    <textarea value={createForm.disclaimer} onChange={(e) => handleCreateChange("disclaimer", e.target.value)} placeholder="Write disclaimer..." rows="3" className="w-full rounded-xl border border-white/10 bg-[#0a0e1a] px-3 py-2 text-sm text-white outline-none" />
                  </div>
                </div>
              </>
            )}

            {/* HTML Mode - Single Code Box */}
            {contentMode === "html" && (
              <div className="mt-4">
                <label className="mb-2 block text-sm text-slate-300">HTML Content</label>
                <p className="text-xs text-slate-500 mb-2">Write your full HTML code here (including design, description, disclaimer, etc.)</p>
                <textarea
                  value={createForm.html_content}
                  onChange={(e) => handleCreateChange("html_content", e.target.value)}
                  placeholder="<h1>Fund Name</h1><p>Description...</p><div class='disclaimer'>Risk warning...</div>"
                  rows="12"
                  className="w-full rounded-xl border border-white/10 bg-[#0a0e1a] px-3 py-2 text-sm font-mono text-cyan-300 outline-none focus:border-cyan-400 resize-y"
                  spellCheck={false}
                />
                <div className="mt-2 flex items-center gap-4 text-xs text-slate-500">
                  <span>💡 Write complete HTML with styles, content, and layout.</span>
                  <span className="text-purple-400">All content will be rendered as-is on the user side.</span>
                </div>
              </div>
            )}

            {/* Common fields */}
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <label className="flex items-center gap-2"><input type="checkbox" checked={createForm.is_private === 1} onChange={(e) => handleCreateChange("is_private", e.target.checked ? 1 : 0)} className="rounded border-white/10 bg-[#0a0e1a]" /><span className="text-sm text-slate-300">Private Plan</span></label>
              <div><label className="mb-1 block text-sm text-slate-300">Compound Percentage (%)</label><input type="number" min="0" max="100" step="1" value={createForm.compound_percentage} onChange={(e) => handleCreateChange("compound_percentage", e.target.value)} className="w-full rounded-xl border border-white/10 bg-[#0a0e1a] px-3 py-2 text-sm text-white outline-none" /></div>
            </div>

            <button onClick={handleCreateRule} disabled={creating} className="mt-4 rounded-xl bg-cyan-500 px-4 py-2.5 text-sm font-semibold text-black hover:bg-cyan-400 disabled:opacity-50">
              {creating ? "Creating..." : (contentMode === "html" ? "Create HTML Fund Rule" : "Create Rule")}
            </button>
          </section>

          {/* Public plans list */}
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {publicRules.map((rule) => (
              <PlanCard
                key={rule.id}
                rule={rule}
                onSave={handleSavePlan}
                onDelete={handleDeletePlan}
                savingId={savingId}
                showAssignButton={false}
                onAssignUsers={() => {}}
              />
            ))}
          </div>
        </>
      )}

      {/* ----- PRIVATE PLANS TAB ----- */}
      {activeTab === "private" && (
        <>
          {/* Create Private Form with Mode Toggle */}
          <section className="rounded-[24px] border border-white/10 bg-[#111111] p-4 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">Create Private Fund Rule</h2>
              <div className="flex rounded-lg border border-white/10 overflow-hidden bg-[#0a0e1a]">
                <button
                  type="button"
                  onClick={() => setContentMode("normal")}
                  className={`px-4 py-2 text-sm font-medium flex items-center gap-2 transition ${
                    contentMode === "normal"
                      ? "bg-cyan-500/20 text-cyan-300"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <FileText size={16} /> Normal Mode
                </button>
                <button
                  type="button"
                  onClick={() => setContentMode("html")}
                  className={`px-4 py-2 text-sm font-medium flex items-center gap-2 transition ${
                    contentMode === "html"
                      ? "bg-cyan-500/20 text-cyan-300"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <Code size={16} /> HTML Mode
                </button>
              </div>
            </div>

            <p className="text-sm text-slate-400 mb-4">This plan will be private and must be assigned to specific users.</p>

            {/* Name - always visible */}
            <div className="mb-4">
              <label className="mb-2 block text-sm text-slate-300">Rule Name</label>
              <input
                type="text"
                value={createForm.name}
                onChange={(e) => handleCreateChange("name", e.target.value)}
                placeholder="Enter fund plan name"
                className="w-full rounded-xl border border-white/10 bg-[#0a0e1a] px-3 py-2.5 text-sm text-white outline-none"
              />
            </div>

            {/* Normal Mode Fields */}
            {contentMode === "normal" && (
              <>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <input type="number" value={createForm.duration_days} onChange={(e) => handleCreateChange("duration_days", e.target.value)} placeholder="Duration days" className="rounded-xl border border-white/10 bg-[#0a0e1a] px-3 py-2.5 text-sm text-white outline-none" />
                  <input type="number" value={createForm.min_amount} onChange={(e) => handleCreateChange("min_amount", e.target.value)} placeholder="Min amount" className="rounded-xl border border-white/10 bg-[#0a0e1a] px-3 py-2.5 text-sm text-white outline-none" />
                  <input type="number" value={createForm.max_amount} onChange={(e) => handleCreateChange("max_amount", e.target.value)} placeholder="Max amount" className="rounded-xl border border-white/10 bg-[#0a0e1a] px-3 py-2.5 text-sm text-white outline-none" />
                  <input type="number" value={createForm.min_daily_profit_percent} onChange={(e) => handleCreateChange("min_daily_profit_percent", e.target.value)} placeholder="Min daily %" className="rounded-xl border border-white/10 bg-[#0a0e1a] px-3 py-2.5 text-sm text-white outline-none" />
                  <input type="number" value={createForm.max_daily_profit_percent} onChange={(e) => handleCreateChange("max_daily_profit_percent", e.target.value)} placeholder="Max daily %" className="rounded-xl border border-white/10 bg-[#0a0e1a] px-3 py-2.5 text-sm text-white outline-none" />
                  <input type="number" value={createForm.user_limit_count} onChange={(e) => handleCreateChange("user_limit_count", e.target.value)} placeholder="User limit count" className="rounded-xl border border-white/10 bg-[#0a0e1a] px-3 py-2.5 text-sm text-white outline-none" />
                  <select value={createForm.status} onChange={(e) => handleCreateChange("status", e.target.value)} className="rounded-xl border border-white/10 bg-[#0a0e1a] px-3 py-2.5 text-sm text-white outline-none">
                    <option value="active">active</option><option value="inactive">inactive</option>
                  </select>
                  <input type="text" value={createForm.admin_note_background_image} onChange={(e) => handleCreateChange("admin_note_background_image", e.target.value)} placeholder="Background Image URL" className="rounded-xl border border-white/10 bg-[#0a0e1a] px-3 py-2.5 text-sm text-white outline-none" />
                </div>
                <div className="mt-4 grid gap-4">
                  <div>
                    <label className="mb-2 block text-sm text-slate-300">Admin Note</label>
                    <textarea value={createForm.admin_note} onChange={(e) => handleCreateChange("admin_note", e.target.value)} placeholder="Write admin note here..." rows="3" className="w-full rounded-xl border border-white/10 bg-[#0a0e1a] px-3 py-2 text-sm text-white outline-none" />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm text-slate-300">Additional Information</label>
                    <textarea value={createForm.additional_notes} onChange={(e) => handleCreateChange("additional_notes", e.target.value)} placeholder="Write additional info..." rows="3" className="w-full rounded-xl border border-white/10 bg-[#0a0e1a] px-3 py-2 text-sm text-white outline-none" />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm text-slate-300">Disclaimer / Risk Warning</label>
                    <textarea value={createForm.disclaimer} onChange={(e) => handleCreateChange("disclaimer", e.target.value)} placeholder="Write disclaimer..." rows="3" className="w-full rounded-xl border border-white/10 bg-[#0a0e1a] px-3 py-2 text-sm text-white outline-none" />
                  </div>
                </div>
              </>
            )}

            {/* HTML Mode - Single Code Box */}
            {contentMode === "html" && (
              <div className="mt-4">
                <label className="mb-2 block text-sm text-slate-300">HTML Content</label>
                <p className="text-xs text-slate-500 mb-2">Write your full HTML code here (including design, description, disclaimer, etc.)</p>
                <textarea
                  value={createForm.html_content}
                  onChange={(e) => handleCreateChange("html_content", e.target.value)}
                  placeholder="<h1>Fund Name</h1><p>Description...</p><div class='disclaimer'>Risk warning...</div>"
                  rows="12"
                  className="w-full rounded-xl border border-white/10 bg-[#0a0e1a] px-3 py-2 text-sm font-mono text-cyan-300 outline-none focus:border-cyan-400 resize-y"
                  spellCheck={false}
                />
                <div className="mt-2 flex items-center gap-4 text-xs text-slate-500">
                  <span>💡 Write complete HTML with styles, content, and layout.</span>
                  <span className="text-purple-400">All content will be rendered as-is on the user side.</span>
                </div>
              </div>
            )}

            {/* Common fields */}
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <label className="flex items-center gap-2"><input type="checkbox" checked={true} disabled className="rounded border-white/10 bg-[#0a0e1a]" /><span className="text-sm text-slate-300">Private Plan (always enabled)</span></label>
              <div><label className="mb-1 block text-sm text-slate-300">Compound Percentage (%)</label><input type="number" min="0" max="100" step="1" value={createForm.compound_percentage} onChange={(e) => handleCreateChange("compound_percentage", e.target.value)} className="w-full rounded-xl border border-white/10 bg-[#0a0e1a] px-3 py-2 text-sm text-white outline-none" /></div>
            </div>

            <button onClick={async () => {
              setCreateForm(prev => ({ ...prev, is_private: 1 }));
              await handleCreateRule();
            }} disabled={creating} className="mt-4 rounded-xl bg-cyan-500 px-4 py-2.5 text-sm font-semibold text-black hover:bg-cyan-400 disabled:opacity-50">
              {creating ? "Creating..." : (contentMode === "html" ? "Create Private HTML Plan" : "Create Private Rule")}
            </button>
          </section>

          {/* Private plans list with Manage Assigned Users */}
          <section className="rounded-[24px] border border-white/10 bg-[#111111] p-4 shadow-xl">
            <h2 className="text-lg font-semibold text-white">All Private Plans</h2>
            <p className="text-sm text-slate-400 mb-4">Each plan can be assigned to specific users via the "Manage Assigned Users" button.</p>
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {privateRules.map((rule) => (
                <PlanCard
                  key={rule.id}
                  rule={rule}
                  onSave={handleSavePlan}
                  onDelete={handleDeletePlan}
                  savingId={savingId}
                  showAssignButton={true}
                  onAssignUsers={openAssignUserModal}
                />
              ))}
            </div>
          </section>

          {/* Users with Private Plans section */}
          <section className="rounded-[24px] border border-white/10 bg-[#111111] p-4 shadow-xl">
            <h2 className="text-lg font-semibold text-white">Users with Private Plans</h2>
            <p className="text-sm text-slate-400 mb-4">Click "Edit Plans" to manage all private plans for a specific user.</p>
            {usersWithPlans.length === 0 ? (
              <p className="text-slate-400">No users have private plans assigned yet.</p>
            ) : (
              <div className="space-y-3">
                {usersWithPlans.map((user) => (
                  <div key={user.user_id} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#0a0e1a] p-3">
                    <div>
                      <div className="font-semibold text-white">{user.name} (UID: {user.uid})</div>
                      <div className="text-xs text-slate-400">{user.email} • {user.plans.length} plan(s) assigned</div>
                    </div>
                    <button
                      onClick={() => openUserModal(user)}
                      className="rounded-lg bg-cyan-500/10 px-3 py-1.5 text-sm font-semibold text-cyan-300 hover:bg-cyan-500/20"
                    >
                      <Edit size={14} className="inline mr-1" /> Edit Plans
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {/* Per-plan Assign User Modal */}
      <AssignUserModal
        isOpen={showAssignModal}
        plan={selectedPlanForAssign}
        assignedUsers={assignedUsers}
        onAssign={assignUserToPlan}
        onRemove={removeUserFromPlan}
        onClose={() => { setShowAssignModal(false); setSelectedPlanForAssign(null); setAssignedUsers([]); }}
        addToast={addToast}
      />

      {/* Per-user Private Plans Modal */}
      {selectedUser && (
        <UserPrivatePlansModal
          isOpen={isUserModalOpen}
          user={selectedUser}
          plans={selectedUser.plans || []}
          allPrivatePlans={privateRules}
          onClose={() => { setIsUserModalOpen(false); setSelectedUser(null); }}
          onSavePlan={handleSavePlan}
          onDeletePlan={handleDeletePlan}
          onAssignPlanToUser={assignPlanToUser}
          onUnassignPlanFromUser={unassignPlanFromUser}
          savingId={savingId}
          addToast={addToast}
        />
      )}
    </div>
  );
}
