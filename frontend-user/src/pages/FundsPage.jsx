import { useEffect, useMemo, useState } from "react";
import {
  RefreshCw,
  Wallet,
  Flame,
  Clock3,
  BadgeDollarSign,
  CheckCircle2,
  ChevronRight,
  X,
} from "lucide-react";
import { getApiErrorMessage } from "../services/api";
import api from "../services/api";
import { useNotification } from "../hooks/useNotification";

function formatMoney(value) {
  const num = Number(value || 0);
  if (!Number.isFinite(num)) return "0.00";
  return num.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function getDaysLeft(item) {
  const totalDays = Number(item?.total_days || 0);
  const currentDay = Number(item?.current_day || 0);
  return Math.max(0, totalDays - currentDay);
}

function StatusPill({ status }) {
  const value = String(status || "").toLowerCase();

  if (value === "active") {
    return (
      <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-300">
        Active
      </span>
    );
  }

  if (value === "completed") {
    return (
      <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">
        Completed
      </span>
    );
  }

  return (
    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-slate-300">
      {status || "-"}
    </span>
  );
}

function SummaryCard({ label, value, subtext, icon: Icon, tone = "text-white" }) {
  return (
    <div className="rounded-[24px] border border-white/10 bg-[#0a0e1a] p-3 shadow-[0_10px_30px_rgba(0,0,0,0.22)]">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.04] text-slate-300">
          <Icon size={18} />
        </div>
        <div className="text-xs text-slate-400 sm:text-sm">{label}</div>
      </div>

      <div className={`mt-3 text-xl font-bold sm:text-[24px] ${tone}`}>{value}</div>
      {subtext ? <div className="mt-1 text-xs text-slate-500">{subtext}</div> : null}
    </div>
  );
}

function PlanCard({ plan, applying, onApply }) {
  const maxAmount =
    plan.max_amount === null || plan.max_amount === undefined
      ? "Unlimited"
      : `${formatMoney(plan.max_amount)} USDT`;

  const limitText =
    plan.user_limit_count === null || plan.user_limit_count === undefined
      ? "No limit"
      : `${plan.user_limit_count} times`;

  return (
    <div className="rounded-2xl border border-white/10 bg-[#0a0e1a] p-3 shadow-[0_12px_36px_rgba(0,0,0,0.25)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-base font-semibold text-white">{plan.name}</div>
          <div className="mt-1 text-sm text-slate-400">
            {plan.duration_days} day plan
          </div>
        </div>

        <div className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-semibold text-cyan-300">
          {Number(plan.min_daily_profit_percent).toFixed(1)}% -{" "}
          {Number(plan.max_daily_profit_percent).toFixed(1)}%
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-white/10 bg-[#050812] p-3">
          <div className="text-xs text-slate-500">Min Amount</div>
          <div className="mt-1 text-sm font-semibold text-white">
            {formatMoney(plan.min_amount)} USDT
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#050812] p-3">
          <div className="text-xs text-slate-500">Max Amount</div>
          <div className="mt-1 text-sm font-semibold text-white">{maxAmount}</div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#050812] p-3">
          <div className="text-xs text-slate-500">Daily Profit</div>
          <div className="mt-1 text-sm font-semibold text-emerald-300">
            {Number(plan.min_daily_profit_percent).toFixed(1)}% -{" "}
            {Number(plan.max_daily_profit_percent).toFixed(1)}%
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#050812] p-3">
          <div className="text-xs text-slate-500">Usage Limit</div>
          <div className="mt-1 text-sm font-semibold text-white">{limitText}</div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => onApply(plan)}
        disabled={applying}
        className="mt-3 w-full rounded-2xl bg-cyan-500 px-4 py-3 text-sm font-semibold text-black transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {applying ? "Applying..." : "Apply Now"}
      </button>
    </div>
  );
}

