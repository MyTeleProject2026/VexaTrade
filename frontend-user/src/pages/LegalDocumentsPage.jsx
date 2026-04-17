import { useEffect, useMemo, useState } from "react";
import {
  FileText,
  ShieldAlert,
  ScrollText,
  BadgeInfo,
  RefreshCw,
  CalendarClock,
  Search,
  X,
  ExternalLink,
  Download,
} from "lucide-react";
import { userApi, getApiErrorMessage } from "../services/api";

function getDocumentIcon(title = "") {
  const value = String(title).toLowerCase();

  if (
    value.includes("terms") ||
    value.includes("service") ||
    value.includes("conditions")
  ) {
    return ScrollText;
  }

  if (value.includes("privacy")) {
    return ShieldAlert;
  }

  if (
    value.includes("risk") ||
    value.includes("disclosure") ||
    value.includes("warning")
  ) {
    return BadgeInfo;
  }

  return FileText;
}

function getToneClass(title = "") {
  const value = String(title).toLowerCase();

  if (
    value.includes("terms") ||
    value.includes("service") ||
    value.includes("conditions")
  ) {
    return "bg-cyan-500/10 text-cyan-300";
  }

  if (value.includes("privacy")) {
    return "bg-emerald-500/10 text-emerald-300";
  }

  if (
    value.includes("risk") ||
    value.includes("disclosure") ||
    value.includes("warning")
  ) {
    return "bg-amber-500/10 text-amber-300";
  }

  return "bg-violet-500/10 text-violet-300";
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function buildFileUrl(fileUrl) {
  if (!fileUrl) return "";
  if (String(fileUrl).startsWith("http")) return fileUrl;

  const base =
    import.meta.env.VITE_API_BASE_URL || "https://VexaTrade-4rhe.onrender.com";

  return `${base}${fileUrl}`;
}

function HeaderCard({ onRefresh, refreshing }) {
  return (
    <section className="relative overflow-hidden rounded-[34px] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(163,230,53,0.10),transparent_18%),linear-gradient(180deg,#0a0a0a_0%,#050505_100%)] p-5 shadow-[0_20px_80px_rgba(0,0,0,0.45)]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.32em] text-cyan-400">
            Platform Documents
          </div>
          <h1 className="mt-2 text-3xl font-bold text-white">
            Legal document center
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            Review platform legal policies, privacy information, and risk notices.
          </p>
        </div>

        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing}
          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>
    </section>
  );
}

function SearchCard({ search, setSearch, count }) {
  return (
    <section className="rounded-[30px] border border-white/10 bg-[#0a0e1a] p-4 shadow-[0_18px_60px_rgba(0,0,0,0.35)]">
      <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title or content..."
            className="w-full rounded-2xl border border-white/10 bg-[#0a0e1a] py-3 pl-11 pr-4 text-white outline-none focus:border-cyan-500"
          />
        </div>

        <div className="flex items-center justify-center rounded-2xl border border-white/10 bg-[#050812] px-4 py-3 text-sm text-slate-300">
          {count} Document{count === 1 ? "" : "s"}
        </div>
      </div>
    </section>
  );
}

