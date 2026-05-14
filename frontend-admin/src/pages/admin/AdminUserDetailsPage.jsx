import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ShieldCheck,
  MailCheck,
  RefreshCw,
  Plus,
  Minus,
  UserCog,
  LockKeyhole,
  BadgeDollarSign,
  Smartphone,
  Save,
  BellRing,
  Send,
  Trash2,
} from "lucide-react";
import { adminApi, getApiErrorMessage } from "../../services/api";

function formatMoney(value) {
  const num = Number(value || 0);
  if (!Number.isFinite(num)) return "0.00";
  return num.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function Badge({ value }) {
  const text = String(value || "").replaceAll("_", " ");
  const lower = String(value || "").toLowerCase();

  let className =
    "border border-white/10 bg-white/[0.04] text-slate-300";

  if (["active", "approved", "verified", "enabled", "read"].includes(lower)) {
    className =
      "border border-emerald-500/20 bg-emerald-500/10 text-emerald-300";
  } else if (["pending", "unread"].includes(lower)) {
    className =
      "border border-amber-500/20 bg-amber-500/10 text-amber-300";
  } else if (
    ["disabled", "blocked", "frozen", "rejected", "not verified", "not set"].includes(
      lower
    )
  ) {
    className =
      "border border-red-500/20 bg-red-500/10 text-red-300";
  }

  return (
    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${className}`}>
      {text || "-"}
    </span>
  );
}

function Card({ title, subtitle, children, rightContent = null }) {
  return (
    <section className="rounded-[24px] border border-white/10 bg-[#0a0e1a] shadow-xl">
      <div className="flex flex-col gap-2 border-b border-white/10 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div>
          <h2 className="text-base font-semibold text-white sm:text-lg">{title}</h2>
          {subtitle ? <p className="mt-1 text-sm text-slate-400">{subtitle}</p> : null}
        </div>
        {rightContent}
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

const FEE_TIERS = [
  "Regular user",
  "VIP 1",
  "VIP 2",
  "VIP 3",
  "Market Maker",
  "Institutional",
];

export default function AdminUserDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const token =
    localStorage.getItem("adminToken") ||
    localStorage.getItem("admin_token") ||
    "";

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [amountForm, setAmountForm] = useState({
    addAmount: "",
    addNote: "",
    decreaseAmount: "",
    decreaseNote: "",
  });

  const [securityForm, setSecurityForm] = useState({
    status: "active",
    trading_fee_tier: "Regular user",
    twofa_enabled: 0,
    email_verified: 0,
  });

  const [notificationForm, setNotificationForm] = useState({
    title: "",
    message: "",
    type: "general",
  });

  const [actionLoading, setActionLoading] = useState(false);
  const [securitySaving, setSecuritySaving] = useState(false);
  const [sendingNotification, setSendingNotification] = useState(false);
  const [deletingUser, setDeletingUser] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function loadUser(silent = false) {
    try {
      if (!silent) setLoading(true);
      else setRefreshing(true);

      setError("");
      const res = await adminApi.getUserDetails(id, token);
      const nextUser = res?.data?.data || null;

      setUser(nextUser);

      setSecurityForm({
        status: nextUser?.status || "active",
        trading_fee_tier: nextUser?.trading_fee_tier || "Regular user",
        twofa_enabled: Number(nextUser?.twofa_enabled || 0),
        email_verified: Number(nextUser?.email_verified || 0),
      });
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadUser();
  }, [id]);

  async function handleAddFunds() {
    try {
      setActionLoading(true);
      setError("");
      setSuccess("");

      await adminApi.addUserFunds(
        id,
        {
          amount: Number(amountForm.addAmount || 0),
          note: amountForm.addNote,
        },
        token
      );

      setSuccess("Funds added successfully.");
      setAmountForm((prev) => ({ ...prev, addAmount: "", addNote: "" }));
      await loadUser(true);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setActionLoading(false);
    }
  }

  async function handleDecreaseFunds() {
    try {
      setActionLoading(true);
      setError("");
      setSuccess("");

      await adminApi.decreaseUserFunds(
        id,
        {
          amount: Number(amountForm.decreaseAmount || 0),
          note: amountForm.decreaseNote,
        },
        token
      );

      setSuccess("Funds decreased successfully.");
      setAmountForm((prev) => ({
        ...prev,
        decreaseAmount: "",
        decreaseNote: "",
      }));
      await loadUser(true);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setActionLoading(false);
    }
  }

  async function handleSaveSecurity() {
    try {
      setSecuritySaving(true);
      setError("");
      setSuccess("");

      await adminApi.updateUserSecurity(
        id,
        {
          status: securityForm.status,
          trading_fee_tier: securityForm.trading_fee_tier,
          twofa_enabled: Number(securityForm.twofa_enabled) === 1 ? 1 : 0,
          email_verified: Number(securityForm.email_verified) === 1 ? 1 : 0,
        },
        token
      );

      setSuccess("User security updated successfully.");
      await loadUser(true);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setSecuritySaving(false);
    }
  }

  function handleNotificationChange(e) {
    const { name, value } = e.target;
    setNotificationForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  async function handleSendNotification() {
    try {
      setSendingNotification(true);
      setError("");
      setSuccess("");
  
      if (!user?.id) {
        setError("User id is missing.");
        return;
      }
  
      if (!String(notificationForm.title || "").trim()) {
        setError("Notification title is required.");
        return;
      }
  
      if (!String(notificationForm.message || "").trim()) {
        setError("Notification message is required.");
        return;
      }
  
      // ✅ FIX: Make sure the API endpoint is correct
      const response = await adminApi.sendNotification(
        {
          user_id: Number(user.id),  // ✅ Ensure it's a number
          title: String(notificationForm.title || "").trim(),
          message: String(notificationForm.message || "").trim(),
          type: String(notificationForm.type || "general").trim(),
        },
        token
      );
  
      if (response?.data?.success) {
        setSuccess("Notification sent successfully.");
        setNotificationForm({
          title: "",
          message: "",
          type: "general",
        });
      } else {
        setError(response?.data?.message || "Failed to send notification");
      }
    } catch (err) {
      console.error("Send notification error:", err);
      setError(getApiErrorMessage(err));
    } finally {
      setSendingNotification(false);
    }
  }

  async function handleDeleteUser() {
    try {
      const confirmed = window.confirm(
        `Are you sure you want to delete ${user?.email || "this user"}?\n\nThis action cannot be undone.`
      );

      if (!confirmed) return;

      setDeletingUser(true);
      setError("");
      setSuccess("");

      await adminApi.deleteUser(id, token);

      alert("User deleted successfully.");
      navigate("/admin/users");
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setDeletingUser(false);
    }
  }

  const emailStatus = useMemo(() => {
    return Number(user?.email_verified || 0) === 1 ? "verified" : "not verified";
  }, [user]);

  const passcodeStatus = useMemo(() => {
    return Number(user?.has_passcode || 0) === 1 ? "enabled" : "not set";
  }, [user]);

  const twofaStatus = useMemo(() => {
    return Number(user?.twofa_enabled || 0) === 1 ? "enabled" : "disabled";
  }, [user]);

  if (loading) {
    return (
      <div className="rounded-[24px] border border-white/10 bg-[#0a0e1a] p-5 text-sm text-slate-300">
        Loading user details...
      </div>
    );
  }

  if (!user) {
    return (
      <div className="rounded-[24px] border border-white/10 bg-[#0a0e1a] p-5 text-sm text-slate-300">
        User not found.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <section className="rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(34,197,94,0.10),transparent_18%),linear-gradient(180deg,#111827_0%,#020617_100%)] p-5 shadow-xl">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <button
              type="button"
              onClick={() => navigate("/admin/users")}
              className="inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-white"
            >
              <ArrowLeft size={15} />
              Back to users
            </button>

            <h1 className="mt-3 text-2xl font-bold text-white sm:text-3xl">
              {user.name || user.email || "User"}
            </h1>

            <p className="mt-2 text-sm text-slate-400">
              UID: {user.uid || "--"} · Email: {user.email || "-"}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => loadUser(true)}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/[0.08]"
            >
              <RefreshCw size={15} className={refreshing ? "animate-spin" : ""} />
              Refresh
            </button>

            <button
              type="button"
              onClick={handleDeleteUser}
              disabled={deletingUser}
              className="inline-flex items-center gap-2 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-sm font-semibold text-red-300 transition hover:bg-red-500/20 disabled:opacity-60"
            >
              <Trash2 size={15} />
              {deletingUser ? "Deleting..." : "Delete User"}
            </button>
          </div>
        </div>
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

      <div className="grid gap-5 xl:grid-cols-[1.02fr_0.98fr]">
        <div className="space-y-5">
          <Card
            title="User security overview"
            subtitle="Review verification, account status, passcode, and security information."
          >
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-[20px] border border-white/10 bg-[#050812]/40 p-4">
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <UserCog size={15} />
                  Account status
                </div>
                <div className="mt-3">
                  <Badge value={user.status || "active"} />
                </div>
              </div>

              <div className="rounded-[20px] border border-white/10 bg-[#050812]/40 p-4">
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <ShieldCheck size={15} />
                  KYC status
                </div>
                <div className="mt-3">
                  <Badge value={user.kyc_status || "not_submitted"} />
                </div>
              </div>

              <div className="rounded-[20px] border border-white/10 bg-[#050812]/40 p-4">
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <MailCheck size={15} />
                  Email verification
                </div>
                <div className="mt-3">
                  <Badge value={emailStatus} />
                </div>
              </div>

              <div className="rounded-[20px] border border-white/10 bg-[#050812]/40 p-4">
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <LockKeyhole size={15} />
                  Passcode
                </div>
                <div className="mt-3">
                  <Badge value={passcodeStatus} />
                </div>
              </div>

              <div className="rounded-[20px] border border-white/10 bg-[#050812]/40 p-4">
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <Smartphone size={15} />
                  2FA
                </div>
                <div className="mt-3">
                  <Badge value={twofaStatus} />
                </div>
              </div>

              <div className="rounded-[20px] border border-white/10 bg-[#050812]/40 p-4">
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <BadgeDollarSign size={15} />
                  Trading fee tier
                </div>
                <div className="mt-3 text-sm font-semibold text-white sm:text-base">
                  {user.trading_fee_tier || "Regular user"}
                </div>
              </div>
            </div>
          </Card>

          <Card
            title="Wallet control"
            subtitle="Add or decrease main wallet balance."
          >
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-3 rounded-[20px] border border-white/10 bg-[#050812]/40 p-4">
                <div className="flex items-center gap-2 text-sm text-white">
                  <Plus size={15} className="text-emerald-300" />
                  Add funds
                </div>

                <input
                  type="number"
                  value={amountForm.addAmount}
                  onChange={(e) =>
                    setAmountForm((prev) => ({ ...prev, addAmount: e.target.value }))
                  }
                  placeholder="Amount"
                  className="w-full rounded-2xl border border-white/10 bg-[#050812]/70 px-4 py-3 text-sm text-white outline-none focus:border-emerald-500"
                />

                <textarea
                  rows={3}
                  value={amountForm.addNote}
                  onChange={(e) =>
                    setAmountForm((prev) => ({ ...prev, addNote: e.target.value }))
                  }
                  placeholder="Note"
                  className="w-full rounded-2xl border border-white/10 bg-[#050812]/70 px-4 py-3 text-sm text-white outline-none focus:border-emerald-500"
                />

                <button
                  type="button"
                  onClick={handleAddFunds}
                  disabled={actionLoading}
                  className="w-full rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:opacity-60"
                >
                  Add Funds
                </button>
              </div>

              <div className="space-y-3 rounded-[20px] border border-white/10 bg-[#050812]/40 p-4">
                <div className="flex items-center gap-2 text-sm text-white">
                  <Minus size={15} className="text-rose-300" />
                  Decrease funds
                </div>

                <input
                  type="number"
                  value={amountForm.decreaseAmount}
                  onChange={(e) =>
                    setAmountForm((prev) => ({
                      ...prev,
                      decreaseAmount: e.target.value,
                    }))
                  }
                  placeholder="Amount"
                  className="w-full rounded-2xl border border-white/10 bg-[#050812]/70 px-4 py-3 text-sm text-white outline-none focus:border-rose-500"
                />

                <textarea
                  rows={3}
                  value={amountForm.decreaseNote}
                  onChange={(e) =>
                    setAmountForm((prev) => ({
                      ...prev,
                      decreaseNote: e.target.value,
                    }))
                  }
                  placeholder="Note"
                  className="w-full rounded-2xl border border-white/10 bg-[#050812]/70 px-4 py-3 text-sm text-white outline-none focus:border-rose-500"
                />

                <button
                  type="button"
                  onClick={handleDecreaseFunds}
                  disabled={actionLoading}
                  className="w-full rounded-2xl bg-rose-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-rose-400 disabled:opacity-60"
                >
                  Decrease Funds
                </button>
              </div>
            </div>
          </Card>
        </div>

        <div className="space-y-5">
          <Card
            title="Basic information"
            subtitle="Main profile and location details."
          >
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between gap-4">
                <span className="text-slate-500">Full name</span>
                <span className="text-right text-white">{user.name || "-"}</span>
              </div>

              <div className="flex items-center justify-between gap-4">
                <span className="text-slate-500">Email</span>
                <span className="text-right text-white">{user.email || "-"}</span>
              </div>

              <div className="flex items-center justify-between gap-4">
                <span className="text-slate-500">UID</span>
                <span className="text-right text-white">{user.uid || "--"}</span>
              </div>

              <div className="flex items-center justify-between gap-4">
                <span className="text-slate-500">Country / Region</span>
                <span className="text-right text-white">{user.country || "Not set"}</span>
              </div>

              <div className="flex items-center justify-between gap-4">
                <span className="text-slate-500">Balance</span>
                <span className="text-right font-semibold text-white">
                  {formatMoney(user.balance)} USDT
                </span>
              </div>
            </div>
          </Card>

          <Card
            title="Security save"
            subtitle="Update account status, fee tier, email verification, and 2FA state."
            rightContent={
              <div className="rounded-full border border-white/10 bg-[#050812]/70 px-3 py-1 text-[11px] text-slate-300">
                User #{user.id}
              </div>
            }
          >
            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm text-slate-400">
                  Account status
                </label>
                <select
                  value={securityForm.status}
                  onChange={(e) =>
                    setSecurityForm((prev) => ({ ...prev, status: e.target.value }))
                  }
                  className="w-full rounded-2xl border border-white/10 bg-[#050812]/70 px-4 py-3 text-sm text-white outline-none"
                >
                  <option value="active">active</option>
                  <option value="disabled">disabled</option>
                  <option value="frozen">frozen</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm text-slate-400">
                  Trading fee tier
                </label>
                <select
                  value={securityForm.trading_fee_tier}
                  onChange={(e) =>
                    setSecurityForm((prev) => ({
                      ...prev,
                      trading_fee_tier: e.target.value,
                    }))
                  }
                  className="w-full rounded-2xl border border-white/10 bg-[#050812]/70 px-4 py-3 text-sm text-white outline-none"
                >
                  {FEE_TIERS.map((tier) => (
                    <option key={tier} value={tier}>
                      {tier}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm text-slate-400">
                  Email verification
                </label>
                <select
                  value={String(securityForm.email_verified)}
                  onChange={(e) =>
                    setSecurityForm((prev) => ({
                      ...prev,
                      email_verified: Number(e.target.value),
                    }))
                  }
                  className="w-full rounded-2xl border border-white/10 bg-[#050812]/70 px-4 py-3 text-sm text-white outline-none"
                >
                  <option value="0">not verified</option>
                  <option value="1">verified</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm text-slate-400">
                  Two-factor authentication
                </label>
                <select
                  value={String(securityForm.twofa_enabled)}
                  onChange={(e) =>
                    setSecurityForm((prev) => ({
                      ...prev,
                      twofa_enabled: Number(e.target.value),
                    }))
                  }
                  className="w-full rounded-2xl border border-white/10 bg-[#050812]/70 px-4 py-3 text-sm text-white outline-none"
                >
                  <option value="0">disabled</option>
                  <option value="1">enabled</option>
                </select>
              </div>

              <button
                type="button"
                onClick={handleSaveSecurity}
                disabled={securitySaving}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-cyan-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:opacity-60"
              >
                <Save size={15} />
                {securitySaving ? "Saving..." : "Save Security Settings"}
              </button>
            </div>
          </Card>

          <Card
            title="Send user notification"
            subtitle="Send a direct message to this user. It will appear in the user activity page."
            rightContent={
              <div className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-[11px] text-cyan-300">
                Direct message
              </div>
            }
          >
            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm text-slate-400">
                  Notification title
                </label>
                <input
                  type="text"
                  name="title"
                  value={notificationForm.title}
                  onChange={handleNotificationChange}
                  placeholder="Enter notification title"
                  className="w-full rounded-2xl border border-white/10 bg-[#050812]/70 px-4 py-3 text-sm text-white outline-none"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm text-slate-400">
                  Notification type
                </label>
                <select
                  name="type"
                  value={notificationForm.type}
                  onChange={handleNotificationChange}
                  className="w-full rounded-2xl border border-white/10 bg-[#050812]/70 px-4 py-3 text-sm text-white outline-none"
                >
                  <option value="general">general</option>
                  <option value="security">security</option>
                  <option value="verification_code">verification_code</option>
                  <option value="system">system</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm text-slate-400">
                  Message
                </label>
                <textarea
                  rows={5}
                  name="message"
                  value={notificationForm.message}
                  onChange={handleNotificationChange}
                  placeholder="Enter notification message"
                  className="w-full rounded-2xl border border-white/10 bg-[#050812]/70 px-4 py-3 text-sm text-white outline-none"
                />
              </div>

              <button
                type="button"
                onClick={handleSendNotification}
                disabled={sendingNotification}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-cyan-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-cyan-400 disabled:opacity-60"
              >
                {sendingNotification ? (
                  <>
                    <RefreshCw size={15} className="animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <BellRing size={15} />
                    <Send size={15} />
                    Send Notification
                  </>
                )}
              </button>
            </div>
          </Card>

          <Card
            title="Current security values"
            subtitle="Live values loaded from backend."
          >
            <div className="space-y-3 text-sm text-slate-300">
              <div className="flex items-center justify-between gap-4">
                <span className="text-slate-500">Email verified</span>
                <Badge value={emailStatus} />
              </div>

              <div className="flex items-center justify-between gap-4">
                <span className="text-slate-500">Passcode</span>
                <Badge value={passcodeStatus} />
              </div>

              <div className="flex items-center justify-between gap-4">
                <span className="text-slate-500">2FA</span>
                <Badge value={twofaStatus} />
              </div>

              <div className="flex items-center justify-between gap-4">
                <span className="text-slate-500">Fee tier</span>
                <span className="text-white">{user.trading_fee_tier || "Regular user"}</span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
