import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { X, Camera, AlertCircle } from "lucide-react";

export default function QRScanner({ isOpen, onClose, onScanSuccess }) {
  const [error, setError] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const scannerRef = useRef(null);
  const html5QrCodeRef = useRef(null);

  useEffect(() => {
    if (!isOpen) {
      stopScanner();
      return;
    }

    startScanner();

    return () => {
      stopScanner();
    };
  }, [isOpen]);

  const startScanner = async () => {
    try {
      setError(null);
      setIsScanning(true);

      // Create scanner container if not exists
      if (!scannerRef.current) return;

      // Clean up any existing scanner
      if (html5QrCodeRef.current) {
        await html5QrCodeRef.current.stop();
        html5QrCodeRef.current = null;
      }

      // Clear the container
      scannerRef.current.innerHTML = "";
      
      // Create a dedicated div for scanner
      const scannerDiv = document.createElement("div");
      scannerDiv.id = "qr-reader";
      scannerDiv.style.width = "100%";
      scannerDiv.style.minWidth = "250px";
      scannerDiv.style.overflow = "hidden";
      scannerRef.current.appendChild(scannerDiv);

      // Initialize scanner
      const html5QrCode = new Html5Qrcode("qr-reader");
      html5QrCodeRef.current = html5QrCode;

      const config = {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0,
        showTorchButtonIfSupported: true,
      };

      await html5QrCode.start(
        { facingMode: "environment" }, // Use back camera
        config,
        (decodedText) => {
          // Success callback
          stopScanner();
          onScanSuccess(decodedText);
          onClose();
        },
        (errorMessage) => {
          // Error callback - ignore most errors, only show critical ones
          if (errorMessage.includes("No QR code found")) {
            // This is normal, don't show error
            return;
          }
          console.warn("Scan error:", errorMessage);
        }
      );
    } catch (err) {
      console.error("Failed to start scanner:", err);
      setError("Unable to access camera. Please check permissions.");
      setIsScanning(false);
    }
  };

  const stopScanner = async () => {
    try {
      if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
        await html5QrCodeRef.current.stop();
        html5QrCodeRef.current = null;
      }
      if (scannerRef.current) {
        scannerRef.current.innerHTML = "";
      }
    } catch (err) {
      console.warn("Error stopping scanner:", err);
    }
    setIsScanning(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#050812]/90 p-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0a0e1a] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <div className="flex items-center gap-2">
            <Camera size={18} className="text-cyan-400" />
            <span className="font-semibold text-white">Scan QR Code</span>
          </div>
          <button
            onClick={() => {
              stopScanner();
              onClose();
            }}
            className="rounded-full p-1 text-slate-400 hover:text-white transition"
          >
            <X size={20} />
          </button>
        </div>

        {/* Scanner Viewport */}
        <div className="relative bg-black">
          <div
            ref={scannerRef}
            className="w-full aspect-square overflow-hidden"
          />
          
          {/* Viewfinder overlay */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute inset-0 border-2 border-cyan-500/50 rounded-lg m-8 shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]" />
          </div>
          
          {/* Scanning animation */}
          {isScanning && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3/4 h-0.5 bg-cyan-500 animate-pulse rounded-full" />
          )}
          
          {/* Instruction text */}
          <div className="absolute bottom-4 left-0 right-0 text-center">
            <p className="text-xs text-slate-400 bg-black/50 py-2">
              Position the QR code inside the frame
            </p>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="border-t border-white/10 p-4">
            <div className="flex items-center gap-2 text-red-400 text-sm">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
            <button
              onClick={startScanner}
              className="mt-3 w-full rounded-xl bg-cyan-500 py-2 text-sm font-semibold text-black"
            >
              Retry
            </button>
          </div>
        )}

        {/* Footer */}
        <div className="border-t border-white/10 p-4 text-center">
          <p className="text-xs text-slate-500">
            Make sure the QR code is clear and well-lit
          </p>
        </div>
      </div>
    </div>
  );
}
