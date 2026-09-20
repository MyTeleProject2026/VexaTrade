import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useMemo, useState } from "react";
import { Activity, ArrowDownToLine, ArrowUpToLine, BarChart3, BadgeDollarSign, CandlestickChart, ChevronDown, ChevronRight, CircleDollarSign, FileClock, HandCoins, Handshake, Landmark, LayoutDashboard, LifeBuoy, LogOut, Network, Newspaper, Scale, Settings2, SlidersHorizontal, ShieldCheck, UserCog, Users, WalletCards, Wrench } from "lucide-react";

const groups = [
  { label: "Command", items: [
    { label: "Control Center", to: "/admin/control-center", icon: Activity },
    { label: "Dashboard", to: "/admin/dashboard", icon: LayoutDashboard },
  ]},
  { label: "Accounts", items: [
    { label: "All Users", to: "/admin/users", icon: Users },
    { label: "Account Verification", to: "/admin/account-verification", icon: ShieldCheck },
    { label: "KYC & Identity", to: "/admin/kyc", icon: ShieldCheck },
    { label: "Joint Account Requests", to: "/admin/joint-account-requests", icon: Handshake },
    { label: "Joint Accounts", to: "/admin/joint-accounts", icon: UserCog },
  ]},
  { label: "Finance Operations", items: [
    { label: "Deposits", to: "/admin/deposits", icon: ArrowDownToLine },
    { label: "Deposit Networks", to: "/admin/deposit-networks", icon: Network },
    { label: "Deposit Verification", to: "/admin/deposit-verification-settings", icon: ShieldCheck },
    { label: "Withdrawals", to: "/admin/withdrawals", icon: ArrowUpToLine },
    { label: "Withdrawal Fees", to: "/admin/withdrawal-fees", icon: BadgeDollarSign },
    { label: "Withdrawal Settings", to: "/admin/withdrawal-settings", icon: Settings2 },
    { label: "Profit Withdrawals", to: "/admin/profit-withdrawal-requests", icon: CircleDollarSign },
    { label: "Loans", to: "/admin/loans", icon: Landmark },
    { label: "Loan Settings", to: "/admin/loan-settings", icon: HandCoins },
  ]},
  { label: "Trading Operations", items: [
    { label: "Trading & Funds Control", to: "/admin/trading-funds-control", icon: CandlestickChart },
    { label: "Short-Term Trades", to: "/admin/trades", icon: BarChart3 },
    { label: "Short-Term Trade Rules", to: "/admin/trade-rules", icon: Settings2 },
    { label: "Spot / Long-Term Market", to: "/admin/spot-trade", icon: CandlestickChart },
    { label: "Spot / Long-Term Trading Control", to: "/admin/spots/long-term-trading", icon: SlidersHorizontal },
    { label: "Spot / Long-Term Settlement Rules", to: "/admin/spot-settlement-rules", icon: Settings2 },
    { label: "Spot / Long-Term Trade Rules", to: "/admin/spots/long-term-trade-rules", icon: Settings2 },
  ]},
  { label: "Platform", items: [
    { label: "General Settings", to: "/admin/platform-settings", icon: Settings2 },
    { label: "Support", to: "/admin/support", icon: LifeBuoy },
    { label: "News Control", to: "/admin/news", icon: Newspaper },
    { label: "Legal Documents", to: "/admin/legal-docs", icon: Scale },
    { label: "Maintenance", to: "/admin/maintenance", icon: Wrench },
  ]},
  { label: "Governance", items: [
    { label: "Audit & Compliance", to: "/admin/audit-logs", icon: FileClock },
  ]},
];

function NavItem({ item, onClose }) {
  const Icon = item.icon;
  return <NavLink to={item.to} onClick={onClose} className={({ isActive }) => `group flex items-center gap-3 rounded-xl border px-3 py-2 transition ${isActive ? "border-cyan-400/20 bg-cyan-500/10 text-cyan-300" : "border-transparent text-slate-400 hover:border-white/10 hover:bg-white/[0.04] hover:text-white"}`}><Icon size={14} className="shrink-0"/><span className="truncate text-[11px] font-semibold">{item.label}</span></NavLink>;
}

