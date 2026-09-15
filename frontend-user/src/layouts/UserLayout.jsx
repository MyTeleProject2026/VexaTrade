// frontend-user/src/layouts/UserLayout.jsx
import { useEffect, useMemo, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, Bell, Menu, Wallet, CheckCircle2, AlertCircle, RefreshCw } from "lucide-react";
import UserSidebar from "../components/UserSidebar";
import MobileBottomNav from "../components/MobileBottomNav";
import PasscodeLockScreen from "../components/PasscodeLockScreen";
import { userApi } from "../services/api";
import { bootstrapVexaTradePlatform } from "../services/platformBootstrap";

const PAGE_META = {
  "/dashboard": { title: "VexaTrade", subtitle: "Overview of your account and market activity" },
  "/assets": { title: "Assets", subtitle: "Wallet balance, funding, and asset records" },
  "/trade": { title: "Trade", subtitle: "Short-term trading smart tools and order management" },
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
  return PAGE_META["/dashboard"];
}

function shouldShowBackButton(pathname) {
  return ["/deposit", "/withdraw", "/kyc", "/convert", "/transactions", "/profile/user-center", "/loan", "/legal-documents", "/support"].some((route) => pathname.startsWith(route));
}

function getStoredToken() {
  return localStorage.getItem("userToken") || localStorage.getItem("token") || localStorage.getItem("accessToken") || "";
}

function BootstrapStatus({ steps, done }) {
  if (done) return null;
  const completed = steps.length;
  const successful = steps.filter((step) => step.status === "success").length;
  const failed = steps.filter((step) => step.status === "error").length;
  return (
    <div className="border-b border-white/10 bg-[#081223]/95 px-4 py-2 text-[11px] text-slate-300">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
        <span className="inline-flex items-center gap-2"><RefreshCw size={12} className="animate-spin text-cyan-300" />Preparing VexaTrade workspace</span>
        <span className="whitespace-nowrap text-slate-500">{completed}/4 complete · {successful} OK{failed ? ` · ${failed} failed` : ""}</span>
      </div>
    </div>
  );
}

