import { useEffect, useMemo, useState } from "react";
import { ChevronRight, Newspaper, Sparkles } from "lucide-react";
import { newsApi } from "../services/api";

const FALLBACK_NEWS = [
  {
    id: "fallback-1",
    title: "VexaTrade News",
    content:
      "Track platform updates, trading insights, and important account announcements in one premium feed.",
    image_url:
      "https://images.unsplash.com/photo-1639762681485-074b7f938ba0?q=80&w=1200&auto=format&fit=crop",
    is_active: 1,
    created_at: new Date().toISOString(),
  },
  {
    id: "fallback-2",
    title: "Market Momentum",
    content:
      "Watch fast-moving pairs, short-term setups, and cleaner trading signals directly from your dashboard.",
    image_url:
      "https://images.unsplash.com/photo-1642104704074-907c0698cbd9?q=80&w=1200&auto=format&fit=crop",
    is_active: 1,
    created_at: new Date().toISOString(),
  },
  {
    id: "fallback-3",
    title: "Platform Announcement",
    content:
      "Stay aligned with wallet flow updates, legal notices, and important system improvements.",
    image_url:
      "https://images.unsplash.com/photo-1621761191319-c6fb62004040?q=80&w=1200&auto=format&fit=crop",
    is_active: 1,
    created_at: new Date().toISOString(),
  },
];

function resolveImage(url) {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;

  const base =
    import.meta.env.VITE_API_BASE_URL || "https://VexaTrade-4rhe.onrender.com";

  return `${base}${url}`;
}

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString();
}

export default function NewsSlider() {
  const [items, setItems] = useState(FALLBACK_NEWS);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  async function loadNews() {
    try {
      setLoading(true);
      const res = await newsApi.getNews();
      const rows = Array.isArray(res?.data?.data) ? res.data.data : [];

      const activeRows = rows.filter(
        (item) => Number(item.is_active ?? 1) === 1
      );

      if (activeRows.length > 0) {
        setItems(activeRows);
      } else {
        setItems(FALLBACK_NEWS);
      }
    } catch {
      setItems(FALLBACK_NEWS);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadNews();
  }, []);

  useEffect(() => {
    if (!items.length) return;

    const interval = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % items.length);
    }, 4500);

    return () => clearInterval(interval);
  }, [items]);

  const activeItem = useMemo(() => {
    return items[activeIndex] || FALLBACK_NEWS[0];
  }, [items, activeIndex]);

  return (
    <section className="overflow-hidden rounded-[34px] border border-white/10 bg-[#0d0d0d] shadow-[0_20px_80px_rgba(0,0,0,0.35)]">
      <div className="relative min-h-[220px] overflow-hidden sm:min-h-[250px]">
        {activeItem?.image_url ? (
          <img
            src={resolveImage(activeItem.image_url)}
            alt={activeItem.title || "News"}
            className="absolute inset-0 h-full w-full object-cover opacity-30"
          />
        ) : null}

        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(0,0,0,0.88)_0%,rgba(0,0,0,0.66)_42%,rgba(0,0,0,0.38)_100%)]" />

        <div className="relative z-10 flex min-h-[220px] flex-col justify-between p-5 sm:min-h-[250px] sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400">
              <Newspaper size={14} />
              VexaTrade News
            </div>

            <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-slate-300">
              {loading ? "Loading..." : `${activeIndex + 1}/${items.length}`}
            </div>
          </div>

          <div className="mt-5 max-w-[82%]">
            <div className="inline-flex items-center gap-2 text-xs text-slate-400">
              <Sparkles size={13} className="text-cyan-400" />
              Latest Update
            </div>

            <h2 className="mt-3 text-2xl font-bold text-white sm:text-3xl">
              {activeItem?.title || "VexaTrade Update"}
            </h2>

            <p className="mt-3 line-clamp-3 text-sm leading-7 text-slate-300 sm:text-base">
              {activeItem?.content || "No update available."}
            </p>

            <div className="mt-4 flex items-center gap-2 text-sm text-slate-400">
              <span>{formatDate(activeItem?.created_at)}</span>
              <ChevronRight size={14} />
              <span>Announcement</span>
            </div>
          </div>

          <div className="mt-5 flex items-center gap-2">
            {items.map((item, index) => (
              <button
                key={item.id || index}
                type="button"
                onClick={() => setActiveIndex(index)}
                className={`h-2.5 rounded-full transition-all ${
                  activeIndex === index
                    ? "w-10 bg-cyan-500"
                    : "w-2.5 bg-white/20 hover:bg-white/35"
                }`}
                aria-label={`Go to news ${index + 1}`}
              />
            ))}
          </div>
        </div>
      </div>

      {items.length > 1 ? (
        <div className="grid gap-3 border-t border-white/10 bg-[#050812]/40 p-4 sm:grid-cols-3">
          {items.slice(0, 3).map((item, index) => (
            <button
              key={item.id || index}
              type="button"
              onClick={() => setActiveIndex(index)}
              className={`rounded-2xl border px-4 py-3 text-left transition ${
                activeIndex === index
                  ? "border-cyan-500/20 bg-cyan-500/10"
                  : "border-white/10 bg-white/[0.02] hover:bg-white/[0.04]"
              }`}
            >
              <div className="truncate text-sm font-semibold text-white">
                {item.title}
              </div>
              <div className="mt-1 line-clamp-2 text-xs leading-5 text-slate-400">
                {item.content}
              </div>
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}