function SidebarContent({ onClose, onLogout }) {
  const location = useLocation();
  const [open, setOpen] = useState({ Command: true, Accounts: true, "Finance Operations": true, "Trading Operations": true, Platform: false, Governance: false });
  const activeGroup = useMemo(() => groups.find((group) => group.items.some((item) => location.pathname === item.to || (item.to === "/admin/users" && location.pathname.startsWith("/admin/users/"))))?.label, [location.pathname]);
  return <div className="flex h-full flex-col text-white">
    <div className="border-b border-white/10 px-4 py-3"><div className="flex items-center justify-between gap-3"><div><div className="text-[9px] font-bold uppercase tracking-[0.32em] text-cyan-300">VexaTrade</div><div className="mt-0.5 text-sm font-bold tracking-tight">Super Admin</div></div><span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-2 py-1 text-[8px] font-bold text-emerald-300">LIVE</span></div><div className="mt-2 rounded-xl border border-white/10 bg-white/[0.025] px-3 py-2"><div className="text-[8px] uppercase tracking-wider text-slate-600">Control plane</div><div className="mt-0.5 text-[10px] text-slate-400">Global platform operations</div></div></div>
    <nav className="flex-1 space-y-2 overflow-y-auto px-2.5 py-2 scrollbar-hide">{groups.map((group) => { const isOpen = open[group.label] || activeGroup === group.label; return <div key={group.label}><button type="button" onClick={() => setOpen((prev) => ({ ...prev, [group.label]: !prev[group.label] }))} className={`flex w-full items-center justify-between px-2 py-1.5 text-[8px] font-bold uppercase tracking-[0.18em] ${activeGroup === group.label ? "text-cyan-300" : "text-slate-600"}`}><span>{group.label}</span>{isOpen ? <ChevronDown size={11}/> : <ChevronRight size={11}/>}</button>{isOpen ? <div className="space-y-0.5">{group.items.map((item) => <NavItem key={item.to} item={item} onClose={onClose}/>)}</div> : null}</div>;})}</nav>
    <div className="border-t border-white/10 p-2.5"><div className="mb-2 flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.025] px-3 py-2"><div className="h-1.5 w-1.5 rounded-full bg-emerald-400"/><div><div className="text-[8px] uppercase tracking-wide text-slate-600">Session</div><div className="text-[9px] text-slate-400">Administrator authenticated</div></div></div><button type="button" onClick={onLogout} className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-[11px] font-semibold text-red-300 hover:bg-red-500/15"><LogOut size={13}/> Logout</button></div>
  </div>;
}

export default function AdminSidebar({ isOpen = false, onClose = () => {} }) {
  const navigate = useNavigate();
  const logout = () => { ["adminToken", "admin_token", "adminData", "adminUser"].forEach((key) => localStorage.removeItem(key)); navigate("/admin/login", { replace: true }); };
  return <><div className={`${isOpen ? "fixed" : "hidden"} inset-0 z-40 bg-slate-950/75 backdrop-blur-sm xl:hidden`} onClick={onClose}/><aside className={`fixed inset-y-0 left-0 z-50 w-[86vw] max-w-[300px] border-r border-white/10 bg-[#080d18] shadow-2xl transition-transform xl:hidden ${isOpen ? "translate-x-0" : "-translate-x-full"}`}><SidebarContent onClose={onClose} onLogout={logout}/></aside><aside className="hidden w-[258px] min-w-[258px] border-r border-white/10 bg-[#080d18] xl:block"><div className="sticky top-0 h-screen"><SidebarContent onClose={onClose} onLogout={logout}/></div></aside></>;
}
