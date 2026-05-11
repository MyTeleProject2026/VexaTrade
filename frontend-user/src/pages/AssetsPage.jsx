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

function buildFallbackAssets(balance, markets) {
  const total = Number(balance || 0);

  const config = [
    { symbol: "USDT", percent: 62 },
    { symbol: "BTC", percent: 14 },
    { symbol: "ETH", percent: 10 },
    { symbol: "SOL", percent: 6 },
    { symbol: "BNB", percent: 5 },
    { symbol: "XRP", percent: 3 },
  ];

  return config.map((item) => {
    const usdtValue = (total * item.percent) / 100;
    const unitPrice = getCoinPriceInUsdt(item.symbol, markets);
    const amount = unitPrice > 0 ? usdtValue / unitPrice : usdtValue;

    return {
      symbol: item.symbol,
      amount,
      usdtValue,
      unitPrice,
      avgPrice: unitPrice,
      spotPnl: 0,
      spotPnlPercent: 0,
      accent: getCoinAccent(item.symbol),
      apr: item.symbol === "USDT" ? "Up to 50% APR" : "",
    };
  });
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
      };
    })
    .filter(Boolean)
    .sort((a, b) => Number(b.usdtValue || 0) - Number(a.usdtValue || 0));
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

function AssetRow({ item }) {
  const pnlPositive = Number(item.spotPnl || 0) >= 0;

  return (
    <div className="flex items-center justify-between gap-3 rounded-[24px] border border-white/5 bg-white/[0.02] px-3 py-3 sm:px-4">
      <div className="flex min-w-0 items-center gap-3">
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${item.accent} text-xs font-bold text-white ring-1 ring-white/10 sm:h-12 sm:w-12 sm:text-sm`}
        >
          {item.symbol.slice(0, 3)}
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <div className="truncate text-base font-semibold text-white sm:text-lg">
              {item.symbol}
            </div>

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

// QR Transfer Modal Component
function QrTransferModal({ isOpen, onClose, onTransferComplete }) {
  const [mode, setMode] = useState("send");
  const [scanning, setScanning] = useState(false);
  const [scannedUser, setScannedUser] = useState(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [myQrCode, setMyQrCode] = useState(null);
  const [qrCodeError, setQrCodeError] = useState(false);
  const [userUid, setUserUid] = useState("");
  const [userName, setUserName] = useState("");
  
  const token = localStorage.getItem("userToken") || localStorage.getItem("token") || "";
  const { showSuccess, showError, showVoucher } = useNotification();

  // API Base URL
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "https://vexatrade-server.onrender.com";

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
      if (data.success && data.data?.qr_code_url) {
        const qrUrl = data.data.qr_code_url;
        setMyQrCode(qrUrl);
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
      return;
    }
    try {
      setScanning(true);
      const res = await fetch(`${API_BASE_URL}/api/user/by-uid/${uid}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setScannedUser(data.data);
        showSuccess(`Found user: ${data.data.name || data.data.email}`);
      } else {
        showError("User not found. Please check the UID.");
        setScannedUser(null);
      }
    } catch (err) {
      showError("Failed to find user");
      setScannedUser(null);
    } finally {
      setScanning(false);
    }
  }

  function handleManualUidInput(e) {
    if (e.key === "Enter") {
      findUserByUid(e.target.value);
    }
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
        onClose();
        setScannedUser(null);
        setAmount("");
        setNote("");
      } else {
        showError(data.message || "Transfer failed");
      }
    } catch (err) {
      showError("Transfer failed. Please try again.");
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
    if (url.startsWith("http://") || url.startsWith("https://")) return url;
    return `${API_BASE_URL}${url}`;
  }

  if (!isOpen) return null;

  return (
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
              <label className="mt-2 flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-cyan-500 py-3 text-sm font-semibold text-black transition hover:bg-cyan-400">
                <Camera size={18} />
                Scan QR Code
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const uid = prompt("Enter the UID from the QR code:");
                      if (uid) findUserByUid(uid);
                    }
                    e.target.value = "";
                  }}
                />
              </label>
            </div>

            {scanning && (
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
  );
}

