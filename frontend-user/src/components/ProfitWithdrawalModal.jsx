import { useState, useEffect } from "react";
import { X, AlertTriangle, DollarSign } from "lucide-react";
import { userApi } from "../services/api";
import { useNotification } from "../hooks/useNotification";

export default function ProfitWithdrawalModal({ isOpen, onClose, onSuccess, currentProfit, targetAmount }) {
  const token =
    localStorage.getItem("userToken") ||
    localStorage.getItem("token") ||
    localStorage.getItem("accessToken") ||
    "";

  const { showSuccess, showError } = useNotification();

  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState({
    min_withdrawal_from_profit: 10,
    max_withdrawal_from_profit: 1000,
    restriction_message: "⚠️ Target not achieved yet. You can only withdraw from your profits."
  });
  const [loadingSettings, setLoadingSettings] = useState(true);

  useEffect(() => {
    if (isOpen) {
      loadSettings();
    }
  }, [isOpen]);

  async function loadSettings() {
    try {
      setLoadingSettings(true);
      const res = await userApi.getWithdrawalSettings();
      if (res.data?.success) {
        setSettings(res.data.data);
      }
    } catch (err) {
      console.error("Failed to load withdrawal settings:", err);
    } finally {
      setLoadingSettings(false);
    }
  }

  async function handleWithdraw() {
    const withdrawAmount = Number(amount);
    if (!withdrawAmount || withdrawAmount <= 0) {
      showError("Please enter a valid amount");
      return;
    }

    if (withdrawAmount < settings.min_withdrawal_from_profit) {
      showError(`Minimum withdrawal amount is ${settings.min_withdrawal_from_profit} USDT`);
      return;
    }

    if (withdrawAmount > settings.max_withdrawal_from_profit) {
      showError(`Maximum withdrawal amount per request is ${settings.max_withdrawal_from_profit} USDT`);
      return;
    }

    if (withdrawAmount > currentProfit) {
      showError(`You only have ${currentProfit.toFixed(2)} USDT in profits. Cannot withdraw more.`);
      return;
    }

    try {
      setLoading(true);
      const res = await userApi.requestProfitWithdrawal({ amount: withdrawAmount }, token);
      if (res.data?.success) {
        showSuccess(`Withdrawal request for ${withdrawAmount} USDT submitted. Blockchain-based ecosystem review.`);
        onSuccess?.();
        onClose();
        setAmount("");
      }
    } catch (err) {
      showError(err.response?.data?.message || "Failed to submit withdrawal request");
    } finally {
      setLoading(false);
    }
  }

  if (!isOpen) return null;

  const remainingProfit = currentProfit - Number(amount || 0);
  const progressPercent = targetAmount > 0 ? (currentProfit / targetAmount) * 100 : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0a0e1a] p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <DollarSign size={22} className="text-amber-400" />
            <h2 className="text-xl font-bold text-white">Withdraw Profits</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3">
            <div className="flex items-start gap-2">
              <AlertTriangle size={16} className="text-amber-400 mt-0.5 shrink-0" />
              <p className="text-sm text-amber-300">{settings.restriction_message}</p>
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="flex justify-between mb-2">
              <span className="text-slate-400">Current Profit</span>
              <span className="text-cyan-300 font-semibold">{currentProfit.toFixed(2)} USDT</span>
            </div>
            <div className="flex justify-between mb-2">
              <span className="text-slate-400">Target</span>
              <span className="text-white">{targetAmount.toFixed(2)} USDT</span>
            </div>
            <div className="mt-2">
              <div className="flex justify-between text-xs text-slate-400 mb-1">
                <span>Target Progress</span>
                <span>{progressPercent.toFixed(1)}%</span>
              </div>
              <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                <div className="h-full bg-cyan-400 rounded-full" style={{ width: `${Math.min(100, progressPercent)}%` }} />
              </div>
            </div>
          </div>

          {loadingSettings ? (
            <div className="py-4 text-center text-slate-400">Loading limits...</div>
          ) : (
            <>
              <div>
                <label className="mb-2 block text-sm text-slate-400">
                  Withdrawal Amount (USDT)
                </label>
                <input
                  type="number"
                  min={settings.min_withdrawal_from_profit}
                  max={Math.min(settings.max_withdrawal_from_profit, currentProfit)}
                  step="1"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder={`Min: ${settings.min_withdrawal_from_profit} | Max: ${Math.min(settings.max_withdrawal_from_profit, currentProfit)}`}
                  className="w-full rounded-xl border border-white/10 bg-[#0a0e1a] px-4 py-3 text-white outline-none focus:border-cyan-500"
                />
                <div className="mt-2 flex justify-between text-xs text-slate-500">
                  <span>Min: {settings.min_withdrawal_from_profit} USDT</span>
                  <span>Max per request: {settings.max_withdrawal_from_profit} USDT</span>
                </div>
              </div>

              <div className="flex gap-3">
                {[10, 50, 100, 500].filter(v => v <= settings.max_withdrawal_from_profit && v <= currentProfit).map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setAmount(String(preset))}
                    className="flex-1 rounded-xl border border-white/10 bg-white/5 py-2 text-sm text-white hover:bg-white/10"
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </>
          )}

          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="flex justify-between">
              <span className="text-slate-400">After Withdrawal</span>
              <span className="text-white">≈ {remainingProfit.toFixed(2)} USDT profit remaining</span>
            </div>
          </div>

          <button
            onClick={handleWithdraw}
            disabled={loading || !amount || Number(amount) <= 0}
            className="w-full rounded-xl bg-cyan-500 py-3 font-semibold text-black transition hover:bg-cyan-400 disabled:opacity-60"
          >
            {loading ? "Submitting..." : "Request Withdrawal"}
          </button>

          <p className="text-center text-xs text-slate-500">
            Withdrawal requests are processed within a blockchain-based ecosystem and typically take 2 to 3 minutes, depending on the blockchain network
          </p>
        </div>
      </div>
    </div>
  );
}
