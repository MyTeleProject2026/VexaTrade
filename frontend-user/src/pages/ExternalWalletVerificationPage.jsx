import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, Copy, FileUp, RefreshCw, ShieldCheck, Clock3, AlertTriangle } from "lucide-react";
import { getAccountVerification, submitAccountVerification } from "../services/api";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);

function unwrap(response) {
  return response?.data?.data || response?.data || null;
}

function getStepNumber(step) {
  return Number(step?.stepNumber ?? step?.step_number ?? 0);
}

function getStepStatus(step) {
  return String(step?.status || "locked").toLowerCase();
}

function normalizeDecimal(value) {
  const raw = String(value ?? "").trim();
  if (!/^\d+(\.\d+)?$/.test(raw)) return raw;
  const [whole, fraction = ""] = raw.split(".");
  const cleanWhole = whole.replace(/^0+(?=\d)/, "") || "0";
  const cleanFraction = fraction.replace(/0+$/, "");
  return cleanFraction ? `${cleanWhole}.${cleanFraction}` : cleanWhole;
}

export default function ExternalWalletVerificationPage() {
  const navigate = useNavigate();
  const token =
    localStorage.getItem("userToken") ||
    localStorage.getItem("token") ||
    localStorage.getItem("accessToken") ||
    "";

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [tx, setTx] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [file, setFile] = useState(null);
  const [now, setNow] = useState(Date.now());
  const requestRef = useRef(null);
  const mountedRef = useRef(true);

  const load = useCallback(async ({ manual = false, background = false } = {}) => {
    if (!token) {
      navigate("/login", { replace: true });
      return null;
    }

    if (requestRef.current) return requestRef.current;

    if (manual) setRefreshing(true);
    else setLoading(true);
    setError("");

    requestRef.current = (async () => {
      try {
        const response = await getAccountVerification(token);
        const next = unwrap(response);
        if (!next || typeof next !== "object") throw new Error("Invalid verification status response.");
        if (mountedRef.current) {
          setData(next);
          setError("");
        }
        return next;
      } catch (e) {
        const message =
          e?.response?.data?.message ||
          e?.response?.data?.error ||
          e?.message ||
          "Unable to refresh verification status.";
        if (mountedRef.current) setError(message);
        return null;
      } finally {
        if (mountedRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
        requestRef.current = null;
      }
    })();

    return requestRef.current;
  }, [navigate, token]);

  useEffect(() => {
    mountedRef.current = true;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    void load();
    const id = setInterval(() => void load({ background: true }), 30000);
    return () => {
      mountedRef.current = false;
      clearInterval(id);
      clearInterval(timer);
    };
  }, [load]);

  const steps = useMemo(() => {
    const source = Array.isArray(data?.steps) ? data.steps : [];
    return [1, 2, 3].map((n) => source.find((s) => getStepNumber(s) === n) || { stepNumber: n, status: "locked" });
  }, [data]);

  const currentStepNumber = Number(data?.currentStep ?? data?.current_step ?? 0);
  const currentStep = steps.find((s) => getStepNumber(s) === currentStepNumber) || null;
  const currentStatus = getStepStatus(currentStep);
  const deadlineValue = data?.deadlineAt ?? data?.deadline_at ?? null;
  const serverTimeValue = data?.serverTime ?? data?.server_time ?? null;
  const clockOffsetMs = serverTimeValue ? new Date(serverTimeValue).getTime() - Date.now() : 0;
  const effectiveNow = now + clockOffsetMs;
  const deadlineMs = deadlineValue ? new Date(deadlineValue).getTime() : NaN;
  const remainingSeconds = Number.isFinite(deadlineMs) ? Math.max(0, Math.ceil((deadlineMs - effectiveNow) / 1000)) : null;
  const timerExpired = remainingSeconds !== null && remainingSeconds <= 0;
  const formatTimer = (seconds) => {
    if (seconds === null) return "--:--:--";
    const total = Math.max(0, Math.floor(seconds));
    const h = Math.floor(total / 3600), m = Math.floor((total % 3600) / 60), s = total % 60;
    return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
  };
  const requiredAmount =
    currentStep?.requiredAmountDisplay ??
    currentStep?.required_amount_display ??
    currentStep?.requiredAmount ??
    currentStep?.required_amount ??
    null;
  const address = currentStep?.verificationAddress ?? currentStep?.verification_address ?? "";
  const transactionRequired =
    currentStep?.transactionHashRequired !== undefined
      ? Boolean(currentStep.transactionHashRequired)
      : Number(currentStep?.transaction_hash_required ?? 1) === 1;
  const receiptRequired =
    currentStep?.receiptRequired !== undefined
      ? Boolean(currentStep.receiptRequired)
      : Number(currentStep?.receipt_required ?? 1) === 1;

  const workflowFinished =
    Boolean(data) &&
    (data.enabled === false || data.enabled === 0) &&
    String(data.finalReviewStatus ?? data.final_review_status ?? "").toLowerCase() === "approved";

  useEffect(() => {
    if (!workflowFinished) return undefined;
    const timer = setTimeout(() => navigate("/dashboard", { replace: true }), 1200);
    return () => clearTimeout(timer);
  }, [navigate, workflowFinished]);

  async function copyAddress() {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      setError("Unable to copy the verification address.");
    }
  }

  function chooseFile(event) {
    const selected = event.target.files?.[0] || null;
    if (!selected) {
      setFile(null);
      return;
    }
    if (!ALLOWED_TYPES.has(String(selected.type || "").toLowerCase())) {
      setFile(null);
      setError("Only JPG, PNG, WEBP, or PDF evidence files are allowed.");
      return;
    }
    if (selected.size > MAX_FILE_SIZE) {
      setFile(null);
      setError("Evidence file must be 10 MB or smaller.");
      return;
    }
    setError("");
    setFile(selected);
  }

  async function submit(event) {
    event.preventDefault();
    if (!currentStep || !data?.enabled) return;

    if (!["pending", "rejected"].includes(currentStatus)) {
      setError("This stage is currently being reviewed or has already been completed.");
      return;
    }

    if (requiredAmount && normalizeDecimal(amount) !== normalizeDecimal(requiredAmount)) {
      setError("Enter the exact required verification amount.");
      return;
    }
    if (transactionRequired && !tx.trim()) {
      setError("Transaction hash / reference is required.");
      return;
    }
    if (receiptRequired && !file) {
      setError("Verification evidence is required.");
      return;
    }

    try {
      setSubmitting(true);
      setError("");
      const formData = new FormData();
      formData.append("transaction_hash", tx.trim());
      formData.append("amount", amount.trim());
      formData.append("evidence_note", note.trim());
      if (file) formData.append("receipt", file);

      await submitAccountVerification(currentStepNumber, formData, token);
      setTx("");
      setAmount("");
      setNote("");
      setFile(null);
      await load({ manual: true });
    } catch (e) {
      setError(
        e?.response?.data?.message ||
          e?.response?.data?.error ||
          e?.message ||
          "Verification submission failed."
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050812] p-5 text-sm text-slate-300">
        Loading verification status…
      </div>
    );
  }

  if (!data?.enabled && !workflowFinished) {
    return (
      <div className="min-h-screen bg-[#050812] p-5 text-sm text-slate-300">
        No active external wallet verification is required.
      </div>
    );
  }

  if (workflowFinished) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#050812] px-5 text-white">
        <div className="w-full max-w-md rounded-[28px] border border-emerald-400/15 bg-[#0a0e1a] p-7 text-center">
          <CheckCircle2 className="mx-auto text-emerald-300" size={42} />
          <h1 className="mt-4 text-xl font-bold">Verification completed</h1>
          <p className="mt-2 text-xs leading-5 text-slate-400">
            All three stages were approved. Your VexaTrade platform access is being restored.
          </p>
        </div>
      </div>
    );
  }

  const stageCompleted = currentStatus === "completed";
  const stageSubmitted = currentStatus === "submitted";
  const stageLocked = currentStatus === "locked";
  const stageRejected = currentStatus === "rejected";

  return (
    <div className="min-h-screen bg-[#050812] px-4 py-6 text-white">
      <div className="mx-auto max-w-md space-y-4">
        <section className="rounded-[28px] border border-cyan-400/15 bg-[#0a0e1a] p-5 shadow-2xl">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-cyan-500/10 p-3">
              <ShieldCheck className="text-cyan-300" size={22} />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-[.28em] text-cyan-300">Account access</div>
              <h1 className="mt-1 text-xl font-bold">{data.title || "External Wallet Verification"}</h1>
            </div>
          </div>
          <p className="mt-4 text-xs leading-5 text-slate-400">
            {data.description || "Complete each verification stage in order while your evidence is reviewed."}
          </p>

          <div className="mt-5 rounded-3xl border border-cyan-400/20 bg-[radial-gradient(circle_at_top,rgba(34,211,238,.12),transparent_65%),#050812] p-4 text-center shadow-[0_18px_60px_rgba(0,0,0,.35)]">
            <div className="flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-[.28em] text-cyan-300"><Clock3 size={15}/> Verification Time Remaining</div>
            <div className={`mt-2 text-5xl font-black tabular-nums tracking-tight sm:text-6xl ${timerExpired ? "text-red-300" : "text-cyan-300"}`}>{formatTimer(remainingSeconds)}</div>
            <div className="mt-2 text-[10px] text-slate-500">{timerExpired ? "Deadline reached · waiting for server verification status" : deadlineValue ? `Live server deadline · ${new Date(deadlineValue).toLocaleString()}` : "Server deadline is not available"}</div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10"><div className={`h-full rounded-full transition-[width] duration-1000 ${timerExpired ? "bg-red-400" : "bg-cyan-400"}`} style={{width: remainingSeconds === null ? "0%" : `${Math.max(0,Math.min(100,(remainingSeconds / Math.max(1,Number(data?.timerSeconds ?? data?.timer_seconds ?? remainingSeconds))) * 100))}%`}} /></div>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-2">
            {steps.map((stage) => {
              const number = getStepNumber(stage);
              const status = getStepStatus(stage);
              const active = number === currentStepNumber;
              return (
                <div
                  key={number}
                  className={
                    "rounded-xl border p-2 text-center " +
                    (status === "completed"
                      ? "border-emerald-500/20 bg-emerald-500/10"
                      : active
                        ? "border-cyan-400/25 bg-cyan-500/10"
                        : "border-white/10 bg-white/[.02]")
                  }
                >
                  <div className="text-[10px] text-slate-500">Stage {number}</div>
                  <div className="mt-1 text-[10px] font-semibold capitalize text-slate-200">
                    {status.replaceAll("_", " ")}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {error ? (
          <div className="flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-3 text-xs text-red-300">
            <AlertTriangle size={15} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}

        {currentStep ? (
          <>
            <section className="rounded-[24px] border border-white/10 bg-[#0a0e1a] p-4 shadow-xl">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[10px] uppercase tracking-[.22em] text-cyan-300">
                    Current stage {currentStepNumber}
                  </div>
                  <h2 className="mt-1 text-lg font-semibold">
                    {currentStep.title || `Verification Step ${currentStepNumber}`}
                  </h2>
                </div>
                <span className="rounded-full border border-cyan-400/15 bg-cyan-500/10 px-2 py-1 text-[10px] text-cyan-300">
                  {currentStep.coin} · {currentStep.network}
                </span>
              </div>

              <p className="mt-3 text-xs leading-5 text-slate-400">
                {currentStep.description || "Follow the configured verification instructions and submit your evidence."}
              </p>

              <div className="mt-4 rounded-2xl border border-white/10 bg-[#050812] p-3">
                <div className="text-[10px] uppercase tracking-wider text-slate-500">Verification address</div>
                <div className="mt-2 break-all text-xs font-mono text-slate-200">{address}</div>
                <button
                  type="button"
                  onClick={copyAddress}
                  className="mt-3 inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-[11px] text-white"
                >
                  <Copy size={13} />
                  {copied ? "Copied" : "Copy address"}
                </button>
              </div>

              {requiredAmount ? (
                <div className="mt-3 rounded-2xl border border-amber-400/15 bg-amber-500/5 p-3">
                  <div className="text-[10px] uppercase tracking-wider text-amber-300">Required exact amount</div>
                  <div className="mt-1 text-xl font-bold text-white">{requiredAmount}</div>
                  <div className="mt-1 text-[10px] text-slate-500">
                    This workflow records verification evidence only; it does not debit or credit the VexaTrade ledger.
                  </div>
                </div>
              ) : null}
            </section>

            {stageSubmitted ? (
              <section className="rounded-[24px] border border-amber-400/15 bg-[#0a0e1a] p-6 text-center shadow-xl">
                <Clock3 className="mx-auto text-amber-300" size={28} />
                <h3 className="mt-3 text-sm font-semibold">Stage {currentStepNumber} is under review</h3>
                <p className="mt-2 text-xs leading-5 text-slate-400">
                  Your evidence has been submitted. The next stage unlocks through the VexaTrade Blockchain Ecosystem verification workflow.
                </p>
              </section>
            ) : stageLocked || stageCompleted ? (
              <section className="rounded-[24px] border border-white/10 bg-[#0a0e1a] p-6 text-center text-sm text-slate-400">
                {stageCompleted
                  ? "This stage is completed. Refresh to receive the next Blockchain Ecosystem verification state."
                  : "This stage is locked until the previous stage is completed."}
              </section>
            ) : (
              <form onSubmit={submit} className="space-y-3 rounded-[24px] border border-white/10 bg-[#0a0e1a] p-4 shadow-xl">
                {stageRejected ? (
                  <div className="rounded-xl border border-red-400/15 bg-red-500/5 px-3 py-2 text-xs text-red-300">
                    This stage needs resubmission. Review the verification review note above or in your notification and submit corrected evidence.
                  </div>
                ) : null}

                <input
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder={requiredAmount ? "Enter exact required amount" : "Amount"}
                  inputMode="decimal"
                  required={Boolean(requiredAmount)}
                  className="w-full rounded-xl border border-white/10 bg-[#050812] px-3 py-3 text-sm text-white"
                />

                <input
                  value={tx}
                  onChange={(e) => setTx(e.target.value)}
                  placeholder="Transaction hash / reference"
                  required={transactionRequired}
                  className="w-full rounded-xl border border-white/10 bg-[#050812] px-3 py-3 text-sm text-white"
                />

                <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#050812] px-3 py-3 text-xs text-slate-400">
                  <FileUp size={15} />
                  <span className="flex-1 truncate">{file?.name || "Upload receipt / evidence"}</span>
                  <span className="rounded-lg bg-white/[.06] px-2 py-1 text-white">Choose</span>
                  <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={chooseFile} className="hidden" />
                </label>

                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                  placeholder="Evidence note (optional)"
                  className="w-full rounded-xl border border-white/10 bg-[#050812] px-3 py-3 text-sm text-white"
                />

                <button
                  disabled={submitting}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-500 px-4 py-3 text-sm font-bold text-slate-950 disabled:opacity-50"
                >
                  {submitting ? <RefreshCw size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
                  {submitting ? "Submitting…" : "Submit verification evidence"}
                </button>
              </form>
            )}
          </>
        ) : (
          <section className="rounded-[24px] border border-white/10 bg-[#0a0e1a] p-6 text-center text-sm text-slate-400">
            Waiting for the verification workflow to provide the current stage.
          </section>
        )}

        <button
          type="button"
          onClick={() => void load({ manual: true })}
          disabled={refreshing}
          className="mx-auto flex items-center gap-2 text-xs text-slate-500 disabled:opacity-50"
        >
          <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} />
          {refreshing ? "Refreshing status…" : "Refresh status"}
        </button>
      </div>
    </div>
  );
}
