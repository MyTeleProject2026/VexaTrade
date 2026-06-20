import { useEffect, useState } from "react";
import {
  Newspaper,
  Plus,
  RefreshCw,
  Trash2,
  Eye,
  EyeOff,
  Image as ImageIcon,
  FileText,
  Code,
} from "lucide-react";
import { adminApi, getApiErrorMessage } from "../../services/api";
import useToast from "../../components/ToastNotification";
import DOMPurify from "dompurify";

// ─── Helper Functions ────────────────────────────────────────────────
function resolveImage(url) {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;

  const base =
    import.meta.env.VITE_API_BASE_URL || "https://vexatrade-server.onrender.com";

  return `${base}${url}`;
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function StatusBadge({ active }) {
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
        active
          ? "border border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
          : "border border-red-500/20 bg-red-500/10 text-red-300"
      }`}
    >
      {active ? "Active" : "Hidden"}
    </span>
  );
}

// ─── News Item Component ─────────────────────────────────────────────
function NewsItem({ item, onToggle, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const hasHtmlContent = item.html_content && item.html_content.trim().length > 0;
  const hasPlainContent = item.content && item.content.trim().length > 0;
  const hasContent = hasHtmlContent || hasPlainContent;

  const getPreview = (html) => {
    const div = document.createElement("div");
    div.innerHTML = html;
    const text = div.textContent || div.innerText || "";
    return text.slice(0, 150) + (text.length > 150 ? "..." : "");
  };

  return (
    <div className="rounded-[22px] border border-white/10 bg-[#050812]/50 p-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <div className="text-base font-semibold text-white sm:text-lg">
              {item.title}
            </div>
            <StatusBadge active={Number(item.is_active ?? 1) === 1} />
            {hasHtmlContent && (
              <span className="rounded-full border border-purple-500/20 bg-purple-500/10 px-2 py-0.5 text-[10px] text-purple-300">
                HTML
              </span>
            )}
          </div>

          {hasContent && (
            <div className="mt-2">
              {!expanded ? (
                <div
                  className="text-sm leading-6 text-slate-400 line-clamp-3"
                  dangerouslySetInnerHTML={{
                    __html: DOMPurify.sanitize(
                      hasHtmlContent ? getPreview(item.html_content) : item.content
                    ),
                  }}
                />
              ) : (
                <div
                  className="text-sm leading-6 text-slate-200 prose prose-invert max-w-none"
                  dangerouslySetInnerHTML={{
                    __html: DOMPurify.sanitize(
                      hasHtmlContent ? item.html_content : item.content
                    ),
                  }}
                />
              )}
              <button
                onClick={() => setExpanded(!expanded)}
                className="mt-1 text-xs text-cyan-400 hover:text-cyan-300"
              >
                {expanded ? "Show less ▲" : "Read more ▼"}
              </button>
            </div>
          )}

          <div className="mt-3 text-[11px] text-slate-500">
            Created: {formatDate(item.created_at)}
          </div>
        </div>

        {item.image_url ? (
          <img
            src={resolveImage(item.image_url)}
            alt={item.title}
            className="h-20 w-full rounded-2xl border border-white/10 object-cover lg:h-20 lg:w-36"
          />
        ) : null}
      </div>

      <div className="mt-4 flex flex-wrap gap-2.5">
        <button
          type="button"
          onClick={() => onToggle(item)}
          className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-white/[0.08]"
        >
          {Number(item.is_active ?? 1) === 1 ? (
            <>
              <EyeOff size={15} />
              Hide
            </>
          ) : (
            <>
              <Eye size={15} />
              Show
            </>
          )}
        </button>

        <button
          type="button"
          onClick={() => onDelete(item.id)}
          className="inline-flex items-center gap-2 rounded-2xl border border-red-500/20 bg-red-500/10 px-3.5 py-2 text-sm font-semibold text-red-300 transition hover:bg-red-500/20"
        >
          <Trash2 size={15} />
          Delete
        </button>
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────
export default function AdminNewsPage() {
  const token =
    localStorage.getItem("adminToken") ||
    localStorage.getItem("admin_token") ||
    "";

  const { toasts, addToast, removeToast, ToastContainer } = useToast();

  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [contentMode, setContentMode] = useState("normal"); // "normal" | "html"

  const [form, setForm] = useState({
    title: "",
    content: "",
    html_content: "",
    image_url: "",
    is_active: true,
  });

  async function load() {
    try {
      setRefreshing(true);
      setError("");

      const res = await adminApi.getNews(token);
      setList(Array.isArray(res.data?.data) ? res.data.data : []);

      addToast("News refreshed successfully", "success");
    } catch (err) {
      const errorMsg = getApiErrorMessage(err);
      setError(errorMsg);
      addToast(errorMsg, "error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function createNews() {
    try {
      if (!form.title.trim()) {
        const errorMsg = "Title is required.";
        setError(errorMsg);
        setSuccess("");
        addToast(errorMsg, "error");
        return;
      }

      // Validate based on mode
      if (contentMode === "normal" && !form.content.trim()) {
        const errorMsg = "Content is required in Normal mode.";
        setError(errorMsg);
        addToast(errorMsg, "error");
        return;
      }

      if (contentMode === "html" && !form.html_content.trim()) {
        const errorMsg = "HTML content is required in HTML mode.";
        setError(errorMsg);
        addToast(errorMsg, "error");
        return;
      }

      setSubmitting(true);
      setError("");
      setSuccess("");

      const payload = {
        title: form.title.trim(),
        image_url: form.image_url.trim(),
        is_active: form.is_active ? 1 : 0,
      };

      // ✅ Send content based on mode
      if (contentMode === "normal") {
        payload.content = form.content.trim();
        payload.html_content = null;
      } else {
        payload.html_content = form.html_content.trim();
        payload.content = null;
      }

      await adminApi.createNews(payload, token);

      setForm({
        title: "",
        content: "",
        html_content: "",
        image_url: "",
        is_active: true,
      });
      setContentMode("normal");

      const successMsg = "News posted successfully.";
      setSuccess(successMsg);
      addToast(successMsg, "success");
      await load();
    } catch (err) {
      const errorMsg = getApiErrorMessage(err);
      setError(errorMsg);
      setSuccess("");
      addToast(errorMsg, "error");
    } finally {
      setSubmitting(false);
    }
  }

  async function removeNews(id) {
    try {
      setError("");
      setSuccess("");

      await adminApi.deleteNews(id, token);
      const successMsg = "News deleted successfully.";
      setSuccess(successMsg);
      addToast(successMsg, "success");
      await load();
    } catch (err) {
      const errorMsg = getApiErrorMessage(err);
      setError(errorMsg);
      setSuccess("");
      addToast(errorMsg, "error");
    }
  }

  async function toggleActive(item) {
    try {
      setError("");
      setSuccess("");

      if (typeof adminApi.updateNews === "function") {
        // Preserve existing content fields
        await adminApi.updateNews(
          item.id,
          {
            title: item.title,
            content: item.content || null,
            html_content: item.html_content || null,
            image_url: item.image_url,
            is_active: Number(item.is_active) === 1 ? 0 : 1,
          },
          token
        );

        const newStatus = Number(item.is_active) === 1 ? "hidden" : "active";
        const successMsg = `News status updated to ${newStatus}.`;
        setSuccess(successMsg);
        addToast(successMsg, "success");
        await load();
        return;
      }

      const errorMsg = "updateNews API is not connected yet in services/api.js";
      setError(errorMsg);
      addToast(errorMsg, "error");
    } catch (err) {
      const errorMsg = getApiErrorMessage(err);
      setError(errorMsg);
      setSuccess("");
      addToast(errorMsg, "error");
    }
  }

  // ─── Render ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-5 text-white">
        <div className="rounded-[24px] border border-white/10 bg-[#0a0e1a] p-5 text-sm text-slate-300">
          Loading news control...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 text-white">
      <ToastContainer />

      <section className="rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(163,230,53,0.10),transparent_18%),linear-gradient(180deg,#0f172a_0%,#020617_100%)] p-5 shadow-xl">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-[0.32em] text-lime-300">
              Admin News Control
            </div>
            <h1 className="mt-2 text-2xl font-bold text-white sm:text-3xl">
              VexaTrade News
            </h1>
            <p className="mt-2 text-sm text-slate-400">
              Post dashboard announcements with normal text or HTML content.
            </p>
          </div>

          <button
            type="button"
            onClick={load}
            className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/[0.08]"
          >
            <RefreshCw size={15} className={refreshing ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </section>

      {error ? (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      ) : null}

      {success ? (
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
          {success}
        </div>
      ) : null}

      <section className="grid gap-5 xl:grid-cols-[0.98fr_1.02fr]">
        <div className="rounded-[24px] border border-white/10 bg-[#0a0e1a] shadow-xl">
          <div className="border-b border-white/10 px-4 py-4 sm:px-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Plus size={17} className="text-lime-300" />
                <h2 className="text-lg font-semibold text-white">Create News</h2>
              </div>

              {/* ✅ Content Mode Toggle */}
              <div className="flex rounded-lg border border-white/10 overflow-hidden bg-[#050812]">
                <button
                  type="button"
                  onClick={() => setContentMode("normal")}
                  className={`px-3 py-1.5 text-xs font-medium flex items-center gap-1 transition ${
                    contentMode === "normal"
                      ? "bg-cyan-500/20 text-cyan-300"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <FileText size={14} /> Normal
                </button>
                <button
                  type="button"
                  onClick={() => setContentMode("html")}
                  className={`px-3 py-1.5 text-xs font-medium flex items-center gap-1 transition ${
                    contentMode === "html"
                      ? "bg-cyan-500/20 text-cyan-300"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <Code size={14} /> HTML
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-4 p-4 sm:p-5">
            <div>
              <label className="mb-2 block text-sm text-slate-400">Title</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, title: e.target.value }))
                }
                placeholder="Enter news title"
                className="w-full rounded-2xl border border-white/10 bg-[#050812]/70 px-4 py-3 text-sm text-white outline-none focus:border-lime-400"
              />
            </div>

            {/* ✅ Content Field - Changes based on mode */}
            {contentMode === "normal" ? (
              <div>
                <label className="mb-2 block text-sm text-slate-400">Content</label>
                <textarea
                  rows={5}
                  value={form.content}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, content: e.target.value }))
                  }
                  placeholder="Write a short announcement..."
                  className="w-full rounded-2xl border border-white/10 bg-[#050812]/70 px-4 py-3 text-sm text-white outline-none focus:border-lime-400"
                />
              </div>
            ) : (
              <div>
                <label className="mb-2 block text-sm text-slate-400">
                  HTML Content
                </label>
                <p className="text-xs text-slate-500 mb-2">
                  Write your full HTML content with styling, images, or formatting.
                </p>
                <textarea
                  rows={8}
                  value={form.html_content}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, html_content: e.target.value }))
                  }
                  placeholder="<h1>Announcement</h1><p>Your content here...</p>"
                  className="w-full rounded-2xl border border-white/10 bg-[#050812]/70 px-4 py-3 text-sm font-mono text-cyan-300 outline-none focus:border-lime-400 resize-y"
                  spellCheck={false}
                />
              </div>
            )}

            <div>
              <label className="mb-2 block text-sm text-slate-400">Image URL</label>
              <input
                type="text"
                value={form.image_url}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, image_url: e.target.value }))
                }
                placeholder="Paste poster or banner image URL"
                className="w-full rounded-2xl border border-white/10 bg-[#050812]/70 px-4 py-3 text-sm text-white outline-none focus:border-lime-400"
              />
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#050812]/40 p-4">
              <label className="flex items-center gap-3 text-sm text-slate-300">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, is_active: e.target.checked }))
                  }
                  className="h-4 w-4"
                />
                Publish as active news
              </label>
            </div>

            {form.image_url ? (
              <div className="rounded-2xl border border-white/10 bg-[#050812]/40 p-4">
                <div className="mb-3 flex items-center gap-2 text-sm text-slate-400">
                  <ImageIcon size={15} />
                  Preview
                </div>
                <img
                  src={resolveImage(form.image_url)}
                  alt="News preview"
                  className="max-h-64 w-full rounded-2xl border border-white/10 object-cover"
                />
              </div>
            ) : null}

            <button
              type="button"
              onClick={createNews}
              disabled={submitting}
              className="w-full rounded-2xl bg-lime-400 px-4 py-3 text-sm font-semibold text-black transition hover:bg-lime-300 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting
                ? "Posting..."
                : contentMode === "html"
                ? "Post HTML News"
                : "Post News"}
            </button>
          </div>
        </div>

        <div className="rounded-[24px] border border-white/10 bg-[#0a0e1a] shadow-xl">
          <div className="border-b border-white/10 px-4 py-4 sm:px-5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Newspaper size={17} className="text-lime-300" />
                <h2 className="text-lg font-semibold text-white">News List</h2>
              </div>

              <span className="rounded-full border border-white/10 bg-[#050812]/70 px-3 py-1 text-[11px] text-slate-300">
                {list.length} Record{list.length === 1 ? "" : "s"}
              </span>
            </div>
          </div>

          <div className="space-y-4 p-4 sm:p-5">
            {list.length ? (
              list.map((item) => (
                <NewsItem
                  key={item.id}
                  item={item}
                  onToggle={toggleActive}
                  onDelete={removeNews}
                />
              ))
            ) : (
              <div className="rounded-2xl border border-white/10 bg-[#050812]/40 px-4 py-10 text-center text-sm text-slate-400">
                No news posted yet.
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
