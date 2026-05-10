import { useContext, createContext, useState, useCallback, useRef } from "react";

const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [voucher, setVoucher] = useState(null);
  const closeTimeoutRef = useRef(null);

  const showToast = useCallback((message, type = "info", duration = 4000) => {
    const id = Date.now();
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

  // ✅ FIXED: Properly close existing voucher before showing new one
  const showVoucher = useCallback((voucherData) => {
    // Clear any existing close timeout
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
    }
    
    // First close the current voucher if it exists
    if (voucher) {
      setVoucher(null);
      // Small delay to ensure cleanup
      setTimeout(() => {
        setVoucher(voucherData);
      }, 100);
    } else {
      setVoucher(voucherData);
    }
  }, [voucher]);

  // ✅ FIXED: Ensure proper cleanup when closing
  const closeVoucher = useCallback(() => {
    // Clear any existing timeout
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
    }
    
    // Reset body styles
    document.body.style.overflow = '';
    document.body.style.pointerEvents = '';
    
    // Close the voucher - let React handle DOM cleanup
    setVoucher(null);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  return (
    <NotificationContext.Provider
      value={{
        toasts,
        voucher,
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
