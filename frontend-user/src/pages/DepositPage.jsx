import { useEffect, useMemo, useState } from "react";
import {
  Copy,
  Upload,
  RefreshCw,
  ChevronRight,
  QrCode,
  Wallet,
  ArrowDownToLine,
  Image as ImageIcon,
} from "lucide-react";
import { depositApi, getApiErrorMessage } from "../services/api";
import { useNotification } from "../hooks/useNotification";

const API_BASE =
  import.meta.env.VITE_API_BASE_URL || "https://vexatrade-server.onrender.com";

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

// ========== FIXED: Function to resolve asset URLs (handles base64 and http URLs) ==========
function resolveAssetUrl(url) {
  if (!url) return "";
  // If it's already a base64 data URL, return as is
  if (url && url.startsWith('data:image/')) return url;
  if (url && (url.startsWith("http://") || url.startsWith("https://"))) return url;
  return `${API_BASE}${url}`;
}

function getStatusClass(status) {
  const value = String(status || "").toLowerCase();

  if (["approved", "completed", "success"].includes(value)) {
    return "border border-emerald-500/20 bg-emerald-500/10 text-emerald-300";
  }

  if (["rejected", "failed", "cancelled"].includes(value)) {
    return "border border-red-500/20 bg-red-500/10 text-red-300";
  }

  return "border border-amber-500/20 bg-amber-500/10 text-amber-300";
}

function GlassCard({ children, className = "" }) {
  return (
    <section
      className={`rounded-[30px] border border-white/10 bg-[#0a0e1a] shadow-[0_18px_60px_rgba(0,0,0,0.35)] ${className}`}
    >
      {children}
    </section>
  );
}

function FieldLabel({ children }) {
  return <label className="mb-2 block text-sm text-slate-400">{children}</label>;
}

function ActionButton({
  children,
  onClick,
  type = "button",
  disabled = false,
  variant = "primary",
  className = "",
}) {
  const styles = {
    primary: "bg-cyan-500 text-black hover:bg-cyan-400",
    secondary: "border border-white/10 bg-[#0a0e1a] text-white hover:bg-[#1e1e1e]",
    ghost: "border border-white/10 bg-transparent text-white hover:bg-white/5",
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`rounded-2xl px-4 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${styles[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

function StatusBadge({ status }) {
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getStatusClass(status)}`}>
      {status || "-"}
    </span>
  );
}

