import { useEffect, useMemo, useState } from "react";
import { adminApi, getApiErrorMessage } from "../../services/api";
import {
  FileText,
  RefreshCw,
  Plus,
  Save,
  Trash2,
  AlertCircle,
  CheckCircle2,
  ShieldCheck,
  Eye,
  EyeOff,
  FileUp,
  XCircle,
  ExternalLink,
} from "lucide-react";

function getStatusClasses(status) {
  const value = String(status || "").toLowerCase();

  if (value === "active") {
    return "border border-emerald-500/20 bg-emerald-500/10 text-emerald-300";
  }

  return "border border-slate-500/20 bg-slate-500/10 text-slate-300";
}

function createEmptyForm() {
  return {
    title: "",
    content: "",
    status: "active",
    file: null,
  };
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
    import.meta.env.VITE_API_BASE_URL || "https://cryptopulse-4rhe.onrender.com";

  return `${base}${fileUrl}`;
}

function StatCard({ title, value, tone = "text-white" }) {
  return (
    <div className="rounded-[24px] border border-white/10 bg-slate-900/70 p-4 shadow-xl">
      <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
        {title}
      </div>
      <div className={`mt-3 text-2xl font-semibold sm:text-3xl ${tone}`}>
        {value}
      </div>
    </div>
  );
}

