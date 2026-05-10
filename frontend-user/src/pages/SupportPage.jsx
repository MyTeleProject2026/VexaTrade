import { useEffect, useState } from "react";
import {
  Headset,
  MessageSquareText,
  Link as LinkIcon,
  RefreshCw,
  Info,
} from "lucide-react";
import { userApi, getApiErrorMessage } from "../services/api";

function SupportCard({ icon: Icon, title, value, tone = "text-white", link = "" }) {
  const content = (
    <div className="rounded-[24px] border border-white/10 bg-[#0a0e1a] p-4 shadow-xl">
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 ${tone}`}>
          <Icon size={20} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-xs uppercase tracking-[0.18em] text-slate-500">{title}</div>
          <div className="mt-2 break-words text-sm text-white">{value || "-"}</div>
        </div>
      </div>
    </div>
  );

  if (link) {
    return (
      <a href={link} target="_blank" rel="noreferrer" className="block">
        {content}
      </a>
    );
  }

  return content;
}

export default function SupportPage() {
  const token =
    localStorage.getItem("userToken") ||
    localStorage.getItem("token") ||
    localStorage.getItem("accessToken") ||
    "";

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [support, setSupport] = useState({
    channel: "Customer Service",
    contact: "Not configured",
    link: "",
    note: "",
  });

  async function loadSupport(silent = false) {
    try {
      if (silent) setRefreshing(true);
      else setLoading(true);

      setError("");

      const res = await userApi.getSupport(token);
      const data = res?.data?.data || {};

      setSupport({
        channel: data.channel || "Customer Service",
        contact: data.contact || "Not configured",
        link: data.link || "",
        note: data.note || "",
      });
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadSupport();
  }, []);

  if (loading) {
    return (
      <div className="space-y-5 bg-[#050812] px-3 pb-24 pt-3 sm:px-6">
        <section className="rounded-[28px] border border-white/10 bg-[#0a0e1a] p-5 text-slate-300">
          Loading support page...
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-5 bg-[#050812] px-3 pb-24 pt-3 sm:px-6">
      <section className="rounded-[28px] border border-white/10 bg-[#0a0e1a] p-5 shadow-2xl">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-[11px] uppercase tracking-[0.32em] text-violet-300">
              Customer Support
            </div>
            <h1 className="mt-2 text-3xl font-bold text-white">Get Help</h1>
            <p className="mt-2 text-sm text-slate-400">
              Need help? Contact support through our Customer Service channels to resolve your Vexa Trade account issues.
            </p>
          </div>

          <button
            type="button"
            onClick={() => loadSupport(true)}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-white"
          >
            <RefreshCw size={18} className={refreshing ? "animate-spin" : ""} />
          </button>
        </div>
      </section>

      {error ? (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4">
        <SupportCard
          icon={Headset}
          title="Support Channel"
          value={support.channel}
          tone="text-violet-300"
        />

        <SupportCard
          icon={MessageSquareText}
          title="Contact"
          value={support.contact}
          tone="text-cyan-300"
        />

        <SupportCard
          icon={LinkIcon}
          title="Support Link"
          value={support.link || "No link configured"}
          tone="text-emerald-300"
          link={support.link}
        />

        <SupportCard
          icon={Info}
          title="Support Note"
          value={support.note || "No support note configured"}
          tone="text-amber-300"
        />
      </div>
    </div>
  );
}