export default function DepositPage() {
  const token =
    localStorage.getItem("userToken") ||
    localStorage.getItem("token") ||
    localStorage.getItem("accessToken") ||
    "";

  const { showSuccess, showError, showVoucher } = useNotification();

  const [wallets, setWallets] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [selectedWalletId, setSelectedWalletId] = useState("");
  const [form, setForm] = useState({
    amount: "",
    txid: "",
    note: "",
    proof: "",
  });

  async function loadDepositPage(silent = false) {
    try {
      if (!silent) setLoading(true);
      else setRefreshing(true);

      setError("");

      const [walletRes, historyRes] = await Promise.all([
        depositApi.wallets(token),
        depositApi.history(token),
      ]);

      let walletRows = Array.isArray(walletRes.data?.data) ? walletRes.data.data : [];
      
      // ========== FIXED: Normalize wallet data to ensure qr_image_url is properly set ==========
      walletRows = walletRows.map(wallet => ({
        ...wallet,
        // Ensure qr_image_url is accessible (API might return qr_url or qr_image_url)
        qr_image_url: wallet.qr_image_url || wallet.qr_url || wallet.qrCodeUrl || null,
      }));
      
      const historyRows = Array.isArray(historyRes.data?.data) ? historyRes.data.data : [];

      setWallets(walletRows);
      setHistory(historyRows);

      if (!selectedWalletId && walletRows.length > 0) {
        const firstWallet = walletRows[0];
        setSelectedWalletId(
          String(firstWallet.id || `${firstWallet.coin}-${firstWallet.network}`)
        );
      }
    } catch (err) {
      showError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadDepositPage();

    const interval = setInterval(() => {
      loadDepositPage(true);
    }, 12000);

    return () => clearInterval(interval);
  }, []);

  const selectedWallet = useMemo(() => {
    return (
      wallets.find(
        (w) => String(w.id || `${w.coin}-${w.network}`) === String(selectedWalletId)
      ) ||
      wallets[0] ||
      null
    );
  }, [wallets, selectedWalletId]);

  async function handleCopyAddress() {
    if (!selectedWallet?.address) return;

    try {
      await navigator.clipboard.writeText(selectedWallet.address);
      showSuccess("Deposit address copied successfully.");
      setError("");
    } catch {
      showError("Failed to copy address.");
    }
  }

  async function handleReceiptUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingReceipt(true);
      setError("");
      setSuccess("");

      const res = await depositApi.uploadReceipt(file, token);
      const uploadedUrl =
        res.data?.url || res.data?.data?.url || res.data?.data?.proof || "";

      setForm((prev) => ({
        ...prev,
        proof: uploadedUrl,
      }));

      showSuccess("Receipt uploaded successfully.");
    } catch (err) {
      showError(getApiErrorMessage(err));
    } finally {
      setUploadingReceipt(false);
      e.target.value = "";
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();

    if (!selectedWallet) {
      showError("Please select a deposit wallet.");
      return;
    }

    if (!form.amount || Number(form.amount) <= 0) {
      showError("Please enter a valid deposit amount.");
      return;
    }

    const minDeposit = Number(selectedWallet.minimum_deposit || 0);
    if (minDeposit > 0 && Number(form.amount) < minDeposit) {
      showError(`Minimum deposit is ${formatAmount(minDeposit)}.`);
      return;
    }

    try {
      setSubmitting(true);
      setError("");
      setSuccess("");

      const res = await depositApi.request(
        {
          coin: selectedWallet.coin,
          network: selectedWallet.network,
          amount: Number(form.amount),
          txid: form.txid || "",
          note: form.note || "",
          proof: form.proof || "",
        },
        token
      );

      const responseData = res?.data?.data || {};

      showSuccess("Deposit request submitted successfully!");

      showVoucher({
        title: "Deposit Request Submitted",
        type: "deposit",
        transactionId: responseData.id,
        data: {
          id: responseData.id,
          coin: selectedWallet.coin,
          network: selectedWallet.network,
          amount: Number(form.amount),
          status: "Pending",
          created_at: new Date().toISOString(),
        },
      });

      setForm({
        amount: "",
        txid: "",
        note: "",
        proof: "",
      });

      await loadDepositPage(true);
    } catch (err) {
      showError(getApiErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  // Get the QR code URL from selected wallet (handles multiple field names)
  const qrCodeUrl = useMemo(() => {
    if (!selectedWallet) return null;
    return selectedWallet.qr_image_url || selectedWallet.qr_url || null;
  }, [selectedWallet]);

  if (loading) {
    return (
      <div className="space-y-6 bg-[#050812] p-4 sm:p-6">
        <GlassCard className="p-6 text-slate-300">Loading deposit page...</GlassCard>
      </div>
    );
  }

  return (
    <div className="space-y-6 bg-[#050812] px-4 pb-28 pt-4 sm:px-6 xl:pb-8">
      <section className="rounded-[34px] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.10),transparent_18%),linear-gradient(180deg,#0a0e1a_0%,#050812_100%)] p-5 shadow-[0_20px_80px_rgba(0,0,0,0.45)]">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-[0.32em] text-cyan-400">
              Deposit
            </div>
            <h1 className="mt-2 text-3xl font-bold text-white">Add Funds</h1>
            <p className="mt-2 text-sm text-slate-400">
              Select a wallet, transfer funds, upload receipt, and submit your deposit request.
            </p>
          </div>

          <button
            type="button"
            onClick={() => loadDepositPage(true)}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-white transition hover:bg-white/[0.06]"
          >
            <RefreshCw size={18} className={refreshing ? "animate-spin" : ""} />
          </button>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_1fr]">
        <GlassCard>
          <div className="border-b border-white/10 px-5 py-4">
            <div className="flex items-center gap-3">
              <Wallet size={18} className="text-cyan-400" />
              <h2 className="text-xl font-semibold text-white">Deposit Wallet</h2>
            </div>
          </div>

          <div className="space-y-5 p-5">
            <div>
              <FieldLabel>Select Network</FieldLabel>
              <select
                value={selectedWalletId}
                onChange={(e) => setSelectedWalletId(e.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-[#0a0e1a] px-4 py-3 text-white outline-none focus:border-cyan-500"
              >
                {wallets.map((wallet) => {
                  const value = String(wallet.id || `${wallet.coin}-${wallet.network}`);
                  const label =
                    wallet.label ||
                    wallet.display_label ||
                    `${wallet.coin} ${wallet.network}`;

                  return (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  );
                })}
              </select>
            </div>

            {selectedWallet ? (
              <div className="rounded-[28px] border border-white/10 bg-[#050812] p-5">
                <div className="grid gap-6 lg:grid-cols-[1fr_auto]">
                  <div className="min-w-0">
                    <div className="text-2xl font-semibold text-white">
                      {selectedWallet.label ||
                        selectedWallet.display_label ||
                        `${selectedWallet.coin} ${selectedWallet.network}`}
                    </div>

                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl border border-white/10 bg-[#0a0e1a] p-4">
                        <div className="text-sm text-slate-500">Coin</div>
                        <div className="mt-2 text-lg font-semibold text-white">
                          {selectedWallet.coin || "--"}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-white/10 bg-[#0a0e1a] p-4">
                        <div className="text-sm text-slate-500">Network</div>
                        <div className="mt-2 text-lg font-semibold text-white">
                          {selectedWallet.network || "--"}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4">
                      <div className="text-sm text-slate-500">Deposit Address</div>
                      <div className="mt-2 break-all rounded-2xl border border-white/10 bg-[#0a0e1a] px-4 py-4 text-sm text-white">
                        {selectedWallet.address || "--"}
                      </div>

                      <div className="mt-3">
                        <ActionButton variant="secondary" onClick={handleCopyAddress}>
                          <span className="inline-flex items-center gap-2">
                            <Copy size={16} />
                            Copy Address
                          </span>
                        </ActionButton>
                      </div>
                    </div>

                    <div className="mt-4 rounded-2xl border border-white/10 bg-[#0a0e1a] p-4">
                      <div className="text-sm text-slate-500">Minimum Deposit</div>
                      <div className="mt-2 text-xl font-semibold text-amber-300">
                        {formatAmount(selectedWallet.minimum_deposit || 0)}
                      </div>
                    </div>

                    {selectedWallet.instructions ? (
                      <div className="mt-4 rounded-2xl border border-white/10 bg-[#0a0e1a] p-4">
                        <div className="text-sm text-slate-500">Instructions</div>
                        <div className="mt-2 text-sm leading-6 text-slate-200">
                          {selectedWallet.instructions}
                        </div>
                      </div>
                    ) : null}
                  </div>

                  {/* ========== FIXED: QR Code Display ========== */}
                  {qrCodeUrl ? (
                    <div className="mx-auto lg:mx-0">
                      <div className="rounded-[24px] border border-white/10 bg-[#0a0e1a] p-4">
                        <div className="mb-3 flex items-center gap-2 text-sm text-slate-400">
                          <QrCode size={16} />
                          QR Code
                        </div>
                        <img
                          src={resolveAssetUrl(qrCodeUrl)}
                          alt="Deposit QR"
                          className="h-44 w-44 rounded-2xl border border-white/10 bg-white object-contain p-2 sm:h-52 sm:w-52"
                          onError={(e) => {
                            console.error("QR image failed to load:", qrCodeUrl);
                            e.target.style.display = 'none';
                            const parent = e.target.parentElement;
                            if (parent && !parent.querySelector('.qr-fallback')) {
                              const fallback = document.createElement('div');
                              fallback.className = 'qr-fallback text-center p-4';
                              fallback.innerHTML = '<p class="text-red-400 text-sm">QR Code unavailable</p><p class="text-slate-500 text-xs mt-2">Please use the wallet address above</p>';
                              parent.appendChild(fallback);
                            }
                          }}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="mx-auto lg:mx-0">
                      <div className="rounded-[24px] border border-white/10 bg-[#0a0e1a] p-4">
                        <div className="mb-3 flex items-center gap-2 text-sm text-slate-400">
                          <QrCode size={16} />
                          QR Code
                        </div>
                        <div className="flex h-44 w-44 flex-col items-center justify-center rounded-2xl border border-white/10 bg-slate-800 p-4 sm:h-52 sm:w-52">
                          <p className="text-xs text-red-400 text-center">QR Code Not Available</p>
                          <p className="text-[10px] text-slate-500 text-center mt-2">Use the wallet address above</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-white/10 bg-[#0a0e1a] px-4 py-8 text-center text-sm text-slate-400">
                No deposit wallet available.
              </div>
            )}
          </div>
        </GlassCard>

        <GlassCard>
          <div className="border-b border-white/10 px-5 py-4">
            <div className="flex items-center gap-3">
              <ArrowDownToLine size={18} className="text-cyan-400" />
              <h2 className="text-xl font-semibold text-white">Submit Deposit Request</h2>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 p-5">
            <div>
              <FieldLabel>Amount</FieldLabel>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.amount}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, amount: e.target.value }))
                }
                placeholder="Enter deposit amount"
                className="w-full rounded-2xl border border-white/10 bg-[#0a0e1a] px-4 py-3 text-white outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <FieldLabel>Transaction ID (TXID)</FieldLabel>
              <input
                type="text"
                value={form.txid}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, txid: e.target.value }))
                }
                placeholder="Paste transaction hash"
                className="w-full rounded-2xl border border-white/10 bg-[#0a0e1a] px-4 py-3 text-white outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <FieldLabel>Note (Optional)</FieldLabel>
              <textarea
                rows={4}
                value={form.note}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, note: e.target.value }))
                }
                placeholder="Add any note for this deposit"
                className="w-full rounded-2xl border border-white/10 bg-[#0a0e1a] px-4 py-3 text-white outline-none placeholder:text-slate-500 focus:border-cyan-500"
              />
            </div>

            <div className="rounded-[24px] border border-white/10 bg-[#050812] p-4">
              <div className="mb-3 flex items-center gap-2 text-sm text-slate-400">
                <Upload size={16} />
                Upload Receipt
              </div>

              <input
                type="file"
                accept="image/*"
                onChange={handleReceiptUpload}
                className="block w-full text-sm text-slate-300 file:mr-4 file:rounded-xl file:border-0 file:bg-cyan-500 file:px-4 file:py-2 file:font-semibold file:text-black hover:file:bg-cyan-400"
              />

              {uploadingReceipt ? (
                <div className="mt-3 text-sm text-cyan-300">Uploading receipt...</div>
              ) : null}

              {form.proof ? (
                <div className="mt-4 rounded-2xl border border-white/10 bg-[#0a0e1a] p-4">
                  <div className="mb-3 flex items-center gap-2 text-sm text-slate-400">
                    <ImageIcon size={16} />
                    Receipt Preview
                  </div>
                  <img
                    src={resolveAssetUrl(form.proof)}
                    alt="Receipt preview"
                    className="max-h-72 w-full rounded-2xl border border-white/10 object-cover"
                    onError={(e) => {
                      e.target.src = 'https://placehold.co/400x200?text=Image+not+found';
                    }}
                  />
                </div>
              ) : null}
            </div>

            <ActionButton
              type="submit"
              disabled={submitting || !selectedWallet}
              className="w-full"
            >
              {submitting ? "Submitting..." : "Submit Deposit Request"}
            </ActionButton>
          </form>
        </GlassCard>
      </div>

      <GlassCard>
        <div className="border-b border-white/10 px-5 py-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-semibold text-white">Deposit History</h2>
            <span className="rounded-full border border-white/10 bg-[#050812] px-3 py-1 text-xs text-slate-300">
              {history.length} Record{history.length === 1 ? "" : "s"}
            </span>
          </div>
        </div>

        <div className="space-y-4 p-5">
          {history.length ? (
            history.map((item) => (
              <div
                key={item.id}
                className="rounded-[26px] border border-white/10 bg-[#050812] p-5"
              >
                <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="text-lg font-semibold text-white">
                        {String(item.coin || "USDT").toUpperCase()} Deposit
                      </div>

                      <span className="rounded-full border border-white/10 bg-[#151515] px-3 py-1 text-xs text-slate-300">
                        ID #{item.id}
                      </span>

                      <StatusBadge status={item.status} />
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      <div className="rounded-2xl border border-white/10 bg-[#0a0e1a] p-4">
                        <div className="text-xs uppercase tracking-wide text-slate-500">
                          Coin
                        </div>
                        <div className="mt-2 text-sm font-semibold text-white">
                          {item.coin || "--"}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-white/10 bg-[#0a0e1a] p-4">
                        <div className="text-xs uppercase tracking-wide text-slate-500">
                          Network
                        </div>
                        <div className="mt-2 text-sm font-semibold text-white">
                          {item.network || "--"}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-white/10 bg-[#0a0e1a] p-4">
                        <div className="text-xs uppercase tracking-wide text-slate-500">
                          Amount
                        </div>
                        <div className="mt-2 text-sm font-semibold text-cyan-400">
                          {formatAmount(item.amount)}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-white/10 bg-[#0a0e1a] p-4">
                        <div className="text-xs uppercase tracking-wide text-slate-500">
                          Time
                        </div>
                        <div className="mt-2 text-sm font-semibold text-white">
                          {formatTime(item.created_at)}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {item.txid ? (
                      <div className="rounded-2xl border border-white/10 bg-[#0a0e1a] p-4">
                        <div className="text-xs uppercase tracking-wide text-slate-500">
                          TXID
                        </div>
                        <div className="mt-2 break-all text-sm text-white">
                          {item.txid}
                        </div>
                      </div>
                    ) : null}

                    {item.proof || item.receipt_url ? (
                      <div className="rounded-2xl border border-white/10 bg-[#0a0e1a] p-4">
                        <div className="mb-3 text-xs uppercase tracking-wide text-slate-500">
                          Receipt
                        </div>
                        <img
                          src={resolveAssetUrl(item.proof || item.receipt_url)}
                          alt="Deposit proof"
                          className="max-h-56 w-full rounded-2xl border border-white/10 object-cover"
                          onError={(e) => {
                            e.target.src = 'https://placehold.co/400x200?text=Image+not+found';
                          }}
                        />
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-white/10 bg-[#0a0e1a] px-4 py-6 text-center text-sm text-slate-500">
                        No receipt uploaded.
                      </div>
                    )}

                    {item.note ? (
                      <div className="rounded-2xl border border-white/10 bg-[#0a0e1a] p-4">
                        <div className="text-xs uppercase tracking-wide text-slate-500">
                          Note
                        </div>
                        <div className="mt-2 text-sm text-white">
                          {item.note}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-2xl border border-white/10 bg-[#0a0e1a] px-4 py-10 text-center text-sm text-slate-400">
              No deposit history found.
            </div>
          )}
        </div>
      </GlassCard>
    </div>
  );
}
