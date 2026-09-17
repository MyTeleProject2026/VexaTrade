import { useContext, createContext, useState, useCallback, useRef, useEffect } from "react";

const NotificationContext = createContext(null);
const GLOBAL_TRANSACTION_RECEIPT_TYPES = new Set([
  "convert",
  "transfer",
  "trade",
  "funds",
  "loan",
  "profit-withdrawal",
]);

export function NotificationProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [voucher, setVoucher] = useState(null);
  const [voucherKey, setVoucherKey] = useState(0);
  const closeTimeoutRef = useRef(null);
  const voucherTimeoutRef = useRef(null);

  const showToast = useCallback((message, type = "info", duration = 4000) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, duration);
  }, []);

  const showSuccess = useCallback((message, duration = 4000) => {
    showToast(message, "success", duration);
  }, [showToast]);

  const showError = useCallback((message, duration = 5000) => {
    showToast(message, "error", duration);
  }, [showToast]);

  const showWarning = useCallback((message, duration = 4000) => {
    showToast(message, "warning", duration);
  }, [showToast]);

  const showInfo = useCallback((message, duration = 3000) => {
    showToast(message, "info", duration);
  }, [showToast]);

  const closeVoucher = useCallback(() => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    if (voucherTimeoutRef.current) {
      clearTimeout(voucherTimeoutRef.current);
      voucherTimeoutRef.current = null;
    }

    document.body.style.overflow = '';
    document.body.style.pointerEvents = '';
    setVoucher(null);
  }, []);

  const showVoucher = useCallback((voucherData) => {
    // Convert/transfer/trade/funds/loan/profit-withdrawal now have the
    // single global full-screen TransactionResultModal. Keep this legacy
    // voucher path for deposit/withdraw and unrelated voucher types so
    // existing functionality is preserved without double receipts.
    const type = String(voucherData?.type || '').trim().toLowerCase();
    if (GLOBAL_TRANSACTION_RECEIPT_TYPES.has(type)) return;

    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }

    if (voucherTimeoutRef.current) {
      clearTimeout(voucherTimeoutRef.current);
      voucherTimeoutRef.current = null;
    }

    setVoucher(null);

    voucherTimeoutRef.current = setTimeout(() => {
      setVoucher(voucherData);
      setVoucherKey(prev => prev + 1);
      voucherTimeoutRef.current = null;
    }, 50);
  }, []);

  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current);
      }
      if (voucherTimeoutRef.current) {
        clearTimeout(voucherTimeoutRef.current);
      }
    };
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  return (
    <NotificationContext.Provider
      value={{
        toasts,
        voucher,
        voucherKey,
        showSuccess,
        showError,
        showWarning,
        showInfo,
        showVoucher,
        closeVoucher,
        removeToast,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotification() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error("useNotification must be used within NotificationProvider");
  }
  return context;
}
