import { NavLink, useNavigate } from "react-router-dom";
import { useState } from "react";
import {
  LayoutDashboard,
  Users,
  ShieldCheck,
  ArrowDownToLine,
  Network,
  ArrowUpToLine,
  BadgeDollarSign,
  CandlestickChart,
  SlidersHorizontal,
  FileClock,
  LifeBuoy,
  Settings2,
  Landmark,
  HandCoins,
  Scale,
  Newspaper,
  LogOut,
  Handshake,
  ChevronDown,
  ChevronRight,
  Wallet,
  BellRing,
  FileText,
} from "lucide-react";

const navItems = [
  { label: "Dashboard", to: "/admin/dashboard", icon: LayoutDashboard },
  {
    label: "Users",
    icon: Users,
    children: [
      { label: "All Users", to: "/admin/users", icon: Users },
      { label: "KYC Verification", to: "/admin/kyc", icon: ShieldCheck },
      { label: "Joint Account Requests", to: "/admin/joint-account-requests", icon: Handshake },
      { label: "Joint Accounts", to: "/admin/joint-accounts", icon: Users },
      { label: "Deposits", to: "/admin/deposits", icon: ArrowDownToLine },
      { label: "Deposit Networks", to: "/admin/deposit-networks", icon: Network },
      { label: "Withdrawals", to: "/admin/withdrawals", icon: ArrowUpToLine },
      { label: "Withdrawal Fees", to: "/admin/withdrawal-fees", icon: BadgeDollarSign },
      { label: "Loans", to: "/admin/loans", icon: Landmark },
      { label: "Loan Settings", to: "/admin/loan-settings", icon: HandCoins },
    ],
  },
  { label: "Trading Control", to: "/admin/trading-funds-control", icon: CandlestickChart },
  { label: "Audit Logs", to: "/admin/audit-logs", icon: FileClock },
  {
    label: "Platform Settings",
    icon: Settings2,
    children: [
      { label: "General Settings", to: "/admin/platform-settings", icon: Settings2 },
      { label: "Support", to: "/admin/support", icon: LifeBuoy },
      { label: "News Control", to: "/admin/news", icon: Newspaper },
      { label: "Legal Documents", to: "/admin/legal-docs", icon: Scale },
    ],
  },
];

