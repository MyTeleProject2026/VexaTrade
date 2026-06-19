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
  Target,
  Lock,
  AlertCircle,
} from "lucide-react";
import { getApiErrorMessage } from "../services/api";
import api from "../services/api";
import { useNotification } from "../hooks/useNotification";
import TargetModal from "../components/TargetModal";
import ProfitWithdrawalModal from "../components/ProfitWithdrawalModal";
import DOMPurify from 'dompurify';

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

  if (value === "paused") {
    return (
      <span className="rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1 text-xs font-semibold text-red-300">
        Paused by Blockchain Ecosystem
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
    <div className="rounded-xl border border-white/10 bg-[#0a0e1a] p-2.5 shadow-md">
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white/[0.03] text-slate-300">
          <Icon size={14} />
        </div>
        <div className="text-[10px] text-slate-400">{label}</div>
      </div>
      <div className={`mt-1 text-base font-bold ${tone}`}>{value}</div>
      {subtext ? <div className="text-[9px] text-slate-500">{subtext}</div> : null}
    </div>
  );
}

function PlanCard({ plan, applying, onApply }) {
  const [showFullNote, setShowFullNote] = useState(false);
  
  const maxAmount =
    plan.max_amount === null || plan.max_amount === undefined
      ? "Unlimited"
      : `${formatMoney(plan.max_amount)} USDT`;

  const limitText =
    plan.user_limit_count === null || plan.user_limit_count === undefined
      ? "No limit"
      : `${plan.user_limit_count} times`;

  const hasNote = plan.admin_note && plan.admin_note.trim().length > 0;
  const hasAdditionalNotes = plan.additional_notes && plan.additional_notes.trim().length > 0;
  const hasDisclaimer = plan.disclaimer && plan.disclaimer.trim().length > 0;
  const hasAnyNote = hasNote || hasAdditionalNotes || hasDisclaimer;
  
  const getShortPreview = (text) => {
    if (!text) return "";
    if (text.length <= 100) return text;
    return text.substring(0, 100) + "...";
  };

  const isPrivate = plan.is_private === 1;

  return (
    <div className="rounded-xl border border-white/10 bg-[#0a0e1a] p-3 shadow-md">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          {isPrivate && <Lock size={12} className="text-amber-400" />}
          <div>
            <div className="text-sm font-semibold text-white">{plan.name}</div>
            <div className="text-[10px] text-slate-400">{plan.duration_days} day plan</div>
          </div>
        </div>
        <div className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2 py-0.5 text-[9px] font-semibold text-cyan-300">
          {Number(plan.min_daily_profit_percent).toFixed(1)}% - {Number(plan.max_daily_profit_percent).toFixed(1)}%
        </div>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2 text-[10px]">
        <div className="rounded-lg border border-white/10 bg-[#050812] p-2">
          <div className="text-slate-500">Min</div>
          <div className="font-semibold text-white">{formatMoney(plan.min_amount)}</div>
        </div>
        <div className="rounded-lg border border-white/10 bg-[#050812] p-2">
          <div className="text-slate-500">Max</div>
          <div className="font-semibold text-white">{maxAmount}</div>
        </div>
        <div className="rounded-lg border border-white/10 bg-[#050812] p-2">
          <div className="text-slate-500">Daily</div>
          <div className="font-semibold text-emerald-300">
            {Number(plan.min_daily_profit_percent).toFixed(1)}-{Number(plan.max_daily_profit_percent).toFixed(1)}%
          </div>
        </div>
        <div className="rounded-lg border border-white/10 bg-[#050812] p-2">
          <div className="text-slate-500">Usage</div>
          <div className="font-semibold text-white">{limitText}</div>
        </div>
      </div>

      {plan.html_content ? (
        <div className="mt-3 rounded-xl border border-white/10 bg-[#050812] p-3 prose prose-invert max-w-none">
          <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(plan.html_content) }} />
        </div>
      ) : (
        hasAnyNote && (
          <div className="mt-3 rounded-xl border border-white/10 bg-[#050812] p-3">
            {hasNote && (
              <div className="mb-2">
                <div className="text-[10px] font-semibold text-cyan-400 mb-1">📢 Information</div>
                <div className="text-xs text-slate-300 leading-relaxed">
                  {showFullNote ? plan.admin_note : getShortPreview(plan.admin_note)}
                </div>
              </div>
            )}
            {hasAdditionalNotes && (
              <div className="mb-2">
                <div className="text-[10px] font-semibold text-slate-300 mb-1">ℹ️ Additional Notes</div>
                <div className="text-xs text-slate-400 leading-relaxed">
                  {showFullNote ? plan.additional_notes : getShortPreview(plan.additional_notes)}
                </div>
              </div>
            )}
            {hasDisclaimer && (
              <div className="mb-2">
                <div className="text-[10px] font-semibold text-amber-400 mb-1">⚠️ Disclaimer</div>
                <div className="text-xs text-amber-300/70 leading-relaxed">
                  {showFullNote ? plan.disclaimer : getShortPreview(plan.disclaimer)}
                </div>
              </div>
            )}
            {(plan.admin_note?.length > 100 || plan.additional_notes?.length > 100 || plan.disclaimer?.length > 100) && (
              <button
                type="button"
                onClick={() => setShowFullNote(!showFullNote)}
                className="mt-2 text-xs text-cyan-400 hover:text-cyan-300 transition flex items-center gap-1"
              >
                {showFullNote ? "Show less ▲" : "Click to read full information ▼"}
              </button>
            )}
          </div>
        )
      )}

      <div className="mt-2">
        <button
          type="button"
          onClick={() => onApply(plan)}
          disabled={applying}
          className="w-full rounded-lg bg-cyan-500 py-2 text-xs font-semibold text-black transition hover:bg-cyan-400 disabled:opacity-50"
        >
          {applying ? "..." : "Apply"}
        </button>
      </div>
    </div>
  );
}

