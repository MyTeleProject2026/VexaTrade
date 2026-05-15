import { useState, useEffect } from "react";
import { Target, X, TrendingUp, CheckCircle } from "lucide-react";
import { userApi } from "../services/api";
import { useNotification } from "../hooks/useNotification";

export default function TargetModal({ isOpen, onClose, onTargetSet, requiredFor = "trade" }) {
  const token =
    localStorage.getItem("userToken") ||
    localStorage.getItem("token") ||
    localStorage.getItem("accessToken") ||
    "";

  const { showSuccess, showError } = useNotification();

  const [targetAmount, setTargetAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [existingTarget, setExistingTarget] = useState(null);
  const [showSuccessScreen, setShowSuccessScreen] = useState(false);

  useEffect(() => {
    if (isOpen && token) {
      checkExistingTarget();
    }
  }, [isOpen, token]);

  async function checkExistingTarget() {
    try {
      setChecking(true);
      const res = await userApi.getUserTarget(token);
      if (res.data?.success && res.data.data.hasTarget) {
        setExistingTarget(res.data.data.target);
      } else {
        setExistingTarget(null);
      }
    } catch (err) {
      console.error("Failed to check target:", err);
    } finally {
      setChecking(false);
    }
  }

  async function handleSetTarget() {
    const amount = Number(targetAmount);
    if (!amount || amount <= 0) {
      showError("Please enter a valid target amount");
      return;
    }

    if (amount < 100) {
      showError("Minimum target amount is 100 USDT");
      return;
    }

    try {
      setLoading(true);
      const res = await userApi.setUserTarget({ targetAmount: amount }, token);
      if (res.data?.success) {
        setShowSuccessScreen(true);
        setTimeout(() => {
          onTargetSet?.(amount);
          onClose();
          setShowSuccessScreen(false);
          setTargetAmount("");
        }, 2000);
      }
    } catch (err) {
      showError(err.response?.data?.message || "Failed to set target");
    } finally {
      setLoading(false);
    }
  }

  function resetAndClose() {
    setTargetAmount("");
    setShowSuccessScreen(false);
    onClose();
  }

  if (!isOpen) return null;

  const currentProfit = Number(existingTarget?.current_profit || 0);
  const targetTotal = Number(existingTarget?.target_amount || 0);
  const progressPercent = targetTotal > 0 ? (currentProfit / targetTotal) * 100 : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0a0e1a] p-6">
        {showSuccessScreen ? (
          <div className="text-center py-8">
            <div className="flex justify-center mb-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20">
                <CheckCircle size={32} className="text-emerald-400" />
              </div>
            </div>
            <h2 className="text-xl font-bold text-white">Target Set!</h2>
            <p className="mt-2 text-slate-400">
              Your goal is set. Start trading or funding to achieve it!
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Target size={22} className="text-cyan-400" />
                <h2 className="text-xl font-bold text-white">Set Your Target</h2>
              </div>
              <button onClick={resetAndClose} className="text-slate-400 hover:text-white">
                <X size={20} />
              </button>
            </div>

            {checking ? (
              <div className="py-8 text-center text-slate-400">Loading...</div>
            ) : existingTarget ? (
              <div className="space-y-4">
                <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/10 p-4">
                  <div className="text-sm text-slate-400">Your Active Goal</div>
                  <div className="mt-1 text-2xl font-bold text-cyan-300">
                    {targetTotal.toFixed(2)} USDT
                  </div>
                  <div className="mt-2 text-sm text-slate-400">
                    Current Profit: {currentProfit.toFixed(2)} USDT
                  </div>
                  <div className="mt-3">
                    <div className="flex justify-between text-xs text-slate-400 mb-1">
                      <span>Progress</span>
                      <span>{progressPercent.toFixed(1)}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                      <div
                        className="h-full bg-cyan-400 rounded-full transition-all"
                        style={{ width: `${Math.min(100, progressPercent)}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <p className="text-sm text-slate-400">
                    {requiredFor === "trade"
                      ? "You can now start trading! Your profits will automatically count toward your goal."
                      : "You can now start funding! Your profits will automatically count toward your goal."}
                  </p>
                </div>

                <button
                  onClick={resetAndClose}
                  className="w-full rounded-xl bg-cyan-500 py-3 font-semibold text-black hover:bg-cyan-400"
                >
                  Continue to {requiredFor === "trade" ? "Trade" : "Funds"}
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <p className="text-sm text-slate-400">
                    Set a profit target you want to achieve. Once set, you can start trading
                    and funding. Your profits will automatically count toward your goal.
                  </p>
                </div>

                <div>
                  <label className="mb-2 block text-sm text-slate-400">
                    Target Amount (USDT)
                  </label>
                  <input
                    type="number"
                    min="100"
                    step="100"
                    value={targetAmount}
                    onChange={(e) => setTargetAmount(e.target.value)}
                    placeholder="Enter target amount"
                    className="w-full rounded-xl border border-white/10 bg-[#0a0e1a] px-4 py-3 text-white outline-none focus:border-cyan-500"
                  />
                  <p className="mt-1 text-xs text-slate-500">Minimum: 100 USDT</p>
                </div>

                <div className="flex gap-3">
                  {[500, 1000, 5000, 10000].map((amount) => (
                    <button
                      key={amount}
                      type="button"
                      onClick={() => setTargetAmount(String(amount))}
                      className="flex-1 rounded-xl border border-white/10 bg-white/5 py-2 text-sm text-white hover:bg-white/10"
                    >
                      {amount.toLocaleString()}
                    </button>
                  ))}
                </div>

                <button
                  onClick={handleSetTarget}
                  disabled={loading}
                  className="w-full rounded-xl bg-cyan-500 py-3 font-semibold text-black transition hover:bg-cyan-400 disabled:opacity-60"
                >
                  {loading ? "Setting..." : "Set Target & Continue"}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
