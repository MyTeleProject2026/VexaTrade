import { NavLink, useLocation } from "react-router-dom";
import { Activity, CandlestickChart, LayoutDashboard, Menu, Users } from "lucide-react";

function NavItem({ to, icon: Icon, label }) {
  return <NavLink to={to} className="flex min-w-0 flex-1 justify-center">{({ isActive }) => <div className={`flex min-w-[54px] flex-col items-center gap-1 rounded-xl px-2 py-1.5 ${isActive ? "text-cyan-300" : "text-slate-500"}`}><Icon size={18} /><span className="text-[9px] font-semibold">{label}</span></div>}</NavLink>;
}

export default function AdminMobileBottomNav() {
  const location = useLocation();
  if (location.pathname === "/admin/login") return null;
  return <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/10 bg-[#080d18]/95 shadow-2xl backdrop-blur-xl xl:hidden"><div className="mx-auto flex max-w-xl items-center gap-1 px-2 pt-1.5 pb-[max(8px,env(safe-area-inset-bottom))]"><NavItem to="/admin/control-center" icon={Activity} label="Control" /><NavItem to="/admin/dashboard" icon={LayoutDashboard} label="Home" /><NavItem to="/admin/users" icon={Users} label="Users" /><NavItem to="/admin/trading-funds-control" icon={CandlestickChart} label="Trading" /><NavItem to="/admin/platform-settings" icon={Menu} label="More" /></div></div>;
}
