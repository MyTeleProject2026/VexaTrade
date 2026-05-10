import { useEffect, useState, useRef } from "react";
import {
  X,
  CheckCircle2,
  ArrowRightLeft,
  ArrowDownToLine,
  ArrowUpToLine,
  TrendingUp,
  Landmark,
  Users,
  Send,
  FileText,
  Camera,
} from "lucide-react";
import html2canvas from "html2canvas";

function formatDateTime(date) {
  if (!date) return new Date().toLocaleString();
  const d = new Date(date);
  if (isNaN(d.getTime())) return String(date);
  return d.toLocaleString();
}

function formatAmount(value, decimals = 8) {
  const num = Number(value || 0);
  if (!isFinite(num)) return "0.00";
  return num.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: decimals,
  });
}

function getVoucherIcon(type) {
  switch (type) {
    case "convert":
      return ArrowRightLeft;
    case "deposit":
      return ArrowDownToLine;
    case "withdraw":
      return ArrowUpToLine;
    case "trade":
      return TrendingUp;
    case "loan":
      return Landmark;
    case "joint_account":
      return Users;
    case "transfer":
      return Send;
    case "kyc":
      return FileText;
    default:
      return CheckCircle2;
  }
}

function getVoucherColor(type) {
  switch (type) {
    case "convert":
      return "from-cyan-500/20 to-cyan-600/10 border-cyan-400/30";
    case "deposit":
      return "from-emerald-500/20 to-emerald-600/10 border-emerald-400/30";
    case "withdraw":
      return "from-amber-500/20 to-amber-600/10 border-amber-400/30";
    case "trade":
      return "from-cyan-500/20 to-lime-600/10 border-cyan-500/30";
    case "loan":
      return "from-violet-500/20 to-violet-600/10 border-violet-400/30";
    case "joint_account":
      return "from-indigo-500/20 to-indigo-600/10 border-indigo-400/30";
    case "transfer":
      return "from-fuchsia-500/20 to-fuchsia-600/10 border-fuchsia-400/30";
    default:
      return "from-slate-500/20 to-slate-600/10 border-slate-400/30";
  }
}

function VoucherRow({ label, value, valueClassName = "text-white" }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-white/5 pb-2 last:border-0">
      <span className="text-sm text-slate-400">{label}</span>
      <span className={`text-right text-sm font-semibold ${valueClassName}`}>
        {value}
      </span>
    </div>
  );
}

