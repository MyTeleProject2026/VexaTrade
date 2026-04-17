import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Headphones,
  Gift,
  FileText,
  ArrowRightLeft,
  ChevronRight,
  RefreshCw,
  UserRound,
  X,
  Save,
  Camera,
  CirclePlus,
  CircleMinus,
  Download,
  Upload,
} from "lucide-react";
import { userApi, getApiErrorMessage } from "../services/api";
import { getFullImageUrl } from "../utils/image";

function getKycText(status) {
  return String(status || "not_submitted").replaceAll("_", " ");
}

function getKycClass(status) {
  const value = String(status || "").toLowerCase();

  if (value === "approved") {
    return "border border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
  }
  if (value === "pending") {
    return "border border-amber-500/30 bg-amber-500/10 text-amber-300";
  }
  if (value === "rejected") {
    return "border border-red-500/30 bg-red-500/10 text-red-300";
  }

  return "border border-white/10 bg-white/[0.04] text-slate-300";
}

function QuickIcon({ icon: Icon, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center justify-center gap-2 rounded-2xl p-2 text-center transition hover:bg-white/[0.03]"
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-white">
        <Icon size={20} />
      </div>
      <span className="text-sm text-white">{label}</span>
    </button>
  );
}

function SectionCard({ title, right, children }) {
  return (
    <section className="rounded-[30px] border border-white/10 bg-[#0a0e1a] p-5 shadow-2xl">
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">{title}</h2>
        {right}
      </div>
      {children}
    </section>
  );
}

