import { useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, Bell, Home, Menu, ShieldCheck } from "lucide-react";

const SECTION_TAGS = [
  ["/admin/control-center", "Command Center"],
  ["/admin/dashboard", "Overview"],
  ["/admin/users", "User Control"],
  ["/admin/kyc", "Identity Review"],
  ["/admin/deposit-networks", "Wallet Network Setup"],
  ["/admin/deposits", "Deposit Review"],
  ["/admin/withdrawal-fees", "Fee Control"],
  ["/admin/withdrawal-settings", "Policy Control"],
  ["/admin/withdrawals", "Withdrawal Review"],
  ["/admin/profit-withdrawal-requests", "Profit Review"],
  ["/admin/trading-funds-control", "Trading Control"],
  ["/admin/trades", "Trade Operations"],
  ["/admin/trade-rules", "Rule Management"],
  ["/admin/spot-trade", "Spot Trading Control"],
  ["/admin/spot-settlement-rules", "Spot Settlement Rules"],
  ["/admin/joint-account-requests", "Account Requests"],
  ["/admin/joint-accounts", "Joint Accounts"],
  ["/admin/loans", "Loan Control"],
  ["/admin/loan-settings", "Loan Settings"],
  ["/admin/audit-logs", "Governance"],
  ["/admin/support", "Customer Service"],
  ["/admin/platform-settings", "Global Settings"],
  ["/admin/news", "News Control"],
  ["/admin/legal-docs", "Legal Control"],
  ["/admin/maintenance", "Availability Control"],
];

function currentTime() {
  try { return new Date().toLocaleString([], { dateStyle: "medium", timeStyle: "short" }); } catch { return ""; }
}

export default function AppTopbar({ title = "Super Admin", subtitle = "VexaTrade platform control plane.", onMenuClick, admin = false }) {
  const navigate = useNavigate();
  const location = useLocation();
  const sectionTag = useMemo(() => SECTION_TAGS.find(([path]) => location.pathname === path || (path === "/admin/users" && location.pathname.startsWith("/admin/users/")))?.[1] || (admin ? "Admin Panel" : "Platform"), [location.pathname, admin]);
  const canGoBack = location.pathname !== "/admin/dashboard" && location.pathname !== "/admin/control-center";

  const logout = () => {
    if (admin) {
      ["adminToken", "admin_token", "adminData", "adminUser"].forEach((key) => localStorage.removeItem(key));
      navigate("/admin/login", { replace: true });
    } else {
      ["userToken", "token", "accessToken", "userRefreshToken", "userData", "user"].forEach((key) => localStorage.removeItem(key));
      navigate("/login", { replace: true });
    }
  };

  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-[#080d18]/95 shadow-lg shadow-black/10 backdrop-blur-xl">
      <div className="flex min-h-[60px] items-center gap-2 px-3 sm:px-4 lg:px-6">
        <button type="button" aria-label="Open navigation" onClick={onMenuClick} className="admin-button px-2.5 xl:hidden"><Menu size={16} /></button>
        {canGoBack ? <button type="button" aria-label="Go back" onClick={() => navigate(-1)} className="admin-button hidden px-2.5 sm:inline-flex"><ArrowLeft size={15} /></button> : null}
        <button type="button" onClick={() => navigate("/admin/control-center")} className="hidden items-center gap-2 rounded-xl px-2 py-1.5 text-left hover:bg-white/[0.04] md:flex">
          <span className="grid h-7 w-7 place-items-center rounded-lg border border-cyan-400/20 bg-cyan-500/10"><ShieldCheck size={14} className="text-cyan-300" /></span>
          <span className="text-xs font-bold text-white">VexaTrade <span className="text-slate-500">Admin</span></span>
        </button>
        <div className="mx-1 h-7 w-px bg-white/10" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-[9px] font-bold uppercase tracking-[0.18em] text-cyan-300">{sectionTag}</span>
            <span className="hidden text-[10px] text-slate-600 lg:inline">{currentTime()}</span>
          </div>
          <div className="truncate text-sm font-bold text-white">{title}</div>
          <div className="hidden truncate text-[10px] text-slate-500 lg:block">{subtitle}</div>
        </div>
        <div className="hidden items-center gap-2 sm:flex">
          <button type="button" onClick={() => navigate("/admin/dashboard")} className="admin-button px-2.5" title="Dashboard"><Home size={14} /><span className="hidden lg:inline">Home</span></button>
          <button type="button" onClick={() => navigate("/admin/audit-logs")} className="admin-button px-2.5" title="Audit & Compliance"><Bell size={14} /><span className="hidden lg:inline">Audit</span></button>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-emerald-400/15 bg-emerald-500/5 px-2.5 py-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          <span className="hidden text-[9px] font-bold uppercase tracking-wide text-emerald-300 sm:inline">Live</span>
        </div>
        <button type="button" onClick={logout} className="admin-button px-2.5 sm:px-3">Logout</button>
      </div>
    </header>
  );
}
