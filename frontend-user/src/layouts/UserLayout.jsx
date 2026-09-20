// frontend-user/src/layouts/UserLayout.jsx
import { useEffect, useMemo, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, Bell, Menu, Wallet } from "lucide-react";
import UserSidebar from "../components/UserSidebar";
import MobileBottomNav from "../components/MobileBottomNav";
import TradeTopNavBar from "../components/TradeTopNavBar";
import PasscodeLockScreen from "../components/PasscodeLockScreen";
import { userApi } from "../services/api";

const PAGE_META = {
  "/dashboard": { title: "VexaTrade", subtitle: "Overview of your account and market activity" },
  "/assets": { title: "Assets", subtitle: "Wallet balance, funding, and asset records" },
  "/trade": { title: "Trade", subtitle: "Short-Term and Spot / Long-Term trading" },
  "/funds": { title: "Funds", subtitle: "Active funds, profits, and completed returns" },
  "/convert": { title: "Convert", subtitle: "Exchange supported assets" },
  "/transactions": { title: "Activity", subtitle: "Alerts, updates, deposits, withdrawals, fund updates, and trade history" },
  "/profile": { title: "Profile", subtitle: "Account information, shortcuts, and controls" },
  "/profile/user-center": { title: "User Center", subtitle: "Profile, security, and preference settings" },
  "/loan": { title: "Loan", subtitle: "Loan request and repayment preview" },
  "/legal-documents": { title: "Legal Documents", subtitle: "Policies, notices, and platform documents" },
  "/deposit": { title: "Deposit", subtitle: "Wallet address, receipt upload, and deposit history" },
  "/withdraw": { title: "Withdraw", subtitle: "Withdraw funds to your wallet" },
  "/kyc": { title: "Identity Verification", subtitle: "Submit and track your KYC verification" },
  "/support": { title: "Customer Support", subtitle: "Get help and contact support" },
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
  return { title: "VexaTrade", subtitle: "Overview of your account and market activity" };
}

function shouldShowBackButton(pathname) {
  const nestedRoutes = ["/funds/", "/assets/", "/profile/", "/deposit/", "/withdraw/", "/transactions/", "/loan/", "/legal-documents/", "/support/", "/convert/", "/kyc/"];
  return ["/deposit", "/withdraw", "/kyc", "/convert", "/transactions", "/profile/user-center", "/loan", "/legal-documents", "/support"].some((route) => pathname.startsWith(route)) ||
    nestedRoutes.some((route) => pathname.startsWith(route));
}

function getStoredToken() {
  return localStorage.getItem("userToken") || localStorage.getItem("token") || localStorage.getItem("accessToken") || "";
}