export default function ProfilePage() {
  const navigate = useNavigate();
  const location = useLocation();

  const token =
    localStorage.getItem("userToken") ||
    localStorage.getItem("token") ||
    localStorage.getItem("accessToken") ||
    "";

  const [profile, setProfile] = useState({
    name: "",
    email: "",
    uid: "",
    status: "active",
    kyc_status: "not_submitted",
    country: "Not set",
    avatar_url: "",
    trading_fee_tier: "Regular user",
  });

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [editForm, setEditForm] = useState({
    name: "",
    avatarFile: null,
    avatarPreview: "",
  });

  async function fetchProfile(silent = false) {
    try {
      if (silent) setRefreshing(true);
      else setLoading(true);

      setError("");

      const res = await userApi.getProfile(token);
      const user =
        res?.data?.data ||
        res?.data?.user ||
        res?.data ||
        {};

      const nextProfile = {
        name: user.name || "",
        email: user.email || "",
        uid: user.uid || "",
        status: user.status || "active",
        kyc_status: user.kyc_status || "not_submitted",
        country: user.country || "Not set",
        avatar_url: user.avatar_url || user.profile_image || "",
        trading_fee_tier: user.trading_fee_tier || "Regular user",
      };

      setProfile(nextProfile);
      localStorage.setItem("user", JSON.stringify(nextProfile));
      localStorage.setItem("userData", JSON.stringify(nextProfile));

      setEditForm((prev) => ({
        ...prev,
        name: nextProfile.name,
        avatarPreview: nextProfile.avatar_url,
      }));
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    fetchProfile();
  }, []);

  useEffect(() => {
    return () => {
      if (editForm.avatarPreview?.startsWith("blob:")) {
        URL.revokeObjectURL(editForm.avatarPreview);
      }
    };
  }, [editForm.avatarPreview]);

  function openEditProfile() {
    setMessage("");
    setError("");
    setEditForm({
      name: profile.name || "",
      avatarFile: null,
      avatarPreview: profile.avatar_url || "",
    });
    setIsEditing(true);
  }

  useEffect(() => {
    if (location.state?.openEdit) {
      openEditProfile();
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, location.pathname, navigate, profile.name, profile.avatar_url]);

  function closeEditProfile() {
    if (editForm.avatarPreview?.startsWith("blob:")) {
      URL.revokeObjectURL(editForm.avatarPreview);
    }

    setIsEditing(false);
    setEditForm({
      name: profile.name || "",
      avatarFile: null,
      avatarPreview: profile.avatar_url || "",
    });
  }

  function handleEditProfileChange(e) {
    const { name, value } = e.target;
    setEditForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  function handleAvatarFileChange(e) {
    const file = e.target.files?.[0] || null;
    if (!file) return;

    if (editForm.avatarPreview?.startsWith("blob:")) {
      URL.revokeObjectURL(editForm.avatarPreview);
    }

    const preview = URL.createObjectURL(file);

    setEditForm((prev) => ({
      ...prev,
      avatarFile: file,
      avatarPreview: preview,
    }));
  }

  async function handleSaveProfile() {
    try {
      setProfileSaving(true);
      setMessage("");
      setError("");

      const name = String(editForm.name || "").trim();
      if (!name) {
        setError("Name is required");
        return;
      }

      let avatarUrl = profile.avatar_url;

      if (editForm.avatarFile) {
        const uploadRes = await userApi.uploadProfilePicture(editForm.avatarFile, token);
        avatarUrl = uploadRes?.data?.data?.avatar_url || avatarUrl;
      }

      const updateRes = await userApi.updateProfile({ name }, token);

      const updatedProfile = {
        ...profile,
        ...(updateRes?.data?.data || {}),
        name,
        avatar_url: avatarUrl,
      };

      setProfile(updatedProfile);
      localStorage.setItem("user", JSON.stringify(updatedProfile));
      localStorage.setItem("userData", JSON.stringify(updatedProfile));

      setMessage("Profile updated successfully");
      setIsEditing(false);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setProfileSaving(false);
    }
  }

  const avatarUrl = useMemo(
    () => getFullImageUrl(profile.avatar_url),
    [profile.avatar_url]
  );

  const editAvatarSrc = useMemo(
    () => getFullImageUrl(editForm.avatarPreview),
    [editForm.avatarPreview]
  );

  if (loading) {
    return (
      <div className="space-y-5 bg-[#050812] p-3 sm:p-6">
        <section className="rounded-[30px] border border-white/10 bg-[#0a0e1a] p-5 text-slate-300 shadow-2xl">
          Loading profile...
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-5 bg-[#050812] px-2 pb-24 pt-3 sm:px-6 xl:pb-8">
      <section className="rounded-[30px] border border-white/10 bg-[#0a0e1a] p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <button
            type="button"
            onClick={() => navigate("/profile/user-center")}
            className="flex min-w-0 flex-1 items-center gap-4 text-left"
          >
            <div className="h-20 w-20 overflow-hidden rounded-full border border-white/10 bg-white/[0.03]">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt="avatar"
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-lg text-white">
                  {profile?.email?.[0]?.toUpperCase() || "U"}
                </span>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="truncate text-2xl font-bold text-white">
                {profile.email || profile.name || "User"}
              </div>
              <div className="mt-2 text-lg text-slate-400">Profile and settings</div>

              <div className="mt-4 flex flex-wrap gap-3">
                <span className={`rounded-full px-4 py-2 text-sm ${getKycClass(profile.kyc_status)}`}>
                  {getKycText(profile.kyc_status)}
                </span>

                <span className="rounded-full border border-white/15 px-4 py-2 text-sm text-white">
                  {profile.trading_fee_tier || "Regular user"}
                </span>
              </div>
            </div>

            <ChevronRight className="shrink-0 text-slate-500" />
          </button>

          <button
            type="button"
            onClick={() => fetchProfile(true)}
            className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-white"
          >
            <RefreshCw size={18} className={refreshing ? "animate-spin" : ""} />
          </button>
        </div>
      </section>

      <SectionCard
        title="Shortcuts"
        right={<ChevronRight className="text-slate-500" />}
      >
        <div className="grid grid-cols-4 gap-2 sm:gap-4">
          <QuickIcon icon={Headphones} label="Get help" onClick={() => navigate("/support")} />
          <QuickIcon icon={Gift} label="Referral" onClick={() => navigate("/referral")} />
          <QuickIcon icon={FileText} label="Legal Docs" onClick={() => navigate("/legal-documents")} />
          <QuickIcon icon={ArrowRightLeft} label="Trading" onClick={() => navigate("/trade")} />
        </div>
      </SectionCard>

      <SectionCard title="Manage assets">
        <div className="grid grid-cols-4 gap-2 sm:gap-4">
          <QuickIcon icon={CirclePlus} label="Buy" onClick={() => navigate("/convert")} />
          <QuickIcon icon={CircleMinus} label="Sell" onClick={() => navigate("/convert")} />
          <QuickIcon icon={Download} label="Deposit" onClick={() => navigate("/deposit")} />
          <QuickIcon icon={Upload} label="Withdraw" onClick={() => navigate("/withdraw")} />
          <QuickIcon icon={ArrowRightLeft} label="Trading" onClick={() => navigate("/trade")} />
        </div>
      </SectionCard>

      {error ? (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      ) : null}

      {message ? (
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
          {message}
        </div>
      ) : null}

      {isEditing ? (
        <div className="fixed inset-0 z-50 bg-[#050812]/80 p-4 backdrop-blur-sm">
          <div className="mx-auto mt-10 w-full max-w-md rounded-[28px] border border-white/10 bg-[#0a0e1a] p-5 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-2xl font-bold text-white">Edit profile</h3>
              <button
                type="button"
                onClick={closeEditProfile}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-white"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-5">
              <div className="flex flex-col items-center">
                <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-full bg-white/5 ring-1 ring-white/10">
                  {editAvatarSrc ? (
                    <img
                      src={editAvatarSrc}
                      alt="Avatar preview"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <UserRound size={36} className="text-slate-400" />
                  )}
                </div>

                <label className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm font-medium text-white">
                  <Camera size={16} />
                  Upload avatar
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleAvatarFileChange}
                  />
                </label>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">
                  Profile name
                </label>
                <input
                  type="text"
                  name="name"
                  value={editForm.name}
                  onChange={handleEditProfileChange}
                  className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none focus:border-violet-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={handleSaveProfile}
                  disabled={profileSaving}
                  className="flex items-center justify-center gap-2 rounded-2xl bg-cyan-500 px-4 py-3 font-semibold text-black transition hover:bg-cyan-400 disabled:opacity-60"
                >
                  <Save size={16} />
                  {profileSaving ? "Saving..." : "Save profile"}
                </button>

                <button
                  type="button"
                  onClick={closeEditProfile}
                  className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 font-semibold text-white"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}