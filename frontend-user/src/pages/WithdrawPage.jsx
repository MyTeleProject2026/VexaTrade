import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  ArrowUpToLine,
  RefreshCw,
  ShieldCheck,
  AlertTriangle,
  ChevronRight,
  Wallet,
  Lock,
  DollarSign,
  Target,
} from "lucide-react";
import { withdrawalApi, userApi, getApiErrorMessage } from "../services/api";
import { useNotification } from "../hooks/useNotification";
// ✅ ADDED: Import Profit Withdrawal Modal
import ProfitWithdrawalModal from "../components/ProfitWithdrawalModal";

function formatAmount(v) {
  const num = Number(v || 0);
  if (!Number.isFinite(num)) return "0.00";
  return num.toFixed(2);
}

function formatTime(date) {
  if (!date) return "--";
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleString();
}

function statusClass(status) {
  const value = String(status || "").toLowerCase();

  if (value === "approved" || value === "completed") {
    return "border border-emerald-500/20 bg-emerald-500/10 text-emerald-300";
  }
  if (value === "rejected") {
    return "border border-red-500/20 bg-red-500/10 text-red-300";
  }
  return "border border-amber-500/20 bg-amber-500/10 text-amber-300";
}

const NETWORK_OPTIONS = {
  USDT: ["TRC20", "ERC20", "BEP20"],
  BTC: ["BTC"],
  ETH: ["ERC20"],
};

function GlassCard({ children, className = "" }) {
  return (
    <section
      className={`rounded-[30px] border border-white/10 bg-[#0a0e1a] shadow-[0_18px_60px_rgba(0,0,0,0.35)] ${className}`}
    >
      {children}
    </section>
  );
}

function FieldLabel({ children }) {
  return <label className="mb-2 block text-sm text-slate-400">{children}</label>;
}

