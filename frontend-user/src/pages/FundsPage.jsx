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
        headers: { Authorization: `Bearer ${token