export default function AdminLegalDocumentsPage() {
  const token =
    localStorage.getItem("adminToken") ||
    localStorage.getItem("admin_token") ||
    "";

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingId, setSavingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [creating, setCreating] = useState(false);

  const [docs, setDocs] = useState([]);
  const [formMap, setFormMap] = useState({});
  const [newDoc, setNewDoc] = useState(createEmptyForm());

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    load({ initial: true });
  }, []);

  const summary = useMemo(() => {
    const total = docs.length;
    const active = docs.filter(
      (doc) => String(doc.status || "").toLowerCase() === "active"
    ).length;
    const inactive = docs.filter(
      (doc) => String(doc.status || "").toLowerCase() === "inactive"
    ).length;

    return { total, active, inactive };
  }, [docs]);

  async function load(options = {}) {
    const { initial = false } = options;

    try {
      setError("");
      setSuccess("");

      if (initial) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      const res = await adminApi.getLegalDocs(token);
      const rows = Array.isArray(res?.data?.data) ? res.data.data : [];

      setDocs(rows);

      const nextFormMap = {};
      rows.forEach((doc) => {
        nextFormMap[doc.id] = {
          title: doc.title || "",
          content: doc.content || "",
          status: doc.status || "active",
          file: null,
          remove_file: false,
        };
      });
      setFormMap(nextFormMap);
    } catch (err) {
      setError(getApiErrorMessage(err) || "Failed to load legal documents");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  function handleExistingChange(id, field, value) {
    setFormMap((prev) => ({
      ...prev,
      [id]: {
        ...(prev[id] || {}),
        [field]: value,
      },
    }));
  }

  function handleExistingFileChange(id, file) {
    setFormMap((prev) => ({
      ...prev,
      [id]: {
        ...(prev[id] || {}),
        file,
        remove_file: false,
      },
    }));
  }

  function handleNewChange(field, value) {
    setNewDoc((prev) => ({
      ...prev,
      [field]: value,
    }));
  }

  function handleNewFileChange(file) {
    setNewDoc((prev) => ({
      ...prev,
      file,
    }));
  }

  async function createDocument() {
    try {
      setCreating(true);
      setError("");
      setSuccess("");

      const title = String(newDoc.title || "").trim();
      const content = String(newDoc.content || "").trim();
      const status = String(newDoc.status || "active");

      if (!title) {
        setError("Title is required");
        return;
      }

      if (!content) {
        setError("Content is required");
        return;
      }

      const formData = new FormData();
      formData.append("title", title);
      formData.append("content", content);
      formData.append("status", status);

      if (newDoc.file) {
        formData.append("legal_file", newDoc.file);
      }

      await adminApi.createLegalDoc(formData, token);

      setSuccess("Legal document created successfully.");
      setNewDoc(createEmptyForm());
      await load();
    } catch (err) {
      setError(getApiErrorMessage(err) || "Failed to create legal document");
    } finally {
      setCreating(false);
    }
  }

  async function updateDocument(id) {
    try {
      setSavingId(id);
      setError("");
      setSuccess("");

      const current = formMap[id] || {};

      const title = String(current.title || "").trim();
      const content = String(current.content || "").trim();
      const status = String(current.status || "active");

      if (!title) {
        setError("Title is required");
        return;
      }

      if (!content) {
        setError("Content is required");
        return;
      }

      const formData = new FormData();
      formData.append("title", title);
      formData.append("content", content);
      formData.append("status", status);

      if (current.file) {
        formData.append("legal_file", current.file);
      }

      if (current.remove_file) {
        formData.append("remove_file", "true");
      }

      await adminApi.updateLegalDoc(id, formData, token);

      setSuccess(`Legal document #${id} updated successfully.`);
      await load();
    } catch (err) {
      setError(getApiErrorMessage(err) || "Failed to update legal document");
    } finally {
      setSavingId(null);
    }
  }

  async function deleteDocument(id) {
    const confirmed = window.confirm(
      `Are you sure you want to delete legal document #${id}?`
    );
    if (!confirmed) return;

    try {
      setDeletingId(id);
      setError("");
      setSuccess("");

      await adminApi.deleteLegalDoc(id, token);

      setSuccess(`Legal document #${id} deleted successfully.`);
      await load();
    } catch (err) {
      setError(getApiErrorMessage(err) || "Failed to delete legal document");
    } finally {
      setDeletingId(null);
    }
  }

  if (loading) {
    return (
      <div className="rounded-[24px] border border-white/10 bg-slate-900/70 p-5 text-sm text-slate-300">
        Loading legal documents...
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <section className="rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(124,58,237,0.10),transparent_18%),linear-gradient(180deg,#111827_0%,#020617_100%)] p-5 shadow-xl">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.32em] text-violet-300">
              Legal Documents
            </p>
            <h1 className="mt-2 flex items-center gap-2 text-2xl font-bold text-white sm:text-3xl">
              <FileText className="h-6 w-6 text-violet-300" />
              Document Management
            </h1>
            <p className="mt-2 text-sm text-slate-400">
              Create, edit, upload, and manage the legal documents displayed to users.
            </p>
          </div>

          <button
            type="button"
            onClick={() => load()}
            disabled={refreshing}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard title="Total Documents" value={summary.total} />
        <StatCard title="Active" value={summary.active} tone="text-emerald-300" />
        <StatCard title="Inactive" value={summary.inactive} tone="text-slate-300" />
      </section>

      {error && (
        <section className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-red-300 shadow-lg">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-semibold">Something went wrong</p>
              <p className="mt-1 text-sm">{error}</p>
            </div>
          </div>
        </section>
      )}

      {success && (
        <section className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-emerald-300 shadow-lg">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-semibold">Success</p>
              <p className="mt-1 text-sm">{success}</p>
            </div>
          </div>
        </section>
      )}

      <section className="rounded-[24px] border border-white/10 bg-slate-900/70 p-4 shadow-xl sm:p-5">
        <div className="flex items-center gap-2">
          <Plus className="h-4 w-4 text-cyan-300" />
          <h2 className="text-lg font-semibold text-white">Create New Document</h2>
        </div>

        <div className="mt-5 grid gap-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-300">
              Title
            </label>
            <input
              type="text"
              value={newDoc.title}
              onChange={(e) => handleNewChange("title", e.target.value)}
              placeholder="Enter document title"
              className="w-full rounded-xl border border-white/10 bg-slate-800 px-3 py-2.5 text-sm text-white outline-none transition focus:border-cyan-500"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-300">
              Status
            </label>
            <select
              value={newDoc.status}
              onChange={(e) => handleNewChange("status", e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-slate-800 px-3 py-2.5 text-sm text-white outline-none transition focus:border-cyan-500"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-300">
              Content
            </label>
            <textarea
              rows={7}
              value={newDoc.content}
              onChange={(e) => handleNewChange("content", e.target.value)}
              placeholder="Enter legal document content"
              className="w-full rounded-xl border border-white/10 bg-slate-800 px-3 py-2.5 text-sm text-white outline-none transition focus:border-cyan-500"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-300">
              Upload File
            </label>
            <input
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.webp"
              onChange={(e) => handleNewFileChange(e.target.files?.[0] || null)}
              className="w-full rounded-xl border border-white/10 bg-slate-800 px-3 py-2.5 text-sm text-white outline-none transition file:mr-4 file:rounded-lg file:border-0 file:bg-cyan-500 file:px-3 file:py-2 file:font-semibold file:text-slate-950 hover:file:bg-cyan-400"
            />
            {newDoc.file ? (
              <p className="mt-2 text-xs text-slate-400">
                Selected file: {newDoc.file.name}
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={createDocument}
              disabled={creating}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-500 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {creating ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  Create Document
                </>
              )}
            </button>
          </div>
        </div>
      </section>

      {docs.length === 0 ? (
        <section className="rounded-[24px] border border-dashed border-white/10 bg-slate-900/60 p-8 text-center shadow-lg">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5">
            <FileText className="h-6 w-6 text-slate-400" />
          </div>
          <h2 className="mt-4 text-lg font-semibold text-white">
            No legal documents yet
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            Create your first legal document above.
          </p>
        </section>
      ) : (
        <section className="space-y-4">
          {docs.map((doc) => {
            const current = formMap[doc.id] || {
              title: doc.title || "",
              content: doc.content || "",
              status: doc.status || "active",
              file: null,
              remove_file: false,
            };

            const currentFileUrl = buildFileUrl(doc.file_url);

            return (
              <article
                key={doc.id}
                className="rounded-[24px] border border-white/10 bg-slate-900/70 p-4 shadow-xl sm:p-5"
              >
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0 flex-1 space-y-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-white/5">
                        <ShieldCheck className="h-4 w-4 text-violet-300" />
                      </div>

                      <span
                        className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${getStatusClasses(
                          current.status
                        )}`}
                      >
                        {current.status === "active" ? (
                          <span className="inline-flex items-center gap-1">
                            <Eye className="h-3.5 w-3.5" />
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1">
                            <EyeOff className="h-3.5 w-3.5" />
                            Inactive
                          </span>
                        )}
                      </span>

                      <span className="text-[11px] text-slate-500">ID: {doc.id}</span>
                    </div>

                    <div className="grid gap-4">
                      <div>
                        <label className="mb-2 block text-sm font-medium text-slate-300">
                          Title
                        </label>
                        <input
                          type="text"
                          value={current.title}
                          onChange={(e) =>
                            handleExistingChange(doc.id, "title", e.target.value)
                          }
                          className="w-full rounded-xl border border-white/10 bg-slate-800 px-3 py-2.5 text-sm text-white outline-none transition focus:border-cyan-500"
                        />
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-medium text-slate-300">
                          Status
                        </label>
                        <select
                          value={current.status}
                          onChange={(e) =>
                            handleExistingChange(doc.id, "status", e.target.value)
                          }
                          className="w-full rounded-xl border border-white/10 bg-slate-800 px-3 py-2.5 text-sm text-white outline-none transition focus:border-cyan-500"
                        >
                          <option value="active">Active</option>
                          <option value="inactive">Inactive</option>
                        </select>
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-medium text-slate-300">
                          Content
                        </label>
                        <textarea
                          rows={8}
                          value={current.content}
                          onChange={(e) =>
                            handleExistingChange(doc.id, "content", e.target.value)
                          }
                          className="w-full rounded-xl border border-white/10 bg-slate-800 px-3 py-2.5 text-sm text-white outline-none transition focus:border-cyan-500"
                        />
                      </div>

                      <div className="rounded-xl border border-white/10 bg-slate-800/70 p-4">
                        <label className="mb-2 block text-sm font-medium text-slate-300">
                          Upload / Replace File
                        </label>
                        <input
                          type="file"
                          accept=".pdf,.png,.jpg,.jpeg,.webp"
                          onChange={(e) =>
                            handleExistingFileChange(doc.id, e.target.files?.[0] || null)
                          }
                          className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2.5 text-sm text-white outline-none transition file:mr-4 file:rounded-lg file:border-0 file:bg-cyan-500 file:px-3 file:py-2 file:font-semibold file:text-slate-950 hover:file:bg-cyan-400"
                        />

                        {current.file ? (
                          <div className="mt-3 flex items-center gap-2 text-sm text-cyan-300">
                            <FileUp className="h-4 w-4" />
                            <span>New file selected: {current.file.name}</span>
                          </div>
                        ) : null}

                        {doc.file_url ? (
                          <div className="mt-4 space-y-3">
                            <div className="flex flex-wrap items-center gap-3">
                              <a
                                href={currentFileUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-white transition hover:bg-white/10"
                              >
                                <ExternalLink className="h-4 w-4" />
                                View Current File
                              </a>

                              <button
                                type="button"
                                onClick={() =>
                                  handleExistingChange(
                                    doc.id,
                                    "remove_file",
                                    !current.remove_file
                                  )
                                }
                                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition ${
                                  current.remove_file
                                    ? "bg-red-500 text-white hover:bg-red-400"
                                    : "border border-white/10 bg-white/5 text-white hover:bg-white/10"
                                }`}
                              >
                                <XCircle className="h-4 w-4" />
                                {current.remove_file ? "File will be removed" : "Remove Current File"}
                              </button>
                            </div>

                            <div className="text-xs text-slate-400">
                              Current file: {doc.file_name || "Uploaded file"}
                            </div>
                          </div>
                        ) : (
                          <div className="mt-3 text-xs text-slate-500">
                            No file uploaded for this document.
                          </div>
                        )}
                      </div>

                      <div className="grid gap-2 text-xs text-slate-500 sm:grid-cols-2">
                        <div>Created: {formatDate(doc.created_at)}</div>
                        <div>Updated: {formatDate(doc.updated_at)}</div>
                      </div>
                    </div>
                  </div>

                  <div className="flex w-full shrink-0 flex-col gap-3 sm:flex-row xl:w-auto xl:flex-col">
                    <button
                      type="button"
                      onClick={() => updateDocument(doc.id)}
                      disabled={savingId === doc.id}
                      className="inline-flex min-w-[140px] items-center justify-center gap-2 rounded-xl bg-cyan-500 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {savingId === doc.id ? (
                        <>
                          <RefreshCw className="h-4 w-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4" />
                          Save Changes
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => deleteDocument(doc.id)}
                      disabled={deletingId === doc.id}
                      className="inline-flex min-w-[140px] items-center justify-center gap-2 rounded-xl bg-red-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-red-400 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {deletingId === doc.id ? (
                        <>
                          <RefreshCw className="h-4 w-4 animate-spin" />
                          Deleting...
                        </>
                      ) : (
                        <>
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      )}
    </div>
  );
}