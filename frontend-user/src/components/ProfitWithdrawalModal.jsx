import { useState, useEffect } from "react";
import { X, AlertTriangle, CheckCircle2, ArrowLeft, ArrowRight, ShieldCheck, DollarSign } from "lucide-react";
import { userApi } from "../services/api";
import { useNotification } from "../hooks/useNotification";
import { createActionIdempotencyKey, runSingleUserAction } from "../services/actionRequest";

export default function ProfitWithdrawalModal({ isOpen, onClose, onSuccess, currentProfit, targetAmount }) {
  const token = localStorage.getItem("userToken") || localStorage.getItem("token") || localStorage.getItem("accessToken") || "";
  const { showSuccess, showError } = useNotification();
  const [amount, setAmount] = useState("");
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState({ min_withdrawal_from_profit: 10, max_withdrawal_from_profit: 1000, restriction_message: "⚠️ Target not achieved yet. You can only withdraw from your profits." });
  const [loadingSettings, setLoadingSettings] = useState(true);

  useEffect(() => { if (isOpen) { setStep(0); loadSettings(); } }, [isOpen]);

  async function loadSettings() {
    try { setLoadingSettings(true); const res = await userApi.getWithdrawalSettings(); if (res.data?.success) setSettings(res.data.data); }
    catch (err) { console.error("Failed to load withdrawal settings:", err); }
    finally { setLoadingSettings(false); }
  }

  function validateAmount() {
    const value = Number(amount);
    if (!value || value <= 0) { showError("Please enter a valid amount"); return false; }
    if (value < settings.min_withdrawal_from_profit) { showError(`Minimum withdrawal amount is ${settings.min_withdrawal_from_profit} USDT`); return false; }
    if (value > settings.max_withdrawal_from_profit) { showError(`Maximum withdrawal amount per request is ${settings.max_withdrawal_from_profit} USDT`); return false; }
    if (value > currentProfit) { showError(`You only have ${currentProfit.toFixed(2)} USDT in profits. Cannot withdraw more.`); return false; }
    return true;
  }

  async function handleWithdraw() {
    if (loading || !validateAmount()) return;
    const withdrawAmount = Number(amount);
    const key = createActionIdempotencyKey("profit-withdrawal");
    try {
      setLoading(true);
      const res = await runSingleUserAction("profit-withdrawal-submit", () => userApi.requestProfitWithdrawal({ amount: withdrawAmount, idempotencyKey: key }, token));
      if (res.data?.success) {
        showSuccess(`Profit withdrawal request for ${withdrawAmount} USDT submitted.`);
        onSuccess?.(res.data?.data);
        setAmount("");
        setStep(0);
        onClose();
      }
    } catch (err) { showError(err.response?.data?.message || err.message || "Failed to submit withdrawal request"); }
    finally { setLoading(false); }
  }

  if (!isOpen) return null;
  const remainingProfit = currentProfit - Number(amount || 0);
  const progressPercent = targetAmount > 0 ? (currentProfit / targetAmount) * 100 : 0;
  const stages = ["Configure", "Review", "Security", "Processing", "Complete"];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 backdrop-blur-md">
      <div className="w-full max-w-md overflow-hidden rounded-[28px] border border-white/10 bg-[#081223] shadow-2xl">
        <div className="border-b border-white/10 px-5 py-4">
          <div className="flex items-center justify-between"><div className="flex items-center gap-2"><DollarSign size={20} className="text-cyan-300" /><div><div className="text-[10px] uppercase tracking-[0.25em] text-cyan-300">Secure transaction</div><h2 className="text-lg font-bold text-white">Withdraw Profits</h2></div></div><button onClick={onClose} disabled={loading} className="rounded-xl p-2 text-slate-400 hover:text-white"><X size={19} /></button></div>
          <div className="mt-4 grid grid-cols-5 gap-1">{stages.map((name, i) => <div key={name}><div className={`h-1.5 rounded-full ${i <= step ? "bg-cyan-400" : "bg-white/10"}`} /><div className="mt-1 hidden truncate text-[9px] text-slate-500 sm:block">{name}</div></div>)}</div>
        </div>

        <div className="max-h-[78vh] overflow-y-auto p-5">
          {step === 0 && <div className="space-y-4">
            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-3"><div className="flex items-start gap-2"><AlertTriangle size={15} className="mt-0.5 shrink-0 text-amber-400" /><p className="text-xs leading-5 text-amber-300">{settings.restriction_message}</p></div></div>
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4"><div className="flex justify-between text-sm"><span className="text-slate-400">Available profit</span><span className="font-semibold text-cyan-300">{currentProfit.toFixed(2)} USDT</span></div><div className="mt-2 flex justify-between text-sm"><span className="text-slate-400">Target</span><span className="text-white">{targetAmount.toFixed(2)} USDT</span></div><div className="mt-3"><div className="mb-1 flex justify-between text-[10px] text-slate-500"><span>Target progress</span><span>{progressPercent.toFixed(1)}%</span></div><div className="h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-cyan-400" style={{ width: `${Math.min(100, progressPercent)}%` }} /></div></div></div>
            {loadingSettings ? <div className="py-4 text-center text-xs text-slate-400">Loading withdrawal limits...</div> : <><label className="block text-xs text-slate-400">Withdrawal amount (USDT)<input type="number" min={settings.min_withdrawal_from_profit} max={Math.min(settings.max_withdrawal_from_profit, currentProfit)} step="1" value={amount} onChange={e => setAmount(e.target.value)} placeholder={`Min ${settings.min_withdrawal_from_profit} · Max ${Math.min(settings.max_withdrawal_from_profit, currentProfit)}`} className="mt-2 w-full rounded-2xl border border-white/10 bg-[#050812] px-4 py-3 text-white outline-none focus:border-cyan-500" /></label><div className="grid grid-cols-4 gap-2">{[10,50,100,500].filter(v => v <= settings.max_withdrawal_from_profit && v <= currentProfit).map(preset => <button key={preset} type="button" onClick={() => setAmount(String(preset))} className="rounded-xl border border-white/10 bg-white/[0.03] py-2 text-xs font-semibold text-white hover:bg-white/[0.06]">{preset}</button>)}</div></>}
            <button onClick={() => validateAmount() && setStep(1)} disabled={loadingSettings} className="w-full rounded-2xl bg-cyan-500 py-3 text-sm font-semibold text-black disabled:opacity-50">Review withdrawal <ArrowRight size={15} className="ml-2 inline" /></button>
          </div>}

          {step === 1 && <div className="space-y-4">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4"><div className="text-[10px] uppercase tracking-wider text-slate-500">Transaction details</div><div className="mt-3 space-y-3 text-sm"><div className="flex justify-between"><span className="text-slate-400">Amount</span><span className="font-semibold text-white">{Number(amount).toFixed(2)} USDT</span></div><div className="flex justify-between"><span className="text-slate-400">Profit remaining</span><span className="text-white">≈ {remainingProfit.toFixed(2)} USDT</span></div><div className="flex justify-between"><span className="text-slate-400">Network processing</span><span className="text-slate-300">Platform controlled</span></div></div></div>
            <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/[0.05] p-4"><div className="flex gap-3"><ShieldCheck size={18} className="mt-0.5 text-cyan-300" /><div><div className="text-sm font-semibold text-white">Security authorization</div><p className="mt-1 text-xs leading-5 text-slate-400">The next step opens Email OTP, optional Authenticator 2FA, and your Transaction Passcode. The financial request is sent only after authorization.</p></div></div></div>
            <div className="flex gap-2"><button onClick={() => setStep(0)} disabled={loading} className="flex-1 rounded-2xl border border-white/10 py-3 text-sm font-semibold text-white"><ArrowLeft size={15} className="mr-2 inline" />Back</button><button onClick={handleWithdraw} disabled={loading} className="flex-1 rounded-2xl bg-cyan-500 py-3 text-sm font-semibold text-black disabled:opacity-50">{loading ? "Authorizing..." : "Authorize & Submit"}</button></div>
          </div>}
        </div>

        <div className="border-t border-white/10 px-5 py-3 text-center text-[10px] text-slate-500">One request · idempotent · protected by transaction security</div>
      </div>
    </div>
  );
}
