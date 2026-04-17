import { useEffect, useState } from "react";
import {
  Newspaper,
  Plus,
  RefreshCw,
  Trash2,
  Eye,
  EyeOff,
  Image as ImageIcon,
} from "lucide-react";
import { adminApi, getApiErrorMessage } from "../../services/api";

function resolveImage(url) {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;

  const base =
    import.meta.env.VITE_API_BASE_URL || "https://VexaTrade-4rhe.onrender.com";

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

export default function AdminNewsPage() {
  const token =
    localStorage.getItem("adminToken") ||
    localStorage.getItem("admin_token") ||
    "";

  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [form, setForm] = useState({
    title: "",
    content: "",
    image_url: "",
    is_active: true,
  });

  async function load() {
    try {
      setRefreshing(true);
      setError("");

      const res = await adminApi.getNews(token);
      setList(Array.isArray(res.data?.data) ? res.data.data : []);
    } catch (err) {
      setError(getApiErrorMessage(err));
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
        setError("Title is required.");
        setSuccess("");
        return;
      }

      setSubmitting(true);
      setError("");
      setSuccess("");

      await adminApi.createNews(
        {
          title: form.title.trim(),
          content: form.content.trim(),
          image_url: form.image_url.trim(),
          is_active: form.is_active ? 1 : 0,
        },
        token
      );

      setForm({
        title: "",
        content: "",
        image_url: "",
        is_active: true,
      });

      setSuccess("News posted successfully.");
      await load();
    } catch (err) {
      setError(getApiErrorMessage(err));
      setSuccess("");
    } finally {
      setSubmitting(false);
    }
  }

  async function removeNews(id) {
    try {
      setError("");
      setSuccess("");

      await adminApi.deleteNews(id, token);
      setSuccess("News deleted successfully.");
      await load();
    } catch (err) {
      setError(getApiErrorMessage(err));
      setSuccess("");
    }
  }

  async function toggleActive(item) {
    try {
      setError("");
      setSuccess("");

      if (typeof adminApi.updateNews === "function") {
        await adminApi.updateNews(
          item.id,
          {
            title: item.title,
            content: item.content,
            image_url: item.image_url,
            is_active: Number(item.is_active) === 1 ? 0 : 1,
          },
          token
        );

        setSuccess("News status updated.");
        await load();
        return;
      }

      setError("updateNews API is not connected yet in services/api.js");
    } catch (err) {
      setError(getApiErrorMessage(err));
      setSuccess("");
    }
  }

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
              Post dashboard announcements, poster updates, and premium slider news.
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
            <div className="flex items-center gap-3">
              <Plus size={17} className="text-lime-300" />
              <h2 className="text-lg font-semibold text-white">Create News</h2>
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
              {submitting ? "Posting..." : "Post News"}
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
                <div
                  key={item.id}
                  className="rounded-[22px] border border-white/10 bg-[#050812]/50 p-4"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="text-base font-semibold text-white sm:text-lg">
                          {item.title}
                        </div>
                        <StatusBadge active={Number(item.is_active ?? 1) === 1} />
                      </div>

                      <div className="mt-2 text-sm leading-6 text-slate-400">
                        {item.content || "No content"}
                      </div>

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
                      onClick={() => toggleActive(item)}
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
                      onClick={() => removeNews(item.id)}
                      className="inline-flex items-center gap-2 rounded-2xl border border-red-500/20 bg-red-500/10 px-3.5 py-2 text-sm font-semibold text-red-300 transition hover:bg-red-500/20"
                    >
                      <Trash2 size={15} />
                      Delete
                    </button>
                  </div>
                </div>
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