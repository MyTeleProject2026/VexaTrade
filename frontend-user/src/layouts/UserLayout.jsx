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
    title: "Notifications and transaction history",
    subtitle: "Alerts, updates, deposits, withdrawals, fund updates, and trade history",
  },
  "/notifications": {
    title: "Notifications",
    subtitle: "Alerts, messages, and updates",
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
  if (pathname.startsWith("/notifications")) return PAGE_META["/notifications"];
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
    "/notifications",
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

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!sidebarOpen) return;

    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = oldOverflow;
    };
  }, [sidebarOpen]);

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
          import.meta.env.VITE_API_BASE_URL || "https://VexaTrade-4rhe.onrender.com";

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
        <aside className="hidden md:block md:shrink-0">
          <div className="h-screen">
            <UserSidebar />
          </div>
        </aside>

        {sidebarOpen ? (
          <div className="fixed inset-0 z-50 flex md:hidden">
            <button
              type="button"
              className="flex-1 bg-[#050812]/60 backdrop-blur-sm"
              onClick={() => setSidebarOpen(false)}
            />
            <div className="h-full w-[85%] max-w-sm border-l border-white/10 bg-[#0a0e1a] shadow-2xl">
              <UserSidebar
                onNavigate={() => setSidebarOpen(false)}
                onClose={() => setSidebarOpen(false)}
                showClose={true}
              />
            </div>
          </div>
        ) : null}

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 border-b border-white/10 bg-[#0a0e1a]/95 backdrop-blur-xl">
            <div className="flex items-center justify-between px-4 py-3">
              <div className="flex min-w-0 items-center gap-3">
                {showBackButton ? (
                  <button
                    type="button"
                    onClick={handleBack}
                    className="flex h-11 w-11 items-center justify-center rounded-full bg-white/5 text-white"
                  >
                    <ArrowLeft size={20} />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setSidebarOpen(true)}
                    className="flex h-11 w-11 items-center justify-center rounded-full bg-white/5 text-white md:hidden"
                  >
                    <Menu size={20} />
                  </button>
                )}

                <div className="min-w-0">
                  <div className="truncate font-semibold text-white">
                    {pageMeta.title}
                  </div>
                  <div className="truncate text-xs text-gray-400">
                    {pageMeta.subtitle}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={openWallet}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5 text-white"
                >
                  <Wallet size={18} />
                </button>

                <button
                  type="button"
                  onClick={openNotifications}
                  className="relative flex h-10 w-10 items-center justify-center rounded-full bg-white/5 text-white"
                >
                  <Bell size={18} />
                  {hasUnread ? (
                    <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500" />
                  ) : null}
                </button>
              </div>
            </div>
          </header>

          <main className="flex-1 overflow-y-auto pb-24 md:pb-6">
            <Outlet />
          </main>

          <div className="md:hidden">
            <MobileBottomNav />
          </div>
        </div>
      </div>
    </div>
  );
}