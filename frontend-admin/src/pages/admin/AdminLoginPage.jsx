import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ShieldCheck, LockKeyhole, Mail, RefreshCw } from "lucide-react";
import { adminApi } from "../../services/api";
// ✅ ADDED: Import toast notification hook
import useToast from "../../components/ToastNotification";

export default function AdminLoginPage() {
  const navigate = useNavigate();

  // ✅ ADDED: Toast notification hook
  const { toasts, addToast, removeToast, ToastContainer } = useToast();

  const [form, setForm] = useState({
    email: "",
    password: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!form.email.trim() || !form.password.trim()) {
      const errorMsg = "Email and password are required";
      setError(errorMsg);
      // ✅ ADDED: Error toast
      addToast(errorMsg, "error");
      return;
    }

    try {
      setLoading(true);

      const res = await adminApi.login({
        email: form.email.trim(),
        password: form.password,
      });

      const data = res?.data || {};
      const token =
        data.token ||
        data.accessToken ||
        data.access_token ||
        data.data?.token ||
        data.data?.accessToken ||
        "";

      const admin =
        data.admin ||
        data.data?.admin ||
        data.data ||
        null;

      if (!token) {
        const errorMsg = data.message || "Admin token not found in response";
        throw new Error(errorMsg);
      }

      localStorage.setItem("adminToken", token);
      localStorage.setItem("token", token);
      localStorage.setItem("admin_token", token);

      if (admin) {
        localStorage.setItem("adminData", JSON.stringify(admin));
        localStorage.setItem("adminUser", JSON.stringify(admin));
      }

      // ✅ ADDED: Success toast
      addToast(`Welcome back, ${admin?.email || form.email.trim()}!`, "success");

      navigate("/admin/dashboard");
    } catch (err) {
      console.error("Admin login failed:", err);

      const errorMsg =
        err?.response?.data?.message ||
        err?.message ||
        "Admin login failed";
      setError(errorMsg);
      // ✅ ADDED: Error toast
      addToast(errorMsg, "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#050812] px-4 py-8 text-white">
      {/* ✅ ADDED: Toast Container */}
      <ToastContainer />

      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-5xl items-center justify-center">
        <div className="grid w-full overflow-hidden rounded-[28px] border border-white/10 bg-[#0a0e1a] shadow-[0_20px_80px_rgba(0,0,0,0.45)] backdrop-blur xl:grid-cols-[1.05fr_0.95fr]">
          <section className="hidden border-r border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.08),transparent_18%),linear-gradient(180deg,#0a0e1a_0%,#050812_100%)] p-8 xl:flex xl:flex-col xl:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.28em] text-cyan-300">
                <ShieldCheck size={13} />
                VexaTrade Admin
              </div>

              <h1 className="mt-5 text-3xl font-bold leading-tight text-white">
                Control the platform with precision
              </h1>

              <p className="mt-3 max-w-md text-sm leading-6 text-slate-400">
                Access users, KYC, deposits, withdrawals, loans, news, and
                platform settings from one secure dashboard.
              </p>
            </div>

            <div className="grid gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="text-[11px] uppercase tracking-wide text-slate-500">
                  Security
                </div>
                <div className="mt-1 text-sm text-slate-200">
                  Protected admin authentication
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="text-[11px] uppercase tracking-wide text-slate-500">
                  Operations
                </div>
                <div className="mt-1 text-sm text-slate-200">
                  User control, trading, finance, and legal tools
                </div>
              </div>
            </div>
          </section>

          <section className="p-5 sm:p-7 xl:p-8">
            <div className="mx-auto w-full max-w-md">
              <div className="mb-7 xl:hidden">
                <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.28em] text-cyan-300">
                  <ShieldCheck size={13} />
                  VexaTrade Admin
                </div>
              </div>

              <div className="mb-7">
                <h2 className="text-2xl font-semibold text-white sm:text-[28px]">
                  Admin Login
                </h2>
                <p className="mt-2 text-sm text-slate-400">
                  Access the admin control panel.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="mb-2 flex items-center gap-2 text-sm text-slate-300">
                    <Mail size={14} className="text-cyan-300" />
                    Email
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={form.email}
                    onChange={handleChange}
                    placeholder="admin@gmail.com"
                    autoComplete="email"
                    className="w-full rounded-xl border border-white/10 bg-[#0a0e1a] px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-500 focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="mb-2 flex items-center gap-2 text-sm text-slate-300">
                    <LockKeyhole size={14} className="text-cyan-300" />
                    Password
                  </label>
                  <input
                    type="password"
                    name="password"
                    value={form.password}
                    onChange={handleChange}
                    placeholder="Enter password"
                    autoComplete="current-password"
                    className="w-full rounded-xl border border-white/10 bg-[#0a0e1a] px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-500 focus:border-cyan-500"
                  />
                </div>

                {error ? (
                  <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                    {error}
                  </div>
                ) : null}

                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-500 px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? (
                    <>
                      <RefreshCw size={15} className="animate-spin" />
                      Logging in...
                    </>
                  ) : (
                    <>
                      <ShieldCheck size={15} />
                      Admin Login
                    </>
                  )}
                </button>
              </form>

              <div className="mt-5 text-sm text-slate-400">
                <Link to="/login" className="font-medium text-white transition hover:text-cyan-300">
                  Back to user login
                </Link>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
