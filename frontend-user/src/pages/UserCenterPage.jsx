import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Mail,
  Shield,
  Smartphone,
  KeyRound,
  CheckCircle,
  XCircle,
  RefreshCw,
  Eye,
  EyeOff,
  Lock,
  AlertCircle,
  User,
  Settings,
  Globe,
  Moon,
  Bell,
  DollarSign,
  Languages,
  Sun,
  Monitor,
  Volume2,
  Vibrate,
  Camera,
  X,
  Save,
  Upload,
  Crop,
  Image as ImageIcon,
  Users
} from "lucide-react";
import { userApi, getApiErrorMessage } from "../services/api";
import { getFullImageUrl } from "../utils/image";
import { useNotification } from "../hooks/useNotification";
import ImageCropper from "../components/ImageCropper";  // Import from separate file

function getToken() {
  return localStorage.getItem("userToken") || 
         localStorage.getItem("token") || 
         localStorage.getItem("accessToken") || 
         "";
}

function StatusBadge({ verified, label }) {
  return (
    <div className={`flex items-center gap-2 rounded-full px-3 py-1 text-sm ${
      verified 
        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" 
        : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
    }`}>
      {verified ? <CheckCircle size={14} /> : <XCircle size={14} />}
      <span>{label}</span>
    </div>
  );
}

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

