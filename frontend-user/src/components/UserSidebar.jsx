import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Wallet,
  CandlestickChart,
  RefreshCw,
  ReceiptText,
  ShieldCheck,
  User,
  FileText,
  Landmark,
  LogOut,
  Download,
  Upload,
  X,
} from "lucide-react";
import { getFullImageUrl } from "../utils/image";
import { userApi } from "../services/api";

const menuItems = [
  { icon: LayoutDashboard, label: "Home", path: "/dashboard" },
  { icon: Wallet, label: "Assets", path: "/assets" },
  { icon: CandlestickChart, label: "Trade", path: "/trade" },
  { icon: Landmark, label: "Funds", path: "/funds" },
  { icon: RefreshCw, label: "Convert", path: "/convert" },
  { icon: ReceiptText, label: "Transactions", path: "/transactions" },
  { icon: Landmark, label: "Loan", path: "/loan" },
  { icon: FileText, label: "Legal Documents", path: "/legal-documents" },
  { icon: ShieldCheck, label: "Verify Account", path: "/kyc" },
  { icon: User, label: "Profile", path: "/profile" },
];

function safeParse(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function getKycBadgeClass(status) {
  const value = String(status || "").toLowerCase();

  if (value === "approved") {
    return "bg-emerald-500/20 text-emerald-300 border border-emerald-500/25";
  }
  if (value === "pending") {
    return "bg-amber-500/20 text-amber-300 border border-amber-500/25";
  }
  if (value === "rejected") {
    return "bg-red-500/20 text-red-300 border border-red-500/25";
  }

  return "bg-slate-500/20 text-slate-300 border border-slate-500/25";
}

function getStatusBadgeClass(status) {
  const value = String(status || "").toLowerCase();

  if (value === "active") {
    return "bg-emerald-500/20 text-emerald-300 border border-emerald-500/25";
  }
  if (value === "frozen") {
    return "bg-amber-500/20 text-amber-300 border border-amber-500/25";
  }

  return "bg-red-500/20 text-red-300 border border-red-500/25";
}

export default function UserSidebar({ onNavigate, onClose, showClose = false }) {
  const navigate = useNavigate();
  const location = useLocation();

  const [user, setUser] = useState({
    name: "",
    email: "",
    avatar_url: "",
    uid: "",
    kyc_status: "",
    status: "active",
    balance: 0,
  });

  useEffect(() => {
    let ignore = false;

    async function loadSidebarUser() {
      const storedUser =
        safeParse(localStorage.getItem("user")) ||
        safeParse(localStorage.getItem("userData")) ||
        {};

      const baseUser = {
        name: storedUser?.name || "",
        email: storedUser?.email || "",
        avatar_url:
          storedUser?.avatar_url ||
          storedUser?.avatar ||
          storedUser?.profile_image ||
          "",
        uid: storedUser?.uid || "",
        kyc_status: storedUser?.kyc_status || "not submitted",
        status: storedUser?.status || "active",
        balance: Number(storedUser?.balance || 0),
      };

      if (!ignore) {
        setUser(baseUser);
      }

      try {
        const token =
          localStorage.getItem("userToken") ||
          localStorage.getItem("token") ||
          localStorage.getItem("accessToken") ||
          "";

        if (!token) return;

        const res = await userApi.getWalletSummary(token);
        const walletData = res?.data?.data || {};

        const nextUser = {
          ...baseUser,
          balance: Number(walletData?.balance || baseUser.balance || 0),
          uid: walletData?.user?.uid || baseUser.uid,
          status: walletData?.user?.status || baseUser.status,
          kyc_status: walletData?.user?.kyc_status || baseUser.kyc_status,
          name: walletData?.user?.name || baseUser.name,
          email: walletData?.user?.email || baseUser.email,
          avatar_url:
            walletData?.user?.avatar_url ||
            walletData?.user?.profile_image ||
            baseUser.avatar_url,
        };

        if (!ignore) {
          setUser(nextUser);
        }

        try {
          localStorage.setItem("user", JSON.stringify(nextUser));
        } catch {}
      } catch {
        // silent fallback to stored user
      }
    }

    loadSidebarUser();

    return () => {
      ignore = true;
    };
  }, [location.pathname]);

  const avatarUrl = getFullImageUrl(
    user?.avatar_url || user?.avatar || user?.profile_image || ""
  );

  function goTo(path) {
    navigate(path);
    onNavigate?.();
  }

  function handleLogout() {
    localStorage.removeItem("userToken");
    localStorage.removeItem("token");
    localStorage.removeItem("accessToken");
    localStorage.removeItem("userRefreshToken");
    localStorage.removeItem("user");
    localStorage.removeItem("userData");
    localStorage.removeItem("role");
    sessionStorage.removeItem("VexaTrade_passcode_verified");

    navigate("/login");
    onNavigate?.();
  }

  return (
    <aside className="flex h-full min-h-0 w-full flex-col bg-[#0a0e1a] text-white">
      <div className="shrink-0 border-b border-white/10 px-5 py-5">
        <div className="flex items-center justify-between">
          <div className="text-[18px] font-semibold text-white">
            Vexa<span className="text-cyan-400">Trade</span>
          </div>

          {showClose ? (
            <button
              type="button"
              onClick={onClose}
              className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-white"
            >
              <X size={22} />
            </button>
          ) : null}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-5">
        <div className="space-y-5">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-white/[0.04] text-base font-semibold text-white">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt="avatar"
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="font-semibold text-white">
                  {(user?.email?.[0] || "U").toUpperCase()}
                </span>
              )}
            </div>

            <div className="min-w-0">
              <div className="truncate text-[17px] font-semibold text-white">
                {user.name || "User"}
              </div>
              <div className="truncate text-sm text-slate-400">
                {user.email || "No email"}
              </div>
            </div>
          </div>

          <div className="rounded-[26px] border border-white/10 bg-[#050812]/30 p-4">
            <div className="text-[11px] uppercase tracking-[0.25em] text-slate-500">
              Balance
            </div>

            <div className="mt-3 text-[20px] font-bold text-white">
              {Number(user.balance || 0).toFixed(2)}{" "}
              <span className="text-base text-slate-300">USDT</span>
            </div>

            <div className="mt-3 text-sm text-slate-500">
              UID: {user.uid || "--"}
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <span
                className={`rounded-full px-3 py-1 text-xs ${getStatusBadgeClass(
                  user.status
                )}`}
              >
                {user.status || "active"}
              </span>

              <span
                className={`rounded-full px-3 py-1 text-xs ${getKycBadgeClass(
                  user.kyc_status
                )}`}
              >
                KYC: {user.kyc_status || "not submitted"}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => goTo("/deposit")}
              className="flex items-center justify-center gap-2 rounded-2xl bg-cyan-500 px-4 py-3 font-semibold text-black transition hover:bg-cyan-400"
            >
              <Download size={16} />
              Deposit
            </button>

            <button
              type="button"
              onClick={() => goTo("/withdraw")}
              className="flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 font-semibold text-white transition hover:bg-white/[0.06]"
            >
              <Upload size={16} />
              Withdraw
            </button>
          </div>

          <div className="space-y-2 pt-1">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const active =
                location.pathname === item.path ||
                (item.path !== "/profile" &&
                  location.pathname.startsWith(item.path));

              return (
                <MenuItem
                  key={item.path}
                  icon={Icon}
                  label={item.label}
                  active={active}
                  onClick={() => goTo(item.path)}
                />
              );
            })}
          </div>
        </div>
      </div>

      <div className="shrink-0 border-t border-white/10 p-5 pb-[max(20px,env(safe-area-inset-bottom))]">
        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-red-600 py-3.5 font-semibold text-white transition hover:bg-red-500"
        >
          <LogOut size={18} />
          Logout
        </button>
      </div>
    </aside>
  );
}

function MenuItem({ icon: Icon, label, onClick, active = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left transition ${
        active
          ? "border border-cyan-500/25 bg-cyan-500/10 text-cyan-300"
          : "text-white hover:bg-white/5"
      }`}
    >
      <Icon size={20} className={active ? "text-cyan-300" : "text-slate-400"} />
      <span className="text-[16px]">{label}</span>
    </button>
  );
}