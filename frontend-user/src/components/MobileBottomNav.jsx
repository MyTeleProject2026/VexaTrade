import { useEffect, useRef, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  Grid2x2,
  Wallet,
  ArrowRightLeft,
  Landmark,
  Bell,
  User,
  ChevronUp,
} from "lucide-react";

function NavItem({ to, icon: Icon, label, activeClass = "", normalClass = "" }) {
  return (
    <NavLink to={to} className="flex flex-1 justify-center">
      {({ isActive }) => (
        <div
          className={`flex min-w-[54px] flex-col items-center gap-1.5 ${
            isActive ? activeClass : normalClass
          }`}
        >
          <Icon size={20} strokeWidth={2} />
          <span className="text-[11px]">{label}</span>
        </div>
      )}
    </NavLink>
  );
}

function FloatingActionItem({ icon: Icon, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-w-[110px] items-center justify-center gap-2 rounded-2xl border border-white/10 bg-[#0a0e1a] px-4 py-3 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(0,0,0,0.28)] transition hover:bg-[#0f1420]"
    >
      <Icon size={18} strokeWidth={2.2} />
      <span>{label}</span>
    </button>
  );
}

export default function MobileBottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const [tradeMenuOpen, setTradeMenuOpen] = useState(false);
  const menuRef = useRef(null);

  const tradeActive =
    location.pathname.startsWith("/trade") || location.pathname.startsWith("/funds");

  useEffect(() => {
    setTradeMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(event.target)) {
        setTradeMenuOpen(false);
      }
    }

    if (tradeMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("touchstart", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [tradeMenuOpen]);

  function handleGo(path) {
    setTradeMenuOpen(false);
    navigate(path);
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/10 bg-[#0a0e1a]/95 backdrop-blur-xl">
      <div
        ref={menuRef}
        className="relative mx-auto flex max-w-md items-end justify-around px-2 pb-[max(12px,env(safe-area-inset-bottom))] pt-3"
      >
        <NavItem
          to="/dashboard"
          icon={Grid2x2}
          label="Home"
          activeClass="text-white"
          normalClass="text-slate-400"
        />

        <NavItem
          to="/assets"
          icon={Wallet}
          label="Assets"
          activeClass="text-white"
          normalClass="text-slate-400"
        />

        <div className="relative flex justify-center">
          {tradeMenuOpen ? (
            <div className="absolute bottom-[88px] left-1/2 z-50 flex -translate-x-1/2 flex-col items-center gap-3">
              <FloatingActionItem
                icon={ArrowRightLeft}
                label="Trade"
                onClick={() => handleGo("/trade")}
              />
              <FloatingActionItem
                icon={Landmark}
                label="Funds"
                onClick={() => handleGo("/funds")}
              />
            </div>
          ) : null}

          <button
            type="button"
            onClick={() => setTradeMenuOpen((prev) => !prev)}
            className="flex flex-col items-center"
          >
            <div
              className={`relative flex h-16 w-16 items-center justify-center rounded-full text-black shadow-[0_0_35px_rgba(34,211,238,0.35)] transition ${
                tradeActive || tradeMenuOpen ? "bg-cyan-500" : "bg-cyan-500/80"
              }`}
            >
              <ArrowRightLeft size={26} strokeWidth={2.4} />
              <div className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#0a0e1a] text-white">
                <ChevronUp
                  size={12}
                  className={`transition ${tradeMenuOpen ? "rotate-180" : ""}`}
                />
              </div>
            </div>
            <span className="mt-2 text-[12px] text-white">Trade</span>
          </button>
        </div>

        <NavItem
          to="/transactions"
          icon={Bell}
          label="Notify"
          activeClass="text-white"
          normalClass="text-slate-400"
        />

        <NavItem
          to="/profile"
          icon={User}
          label="Profile"
          activeClass="text-white"
          normalClass="text-slate-400"
        />
      </div>
    </div>
  );
}