function DocumentCard({ doc, onOpen }) {
  const Icon = getDocumentIcon(doc.title);
  const toneClass = getToneClass(doc.title);

  return (
    <div className="rounded-[30px] border border-white/10 bg-[#0a0e1a] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.35)] transition hover:bg-[#121212]">
      <button type="button" onClick={() => onOpen(doc)} className="w-full text-left">
        <div
          className={`flex h-12 w-12 items-center justify-center rounded-2xl ${toneClass}`}
        >
          <Icon size={20} />
        </div>

        <h3 className="mt-4 text-xl font-semibold text-white">
          {doc.title || "-"}
        </h3>

        <p className="mt-3 line-clamp-4 text-sm leading-7 text-slate-400">
          {doc.content || "No document content available."}
        </p>

        <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
          <CalendarClock size={14} />
          <span>Updated: {formatDate(doc.updated_at || doc.created_at)}</span>
        </div>
      </button>

      <div className="mt-5 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => onOpen(doc)}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-cyan-500 px-4 py-2 text-sm font-semibold text-black transition hover:bg-cyan-400"
        >
          Read More
        </button>

        {doc.file_url ? (
          <a
            href={buildFileUrl(doc.file_url)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/[0.06]"
          >
            <ExternalLink className="h-4 w-4" />
            View Document
          </a>
        ) : null}
      </div>
    </div>
  );
}

function DocumentModal({ doc, onClose }) {
  if (!doc) return null;

  const Icon = getDocumentIcon(doc.title);
  const toneClass = getToneClass(doc.title);
  const fileUrl = buildFileUrl(doc.file_url);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#050812]/70 p-0 sm:items-center sm:p-4">
      <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-t-[32px] border border-white/10 bg-[#0b0b0b] shadow-2xl sm:rounded-[32px]">
        <div className="flex items-start justify-between gap-4 border-b border-white/10 p-4 sm:p-6">
          <div className="flex min-w-0 items-start gap-3">
            <div
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${toneClass}`}
            >
              <Icon size={20} />
            </div>

            <div className="min-w-0">
              <h2 className="break-words text-2xl font-bold text-white">
                {doc.title}
              </h2>
              <div className="mt-2 text-xs text-slate-500">
                Updated: {formatDate(doc.updated_at || doc.created_at)}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-white/10 bg-white/[0.03] p-2 text-slate-300 transition hover:bg-white/[0.06]"
          >
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto p-4 sm:p-6">
          <div className="rounded-[28px] border border-white/10 bg-[#121212] p-5 sm:p-6">
            <p className="whitespace-pre-wrap break-words text-sm leading-7 text-slate-300 sm:text-base">
              {doc.content || "No document content available."}
            </p>

            {doc.file_url ? (
              <div className="mt-6 flex flex-wrap gap-3">
                <a
                  href={fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-cyan-500 px-4 py-3 text-sm font-semibold text-black transition hover:bg-cyan-400"
                >
                  <ExternalLink className="h-4 w-4" />
                  View Document
                </a>

                <a
                  href={fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  download
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/[0.06]"
                >
                  <Download className="h-4 w-4" />
                  Download
                </a>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LegalDocumentsPage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [documents, setDocuments] = useState([]);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [selectedDoc, setSelectedDoc] = useState(null);

  async function loadDocuments(initial = false) {
    try {
      setError("");

      if (initial) setLoading(true);
      else setRefreshing(true);

      const res = await userApi.getLegalDocuments();
      setDocuments(Array.isArray(res?.data?.data) ? res.data.data : []);
    } catch (err) {
      setError(getApiErrorMessage(err) || "Failed to load legal documents");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadDocuments(true);
  }, []);

  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === "Escape") {
        setSelectedDoc(null);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const filteredDocuments = useMemo(() => {
    const keyword = String(search || "").trim().toLowerCase();

    if (!keyword) return documents;

    return documents.filter((doc) => {
      const title = String(doc.title || "").toLowerCase();
      const content = String(doc.content || "").toLowerCase();
      return title.includes(keyword) || content.includes(keyword);
    });
  }, [documents, search]);

  if (loading) {
    return (
      <div className="space-y-6 bg-[#050812] p-4 sm:p-6">
        <section className="rounded-[30px] border border-white/10 bg-[#0a0e1a] p-6 text-slate-300 shadow-[0_18px_60px_rgba(0,0,0,0.35)]">
          Loading legal documents...
        </section>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6 bg-[#050812] px-4 pb-28 pt-4 sm:px-6 xl:pb-8">
        <HeaderCard onRefresh={() => loadDocuments(false)} refreshing={refreshing} />

        {error ? (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        ) : null}

        <SearchCard
          search={search}
          setSearch={setSearch}
          count={filteredDocuments.length}
        />

        {filteredDocuments.length ? (
          <section className="grid gap-4 md:grid-cols-2">
            {filteredDocuments.map((doc) => (
              <DocumentCard
                key={doc.id || `${doc.title}-${doc.created_at}`}
                doc={doc}
                onOpen={setSelectedDoc}
              />
            ))}
          </section>
        ) : (
          <section className="rounded-[30px] border border-white/10 bg-[#0a0e1a] px-4 py-12 text-center text-sm text-slate-400 shadow-[0_18px_60px_rgba(0,0,0,0.35)]">
            No documents found.
          </section>
        )}
      </div>

      <DocumentModal doc={selectedDoc} onClose={() => setSelectedDoc(null)} />
    </>
  );
}