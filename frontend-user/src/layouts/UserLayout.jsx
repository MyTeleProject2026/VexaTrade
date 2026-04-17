import { useEffect, useMemo, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, Bell, Menu, Wallet } from "lucide-react";
import UserSidebar from "../components/UserSidebar";
import MobileBottomNav from "../components/MobileBottomNav";

const PAGE_META = {
  "/dashboard": {
    title: "VexaTrade",
    subtitle: "Overview of your account and market activity",
  },
  "/assets": {
    title: "Assets",
    subtitle: "Wallet balance, funding, and asset records",
  },
  "/trade": {
    title: "Trade",
    subtitle: "Short-term trading smart tools and order management",
  },
  "/funds": {
    title: "Funds",
    subtitle: "Active funds, profits, and completed returns",
  },
  "/convert": {
    title: "Convert",
    subtitle: "Exchange supported assets",
  },
  "/transactions": {
    title: "Activity",
    subtitle: "Alerts, updates, deposits, withdrawals, fund updates, and trade history",
  },
  "/profile": {
    title: "Profile",
    subtitle: "Account information, shortcuts, and controls",
  },
  "/profile/user-center": {
    title: "User Center",
    subtitle: "Profile, security, and preference settings",
  },
  "/loan": {
    title: "Loan",
    subtitle: "Loan request and repayment preview",
  },
  "/legal-documents": {
    title: "Legal Documents",
    subtitle: "Policies, notices, and platform documents",
  },
  "/deposit": {
    title: "Deposit",
    subtitle: "Wallet address, receipt upload, and deposit history",
  },
  "/withdraw": {
    title: "Withdraw",
    subtitle: "Withdraw funds to your wallet",
  },
  "/kyc": {
    title: "Identity Verification",
    subtitle: "Submit and track your KYC verification",
  },
  "/support": {
    title: "Customer Support",
    subtitle: "Get help and contact support",
  },
};

function getPageMeta(pathname) {
  if (PAGE_META[pathname]) return PAGE_META[pathname];
  if (pathname.startsWith("/profile/user-center")) return PAGE_META["/profile/user-center"];
  if (pathname.startsWith("/profile")) return PAGE_META["/profile"];
  if (pathname.startsWith("/deposit")) return PAGE_META["/deposit"];
  if (pathname.startsWith("/withdraw")) return PAGE_META["/withdraw"];
  if (pathname.startsWith("/loan")) return PAGE_META["/loan"];
  if (pathname.startsWith("/legal-documents")) return PAGE_META["/legal-documents"];
  if (pathname.startsWith("/transactions")) return PAGE_META["/transactions"];
  if (pathname.startsWith("/convert")) return PAGE_META["/convert"];
  if (pathname.startsWith("/kyc")) return PAGE_META["/kyc"];
  if (pathname.startsWith("/assets")) return PAGE_META["/assets"];
  if (pathname.startsWith("/trade")) return PAGE_META["/trade"];
  if (pathname.startsWith("/funds")) return PAGE_META["/funds"];
  if (pathname.startsWith("/support")) return PAGE_META["/support"];

  return {
    title: "VexaTrade",
    subtitle: "Overview of your account and market activity",
  };
}

function shouldShowBackButton(pathname) {
  return [
    "/deposit",
    "/withdraw",
    "/kyc",
    "/convert",
    "/transactions",
    "/profile/user-center",
    "/loan",
    "/legal-documents",
    "/support",
  ].some((route) => pathname.startsWith(route));
}