export default function UserLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);
  const [isPasscodeLocked, setIsPasscodeLocked] = useState(false);
  const [checkingPasscode, setCheckingPasscode] = useState(true);
  const [bootstrapDone, setBootstrapDone] = useState(false);
  const [bootstrapSteps, setBootstrapSteps] = useState([]);

  const pageMeta = useMemo(() => getPageMeta(location.pathname), [location.pathname]);
  const showBackButton = shouldShowBackButton(location.pathname);

  useEffect(() => {
    let cancelled = false;
    async function checkPasscode() {
      try {
        setCheckingPasscode(true);
        const token = getStoredToken();
        if (!token) { if (!cancelled) setIsPasscodeLocked(false); return; }
        if (sessionStorage.getItem("VexaTrade_passcode_verified") === "1") { if (!cancelled) setIsPasscodeLocked(false); return; }
        const res = await userApi.securityStatus(token);
        if (!cancelled) setIsPasscodeLocked(Boolean(res?.data?.data?.hasPasscode));
      } catch (error) {
        console.error("Passcode check error:", error);
        if (!cancelled) setIsPasscodeLocked(false);
      } finally {
        if (!cancelled) setCheckingPasscode(false);
      }
    }
    checkPasscode();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (checkingPasscode || isPasscodeLocked) return undefined;
    let cancelled = false;
    const token = getStoredToken();
    if (!token) { setBootstrapDone(true); return undefined; }
    setBootstrapDone(false);
    bootstrapVexaTradePlatform(token, {
      onStep: (_step, allSteps) => { if (!cancelled) setBootstrapSteps(allSteps); },
    }).then((result) => {
      if (!cancelled) { setBootstrapSteps(result.steps || []); setBootstrapDone(true); }
    }).catch((error) => {
      console.error("VexaTrade platform bootstrap failed:", error);
      if (!cancelled) setBootstrapDone(true);
    });
    return () => { cancelled = true; };
  }, [checkingPasscode, isPasscodeLocked]);

  useEffect(() => {
    if (sidebarOpen) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [sidebarOpen]);

  useEffect(() => { setSidebarOpen(false); }, [location.pathname]);

  // One initial unread-state request. NotificationBell owns live notification
  // refreshes; UserLayout must not create a second polling loop.
  useEffect(() => {
    let cancelled = false;
    async function loadUnreadStatus() {
      try {
        const token = getStoredToken();
        if (!token) { if (!cancelled) setHasUnread(false); return; }
        const res = await userApi.getNotifications(token);
        const list = Array.isArray(res?.data?.data) ? res.data.data : [];
        if (!cancelled) setHasUnread(list.some((item) => !Number(item?.is_read)));
      } catch {
        if (!cancelled) setHasUnread(false);
      }
    }
    loadUnreadStatus();
    return () => { cancelled = true; };
  }, []);

  function handleBack() {
    if (["/deposit", "/withdraw", "/convert", "/transactions"].includes(location.pathname)) { navigate("/assets"); return; }
    if (location.pathname === "/notifications") { navigate("/dashboard"); return; }
    if (location.pathname === "/profile/user-center") { navigate("/profile"); return; }
    if (["/loan", "/legal-documents", "/kyc", "/support"].includes(location.pathname)) { navigate("/profile"); return; }
    navigate(-1);
  }

  function openWallet() { navigate("/assets"); }
  function openNotifications() { navigate("/transactions"); }
  function handlePasscodeUnlock() {
    setIsPasscodeLocked(false);
    sessionStorage.setItem("VexaTrade_passcode_verified", "1");
  }

  if (checkingPasscode) return <div className="flex min-h-screen items-center justify-center bg-[#050812]"><div className="animate-pulse text-cyan-400">Loading...</div></div>;
  if (isPasscodeLocked) return <PasscodeLockScreen onUnlock={handlePasscodeUnlock} />;

  return (
    <div className="min-h-screen bg-[#050812] text-white">
      <div className="flex min-h-screen">
        <aside className="hidden md:block md:shrink-0"><div className="sticky top-0 h-screen"><UserSidebar /></div></aside>

        {sidebarOpen && <div className="fixed inset-0 z-50 flex md:hidden"><button type="button" className="flex-1 bg-black/60 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} aria-label="Close sidebar" /><div className="h-full w-[85%] max-w-sm overflow-y-auto border-l border-white/10 bg-[#0a0e1a] shadow-2xl"><UserSidebar onNavigate={() => setSidebarOpen(false)} onClose={() => setSidebarOpen(false)} showClose={true} /></div></div>}

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 border-b border-white/10 bg-[#0a0e1a]/95 backdrop-blur-xl safe-top">
            <div className="flex items-center justify-between px-4 py-3">
              <div className="flex min-w-0 items-center gap-3">
                {showBackButton ? <button type="button" onClick={handleBack} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/5 text-white" aria-label="Go back"><ArrowLeft size={18} /></button> : <button type="button" onClick={() => setSidebarOpen(true)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/5 text-white md:hidden" aria-label="Open menu"><Menu size={18} /></button>}
                <div className="min-w-0 flex-1"><div className="truncate text-base font-semibold text-white sm:text-lg">{pageMeta.title}</div><div className="truncate text-xs text-gray-400">{pageMeta.subtitle}</div></div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button type="button" onClick={openWallet} className="flex h-9 w-9 items-center justify-center rounded-full bg-white/5 text-white sm:h-10 sm:w-10" aria-label="Wallet"><Wallet size={16} className="sm:h-[18px] sm:w-[18px]" /></button>
                <button type="button" onClick={openNotifications} className="relative flex h-9 w-9 items-center justify-center rounded-full bg-white/5 text-white sm:h-10 sm:w-10" aria-label="Notifications"><Bell size={16} className="sm:h-[18px] sm:w-[18px]" />{hasUnread && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500" />}</button>
              </div>
            </div>
          </header>

          <BootstrapStatus steps={bootstrapSteps} done={bootstrapDone} />

          <main className="flex-1 overflow-y-auto pb-20 md:pb-6"><Outlet /></main>
          <div className="md:hidden safe-bottom"><MobileBottomNav /></div>
        </div>
      </div>
    </div>
  );
}
