import { useState } from "react";
import { X, AlertTriangle, CheckCircle2, ArrowLeft, ArrowRight, ShieldCheck, Send } from "lucide-react";

export default function TransferConfirmModal({ isOpen, onClose, onConfirm, recipient, amount, coin = "USDT", fee = null, total = null, note, isProcessing }) {
  const [step, setStep] = useState(0);
  const [showSuccess, setShowSuccess] = useState(false);
  if (!isOpen) return null;

  const displayFee = Number.isFinite(Number(fee)) ? Number(fee) : null;
  const displayTotal = Number.isFinite(Number(total)) ? Number(total) : Number(amount || 0) + (displayFee || 0);
  const stages = ["Review", "Security", "Processing", "Complete"];

  const handleConfirm = async () => {
    if (isProcessing) return;
    const success = await onConfirm();
    if (success) {
      setShowSuccess(true);
      setStep(3);
      setTimeout(() => { setShowSuccess(false); setStep(0); onClose(); }, 1800);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#050812]/85 p-3 backdrop-blur-md">
      <div className="w-full max-w-md overflow-hidden rounded-[28px] border border-white/10 bg-[#081223] shadow-2xl">
        <div className="border-b border-white/10 px-5 py-4">
          <div className="flex items-center justify-between"><div className="flex items-center gap-2"><Send size={19} className="text-cyan-300" /><div><div className="text-[10px] uppercase tracking-[0.25em] text-cyan-300">Secure transfer</div><h3 className="text-lg font-bold text-white">Transfer Authorization</h3></div></div><button onClick={onClose} disabled={isProcessing || showSuccess} className="rounded-xl p-2 text-slate-400 hover:text-white"><X size={19} /></button></div>
          <div className="mt-4 grid grid-cols-4 gap-1">{stages.map((name, i) => <div key={name}><div className={`h-1.5 rounded-full ${i <= step ? "bg-cyan-400" : "bg-white/10"}`} /><div className="mt-1 hidden text-[9px] text-slate-500 sm:block">{name}</div></div>)}</div>
        </div>

        <div className="p-5">
          {showSuccess ? <div className="py-8 text-center"><div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15"><CheckCircle2 size={34} className="text-emerald-400" /></div><h3 className="mt-4 text-xl font-bold text-white">Transfer Submitted</h3><p className="mt-2 text-sm text-slate-400">{amount} {coin} transfer request submitted successfully.</p></div> : <>
            <div className="rounded-2xl border border-white/10 bg-[#050812] p-4">
              <div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-full bg-cyan-500/15"><span className="text-lg font-bold text-cyan-300">{recipient?.name?.[0]?.toUpperCase() || "U"}</span></div><div><div className="font-semibold text-white">{recipient?.name || "VexaTrade user"}</div><div className="text-xs text-slate-500">UID: {recipient?.uid || "—"}</div></div></div>
              <div className="mt-4 space-y-2 border-t border-white/10 pt-3 text-sm"><div className="flex justify-between"><span className="text-slate-400">Amount</span><span className="font-semibold text-white">{amount} {coin}</span></div>{note && <div className="flex justify-between gap-4"><span className="text-slate-400">Note</span><span className="max-w-[60%] text-right text-slate-300">{note}</span></div>}<div className="flex justify-between"><span className="text-slate-400">Fee</span><span className="text-slate-300">{displayFee === null ? "Calculated by platform" : `${displayFee} ${coin}`}</span></div><div className="flex justify-between border-t border-white/10 pt-2"><span className="text-slate-300">Total</span><span className="font-bold text-cyan-400">{displayTotal} {coin}</span></div></div>
            </div>
            {step === 0 && <div className="mt-4 space-y-3"><div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/[0.05] p-4"><div className="flex gap-3"><ShieldCheck size={18} className="mt-0.5 text-cyan-300" /><div><div className="text-sm font-semibold text-white">Ready for secure authorization</div><p className="mt-1 text-xs leading-5 text-slate-400">Email OTP → optional Authenticator 2FA → Transaction Passcode. The transfer API is called once, only after authorization succeeds.</p></div></div></div><div className="flex gap-2"><button onClick={onClose} className="flex-1 rounded-2xl border border-white/10 py-3 text-sm font-semibold text-white">Cancel</button><button onClick={() => setStep(1)} className="flex-1 rounded-2xl bg-cyan-500 py-3 text-sm font-semibold text-black">Continue <ArrowRight size={15} className="ml-2 inline" /></button></div></div>}
            {step === 1 && <div className="mt-4 space-y-3"><div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/[0.05] p-4"><div className="text-sm font-semibold text-white">Security authorization</div><p className="mt-1 text-xs leading-5 text-slate-400">Select Continue to start the existing transaction-security challenge. No transfer request is sent by this step.</p></div><div className="flex gap-2"><button onClick={() => setStep(0)} disabled={isProcessing} className="flex-1 rounded-2xl border border-white/10 py-3 text-sm font-semibold text-white"><ArrowLeft size={15} className="mr-2 inline" />Back</button><button onClick={handleConfirm} disabled={isProcessing} className="flex-1 rounded-2xl bg-cyan-500 py-3 text-sm font-semibold text-black disabled:opacity-50">{isProcessing ? "Authorizing..." : "Authorize & Send"}</button></div></div>}
          </>}
          {!showSuccess && <div className="mt-4 flex items-center justify-center gap-2 text-[10px] text-slate-500"><AlertTriangle size={12} /><span>Double-check the recipient UID before authorization.</span></div>}
        </div>
      </div>
    </div>
  );
}
