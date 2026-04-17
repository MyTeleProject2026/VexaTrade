import { useEffect, useMemo, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import AdminSidebar from "../components/AdminSidebar";
import AppTopbar from "../components/AppTopbar";
import AdminMobileBottomNav from "../components/AdminMobileBottomNav";

const PAGE_META = {
  "/admin/dashboard": {
    title: "Dashboard",
    subtitle:
      "Monitor platform activity, users, trades, deposits, withdrawals, and loans.",
  },
  "/admin/users": {
    title: "Users",
    subtitle: "Manage user accounts, balances, and account status controls.",
  },
  "/admin/kyc": {
    title: "KYC Verification",
    subtitle:
      "Review identity documents, approve submissions, and manage verification status.",
  },
  "/admin/deposits": {
    title: "Deposits",
    subtitle: "Review deposit requests, proofs, and approval actions.",
  },
  "/admin/deposit-networks": {
    title: "Deposit Networks",
    subtitle:
      "Manage deposit wallet addresses, labels, QR codes, and network status.",
  },
  "/admin/withdrawals": {
    title: "Withdrawals",
    subtitle:
      "Track withdrawal requests, review wallet details, and process actions.",
  },
  "/admin/withdrawal-fees": {
    title: "Withdrawal Fees",
    subtitle: "Configure fee amounts and fee types by network.",
  },
  "/admin/trades": {
    title: "Trades",
    subtitle:
      "Monitor open trades, queue outcomes, and handle manual overrides.",
  },
  "/admin/trade-rules": {
    title: "Trade Rules",
    subtitle: "Adjust trading timers, payout percentages, and platform rules.",
  },
  "/admin/trading-funds-control": {
    title: "Trading Control",
    subtitle:
      "Manage trades, trade rules, funds, and funds rules from one control page.",
  },
  "/admin/audit-logs": {
    title: "Audit Logs",
    subtitle: "Track admin activity, export records, and monitor actions.",
  },
  "/admin/support": {
    title: "Support",
    subtitle:
      "Manage customer service contact details and support display settings.",
  },
  "/admin/platform-settings": {
    title: "Platform Settings",
    subtitle:
      "Control global platform settings, wallet label, fees, and support values.",
  },
  "/admin/loans": {
    title: "Loans",
    subtitle: "Review user loan requests and approve or reject applications.",
  },
  "/admin/loan-settings": {
    title: "Loan Settings",
    subtitle:
      "Manage loan interest rate and repayment cycle for user loan requests.",
  },
  "/admin/legal-docs": {
    title: "Legal Documents",
    subtitle:
      "Manage platform legal documents shown inside the user profile section.",
  },
  "/admin/news": {
    title: "News Control",
    subtitle: "Create and manage platform news and announcements.",
  },
  "/admin/joint-account-requests": {
    title: "Joint Account Requests",
    subtitle: "Review and approve or reject joint account requests.",
  },
  "/admin/joint-accounts": {
    title: "Joint Accounts",
    subtitle: "View and manage all active joint accounts.",
  },
};

export default function AdminLayout() {
  const location = useLocation();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const pageMeta = useMemo(() => {
    return (
      PAGE_META[location.pathname] || {
        title: "Admin Panel",
        subtitle: "Manage platform operations from the control panel.",
      }
    );
  }, [location.pathname]);

  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!mobileSidebarOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [mobileSidebarOpen]);

  return (
    <div className="min-h-screen bg-[#050812] text-white">
      <div className="flex min-h-screen">
        <AdminSidebar
          isOpen={mobileSidebarOpen}
          onClose={() => setMobileSidebarOpen(false)}
        />

        <div className="flex min-h-screen min-w-0 flex-1 flex-col pb-16 xl:pb-0">
          <AppTopbar
            title={pageMeta.title}
            subtitle={pageMeta.subtitle}
            onMenuClick={() => setMobileSidebarOpen(true)}
            admin
          />

          <main className="min-w-0 flex-1">
            <div className="min-h-[calc(100vh-73px)] bg-[radial-gradient(circle_at_top,rgba(6,182,212,0.08),transparent_24%),linear-gradient(180deg,#0a0e1a_0%,#050812_100%)] px-4 py-4 sm:px-5 sm:py-5 lg:px-6 lg:py-6 xl:px-8">
              <div className="mx-auto w-full max-w-[1800px]">
                <Outlet />
              </div>
            </div>
          </main>

          {/* Mobile Bottom Navigation */}
          <AdminMobileBottomNav />
        </div>
      </div>
    </div>
  );
}