export default function UserCenterPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const token = getToken();
  const { showSuccess, showError, showVoucher } = useNotification();

  // Tab state
  const [activeTab, setActiveTab] = useState("profile");

  // Loading states
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // User profile data
  const [profile, setProfile] = useState({
    name: "",
    email: "",
    uid: "",
    status: "active",
    kyc_status: "not_submitted",
    country: "Not set",
    avatar_url: "",
    trading_fee_tier: "Regular user",
    email_verified: false,
    balance: 0,
  });

  // Edit profile states
  const [isEditing, setIsEditing] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "",
    avatarFile: null,
    avatarPreview: "",
  });
  const [showCropper, setShowCropper] = useState(false);
  const [tempAvatarFile, setTempAvatarFile] = useState(null);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  
  // Security states
  const [securityStatus, setSecurityStatus] = useState({
    hasPasscode: false,
    twofaEnabled: false,
  });
  
  // Passcode states
  const [passcodeModalOpen, setPasscodeModalOpen] = useState(false);
  const [passcode, setPasscode] = useState("");
  const [confirmPasscode, setConfirmPasscode] = useState("");
  const [showPasscode, setShowPasscode] = useState(false);
  const [passcodeError, setPasscodeError] = useState("");
  const [savingPasscode, setSavingPasscode] = useState(false);
  
  // Email verification states
  const [verifyModalOpen, setVerifyModalOpen] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");
  const [sendingCode, setSendingCode] = useState(false);
  const [verifyingCode, setVerifyingCode] = useState(false);
  const [verificationError, setVerificationError] = useState("");
  const [verificationSuccess, setVerificationSuccess] = useState("");
  const [countdown, setCountdown] = useState(0);
  
  // Verify passcode modal
  const [verifyPasscodeModalOpen, setVerifyPasscodeModalOpen] = useState(false);
  const [verifyPasscode, setVerifyPasscode] = useState("");
  const [verifyPasscodeError, setVerifyPasscodeError] = useState("");
  const [verifyingPasscode, setVerifyingPasscode] = useState(false);

  // Preferences states
  const [preferences, setPreferences] = useState({
    language: "English",
    currency: "USD",
    appearance: "system",
    notifications: true,
    hapticFeedback: true,
    soundEffects: true,
    chartTimezone: "UTC",
  });

  // Joint Account states
  const [jointModalOpen, setJointModalOpen] = useState(false);
  const [jointAccountStatus, setJointAccountStatus] = useState(null);
  const [jointPartner, setJointPartner] = useState(null);
  const [combinedBalanceData, setCombinedBalanceData] = useState(null);
  const [jointForm, setJointForm] = useState({
    partnerEmail: "",
    partnerKycNumber: "",
  });
  const [submittingJoint, setSubmittingJoint] = useState(false);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  // Load all data
  useEffect(() => {
    loadAllData();
  }, []);

  // Load joint account status
  useEffect(() => {
    if (token) {
      loadJointAccountStatus();
      loadCombinedBalance();
    }
  }, [token, profile.uid]);

  // Countdown timer
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  // Cleanup avatar preview
  useEffect(() => {
    return () => {
      if (editForm.avatarPreview?.startsWith("blob:")) {
        URL.revokeObjectURL(editForm.avatarPreview);
      }
    };
  }, [editForm.avatarPreview]);

  async function loadAllData() {
    try {
      setLoading(true);
      setError("");
      
      const profileRes = await userApi.getProfile(token);
      if (profileRes?.data?.success) {
        const userData = profileRes.data.data;
        setProfile({
          name: userData.name || "",
          email: userData.email || "",
          uid: userData.uid || "",
          status: userData.status || "active",
          kyc_status: userData.kyc_status || "not_submitted",
          country: userData.country || "Not set",
          avatar_url: userData.avatar_url || "",
          trading_fee_tier: userData.trading_fee_tier || "Regular user",
          email_verified: userData.email_verified === 1,
          balance: Number(userData.balance || 0),
        });
      }
      
      const securityRes = await userApi.securityStatus(token);
      if (securityRes?.data?.success) {
        setSecurityStatus({
          hasPasscode: securityRes.data.data?.hasPasscode || false,
          twofaEnabled: securityRes.data.data?.twofaEnabled || false,
        });
      }
      
      const savedPrefs = localStorage.getItem("user_preferences");
      if (savedPrefs) {
        try {
          setPreferences(JSON.parse(savedPrefs));
        } catch (e) {}
      }
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function loadJointAccountStatus() {
    try {
      const res = await userApi.getJointAccountStatus(token);
      if (res?.data?.success) {
        const data = res.data.data;
        setJointAccountStatus(data);
        
        if (data.hasJointAccount && data.jointAccount) {
          const currentUid = profile.uid;
          const jointAccount = data.jointAccount;
          
          let partnerUid = null;
          if (jointAccount.user1_uid === currentUid) {
            partnerUid = jointAccount.user2_uid;
          } else if (jointAccount.user2_uid === currentUid) {
            partnerUid = jointAccount.user1_uid;
          }
          
          if (partnerUid) {
            try {
              const partnerRes = await fetch(`${import.meta.env.VITE_API_BASE_URL || "https://cryptopulse-4rhe.onrender.com"}/api/user/by-uid/${partnerUid}`, {
                headers: { Authorization: `Bearer ${token}` }
              });
              const partnerData = await partnerRes.json();
              if (partnerData.success) {
                setJointPartner(partnerData.data);
              }
            } catch (err) {
              console.error("Failed to load partner info:", err);
            }
          }
        } else {
          setJointPartner(null);
        }
      }
    } catch (err) {
      console.error("Failed to load joint account status:", err);
    }
  }

  async function loadCombinedBalance() {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || "https://cryptopulse-4rhe.onrender.com"}/api/joint-account/combined-balance`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setCombinedBalanceData(data.data);
      }
    } catch (err) {
      console.error("Failed to load combined balance:", err);
    }
  }

  async function forceRefreshUserData() {
    try {
      setRefreshing(true);
      localStorage.removeItem("user");
      localStorage.removeItem("userData");
      await loadAllData();
      await loadJointAccountStatus();
      await loadCombinedBalance();
      showSuccess("User data refreshed successfully!");
    } catch (err) {
      showError(getApiErrorMessage(err));
    } finally {
      setRefreshing(false);
    }
  }

  // Profile functions
  function openEditProfile() {
    setEditForm({
      name: profile.name,
      avatarFile: null,
      avatarPreview: profile.avatar_url,
    });
    setIsEditing(true);
    setError("");
    setMessage("");
  }

  function closeEditProfile() {
    if (editForm.avatarPreview?.startsWith("blob:")) {
      URL.revokeObjectURL(editForm.avatarPreview);
    }
    setIsEditing(false);
    setShowCropper(false);
    setTempAvatarFile(null);
  }

  function handleEditProfileChange(e) {
    setEditForm(prev => ({ ...prev, name: e.target.value }));
  }

  function handleAvatarFileSelect(file) {
    if (file) {
      setTempAvatarFile(file);
      setShowCropper(true);
    }
  }

  function handleCropComplete(croppedFile) {
    const previewUrl = URL.createObjectURL(croppedFile);
    setEditForm(prev => ({
      ...prev,
      avatarFile: croppedFile,
      avatarPreview: previewUrl,
    }));
    setShowCropper(false);
    setTempAvatarFile(null);
  }

  function handleCameraCapture(e) {
    const file = e.target.files?.[0];
    if (file) {
      handleAvatarFileSelect(file);
    }
  }

  async function handleSaveProfile() {
    try {
      setProfileSaving(true);
      setError("");
      setMessage("");

      const name = editForm.name.trim();
      if (!name) {
        showError("Name is required");
        return;
      }

      let avatarUrl = profile.avatar_url;
      if (editForm.avatarFile) {
        const uploadRes = await userApi.uploadProfilePicture(editForm.avatarFile, token);
        avatarUrl = uploadRes?.data?.data?.avatar_url || avatarUrl;
      }

      await userApi.updateProfile({ name }, token);
      
      setProfile(prev => ({ ...prev, name, avatar_url: avatarUrl }));
      showSuccess("Profile updated successfully!");
      setIsEditing(false);
      
      const updatedUser = { ...profile, name, avatar_url: avatarUrl };
      localStorage.setItem("user", JSON.stringify(updatedUser));
      localStorage.setItem("userData", JSON.stringify(updatedUser));
    } catch (err) {
      showError(getApiErrorMessage(err));
    } finally {
      setProfileSaving(false);
    }
  }

  // Security functions
  async function handleSetPasscode() {
    if (!passcode || passcode.length < 4) {
      setPasscodeError("Passcode must be at least 4 digits");
      return;
    }
    if (passcode !== confirmPasscode) {
      setPasscodeError("Passcodes do not match");
      return;
    }
    
    try {
      setSavingPasscode(true);
      await userApi.setPasscode({ passcode }, token);
      setSecurityStatus(prev => ({ ...prev, hasPasscode: true }));
      setPasscodeModalOpen(false);
      setPasscode("");
      setConfirmPasscode("");
      showSuccess("Passcode set successfully!");
    } catch (err) {
      setPasscodeError(getApiErrorMessage(err));
    } finally {
      setSavingPasscode(false);
    }
  }

  async function handleSendVerificationCode() {
    if (countdown > 0) {
      showError(`Please wait ${countdown} seconds`);
      return;
    }
    
    try {
      setSendingCode(true);
      const response = await userApi.sendEmailVerificationCode(token);
      if (response?.data?.success) {
        if (response.data.code) {
          showSuccess(`Your verification code is: ${response.data.code}`);
        } else {
          showSuccess("Verification code sent!");
        }
        setCountdown(60);
      } else {
        showError(response?.data?.message || "Failed to send code");
      }
    } catch (err) {
      showError(getApiErrorMessage(err));
    } finally {
      setSendingCode(false);
    }
  }

  async function handleVerifyCode() {
    if (!verificationCode || verificationCode.length !== 6) {
      showError("Enter valid 6-digit code");
      return;
    }
    
    try {
      setVerifyingCode(true);
      const response = await userApi.verifyEmailCode({ code: verificationCode }, token);
      if (response?.data?.success) {
        showSuccess("Email verified!");
        setProfile(prev => ({ ...prev, email_verified: true }));
        setTimeout(() => {
          setVerifyModalOpen(false);
          setVerificationCode("");
          forceRefreshUserData();
        }, 2000);
      } else {
        showError(response?.data?.message || "Invalid code");
      }
    } catch (err) {
      showError(getApiErrorMessage(err));
    } finally {
      setVerifyingCode(false);
    }
  }

  async function handleVerifyPasscode() {
    if (!verifyPasscode) {
      setVerifyPasscodeError("Enter your passcode");
      return;
    }
    
    try {
      setVerifyingPasscode(true);
      const response = await userApi.verifyPasscode({ passcode: verifyPasscode }, token);
      if (response?.data?.success) {
        setVerifyPasscodeModalOpen(false);
        setVerifyPasscode("");
        showSuccess("Passcode verified!");
      } else {
        setVerifyPasscodeError(response?.data?.message || "Invalid passcode");
      }
    } catch (err) {
      setVerifyPasscodeError(getApiErrorMessage(err));
    } finally {
      setVerifyingPasscode(false);
    }
  }

  // Joint Account functions
  async function handleRequestJointAccount() {
    if (!jointForm.partnerEmail.trim()) {
      showError("Partner email is required");
      return;
    }
    
    try {
      setSubmittingJoint(true);
      setError("");
      
      const res = await userApi.requestJointAccount({
        partnerEmail: jointForm.partnerEmail.trim(),
        partnerKycNumber: jointForm.partnerKycNumber.trim(),
      }, token);
      
      if (res?.data?.success) {
        showSuccess(res.data.message);
        
        showVoucher({
          title: "Joint Account Requested",
          type: "joint_account",
          transactionId: res.data.data?.requestId,
          data: {
            requestId: res.data.data?.requestId,
            partnerEmail: jointForm.partnerEmail.trim(),
            partnerUid: "",
            created_at: new Date().toISOString(),
          },
        });
        
        setJointModalOpen(false);
        setJointForm({ partnerEmail: "", partnerKycNumber: "" });
        await loadJointAccountStatus();
        await loadCombinedBalance();
      } else {
        showError(res?.data?.message || "Failed to send request");
      }
    } catch (err) {
      showError(getApiErrorMessage(err));
    } finally {
      setSubmittingJoint(false);
    }
  }

  // Preferences functions
  function updatePreference(key, value) {
    const newPrefs = { ...preferences, [key]: value };
    setPreferences(newPrefs);
    localStorage.setItem("user_preferences", JSON.stringify(newPrefs));
    showSuccess(`${key} updated successfully`);
  }

  const avatarUrl = useMemo(() => getFullImageUrl(profile.avatar_url), [profile.avatar_url]);
  const editAvatarSrc = useMemo(() => getFullImageUrl(editForm.avatarPreview), [editForm.avatarPreview]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5 px-4 py-5 sm:space-y-6 sm:px-6 sm:py-6">
      {/* Header with Balance */}
      <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/80 to-slate-950/80 p-4 shadow-xl sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-bold text-white sm:text-2xl">User Center</h1>
            <p className="mt-0.5 text-xs text-slate-400 sm:text-sm">Profile, security, and preference settings</p>
          </div>
          
          <button
            onClick={forceRefreshUserData}
            disabled={refreshing}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 px-3 py-2 text-sm font-semibold text-black transition hover:bg-amber-400 disabled:opacity-50 sm:px-4 sm:py-2"
          >
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
            <span className="text-xs sm:text-sm">{refreshing ? "Refreshing..." : "Refresh"}</span>
          </button>
        </div>
        
        {/* Balance Display */}
        <div className="mt-4 rounded-xl border border-white/10 bg-black/30 p-3 sm:p-4">
          <div className="flex items-center gap-2 text-xs text-slate-400 sm:text-sm">
            <Wallet size={14} />
            <span>Wallet Balance</span>
          </div>
          <div className="mt-1 text-2xl font-bold text-white sm:text-3xl">
            {formatMoney(profile.balance)} USDT
          </div>
          
          {/* Combined Balance for Joint Account */}
          {combinedBalanceData?.hasJointAccount && (
            <div className="mt-3 rounded-lg bg-indigo-500/10 p-2 sm:p-3">
              <div className="flex items-center gap-2 text-xs text-indigo-300">
                <Users size={12} />
                <span>Joint Account Combined Balance</span>
              </div>
              <div className="mt-1 text-lg font-bold text-white sm:text-xl">
                {formatMoney(combinedBalanceData.combinedBalance)} USDT
              </div>
              <div className="mt-1 text-[10px] text-slate-400 sm:text-xs">
                You: {formatMoney(combinedBalanceData.userBalance)} USDT + 
                {jointPartner?.name || "Partner"}: {formatMoney(combinedBalanceData.partnerBalance)} USDT
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex rounded-xl border border-white/10 bg-slate-900/50 p-1">
        <button
          onClick={() => setActiveTab("profile")}
          className={`flex flex-1 items-center justify-center gap-1 rounded-lg px-2 py-2 text-xs font-medium transition sm:gap-2 sm:px-4 sm:py-3 sm:text-sm ${
            activeTab === "profile"
              ? "bg-cyan-500 text-black"
              : "text-slate-400 hover:text-white"
          }`}
        >
          <User size={14} className="sm:h-4 sm:w-4" />
          <span>Profile</span>
        </button>
        <button
          onClick={() => setActiveTab("security")}
          className={`flex flex-1 items-center justify-center gap-1 rounded-lg px-2 py-2 text-xs font-medium transition sm:gap-2 sm:px-4 sm:py-3 sm:text-sm ${
            activeTab === "security"
              ? "bg-cyan-500 text-black"
              : "text-slate-400 hover:text-white"
          }`}
        >
          <Shield size={14} className="sm:h-4 sm:w-4" />
          <span>Security</span>
        </button>
        <button
          onClick={() => setActiveTab("preferences")}
          className={`flex flex-1 items-center justify-center gap-1 rounded-lg px-2 py-2 text-xs font-medium transition sm:gap-2 sm:px-4 sm:py-3 sm:text-sm ${
            activeTab === "preferences"
              ? "bg-cyan-500 text-black"
              : "text-slate-400 hover:text-white"
          }`}
        >
          <Settings size={14} className="sm:h-4 sm:w-4" />
          <span>Settings</span>
        </button>
      </div>

      {/* ==================== PROFILE TAB ==================== */}
      {activeTab === "profile" && (
        <div className="space-y-4 sm:space-y-5">
          {/* Profile Header Card */}
          <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-4 sm:p-5">
            <div className="flex flex-col items-center gap-3 text-center sm:flex-row sm:text-left">
              <div className="h-16 w-16 overflow-hidden rounded-full border border-white/10 bg-white/[0.03] sm:h-20 sm:w-20">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="avatar" className="h-full w-full object-cover" />
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-xl text-white sm:text-2xl">
                    {profile.email?.[0]?.toUpperCase() || "U"}
                  </span>
                )}
              </div>
              <div className="flex-1">
                <h2 className="text-base font-bold text-white sm:text-xl">{profile.name || "User"}</h2>
                <p className="text-xs text-slate-400 sm:text-sm">{profile.email}</p>
                <div className="mt-2 flex flex-wrap justify-center gap-1.5 sm:justify-start sm:gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] sm:px-3 sm:py-1 sm:text-xs ${getKycClass(profile.kyc_status)}`}>
                    KYC: {getKycText(profile.kyc_status)}
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] text-slate-300 sm:px-3 sm:py-1 sm:text-xs">
                    {profile.trading_fee_tier || "Regular user"}
                  </span>
                </div>
              </div>
              <button
                onClick={openEditProfile}
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white transition hover:bg-white/10 sm:px-4 sm:py-2 sm:text-sm"
              >
                Edit profile
              </button>
            </div>
          </div>

          {/* Account Information Card */}
          <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-4 sm:p-5">
            <h3 className="mb-3 text-base font-semibold text-white sm:mb-4 sm:text-lg">Account information</h3>
            <div className="space-y-2 text-xs sm:space-y-3 sm:text-sm">
              <div className="flex justify-between border-b border-white/5 pb-2">
                <span className="text-slate-400">UID</span>
                <span className="text-white">{profile.uid || "--"}</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-2">
                <span className="text-slate-400">Email verification</span>
                <StatusBadge verified={profile.email_verified} label={profile.email_verified ? "Verified" : "Not verified"} />
              </div>
              <div className="flex justify-between border-b border-white/5 pb-2">
                <span className="text-slate-400">Identity verification</span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] sm:px-3 sm:py-1 sm:text-xs ${getKycClass(profile.kyc_status)}`}>
                  {getKycText(profile.kyc_status)}
                </span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-2">
                <span className="text-slate-400">Country/Region</span>
                <span className="text-white">{profile.country}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Trading fee tier</span>
                <span className="text-white">{profile.trading_fee_tier}</span>
              </div>
            </div>
          </div>

          {/* Edit Profile Modal */}
          {isEditing && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
              <div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900 p-5">
                <div className="mb-5 flex items-center justify-between">
                  <h3 className="text-lg font-bold text-white sm:text-xl">Edit profile</h3>
                  <button onClick={closeEditProfile} className="text-slate-400 hover:text-white">
                    <X size={20} />
                  </button>
                </div>
                <div className="space-y-5">
                  {/* Avatar Section */}
                  <div className="flex flex-col items-center">
                    <div className="relative h-20 w-20 overflow-hidden rounded-full bg-white/5 ring-1 ring-white/10 sm:h-24 sm:w-24">
                      {editAvatarSrc ? (
                        <img src={editAvatarSrc} alt="Preview" className="h-full w-full object-cover" />
                      ) : (
                        <User size={28} className="m-auto mt-5 text-slate-400 sm:size-36 sm:mt-6" />
                      )}
                    </div>
                    
                    <div className="mt-3 flex gap-2">
                      <label className="cursor-pointer rounded-xl border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-white transition hover:bg-white/10 sm:px-3 sm:py-2 sm:text-sm">
                        <Upload size={12} className="mr-1 inline sm:h-4 sm:w-4" />
                        Gallery
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleAvatarFileSelect(file);
                          }}
                        />
                      </label>
                      
                      <label className="cursor-pointer rounded-xl border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-white transition hover:bg-white/10 sm:px-3 sm:py-2 sm:text-sm">
                        <Camera size={12} className="mr-1 inline sm:h-4 sm:w-4" />
                        Camera
                        <input
                          ref={cameraInputRef}
                          type="file"
                          accept="image/*"
                          capture="environment"
                          className="hidden"
                          onChange={handleCameraCapture}
                        />
                      </label>
                    </div>
                    <p className="mt-2 text-[10px] text-slate-500 sm:text-xs">Click Gallery or Camera to upload</p>
                  </div>

                  {/* Name Input */}
                  <div>
                    <label className="mb-2 block text-sm text-slate-400">Profile name</label>
                    <input
                      type="text"
                      value={editForm.name}
                      onChange={handleEditProfileChange}
                      placeholder="Enter your name"
                      className="w-full rounded-xl border border-white/10 bg-slate-800 px-4 py-3 text-sm text-white outline-none focus:border-cyan-500"
                    />
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-3">
                    <button 
                      onClick={handleSaveProfile} 
                      disabled={profileSaving} 
                      className="flex-1 rounded-xl bg-cyan-500 py-2 text-sm font-semibold text-black transition hover:bg-cyan-400 disabled:opacity-50"
                    >
                      <Save size={14} className="mr-1 inline" />
                      {profileSaving ? "Saving..." : "Save"}
                    </button>
                    <button 
                      onClick={closeEditProfile} 
                      className="flex-1 rounded-xl border border-white/10 py-2 text-sm text-white transition hover:bg-white/5"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Image Cropper Modal */}
          {showCropper && tempAvatarFile && (
            <ImageCropper
              imageFile={tempAvatarFile}
              onCropComplete={handleCropComplete}
              onCancel={() => {
                setShowCropper(false);
                setTempAvatarFile(null);
              }}
            />
          )}
        </div>
      )}

      {/* ==================== SECURITY TAB ==================== */}
      {activeTab === "security" && (
        <div className="space-y-4 sm:space-y-5">
          {/* Email Verification */}
          <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-4 sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="rounded-full bg-cyan-500/10 p-1.5 sm:p-2">
                  <Mail className="h-4 w-4 text-cyan-400 sm:h-5 sm:w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white sm:text-base">Email Verification</h3>
                  <p className="text-xs text-slate-400 sm:text-sm">{profile.email}</p>
                  <div className="mt-1.5">
                    <StatusBadge verified={profile.email_verified} label={profile.email_verified ? "Verified" : "Not Verified"} />
                  </div>
                </div>
              </div>
              {!profile.email_verified && (
                <button onClick={() => setVerifyModalOpen(true)} className="rounded-xl bg-cyan-500 px-3 py-1.5 text-xs font-semibold text-black sm:px-4 sm:py-2 sm:text-sm">
                  Verify Email
                </button>
              )}
            </div>
          </div>

          {/* Transaction Passcode */}
          <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-4 sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="rounded-full bg-purple-500/10 p-1.5 sm:p-2">
                  <Lock className="h-4 w-4 text-purple-400 sm:h-5 sm:w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white sm:text-base">Transaction Passcode</h3>
                  <p className="text-xs text-slate-400 sm:text-sm">
                    {securityStatus.hasPasscode ? "Passcode is set. Used for sensitive operations." : "No passcode set. Set one to secure your account."}
                  </p>
                  <div className="mt-1.5">
                    <StatusBadge verified={securityStatus.hasPasscode} label={securityStatus.hasPasscode ? "Enabled" : "Not Set"} />
                  </div>
                </div>
              </div>
              <button onClick={() => setPasscodeModalOpen(true)} className={`rounded-xl px-3 py-1.5 text-xs font-semibold sm:px-4 sm:py-2 sm:text-sm ${securityStatus.hasPasscode ? "border border-white/10 bg-white/5 text-white" : "bg-purple-500 text-black"}`}>
                <KeyRound size={12} className="mr-1 inline sm:h-4 sm:w-4" />
                {securityStatus.hasPasscode ? "Change" : "Set"}
              </button>
            </div>
          </div>

          {/* 2FA Section */}
          <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-4 sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="rounded-full bg-emerald-500/10 p-1.5 sm:p-2">
                  <Smartphone className="h-4 w-4 text-emerald-400 sm:h-5 sm:w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white sm:text-base">Two-Factor Authentication</h3>
                  <p className="text-xs text-slate-400 sm:text-sm">
                    {securityStatus.twofaEnabled ? "2FA is enabled. Your account is more secure." : "Enhance security with 2FA protection."}
                  </p>
                  <div className="mt-1.5">
                    <StatusBadge verified={securityStatus.twofaEnabled} label={securityStatus.twofaEnabled ? "Enabled" : "Disabled"} />
                  </div>
                </div>
              </div>
              <button onClick={() => securityStatus.hasPasscode ? setVerifyPasscodeModalOpen(true) : setPasscodeModalOpen(true)} className={`rounded-xl px-3 py-1.5 text-xs font-semibold sm:px-4 sm:py-2 sm:text-sm ${securityStatus.twofaEnabled ? "border border-white/10 bg-white/5 text-white" : "bg-emerald-500 text-black"}`}>
                <Shield size={12} className="mr-1 inline sm:h-4 sm:w-4" />
                {securityStatus.twofaEnabled ? "Disable" : "Enable"}
              </button>
            </div>
          </div>

          {/* Joint Account Section */}
          <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-4 sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <div className="shrink-0 rounded-full bg-indigo-500/10 p-1.5 sm:p-2">
                  <Users className="h-4 w-4 text-indigo-400 sm:h-5 sm:w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold text-white sm:text-base">Joint Account</h3>
                  <p className="text-xs text-slate-400 break-words sm:text-sm">
                    Connect with another user to share balances and manage assets together
                  </p>
                  {jointAccountStatus?.hasJointAccount && (
                    <div className="mt-2">
                      <StatusBadge verified={true} label="Active Joint Account" />
                      <p className="mt-1 text-xs text-slate-500 break-all">
                        ID: {jointAccountStatus.jointAccount?.account_id}
                      </p>
                      {jointPartner && (
                        <p className="mt-1 text-xs text-indigo-300 break-words">
                          Connected: {jointPartner.name || jointPartner.email}
                        </p>
                      )}
                      {combinedBalanceData?.hasJointAccount && (
                        <div className="mt-2 rounded-lg bg-indigo-500/10 p-2">
                          <div className="text-[10px] text-indigo-300 sm:text-xs">Combined Balance</div>
                          <div className="text-sm font-bold text-white sm:text-base">
                            {formatMoney(combinedBalanceData.combinedBalance)} USDT
                          </div>
                          <div className="mt-0.5 text-[9px] text-slate-400 sm:text-[10px]">
                            You: {formatMoney(combinedBalanceData.userBalance)} + 
                            Partner: {formatMoney(combinedBalanceData.partnerBalance)}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  {jointAccountStatus?.pendingRequest && (
                    <div className="mt-2">
                      <StatusBadge verified={false} label="Request Pending Approval" />
                      <p className="mt-1 text-xs text-amber-300">
                        Awaiting admin approval
                      </p>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="shrink-0">
                {!jointAccountStatus?.hasJointAccount && !jointAccountStatus?.pendingRequest ? (
                  <button
                    onClick={() => setJointModalOpen(true)}
                    className="whitespace-nowrap rounded-xl bg-indigo-500 px-3 py-1.5 text-xs font-semibold text-black hover:bg-indigo-400 transition sm:px-4 sm:py-2 sm:text-sm"
                  >
                    Request
                  </button>
                ) : jointAccountStatus?.pendingRequest ? (
                  <span className="inline-block whitespace-nowrap rounded-xl border border-amber-500/20 bg-amber-500/10 px-2 py-1.5 text-xs text-amber-300 sm:px-3 sm:py-2 sm:text-sm">
                    Pending
                  </span>
                ) : (
                  <span className="inline-block whitespace-nowrap rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-2 py-1.5 text-xs text-emerald-300 sm:px-3 sm:py-2 sm:text-sm">
                    Active
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== PREFERENCES TAB ==================== */}
      {activeTab === "preferences" && (
        <div className="space-y-3 sm:space-y-4">
          {/* Language */}
          <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-4 sm:p-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <Languages className="h-4 w-4 text-cyan-400 sm:h-5 sm:w-5" />
                <div>
                  <h3 className="text-sm font-semibold text-white sm:text-base">Language</h3>
                  <p className="text-xs text-slate-400">Choose your preferred language</p>
                </div>
              </div>
              <select
                value={preferences.language}
                onChange={(e) => updatePreference("language", e.target.value)}
                className="rounded-xl border border-white/10 bg-slate-800 px-2 py-1.5 text-xs text-white sm:px-3 sm:py-2 sm:text-sm"
              >
                <option>English</option>
                <option>Spanish</option>
                <option>French</option>
                <option>German</option>
                <option>Chinese</option>
                <option>Japanese</option>
              </select>
            </div>
          </div>

          {/* Currency */}
          <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-4 sm:p-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <DollarSign className="h-4 w-4 text-emerald-400 sm:h-5 sm:w-5" />
                <div>
                  <h3 className="text-sm font-semibold text-white sm:text-base">Currency</h3>
                  <p className="text-xs text-slate-400">Display currency for assets</p>
                </div>
              </div>
              <select
                value={preferences.currency}
                onChange={(e) => updatePreference("currency", e.target.value)}
                className="rounded-xl border border-white/10 bg-slate-800 px-2 py-1.5 text-xs text-white sm:px-3 sm:py-2 sm:text-sm"
              >
                <option>USD</option>
                <option>EUR</option>
                <option>GBP</option>
                <option>JPY</option>
                <option>CNY</option>
              </select>
            </div>
          </div>

          {/* Appearance */}
          <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-4 sm:p-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                {preferences.appearance === "light" ? <Sun className="h-4 w-4 text-yellow-400" /> : preferences.appearance === "dark" ? <Moon className="h-4 w-4 text-slate-400" /> : <Monitor className="h-4 w-4 text-blue-400" />}
                <div>
                  <h3 className="text-sm font-semibold text-white sm:text-base">Appearance</h3>
                  <p className="text-xs text-slate-400">Light, Dark, or System default</p>
                </div>
              </div>
              <select
                value={preferences.appearance}
                onChange={(e) => updatePreference("appearance", e.target.value)}
                className="rounded-xl border border-white/10 bg-slate-800 px-2 py-1.5 text-xs text-white sm:px-3 sm:py-2 sm:text-sm"
              >
                <option value="light">Light</option>
                <option value="dark">Dark</option>
                <option value="system">System</option>
              </select>
            </div>
          </div>

          {/* Notifications */}
          <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Bell className="h-4 w-4 text-amber-400 sm:h-5 sm:w-5" />
                <div>
                  <h3 className="text-sm font-semibold text-white sm:text-base">Notifications</h3>
                  <p className="text-xs text-slate-400">Push notifications and alerts</p>
                </div>
              </div>
              <button
                onClick={() => updatePreference("notifications", !preferences.notifications)}
                className={`h-5 w-10 rounded-full transition sm:h-6 sm:w-11 ${preferences.notifications ? "bg-cyan-500" : "bg-slate-700"}`}
              >
                <div className={`h-4 w-4 rounded-full bg-white transition ${preferences.notifications ? "ml-5 sm:ml-6" : "ml-0.5"} mt-0.5 sm:h-5 sm:w-5`} />
              </button>
            </div>
          </div>

          {/* Haptic Feedback */}
          <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Vibrate className="h-4 w-4 text-purple-400 sm:h-5 sm:w-5" />
                <div>
                  <h3 className="text-sm font-semibold text-white sm:text-base">Haptic feedback</h3>
                  <p className="text-xs text-slate-400">Vibration on actions</p>
                </div>
              </div>
              <button
                onClick={() => updatePreference("hapticFeedback", !preferences.hapticFeedback)}
                className={`h-5 w-10 rounded-full transition sm:h-6 sm:w-11 ${preferences.hapticFeedback ? "bg-cyan-500" : "bg-slate-700"}`}
              >
                <div className={`h-4 w-4 rounded-full bg-white transition ${preferences.hapticFeedback ? "ml-5 sm:ml-6" : "ml-0.5"} mt-0.5 sm:h-5 sm:w-5`} />
              </button>
            </div>
          </div>

          {/* Sound Effects */}
          <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Volume2 className="h-4 w-4 text-blue-400 sm:h-5 sm:w-5" />
                <div>
                  <h3 className="text-sm font-semibold text-white sm:text-base">Sound effects</h3>
                  <p className="text-xs text-slate-400">Play sounds on actions</p>
                </div>
              </div>
              <button
                onClick={() => updatePreference("soundEffects", !preferences.soundEffects)}
                className={`h-5 w-10 rounded-full transition sm:h-6 sm:w-11 ${preferences.soundEffects ? "bg-cyan-500" : "bg-slate-700"}`}
              >
                <div className={`h-4 w-4 rounded-full bg-white transition ${preferences.soundEffects ? "ml-5 sm:ml-6" : "ml-0.5"} mt-0.5 sm:h-5 sm:w-5`} />
              </button>
            </div>
          </div>

          {/* Chart Timezone */}
          <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-4 sm:p-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <Globe className="h-4 w-4 text-indigo-400 sm:h-5 sm:w-5" />
                <div>
                  <h3 className="text-sm font-semibold text-white sm:text-base">Chart timezone</h3>
                  <p className="text-xs text-slate-400">24h change & chart timezone</p>
                </div>
              </div>
              <select
                value={preferences.chartTimezone}
                onChange={(e) => updatePreference("chartTimezone", e.target.value)}
                className="rounded-xl border border-white/10 bg-slate-800 px-2 py-1.5 text-xs text-white sm:px-3 sm:py-2 sm:text-sm"
              >
                <option>UTC</option>
                <option>EST</option>
                <option>CST</option>
                <option>PST</option>
                <option>GMT</option>
                <option>Local</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* ==================== MODALS ==================== */}

      {/* Set Passcode Modal */}
      {passcodeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900 p-5 sm:p-6">
            <h2 className="mb-4 text-lg font-bold text-white sm:text-xl">{securityStatus.hasPasscode ? "Change Passcode" : "Set Passcode"}</h2>
            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm text-slate-400">Enter Passcode (min 4 digits)</label>
                <div className="relative">
                  <input
                    type={showPasscode ? "text" : "password"}
                    value={passcode}
                    onChange={(e) => setPasscode(e.target.value)}
                    placeholder="Enter 4-6 digit passcode"
                    className="w-full rounded-xl border border-white/10 bg-slate-800 px-4 py-3 text-sm text-white outline-none focus:border-purple-500"
                    maxLength={6}
                  />
                  <button onClick={() => setShowPasscode(!showPasscode)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                    {showPasscode ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="mb-2 block text-sm text-slate-400">Confirm Passcode</label>
                <input
                  type={showPasscode ? "text" : "password"}
                  value={confirmPasscode}
                  onChange={(e) => setConfirmPasscode(e.target.value)}
                  placeholder="Confirm your passcode"
                  className="w-full rounded-xl border border-white/10 bg-slate-800 px-4 py-3 text-sm text-white outline-none focus:border-purple-500"
                  maxLength={6}
                />
              </div>
              {passcodeError && <div className="rounded-xl bg-red-500/10 p-3 text-sm text-red-400">{passcodeError}</div>}
            </div>
            <div className="mt-6 flex gap-3">
              <button onClick={() => { setPasscodeModalOpen(false); setPasscode(""); setConfirmPasscode(""); setPasscodeError(""); }} className="flex-1 rounded-xl border border-white/10 bg-white/5 py-2 text-white">
                Cancel
              </button>
              <button onClick={handleSetPasscode} disabled={savingPasscode} className="flex-1 rounded-xl bg-purple-500 py-2 font-semibold text-black">
                {savingPasscode ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Email Verification Modal */}
      {verifyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900 p-5 sm:p-6">
            <h2 className="mb-2 text-lg font-bold text-white sm:text-xl">Verify Email</h2>
            <p className="mb-4 text-xs text-slate-400 sm:text-sm">Verification code will be sent to {profile.email}</p>
            <button onClick={handleSendVerificationCode} disabled={sendingCode || countdown > 0} className="w-full rounded-xl bg-cyan-500 py-2 text-sm font-semibold text-black disabled:opacity-50 sm:py-3">
              {sendingCode ? <RefreshCw size={16} className="mx-auto animate-spin" /> : countdown > 0 ? `Resend in ${countdown}s` : "Send Code"}
            </button>
            <div className="mt-4">
              <label className="mb-2 block text-sm text-slate-400">Enter 6-digit code</label>
              <input type="text" value={verificationCode} onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="000000" className="w-full rounded-xl border border-white/10 bg-slate-800 px-4 py-3 text-center text-xl tracking-widest text-white outline-none focus:border-cyan-500 sm:text-2xl" maxLength={6} />
            </div>
            <div className="mt-6 flex gap-3">
              <button onClick={() => { setVerifyModalOpen(false); setVerificationCode(""); setVerificationError(""); setVerificationSuccess(""); }} className="flex-1 rounded-xl border border-white/10 bg-white/5 py-2 text-white">
                Cancel
              </button>
              <button onClick={handleVerifyCode} disabled={verifyingCode || !verificationCode} className="flex-1 rounded-xl bg-cyan-500 py-2 font-semibold text-black">
                {verifyingCode ? "Verifying..." : "Verify"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Verify Passcode Modal */}
      {verifyPasscodeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900 p-5 sm:p-6">
            <h2 className="mb-4 text-lg font-bold text-white sm:text-xl">Verify Passcode</h2>
            <p className="mb-4 text-xs text-slate-400 sm:text-sm">Please enter your passcode to continue</p>
            <input type="password" value={verifyPasscode} onChange={(e) => setVerifyPasscode(e.target.value)} placeholder="Enter your passcode" className="w-full rounded-xl border border-white/10 bg-slate-800 px-4 py-3 text-sm text-white outline-none focus:border-purple-500" />
            {verifyPasscodeError && <div className="mt-3 rounded-xl bg-red-500/10 p-3 text-sm text-red-400">{verifyPasscodeError}</div>}
            <div className="mt-6 flex gap-3">
              <button onClick={() => { setVerifyPasscodeModalOpen(false); setVerifyPasscode(""); setVerifyPasscodeError(""); }} className="flex-1 rounded-xl border border-white/10 bg-white/5 py-2 text-white">
                Cancel
              </button>
              <button onClick={handleVerifyPasscode} disabled={verifyingPasscode} className="flex-1 rounded-xl bg-purple-500 py-2 font-semibold text-black">
                {verifyingPasscode ? "Verifying..." : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Joint Account Request Modal */}
      {jointModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900 p-5 sm:p-6">
            <h2 className="mb-3 text-lg font-bold text-white sm:mb-4 sm:text-xl">Request Joint Account</h2>
            <p className="mb-4 text-xs text-slate-400 sm:text-sm">
              Enter the email of the user you want to create a joint account with.
              Both users must have completed KYC verification.
            </p>
            
            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm text-slate-400">Partner's Email</label>
                <input
                  type="email"
                  value={jointForm.partnerEmail}
                  onChange={(e) => setJointForm(prev => ({ ...prev, partnerEmail: e.target.value }))}
                  placeholder="partner@example.com"
                  className="w-full rounded-xl border border-white/10 bg-slate-800 px-4 py-3 text-sm text-white outline-none focus:border-indigo-500"
                />
              </div>
              
              <div>
                <label className="mb-2 block text-sm text-slate-400">Partner's KYC Number (Optional)</label>
                <input
                  type="text"
                  value={jointForm.partnerKycNumber}
                  onChange={(e) => setJointForm(prev => ({ ...prev, partnerKycNumber: e.target.value }))}
                  placeholder="Enter KYC number if available"
                  className="w-full rounded-xl border border-white/10 bg-slate-800 px-4 py-3 text-sm text-white outline-none focus:border-indigo-500"
                />
              </div>
            </div>
            
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => {
                  setJointModalOpen(false);
                  setJointForm({ partnerEmail: "", partnerKycNumber: "" });
                  setError("");
                }}
                className="flex-1 rounded-xl border border-white/10 bg-white/5 py-2 text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleRequestJointAccount}
                disabled={submittingJoint}
                className="flex-1 rounded-xl bg-indigo-500 py-2 font-semibold text-black disabled:opacity-50"
              >
                {submittingJoint ? "Sending..." : "Send Request"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Helper function for formatting money (add this at the end of the file if not already present)
function formatMoney(value) {
  const num = Number(value || 0);
  if (!Number.isFinite(num)) return "0.00";
  return num.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}