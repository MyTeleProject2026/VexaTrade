import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowDownToLine, ArrowLeftRight, Bell, CandlestickChart, FileClock, HelpCircle, RefreshCw, ShieldCheck, UserRound, WalletCards } from "lucide-react";
import { userApi } from "../services/api";
import { getApiErrorMessage } from "../services/api";
import PlatformModuleCard from "../components/platform/PlatformModuleCard";
import { fetchMtp2026GuestManifest } from "../services/mtp2026GuestApi";


const modules = [
  { title: "Wallet & Assets", description: "Review balances, supported assets and portfolio positions.", icon: WalletCards, to: "/assets", key: "assets", actionLabel: "Open wallet" },
  { title: "Trading", description: "Access live trading, open positions and trading funds.", icon: CandlestickChart, to: "/trade", key: "trade", actionLabel: "Open trading" },
  { title: "Deposit", description: "Fund your account using the currently configured deposit networks.", icon: ArrowDownToLine, to: "/deposit", key: "deposit", actionLabel: "Deposit" },
  { title: "Convert & Transfer", description: "Move value between supported platform operations.", icon: ArrowLeftRight, to: "/convert", key: "convert", actionLabel: "Open convert" },
  { title: "Security & Account", description: "Manage profile, passcode, verification and account security.", icon: ShieldCheck, to: "/profile/user-center", key: "security", actionLabel: "Open security" },
  { title: "Activity", description: "Review transactions and account activity in one place.", icon: FileClock, to: "/transactions", key: "activity", actionLabel: "View activity" },
  { title: "Notifications", description: "Review important account and platform messages.", icon: Bell, to: "/notifications", key: "notifications", actionLabel: "View notifications" },
  { title: "Support", description: "Get help from the VexaTrade support system.", icon: HelpCircle, to: "/support", key: "support", actionLabel: "Get help" },
];

const request = (promise, timeout = 7000) => Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error("Request timed out")), timeout))]);

export default function PlatformCenterPage() {
  const navigate = useNavigate();
  const [state, setState] = useState({ loading: true, profile: null, wallet: null, assets: null, notifications: null, guestManifest: null, guestError: "" , error: "" });

  const load = useCallback(async () => {
    setState((previous) => ({ ...previous, loading: true, error: "" }));
    const results = await Promise.allSettled([
      request(userApi.getProfile()),
      request(userApi.getWalletSummary()),
      request(userApi.getUserAssets()),
      request(userApi.getNotifications()),
      request(fetchMtp2026GuestManifest()),
    ]);
    const [profile, wallet, assets, notifications, guestManifest] = results;
    const failed = results.filter((result) => result.status === "rejected").length;
    setState({
      loading: false,
      profile: profile.status === "fulfilled" ? profile.value?.data : null,
      wallet: wallet.status === "fulfilled" ? wallet.value?.data : null,
      assets: assets.status === "fulfilled" ? assets.value?.data : null,
      notifications: notifications.status === "fulfilled" ? notifications.value?.data : null,
      guestManifest: guestManifest.status === "fulfilled" ? guestManifest.value : null,
      guestError: guestManifest.status === "rejected" ? (guestManifest.reason?.code || guestManifest.reason?.message || "Guest manifest unavailable") : "",
      error: failed ? `${failed} platform service${failed === 1 ? "" : "s"} did not respond.` : "",
    });
  }, []);

  useEffect(() => { load(); }, [load]);

  const assetRows = Array.isArray(state.assets) ? state.assets : Array.isArray(state.assets?.data) ? state.assets.data : [];
  const notificationRows = Array.isArray(state.notifications) ? state.notifications : Array.isArray(state.notifications?.data) ? state.notifications.data : [];
  const unread = notificationRows.filter((item) => !item.read_at && !item.is_read).length;
  const displayUser = state.profile?.data || state.profile || {};

  const metrics = {
    assets: state.loading ? "Loading…" : `${assetRows.length} assets`,
    trade: "Live access",
    deposit: "Ready",
    convert: "Ready",
    security: displayUser?.status || "Active",
    activity: "Available",
    notifications: state.loading ? "Loading…" : `${unread} unread`,
    support: "Available",
  };

  return (
    <div className="min-h-full bg-[#050812] px-3 py-4 text-white sm:px-5 lg:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.28em] text-cyan-300">VexaTrade Workspace</div>
            <h1 className="mt-1 text-xl font-bold sm:text-2xl">Platform Center</h1>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-400">A single compact control surface for your existing wallet, trading, account, activity and support functions.</p>
          </div>
          <button type="button" onClick={load} disabled={state.loading} className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-slate-200 disabled:opacity-50"><RefreshCw size={14} className={state.loading ? "animate-spin" : ""} /> Refresh</button>
        </div>

        <div className="mt-4 rounded-2xl border border-cyan-400/10 bg-[#081223]/90 p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl border border-white/10 bg-white/[0.04] p-2 text-cyan-300"><UserRound size={18} /></div>
            <div className="min-w-0"><div className="text-[10px] uppercase tracking-wide text-slate-500">Account</div><div className="truncate text-sm font-semibold text-white">{displayUser?.name || displayUser?.email || "VexaTrade user"}</div></div>
            <div className="ml-auto rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-1 text-[10px] font-semibold text-emerald-300">{displayUser?.status || "Active"}</div>
          </div>
        </div>

        {state.error ? <div className="mt-3 rounded-xl border border-amber-400/20 bg-amber-400/5 px-3 py-2 text-xs text-amber-200">{state.error}</div> : null}

        <div className="mt-5 rounded-2xl border border-cyan-400/10 bg-[#081223]/90 p-4">
          <div className="flex items-center justify-between gap-3">
            <div><div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-300">MTP2026 ARM64 Guest Profiles</div><div className="mt-1 text-xs text-slate-400">Ready-to-install guest firmware is supplied only when a verified URL and SHA-256 are present.</div></div>
            <span className={state.guestManifest ? "text-[10px] font-semibold text-emerald-300" : "text-[10px] font-semibold text-amber-300"}>{state.guestManifest ? "READY" : "INCOMPLETE"}</span>
          </div>
          {state.guestError ? <div className="mt-3 rounded-xl border border-amber-400/20 bg-amber-400/5 px-3 py-2 text-[11px] text-amber-200">{state.guestError}</div> : null}
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">{["mtp2026","android","windows11","gaming"].map((id) => { const g=state.guestManifest?.guests?.[id]; return <div key={id} className="rounded-xl border border-white/10 bg-white/[0.03] p-3"><div className="text-xs font-semibold text-white">{g?.name || id}</div><div className="mt-1 text-[10px] text-slate-400">{g?.imageSource?.sha256 ? "SHA-256 verified source configured" : "Image source not configured"}</div></div>; })}</div>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {modules.map((item) => <PlatformModuleCard key={item.key} {...item} metric={metrics[item.key]} status={state.error && ["assets", "notifications"].includes(item.key) ? "warning" : "ready"} onAction={() => navigate(item.to)} />)}
        </div>
      </div>
    </div>
  );
}