function ActionButton({
  children,
  onClick,
  type = "button",
  disabled = false,
  variant = "primary",
  className = "",
}) {
  const styles = {
    primary: "bg-cyan-500 text-black hover:bg-cyan-400",
    secondary: "border border-white/10 bg-[#0a0e1a] text-white hover:bg-[#1e1e1e]",
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`rounded-2xl px-4 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${styles[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

export default function WithdrawPage() {
  const token =
    localStorage.getItem("userToken") ||
    localStorage.getItem("token") ||
    localStorage.getItem("accessToken") ||
    "";

  const navigate = useNavigate();
  const { showSuccess, showError, showVoucher } = useNotification();

  const [tab, setTab] = useState("request");
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [kycLoading, setKycLoading] = useState(true);
  const [kycStatus, setKycStatus] = useState("not_submitted");
  const [walletBalance, setWalletBalance] = useState(0);

  const [form, setForm] = useState({
    coin: "USDT",
    network: "TRC20",
    amount: "",
    address: "",
  });

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // ✅ ADDED: Target system states for profit withdrawal
  const [hasTarget, setHasTarget] = useState(false);
  const [targetProgress, setTargetProgress] = useState({ currentProfit: 0, targetAmount: 0 });
  const [showProfitWithdrawalModal, setShowProfitWithdrawalModal] = useState(false);
  const [profitWithdrawalAmount, setProfitWithdrawalAmount] = useState(0);
  const [targetChecking, setTargetChecking] = useState(true);

  const availableNetworks = useMemo(() => {
    return NETWORK_OPTIONS[form.coin] || [];
  }, [form.coin]);

  const isKycApproved = String(kycStatus || "").toLowerCase() === "approved";

  // ✅ ADDED: Check if user has target AND target is NOT achieved
  // This determines if main withdraw should be disabled
  const isMainWithdrawDisabled = useMemo(() => {
    if (!hasTarget) return false; // No target = can withdraw freely
    if (isTargetAchieved) return false; // Target achieved = can withdraw freely
    return true; // Has target but not achieved = DISABLED
  }, [hasTarget, isTargetAchieved]);

  // ✅ ADDED: Check user target
  async function checkUserTarget() {
    try {
      setTargetChecking(true);
      const res = await userApi.getUserTarget(token);
      if (res.data?.success && res.data.data.hasTarget) {
        const targetData = res.data.data.target;
        setHasTarget(true);
        setTargetProgress({
          currentProfit: Number(targetData.current_profit || 0),
          targetAmount: Number(targetData.target_amount || 0),
        });
      } else {
        setHasTarget(false);
      }
    } catch (err) {
      console.error("Failed to check target:", err);
      setHasTarget(false);
    } finally {
      setTargetChecking(false);
    }
  }

  // ✅ ADDED: Refresh target progress
  async function refreshTargetProgress() {
    try {
      const res = await userApi.getUserTarget(token);
      if (res.data?.success && res.data.data.hasTarget) {
        const targetData = res.data.data.target;
        setTargetProgress({
          currentProfit: Number(targetData.current_profit || 0),
          targetAmount: Number(targetData.target_amount || 0),
        });
      }
    } catch (err) {
      console.error("Failed to refresh target:", err);
    }
  }

  // ✅ ADDED: Check if target is achieved
  const isTargetAchieved = useMemo(() => {
    if (!hasTarget) return false;
    return targetProgress.currentProfit >= targetProgress.targetAmount;
  }, [hasTarget, targetProgress]);

  // ✅ ADDED: Open profit withdrawal modal
  function openProfitWithdrawal() {
    if (targetProgress.currentProfit <= 0) {
      showError("You don't have any profits to withdraw yet.");
      return;
    }
    setProfitWithdrawalAmount(targetProgress.currentProfit);
    setShowProfitWithdrawalModal(true);
  }

  async function loadProfile() {
    try {
      setKycLoading(true);

      const [profileRes, walletRes] = await Promise.allSettled([
        userApi.getProfile(token),
        typeof userApi.getWalletSummary === "function"
          ? userApi.getWalletSummary(token)
          : Promise.resolve({ data: { data: { balance: 0 } } }),
      ]);

      if (profileRes.status === "fulfilled") {
        setKycStatus(profileRes.value.data?.data?.kyc_status || "not_submitted");
      } else {
        setKycStatus("not_submitted");
      }

      if (walletRes.status === "fulfilled") {
        const data = walletRes.value?.data?.data || {};
        setWalletBalance(Number(data.balance || 0));
      } else {
        setWalletBalance(0);
      }
    } catch {
      setKycStatus("not_submitted");
      setWalletBalance(0);
    } finally {
      setKycLoading(false);
    }
  }

  async function loadHistory(silent = false) {
    try {
      if (!silent) setLoading(true);
      else setRefreshing(true);

      const res = await withdrawalApi.history(token);
      setHistory(Array.isArray(res.data?.data) ? res.data.data : []);
    } catch (err) {
      showError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function loadAll(silent = false) {
    setError("");
    await Promise.all([loadProfile(), loadHistory(silent), checkUserTarget()]);
  }

  useEffect(() => {
    loadAll();

    const interval = setInterval(() => {
      loadAll(true);
      refreshTargetProgress();
    }, 12000);

    return () => clearInterval(interval);
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();

    if (!isKycApproved) {
      showError("KYC verification is required before submitting a withdrawal request.");
      return;
    }

    // ✅ ADDED: Check if main withdraw is disabled due to target not achieved
    if (isMainWithdrawDisabled) {
      showError("You have an active target that is not yet achieved. Please withdraw from profits only, or achieve your target first.");
      return;
    }

    if (!form.address.trim()) {
      showError("Please enter a valid wallet address.");
      return;
    }

    if (!form.amount || Number(form.amount) <= 0) {
      showError("Please enter a valid withdrawal amount.");
      return;
    }

    if (form.coin === "USDT" && Number(form.amount) > Number(walletBalance || 0)) {
      showError("Insufficient available balance.");
      return;
    }

    try {
      setSubmitting(true);
      setError("");
      setSuccess("");

      const res = await withdrawalApi.request(
        {
          coin: form.coin,
          network: form.network,
          amount: Number(form.amount),
          wallet_address: form.address,
        },
        token
      );

      const responseData = res?.data?.data || {};

      showSuccess("Withdrawal request submitted successfully!");

      showVoucher({
        title: "Withdrawal Requested",
        type: "withdraw",
        transactionId: responseData.id,
        data: {
          id: responseData.id,
          coin: form.coin,
          network: form.network,
          amount: Number(form.amount),
          feeAmount: responseData.feeAmount || 0,
          netAmount: responseData.netAmount || Number(form.amount),
          status: "Pending",
          created_at: new Date().toISOString(),
        },
      });

      setForm({
        coin: "USDT",
        network: "TRC20",
        amount: "",
        address: "",
      });

      setTab("history");
      await loadHistory(true);
    } catch (err) {
      showError(getApiErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  // ✅ ADDED: Handle profit withdrawal success
  function handleProfitWithdrawalSuccess() {
    showSuccess("Profit withdrawal request submitted. Admin will review and approve.");
    refreshTargetProgress();
    loadHistory(true);
  }

  const targetProgressPercent = useMemo(() => {
    if (targetProgress.targetAmount <= 0) return 0;
    return (targetProgress.currentProfit / targetProgress.targetAmount) * 100;
  }, [targetProgress]);

  function renderKycCard() {
    if (kycLoading) {
      return (
        <GlassCard className="p-5 text-sm text-slate-300">
          Checking verification status...
        </GlassCard>
      );
    }

    if (isKycApproved) {
      return (
        <GlassCard className="p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-300">
              <ShieldCheck size={22} />
            </div>

            <div>
              <div className="text-lg font-semibold text-emerald-300">
                KYC Approved
              </div>
              <div className="mt-2 text-sm text-slate-300">
                Your account is verified. Withdrawals are enabled.
              </div>
            </div>
          </div>
        </GlassCard>
      );
    }

    const statusText = String(kycStatus || "not_submitted").replace(/_/g, " ");

    return (
      <GlassCard className="p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10 text-amber-300">
              <AlertTriangle size={22} />
            </div>

            <div>
              <div className="text-lg font-semibold text-amber-300">
                Withdrawal Locked
              </div>
              <div className="mt-2 text-sm text-slate-300">
                Your current KYC status is{" "}
                <span className="font-semibold capitalize">{statusText}</span>.
                You must complete and get approval for KYC before making a withdrawal.
              </div>
            </div>
          </div>

          <ActionButton variant="secondary" onClick={() => navigate("/kyc")}>
            Go to KYC
          </ActionButton>
        </div>
      </GlassCard>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6 bg-[#050812] p-4 sm:p-6">
        <GlassCard className="p-6 text-slate-300">Loading withdrawal page...</GlassCard>
      </div>
    );
  }

  return (
    <div className="space-y-6 bg-[#050812] px-4 pb-28 pt-4 sm:px-6 xl:pb-8">
      <section className="rounded-[34px] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(163,230,53,0.10),transparent_18%),linear-gradient(180deg,#0a0a0a_0%,#050505_100%)] p-5 shadow-[0_20px_80px_rgba(0,0,0,0.45)]">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-[0.32em] text-cyan-400">
              Withdraw
            </div>
            <h1 className="mt-2 text-3xl font-bold text-white">Withdraw Funds</h1>
            <p className="mt-2 text-sm text-slate-400">
              Transfer funds securely to your external wallet.
            </p>
          </div>

          <button
            type="button"
            onClick={() => loadAll(true)}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-white transition hover:bg-white/[0.06]"
          >
            <RefreshCw size={18} className={refreshing ? "animate-spin" : ""} />
          </button>
        </div>
      </section>

      {renderKycCard()}

      {/* ✅ ADDED: Target Progress Banner for Profit Withdrawal Info */}
      {hasTarget && targetProgress.targetAmount > 0 && !targetChecking && (
        <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Target size={16} className="text-cyan-400" />
              <span className="text-sm text-slate-300">Your Target Goal:</span>
              <span className="text-sm font-semibold text-white">
                {targetProgress.currentProfit.toFixed(2)} / {targetProgress.targetAmount.toFixed(2)} USDT
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2 w-32 rounded-full bg-white/10 overflow-hidden">
                <div 
                  className="h-full bg-cyan-400 rounded-full transition-all"
                  style={{ width: `${Math.min(100, targetProgressPercent)}%` }}
                />
              </div>
              <span className="text-xs text-cyan-300">{targetProgressPercent.toFixed(1)}%</span>
            </div>
          </div>

          {/* ✅ FIXED: Single block without duplicate */}
          {isTargetAchieved ? (
            <div className="mt-2 rounded-lg bg-emerald-500/20 p-2 text-center">
              <span className="text-sm text-emerald-300">🎉 Target Achieved! You can now withdraw your full balance (principal + profits).</span>
            </div>
          ) : (
            <div className="mt-2 text-xs text-slate-400">
              {targetProgress.currentProfit > 0 ? (
                <span>You have {targetProgress.currentProfit.toFixed(2)} USDT in profits. 
                  <button 
                    onClick={openProfitWithdrawal}
                    className="ml-1 text-cyan-400 hover:text-cyan-300"
                  >
                    Withdraw profits now →
                  </button>
                </span>
              ) : (
                <span>Start trading or funding to earn profits and withdraw them before reaching your target!</span>
              )}
            </div>
          )}
        </div>
      )}

      <div className="grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => setTab("request")}
          className={`rounded-2xl py-3 text-sm font-semibold transition ${
            tab === "request"
              ? "bg-cyan-500 text-black"
              : "border border-white/10 bg-[#0a0e1a] text-slate-300"
          }`}
        >
          Request
        </button>

        <button
          type="button"
          onClick={() => setTab("history")}
          className={`rounded-2xl py-3 text-sm font-semibold transition ${
            tab === "history"
              ? "bg-cyan-500 text-black"
              : "border border-white/10 bg-[#0a0e1a] text-slate-300"
          }`}
        >
          History
        </button>
      </div>

      {tab === "request" ? (
        <div className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
          <GlassCard>
            <div className="border-b border-white/10 px-5 py-4">
              <div className="flex items-center gap-3">
                <ArrowUpToLine size={18} className="text-cyan-400" />
                <h2 className="text-xl font-semibold text-white">Withdrawal Request</h2>
              </div>
            </div>

            {/* ✅ ADDED: Warning banner when main withdraw is disabled due to target not achieved */}
            {isMainWithdrawDisabled && (
              <div className="mx-5 mt-4 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3">
                <div className="flex items-start gap-2">
                  <Target size={16} className="text-amber-400 mt-0.5 shrink-0" />
                  <div className="text-xs text-amber-300">
                    You have an active target that is not yet achieved. 
                    Please use the <strong>"Withdraw Profits"</strong> button below to withdraw from your profits only.
                    Main withdrawal is disabled until you achieve your target.
                  </div>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4 p-5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <FieldLabel>Coin</FieldLabel>
                  <select
                    value={form.coin}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        coin: e.target.value,
                        network: NETWORK_OPTIONS[e.target.value][0],
                      })
                    }
                    className="w-full rounded-2xl border border-white/10 bg-[#0a0e1a] p-3 text-white outline-none focus:border-cyan-500"
                    disabled={!isKycApproved || isMainWithdrawDisabled}
                  >
                    {Object.keys(NETWORK_OPTIONS).map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <FieldLabel>Network</FieldLabel>
                  <select
                    value={form.network}
                    onChange={(e) =>
                      setForm({ ...form, network: e.target.value })
                    }
                    className="w-full rounded-2xl border border-white/10 bg-[#0a0e1a] p-3 text-white outline-none focus:border-cyan-500"
                    disabled={!isKycApproved || isMainWithdrawDisabled}
                  >
                    {availableNetworks.map((n) => (
                      <option key={n}>{n}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <FieldLabel>Wallet Address</FieldLabel>
                <input
                  type="text"
                  placeholder="Enter wallet address"
                  value={form.address}
                  onChange={(e) =>
                    setForm({ ...form, address: e.target.value })
                  }
                  className="w-full rounded-2xl border border-white/10 bg-[#0a0e1a] p-3 text-white outline-none focus:border-cyan-500"
                  disabled={!isKycApproved || isMainWithdrawDisabled}
                />
              </div>

              <div>
                <FieldLabel>Amount</FieldLabel>
                <input
                  type="number"
                  placeholder="Enter amount"
                  value={form.amount}
                  onChange={(e) =>
                    setForm({ ...form, amount: e.target.value })
                  }
                  className="w-full rounded-2xl border border-white/10 bg-[#0a0e1a] p-3 text-white outline-none focus:border-cyan-500"
                  disabled={!isKycApproved || isMainWithdrawDisabled}
                />
              </div>

              <ActionButton
                type="submit"
                disabled={submitting || !isKycApproved || isMainWithdrawDisabled}
                className="w-full"
              >
                {submitting
                  ? "Processing..."
                  : isMainWithdrawDisabled
                  ? "Withdraw Disabled (Target Active)"
                  : isKycApproved
                  ? "Withdraw"
                  : "KYC Required"}
              </ActionButton>
            </form>
          </GlassCard>

          <GlassCard>
            <div className="border-b border-white/10 px-5 py-4">
              <div className="flex items-center gap-3">
                <Wallet size={18} className="text-cyan-400" />
                <h2 className="text-xl font-semibold text-white">Withdrawal Summary</h2>
              </div>
            </div>

            <div className="space-y-4 p-5">
              <div className="rounded-[24px] border border-white/10 bg-[#050812] p-4">
                <div className="text-sm text-slate-500">Available Balance</div>
                <div className="mt-2 text-3xl font-bold text-white">
                  {formatAmount(walletBalance)} USDT
                </div>
              </div>

              {/* ✅ ADDED: Profit Balance Section - Always show if has target */}
              {hasTarget && (
                <div className="rounded-[24px] border border-cyan-500/20 bg-cyan-500/10 p-4">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-cyan-300">Profit Balance (Before Target)</div>
                    <DollarSign size={16} className="text-cyan-300" />
                  </div>
                  <div className="mt-2 text-2xl font-bold text-cyan-300">
                    {formatAmount(targetProgress.currentProfit)} USDT
                  </div>
                  <div className="mt-2 text-xs text-slate-400">
                    Withdraw from profits without affecting your main balance
                  </div>
                  <button
                    type="button"
                    onClick={openProfitWithdrawal}
                    disabled={targetProgress.currentProfit <= 0}
                    className="mt-3 w-full rounded-xl border border-cyan-500/30 bg-cyan-500/20 py-2 text-sm font-semibold text-cyan-300 hover:bg-cyan-500/30 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Withdraw Profits
                  </button>
                </div>
              )}

              <div className="rounded-[24px] border border-white/10 bg-[#050812] p-4">
                <div className="text-sm text-slate-500">Selected Coin</div>
                <div className="mt-2 text-xl font-semibold text-white">
                  {form.coin}
                </div>
              </div>

              <div className="rounded-[24px] border border-white/10 bg-[#050812] p-4">
                <div className="text-sm text-slate-500">Selected Network</div>
                <div className="mt-2 text-xl font-semibold text-white">
                  {form.network}
                </div>
              </div>

              <div className="rounded-[24px] border border-white/10 bg-[#050812] p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/10 text-amber-300">
                    <Lock size={18} />
                  </div>

                  <div>
                    <div className="text-sm font-semibold text-white">
                      Security Reminder
                    </div>
                    <div className="mt-2 text-sm leading-6 text-slate-400">
                      Double-check your wallet address and network before submitting.
                      Withdrawals cannot be reversed after processing.
                    </div>
                  </div>
                </div>
              </div>

              {!isKycApproved ? (
                <ActionButton
                  variant="secondary"
                  className="w-full"
                  onClick={() => navigate("/kyc")}
                >
                  Complete KYC First
                </ActionButton>
              ) : null}
            </div>
          </GlassCard>
        </div>
      ) : null}

      {tab === "history" ? (
        <GlassCard>
          <div className="border-b border-white/10 px-5 py-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-semibold text-white">Withdrawal History</h2>
              <span className="rounded-full border border-white/10 bg-[#050812] px-3 py-1 text-xs text-slate-300">
                {history.length} Record{history.length === 1 ? "" : "s"}
              </span>
            </div>
          </div>

          <div className="space-y-4 p-5">
            {history.length ? (
              history.map((item) => (
                <div
                  key={item.id}
                  className="rounded-[26px] border border-white/10 bg-[#050812] p-5"
                >
                  <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
                    <div>
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="text-lg font-semibold text-white">
                          {String(item.coin || "USDT").toUpperCase()} Withdrawal
                        </div>

                        <span className="rounded-full border border-white/10 bg-[#151515] px-3 py-1 text-xs text-slate-300">
                          ID #{item.id}
                        </span>

                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClass(item.status)}`}>
                          {item.status || "-"}
                        </span>
                      </div>

                      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        <div className="rounded-2xl border border-white/10 bg-[#0a0e1a] p-4">
                          <div className="text-xs uppercase tracking-wide text-slate-500">
                            Coin
                          </div>
                          <div className="mt-2 text-sm font-semibold text-white">
                            {item.coin || "--"}
                          </div>
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-[#0a0e1a] p-4">
                          <div className="text-xs uppercase tracking-wide text-slate-500">
                            Network
                          </div>
                          <div className="mt-2 text-sm font-semibold text-white">
                            {item.network || "--"}
                          </div>
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-[#0a0e1a] p-4">
                          <div className="text-xs uppercase tracking-wide text-slate-500">
                            Amount
                          </div>
                          <div className="mt-2 text-sm font-semibold text-cyan-400">
                            {formatAmount(item.amount)}
                          </div>
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-[#0a0e1a] p-4">
                          <div className="text-xs uppercase tracking-wide text-slate-500">
                            Time
                          </div>
                          <div className="mt-2 text-sm font-semibold text-white">
                            {formatTime(item.created_at)}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="rounded-2xl border border-white/10 bg-[#0a0e1a] p-4">
                        <div className="text-xs uppercase tracking-wide text-slate-500">
                          Wallet Address
                        </div>
                        <div className="mt-2 break-all text-sm text-white">
                          {item.wallet_address || item.address || "--"}
                        </div>
                      </div>

                      {(item.txid || item.note || item.system_note) ? (
                        <div className="rounded-2xl border border-white/10 bg-[#0a0e1a] p-4">
                          <div className="text-xs uppercase tracking-wide text-slate-500">
                            TXID / Note
                          </div>
                          <div className="mt-2 break-all text-sm text-white">
                            {item.txid || item.system_note || item.note || "--"}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-white/10 bg-[#0a0e1a] px-4 py-10 text-center text-sm text-slate-400">
                No withdrawal history found.
              </div>
            )}
          </div>
        </GlassCard>
      ) : null}

      {/* ✅ ADDED: Profit Withdrawal Modal */}
      <ProfitWithdrawalModal
        isOpen={showProfitWithdrawalModal}
        onClose={() => setShowProfitWithdrawalModal(false)}
        onSuccess={handleProfitWithdrawalSuccess}
        currentProfit={profitWithdrawalAmount}
        targetAmount={targetProgress.targetAmount}
      />
    </div>
  );
}
