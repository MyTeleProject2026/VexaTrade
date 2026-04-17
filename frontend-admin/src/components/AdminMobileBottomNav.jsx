import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  CandlestickChart,
  Settings2,
  Bell,
} from "lucide-react";

function NavItem({ to, icon: Icon, label, activeClass = "", normalClass = "" }) {
  return (
    <NavLink to={to} className="flex flex-1 justify-center">
      {({ isActive }) => (
        <div
          className={`flex min-w-[54px] flex-col items-center gap-1 ${
            isActive ? activeClass : normalClass
          }`}
        >
          <Icon size={22} strokeWidth={2} />
          <span className="text-[10px]">{label}</span>
        </div>
      )}
    </NavLink>
  );
}

export default function AdminMobileBottomNav() {
  const location = useLocation();

  // Don't show bottom nav on login page
  if (location.pathname === "/admin/login") return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/10 bg-slate-950/95 backdrop-blur-xl xl:hidden">
      <div className="mx-auto flex max-w-md items-center justify-around px-2 pb-[max(12px,env(safe-area-inset-bottom))] pt-3">
        <NavItem
          to="/admin/dashboard"
          icon={LayoutDashboard}
          label="Home"
          activeClass="text-emerald-400"
          normalClass="text-slate-500"
        />
        <NavItem
          to="/admin/users"
          icon={Users}
          label="Users"
          activeClass="text-emerald-400"
          normalClass="text-slate-500"
        />
        <NavItem
          to="/admin/trading-funds-control"
          icon={CandlestickChart}
          label="Trade"
          activeClass="text-emerald-400"
          normalClass="text-slate-500"
        />
        <NavItem
          to="/admin/platform-settings"
          icon={Settings2}
          label="Settings"
          activeClass="text-emerald-400"
          normalClass="text-slate-500"
        />
      </div>
    </div>
  );
}