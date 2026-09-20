import { BarChart3, CircleHelp, History, Home, List, Wallet, Zap } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

const SHORT_ITEMS = [
  ["/trade/short-term", "Home", Home],
  ["/trade/short-term/market", "Market", BarChart3],
  ["/trade/short-term/trade", "Trade", Zap],
  ["/trade/short-term/running", "Running", List],
  ["/trade/short-term/history", "History", History],
  ["/trade/short-term/help", "Help", CircleHelp],
];

const SPOT_ITEMS = [
  ["/trade/spot/long-term", "Home", Home],
  ["/trade/spot/long-term/market", "Market", BarChart3],
  ["/trade/spot/long-term/order", "Order", Zap],
  ["/trade/spot/long-term/orders", "Orders", List],
  ["/trade/spot/long-term/assets", "Assets", Wallet],
];

export default function TradeTopNavBar() {
  const location = useLocation();
  const navigate = useNavigate();
  if (!location.pathname.startsWith("/trade")) return null;

  const isSpot = location.pathname.startsWith("/trade/spot/long-term");
  const items = isSpot ? SPOT_ITEMS : SHORT_ITEMS;

  const isActive = (path) =>
    location.pathname === path || location.pathname.startsWith(path + "/");

  return (
    <nav
      aria-label={isSpot ? "Spot and Long-Term trade navigation" : "Short-Term trade navigation"}
      className="sticky top-0 z-20 border-b border-white/10 bg-[#050812]/95 px-2 py-1.5 shadow-[0_8px_25px_rgba(0,0,0,0.22)] backdrop-blur-2xl md:hidden"
    >
      <div className="mx-auto grid w-full max-w-3xl gap-1">
        <div className={`grid gap-1 ${isSpot ? "grid-cols-5" : "grid-cols-6"}`}>
          {items.map(([path, label, Icon]) => {
            const active = isActive(path);
            return (
              <button
                key={path}
                type="button"
                onClick={() => navigate(path)}
                aria-current={active ? "page" : undefined}
                className={`group flex min-h-11 touch-manipulation flex-col items-center justify-center rounded-xl border px-0.5 transition active:scale-[0.97] ${
                  active
                    ? "border-cyan-300/20 bg-cyan-300/10 text-cyan-200 shadow-inner shadow-cyan-300/5"
                    : "border-transparent text-slate-500 hover:border-white/5 hover:bg-white/5 hover:text-white"
                }`}
              >
                <Icon size={15} strokeWidth={2} className="transition-transform group-active:scale-95" />
                <span className="mt-0.5 truncate text-[8px] font-medium leading-3 sm:text-[9px]">{label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
