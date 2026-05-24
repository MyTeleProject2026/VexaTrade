import QRScanner from "../components/QRScanner";
import TransferConfirmModal from "../components/TransferConfirmModal";
import { getRecentContacts, addRecentContact } from "../utils/recentContacts";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowDownToLine,
  ArrowUpToLine,
  ArrowRightLeft,
  Bell,
  RefreshCw,
  SlidersHorizontal,
  ChevronRight,
  QrCode,
  X,
  User,
  Copy,
  Check,
  Camera,
  Send,
  Users,
} from "lucide-react";

import {
  userApi,
  marketApi,
  tradeApi,
  getApiErrorMessage,
} from "../services/api";
import { useNotification } from "../hooks/useNotification";

function formatMoney(value) {
  const num = Number(value || 0);
  if (!Number.isFinite(num)) return "0.00";
  return num.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatAmount(value, digits = 8) {
  const num = Number(value || 0);
  if (!Number.isFinite(num)) return "0";
  return num.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  });
}

// ✅ FIX: Coin logos with proper icons and colors
const COIN_LOGOS = {
  USDT: { icon: "₮", color: "#26A17B", name: "Tether" },
  BTC: { icon: "₿", color: "#F7931A", name: "Bitcoin" },
  ETH: { icon: "Ξ", color: "#627EEA", name: "Ethereum" },
  BNB: { icon: "ⓑ", color: "#F3BA2F", name: "BNB" },
  SOL: { icon: "◎", color: "#00FFBD", name: "Solana" },
  XRP: { icon: "✕", color: "#23292F", name: "XRP" },
};

function getCoinPriceInUsdt(symbol, markets = []) {
  const upper = String(symbol || "").toUpperCase();
  if (upper === "USDT") return 1;

  const pair = `${upper}USDT`;
  const row = markets.find(
    (item) => String(item.symbol || "").toUpperCase() === pair
  );

  return Number(row?.lastPrice || row?.price || 0);
}

function getCoinAccent(symbol) {
  const map = {
    USDT: "from-cyan-400/30 to-cyan-500/10",
    BTC: "from-orange-400/30 to-orange-500/10",
    ETH: "from-indigo-400/30 to-indigo-500/10",
    SOL: "from-fuchsia-400/30 to-fuchsia-500/10",
    BNB: "from-yellow-400/30 to-yellow-500/10",
    XRP: "from-sky-400/30 to-sky-500/10",
  };

  return (
    map[String(symbol || "").toUpperCase()] || "from-slate-400/20 to-slate-500/10"
  );
}

function normalizeHoldings(rawRows = [], markets = []) {
  return rawRows
    .map((row) => {
      const symbol = String(
        row?.symbol ||
          row?.coin ||
          row?.asset ||
          row?.currency ||
          ""
      ).toUpperCase();

      if (!symbol) return null;

      const amount = Number(
        row?.amount ??
          row?.balance ??
          row?.quantity ??
          row?.free ??
          row?.total ??
          0
      );

      const currentPrice =
        Number(
          row?.current_price ??
            row?.market_price ??
            row?.price_usdt ??
            row?.price
        ) || getCoinPriceInUsdt(symbol, markets);

      const avgPrice = Number(
        row?.avg_price ??
          row?.average_price ??
          row?.buy_price ??
          row?.entry_price ??
          row?.cost_basis_price ??
          currentPrice
      );

      const usdtValue =
        Number(row?.usdt_value ?? row?.value_usdt ?? row?.value) ||
        amount * currentPrice;

      let spotPnl = Number(
        row?.spot_pnl ??
          row?.profit_loss ??
          row?.unrealized_pnl ??
          row?.pnl
      );

      if (!Number.isFinite(spotPnl)) {
        spotPnl = (currentPrice - avgPrice) * amount;
      }

      const invested = avgPrice * amount;
      const spotPnlPercent =
        invested > 0 ? (spotPnl / invested) * 100 : 0;

      return {
        symbol,
        amount,
        usdtValue,
        unitPrice: currentPrice,
        avgPrice,
        spotPnl,
        spotPnlPercent,
        accent: getCoinAccent(symbol),
        apr: symbol === "USDT" ? "Up to 50% APR" : "",
        logo: COIN_LOGOS[symbol] || { icon: symbol[0], color: "#6B7280" },
      };
    })
    .filter(Boolean)
    .sort((a, b) => Number(b.usdtValue || 0) - Number(a.usdtValue || 0));
}