export default function AssetsPage() {
  const navigate = useNavigate();
  const { showError, showSuccess, showVoucher } = useNotification();

  const token =
    localStorage.getItem("userToken") ||
    localStorage.getItem("token") ||
    localStorage.getItem("accessToken") ||
    "";

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [showQrModal, setShowQrModal] = useState(false);
  const [wallet, setWallet] = useState({
    balance: 0,
    user: null,
    walletLabel: "Main Wallet",
  });
  const [markets, setMarkets] = useState([]);
  const [holdings, setHoldings] = useState([]);
  const [openTrades, setOpenTrades] = useState([]);
  const [notifications, setNotifications] = useState([]);
  
  // Joint Account State
  const [jointAccount, setJointAccount] = useState(null);
  const [jointPartner, setJointPartner] = useState(null);
  const [combinedBalance, setCombinedBalance] = useState(null);
  const [jointBalanceData, setJointBalanceData] = useState(null);

  // Function to calculate holdings from convert transactions
  async function loadHoldingsFromConvertHistory() {
    try {
      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "https://vexatrade-server.onrender.com";
      const res = await fetch(`${API_BASE_URL}/api/convert/history`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      
      if (data.success && Array.isArray(data.data)) {
        const convertTxns = data.data;
        const holdingsMap = new Map();
        
        holdingsMap.set("USDT", {
          symbol: "USDT",
          amount: Number(wallet.balance || 0),
          usdtValue: Number(wallet.balance || 0),
          unitPrice: 1,
          avgPrice: 1,
          spotPnl: 0,
          spotPnlPercent: 0,
          accent: getCoinAccent("USDT"),
          apr: "Up to 50% APR"
        });
        
        for (const tx of convertTxns) {
          const fromCoin = tx.from_coin?.toUpperCase();
          const toCoin = tx.to_coin?.toUpperCase();
          const fromAmount = Number(tx.from_amount || 0);
          const receiveAmount = Number(tx.receive_amount || tx.to_amount || 0);
          
          if (fromCoin && fromCoin !== "USDT") {
            const current = holdingsMap.get(fromCoin);
            if (current) {
              current.amount = Math.max(0, current.amount - fromAmount);
              if (current.amount < 0.00000001) {
                holdingsMap.delete(fromCoin);
              } else {
                holdingsMap.set(fromCoin, current);
              }
            }
          }
          
          if (toCoin && toCoin !== "USDT" && receiveAmount > 0) {
            const current = holdingsMap.get(toCoin);
            const price = getCoinPriceInUsdt(toCoin, markets);
            
            if (current) {
              current.amount = (current.amount || 0) + receiveAmount;
              current.usdtValue = current.amount * price;
              holdingsMap.set(toCoin, current);
            } else {
              holdingsMap.set(toCoin, {
                symbol: toCoin,
                amount: receiveAmount,
                usdtValue: receiveAmount * price,
                unitPrice: price,
                avgPrice: price,
                spotPnl: 0,
                spotPnlPercent: 0,
                accent: getCoinAccent(toCoin),
                apr: ""
              });
            }
          }
        }
        
        const calculatedHoldings = Array.from(holdingsMap.values())
          .filter(item => item.amount > 0.00000001 && item.symbol !== "USDT")
          .sort((a, b) => b.usdtValue - a.usdtValue);
        
        if (calculatedHoldings.length > 0) {
          setHoldings(calculatedHoldings);
        }
      }
    } catch (err) {
      console.error("Failed to load convert history:", err);
    }
  }

  async function loadData(silent = false) {
    try {
      if (!silent) setLoading(true);
      else setRefreshing(true);

      setError("");

      const tasks = [
        userApi.getWalletSummary(token),
        marketApi.home(),
        typeof tradeApi?.open === "function" ? tradeApi.open(token) : Promise.resolve({ data: { data: [] } }),
        typeof userApi?.getNotifications === "function"
          ? userApi.getNotifications(token)
          : Promise.resolve({ data: { data: [] } }),
        userApi.getJointAccountStatus(token),
      ];

      if (typeof userApi?.getAssetHoldings === "function") {
        tasks.push(userApi.getAssetHoldings(token));
      } else if (typeof userApi?.getAssets === "function") {
        tasks.push(userApi.getAssets(token));
      } else if (typeof userApi?.getPortfolioAssets === "function") {
        tasks.push(userApi.getPortfolioAssets(token));
      } else {
        tasks.push(Promise.resolve({ data: { data: [] } }));
      }

      tasks.push(
        fetch(`${import.meta.env.VITE_API_BASE_URL || "https://vexatrade-server.onrender.com"}/api/joint-account/combined-balance`, {
          headers: { Authorization: `Bearer ${token}` }
        }).then(res => res.json())
      );

      const [walletRes, marketRes, openTradeRes, notificationRes, jointRes, holdingsRes, combinedRes] =
        await Promise.allSettled(tasks);

      if (walletRes.status === "fulfilled") {
        const data = walletRes.value?.data?.data || {};
        setWallet({
          balance: Number(data.balance || 0),
          user: data.user || null,
          walletLabel: data.walletLabel || "Main Wallet",
        });
        
        if (!silent) {
          await loadHoldingsFromConvertHistory();
        }
      }

      if (marketRes.status === "fulfilled") {
        const rows = Array.isArray(marketRes.value?.data?.data)
          ? marketRes.value.data.data
          : [];
        setMarkets(rows);
      }

      if (openTradeRes.status === "fulfilled") {
        setOpenTrades(
          Array.isArray(openTradeRes.value?.data?.data)
            ? openTradeRes.value.data.data
            : []
        );
      }

      if (notificationRes.status === "fulfilled") {
        setNotifications(
          Array.isArray(notificationRes.value?.data?.data)
            ? notificationRes.value.data.data
            : []
        );
      }

      if (combinedRes.status === "fulfilled" && combinedRes.value?.success) {
        const balanceData = combinedRes.value.data;
        setJointBalanceData(balanceData);
        
        if (balanceData.hasJointAccount) {
          setCombinedBalance(balanceData.combinedBalance);
          setJointPartner({
            name: balanceData.partnerName,
            uid: balanceData.partnerUid,
            balance: balanceData.partnerBalance
          });
        } else {
          setCombinedBalance(null);
          setJointPartner(null);
        }
      }

      if (jointRes.status === "fulfilled" && jointRes.value?.data?.success) {
        const jointData = jointRes.value.data.data;
        if (jointData.hasJointAccount && jointData.jointAccount) {
          setJointAccount(jointData.jointAccount);
        } else {
          setJointAccount(null);
        }
      }

      if (holdingsRes.status === "fulfilled") {
        const rows =
          holdingsRes.value?.data?.data?.assets ||
          holdingsRes.value?.data?.data?.holdings ||
          holdingsRes.value?.data?.assets ||
          holdingsRes.value?.data?.holdings ||
          holdingsRes.value?.data?.data ||
          [];

        if (Array.isArray(rows) && rows.length > 0) {
          setHoldings(rows);
        }
      }
    } catch (err) {
      showError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  function handleTransferComplete() {
    loadData(true);
  }

  useEffect(() => {
    loadData();

    const interval = setInterval(() => {
      loadData(true);
    }, 10000);

    const onFocus = () => loadData(true);
    const onStorage = (e) => {
      if (e.key === "VexaTrade_assets_refresh") {
        loadData(true);
      }
    };

    window.addEventListener("focus", onFocus);
    window.addEventListener("storage", onStorage);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const displayBalance = combinedBalance !== null ? combinedBalance : Number(wallet.balance || 0);
  const totalBalance = displayBalance;
  
  const normalizedHoldings = useMemo(() => {
    if (holdings.length > 0) {
      return normalizeHoldings(holdings, markets);
    }
    return buildFallbackAssets(Number(wallet.balance || 0), markets);
  }, [holdings, wallet.balance, markets]);

  const totalSpotPnl = useMemo(() => {
    return normalizedHoldings.reduce(
      (sum, item) => sum + Number(item.spotPnl || 0),
      0
    );
  }, [normalizedHoldings]);

  const totalInvested = useMemo(() => {
    return normalizedHoldings.reduce((sum, item) => {
      return sum + Number(item.usdtValue || 0) - Number(item.spotPnl || 0);
    }, 0);
  }, [normalizedHoldings]);

  const pnlPercent = useMemo(() => {
    if (!totalInvested) return 0;
    return (totalSpotPnl / totalInvested) * 100;
  }, [totalSpotPnl, totalInvested]);

  const tradingAmount = useMemo(() => {
    return openTrades.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  }, [openTrades]);

  const unreadNotifications = useMemo(() => {
    return notifications.filter((item) => !Number(item?.is_read)).length;
  }, [notifications]);

  if (loading) {
    return (
      <div className="space-y-5 bg-[#050812] p-3 sm:p-5">
        <section className="rounded-[28px] border border-white/10 bg-[#0a0e1a] p-5 text-sm text-slate-300 shadow-2xl">
          Loading assets...
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-5 bg-[#050812] px-2 pb-24 pt-3 sm:px-5 xl:pb-8">
      <section className="rounded-[30px] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.18),transparent_18%),linear-gradient(180deg,#0a0e1a_0%,#050812_100%)] p-4 shadow-[0_18px_60px_rgba(0,0,0,0.42)] sm:p-5">
        <div className="flex items-center justify-between">
          <div className="text-lg font-semibold text-white sm:text-xl">Assets</div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigate("/transactions")}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-white transition hover:bg-white/[0.06]"
            >
              <Bell size={17} />
            </button>

            <button
              type="button"
              onClick={() => loadData(true)}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-white transition hover:bg-white/[0.06]"
            >
              <RefreshCw size={17} className={refreshing ? "animate-spin" : ""} />
            </button>
          </div>
        </div>

        <div className="mt-6">
          <div className="text-sm text-slate-400">
            {combinedBalance !== null ? "Combined Total Value" : "Est total value"}
          </div>
          <div className="mt-2 flex items-end gap-2">
            <div className="text-4xl font-bold tracking-tight text-white sm:text-5xl">
              {formatMoney(displayBalance)}
            </div>
            <div className="mb-1 text-lg font-semibold text-white sm:text-xl">USD</div>
          </div>

          {jointBalanceData?.hasJointAccount && (
            <div className="mt-2 text-xs text-slate-500">
              Your balance: {formatMoney(jointBalanceData.userBalance)} USDT + 
              {jointPartner?.name}'s balance: {formatMoney(jointBalanceData.partnerBalance)} USDT
            </div>
          )}

          <button
            type="button"
            onClick={() => navigate("/transactions")}
            className="mt-3 inline-flex items-center gap-1.5 text-sm text-slate-400 transition hover:text-white sm:text-base"
          >
            <span>
              Today&apos;s PnL {totalSpotPnl >= 0 ? "+" : "-"}$
              {formatMoney(Math.abs(totalSpotPnl))} ({totalSpotPnl >= 0 ? "+" : ""}
              {Number(pnlPercent).toFixed(2)}%)
            </span>
            <ChevronRight size={16} />
          </button>
        </div>

        <div className="mt-6 grid grid-cols-4 gap-2 sm:gap-3">
          <CircleAction
            icon={ArrowDownToLine}
            label="Deposit"
            onClick={() => navigate("/deposit")}
          />
          <CircleAction
            icon={ArrowUpToLine}
            label="Withdraw"
            onClick={() => navigate("/withdraw")}
          />
          <CircleAction
            icon={ArrowRightLeft}
            label="Convert"
            onClick={() => navigate("/convert")}
          />
          <CircleAction
            icon={QrCode}
            label="Transfer"
            onClick={() => setShowQrModal(true)}
          />
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-white sm:text-3xl">Portfolio</h2>

          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-slate-300 transition hover:bg-white/[0.06]"
          >
            <SlidersHorizontal size={17} />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <PortfolioCard
            value={displayBalance < 0.01 ? "$<0.01" : `$${formatMoney(displayBalance)}`}
            title={combinedBalance !== null ? "Combined Balance" : "Funding"}
            subtext={combinedBalance !== null && jointPartner 
              ? `${jointPartner.name || "Partner"} + You` 
              : `${normalizedHoldings.length} assets`}
          />
          <PortfolioCard
            value={tradingAmount < 0.01 ? "$0" : `$${formatMoney(tradingAmount)}`}
            title="Trading"
            subtext={`${openTrades.length} open trade${openTrades.length === 1 ? "" : "s"}`}
          />
          <PortfolioCard
            value={String(unreadNotifications)}
            title="Notification"
            subtext={unreadNotifications === 1 ? "Unread alert" : "Unread alerts"}
          />
        </div>

        {jointAccount && jointPartner && jointBalanceData && (
          <PortfolioCard
            value={`${formatMoney(jointBalanceData.userBalance)} + ${formatMoney(jointBalanceData.partnerBalance)}`}
            title={`Joint Account: You + ${jointPartner.name || jointPartner.uid}`}
            subtext={`Total: ${formatMoney(jointBalanceData.combinedBalance)} USDT • Account ID: ${jointAccount.account_id}`}
            icon={Users}
            tone="text-cyan-300"
          />
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold text-white sm:text-3xl">Crypto</h2>
            <div className="mt-1 flex justify-between gap-3 text-xs text-slate-500 sm:text-sm">
              <span>Name/Amount</span>
            </div>
          </div>

          <div className="text-right text-xs text-slate-500 sm:text-sm">
            Value/Spot PnL
          </div>
        </div>

        <div className="space-y-2.5">
          {normalizedHoldings.map((item) => (
            <AssetRow key={item.symbol} item={item} />
          ))}
        </div>
      </section>

      <section className="rounded-[28px] border border-white/10 bg-[#0a0e1a] p-4 shadow-[0_16px_50px_rgba(0,0,0,0.32)] sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-2xl font-bold text-white sm:text-3xl">
            Recent funding history
          </h2>
          <button
            type="button"
            onClick={() => navigate("/transactions")}
            className="text-slate-300 transition hover:text-white"
          >
            <ChevronRight size={20} />
          </button>
        </div>

        <div className="mt-4">
          <HistoryRow
            title="Place an order"
            date={new Date().toLocaleString()}
            amount={`-${formatMoney(displayBalance > 0 ? Math.min(displayBalance, 371) : 0)} USDT`}
            negative
          />
        </div>
      </section>

      {/* QR Transfer Modal */}
      <QrTransferModal
        isOpen={showQrModal}
        onClose={() => setShowQrModal(false)}
        onTransferComplete={handleTransferComplete}
      />
    </div>
  );
}
