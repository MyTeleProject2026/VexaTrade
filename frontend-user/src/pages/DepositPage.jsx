import { useEffect, useMemo, useState, useRef } from "react";
import {
  Copy,
  Upload,
  RefreshCw,
  QrCode,
  Wallet,
  ArrowDownToLine,
  Image as ImageIcon,
  Clock,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { depositApi, userApi, getApiErrorMessage } from "../services/api";
import { useNotification } from "../hooks/useNotification";
import { createActionIdempotencyKey, runSingleUserAction } from "../services/actionRequest";

const API_BASE =
  import.meta.env.VITE_API_BASE_URL || "https://vexatrade-5ycu.onrender.com";

function formatAmount(v) {
  const num = Number(v || 0);
  if (!Number.isFinite(num)) return "0.00";
  return num.toFixed(2);
}

function formatTime(date) {
  if (!date) return "--";
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleString();
}

function resolveAssetUrl(url) {
  if (!url) return "";
  if (url && url.startsWith('data:image/')) return url;
  if (url && (url.startsWith("http://") || url.startsWith("https://"))) return url;
  return `${API_BASE}${url}`;
}

function getStatusClass(status) {
  const value = String(status || "").toLowerCase();
  if (["approved", "completed", "success"].includes(value)) return "border border-emerald-500/20 bg-emerald-500/10 text-emerald-300";
  if (["rejected", "failed", "cancelled"].includes(value)) return "border border-red-500/20 bg-red-500/10 text-red-300";
  return "border border-amber-500/20 bg-amber-500/10 text-amber-300";
}

function getStatusIcon(status) {
  const value = String(status || "").toLowerCase();
  if (["approved", "completed", "success"].includes(value)) return <CheckCircle size={20} className="text-emerald-400" />;
  if (["rejected", "failed", "cancelled"].includes(value)) return <XCircle size={20} className="text-red-400" />;
  return <Clock size={20} className="text-amber-400 animate-pulse" />;
}

function GlassCard({ children, className = "" }) {
  return <section className={`rounded-[30px] border border-white/10 bg-[#0a0e1a] shadow-[0_18px_60px_rgba(0,0,0,0.35)] ${className}`}>{children}</section>;
}

function FieldLabel({ children }) { return <label className="mb-2 block text-sm text-slate-400">{children}</label>; }

function ActionButton({ children, onClick, type = "button", disabled = false, variant = "primary", className = "" }) {
  const styles = {
    primary: "bg-cyan-500 text-black hover:bg-cyan-400",
    secondary: "border border-white/10 bg-[#0a0e1a] text-white hover:bg-[#1e1e1e]",
    ghost: "border border-white/10 bg-transparent text-white hover:bg-white/5",
  };
  return <button type={type} onClick={onClick} disabled={disabled} className={`rounded-2xl px-4 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${styles[variant]} ${className}`}>{children}</button>;
}

function StatusBadge({ status }) {
  return <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getStatusClass(status)}`}>{status || "-"}</span>;
}

function LiveVoucher({ deposit, onClose, onRefresh, refreshing }) {
  if (!deposit) return null;
  const status = String(deposit.status || "pending").toLowerCase();
  const isPending = status === "pending";
  const isApproved = status === "approved";
  const isRejected = status === "rejected";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0a0e1a] p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div><h3 className="text-lg font-bold text-white">Deposit Request</h3><p className="text-xs text-slate-400">ID: #{deposit.id}</p></div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition">✕</button>
        </div>
        <div className="mt-4 text-center">
          <div className="flex items-center justify-center gap-2">{getStatusIcon(status)}<span className={`text-xl font-bold ${isApproved ? "text-emerald-400" : isRejected ? "text-red-400" : "text-amber-400"}`}>{status.toUpperCase()}</span></div>
          {isPending && <p className="text-sm text-slate-400 mt-1">Processing your deposit...</p>}
          {isApproved && <p className="text-sm text-emerald-300 mt-1">✓ Deposit approved and credited to your balance</p>}
          {isRejected && <p className="text-sm text-red-300 mt-1">✗ Deposit rejected. Please check the reason.</p>}
        </div>
        <div className="mt-4 space-y-3">
          <div className="flex justify-between text-sm border-b border-white/5 pb-2"><span className="text-slate-400">Coin</span><span className="text-white font-medium">{deposit.coin || "USDT"}</span></div>
          <div className="flex justify-between text-sm border-b border-white/5 pb-2"><span className="text-slate-400">Network</span><span className="text-white font-medium">{deposit.network || "--"}</span></div>
          <div className="flex justify-between text-sm border-b border-white/5 pb-2"><span className="text-slate-400">Amount</span><span className="text-cyan-400 font-bold">{formatAmount(deposit.amount)} USDT</span></div>
          {deposit.txid && <div className="flex justify-between text-sm border-b border-white/5 pb-2"><span className="text-slate-400">TXID</span><span className="text-white text-xs truncate max-w-[150px]">{deposit.txid}</span></div>}
          <div className="flex justify-between text-sm"><span className="text-slate-400">Submitted</span><span className="text-white text-xs">{formatTime(deposit.created_at)}</span></div>
        </div>
        {deposit.proof && <div className="mt-4 rounded-xl border border-white/10 bg-[#050812] p-3"><p className="text-xs text-slate-400 mb-2">Receipt</p><img src={resolveAssetUrl(deposit.proof)} alt="Deposit receipt" className="max-h-48 w-full rounded-lg object-cover" onError={(e) => { e.target.src = 'https://placehold.co/400x200?text=Image+not+found'; }} /></div>}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button onClick={onRefresh} disabled={refreshing} className="rounded-xl border border-white/10 bg-[#050812] py-2.5 text-sm font-semibold text-white hover:bg-white/5 transition disabled:opacity-60">{refreshing ? "Refreshing..." : "Refresh Status"}</button>
          <button onClick={onClose} className="rounded-xl bg-cyan-500 py-2.5 text-sm font-semibold text-black hover:bg-cyan-400 transition">Close</button>
        </div>
      </div>
    </div>
  );
}

export default function DepositPage() {
  const token = localStorage.getItem("userToken") || localStorage.getItem("token") || localStorage.getItem("accessToken") || "";
  const { showSuccess, showError, showVoucher } = useNotification();
  const [wallets, setWallets] = useState([]);
  const [availableUsdt, setAvailableUsdt] = useState(0);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [selectedWalletId, setSelectedWalletId] = useState("");
  const [form, setForm] = useState({ amount: "", txid: "", note: "", proof: "" });
  const [activeTab, setActiveTab] = useState("deposit");
  const [liveVoucher, setLiveVoucher] = useState(null);
  const [showVoucherModal, setShowVoucherModal] = useState(false);
  const voucherIntervalRef = useRef(null);

  async function loadDepositPage(silent = false) {
    try {
      if (!silent) setLoading(true); else setRefreshing(true);
      setError("");
      const [walletRes, historyRes, balanceRes] = await Promise.all([depositApi.wallets(token), depositApi.history(token), userApi.getWalletSummary(token)]);
      const walletRows = (Array.isArray(walletRes.data?.data) ? walletRes.data.data : []).map(wallet => ({ ...wallet, qr_image_url: wallet.qr_image_url || wallet.qr_url || wallet.qrCodeUrl || null }));
      const historyRows = Array.isArray(historyRes.data?.data) ? historyRes.data.data : [];
      const authoritativeBalance = Number(balanceRes.data?.data?.balance ?? 0);
      if (Number.isFinite(authoritativeBalance)) setAvailableUsdt(authoritativeBalance);
      setWallets(walletRows);
      setHistory(historyRows);
      if (liveVoucher?.id) {
        const updated = historyRows.find(item => String(item.id) === String(liveVoucher.id));
        if (updated) setLiveVoucher(updated);
      }
      if (!selectedWalletId && walletRows.length > 0) {
        const firstWallet = walletRows[0];
        setSelectedWalletId(String(firstWallet.id || `${firstWallet.coin}-${firstWallet.network}`));
      }
    } catch (err) {
      showError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    // Initial data load only. Deposit history is refreshed by explicit user action
    // or immediately after a completed deposit; there is no background polling.
    loadDepositPage();
    return () => {
      if (voucherIntervalRef.current) {
        clearInterval(voucherIntervalRef.current);
        voucherIntervalRef.current = null;
      }
    };
  }, []);

  const selectedWallet = useMemo(() => wallets.find(w => String(w.id || `${w.coin}-${w.network}`) === String(selectedWalletId)) || wallets[0] || null, [wallets, selectedWalletId]);

  async function handleManualRefresh() {
    await runSingleUserAction("deposit-page-refresh", () => loadDepositPage(true));
  }

  async function handleCopyAddress() {
    if (!selectedWallet?.address) return;
    try { await navigator.clipboard.writeText(selectedWallet.address); showSuccess("Deposit address copied successfully."); setError(""); }
    catch { showError("Failed to copy address."); }
  }

  async function handleReceiptUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploadingReceipt(true); setError(""); setSuccess("");
      const res = await runSingleUserAction("deposit-receipt-upload", () => depositApi.uploadReceipt(file, token));
      const uploadedUrl = res.data?.url || res.data?.data?.url || res.data?.data?.proof || "";
      setForm(prev => ({ ...prev, proof: uploadedUrl }));
      showSuccess("Receipt uploaded successfully.");
    } catch (err) { showError(getApiErrorMessage(err)); }
    finally { setUploadingReceipt(false); e.target.value = ""; }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (submitting) return;
    if (!selectedWallet) { showError("Please select a deposit wallet."); return; }
    if (!form.amount || Number(form.amount) <= 0) { showError("Please enter a valid deposit amount."); return; }
    const minDeposit = Number(selectedWallet.minimum_deposit || 0);
    if (minDeposit > 0 && Number(form.amount) < minDeposit) { showError(`Minimum deposit is ${formatAmount(minDeposit)}.`); return; }

    const idempotencyKey = createActionIdempotencyKey("deposit");
    try {
      setSubmitting(true); setError(""); setSuccess("");
      const res = await runSingleUserAction("deposit-submit", () => depositApi.request({
        coin: selectedWallet.coin,
        network: selectedWallet.network,
        amount: Number(form.amount),
        txid: form.txid || "",
        note: form.note || "",
        proof: form.proof || "",
        address: selectedWallet.address,
        idempotencyKey,
      }, token));
      const responseData = res?.data?.data || {};
      const depositId = responseData.id;
      showSuccess("Deposit request submitted successfully!");
      setLiveVoucher({ id: depositId, coin: selectedWallet.coin, network: selectedWallet.network, amount: Number(form.amount), txid: form.txid || "", proof: form.proof || "", status: "pending", created_at: new Date().toISOString() });
      setShowVoucherModal(true);
      showVoucher({ title: "Deposit Request Submitted", type: "deposit", transactionId: depositId, data: { id: depositId, coin: selectedWallet.coin, network: selectedWallet.network, amount: Number(form.amount), status: "Pending", created_at: new Date().toISOString() } });
      setForm({ amount: "", txid: "", note: "", proof: "" });
      // Only refresh the affected deposit page after the operation completes.
      await loadDepositPage(true);
    } catch (err) { showError(getApiErrorMessage(err)); }
    finally { setSubmitting(false); }
  }

  const qrCodeUrl = useMemo(() => selectedWallet ? selectedWallet.qr_image_url || selectedWallet.qr_url || null : null, [selectedWallet]);

  const handleCloseVoucher = () => {
    setShowVoucherModal(false);
    if (voucherIntervalRef.current) { clearInterval(voucherIntervalRef.current); voucherIntervalRef.current = null; }
  };

  if (loading) return <div className="space-y-6 bg-[#050812] p-4 sm:p-6"><GlassCard className="p-6 text-slate-300">Loading deposit page...</GlassCard></div>;

  return (
    <div className="space-y-6 bg-[#050812] px-4 pb-28 pt-4 sm:px-6 xl:pb-8">
      <section className="rounded-[34px] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.10),transparent_18%),linear-gradient(180deg,#0a0e1a_0%,#050812_100%)] p-5 shadow-[0_20px_80px_rgba(0,0,0,0.45)]"><div className="flex items-center justify-between gap-3"><div><div className="text-xs uppercase tracking-[0.32em] text-cyan-400">Deposit</div><h1 className="mt-2 text-3xl font-bold text-white">Add Funds</h1><p className="mt-2 text-sm text-slate-400">Select a wallet, transfer funds, upload receipt, and submit your deposit request.</p></div><button type="button" onClick={handleManualRefresh} disabled={refreshing} className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-white transition hover:bg-white/[0.06] disabled:opacity-60"><RefreshCw size={18} className={refreshing ? "animate-spin" : ""} /></button></div></section>
      <section className="rounded-2xl border border-cyan-400/15 bg-cyan-400/[0.05] p-4"><div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Available USDT</div><div className="mt-1 text-2xl font-bold text-white">{formatAmount(availableUsdt)} <span className="text-sm font-medium text-slate-400">USDT</span></div><div className="mt-1 text-[11px] text-slate-500">Live wallet balance from the authoritative asset ledger.</div></section>
      <div className="flex gap-1 rounded-2xl border border-white/10 bg-[#0a0e1a] p-1"><button type="button" onClick={() => setActiveTab("deposit")} className={`flex-1 rounded-xl py-2.5 text-sm font-semibold transition ${activeTab === "deposit" ? "bg-cyan-500 text-black" : "text-slate-400 hover:text-white"}`}><Wallet size={16} className="inline mr-2" />Deposit Wallet</button><button type="button" onClick={() => setActiveTab("history")} className={`flex-1 rounded-xl py-2.5 text-sm font-semibold transition ${activeTab === "history" ? "bg-cyan-500 text-black" : "text-slate-400 hover:text-white"}`}><Clock size={16} className="inline mr-2" />History ({history.length})</button></div>
      {activeTab === "deposit" && <div className="grid gap-6 xl:grid-cols-[1.05fr_1fr]">
        <GlassCard><div className="border-b border-white/10 px-5 py-4"><div className="flex items-center gap-3"><Wallet size={18} className="text-cyan-400" /><h2 className="text-xl font-semibold text-white">Deposit Wallet</h2></div></div><div className="space-y-5 p-5"><div><FieldLabel>Select Network</FieldLabel><select value={selectedWalletId} onChange={(e) => setSelectedWalletId(e.target.value)} className="w-full rounded-2xl border border-white/10 bg-[#0a0e1a] px-4 py-3 text-white outline-none focus:border-cyan-500">{wallets.map(wallet => { const value = String(wallet.id || `${wallet.coin}-${wallet.network}`); const label = wallet.label || wallet.display_label || `${wallet.coin} ${wallet.network}`; return <option key={value} value={value}>{label}</option>; })}</select></div>
          {selectedWallet ? <div className="rounded-[28px] border border-white/10 bg-[#050812] p-5"><div className="grid gap-6 lg:grid-cols-[1fr_auto]"><div className="min-w-0"><div className="text-2xl font-semibold text-white">{selectedWallet.label || selectedWallet.display_label || `${selectedWallet.coin} ${selectedWallet.network}`}</div><div className="mt-3 grid gap-3 sm:grid-cols-2"><div className="rounded-2xl border border-white/10 bg-[#0a0e1a] p-4"><div className="text-sm text-slate-500">Coin</div><div className="mt-2 text-lg font-semibold text-white">{selectedWallet.coin || "--"}</div></div><div className="rounded-2xl border border-white/10 bg-[#0a0e1a] p-4"><div className="text-sm text-slate-500">Network</div><div className="mt-2 text-lg font-semibold text-white">{selectedWallet.network || "--"}</div></div></div><div className="mt-4"><div className="text-sm text-slate-500">Deposit Address</div><div className="mt-2 break-all rounded-2xl border border-white/10 bg-[#0a0e1a] px-4 py-4 text-sm text-white">{selectedWallet.address || "--"}</div><div className="mt-3"><ActionButton variant="secondary" onClick={handleCopyAddress}><span className="inline-flex items-center gap-2"><Copy size={16} />Copy Address</span></ActionButton></div></div><div className="mt-4 rounded-2xl border border-white/10 bg-[#0a0e1a] p-4"><div className="text-sm text-slate-500">Minimum Deposit</div><div className="mt-2 text-xl font-semibold text-amber-300">{formatAmount(selectedWallet.minimum_deposit || 0)}</div></div>{selectedWallet.instructions ? <div className="mt-4 rounded-2xl border border-white/10 bg-[#0a0e1a] p-4"><div className="text-sm text-slate-500">Instructions</div><div className="mt-2 text-sm leading-6 text-slate-200">{selectedWallet.instructions}</div></div> : null}</div>{qrCodeUrl ? <div className="mx-auto lg:mx-0"><div className="rounded-[24px] border border-white/10 bg-[#0a0e1a] p-4"><div className="mb-3 flex items-center gap-2 text-sm text-slate-400"><QrCode size={16} />QR Code</div><img src={resolveAssetUrl(qrCodeUrl)} alt="Deposit QR" className="h-44 w-44 rounded-2xl border border-white/10 bg-white object-contain p-2 sm:h-52 sm:w-52" onError={(e) => { console.error("QR image failed to load:", qrCodeUrl); e.target.style.display = 'none'; const parent = e.target.parentElement; if (parent && !parent.querySelector('.qr-fallback')) { const fallback = document.createElement('div'); fallback.className = 'qr-fallback text-center p-4'; fallback.innerHTML = '<p class="text-red-400 text-sm">QR Code unavailable</p><p class="text-slate-500 text-xs mt-2">Please use the wallet address above</p>'; parent.appendChild(fallback); } }} /></div></div> : <div className="mx-auto lg:mx-0"><div className="rounded-[24px] border border-white/10 bg-[#0a0e1a] p-4"><div className="mb-3 flex items-center gap-2 text-sm text-slate-400"><QrCode size={16} />QR Code</div><div className="flex h-44 w-44 flex-col items-center justify-center rounded-2xl border border-white/10 bg-slate-800 p-4 sm:h-52 sm:w-52"><p className="text-xs text-red-400 text-center">QR Code Not Available</p><p className="text-[10px] text-slate-500 text-center mt-2">Use the wallet address above</p></div></div></div>}</div></div> : <div className="rounded-2xl border border-white/10 bg-[#0a0e1a] px-4 py-8 text-center text-sm text-slate-400">No deposit wallet available.</div>}</div></GlassCard>
        <GlassCard><div className="border-b border-white/10 px-5 py-4"><div className="flex items-center gap-3"><ArrowDownToLine size={18} className="text-cyan-400" /><h2 className="text-xl font-semibold text-white">Submit Deposit</h2></div></div><form onSubmit={handleSubmit} className="space-y-4 p-5"><div><FieldLabel>Amount</FieldLabel><input type="number" min="0" step="0.01" value={form.amount} onChange={(e) => setForm(prev => ({ ...prev, amount: e.target.value }))} placeholder="Enter deposit amount" className="w-full rounded-2xl border border-white/10 bg-[#0a0e1a] px-4 py-3 text-white outline-none focus:border-cyan-500" disabled={submitting} /></div><div><FieldLabel>Transaction ID (TXID) - Optional</FieldLabel><input type="text" value={form.txid} onChange={(e) => setForm(prev => ({ ...prev, txid: e.target.value }))} placeholder="Paste transaction hash (optional)" className="w-full rounded-2xl border border-white/10 bg-[#0a0e1a] px-4 py-3 text-white outline-none focus:border-cyan-500" disabled={submitting} /></div><div><FieldLabel>Note (Optional)</FieldLabel><textarea rows={4} value={form.note} onChange={(e) => setForm(prev => ({ ...prev, note: e.target.value }))} placeholder="Add any note for this deposit" className="w-full rounded-2xl border border-white/10 bg-[#0a0e1a] px-4 py-3 text-white outline-none placeholder:text-slate-500 focus:border-cyan-500" disabled={submitting} /></div><div className="rounded-[24px] border border-white/10 bg-[#050812] p-4"><div className="mb-3 flex items-center gap-2 text-sm text-slate-400"><Upload size={16} />Upload Receipt</div><input type="file" accept="image/*" onChange={handleReceiptUpload} disabled={uploadingReceipt || submitting} className="block w-full text-sm text-slate-300 file:mr-4 file:rounded-xl file:border-0 file:bg-cyan-500 file:px-4 file:py-2 file:font-semibold file:text-black hover:file:bg-cyan-400" />{uploadingReceipt ? <div className="mt-3 text-sm text-cyan-300">Uploading receipt...</div> : null}{form.proof ? <div className="mt-4 rounded-2xl border border-white/10 bg-[#0a0e1a] p-4"><div className="mb-3 flex items-center gap-2 text-sm text-slate-400"><ImageIcon size={16} />Receipt Preview</div><img src={resolveAssetUrl(form.proof)} alt="Receipt preview" className="max-h-72 w-full rounded-2xl border border-white/10 object-cover" onError={(e) => { e.target.src = 'https://placehold.co/400x200?text=Image+not+found'; }} /></div> : null}</div><ActionButton type="submit" disabled={submitting || !selectedWallet} className="w-full">{submitting ? "Submitting..." : "Submit Deposit Request"}</ActionButton></form></GlassCard>
      </div>}
      {activeTab === "history" && <GlassCard><div className="border-b border-white/10 px-5 py-4"><div className="flex items-center justify-between gap-3"><h2 className="text-xl font-semibold text-white">Deposit History</h2><span className="rounded-full border border-white/10 bg-[#050812] px-3 py-1 text-xs text-slate-300">{history.length} Record{history.length === 1 ? "" : "s"}</span></div></div><div className="space-y-4 p-5">{history.length ? history.map(item => <div key={item.id} className="rounded-[26px] border border-white/10 bg-[#050812] p-5"><div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]"><div><div className="flex flex-wrap items-center gap-3"><div className="text-lg font-semibold text-white">{String(item.coin || "USDT").toUpperCase()} Deposit</div><span className="rounded-full border border-white/10 bg-[#151515] px-3 py-1 text-xs text-slate-300">ID #{item.id}</span><StatusBadge status={item.status} /></div><div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><div className="rounded-2xl border border-white/10 bg-[#0a0e1a] p-4"><div className="text-xs uppercase tracking-wide text-slate-500">Coin</div><div className="mt-2 text-sm font-semibold text-white">{item.coin || "--"}</div></div><div className="rounded-2xl border border-white/10 bg-[#0a0e1a] p-4"><div className="text-xs uppercase tracking-wide text-slate-500">Network</div><div className="mt-2 text-sm font-semibold text-white">{item.network || "--"}</div></div><div className="rounded-2xl border border-white/10 bg-[#0a0e1a] p-4"><div className="text-xs uppercase tracking-wide text-slate-500">Amount</div><div className="mt-2 text-sm font-semibold text-cyan-400">{formatAmount(item.amount)}</div></div><div className="rounded-2xl border border-white/10 bg-[#0a0e1a] p-4"><div className="text-xs uppercase tracking-wide text-slate-500">Time</div><div className="mt-2 text-sm font-semibold text-white">{formatTime(item.created_at)}</div></div></div></div><div className="space-y-4">{item.txid ? <div className="rounded-2xl border border-white/10 bg-[#0a0e1a] p-4"><div className="text-xs uppercase tracking-wide text-slate-500">TXID</div><div className="mt-2 break-all text-sm text-white">{item.txid}</div></div> : null}{item.proof || item.receipt_url ? <div className="rounded-2xl border border-white/10 bg-[#0a0e1a] p-4"><div className="mb-3 text-xs uppercase tracking-wide text-slate-500">Receipt</div><img src={resolveAssetUrl(item.proof || item.receipt_url)} alt="Deposit proof" className="max-h-56 w-full rounded-2xl border border-white/10 object-cover" onError={(e) => { e.target.src = 'https://placehold.co/400x200?text=Image+not+found'; }} /></div> : <div className="rounded-2xl border border-white/10 bg-[#0a0e1a] px-4 py-6 text-center text-sm text-slate-500">No receipt uploaded.</div>}{item.note ? <div className="rounded-2xl border border-white/10 bg-[#0a0e1a] p-4"><div className="text-xs uppercase tracking-wide text-slate-500">Note</div><div className="mt-2 text-sm text-white">{item.note}</div></div> : null}</div></div></div>) : <div className="rounded-2xl border border-white/10 bg-[#0a0e1a] px-4 py-10 text-center text-sm text-slate-400"><div className="text-4xl mb-3">📭</div><p>No deposit history found.</p><p className="text-xs mt-1">Make your first deposit to get started!</p></div>}</div></GlassCard>}
      {showVoucherModal && liveVoucher && <LiveVoucher deposit={liveVoucher} onClose={handleCloseVoucher} onRefresh={handleManualRefresh} refreshing={refreshing} />}
    </div>
  );
}