export default function UserLayout() {
  const location = useLocation();
  const navigate = useNavigate();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);

  const pageMeta = useMemo(() => getPageMeta(location.pathname), [location.pathname]);
  const showBackButton = shouldShowBackButton(location.pathname);

  // Prevent body scroll when sidebar is open
  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [sidebarOpen]);

  // Close sidebar on route change
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  // Load unread notifications count
  useEffect(() => {
    let ignore = false;

    async function loadUnreadStatus() {
      try {
        const token =
          localStorage.getItem("userToken") ||
          localStorage.getItem("token") ||
          localStorage.getItem("accessToken") ||
          "";

        if (!token) {
          if (!ignore) setHasUnread(false);
          return;
        }

        const baseUrl =
          import.meta.env.VITE_API_BASE_URL || "https://cryptopulse-4rhe.onrender.com";

        const res = await fetch(`${baseUrl}/api/user/notifications`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) {
          if (!ignore) setHasUnread(false);
          return;
        }

        const json = await res.json();
        const list = Array.isArray(json?.data) ? json.data : [];
        const unread = list.some((item) => !Number(item?.is_read));

        if (!ignore) setHasUnread(unread);
      } catch {
        if (!ignore) setHasUnread(false);
      }
    }

    loadUnreadStatus();

    const interval = setInterval(loadUnreadStatus, 15000);

    return () => {
      ignore = true;
      clearInterval(interval);
    };
  }, [location.pathname]);

  function handleBack() {
    if (
      location.pathname === "/deposit" ||
      location.pathname === "/withdraw" ||
      location.pathname === "/convert" ||
      location.pathname === "/transactions"
    ) {
      navigate("/assets");
      return;
    }

    if (location.pathname === "/notifications") {
      navigate("/dashboard");
      return;
    }

    if (location.pathname === "/profile/user-center") {
      navigate("/profile");
      return;
    }

    if (
      location.pathname === "/loan" ||
      location.pathname === "/legal-documents" ||
      location.pathname === "/kyc" ||
      location.pathname === "/support"
    ) {
      navigate("/profile");
      return;
    }

    navigate(-1);
  }

  function openWallet() {
    navigate("/assets");
  }

  function openNotifications() {
    navigate("/transactions");
  }

  return (
    <div className="min-h-screen bg-[#050812] text-white">
      <div className="flex min-h-screen">
        {/* Desktop Sidebar */}
        <aside className="hidden md:block md:shrink-0">
          <div className="h-screen sticky top-0">
            <UserSidebar />
          </div>
        </aside>

        {/* Mobile Sidebar Overlay */}
        {sidebarOpen && (
          <div className="fixed inset-0 z-50 flex md:hidden">
            <button
              type="button"
              className="flex-1 bg-black/60 backdrop-blur-sm"
              onClick={() => setSidebarOpen(false)}
              aria-label="Close sidebar"
            />
            <div className="h-full w-[85%] max-w-sm border-l border-white/10 bg-[#0a0e1a] shadow-2xl overflow-y-auto">
              <UserSidebar
                onNavigate={() => setSidebarOpen(false)}
                onClose={() => setSidebarOpen(false)}
                showClose={true}
              />
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Header */}
          <header className="sticky top-0 z-30 border-b border-white/10 bg-[#0a0e1a]/95 backdrop-blur-xl safe-top">
            <div className="flex items-center justify-between px-4 py-3">
              <div className="flex min-w-0 items-center gap-3">
                {showBackButton ? (
                  <button
                    type="button"
                    onClick={handleBack}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/5 text-white"
                    aria-label="Go back"
                  >
                    <ArrowLeft size={18} />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setSidebarOpen(true)}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/5 text-white md:hidden"
                    aria-label="Open menu"
                  >
                    <Menu size={18} />
                  </button>
                )}

                <div className="min-w-0 flex-1">
                  <div className="truncate text-base font-semibold text-white sm:text-lg">
                    {pageMeta.title}
                  </div>
                  <div className="truncate text-xs text-gray-400">
                    {pageMeta.subtitle}
                  </div>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={openWallet}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-white/5 text-white sm:h-10 sm:w-10"
                  aria-label="Wallet"
                >
                  <Wallet size={16} className="sm:h-[18px] sm:w-[18px]" />
                </button>

                <button
                  type="button"
                  onClick={openNotifications}
                  className="relative flex h-9 w-9 items-center justify-center rounded-full bg-white/5 text-white sm:h-10 sm:w-10"
                  aria-label="Notifications"
                >
                  <Bell size={16} className="sm:h-[18px] sm:w-[18px]" />
                  {hasUnread && (
                    <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500" />
                  )}
                </button>
              </div>
            </div>
          </header>

          {/* Page Content */}
          <main className="flex-1 overflow-y-auto pb-20 md:pb-6">
            <Outlet />
          </main>

          {/* Mobile Bottom Navigation */}
          <div className="md:hidden safe-bottom">
            <MobileBottomNav />
          </div>
        </div>
      </div>
    </div>
  );
}