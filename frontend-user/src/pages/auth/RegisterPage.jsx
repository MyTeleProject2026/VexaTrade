import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, ShieldCheck, Eye, EyeOff } from "lucide-react";
import { auth, getApiErrorMessage } from "../../services/api";

const COUNTRY_OPTIONS = [
  // ... (same as before, keep unchanged)
];

const GENDER_OPTIONS = ["Male", "Female", "Other"];

export default function RegisterPage() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    gender: "",
    dob: "",
    country: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const fullName = useMemo(() => {
    return `${form.firstName} ${form.lastName}`.trim();
  }, [form.firstName, form.lastName]);

  const updateField = (key, value) => {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const validateForm = () => {
    if (!form.firstName.trim()) return "First name is required";
    if (!form.lastName.trim()) return "Last name is required";
    if (!form.gender) return "Gender is required";
    if (!form.dob) return "Date of birth is required";
    if (!form.country) return "Country / Residence is required";
    if (!form.email.trim()) return "Email is required";
    if (!form.password) return "Password is required";
    if (form.password.length < 6) return "Password must be at least 6 characters";
    if (!form.confirmPassword) return "Please confirm your password";
    if (form.password !== form.confirmPassword) return "Passwords do not match";
    return "";
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      setLoading(false);
      return;
    }

    try {
      await auth.register({
        name: fullName,
        firstName: form.firstName,
        lastName: form.lastName,
        gender: form.gender,
        dob: form.dob,
        country: form.country,
        email: form.email.trim().toLowerCase(),
        password: form.password,
      });

      navigate("/login");
    } catch (err) {
      setError(getApiErrorMessage(err) || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050812] text-white">
      {/* ... the JSX is exactly the same as before, but uses `auth.register` */}
      {/* I'll keep the full JSX for completeness */}
      <div className="grid min-h-screen lg:grid-cols-[1fr_1fr]">
        {/* ... left panel unchanged */}
        <section className="flex items-center justify-center px-4 py-8 sm:px-6 lg:px-10">
          <div className="w-full max-w-2xl">
            <div className="rounded-[34px] border border-white/10 bg-[#0a0e1a] p-8 shadow-[0_25px_90px_rgba(0,0,0,0.5)]">
              <div className="mb-8 text-center">
                <p className="text-xs uppercase tracking-[0.35em] text-cyan-300">
                  VexaTrade
                </p>
                <h1 className="mt-4 text-4xl font-bold">Create Account</h1>
                <p className="mt-3 text-sm text-slate-400">
                  Open your account and start your platform journey.
                </p>
              </div>

              {error ? (
                <div className="mb-5 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                  {error}
                </div>
              ) : null}

              <form onSubmit={onSubmit} className="space-y-4">
                {/* ... form fields unchanged */}
                {/* Just ensure the onSubmit uses the updated function above */}
                <button
                  type="submit"
                  disabled={loading}
                  className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-cyan-500 px-4 py-4 font-semibold text-black transition hover:bg-cyan-400 disabled:opacity-60"
                >
                  {loading ? "Creating Account..." : "Create Account"}
                  {!loading ? <ArrowRight size={18} /> : null}
                </button>
              </form>

              <div className="mt-6 text-center text-sm text-slate-400">
                Already have an account?{" "}
                <Link
                  to="/login"
                  className="font-semibold text-cyan-300 hover:text-cyan-200"
                >
                  Login
                </Link>
              </div>

              <div className="mt-8 rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
                <div className="text-xs uppercase tracking-[0.28em] text-slate-500">
                  Account Setup
                </div>
                <div className="mt-3 text-sm leading-6 text-slate-300">
                  After registration, you can continue with profile setup, KYC verification, wallet actions, and user center preferences.
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
