import { useState } from "react";
import AdminTradesPage from "./AdminTradesPage";
import AdminTradeRulesPage from "./AdminTradeRulesPage";
import AdminFundsPage from "./AdminFundsPage";
import AdminFundsRulesPage from "./AdminFundsRulesPage";

function TabButton({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl px-4 py-3 text-sm font-semibold transition ${
        active
          ? "bg-lime-400 text-black"
          : "bg-[#111111] text-slate-300 hover:bg-[#171717]"
      }`}
    >
      {children}
    </button>
  );
}

export default function AdminTradingFundsControlPage() {
  const [tab, setTab] = useState("trades");

  return (
    <div className="space-y-5 bg-black text-white">
      <section className="rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(163,230,53,0.10),transparent_18%),linear-gradient(180deg,#081223_0%,#050505_100%)] p-5 shadow-xl">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.32em] text-lime-300">
              Admin Control
            </p>
            <h1 className="mt-2 text-2xl font-bold text-white sm:text-3xl">
              Trades & Funds Control
            </h1>
            <p className="mt-2 text-sm text-slate-400">
              Manage trades, trade rules, funds, and fund rules from one place.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-[24px] border border-white/10 bg-[#081223]/80 p-2 shadow-xl">
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          <TabButton active={tab === "trades"} onClick={() => setTab("trades")}>
            Trades
          </TabButton>
          <TabButton
            active={tab === "trade-rules"}
            onClick={() => setTab("trade-rules")}
          >
            Trade Rules
          </TabButton>
          <TabButton active={tab === "funds"} onClick={() => setTab("funds")}>
            Funds
          </TabButton>
          <TabButton
            active={tab === "fund-rules"}
            onClick={() => setTab("fund-rules")}
          >
            Funds Rules
          </TabButton>
        </div>
      </section>

      {tab === "trades" ? <AdminTradesPage /> : null}
      {tab === "trade-rules" ? <AdminTradeRulesPage /> : null}
      {tab === "funds" ? <AdminFundsPage /> : null}
      {tab === "fund-rules" ? <AdminFundsRulesPage /> : null}
    </div>
  );
}