import { useState } from "react";
import { X, AlertTriangle, CheckCircle } from "lucide-react";

export default function TransferConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  recipient,
  amount,
  coin = "USDT",
  fee = null,
  total = null,
  note,
  isProcessing,
}) {
  const [showSuccess, setShowSuccess] = useState(false);
  if (!isOpen) return null;

  const handleConfirm = async () => {
    const success = await onConfirm();
    if (success) {
      setShowSuccess(true);
      setTimeout(() => { setShowSuccess(false); onClose(); }, 1500);
    }
  };

  const displayFee = Number.isFinite(Number(fee)) ? Number(fee) : null;
  const displayTotal = Number.isFinite(Number(total)) ? Number(total) : Number(amount || 0) + (displayFee || 0);

  if (showSuccess) return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#050812]/80 p-4">
      <div className="w-full max-w-sm rounded-2xl border border-emerald-500/20 bg-gradient-to-b from-[#0a0e1a] to-[#050812] p-6 text-center">
        <div className="mb-4 flex justify-center"><div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20"><CheckCircle size={32} className="text-emerald-400" /></div></div>
        <h3 className="mb-2 text-xl font-bold text-white">Transfer Submitted</h3>
        <p className="text-sm text-slate-400">{amount} {coin} transfer request submitted successfully.</p>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#050812]/80 p-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0a0e1a] p-5">
        <div className="mb-4 flex items-center justify-between"><h3 className="text-xl font-bold text-white">Confirm Transfer</h3><button onClick={onClose} className="text-slate-400 hover:text-white" disabled={isProcessing}><X size={20} /></button></div>
        <div className="space-y-4">
          <div className="rounded-xl border border-white/10 bg-[#050812] p-4">
            <div className="mb-3 flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-full bg-cyan-500/20"><span className="text-lg font-bold text-cyan-400">{recipient?.name?.[0]?.toUpperCase() || "U"}</span></div><div><div className="font-semibold text-white">{recipient?.name || "VexaTrade user"}</div><div className="text-xs text-slate-500">UID: {recipient?.uid || "—"}</div></div></div>
            <div className="space-y-2 border-t border-white/10 pt-3">
              <div className="flex justify-between text-sm"><span className="text-slate-400">Amount</span><span className="font-semibold text-white">{amount} {coin}</span></div>
              {note && <div className="flex justify-between gap-4 text-sm"><span className="text-slate-400">Note</span><span className="text-right text-slate-300">{note}</span></div>}
              <div className="flex justify-between text-sm"><span className="text-slate-400">Fee</span><span className="text-slate-300">{displayFee === null ? "Calculated by platform" : `${displayFee} ${coin}`}</span></div>
              <div className="flex justify-between border-t border-white/10 pt-2 text-sm"><span className="text-slate-300">Total</span><span className="font-bold text-cyan-400">{displayTotal} {coin}</span></div>
            </div>
          </div>
          <div className="flex gap-3"><button onClick={onClose} className="flex-1 rounded-xl border border-white/10 bg-white/[0.03] py-3 text-sm font-semibold text-white" disabled={isProcessing}>Cancel</button><button onClick={handleConfirm} disabled={isProcessing} className="flex-1 rounded-xl bg-cyan-500 py-3 text-sm font-semibold text-black disabled:opacity-50">{isProcessing ? "Sending..." : "Confirm & Send"}</button></div>
          <div className="flex items-center justify-center gap-2 text-xs text-slate-500"><AlertTriangle size={12} /><span>Please double-check the recipient UID before confirming</span></div>
        </div>
      </div>
    </div>
  );
}
