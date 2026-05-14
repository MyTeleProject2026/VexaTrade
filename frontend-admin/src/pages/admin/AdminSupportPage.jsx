import { useEffect, useState } from "react";
import { RefreshCw, Headset, Link as LinkIcon, MessageSquareText } from "lucide-react";
import { adminApi, getApiErrorMessage } from "../../services/api";
// ✅ ADDED: Import toast notification hook
import useToast from "../components/ToastNotification";

function PreviewCard({ title, value, tone = "text-white", breakAll = false }) {
  return (
    <div className="rounded-xl border border-white/10 bg-[#050812]/50 p-3">
      <div className="text-[11px] uppercase tracking-wide text-slate-500">{title}</div>
      <div
        className={`mt-1 text-sm ${tone} ${
          breakAll ? "break-all" : "break-words"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

export default function AdminSupportPage() {
  const token =
    localStorage.getItem("adminToken") ||
    localStorage.getItem("admin_token") ||
    "";

  // ✅ ADDED: Toast notification hook
  const { toasts, addToast, removeToast, ToastContainer } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [form, setForm] = useState({
    channel: "",
    contact: "",
    link: "",
    note: "",
  });

  useEffect(() => {
    loadSupportSettings(true);
  }, [token]);

  async function loadSupportSettings(isFirstLoad = false) {
    try {
      if (isFirstLoad) setLoading(true);
      else setRefreshing(true);

      setError("");

      const res = await adminApi.getSupportSettings(token);
      const data = res.data?.data || {};

      setForm({
        channel: data.channel || "",
        contact: data.contact || "",
        link: data.link || "",
        note: data.note || "",
      });
      
      // ✅ ADDED: Success toast for refresh
      if (!isFirstLoad) {
        addToast("Support settings refreshed successfully", "success");
      }
    } catch (err) {
      const errorMsg = getApiErrorMessage(err);
      setError(errorMsg);
      // ✅ ADDED: Error toast
      addToast(errorMsg, "error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      await adminApi.updateSupportSettings(
        {
          channel: String(form.channel || "").trim(),
          contact: String(form.contact || "").trim(),
          link: String(form.link || "").trim(),
          note: String(form.note || "").trim(),
        },
        token
      );

      const successMsg = "Customer service settings updated successfully.";
      setSuccess(successMsg);
      // ✅ ADDED: Success toast
      addToast(successMsg, "success");
      await loadSupportSettings(false);
    } catch (err) {
      const errorMsg = getApiErrorMessage(err);
      setError(errorMsg);
      // ✅ ADDED: Error toast
      addToast(errorMsg, "error");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-[24px] border border-white/10 bg-[#0a0e1a] p-5 text-sm text-slate-300">
        Loading support settings...
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* ✅ ADDED: Toast Container */}
      <ToastContainer />

      <section className="rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(124,58,237,0.10),transparent_18%),linear-gradient(180deg,#111827_0%,#020617_100%)] p-5 shadow-xl">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.32em] text-cyan-300">
              Customer Service
            </p>
            <h1 className="mt-2 text-2xl font-bold text-white sm:text-3xl">
              Support Settings
            </h1>
            <p className="mt-2 text-sm text-slate-400">
              Configure the support channel shown to users inside the platform.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span
              className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${
                refreshing
                  ? "border-cyan-500/20 bg-cyan-500/10 text-cyan-300"
                  : "border-white/10 bg-[#050812]/70 text-slate-300"
              }`}
            >
              <span
                className={`mr-2 inline-block h-2.5 w-2.5 rounded-full ${
                  refreshing ? "animate-pulse bg-cyan-400" : "bg-emerald-400"
                }`}
              />
              {refreshing ? "Refreshing..." : "Ready"}
            </span>

            <button
              type="button"
              onClick={() => loadSupportSettings(false)}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-white/5"
            >
              <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
              Refresh
            </button>
          </div>
        </div>
      </section>

      {error ? (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      ) : null}

      {success ? (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
          {success}
        </div>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
        <section className="rounded-[24px] border border-white/10 bg-[#0a0e1a] p-4 shadow-xl sm:p-5">
          <div className="mb-5">
            <h2 className="text-lg font-semibold text-white">Edit Support Details</h2>
            <p className="mt-1 text-sm text-slate-400">
              Update support channel, contact value, link, and note.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-2 block text-sm text-slate-300">
                Support Channel
              </label>
              <input
                type="text"
                name="channel"
                value={form.channel}
                onChange={handleChange}
                placeholder="Telegram / WhatsApp / Line / Email / Live Chat"
                className="w-full rounded-xl border border-white/10 bg-[#0a0e1a] px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm text-slate-300">
                Contact Value
              </label>
              <input
                type="text"
                name="contact"
                value={form.contact}
                onChange={handleChange}
                placeholder="@VexaTrade_support / phone / email"
                className="w-full rounded-xl border border-white/10 bg-[#0a0e1a] px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm text-slate-300">
                Support Link
              </label>
              <input
                type="text"
                name="link"
                value={form.link}
                onChange={handleChange}
                placeholder="https://t.me/your_support_username"
                className="w-full rounded-xl border border-white/10 bg-[#0a0e1a] px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm text-slate-300">
                Support Note
              </label>
              <textarea
                name="note"
                value={form.note}
                onChange={handleChange}
                rows={4}
                placeholder="Available hours, response note, extra message..."
                className="w-full rounded-xl border border-white/10 bg-[#0a0e1a] px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-500"
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-xl bg-cyan-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-cyan-400 disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save Support Settings"}
            </button>
          </form>
        </section>

        <section className="rounded-[24px] border border-white/10 bg-[#0a0e1a] p-4 shadow-xl sm:p-5">
          <div className="mb-5">
            <h2 className="text-lg font-semibold text-white">Live Preview</h2>
            <p className="mt-1 text-sm text-slate-400">
              Preview how support information appears inside the platform.
            </p>
          </div>

          <div className="space-y-3">
            <PreviewCard
              title="Support Channel"
              value={form.channel || "Customer Service"}
            />

            <PreviewCard
              title="Contact"
              value={form.contact || "Not configured"}
              breakAll
            />

            <PreviewCard
              title="Link"
              value={form.link || "No link set"}
              tone="text-cyan-300"
              breakAll
            />

            <PreviewCard
              title="Note"
              value={form.note || "No note set"}
            />

            <div className="rounded-2xl border border-dashed border-white/10 bg-[#050812]/30 p-4">
              <div className="mb-3 text-sm text-slate-400">User Page Result</div>

              <div className="rounded-2xl border border-white/10 bg-[#0a0e1a]/60 p-4">
                <div className="grid gap-3">
                  <div className="flex items-start gap-3">
                    <Headset className="mt-0.5 h-4 w-4 text-cyan-300" />
                    <div>
                      <div className="text-xs text-slate-500">Support Channel</div>
                      <div className="mt-1 text-sm font-medium text-white">
                        {form.channel || "Customer Service"}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <MessageSquareText className="mt-0.5 h-4 w-4 text-cyan-300" />
                    <div>
                      <div className="text-xs text-slate-500">Contact</div>
                      <div className="mt-1 break-all text-sm text-slate-300">
                        {form.contact || "Not configured"}
                      </div>
                    </div>
                  </div>

                  {form.link ? (
                    <div className="flex items-start gap-3">
                      <LinkIcon className="mt-0.5 h-4 w-4 text-emerald-300" />
                      <div>
                        <div className="text-xs text-slate-500">Support Link</div>
                        <div className="mt-1 break-all text-sm text-cyan-300">
                          {form.link}
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {form.note ? (
                    <div>
                      <div className="text-xs text-slate-500">Support Note</div>
                      <div className="mt-1 text-sm text-slate-300">
                        {form.note}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
