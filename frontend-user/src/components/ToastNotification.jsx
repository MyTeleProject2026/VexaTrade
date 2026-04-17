import { useEffect, useState } from "react";
import { CheckCircle2, XCircle, AlertCircle, Info, X } from "lucide-react";
import { useNotification } from "../hooks/useNotification";

const TOAST_STYLES = {
  success: {
    bg: "from-emerald-600/95 to-emerald-800/95",
    border: "border-emerald-400/30",
    icon: CheckCircle2,
    iconColor: "text-emerald-300",
  },
  error: {
    bg: "from-red-600/95 to-red-800/95",
    border: "border-red-400/30",
    icon: XCircle,
    iconColor: "text-red-300",
  },
  warning: {
    bg: "from-amber-600/95 to-amber-800/95",
    border: "border-amber-400/30",
    icon: AlertCircle,
    iconColor: "text-amber-300",
  },
  info: {
    bg: "from-cyan-600/95 to-cyan-800/95",
    border: "border-cyan-400/30",
    icon: Info,
    iconColor: "text-cyan-300",
  },
};

function ToastItem({ toast, onClose }) {
  const [isVisible, setIsVisible] = useState(false);
  const style = TOAST_STYLES[toast.type] || TOAST_STYLES.info;
  const Icon = style.icon;

  useEffect(() => {
    requestAnimationFrame(() => setIsVisible(true));
  }, []);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(() => onClose(toast.id), 200);
  };

  return (
    <div
      className={`
        relative w-[calc(100vw-2rem)] max-w-md rounded-2xl border backdrop-blur-xl
        bg-gradient-to-r ${style.bg} ${style.border}
        shadow-[0_12px_40px_rgba(0,0,0,0.4)]
        transform transition-all duration-300 ease-out
        ${isVisible ? "translate-x-0 opacity-100" : "translate-x-full opacity-0"}
      `}
    >
      <div className="flex items-start gap-3 px-4 py-3">
        <div className={`shrink-0 ${style.iconColor}`}>
          <Icon size={20} />
        </div>

        <div className="min-w-0 flex-1 text-sm font-medium text-white break-words">
          {toast.message}
        </div>

        <button
          type="button"
          onClick={handleClose}
          className="shrink-0 rounded-full p-1 text-white/60 transition hover:bg-white/10 hover:text-white"
        >
          <X size={16} />
        </button>
      </div>

      <div className="h-1 w-full overflow-hidden rounded-b-2xl bg-white/10">
        <div
          className={`h-full animate-[shrink_linear_forwards] rounded-b-2xl ${
            toast.type === "success"
              ? "bg-emerald-400"
              : toast.type === "error"
              ? "bg-red-400"
              : toast.type === "warning"
              ? "bg-amber-400"
              : "bg-cyan-400"
          }`}
          style={{ animationDuration: "4s" }}
        />
      </div>

      <style jsx>{`
        @keyframes shrink {
          from { width: 100%; }
          to { width: 0%; }
        }
        .animate-\\[shrink_linear_forwards\\] {
          animation: shrink linear forwards;
        }
      `}</style>
    </div>
  );
}

export default function ToastContainer() {
  const { toasts, removeToast } = useNotification();

  if (!toasts.length) return null;

  return (
    <div className="fixed right-0 top-4 z-[200] flex flex-col items-end gap-3 px-4 sm:right-4">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onClose={removeToast} />
      ))}
    </div>
  );
}