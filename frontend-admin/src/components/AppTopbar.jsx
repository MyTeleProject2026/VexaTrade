import { useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Newspaper } from "lucide-react";

function getCurrentTime() {
  try {
    return new Date().toLocaleString();
  } catch {
    return "";
  }
}

export default function AppTopbar({
  title,
  subtitle,
  onMenuClick,
  admin = false,
}) {
  const navigate = useNavigate();
  const location = useLocation();

  const sectionTag = useMemo(() => {
    const path = location.pathname || "";

    if (path.includes("/dashboard")) return "Overview";
    if (path.includes("/users")) return "User Control";
    if (path.includes("/kyc")) return "Identity Review";
    if (path.includes("/deposits")) return "Deposit Review";
    if (path.includes("/deposit-networks")) return "Wallet Network Setup";
    if (path.includes("/withdrawals")) return "Withdrawal Review";
    if (path.includes("/withdrawal-fees")) return "Fee Control";
    if (path.includes("/trades")) return "Trade Control";
    if (path.includes("/trade-rules")) return "Rule Management";
    if (path.includes("/audit-logs")) return "Activity Tracking";
    if (path.includes("/support")) return "Customer Service";
    if (path.includes("/platform-settings")) return "Global Settings";
    if (path.includes("/loans")) return "Loan Control";
    if (path.includes("/loan-settings")) return "Loan Settings";
    if (path.includes("/legal-docs")) return "Legal Control";
    if (path.includes("/news")) return "News Control";

    return admin ? "Admin Panel" : "Platform";
  }, [location.pathname, admin]);

  const handleLogout = () => {
    if (admin) {
      localStorage.removeItem("adminToken");
      localStorage.removeItem("adminData");
      localStorage.removeItem("adminUser");
      localStorage.removeItem("admin_token");
      navigate("/admin/login");
      return;
    }

    localStorage.removeItem("userToken");
    localStorage.removeItem("token");
    localStorage.removeItem("accessToken");
    localStorage.removeItem("userRefreshToken");
    localStorage.removeItem("userData");
    localStorage.removeItem("user");
    navigate("/login");
  };

  const showNewsIcon = (location.pathname || "").includes("/news");

  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-[#0a0e1a]/95 backdrop-blur-xl">
      <div className="flex min-h-[73px] items-center justify-between gap-4 px-4 py-4 sm:px-5 lg:px-6 xl:px-8">
        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm font-medium text-slate-200 transition hover:bg-white/[0.06] xl:hidden"
            onClick={onMenuClick}
          >
            Menu
          </button>

          <div className="min-w-0">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-cyan-300">
                {showNewsIcon ? <Newspaper size={12} /> : null}
                {sectionTag}
              </span>

              <span className="hidden text-[11px] text-slate-500 sm:inline">
                {getCurrentTime()}
              </span>
            </div>

            <div className="truncate text-lg font-semibold text-white sm:text-xl">
              {title}
            </div>

            <div className="hidden truncate text-sm text-slate-400 md:block">
              {subtitle}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <div className="hidden rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2 md:block">
            <div className="text-[11px] uppercase tracking-wide text-slate-500">
              Session
            </div>
            <div className="text-sm font-medium text-slate-200">
              {admin ? "Administrator" : "User"}
            </div>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/[0.08]"
          >
            Logout
          </button>
        </div>
      </div>
    </header>
  );
}