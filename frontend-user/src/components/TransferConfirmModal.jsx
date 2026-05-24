import { useState } from "react";
import { X, AlertTriangle, Send, CheckCircle } from "lucide-react";

export default function TransferConfirmModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  recipient, 
  amount, 
  note,
  isProcessing 
}) {
  const [showSuccess, setShowSuccess] = useState(false);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    const success = await onConfirm();
    if (success) {
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        onClose();
      }, 1500);
    }
  };

  if (showSuccess) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#050812]/80 p-4">
        <div className="w-full max-w-sm rounded-2xl border border-emerald-500/20 bg-gradient-to-b from-[#0a0e1a] to-[#050812] p-6 text-center">
          <div className="flex justify-center mb-4">
            <div className="h-16 w-16 rounded-full bg-emerald-500/20 flex items-center justify-center">
              <CheckCircle size={32} className="text-emerald-400" />
            </div>
          </div>
          <h3 className="text-xl font-bold text-white mb-2">Transfer Sent!</h3>
          <p className="text-slate-400 text-sm">
            {amount} USDT sent successfully
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#050812]/80 p-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0a0e1a] p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-white">Confirm Transfer</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-white/10 bg-[#050812] p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-cyan-500/20">
                <span className="text-cyan-400 text-lg font-bold">
                  {recipient?.name?.[0]?.toUpperCase() || "U"}
                </span>
              </div>
              <div>
                <div className="font-semibold text-white">
                  {recipient?.name || recipient?.email}
                </div>
                <div className="text-xs text-slate-500">
                  UID: {recipient?.uid}
                </div>
              </div>
            </div>

            <div className="space-y-2 border-t border-white/10 pt-3">
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Amount</span>
                <span className="font-semibold text-white">{amount} USDT</span>
              </div>
              {note && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Note</span>
                  <span className="text-slate-300">{note}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Fee</span>
                <span className="text-emerald-400">0 USDT</span>
              </div>
              <div className="flex justify-between text-sm pt-2 border-t border-white/10">
                <span className="text-slate-300">Total</span>
                <span className="font-bold text-cyan-400">{amount} USDT</span>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 rounded-xl border border-white/10 bg-white/[0.03] py-3 text-sm font-semibold text-white"
              disabled={isProcessing}
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={isProcessing}
              className="flex-1 rounded-xl bg-cyan-500 py-3 text-sm font-semibold text-black disabled:opacity-50"
            >
              {isProcessing ? "Sending..." : "Confirm & Send"}
            </button>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500 justify-center">
            <AlertTriangle size={12} />
            <span>Please double-check the recipient UID before confirming</span>
          </div>
        </div>
      </div>
    </div>
  );
}