function ActiveFundCard({ item }) {
  const daysLeft = getDaysLeft(item);
  const totalReceive =
    Number(item.locked_principal || 0) + Number(item.earned_profit || 0);
  const isPaused = String(item.status || "").toLowerCase() === "paused";

  return (
    <div className="rounded-xl border border-white/10 bg-[#0a0e1a] p-3 shadow-md">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-sm font-semibold text-white">{item.plan_name || "Fund Plan"}</div>
          <div className="text-[10px] text-slate-400">Started: {formatDateTime(item.started_at)}</div>
        </div>
        <StatusPill status={item.status} />
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 text-[10px]">
        <div className="rounded-lg border border-white/10 bg-[#050812] p-2">
          <div className="text-slate-500">Funded</div>
          <div className="font-semibold text-white">{formatMoney(item.locked_principal)} USDT</div>
        </div>
        <div className="rounded-lg border border-white/10 bg-[#050812] p-2">
          <div className="text-slate-500">Daily Rate</div>
          <div className="font-semibold text-emerald-300">{Number(item.selected_daily_profit_percent || 0).toFixed(2)}%</div>
        </div>
        <div className="rounded-lg border border-white/10 bg-[#050812] p-2">
          <div className="text-slate-500">Day</div>
          <div className="font-semibold text-white">{item.current_day}/{item.total_days}</div>
        </div>
        <div className="rounded-lg border border-white/10 bg-[#050812] p-2">
          <div className="text-slate-500">Left</div>
          <div className="font-semibold text-amber-300">{daysLeft}</div>
        </div>
        <div className="rounded-lg border border-white/10 bg-[#050812] p-2">
          <div className="text-slate-500">Profit</div>
          <div className="font-semibold text-emerald-300">+{formatMoney(item.earned_profit)} USDT</div>
        </div>
        <div className="rounded-lg border border-white/10 bg-[#050812] p-2">
          <div className="text-slate-500">Total</div>
          <div className="font-semibold text-cyan-300">{formatMoney(totalReceive)} USDT</div>
        </div>
      </div>
      {isPaused && (
        <div className="mt-2 rounded-lg border border-red-500/20 bg-red-500/10 p-2 text-center text-[10px] text-red-300">
          <AlertCircle size={10} className="inline mr-1" />
          This fund is temporarily paused by Blockchain Ecosystem. Daily profits are on hold.
        </div>
      )}
    </div>
  );
}

