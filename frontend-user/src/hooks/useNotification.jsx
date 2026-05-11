import { useContext, createContext, useState, useCallback, useRef, useEffect } from "react";

const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [voucher, setVoucher] = useState(null);
  const [voucherKey, setVoucherKey] = useState(0); // ✅ Force re-render
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

  // ✅ FIXED: Force close and clear any pending vouchers
  const closeVoucher = useCallback(() => {
    // Clear any existing timeouts
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    if (voucherTimeoutRef.current) {
      clearTimeout(voucherTimeoutRef.current);
      voucherTimeoutRef.current = null;
    }
    
    // Reset body styles
    document.body.style.overflow = '';
    document.body.style.pointerEvents = '';
    
    // Close the voucher
    setVoucher(null);
  }, []);

  // ✅ FIXED: Properly show voucher with cleanup
  const showVoucher = useCallback((voucherData) => {
    // Clear any pending close timeout
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    
    // Clear any pending voucher timeout
    if (voucherTimeoutRef.current) {
      clearTimeout(voucherTimeoutRef.current);
      voucherTimeoutRef.current = null;
    }
    
    // Close existing voucher first
    setVoucher(null);
    
    // Small delay to ensure cleanup, then show new voucher
    voucherTimeoutRef.current = setTimeout(() => {
      setVoucher(voucherData);
      setVoucherKey(prev => prev + 1); // Force re-render
      voucherTimeoutRef.current = null;
    }, 50);
  }, []);

  // Cleanup on unmount
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