export default function UserLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);
  const [isPasscodeLocked, setIsPasscodeLocked] = useState(false);
  const [checkingPasscode, setCheckingPasscode] = useState(true);
  const pageMeta = useMemo(() => getPageMeta(location.pathname), [location.pathname]);
  const showBackButton = shouldShowBackButton(location.pathname);

  useEffect(() => {
    const checkPasscode = async () => {
      try {
        setCheckingPasscode(true);
        const token = getStoredToken();
        if (!token) { setIsPasscodeLocked(false); setCheckingPasscode(false); return; }
        const isVerified = sessionStorage.getItem("VexaTrade_passcode_verified");
        if (isVerified === "1") { setIsPasscodeLocked(false); setCheckingPasscode(false); return; }
        const res = await userApi.securityStatus(token);
        const hasPasscode = res?.data?.data?.hasPasscode || false;
        setIsPasscodeLocked(Boolean(hasPasscode));
      } catch (error) {
        console.error("❌ Passcode check error:", error);
        setIsPasscodeLocked(false);
      } finally { setCheckingPasscode(false); }
    };
    checkPasscode();
  }, []);

  useEffect(() => {
    if (sidebarOpen) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [sidebarOpen]);

  useEffect(() => { setSidebarOpen(false); }, [location.pathname]);

  useEffect(() => {
    let ignore = false;
    let inFlight = false;
    let interval;
    let timeoutId;

    async function loadUnreadStatus() {
      if (inFlight) return;
      const token = getStoredToken();
      if (!token) { if (!ignore) setHasUnread(false); return; }
      inFlight = true;
      const controller = new AbortController();
      try {
        const baseUrl = import.meta.env.VITE_API_BASE_URL || "https://vexatrade-5ycu.onrender.com";
        timeoutId = window.setTimeout(() => controller.abort(), 8000);
        const res = await fetch(`${baseUrl}/api/user/notifications`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
          signal: controller.signal,
        });
        if (!res.ok) return;
        const json = await res.json();
        const list = Array.isArray(json?.data) ? json.data : [];
        if (!ignore) setHasUnread(list.some((item) => !Number(item?.is_read)));
      } catch (error) {
        if (!ignore && error?.name !== "AbortError") console.error("Notification status check failed:", error);
      } finally {
        if (timeoutId) window.clearTimeout(timeoutId);
        timeoutId = null;
        inFlight = false;
      }
    }

    loadUnreadStatus();
    interval = window.setInterval(loadUnreadStatus, 30000);
    return () => {
      ignore = true;
      if (timeoutId) window.clearTimeout(timeoutId);
      if (interval) window.clearInterval(interval);
    };
  }, [location.pathname]);

  function handleBack() {
    if (location.pathname === "/deposit" || location.pathname === "/withdraw" || location.pathname === "/convert" || location.pathname === "/transactions") { navigate("/assets"); return; }
    if (location.pathname === "/notifications") { navigate("/dashboard"); return; }
    if (location.pathname === "/profile/user-center") { navigate("/profile"); return; }
    if (location.pathname === "/loan" || location.pathname === "/legal-documents" || location.pathname === "/kyc" || location.pathname === "/support") { navigate("/profile"); return; }
    if (location.pathname.startsWith("/funds/")) { navigate("/funds"); return; }
    if (location.pathname.startsWith("/assets/")) { navigate("/assets"); return; }
    if (location.pathname.startsWith("/profile/")) { navigate("/profile"); return; }
    if (location.pathname.startsWith("/deposit/")) { navigate("/deposit"); return; }
    if (location.pathname.startsWith("/withdraw/")) { navigate("/withdraw"); return; }
    if (location.pathname.startsWith("/transactions/")) { navigate("/transactions"); return; }
    if (location.pathname.startsWith("/convert/")) { navigate("/convert"); return; }
    if (location.pathname.startsWith("/kyc/")) { navigate("/kyc"); return; }
    navigate(-1);
  }

  function openWallet() { navigate("/assets"); }
  function openNotifications() { navigate("/transactions"); }
  const handlePasscodeUnlock = () => {
    setIsPasscodeLocked(false);
    sessionStorage.setItem("VexaTrade_passcode_verified", "1");
  };

  if (checkingPasscode) {
    return (
      <div className="min-h-screen bg-[#050812] flex items-center justify-center">
        <div className="animate-pulse text-cyan-400">Loading...</div>
      </div>
    );
  }

  if (isPasscodeLocked) return <PasscodeLockScreen onUnlock={handlePasscodeUnlock} />;

  return (
    <div className="vexa-app-shell min-h-screen bg-[#050812] text-white">
      <div className="flex min-h-0 min-h-screen">
        <aside className="hidden md:block md:shrink-0">
          <div className="h-screen sticky top-0"><UserSidebar /></div>
        </aside>

        {sidebarOpen && (
          <div className="fixed inset-0 z-50 flex md:hidden">
            <button type="button" className="flex-1 bg-black/60 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} aria-label="Close sidebar" />
            <div className="h-full w-[85%] max-w-sm border-l border-white/10 bg-[#0a0e1a] shadow-2xl overflow-y-auto">
              <UserSidebar onNavigate={() => setSidebarOpen(false)} onClose={() => setSidebarOpen(false)} showClose={true} />
            </div>
          </div>
        )}

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <header className="vexa-topbar sticky top-0 z-30 border-b border-white/10 bg-[#0a0e1a]/95 backdrop-blur-xl safe-top">
            <div className="flex items-center justify-between px-4 py-3">
              <div className="flex min-w-0 items-center gap-3">
                {showBackButton ? (
                  <button type="button" onClick={handleBack} className="group flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.045] text-white shadow-inner shadow-white/[0.03] transition hover:border-cyan-300/25 hover:bg-cyan-300/10 hover:text-cyan-200 active:scale-[0.97]" aria-label="Go back"><ArrowLeft size={18} className="transition-transform group-hover:-translate-x-0.5" /></button>
                ) : (
                  <button type="button" onClick={() => setSidebarOpen(true)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/5 text-white md:hidden" aria-label="Open menu"><Menu size={18} /></button>
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-base font-semibold text-white sm:text-lg">{pageMeta.title}</div>
                  <div className="truncate text-xs text-gray-400">{pageMeta.subtitle}</div>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button type="button" onClick={openWallet} className="flex h-9 w-9 items-center justify-center rounded-full bg-white/5 text-white sm:h-10 sm:w-10" aria-label="Wallet"><Wallet size={16} className="sm:h-[18px] sm:w-[18px]" /></button>
                <button type="button" onClick={openNotifications} className="relative flex h-9 w-9 items-center justify-center rounded-full bg-white/5 text-white sm:h-10 sm:w-10" aria-label="Notifications">
                  <Bell size={16} className="sm:h-[18px] sm:w-[18px]" />
                  {hasUnread && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500" />}
                </button>
              </div>
            </div>
          </header>

          <main className="vexa-scroll-shell min-h-0 flex-1 overflow-y-auto overscroll-y-auto pb-32 md:pb-8"><TradeTopNavBar /><div className="mx-auto w-full max-w-[1600px] min-w-0"><Outlet /></div></main>
          <div className="md:hidden"><MobileBottomNav /></div>
        </div>
      </div>
    </div>
  );
}
