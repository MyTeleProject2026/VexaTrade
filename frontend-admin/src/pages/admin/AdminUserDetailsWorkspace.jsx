import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, BadgeDollarSign, BellRing, Info, LockKeyhole, MailCheck, RefreshCw, Save, Send, ShieldCheck, Smartphone, Trash2, UserCog, WalletCards, ShieldAlert } from "lucide-react";
import { adminApi, getApiErrorMessage } from "../../services/api";
import useToast from "../../components/ToastNotification";
import AdminUserWalletControlPanel from "./AdminUserWalletControlPanel";

const FEE_TIERS = ["Regular user", "VIP 1", "VIP 2", "VIP 3", "Market Maker", "Institutional"];
const SECTIONS = [
  { key: "overview", label: "Overview", icon: Info },
  { key: "wallet", label: "Wallet", icon: WalletCards },
  { key: "security", label: "Security", icon: ShieldCheck },
  { key: "communication", label: "Communication", icon: BellRing },
];

function formatMoney(value) {
  const num = Number(value || 0);
  return Number.isFinite(num) ? num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0.00";
}

function Badge({ value }) {
  const text = String(value || "-").replaceAll("_", " ");
  const lower = String(value || "").toLowerCase();
  const tone = ["active", "approved", "verified", "enabled", "read"].includes(lower)
    ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
    : ["pending", "unread"].includes(lower)
      ? "border-amber-500/20 bg-amber-500/10 text-amber-300"
      : ["disabled", "blocked", "frozen", "rejected", "not verified", "not set"].includes(lower)
        ? "border-red-500/20 bg-red-500/10 text-red-300"
        : "border-white/10 bg-white/[0.04] text-slate-300";
  return <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${tone}`}>{text}</span>;
}

function Card({ title, subtitle, children, rightContent = null }) {
  return <section className="rounded-[24px] border border-white/10 bg-[#0a0e1a] shadow-xl">
    <div className="flex flex-col gap-2 border-b border-white/10 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5"><div><h2 className="text-base font-semibold text-white sm:text-lg">{title}</h2>{subtitle ? <p className="mt-1 text-xs text-slate-400">{subtitle}</p> : null}</div>{rightContent}</div>
    <div className="p-4 sm:p-5">{children}</div>
  </section>;
}

export default function AdminUserDetailsWorkspace() {
  const { id } = useParams();
  const navigate = useNavigate();
  const token = localStorage.getItem("adminToken") || localStorage.getItem("admin_token") || "";
  const { addToast, ToastContainer } = useToast();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [section, setSection] = useState("overview");
  const [security, setSecurity] = useState({ status: "active", trading_fee_tier: "Regular user", twofa_enabled: 0, email_verified: 0 });
  const [notification, setNotification] = useState({ title: "", message: "", type: "general", send_email: true });
  const [savingSecurity, setSavingSecurity] = useState(false);
  const [sendingNotification, setSendingNotification] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function loadUser(silent = false) {
    try {
      silent ? setRefreshing(true) : setLoading(true);
      setError("");
      const response = await adminApi.getUserDetails(id, token);
      const next = response?.data?.data || null;
      setUser(next);
      setSecurity({ status: next?.status || "active", trading_fee_tier: next?.trading_fee_tier || "Regular user", twofa_enabled: Number(next?.twofa_enabled || 0), email_verified: Number(next?.email_verified || 0) });
      if (silent) addToast("User details refreshed successfully", "success");
    } catch (err) { const msg = getApiErrorMessage(err); setError(msg); addToast(msg, "error"); }
    finally { setLoading(false); setRefreshing(false); }
  }

  useEffect(() => { loadUser(); }, [id]);

  async function saveSecurity() {
    try {
      setSavingSecurity(true); setError(""); setSuccess("");
      await adminApi.updateUserSecurity(id, { status: security.status, trading_fee_tier: security.trading_fee_tier, twofa_enabled: Number(security.twofa_enabled) === 1 ? 1 : 0, email_verified: Number(security.email_verified) === 1 ? 1 : 0 }, token);
      setSuccess("User security updated successfully."); addToast("User security updated successfully.", "success"); await loadUser(true);
    } catch (err) { const msg = getApiErrorMessage(err); setError(msg); addToast(msg, "error"); }
    finally { setSavingSecurity(false); }
  }

  async function sendNotification() {
    if (!String(notification.title).trim() || !String(notification.message).trim()) { const msg = "Notification title and message are required."; setError(msg); addToast(msg, "error"); return; }
    try {
      setSendingNotification(true); setError(""); setSuccess("");
      const response = await adminApi.sendNotificationWithEmail({ user_id: Number(user.id), title: notification.title.trim(), message: notification.message.trim(), type: notification.type, send_email: notification.send_email === true }, token);
      if (!response?.data?.success) throw new Error(response?.data?.message || "Failed to send notification");
      const sentEmail = response.data.data?.email_sent ? " (with email)" : " (in-app only)";
      const msg = `Notification sent successfully${sentEmail}`; setSuccess(msg); addToast(msg, "success");
      setNotification({ title: "", message: "", type: "general", send_email: true });
    } catch (err) { const msg = getApiErrorMessage(err); setError(msg); addToast(msg, "error"); }
    finally { setSendingNotification(false); }
  }

  async function deleteUser() {
    if (!window.confirm(`Are you sure you want to permanently delete ${user?.email || "this user"}?`)) return;
    try { setDeleting(true); await adminApi.deleteUser(id, token); addToast("User deleted successfully", "success"); setTimeout(() => navigate("/admin/users"), 1000); }
    catch (err) { const msg = getApiErrorMessage(err); setError(msg); addToast(msg, "error"); setDeleting(false); }
  }

  const emailStatus = useMemo(() => Number(user?.email_verified || 0) === 1 ? "verified" : "not verified", [user]);
  const passcodeStatus = useMemo(() => Number(user?.has_passcode || 0) === 1 ? "enabled" : "not set", [user]);
  const twofaStatus = useMemo(() => Number(user?.twofa_enabled || 0) === 1 ? "enabled" : "disabled", [user]);

  if (loading) return <div className="rounded-[24px] border border-white/10 bg-[#0a0e1a] p-5 text-sm text-slate-300">Loading user details…</div>;
  if (!user) return <div className="rounded-[24px] border border-white/10 bg-[#0a0e1a] p-5 text-sm text-slate-300">User not found.</div>;

  return <div className="space-y-5"><ToastContainer />
    <section className="rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(34,197,94,0.10),transparent_18%),linear-gradient(180deg,#111827_0%,#020617_100%)] p-5 shadow-xl">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div><button type="button" onClick={() => navigate("/admin/users")} className="inline-flex items-center gap-2 text-xs text-slate-400 hover:text-white"><ArrowLeft size={15} /> Back to users</button><h1 className="mt-3 text-2xl font-bold text-white sm:text-3xl">{user.name || user.email || "User"}</h1><p className="mt-2 text-xs text-slate-400">UID: {user.uid || "--"} · {user.email || "-"}</p></div>
        <div className="flex flex-wrap items-center gap-2"><Badge value={user.status || "active"} /><Badge value={user.kyc_status || "not_submitted"} /><button type="button" onClick={() => loadUser(true)} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-white hover:bg-white/[0.08]"><RefreshCw size={14} className={refreshing ? "animate-spin" : ""} /> Refresh</button><button type="button" onClick={deleteUser} disabled={deleting} className="inline-flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-300 hover:bg-red-500/20 disabled:opacity-60"><Trash2 size={14} /> {deleting ? "Deleting…" : "Delete"}</button></div>
      </div>
    </section>

    {(error || success) ? <div className={`rounded-2xl border px-4 py-3 text-xs ${error ? "border-red-500/20 bg-red-500/10 text-red-300" : "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"}`}>{error || success}</div> : null}

    <div className="grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
      <nav className="h-fit rounded-[24px] border border-white/10 bg-[#0a0e1a] p-2 shadow-xl lg:sticky lg:top-4">
        <div className="px-3 pb-2 pt-2 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">User control</div>
        {SECTIONS.map(({ key, label, icon: Icon }) => <button key={key} type="button" onClick={() => { setSection(key); setError(""); setSuccess(""); }} className={`mb-1 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-xs font-semibold transition ${section === key ? "bg-cyan-500/10 text-cyan-300 ring-1 ring-cyan-400/20" : "text-slate-400 hover:bg-white/[0.04] hover:text-white"}`}><Icon size={15} />{label}</button>)}
        <div className="mt-3 border-t border-white/10 px-3 pt-3 text-[10px] leading-4 text-slate-500">Changes are sent through the existing authenticated admin APIs and backend audit flows.</div>
      </nav>

      <main className="min-w-0 space-y-5">
        {section === "overview" ? <>
          <Card title="Account overview" subtitle="Live identity, verification and account state."><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{[
            ["Account status", <Badge value={user.status || "active"} />], ["KYC", <Badge value={user.kyc_status || "not_submitted"} />], ["Email", <Badge value={emailStatus} />], ["Passcode", <Badge value={passcodeStatus} />], ["2FA", <Badge value={twofaStatus} />], ["Fee tier", <span className="font-semibold text-white">{user.trading_fee_tier || "Regular user"}</span>],
          ].map(([label, value]) => <div key={label} className="rounded-2xl border border-white/10 bg-[#050812]/50 p-4"><div className="mb-2 text-[11px] text-slate-500">{label}</div>{value}</div>)}</div></Card>
          <Card title="Basic information" subtitle="Read-only profile data from the live user record."><div className="grid gap-3 sm:grid-cols-2">{[["Full name", user.name], ["Email", user.email], ["UID", user.uid], ["Country / Region", user.country || "Not set"], ["Main balance", `${formatMoney(user.balance)} USDT`], ["User ID", user.id]].map(([label, value]) => <div key={label} className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-3 text-xs"><span className="text-slate-500">{label}</span><span className="text-right font-medium text-white">{value || "-"}</span></div>)}</div></Card>
          <div className="grid gap-3 sm:grid-cols-2"><button type="button" onClick={() => setSection("wallet")} className="rounded-2xl border border-cyan-400/20 bg-cyan-500/10 p-4 text-left hover:bg-cyan-500/15"><WalletCards size={17} className="mb-2 text-cyan-300" /><div className="text-sm font-semibold text-white">Open Wallet Control</div><div className="mt-1 text-[11px] text-slate-500">Manage supported crypto assets and networks.</div></button><button type="button" onClick={() => setSection("security")} className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-left hover:bg-white/[0.05]"><LockKeyhole size={17} className="mb-2 text-violet-300" /><div className="text-sm font-semibold text-white">Open Security Control</div><div className="mt-1 text-[11px] text-slate-500">Account status, fee tier, email verification and 2FA.</div></button></div><button type="button" onClick={() => navigate(`/admin/account-verification?userId=${encodeURIComponent(id)}`)} className="mt-3 w-full rounded-2xl border border-amber-400/20 bg-amber-500/10 p-4 text-left hover:bg-amber-500/15"><ShieldAlert size={17} className="mb-2 text-amber-300" /><div className="text-sm font-semibold text-white">External Wallet Verification</div><div className="mt-1 text-[11px] text-slate-500">Configure or review the three-stage account access verification workflow for this user.</div></button>
        </> : null}

        {section === "wallet" ? <AdminUserWalletControlPanel userId={id} token={token} /> : null}

        {section === "security" ? <Card title="Security & account control" subtitle="Real-time administrative controls connected to the existing backend security route." rightContent={<span className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[10px] text-slate-400">User #{user.id}</span>}>
          <div className="grid gap-4 sm:grid-cols-2"><label className="text-xs text-slate-400">Account status<select value={security.status} onChange={(e) => setSecurity((p) => ({ ...p, status: e.target.value }))} className="mt-2 w-full rounded-xl border border-white/10 bg-[#050812] px-3 py-3 text-sm text-white"><option value="active">active</option><option value="disabled">disabled</option><option value="frozen">frozen</option></select></label><label className="text-xs text-slate-400">Trading fee tier<select value={security.trading_fee_tier} onChange={(e) => setSecurity((p) => ({ ...p, trading_fee_tier: e.target.value }))} className="mt-2 w-full rounded-xl border border-white/10 bg-[#050812] px-3 py-3 text-sm text-white">{FEE_TIERS.map((tier) => <option key={tier} value={tier}>{tier}</option>)}</select></label><label className="text-xs text-slate-400">Email verification<select value={String(security.email_verified)} onChange={(e) => setSecurity((p) => ({ ...p, email_verified: Number(e.target.value) }))} className="mt-2 w-full rounded-xl border border-white/10 bg-[#050812] px-3 py-3 text-sm text-white"><option value="0">not verified</option><option value="1">verified</option></select></label><label className="text-xs text-slate-400">Two-factor authentication<select value={String(security.twofa_enabled)} onChange={(e) => setSecurity((p) => ({ ...p, twofa_enabled: Number(e.target.value) }))} className="mt-2 w-full rounded-xl border border-white/10 bg-[#050812] px-3 py-3 text-sm text-white"><option value="0">disabled</option><option value="1">enabled</option></select></label></div>
          <button type="button" onClick={saveSecurity} disabled={savingSecurity} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-500 px-4 py-3 text-sm font-bold text-slate-950 hover:bg-cyan-400 disabled:opacity-60"><Save size={15} />{savingSecurity ? "Saving…" : "Save Security Settings"}</button>
          <div className="mt-5 grid gap-2 sm:grid-cols-3"><div className="rounded-xl border border-white/10 p-3 text-xs"><MailCheck size={14} className="mb-2 text-cyan-300" />Email <Badge value={emailStatus} /></div><div className="rounded-xl border border-white/10 p-3 text-xs"><Smartphone size={14} className="mb-2 text-cyan-300" />2FA <Badge value={twofaStatus} /></div><div className="rounded-xl border border-white/10 p-3 text-xs"><BadgeDollarSign size={14} className="mb-2 text-cyan-300" />Fee tier <span className="text-white">{user.trading_fee_tier || "Regular user"}</span></div></div>
        </Card> : null}

        {section === "communication" ? <Card title="User communication" subtitle="Send a direct in-app notification, with optional email delivery through the existing backend notification flow."><div className="space-y-4"><input value={notification.title} onChange={(e) => setNotification((p) => ({ ...p, title: e.target.value }))} placeholder="Notification title" className="w-full rounded-xl border border-white/10 bg-[#050812] px-3 py-3 text-sm text-white outline-none" /><select value={notification.type} onChange={(e) => setNotification((p) => ({ ...p, type: e.target.value }))} className="w-full rounded-xl border border-white/10 bg-[#050812] px-3 py-3 text-sm text-white"><option value="general">general</option><option value="security">security</option><option value="verification_code">verification_code</option><option value="system">system</option></select><textarea rows={6} value={notification.message} onChange={(e) => setNotification((p) => ({ ...p, message: e.target.value }))} placeholder="Message" className="w-full rounded-xl border border-white/10 bg-[#050812] px-3 py-3 text-sm text-white outline-none" /><label className="flex items-center gap-3 text-xs text-slate-400"><input type="checkbox" checked={notification.send_email} onChange={(e) => setNotification((p) => ({ ...p, send_email: e.target.checked }))} /> Also send email to {user.email}</label><button type="button" onClick={sendNotification} disabled={sendingNotification} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-500 px-4 py-3 text-sm font-bold text-slate-950 hover:bg-cyan-400 disabled:opacity-60">{sendingNotification ? <RefreshCw size={15} className="animate-spin" /> : <Send size={15} />} {sendingNotification ? "Sending…" : "Send Notification"}</button></div></Card> : null}
      </main>
    </div>
  </div>;
}
