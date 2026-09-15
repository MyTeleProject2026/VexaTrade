import { useEffect, useMemo, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import AdminSidebar from "../components/AdminSidebar";
import AppTopbar from "../components/AppTopbar";
import AdminMobileBottomNav from "../components/AdminMobileBottomNav";

const PAGE_META = {
  "/admin/control-center": ["Command Center", "Global operational overview and control routing."],
  "/admin/dashboard": ["Dashboard", "Platform health, activity and financial operations overview."],
  "/admin/users": ["User Management", "Account lifecycle, wallet access and user administration."],
  "/admin/kyc": ["KYC & Identity", "Identity review, verification decisions and compliance."],
  "/admin/deposits": ["Deposit Operations", "Review and process incoming deposit activity."],
  "/admin/deposit-networks": ["Deposit Networks", "Wallet addresses, QR configuration and network operations."],
  "/admin/deposit-verification-settings": ["Deposit Verification", "Verification policy and operational controls."],
  "/admin/withdrawals": ["Withdrawal Operations", "Review and process withdrawal requests."],
  "/admin/withdrawal-fees": ["Withdrawal Fees", "Network fee configuration and controls."],
  "/admin/withdrawal-settings": ["Withdrawal Settings", "Limits and withdrawal policy configuration."],
  "/admin/profit-withdrawal-requests": ["Profit Withdrawals", "Review and process profit withdrawal requests."],
  "/admin/trades": ["Trade Operations", "Monitor and operate active and historical trades."],
  "/admin/trade-rules": ["Trade Rules", "Trading timing, payout and rule configuration."],
  "/admin/trading-funds-control": ["Trading Control", "Unified trading, funds and rules operations."],
  "/admin/joint-account-requests": ["Joint Account Requests", "Review joint account applications."],
  "/admin/joint-accounts": ["Joint Accounts", "Manage active joint account relationships."],
  "/admin/loans": ["Loan Operations", "Review and operate user loan requests."],
  "/admin/loan-settings": ["Loan Settings", "Loan rate and repayment configuration."],
  "/admin/audit-logs": ["Audit & Compliance", "Administrative activity and financial audit trail."],
  "/admin/platform-settings": ["Platform Settings", "Global application and platform configuration."],
  "/admin/support": ["Support Operations", "Customer service configuration and operations."],
  "/admin/news": ["News Control", "Create and manage platform announcements."],
  "/admin/legal-docs": ["Legal Documents", "Manage platform legal content."],
  "/admin/maintenance": ["Maintenance", "Platform availability and maintenance controls."],
};

export default function AdminLayout() {
  const location = useLocation();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [title, subtitle] = useMemo(() => PAGE_META[location.pathname] || ["Super Admin", "VexaTrade platform control plane."], [location.pathname]);
  useEffect(() => setMobileSidebarOpen(false), [location.pathname]);
  useEffect(() => { if (!mobileSidebarOpen) return undefined; const previous = document.body.style.overflow; document.body.style.overflow = "hidden"; return () => { document.body.style.overflow = previous; }; }, [mobileSidebarOpen]);
  return <div className="min-h-screen bg-[#050812] text-white"><div className="flex min-h-screen"><AdminSidebar isOpen={mobileSidebarOpen} onClose={() => setMobileSidebarOpen(false)} /><div className="flex min-h-screen min-w-0 flex-1 flex-col pb-14 xl:pb-0"><AppTopbar title={title} subtitle={subtitle} onMenuClick={() => setMobileSidebarOpen(true)} admin /><main className="min-w-0 flex-1"><div className="min-h-[calc(100vh-64px)] bg-[radial-gradient(circle_at_top,rgba(6,182,212,0.07),transparent_25%),linear-gradient(180deg,#0a0e1a_0%,#050812_100%)] px-3 py-3 sm:px-5 sm:py-5 lg:px-6 xl:px-8"><div className="mx-auto w-full max-w-[1920px]"><Outlet /></div></div></main><AdminMobileBottomNav /></div></div></div>;
}
