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
          className={`flex min-w-[54px] flex-col items-center gap-1 rounded-2xl px-2 py-1.5 transition ${
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
      className="vexa-floating-action"
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
    <div className="vexa-mobile-nav fixed inset-x-0 bottom-0 z-[55] md:hidden">
      <div
        ref={menuRef}
        className="relative mx-auto flex w-full max-w-2xl items-end justify-around px-1.5 pt-2 pb-[max(9px,env(safe-area-inset-bottom))] sm:px-3"
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
            className="group flex flex-col items-center"
          >
            <div
              className={`relative -mt-7 flex h-14 w-14 items-center justify-center rounded-full border border-cyan-200/20 text-black shadow-[0_0_30px_rgba(34,211,238,0.30)] transition-transform duration-200 group-active:scale-95 ${
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