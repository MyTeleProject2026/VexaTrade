// frontend-user/src/layouts/UserLayout.jsx
import { useEffect, useMemo, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, Bell, Menu, Wallet } from "lucide-react";
import UserSidebar from "../components/UserSidebar";
import MobileBottomNav from "../components/MobileBottomNav";
import PasscodeLockScreen from "../components/PasscodeLockScreen";
import { userApi } from "../services/api";

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
  for (const route of ["/profile/user-center", "/profile", "/deposit", "/withdraw", "/loan", "/legal-documents", "/transactions", "/convert", "/kyc", "/assets", "/trade", "/funds", "/support"]) {
    if (pathname.startsWith(route)) return PAGE_META[route];
  }
  return PAGE_META["/dashboard"];
}

function shouldShowBackButton(pathname) {
  return ["/deposit", "/withdraw", "/kyc", "/convert", "/transactions", "/profile/user-center", "/loan", "/legal-documents", "/support"].some((route) => pathname.startsWith(route));
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
    let mounted = true;
    const checkPasscode = async () => {
      try {
        setCheckingPasscode(true);
        const token = getStoredToken();
        if (!token || sessionStorage.getItem("VexaTrade_passcode_verified") === "1") {
          if (mounted) setIsPasscodeLocked(false);
          return;
        }
        const res = await userApi.securityStatus(token);
        if (mounted) setIsPasscodeLocked(Boolean(res?.data?.data?.hasPasscode));
      } catch (error) {
        console.error("❌ Passcode check error:", error);
        // Fail closed for the lock only when the API explicitly reports the
        // account has a passcode; a transient status failure must not lock out
        // an otherwise authenticated user.
        if (mounted) setIsPasscodeLocked(false);
      } finally {
        if (mounted) setCheckingPasscode(false);
      }
    };
    checkPasscode();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    document.body.style.overflow = sidebarOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [sidebarOpen]);

  useEffect(() => { setSidebarOpen(false); }, [location.pathname]);

  useEffect(() => {
    let ignore = false;
    let inFlight = false;
    const controller = new AbortController();
    let timeoutId;

    async function loadUnreadStatus() {
      if (inFlight) return;
      const token = getStoredToken();
      if (!token) {
        if (!ignore) setHasUnread(false);
        return;
      }
      inFlight = true;
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
        if (!ignore && error?.name !== "AbortError") setHasUnread(false);
      } finally {
        if (timeoutId) window.clearTimeout(timeoutId);
        inFlight = false;
      }
    }

    loadUnreadStatus();
    const interval = window.setInterval(loadUnreadStatus, 30000);
    return () => {
      ignore = true;
      window.clearInterval(interval);
      controller.abort();
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, [location.pathname]);

  function handleBack() {
    if (["/deposit", "/withdraw", "/convert", "/transactions"].includes(location.pathname)) {
      navigate("/assets");
      return;
    }
    navigate(-1);
  }

  if (checkingPasscode) {
    return <div className="min-h-screen bg-[#050812] text-slate-300 flex items-center justify-center text-sm">Checking account security…</div>;
  }

  if (isPasscodeLocked) {
    return <PasscodeLockScreen onUnlocked={() => setIsPasscodeLocked(false)} />;
  }

  return (
    <div className="min-h-screen bg-[#050812] text-white">
      <UserSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <main className="min-h-screen lg:pl-72">
        <header className="sticky top-0 z-30 border-b border-white/10 bg-[#050812]/95 px-4 py-3 backdrop-blur sm:px-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {showBackButton ? (
                <button type="button" onClick={handleBack} className="rounded-xl border border-white/10 p-2 text-slate-300 hover:bg-white/5" aria-label="Back"><ArrowLeft size={18} /></button>
              ) : (
                <button type="button" onClick={() => setSidebarOpen(true)} className="rounded-xl border border-white/10 p-2 text-slate-300 hover:bg-white/5 lg:hidden" aria-label="Menu"><Menu size={18} /></button>
              )}
              <div>
                <div className="text-sm font-semibold text-white">{pageMeta.title}</div>
                <div className="hidden text-xs text-slate-500 sm:block">{pageMeta.subtitle}</div>
              </div>
            </div>
            <button type="button" onClick={() => navigate("/transactions")} className="relative rounded-xl border border-white/10 p-2 text-slate-300 hover:bg-white/5" aria-label="Notifications">
              <Bell size={18} />
              {hasUnread && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-cyan-400" />}
            </button>
          </div>
        </header>
        <Outlet />
      </main>
      <MobileBottomNav />
    </div>
  );
}