function ActiveFundCard({ item }) {
  const daysLeft = getDaysLeft(item);
  const totalReceive =
    Number(item.locked_principal || 0) + Number(item.earned_profit || 0);

  return (
    <div className="rounded-2xl border border-white/10 bg-[#0a0e1a] p-3 shadow-[0_12px_36px_rgba(0,0,0,0.25)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-base font-semibold text-white">
            {item.plan_name || "Fund Plan"}
          </div>
          <div className="mt-1 text-sm text-slate-400">
            Started: {formatDateTime(item.started_at)}
          </div>
        </div>

        <StatusPill status={item.status} />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-white/10 bg-[#050812] p-3">
          <div className="text-xs text-slate-500">Funded Amount</div>
          <div className="mt-1 text-sm font-semibold text-white">
            {formatMoney(item.locked_principal)} USDT
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#050812] p-3">
          <div className="text-xs text-slate-500">Daily Rate</div>
          <div className="mt-1 text-sm font-semibold text-emerald-300">
            {Number(item.selected_daily_profit_percent || 0).toFixed(2)}%
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#050812] p-3">
          <div className="text-xs text-slate-500">Current Day</div>
          <div className="mt-1 text-sm font-semibold text-white">
            {item.current_day}/{item.total_days}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#050812] p-3">
          <div className="text-xs text-slate-500">Days Left</div>
          <div className="mt-1 text-sm font-semibold text-amber-300">
            {daysLeft}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#050812] p-3">
          <div className="text-xs text-slate-500">Earned Profit</div>
          <div className="mt-1 text-sm font-semibold text-emerald-300">
            +{formatMoney(item.earned_profit)} USDT
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#050812] p-3">
          <div className="text-xs text-slate-500">Total If Complete</div>
          <div className="mt-1 text-sm font-semibold text-cyan-300">
            {formatMoney(totalReceive)} USDT
          </div>
        </div>
      </div>
    </div>
  );
}

function HistoryFundCard({ item }) {
  const totalReceived =
    Number(item.total_received || 0) ||
    (Number(item.locked_principal || 0) + Number(item.earned_profit || 0));

  return (
    <div className="rounded-2xl border border-white/10 bg-[#0a0e1a] p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-base font-semibold text-white">
            {item.plan_name || "Fund Plan"}
          </div>
          <div className="mt-1 text-sm text-slate-400">
            Completed: {formatDateTime(item.completed_at || item.updated_at || item.created_at)}
          </div>
        </div>

        <StatusPill status={item.status} />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-white/10 bg-[#050812] p-3">
          <div className="text-xs text-slate-500">Principal</div>
          <div className="mt-1 text-sm font-semibold text-white">
            {formatMoney(item.locked_principal)} USDT
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#050812] p-3">
          <div className="text-xs text-slate-500">Profit</div>
          <div className="mt-1 text-sm font-semibold text-emerald-300">
            +{formatMoney(item.earned_profit)} USDT
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#050812] p-3 col-span-2">
          <div className="text-xs text-slate-500">Total Received</div>
          <div className="mt-1 text-sm font-semibold text-cyan-300">
            {formatMoney(totalReceived)} USDT
          </div>
        </div>
      </div>
    </div>
  );
}

function VoucherRow({ label, value, valueClassName = "text-white" }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="text-sm text-slate-400">{label}</div>
      <div className={`text-right text-sm font-semibold ${valueClassName}`}>{value}</div>
    </div>
  );
}

export default function FundsPage() {
  const token =
    localStorage.getItem("userToken") ||
    localStorage.getItem("token") ||
    localStorage.getItem("accessToken") ||
    "";

  const { showSuccess, showError, showVoucher } = useNotification();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [applying, setApplying] = useState(false);
  const [tab, setTab] = useState("plans");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [plans, setPlans] = useState([]);
  const [summary, setSummary] = useState({
    active_funded_amount: 0,
    active_earned_profit: 0,
    active_count: 0,
    completed_profit: 0,
    completed_count: 0,
    today_profit: 0,
  });
  const [activeFunds, setActiveFunds] = useState([]);
  const [historyFunds, setHistoryFunds] = useState([]);
  const [latestCompleted, setLatestCompleted] = useState(null);

  const [applyModal, setApplyModal] = useState(null);
  const [applyAmount, setApplyAmount] = useState("");
  const [selectedPlanId, setSelectedPlanId] = useState(null);

  async function loadData(silent = false) {
    try {
      if (!silent) setLoading(true);
      else setRefreshing(true);

      setError("");

      const [plansRes, summaryRes, activeRes, historyRes, latestRes] =
        await Promise.allSettled([
          api.get("/api/funds/plans", {
            headers: { Authorization: `Bearer ${token}` },
          }),
          api.get("/api/funds/summary", {
            headers: { Authorization: `Bearer ${token}` },
          }),
          api.get("/api/funds/active", {
            headers: { Authorization: `Bearer ${token}` },
          }),
          api.get("/api/funds/history", {
            headers: { Authorization: `Bearer ${token}` },
          }),
          api.get("/api/funds/completed-latest", {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

      if (plansRes.status === "fulfilled") {
        const nextPlans = Array.isArray(plansRes.value?.data?.data)
          ? plansRes.value.data.data
          : [];
        setPlans(nextPlans);
      }

      if (summaryRes.status === "fulfilled") {
        setSummary(summaryRes.value?.data?.data || {});
      }

      if (activeRes.status === "fulfilled") {
        setActiveFunds(Array.isArray(activeRes.value?.data?.data) ? activeRes.value.data.data : []);
      }

      if (historyRes.status === "fulfilled") {
        setHistoryFunds(Array.isArray(historyRes.value?.data?.data) ? historyRes.value.data.data : []);
      }

      if (latestRes.status === "fulfilled") {
        setLatestCompleted(latestRes.value?.data?.data || null);
      }
    } catch (err) {
      showError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadData();

    const interval = setInterval(() => {
      loadData(true);
    }, 15000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (plans.length && !selectedPlanId) {
      setSelectedPlanId(plans[0].id);
    }
  }, [plans, selectedPlanId]);

  const selectedPlan = useMemo(() => {
    return plans.find((item) => item.id === selectedPlanId) || plans[0] || null;
  }, [plans, selectedPlanId]);

  const activeTotalReceive = useMemo(() => {
    return activeFunds.reduce((sum, item) => {
      return (
        sum +
        Number(item.locked_principal || 0) +
        Number(item.earned_profit || 0)
      );
    }, 0);
  }, [activeFunds]);

  function openApplyModal(plan) {
    setApplyModal(plan);
    setApplyAmount("");
    setError("");
    setSuccess("");
  }

  function closeApplyModal() {
    setApplyModal(null);
    setApplyAmount("");
  }

  async function handleApplyPlan() {
    try {
      if (!applyModal) return;

      const amount = Number(applyAmount || 0);
      if (!amount || amount <= 0) {
        showError("Please enter a valid amount");
        return;
      }

      setApplying(true);
      setError("");
      setSuccess("");

      const res = await api.post(
        "/api/funds/apply",
        {
          plan_id: applyModal.id,
          amount,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      const responseData = res?.data?.data || {};

      showSuccess(res?.data?.message || "Fund applied successfully");

      showVoucher({
        title: "Fund Investment",
        type: "funds",
        transactionId: responseData.fund_id,
        data: {
          fund_id: responseData.fund_id,
          plan_name: applyModal.name,
          amount: amount,
          selected_daily_profit_percent: responseData.selected_daily_profit_percent,
          total_days: applyModal.duration_days,
          started_at: new Date().toISOString(),
          ends_at: responseData.ends_at,
        },
      });

      closeApplyModal();
      await loadData(true);
      setTab("active");
    } catch (err) {
      showError(getApiErrorMessage(err));
    } finally {
      setApplying(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-5 bg-[#050812] p-3 sm:p-5">
        <section className="rounded-[28px] border border-white/10 bg-[#0a0e1a] p-5 text-sm text-slate-300 shadow-2xl">
          Loading funds...
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-5 bg-[#050812] px-3 pb-24 pt-3 sm:px-5 xl:pb-8">
      <section className="rounded-[32px] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.10),transparent_18%),linear-gradient(180deg,#0a0e1a_0%,#050812_100%)] p-4 shadow-xl sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.32em] text-cyan-300">
              <Flame size={12} />
              VexaTrade Funds
            </div>
            <h1 className="mt-2 text-2xl font-bold text-white sm:text-3xl">
              Funds Center
            </h1>
            <p className="mt-2 text-sm text-slate-400">
              Apply for fund plans, track daily profits, and view completed returns.
            </p>
          </div>

          <button
            type="button"
            onClick={() => loadData(true)}
            className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/[0.06]"
          >
            <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Active Funded Amount"
          value={`${formatMoney(summary.active_funded_amount)} USDT`}
          subtext={`${summary.active_count || 0} active fund(s)`}
          icon={Wallet}
        />
        <SummaryCard
          label="Active Earned Profit"
          value={`+${formatMoney(summary.active_earned_profit)} USDT`}
          subtext="Locked until completion"
          icon={BadgeDollarSign}
          tone="text-emerald-300"
        />
        <SummaryCard
          label="Today Profit"
          value={`+${formatMoney(summary.today_profit)} USDT`}
          subtext="Credited today"
          icon={Clock3}
          tone="text-cyan-300"
        />
        <SummaryCard
          label="Completed Profit"
          value={`+${formatMoney(summary.completed_profit)} USDT`}
          subtext={`${summary.completed_count || 0} completed fund(s)`}
          icon={CheckCircle2}
          tone="text-cyan-300"
        />
      </section>

      <section className="rounded-[28px] border border-white/10 bg-[#0a0e1a] p-2">
        <div className="grid grid-cols-3 gap-2">
          {[
            ["plans", "Plans"],
            ["active", "Active"],
            ["history", "History"],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`rounded-2xl px-3 py-3 text-sm font-semibold transition ${
                tab === key
                  ? "bg-cyan-500 text-black"
                  : "bg-[#0a0e1a] text-slate-300 hover:bg-[#0f1420]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      {tab === "plans" ? (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-white">Available Plans</h2>
            <div className="text-sm text-slate-500">
              {plans.length} plan{plans.length === 1 ? "" : "s"}
            </div>
          </div>

          <div className="rounded-[24px] border border-white/10 bg-[#0a0e1a] p-3">
            <div className="flex gap-2 overflow-x-auto pb-1">
              {plans.map((plan) => {
                const active = selectedPlanId === plan.id;
                return (
                  <button
                    key={plan.id}
                    type="button"
                    onClick={() => setSelectedPlanId(plan.id)}
                    className={`shrink-0 rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                      active
                        ? "bg-cyan-500 text-black"
                        : "bg-[#0a0e1a] text-slate-300 hover:bg-[#0f1420]"
                    }`}
                  >
                    {plan.duration_days} Day
                  </button>
                );
              })}
            </div>
          </div>

          {selectedPlan ? (
            <div className="rounded-2xl border border-white/10 bg-[#0a0e1a] p-3 shadow-[0_12px_36px_rgba(0,0,0,0.25)]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-base font-semibold text-white">{selectedPlan.name}</div>
                  <div className="mt-1 text-sm text-slate-400">
                    {selectedPlan.duration_days} day plan
                  </div>
                </div>

                <div className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-semibold text-cyan-300">
                  {Number(selectedPlan.min_daily_profit_percent).toFixed(1)}% -{" "}
                  {Number(selectedPlan.max_daily_profit_percent).toFixed(1)}%
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
                <div className="rounded-2xl border border-white/10 bg-[#050812] p-3">
                  <div className="text-xs text-slate-500">Min Amount</div>
                  <div className="mt-1 text-sm font-semibold text-white">
                    {formatMoney(selectedPlan.min_amount)} USDT
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-[#050812] p-3">
                  <div className="text-xs text-slate-500">Max Amount</div>
                  <div className="mt-1 text-sm font-semibold text-white">
                    {selectedPlan.max_amount == null
                      ? "Unlimited"
                      : `${formatMoney(selectedPlan.max_amount)} USDT`}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-[#050812] p-3">
                  <div className="text-xs text-slate-500">Daily Profit</div>
                  <div className="mt-1 text-sm font-semibold text-emerald-300">
                    {Number(selectedPlan.min_daily_profit_percent).toFixed(1)}% -{" "}
                    {Number(selectedPlan.max_daily_profit_percent).toFixed(1)}%
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-[#050812] p-3">
                  <div className="text-xs text-slate-500">Usage Limit</div>
                  <div className="mt-1 text-sm font-semibold text-white">
                    {selectedPlan.user_limit_count == null
                      ? "No limit"
                      : `${selectedPlan.user_limit_count} times`}
                  </div>
                </div>
              </div>

              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={() => openApplyModal(selectedPlan)}
                  disabled={applying}
                  className="rounded-2xl bg-cyan-500 px-5 py-3 text-sm font-semibold text-black transition hover:bg-cyan-400 disabled:opacity-60"
                >
                  {applying ? "Applying..." : "Apply Now"}
                </button>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      {tab === "active" ? (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-white">Active Funds</h2>
            <div className="text-sm text-slate-500">
              Total receive if complete: {formatMoney(activeTotalReceive)} USDT
            </div>
          </div>

          {activeFunds.length ? (
            <div className="grid gap-3 xl:grid-cols-2">
              {activeFunds.map((item) => (
                <ActiveFundCard key={item.id} item={item} />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-white/10 bg-[#0a0e1a] px-4 py-10 text-center text-sm text-slate-400">
              No active funds right now.
            </div>
          )}
        </section>
      ) : null}

      {tab === "history" ? (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-white">Funds History</h2>
            <button
              type="button"
              onClick={() =>
                latestCompleted &&
                setLatestCompleted({ ...latestCompleted, __show: true })
              }
              className="inline-flex items-center gap-1 text-sm text-slate-400 transition hover:text-white"
            >
              Latest Voucher
              <ChevronRight size={16} />
            </button>
          </div>

          {historyFunds.length ? (
            <div className="grid gap-3 xl:grid-cols-2">
              {historyFunds.map((item) => (
                <HistoryFundCard key={item.id} item={item} />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-white/10 bg-[#0a0e1a] px-4 py-10 text-center text-sm text-slate-400">
              No funds history yet.
            </div>
          )}
        </section>
      ) : null}

      {applyModal ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4">
          <div className="w-full max-w-md rounded-t-[34px] border border-white/10 bg-[#0a0e1a] p-5 shadow-2xl sm:rounded-[34px]">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <div className="text-[22px] font-bold text-white">{applyModal.name}</div>
                <div className="mt-1 text-sm text-slate-400">
                  {applyModal.duration_days} day fund plan
                </div>
              </div>
              <button
                type="button"
                onClick={closeApplyModal}
                className="text-slate-400 transition hover:text-white"
              >
                <X size={20} />
              </button>
            </div>

            <div className="pt-5">
              <div className="rounded-[24px] border border-white/10 bg-[#050812] p-4">
                <div className="text-sm text-slate-500">Daily Profit Range</div>
                <div className="mt-2 text-lg font-semibold text-emerald-300">
                  {Number(applyModal.min_daily_profit_percent).toFixed(1)}% -{" "}
                  {Number(applyModal.max_daily_profit_percent).toFixed(1)}%
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <div className="text-slate-500">Min</div>
                    <div className="mt-1 font-semibold text-white">
                      {formatMoney(applyModal.min_amount)} USDT
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500">Max</div>
                    <div className="mt-1 font-semibold text-white">
                      {applyModal.max_amount == null
                        ? "Unlimited"
                        : `${formatMoney(applyModal.max_amount)} USDT`}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4">
                <label className="mb-2 block text-sm font-medium text-slate-300">
                  Enter funding amount
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={applyAmount}
                  onChange={(e) => setApplyAmount(e.target.value)}
                  placeholder="Enter amount"
                  className="w-full rounded-2xl border border-white/10 bg-[#0a0e1a] px-4 py-3 text-white outline-none focus:border-cyan-500"
                />
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={handleApplyPlan}
                  disabled={applying}
                  className="rounded-2xl bg-cyan-500 px-4 py-3 font-semibold text-black transition hover:bg-cyan-400 disabled:opacity-60"
                >
                  {applying ? "Applying..." : "Confirm"}
                </button>

                <button
                  type="button"
                  onClick={closeApplyModal}
                  className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 font-semibold text-white"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {latestCompleted && latestCompleted.__show ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4">
          <div className="w-full max-w-md rounded-t-[34px] border border-white/10 bg-[#0a0e1a] p-5 shadow-2xl sm:rounded-[34px]">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <div className="text-[22px] font-bold text-white">Fund Complete</div>
                <div className="mt-1 text-sm text-slate-400">
                  {formatDateTime(latestCompleted.completed_at)}
                </div>
              </div>
              <button
                type="button"
                onClick={() =>
                  setLatestCompleted((prev) => ({ ...prev, __show: false }))
                }
                className="text-slate-400 transition hover:text-white"
              >
                <X size={20} />
              </button>
            </div>

            <div className="pt-5">
              <div className="mb-5 flex justify-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-300">
                  <CheckCircle2 size={30} />
                </div>
              </div>

              <div className="space-y-4">
                <VoucherRow
                  label="Plan"
                  value={latestCompleted.plan_name || "Fund Plan"}
                />
                <VoucherRow
                  label="Principal"
                  value={`${formatMoney(latestCompleted.locked_principal)} USDT`}
                />
                <VoucherRow
                  label="Total Profit"
                  value={`+${formatMoney(latestCompleted.earned_profit)} USDT`}
                  valueClassName="text-emerald-300"
                />
                <VoucherRow
                  label="Total Received"
                  value={`${formatMoney(latestCompleted.total_received)} USDT`}
                  valueClassName="text-cyan-300"
                />
                <VoucherRow
                  label="Total Days"
                  value={String(latestCompleted.total_days || 0)}
                />
              </div>

              <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-200">
                Principal and profits have been returned to the user main wallet.
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}