function HistoryFundCard({ item }) {
  const totalReceived =
    Number(item.total_received || 0) ||
    (Number(item.locked_principal || 0) + Number(item.earned_profit || 0));

  return (
    <div className="rounded-xl border border-white/10 bg-[#0a0e1a] p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-sm font-semibold text-white">{item.plan_name || "Fund Plan"}</div>
          <div className="text-[10px] text-slate-400">Completed: {formatDateTime(item.completed_at || item.updated_at || item.created_at)}</div>
        </div>
        <StatusPill status={item.status} />
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 text-[10px]">
        <div className="rounded-lg border border-white/10 bg-[#050812] p-2">
          <div className="text-slate-500">Principal</div>
          <div className="font-semibold text-white">{formatMoney(item.locked_principal)} USDT</div>
        </div>
        <div className="rounded-lg border border-white/10 bg-[#050812] p-2">
          <div className="text-slate-500">Profit</div>
          <div className="font-semibold text-emerald-300">+{formatMoney(item.earned_profit)} USDT</div>
        </div>
        <div className="rounded-lg border border-white/10 bg-[#050812] p-2 col-span-2">
          <div className="text-slate-500">Total Received</div>
          <div className="font-semibold text-cyan-300">{formatMoney(totalReceived)} USDT</div>
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

  const [hasTarget, setHasTarget] = useState(false);
  const [showTargetModal, setShowTargetModal] = useState(false);
  const [targetChecking, setTargetChecking] = useState(true);
  const [userTarget, setUserTarget] = useState(null);
  const [targetProgress, setTargetProgress] = useState({ currentProfit: 0, targetAmount: 0 });

  const [showProfitWithdrawalModal, setShowProfitWithdrawalModal] = useState(false);
  const [profitWithdrawalProfit, setProfitWithdrawalProfit] = useState(0);
  const [profitWithdrawalTarget, setProfitWithdrawalTarget] = useState(0);
  const [targetAchievedNotified, setTargetAchievedNotified] = useState(false);

  async function checkUserTarget() {
    try {
      setTargetChecking(true);
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || "https://vexatrade-server.onrender.com"}/api/user/target`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success && data.data.hasTarget) {
        const targetData = data.data.target;
        setHasTarget(true);
        setUserTarget(targetData);
        setTargetProgress({
          currentProfit: Number(targetData.current_profit || 0),
          targetAmount: Number(targetData.target_amount || 0),
        });
        setTargetAchievedNotified(false);
      } else {
        setHasTarget(false);
        setUserTarget(null);
      }
    } catch (err) {
      console.error("Failed to check target:", err);
      setHasTarget(false);
    } finally {
      setTargetChecking(false);
    }
  }

  async function refreshTargetProgress() {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || "https://vexatrade-server.onrender.com"}/api/user/target`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success && data.data.hasTarget) {
        const targetData = data.data.target;
        setTargetProgress({
          currentProfit: Number(targetData.current_profit || 0),
          targetAmount: Number(targetData.target_amount || 0),
        });
      }
    } catch (err) {
      console.error("Failed to refresh target:", err);
    }
  }

  async function checkAndPromptNewTarget() {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || "https://vexatrade-server.onrender.com"}/api/user/target`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success && data.data.hasTarget) {
        const target = data.data.target;
        const isAchieved = Number(target.current_profit) >= Number(target.target_amount);
        if (isAchieved && !targetAchievedNotified) {
          setTargetAchievedNotified(true);
          showSuccess(`🎉 Target achieved! ${Number(target.current_profit).toFixed(2)} / ${Number(target.target_amount).toFixed(2)} USDT`);
          setShowTargetModal(true);
        }
      }
    } catch (err) {
      console.error("Failed to check target status:", err);
    }
  }

  const isTargetAchieved = useMemo(() => {
    if (!hasTarget) return false;
    return targetProgress.currentProfit >= targetProgress.targetAmount;
  }, [hasTarget, targetProgress]);

  function handleTargetSet(targetAmount) {
    setHasTarget(true);
    setTargetProgress({
      currentProfit: 0,
      targetAmount: Number(targetAmount),
    });
    setTargetAchievedNotified(false);
    showSuccess(`Target set to ${targetAmount} USDT! You can now start funding.`);
  }

  function handleWithdrawFromProfit(profitAmount, targetAmount) {
    setProfitWithdrawalProfit(profitAmount);
    setProfitWithdrawalTarget(targetAmount);
    setShowProfitWithdrawalModal(true);
  }

  async function loadData(silent = false) {
    try {
      if (!silent) setLoading(true);
      else setRefreshing(true);

      setError("");

      console.log("🔍 [FundsPage] Token exists:", !!token);
      console.log("🔍 [FundsPage] Token length:", token.length);

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

      console.log("🔍 [FundsPage] Plans response status:", plansRes.status);
      
      if (plansRes.status === "fulfilled") {
        console.log("🔍 [FundsPage] Plans response data:", plansRes.value?.data);
        const responseData = plansRes.value?.data?.data;
        const nextPlans = Array.isArray(responseData) ? responseData : [];
        console.log(`🔍 [FundsPage] ${nextPlans.length} plans found`);
        if (nextPlans.length > 0) {
          console.log("🔍 [FundsPage] First plan:", nextPlans[0]);
        }
        setPlans(nextPlans);
      } else {
        console.error("🔍 [FundsPage] Plans request failed:", plansRes.reason);
        if (plansRes.reason?.response) {
          console.error("🔍 [FundsPage] Status:", plansRes.reason.response.status);
          console.error("🔍 [FundsPage] Data:", plansRes.reason.response.data);
        }
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
      console.error("🔍 [FundsPage] loadData error:", err);
      showError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadData();
    checkUserTarget();

    const interval = setInterval(() => {
      loadData(true);
      refreshTargetProgress();
    }, 15000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (hasTarget && targetProgress.targetAmount > 0) {
      checkAndPromptNewTarget();
    }
  }, [hasTarget, targetProgress]);

  useEffect(() => {
    if (plans.length && !selectedPlanId) {
      const firstPublicPlan = plans.find(p => p.is_private === 0);
      if (firstPublicPlan) {
        setSelectedPlanId(firstPublicPlan.id);
      } else if (plans[0]) {
        setSelectedPlanId(plans[0].id);
      }
    }
  }, [plans, selectedPlanId]);

  const selectedPlan = useMemo(() => {
    return plans.find((item) => item.id === selectedPlanId) || plans[0] || null;
  }, [plans, selectedPlanId]);

  const activeTotalReceive = useMemo(() => {
    return activeFunds.reduce((sum, item) => {
      return sum + Number(item.locked_principal || 0) + Number(item.earned_profit || 0);
    }, 0);
  }, [activeFunds]);

  const targetProgressPercent = useMemo(() => {
    if (targetProgress.targetAmount <= 0) return 0;
    return (targetProgress.currentProfit / targetProgress.targetAmount) * 100;
  }, [targetProgress]);

  const hasPrivatePlans = useMemo(() => {
    return plans.some(p => p.is_private === 1);
  }, [plans]);

  function openApplyModal(plan) {
    if (!hasTarget) {
      setShowTargetModal(true);
      return;
    }
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
    <div className="space-y-4 bg-[#050812] px-3 pb-24 pt-3 sm:px-5 xl:pb-8">
      {hasTarget && targetProgress.targetAmount > 0 && (
        <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/10 p-2">
          <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
            <div className="flex items-center gap-2">
              <Target size={14} className="text-cyan-400" />
              <span className="text-slate-300">Target:</span>
              <span className="font-semibold text-white">
                {targetProgress.currentProfit.toFixed(2)} / {targetProgress.targetAmount.toFixed(2)} USDT
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-24 rounded-full bg-white/10 overflow-hidden">
                <div 
                  className="h-full bg-cyan-400 rounded-full transition-all"
                  style={{ width: `${Math.min(100, targetProgressPercent)}%` }}
                />
              </div>
              <span className="text-[10px] text-cyan-300">{targetProgressPercent.toFixed(1)}%</span>
            </div>
          </div>
          {isTargetAchieved ? (
            <div className="mt-2 rounded-lg bg-emerald-500/20 p-2 text-center">
              <span className="text-sm text-emerald-300">🎉 Target Achieved! You can now withdraw your full balance.</span>
            </div>
          ) : (
            <div className="mt-2 text-xs text-slate-400">
              {targetProgress.currentProfit > 0 ? (
                <span>You have {targetProgress.currentProfit.toFixed(2)} USDT in profits. 
                  <button 
                    onClick={() => handleWithdrawFromProfit(targetProgress.currentProfit, targetProgress.targetAmount)}
                    className="ml-1 text-cyan-400 hover:text-cyan-300"
                  >
                    Withdraw profits now →
                  </button>
                </span>
              ) : (
                <span>Start trading or funding to earn profits!</span>
              )}
            </div>
          )}
        </div>
      )}

      <section className="rounded-2xl border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.10),transparent_18%),linear-gradient(180deg,#0a0e1a_0%,#050812_100%)] p-3 shadow-lg">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-1 text-[9px] uppercase tracking-[0.32em] text-cyan-300">
              <Flame size={10} /> VexaTrade Funds
            </div>
            <h1 className="mt-1 text-xl font-bold text-white sm:text-2xl">Funds Center</h1>
            <p className="text-[11px] text-slate-400">Apply for fund plans, track daily profits, and view completed returns.</p>
          </div>
          <button
            type="button"
            onClick={() => loadData(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/[0.06]"
          >
            <RefreshCw size={12} className={refreshing ? "animate-spin" : ""} /> Refresh
          </button>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <SummaryCard label="Active Funded" value={`${formatMoney(summary.active_funded_amount)}`} subtext={`${summary.active_count || 0} fund(s)`} icon={Wallet} />
        <SummaryCard label="Active Profit" value={`+${formatMoney(summary.active_earned_profit)}`} subtext="Locked" icon={BadgeDollarSign} tone="text-emerald-300" />
        <SummaryCard label="Today Profit" value={`+${formatMoney(summary.today_profit)}`} subtext="Credited today" icon={Clock3} tone="text-cyan-300" />
        <SummaryCard label="Completed Profit" value={`+${formatMoney(summary.completed_profit)}`} subtext={`${summary.completed_count || 0} fund(s)`} icon={CheckCircle2} tone="text-cyan-300" />
      </section>

      <section className="rounded-xl border border-white/10 bg-[#0a0e1a] p-1">
        <div className="grid grid-cols-4 gap-1">
          {[
            ["plans", "Plans"],
            ["private", "Private Funds"],
            ["active", "Active"],
            ["history", "History"],
          ].map(([key, label]) => {
            if (key === "private" && !hasPrivatePlans) return null;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={`rounded-lg py-2 text-xs font-semibold transition ${
                  tab === key ? "bg-cyan-500 text-black" : "bg-[#0a0e1a] text-slate-300 hover:bg-[#0f1420]"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </section>

      {tab === "plans" && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white">Available Plans</h2>
            <div className="text-xs text-slate-500">
              {plans.filter(p => p.is_private === 0).length} plan{plans.filter(p => p.is_private === 0).length === 1 ? "" : "s"}
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-[#0a0e1a] p-2">
            <div className="flex gap-1 overflow-x-auto pb-1">
              {plans.filter(p => p.is_private === 0).map((plan) => (
                <button
                  key={plan.id}
                  type="button"
                  onClick={() => setSelectedPlanId(plan.id)}
                  className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    selectedPlanId === plan.id ? "bg-cyan-500 text-black" : "bg-[#0a0e1a] text-slate-300 hover:bg-[#0f1420]"
                  }`}
                >
                  {plan.duration_days} Day
                </button>
              ))}
            </div>
          </div>

          {selectedPlan && selectedPlan.is_private === 0 ? (
            <PlanCard plan={selectedPlan} applying={applying} onApply={openApplyModal} />
          ) : plans.filter(p => p.is_private === 0).length > 0 ? (
            <PlanCard plan={plans.filter(p => p.is_private === 0)[0]} applying={applying} onApply={openApplyModal} />
          ) : (
            <div className="rounded-xl border border-white/10 bg-[#0a0e1a] px-4 py-8 text-center text-xs text-slate-400">
              No public plans available at the moment.
            </div>
          )}
        </section>
      )}

      {tab === "private" && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white">Private Funds</h2>
            <div className="text-xs text-slate-500">
              {plans.filter(p => p.is_private === 1).length} private plan{plans.filter(p => p.is_private === 1).length === 1 ? "" : "s"}
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-[#0a0e1a] p-2">
            <div className="flex gap-1 overflow-x-auto pb-1">
              {plans.filter(p => p.is_private === 1).map((plan) => (
                <button
                  key={plan.id}
                  type="button"
                  onClick={() => setSelectedPlanId(plan.id)}
                  className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    selectedPlanId === plan.id ? "bg-cyan-500 text-black" : "bg-[#0a0e1a] text-slate-300 hover:bg-[#0f1420]"
                  }`}
                >
                  {plan.duration_days} Day
                </button>
              ))}
            </div>
          </div>

          {selectedPlan && selectedPlan.is_private === 1 ? (
            <PlanCard plan={selectedPlan} applying={applying} onApply={openApplyModal} />
          ) : plans.filter(p => p.is_private === 1).length > 0 ? (
            <PlanCard plan={plans.filter(p => p.is_private === 1)[0]} applying={applying} onApply={openApplyModal} />
          ) : null}
        </section>
      )}

      {tab === "active" && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white">Active Funds</h2>
            <div className="text-xs text-slate-500">Total to receive: {formatMoney(activeTotalReceive)} USDT</div>
          </div>
          {activeFunds.length ? (
            <div className="grid gap-3 xl:grid-cols-2">
              {activeFunds.map((item) => <ActiveFundCard key={item.id} item={item} />)}
            </div>
          ) : (
            <div className="rounded-xl border border-white/10 bg-[#0a0e1a] px-4 py-8 text-center text-xs text-slate-400">No active funds right now.</div>
          )}
        </section>
      )}

      {tab === "history" && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white">Funds History</h2>
            <button
              type="button"
              onClick={() => latestCompleted && setLatestCompleted({ ...latestCompleted, __show: true })}
              className="inline-flex items-center gap-1 text-xs text-slate-400 transition hover:text-white"
            >
              Latest Voucher <ChevronRight size={12} />
            </button>
          </div>
          {historyFunds.length ? (
            <div className="grid gap-3 xl:grid-cols-2">
              {historyFunds.map((item) => <HistoryFundCard key={item.id} item={item} />)}
            </div>
          ) : (
            <div className="rounded-xl border border-white/10 bg-[#0a0e1a] px-4 py-8 text-center text-xs text-slate-400">No funds history yet.</div>
          )}
        </section>
      )}

      {applyModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#050812]/70 p-0 sm:items-center sm:p-4">
          <div className="w-full max-w-md rounded-t-2xl border border-white/10 bg-[#0a0e1a] p-4 shadow-2xl sm:rounded-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <div className="text-lg font-bold text-white">{applyModal.name}</div>
                <div className="text-xs text-slate-400">{applyModal.duration_days} day fund plan</div>
              </div>
              <button onClick={closeApplyModal} className="text-slate-400 transition hover:text-white"><X size={18} /></button>
            </div>
            <div className="pt-4">
              <div className="rounded-xl border border-white/10 bg-[#050812] p-3">
                <div className="text-xs text-slate-500">Daily Profit Range</div>
                <div className="mt-1 text-base font-semibold text-emerald-300">
                  {Number(applyModal.min_daily_profit_percent).toFixed(1)}% - {Number(applyModal.max_daily_profit_percent).toFixed(1)}%
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div><div className="text-slate-500">Min</div><div className="font-semibold text-white">{formatMoney(applyModal.min_amount)} USDT</div></div>
                  <div><div className="text-slate-500">Max</div><div className="font-semibold text-white">{applyModal.max_amount == null ? "Unlimited" : `${formatMoney(applyModal.max_amount)} USDT`}</div></div>
                </div>
              </div>
              <div className="mt-3">
                <label className="mb-1 block text-xs font-medium text-slate-300">Enter funding amount</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={applyAmount}
                  onChange={(e) => setApplyAmount(e.target.value)}
                  placeholder="Enter amount"
                  className="w-full rounded-xl border border-white/10 bg-[#0a0e1a] px-3 py-2 text-sm text-white outline-none focus:border-cyan-500"
                />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button onClick={handleApplyPlan} disabled={applying} className="rounded-xl bg-cyan-500 py-2 text-xs font-semibold text-black hover:bg-cyan-400 disabled:opacity-60">
                  {applying ? "Applying..." : "Confirm"}
                </button>
                <button onClick={closeApplyModal} className="rounded-xl border border-white/10 bg-white/[0.03] py-2 text-xs font-semibold text-white">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {latestCompleted && latestCompleted.__show && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#050812]/70 p-0 sm:items-center sm:p-4">
          <div className="w-full max-w-md rounded-t-2xl border border-white/10 bg-[#0a0e1a] p-4 shadow-2xl sm:rounded-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <div className="text-lg font-bold text-white">Fund Complete</div>
                <div className="text-xs text-slate-400">{formatDateTime(latestCompleted.completed_at)}</div>
              </div>
              <button onClick={() => setLatestCompleted((prev) => ({ ...prev, __show: false }))} className="text-slate-400 transition hover:text-white"><X size={18} /></button>
            </div>
            <div className="pt-4">
              <div className="mb-4 flex justify-center"><div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-300"><CheckCircle2 size={22} /></div></div>
              <div className="space-y-2 text-xs">
                <VoucherRow label="Plan" value={latestCompleted.plan_name || "Fund Plan"} />
                <VoucherRow label="Principal" value={`${formatMoney(latestCompleted.locked_principal)} USDT`} />
                <VoucherRow label="Total Profit" value={`+${formatMoney(latestCompleted.earned_profit)} USDT`} valueClassName="text-emerald-300" />
                <VoucherRow label="Total Received" value={`${formatMoney(latestCompleted.total_received)} USDT`} valueClassName="text-cyan-300" />
                <VoucherRow label="Total Days" value={String(latestCompleted.total_days || 0)} />
              </div>
              {latestCompleted.earned_profit > 0 && !hasTarget && (
                <button
                  onClick={() => {
                    setLatestCompleted((prev) => ({ ...prev, __show: false }));
                    handleWithdrawFromProfit(Number(latestCompleted.earned_profit), targetProgress.targetAmount);
                  }}
                  className="mt-3 w-full rounded-xl bg-cyan-500 py-1.5 text-xs font-semibold text-black hover:bg-cyan-400"
                >
                  Withdraw ${formatMoney(latestCompleted.earned_profit)} from Profit
                </button>
              )}
              <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs text-slate-200">
                Principal and profits have been returned to the user main wallet.
              </div>
            </div>
          </div>
        </div>
      )}

      <TargetModal isOpen={showTargetModal} onClose={() => setShowTargetModal(false)} onTargetSet={handleTargetSet} requiredFor="funds" />
      <ProfitWithdrawalModal
        isOpen={showProfitWithdrawalModal}
        onClose={() => setShowProfitWithdrawalModal(false)}
        onSuccess={() => { refreshTargetProgress(); loadData(true); }}
        currentProfit={profitWithdrawalProfit}
        targetAmount={profitWithdrawalTarget}
      />
    </div>
  );
}
