import { useEffect, useState } from "react";
import { X, FileText, AlertTriangle, Info } from "lucide-react";
import DOMPurify from 'dompurify';

export default function PlanNoteModal({ isOpen, onClose, plan }) {
  const [imageLoaded, setImageLoaded] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setImageLoaded(false);
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen || !plan) return null;

  const backgroundImage = plan.admin_note_background_image || null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4">
      <div className="relative w-full max-w-2xl rounded-2xl overflow-hidden shadow-2xl">
        {/* Background Image */}
        {backgroundImage && (
          <div className="absolute inset-0 z-0">
            <img
              src={backgroundImage}
              alt=""
              className="h-full w-full object-cover"
              onLoad={() => setImageLoaded(true)}
            />
            <div className="absolute inset-0 bg-black/60" />
          </div>
        )}

        {/* Content */}
        <div className="relative z-10 max-h-[80vh] overflow-y-auto bg-gradient-to-b from-black/80 to-black/60 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <FileText size={20} className="text-cyan-400" />
              <h2 className="text-xl font-bold text-white">{plan.name}</h2>
            </div>
            <button
              onClick={onClose}
              className="rounded-full p-1 text-slate-400 hover:text-white transition"
            >
              <X size={24} />
            </button>
          </div>

          <div className="space-y-4">
            {/* Plan Details (always shown) */}
            <div className="rounded-xl border border-white/10 bg-black/40 p-4">
              <h3 className="text-sm font-semibold text-cyan-400 mb-2">
                📋 Plan Details
              </h3>
              <div className="space-y-2 text-sm text-slate-300">
                <p><span className="text-slate-500">Duration:</span> {plan.duration_days} days</p>
                <p><span className="text-slate-500">Daily Profit Range:</span> {plan.min_daily_profit_percent}% - {plan.max_daily_profit_percent}%</p>
                <p><span className="text-slate-500">Investment Range:</span> {plan.min_amount} - {plan.max_amount || "Unlimited"} USDT</p>
                {plan.compound_percentage !== undefined && (
                  <p><span className="text-slate-500">Compound Percentage:</span> {plan.compound_percentage}% of daily profit compounds</p>
                )}
              </div>
            </div>

            {/* If HTML content exists, render it; otherwise fallback to individual fields */}
            {plan.html_content ? (
              <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4 prose prose-invert max-w-none">
                <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(plan.html_content) }} />
              </div>
            ) : (
              <>
                {/* Admin Note */}
                {plan.admin_note && (
                  <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/10 p-4">
                    <h3 className="text-sm font-semibold text-cyan-400 mb-2">
                      📢 Blockchain Ecosystem Note
                    </h3>
                    <div className="whitespace-pre-wrap text-sm text-slate-200 leading-relaxed">
                      {plan.admin_note}
                    </div>
                  </div>
                )}

                {/* Additional Information */}
                {plan.additional_notes && (
                  <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                    <h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
                      <Info size={14} />
                      Additional Information
                    </h3>
                    <div className="whitespace-pre-wrap text-sm text-slate-300 leading-relaxed">
                      {plan.additional_notes}
                    </div>
                  </div>
                )}

                {/* Disclaimer / Risk Warning */}
                {plan.disclaimer && (
                  <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-4">
                    <h3 className="text-sm font-semibold text-amber-400 mb-2 flex items-center gap-2">
                      <AlertTriangle size={14} />
                      Disclaimer
                    </h3>
                    <div className="whitespace-pre-wrap text-sm text-amber-200/80 leading-relaxed">
                      {plan.disclaimer}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="mt-6 flex justify-end">
            <button
              onClick={onClose}
              className="rounded-xl bg-cyan-500 px-6 py-2 text-sm font-semibold text-black transition hover:bg-cyan-400"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
