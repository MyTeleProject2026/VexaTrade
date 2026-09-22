import { useState } from "react";
import { BarChart3, Settings2, WalletCards, SlidersHorizontal, LineChart, ShieldCheck } from "lucide-react";
import AdminTradesPage from "./AdminTradesPage";
import AdminTradeRulesPage from "./AdminTradeRulesPage";
import AdminFundsPage from "./AdminFundsPage";
import AdminFundsRulesPage from "./AdminFundsRulesPage";
import AdminSpotTradePage from "./AdminSpotTradePage";
import AdminSpotSettlementRulesPage from "./AdminSpotSettlementRulesPage";

const TABS = [
  { id: "short-trades", label: "Short-Term Trades", icon: BarChart3 },
  { id: "short-rules", label: "Short-Term Rules", icon: Settings2 },
  { id: "spot-market", label: "Spot / Long-Term Market", icon: LineChart },
  { id: "spot-control", label: "Spot / Long-Term Control", icon: SlidersHorizontal },
  { id: "spot-rules", label: "Spot Settlement Rules", icon: ShieldCheck },
  { id: "funds", label: "Funds", icon: WalletCards },
  { id: "fund-rules", label: "Funds Rules", icon: Settings2 },
];

function TabButton({ active, onClick, children, Icon }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-w-max items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-[11px] font-semibold transition sm:px-4 sm:text-xs ${
        active
          ? "bg-lime-400 text-black shadow-lg shadow-lime-400/10"
          : "bg-[#111111] text-slate-300 hover:bg-[#171717] hover:text-white"
      }`}
    >
      <Icon size={14} />
      {children}
    </button>
  );
}

export default function AdminTradingFundsControlPage() {
  const [tab, setTab] = useState("short-trades");

  const activeLabel = TABS.find((item) => item.id === tab)?.label || "Trading";

  return (
    <div className="space-y-4 bg-black text-white">
      <section className="rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(163,230,53,0.10),transparent_18%),linear-gradient(180deg,#081223_0%,#050505_100%)] p-4 shadow-xl sm:p-5">
        <div>
          <p className="text-[9px] uppercase tracking-[0.32em] text-lime-300 sm:text-[10px]">
            Admin Control Center
          </p>
          <h1 className="mt-1.5 text-xl font-bold text-white sm:text-2xl">
            Trades & Funds Control
          </h1>
          <p className="mt-1.5 text-[11px] leading-4 text-slate-400 sm:text-xs">
            One control surface for Short-Term trading, Spot / Long-Term trading,
            settlement rules, and Trading Funds. Each section remains connected
            to its existing API and database flow.
          </p>
        </div>
      </section>

      <section className="rounded-[24px] border border-white/10 bg-[#081223]/80 p-2 shadow-xl">
        <div className="flex gap-2 overflow-x-auto pb-0.5">
          {TABS.map(({ id, label, icon: Icon }) => (
            <TabButton
              key={id}
              active={tab === id}
              onClick={() => setTab(id)}
              Icon={Icon}
            >
              {label}
            </TabButton>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-[#050812]/80 px-3 py-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[9px] uppercase tracking-[0.24em] text-slate-500">
            Active section
          </span>
          <span className="text-[10px] font-semibold text-cyan-300">{activeLabel}</span>
        </div>
      </section>

      <div>
        {tab === "short-trades" ? <AdminTradesPage /> : null}
        {tab === "short-rules" ? <AdminTradeRulesPage /> : null}
        {tab === "spot-market" ? <AdminSpotTradePage /> : null}
        {tab === "spot-control" ? <AdminSpotTradePage /> : null}
        {tab === "spot-rules" ? <AdminSpotSettlementRulesPage /> : null}
        {tab === "funds" ? <AdminFundsPage /> : null}
        {tab === "fund-rules" ? <AdminFundsRulesPage /> : null}
      </div>
    </div>
  );
}