function MenuItem({ icon: Icon, label, onClick, active = false, hasChildren = false, isOpen = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left transition ${
        active
          ? "border border-cyan-500/25 bg-cyan-500/10 text-cyan-300"
          : "text-white hover:bg-white/5"
      }`}
    >
      <div className="flex items-center gap-3">
        <Icon size={20} className={active ? "text-cyan-300" : "text-slate-400"} />
        <span className="text-[16px]">{label}</span>
      </div>
      {hasChildren && (
        isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />
      )}
    </button>
  );
}

function SidebarContent({ onClose, onLogout }) {
  const [openMenus, setOpenMenus] = useState({});
  const location = window.location.pathname;

  const toggleMenu = (label) => {
    setOpenMenus((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  const isChildActive = (children) => {
    return children?.some((child) => location === child.to);
  };

  return (
    <div className="flex h-full flex-col text-white">
      <div className="border-b border-white/10 px-5 py-5 sm:px-6 sm:py-6">
        <div className="flex items-start justify-between gap-3 xl:block">
          <div>
            <div className="text-[11px] uppercase tracking-[0.35em] text-violet-300">
              CryptoPulse
            </div>
            <h1 className="mt-2 text-xl font-bold sm:text-2xl">
              Admin Control Panel
            </h1>
            <p className="mt-2 text-sm text-slate-400">
              Professional platform control center
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-white/5 xl:hidden"
          >
            Close
          </button>
        </div>
      </div>

      <div className="px-4 pt-4">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
          <div className="text-[11px] uppercase tracking-wide text-slate-500">
            Navigation
          </div>
          <div className="mt-1 text-sm text-slate-300">
            Admin tools and platform controls
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-2 overflow-y-auto px-4 py-4">
        {navItems.map((item) => {
          const Icon = item.icon;
          const hasChildren = item.children && item.children.length > 0;
          const isOpen = openMenus[item.label];
          const isActive = !hasChildren && location === item.to;
          const isParentActive = hasChildren && isChildActive(item.children);

          if (hasChildren) {
            return (
              <div key={item.label} className="space-y-1">
                <MenuItem
                  icon={Icon}
                  label={item.label}
                  onClick={() => toggleMenu(item.label)}
                  active={isParentActive}
                  hasChildren={true}
                  isOpen={isOpen}
                />
                {isOpen && (
                  <div className="ml-6 space-y-1 border-l border-white/10 pl-3">
                    {item.children.map((child) => {
                      const ChildIcon = child.icon;
                      const childActive = location === child.to;
                      return (
                        <NavLink
                          key={child.to}
                          to={child.to}
                          onClick={onClose}
                          className={({ isActive: navActive }) =>
                            `block rounded-xl px-4 py-2 text-sm transition ${
                              navActive || childActive
                                ? "bg-cyan-500/10 text-cyan-300"
                                : "text-slate-300 hover:bg-white/5"
                            }`
                          }
                        >
                          <div className="flex items-center gap-3">
                            <ChildIcon size={16} />
                            <span>{child.label}</span>
                          </div>
                        </NavLink>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }

          return (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onClose}
              className={({ isActive: navActive }) =>
                `block rounded-2xl px-4 py-3 text-sm font-medium transition ${
                  navActive || isActive
                    ? "border border-cyan-500/25 bg-cyan-500/15 text-cyan-200 shadow-[0_8px_24px_rgba(124,58,237,0.12)]"
                    : "border-transparent text-slate-300 hover:border-white/10 hover:bg-white/[0.04] hover:text-white"
                }`
              }
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <Icon size={17} className="shrink-0" />
                  <span className="truncate">{item.label}</span>
                </div>
                <span className="text-xs text-slate-500 transition group-hover:text-slate-300">
                  →
                </span>
              </div>
            </NavLink>
          );
        })}
      </nav>

      <div className="border-t border-white/10 p-4">
        <div className="mb-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
          <div className="text-[11px] uppercase tracking-wide text-slate-500">
            Session
          </div>
          <div className="mt-1 text-sm text-slate-300">
            Secure admin access is active
          </div>
        </div>

        <button
          type="button"
          onClick={onLogout}
          className="w-full rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-300 transition hover:bg-red-500/20"
        >
          <span className="inline-flex items-center gap-2">
            <LogOut size={16} />
            Logout
          </span>
        </button>
      </div>
    </div>
  );
}

export default function AdminSidebar({
  isOpen = false,
  onClose = () => {},
}) {
  const navigate = useNavigate();

  function handleLogout() {
    localStorage.removeItem("adminToken");
    localStorage.removeItem("adminData");
    localStorage.removeItem("adminUser");
    localStorage.removeItem("admin_token");
    navigate("/admin/login");
  }

  return (
    <>
      {isOpen ? (
        <button
          type="button"
          aria-label="Close sidebar overlay"
          onClick={onClose}
          className="fixed inset-0 z-40 bg-slate-950/70 backdrop-blur-[2px] xl:hidden"
        />
      ) : null}

      <aside
        className={[
          "fixed inset-y-0 left-0 z-50 w-[88vw] max-w-[320px] border-r border-white/10 bg-slate-950/95 shadow-2xl backdrop-blur",
          "transition-transform duration-300 xl:hidden",
          isOpen ? "translate-x-0" : "-translate-x-full",
        ].join(" ")}
      >
        <SidebarContent onClose={onClose} onLogout={handleLogout} />
      </aside>

      <aside className="hidden xl:block xl:w-80 xl:min-w-80 xl:border-r xl:border-white/10 xl:bg-slate-950">
        <div className="sticky top-0 h-screen">
          <SidebarContent onClose={onClose} onLogout={handleLogout} />
        </div>
      </aside>
    </>
  );
}