export default function VoucherModal({ voucher, onClose }) {
  const [isVisible, setIsVisible] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const voucherRef = useRef(null);
  const modalContainerRef = useRef(null);

  const Icon = getVoucherIcon(voucher?.type);
  const colorClass = getVoucherColor(voucher?.type);

  // Handle escape key press
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, []);

  // Animate in on mount
  useEffect(() => {
    requestAnimationFrame(() => {
      setIsVisible(true);
    });
    // Prevent body scroll
    document.body.style.overflow = 'hidden';
    
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  const handleClose = () => {
    if (isClosing) return; // Prevent multiple close attempts
    
    setIsClosing(true);
    setIsVisible(false);
    
    // Wait for animation to complete before calling onClose
    setTimeout(() => {
      // SAFE CLEANUP: Only try to remove if the element exists and is a child
      if (modalContainerRef.current && modalContainerRef.current.parentNode) {
        // Don't manually remove - let React handle it
      }
      onClose();
    }, 300);
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  };

  const handleScreenshot = async () => {
    if (!voucherRef.current) return;
    try {
      setCapturing(true);
      const canvas = await html2canvas(voucherRef.current, {
        scale: 2,
        backgroundColor: "#0b1630",
        logging: false,
      });
      const link = document.createElement("a");
      link.download = `VexaTrade-${voucher?.type}-${Date.now()}.png`;
      link.href = canvas.toDataURL();
      link.click();
    } catch (error) {
      console.error("Screenshot failed:", error);
    } finally {
      setCapturing(false);
    }
  };

  if (!voucher) return null;

  const renderVoucherContent = () => {
    switch (voucher.type) {
      case "convert":
        return (
          <>
            <VoucherRow
              label="From"
              value={`${formatAmount(voucher.data?.fromAmount)} ${voucher.data?.fromCoin || "USDT"}`}
            />
            <VoucherRow
              label="To"
              value={`${formatAmount(voucher.data?.receiveAmount)} ${voucher.data?.toCoin || "BTC"}`}
              valueClassName="text-emerald-300"
            />
            <VoucherRow label="Rate" value={voucher.data?.rateText || "--"} />
            <VoucherRow
              label="Gross Value"
              value={`${formatAmount(voucher.data?.grossUsdtValue)} USDT`}
            />
            <VoucherRow
              label="Fee"
              value={`${formatAmount(voucher.data?.feeUsdt)} USDT (${voucher.data?.feePercent || 0.2}%)`}
              valueClassName="text-amber-300"
            />
            <VoucherRow
              label="Net Received"
              value={`${formatAmount(voucher.data?.netUsdtValue)} USDT`}
              valueClassName="text-cyan-300"
            />
          </>
        );

      case "deposit":
        return (
          <>
            <VoucherRow label="Deposit ID" value={`#${voucher.data?.id || "--"}`} />
            <VoucherRow label="Coin" value={voucher.data?.coin || "USDT"} />
            <VoucherRow label="Network" value={voucher.data?.network || "--"} />
            <VoucherRow
              label="Amount"
              value={`${formatAmount(voucher.data?.amount)} USDT`}
              valueClassName="text-emerald-300"
            />
            <VoucherRow label="Status" value={voucher.data?.status || "Pending"} />
            <VoucherRow label="Date" value={formatDateTime(voucher.data?.created_at)} />
          </>
        );

      case "withdraw":
        return (
          <>
            <VoucherRow label="Withdrawal ID" value={`#${voucher.data?.id || "--"}`} />
            <VoucherRow label="Coin" value={voucher.data?.coin || "USDT"} />
            <VoucherRow label="Network" value={voucher.data?.network || "--"} />
            <VoucherRow
              label="Amount"
              value={`${formatAmount(voucher.data?.amount)} USDT`}
              valueClassName="text-amber-300"
            />
            <VoucherRow
              label="Fee"
              value={`${formatAmount(voucher.data?.feeAmount)} USDT`}
              valueClassName="text-red-300"
            />
            <VoucherRow
              label="Net Receive"
              value={`${formatAmount(voucher.data?.netAmount)} USDT`}
              valueClassName="text-emerald-300"
            />
            <VoucherRow label="Status" value={voucher.data?.status || "Pending"} />
            <VoucherRow label="Date" value={formatDateTime(voucher.data?.created_at)} />
          </>
        );

      case "trade":
        return (
          <>
            <VoucherRow label="Trade ID" value={`#${voucher.data?.tradeId || "--"}`} />
            <VoucherRow label="Pair" value={voucher.data?.pair || "--"} />
            <VoucherRow
              label="Direction"
              value={voucher.data?.direction || "--"}
              valueClassName={voucher.data?.direction === "bullish" ? "text-emerald-300" : "text-red-300"}
            />
            <VoucherRow label="Timer" value={`${voucher.data?.timer}s`} />
            <VoucherRow
              label="Amount"
              value={`${formatAmount(voucher.data?.amount)} USDT`}
            />
            <VoucherRow
              label="Entry Price"
              value={`${formatAmount(voucher.data?.entryPrice, 8)} USDT`}
            />
            <VoucherRow
              label="Payout %"
              value={`${voucher.data?.payoutPercent}%`}
              valueClassName="text-cyan-400"
            />
            <VoucherRow
              label="Est. Profit"
              value={`+${formatAmount(voucher.data?.expectedProfit)} USDT`}
              valueClassName="text-emerald-300"
            />
          </>
        );

      case "funds":
        return (
          <>
            <VoucherRow label="Fund ID" value={`#${voucher.data?.fund_id || "--"}`} />
            <VoucherRow label="Plan" value={voucher.data?.plan_name || "--"} />
            <VoucherRow
              label="Amount"
              value={`${formatAmount(voucher.data?.amount)} USDT`}
              valueClassName="text-emerald-300"
            />
            <VoucherRow
              label="Daily Profit Rate"
              value={`${voucher.data?.selected_daily_profit_percent}%`}
              valueClassName="text-cyan-300"
            />
            <VoucherRow label="Duration" value={`${voucher.data?.total_days} days`} />
            <VoucherRow label="Start Date" value={formatDateTime(voucher.data?.started_at)} />
            <VoucherRow label="End Date" value={formatDateTime(voucher.data?.ends_at)} />
          </>
        );

      case "loan":
        return (
          <>
            <VoucherRow label="Loan ID" value={`#${voucher.data?.id || "--"}`} />
            <VoucherRow
              label="Amount"
              value={`${formatAmount(voucher.data?.amount)} USDT`}
              valueClassName="text-emerald-300"
            />
            <VoucherRow
              label="Interest Rate"
              value={`${voucher.data?.interestRate}%`}
            />
            <VoucherRow label="Interest Type" value={voucher.data?.interestType || "weekly"} />
            <VoucherRow
              label="Total Interest"
              value={`${formatAmount(voucher.data?.interestAmount)} USDT`}
              valueClassName="text-amber-300"
            />
            <VoucherRow
              label="Total Repayment"
              value={`${formatAmount(voucher.data?.totalRepayment)} USDT`}
              valueClassName="text-cyan-400"
            />
            <VoucherRow label="Status" value={voucher.data?.status || "Pending"} />
          </>
        );

      case "joint_account":
        return (
          <>
            <VoucherRow label="Request ID" value={`#${voucher.data?.requestId || "--"}`} />
            <VoucherRow label="Partner Email" value={voucher.data?.partnerEmail || "--"} />
            <VoucherRow label="Partner UID" value={voucher.data?.partnerUid || "--"} />
            <VoucherRow label="Status" value="Pending System Approval" valueClassName="text-amber-300" />
            <VoucherRow label="Requested" value={formatDateTime(voucher.data?.created_at)} />
          </>
        );

      case "transfer":
        return (
          <>
            <VoucherRow label="Transfer ID" value={`#${voucher.data?.transfer_id || "--"}`} />
            <VoucherRow label="To User" value={voucher.data?.to || "--"} />
            <VoucherRow
              label="Amount"
              value={`${formatAmount(voucher.data?.amount)} USDT`}
              valueClassName="text-red-300"
            />
            <VoucherRow
              label="Remaining Balance"
              value={`${formatAmount(voucher.data?.remaining_balance)} USDT`}
              valueClassName="text-emerald-300"
            />
            <VoucherRow label="Date" value={formatDateTime(voucher.data?.created_at)} />
          </>
        );

      case "kyc":
        return (
          <>
            <VoucherRow label="Submission ID" value={`#${voucher.data?.id || "--"}`} />
            <VoucherRow label="Document Type" value={voucher.data?.document_type || "--"} />
            <VoucherRow label="Status" value="Pending Review" valueClassName="text-amber-300" />
            <VoucherRow label="Submitted" value={formatDateTime(voucher.data?.submitted_at)} />
          </>
        );

      default:
        return (
          <VoucherRow label="Transaction" value="Completed Successfully" valueClassName="text-emerald-300" />
        );
    }
  };

  return (
    <div
      ref={modalContainerRef}
      className={`
        fixed inset-0 z-[250] flex items-end justify-center bg-[#050812]/80 p-0
        transition-all duration-300 sm:items-center sm:p-4
        ${isVisible ? "bg-[#050812]/80 opacity-100" : "bg-[#050812]/0 opacity-0 pointer-events-none"}
      `}
      onClick={handleBackdropClick}
    >
      <div
        ref={voucherRef}
        className={`
          w-full max-w-md rounded-t-[34px] border bg-gradient-to-br
          shadow-2xl transition-all duration-300 sm:rounded-[34px]
          ${colorClass}
          ${isVisible ? "translate-y-0 opacity-100" : "translate-y-full opacity-0 sm:translate-y-0 sm:scale-95"}
        `}
        onClick={(e) => e.stopPropagation()}
        style={{ background: "#0b1630" }}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10">
              <Icon size={20} className="text-cyan-400" />
            </div>
            <div>
              <div className="text-[22px] font-bold text-white">
                {voucher.title || "Transaction Complete"}
              </div>
              <div className="mt-0.5 text-xs text-slate-400">
                Transaction Receipt
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-full p-2 text-slate-400 transition hover:bg-white/10 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <div className="mb-4 flex justify-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15">
              <CheckCircle2 size={32} className="text-emerald-400" />
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#050812]/30 p-4">
            <div className="space-y-3">{renderVoucherContent()}</div>
          </div>

          <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-3 text-center">
            <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
              Transaction ID
            </div>
            <div className="mt-1 font-mono text-xs text-slate-300 break-all">
              {voucher.transactionId || `CP-${Date.now()}`}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <button
              type="button"
              onClick={handleClose}
              className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/[0.08]"
            >
              Close
            </button>

            <button
              type="button"
              onClick={handleScreenshot}
              disabled={capturing}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-cyan-500 px-4 py-3 text-sm font-semibold text-black transition hover:bg-cyan-400 disabled:opacity-60"
            >
              {capturing ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-black border-t-transparent" />
                  Capturing...
                </>
              ) : (
                <>
                  <Camera size={16} />
                  Screenshot
                </>
              )}
            </button>
          </div>
        </div>

        <div className="border-t border-white/10 px-5 py-3">
          <div className="text-center text-[10px] text-slate-500">
            VexaTrade • Secure Transaction Record
          </div>
        </div>
      </div>
    </div>
  );
}