// ✅ NEW: Fetch real user assets from backend
async function fetchUserAssets(token, markets) {
  try {
    const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "https://vexatrade-server.onrender.com";
    const res = await fetch(`${API_BASE_URL}/api/user/assets`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    
    if (data.success && Array.isArray(data.data?.assets)) {
      return normalizeHoldings(data.data.assets, markets);
    }
    return [];
  } catch (err) {
    console.error("Failed to fetch user assets:", err);
    return [];
  }
}

function CircleAction({ icon: Icon, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center gap-1.5 text-center"
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-cyan-500 text-black shadow-[0_8px_24px_rgba(34,211,238,0.14)] transition hover:scale-[1.02] hover:bg-cyan-400 sm:h-14 sm:w-14">
        <Icon size={20} className="sm:h-[22px] sm:w-[22px]" />
      </div>
      <span className="text-xs font-medium text-white sm:text-sm">{label}</span>
    </button>
  );
}

function PortfolioCard({ title, value, subtext, icon: Icon, tone = "text-white" }) {
  return (
    <div className="rounded-[22px] border border-white/5 bg-[#0a0e1a] p-4 shadow-[0_12px_30px_rgba(0,0,0,0.22)]">
      <div className="flex items-center justify-between">
        <div className="text-xs text-slate-400 sm:text-sm">{title}</div>
        {Icon && <Icon size={18} className="text-slate-500" />}
      </div>
      <div className={`mt-2 text-2xl font-semibold tracking-tight text-white sm:text-[28px] ${tone}`}>
        {value}
      </div>
      {subtext ? (
        <div className="mt-1 text-xs text-slate-500">{subtext}</div>
      ) : null}
    </div>
  );
}

// ✅ FIX: AssetRow with proper coin logos
function AssetRow({ item }) {
  const pnlPositive = Number(item.spotPnl || 0) >= 0;
  const logo = item.logo || COIN_LOGOS[item.symbol] || { icon: item.symbol[0], color: "#6B7280" };

  return (
    <div className="flex items-center justify-between gap-3 rounded-[24px] border border-white/5 bg-white/[0.02] px-3 py-3 sm:px-4">
      <div className="flex min-w-0 items-center gap-3">
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${item.accent} text-lg font-bold text-white ring-1 ring-white/10 sm:h-12 sm:w-12`}
          style={{ color: logo.color }}
        >
          {logo.icon}
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <div className="truncate text-base font-semibold text-white sm:text-lg">
              {item.symbol}
            </div>
            <div className="text-xs text-slate-500">{logo.name}</div>
            {item.apr ? (
              <span className="rounded-md bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-medium text-emerald-300 sm:text-[11px]">
                {item.apr}
              </span>
            ) : null}
          </div>

          <div className="mt-0.5 text-xs text-slate-400 sm:text-sm">
            {formatAmount(item.amount, 8)}
          </div>
        </div>
      </div>

      <div className="text-right">
        <div className="text-base font-semibold text-white sm:text-lg">
          ${item.usdtValue < 0.01 ? "<0.01" : formatMoney(item.usdtValue)}
        </div>
        <div
          className={`mt-0.5 text-[11px] sm:text-xs ${
            pnlPositive ? "text-emerald-300" : "text-red-300"
          }`}
        >
          {pnlPositive ? "+" : ""}
          {formatMoney(item.spotPnl)} USDT
          <span className="ml-1">
            ({pnlPositive ? "+" : ""}
            {Number(item.spotPnlPercent || 0).toFixed(2)}%)
          </span>
        </div>
      </div>
    </div>
  );
}

function HistoryRow({ title, date, amount, negative = false }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-white/5 py-3 last:border-b-0">
      <div className="min-w-0">
        <div className="truncate text-sm font-medium text-white sm:text-base">
          {title}
        </div>
        <div className="mt-1 text-xs text-slate-500 sm:text-sm">{date}</div>
      </div>

      <div
        className={`shrink-0 text-base font-semibold sm:text-lg ${
          negative ? "text-white" : "text-emerald-300"
        }`}
      >
        {amount}
      </div>
    </div>
  );
}

// QR Transfer Modal Component - FIXED VERSION (Replace your existing one)
function QrTransferModal({ isOpen, onClose, onTransferComplete }) {
  const [mode, setMode] = useState("send");
  const [showScanner, setShowScanner] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [scannedUser, setScannedUser] = useState(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [myQrCode, setMyQrCode] = useState(null);
  const [qrCodeError, setQrCodeError] = useState(false);
  const [userUid, setUserUid] = useState("");
  const [userName, setUserName] = useState("");
  const [recentContacts, setRecentContacts] = useState([]);
  
  const token = localStorage.getItem("userToken") || localStorage.getItem("token") || "";
  const { showSuccess, showError, showVoucher } = useNotification();

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "https://vexatrade-server.onrender.com";

  // Load recent contacts on mount
  useEffect(() => {
    setRecentContacts(getRecentContacts());
  }, []);

  useEffect(() => {
    if (isOpen && mode === "receive") {
      loadMyQrCode();
      loadUserProfile();
    }
  }, [isOpen, mode]);

  async function loadUserProfile() {
    try {
      const res = await userApi.getProfile(token);
      if (res?.data?.success) {
        setUserUid(res.data.data.uid);
        setUserName(res.data.data.name);
      }
    } catch (err) {
      console.error("Failed to load profile:", err);
    }
  }

  async function loadMyQrCode() {
    try {
      setQrCodeError(false);
      const res = await fetch(`${API_BASE_URL}/api/user/qr-code`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success && data.data?.qr_code_base64) {
        setMyQrCode(data.data.qr_code_base64);
      } else {
        setQrCodeError(true);
        console.error("QR code generation failed:", data);
      }
    } catch (err) {
      setQrCodeError(true);
      console.error("Failed to load QR code:", err);
    }
  }
  
  async function findUserByUid(uid) {
    if (!uid || uid.length < 5) {
      showError("Please enter a valid UID");
      return null;
    }
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/api/user/by-uid/${uid}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setScannedUser(data.data);
        showSuccess(`Found user: ${data.data.name || data.data.email}`);
        return data.data;
      } else {
        showError("User not found. Please check the UID.");
        setScannedUser(null);
        return null;
      }
    } catch (err) {
      showError("Failed to find user");
      setScannedUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  }

  // ✅ NEW: Handle QR scan success
  async function handleQrScanSuccess(decodedText) {
    try {
      // Try to parse as JSON first (OKX-style format)
      let uid = decodedText;
      try {
        const parsed = JSON.parse(decodedText);
        if (parsed.uid) {
          uid = parsed.uid;
        } else if (parsed.type === "vexatrade" && parsed.uid) {
          uid = parsed.uid;
        }
      } catch {
        // Not JSON, treat as plain UID
        uid = decodedText;
      }
      
      // Clean UID (remove any prefix/suffix)
      const cleanUid = String(uid).trim().toUpperCase();
      
      if (cleanUid) {
        const user = await findUserByUid(cleanUid);
        if (user) {
          // Add to recent contacts
          addRecentContact(user);
          setRecentContacts(getRecentContacts());
          // Automatically proceed to amount entry
        }
      }
    } catch (err) {
      showError("Invalid QR code format");
    }
    setShowScanner(false);
  }

  function handleManualUidInput(e) {
    if (e.key === "Enter") {
      findUserByUid(e.target.value);
    }
  }

  function selectRecentContact(contact) {
    findUserByUid(contact.uid);
  }

  async function handleSendTransfer() {
    if (!scannedUser) {
      showError("Please enter or scan recipient UID first");
      return;
    }
    if (!amount || Number(amount) <= 0) {
      showError("Please enter a valid amount");
      return;
    }
    if (Number(amount) < 1) {
      showError("Minimum transfer amount is 1 USDT");
      return;
    }
    
    // Show confirmation modal instead of sending directly
    setShowConfirm(true);
  }

  async function executeTransfer() {
    if (!scannedUser) return false;
    
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/api/user/transfer`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          recipientUid: scannedUser.uid,
          amount: Number(amount),
          note: note || null
        })
      });
      const data = await res.json();
      if (data.success) {
        showSuccess(`Successfully sent ${amount} USDT to ${scannedUser.name || scannedUser.email}`);
        
        showVoucher({
          title: "Transfer Sent",
          type: "transfer",
          transactionId: data.data?.transfer_id,
          data: {
            transfer_id: data.data?.transfer_id,
            to: scannedUser.uid,
            amount: Number(amount),
            remaining_balance: data.data?.remaining_balance,
            created_at: new Date().toISOString(),
          },
        });
        
        onTransferComplete?.();
        setShowConfirm(false);
        onClose();
        setScannedUser(null);
        setAmount("");
        setNote("");
        return true;
      } else {
        showError(data.message || "Transfer failed");
        return false;
      }
    } catch (err) {
      showError("Transfer failed. Please try again.");
      return false;
    } finally {
      setLoading(false);
    }
  }

  function copyToClipboard(text) {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    showSuccess("UID copied!");
  }

  function getFullImageUrl(url) {
    if (!url) return null;
    if (url && url.startsWith('data:image/')) return url;
    if (url.startsWith("http://") || url.startsWith("https://")) return url;
    return `${API_BASE_URL}${url}`;
  }

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#050812]/80 p-4">
        <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0a0e1a] p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex gap-2">
              <button
                onClick={() => setMode("send")}
                className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                  mode === "send" ? "bg-cyan-500 text-black" : "bg-white/5 text-white"
                }`}
              >
                <Send size={16} className="mr-1 inline" />
                Send
              </button>
              <button
                onClick={() => setMode("receive")}
                className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                  mode === "receive" ? "bg-cyan-500 text-black" : "bg-white/5 text-white"
                }`}
              >
                <QrCode size={16} className="mr-1 inline" />
                Receive
              </button>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-white">
              <X size={20} />
            </button>
          </div>

          {mode === "send" && (
            <div className="space-y-4">
              <div className="rounded-xl border border-white/10 bg-[#0a0e1a] p-4">
                <label className="mb-2 block text-sm text-slate-400">
                  Recipient's UID
                </label>
                <input
                  type="text"
                  placeholder="Enter recipient's UID (e.g., CP00000001)"
                  className="w-full rounded-xl border border-white/10 bg-[#0a0e1a] px-4 py-3 text-white outline-none focus:border-cyan-500"
                  onKeyDown={handleManualUidInput}
                />
                <p className="mt-2 text-center text-xs text-slate-500">or</p>
                
                {/* ✅ FIXED: Real QR Scanner button */}
                <button
                  onClick={() => setShowScanner(true)}
                  className="mt-2 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-cyan-500 py-3 text-sm font-semibold text-black transition hover:bg-cyan-400"
                >
                  <Camera size={18} />
                  Scan QR Code
                </button>
              </div>

              {/* ✅ NEW: Recent Contacts Section */}
              {recentContacts.length > 0 && (
                <div className="rounded-xl border border-white/10 bg-[#0a0e1a] p-4">
                  <label className="mb-2 block text-sm text-slate-400">
                    Recent Contacts
                  </label>
                  <div className="space-y-2">
                    {recentContacts.map((contact) => (
                      <button
                        key={contact.uid}
                        onClick={() => selectRecentContact(contact)}
                        className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-[#050812] p-3 text-left transition hover:bg-white/5"
                      >
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-cyan-500/20">
                          <span className="text-cyan-400 font-semibold">
                            {contact.name?.[0]?.toUpperCase() || "U"}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-white truncate">
                            {contact.name || contact.uid}
                          </div>
                          <div className="text-xs text-slate-500">
                            UID: {contact.uid}
                          </div>
                        </div>
                        <ChevronRight size={16} className="text-slate-500" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {loading && (
                <div className="flex items-center justify-center py-4">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-cyan-500 border-t-transparent" />
                  <span className="ml-2 text-sm text-slate-400">Searching...</span>
                </div>
              )}

              {scannedUser && (
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/20">
                      <User size={18} className="text-emerald-300" />
                    </div>
                    <div>
                      <div className="font-semibold text-white">
                        {scannedUser.name || scannedUser.email}
                      </div>
                      <div className="text-xs text-slate-400">UID: {scannedUser.uid}</div>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="mb-2 block text-sm text-slate-400">Amount (USDT)</label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="Enter amount (minimum 1 USDT)"
                  className="w-full rounded-xl border border-white/10 bg-[#0a0e1a] px-4 py-3 text-white outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm text-slate-400">Note (Optional)</label>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Add a note"
                  className="w-full rounded-xl border border-white/10 bg-[#0a0e1a] px-4 py-3 text-white outline-none focus:border-cyan-500"
                />
              </div>

              <button
                onClick={handleSendTransfer}
                disabled={loading || !scannedUser || !amount}
                className="w-full rounded-xl bg-cyan-500 py-3 font-semibold text-black transition hover:bg-cyan-400 disabled:opacity-50"
              >
                {loading ? "Sending..." : `Send ${amount || "0"} USDT`}
              </button>
            </div>
          )}

          {mode === "receive" && (
            <div className="space-y-4">
              <div className="rounded-xl border border-white/10 bg-[#0a0e1a] p-4 text-center">
                <p className="text-sm text-slate-400">Share this QR code to receive payments</p>
                
                {myQrCode && !qrCodeError ? (
                  <div className="mt-4 flex flex-col items-center">
                    <img
                      src={getFullImageUrl(myQrCode)}
                      alt="Your QR Code"
                      className="h-48 w-48 rounded-xl border border-white/10 bg-white p-2"
                      onError={() => setQrCodeError(true)}
                    />
                    <button
                      onClick={() => copyToClipboard(userUid)}
                      className="mt-4 inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm text-white transition hover:bg-white/5"
                    >
                      {copied ? <Check size={16} /> : <Copy size={16} />}
                      {copied ? "Copied!" : "Copy UID"}
                    </button>
                    <p className="mt-3 text-xs text-slate-500">
                      Your UID: <span className="font-mono text-white">{userUid}</span>
                    </p>
                  </div>
                ) : qrCodeError ? (
                  <div className="mt-4 flex flex-col items-center">
                    <div className="flex h-48 w-48 flex-col items-center justify-center rounded-xl border border-red-500/20 bg-red-500/10">
                      <QrCode size={48} className="text-red-400 mb-2" />
                      <p className="text-xs text-red-400">QR Code unavailable</p>
                      <button
                        onClick={loadMyQrCode}
                        className="mt-3 rounded-lg bg-cyan-500 px-3 py-1 text-xs text-black"
                      >
                        Retry
                      </button>
                    </div>
                    <button
                      onClick={() => copyToClipboard(userUid)}
                      className="mt-4 inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm text-white transition hover:bg-white/5"
                    >
                      {copied ? <Check size={16} /> : <Copy size={16} />}
                      {copied ? "Copied!" : "Copy UID"}
                    </button>
                    <p className="mt-3 text-xs text-slate-500">
                      Your UID: <span className="font-mono text-white">{userUid}</span>
                    </p>
                  </div>
                ) : (
                  <div className="mt-4 flex h-48 items-center justify-center">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-500 border-t-transparent" />
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-white/10 bg-[#0a0e1a] p-4">
                <h3 className="text-sm font-semibold text-white">How to receive:</h3>
                <ol className="mt-2 space-y-2 text-xs text-slate-400">
                  <li>1. Share this QR code with the sender</li>
                  <li>2. Or share your UID: <span className="font-mono text-white">{userUid}</span></li>
                  <li>3. Funds will be credited instantly to your wallet</li>
                </ol>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* QR Scanner Modal */}
      <QRScanner
        isOpen={showScanner}
        onClose={() => setShowScanner(false)}
        onScanSuccess={handleQrScanSuccess}
      />

      {/* Confirmation Modal */}
      <TransferConfirmModal
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={executeTransfer}
        recipient={scannedUser}
        amount={amount}
        note={note}
        isProcessing={loading}
      />
    </>
  );
}
