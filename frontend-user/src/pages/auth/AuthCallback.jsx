// frontend-user/src/pages/auth/AuthCallback.jsx
import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useNotification } from "../../hooks/useNotification";

export default function AuthCallback() {
  const navigate = useNavigate();
  const location = useLocation();
  const { showSuccess, showError } = useNotification();
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const token = params.get("token");
    const userParam = params.get("user");

    console.log('[AuthCallback] Full URL:', window.location.href);
    console.log('[AuthCallback] Token present:', !!token);
    console.log('[AuthCallback] User param present:', !!userParam);

    if (!token) {
      const error = params.get("error");
      const registered = params.get("registered");
      if (registered === "true") {
        showSuccess("Account created! Please login.");
        navigate("/login", { replace: true });
      } else {
        showError(error || "Authentication failed. Please try again.");
        navigate("/login", { replace: true });
      }
      setLoading(false);
      return;
    }

    // Store token
    localStorage.setItem("userToken", token);
    localStorage.setItem("token", token);
    localStorage.setItem("accessToken", token);

    let userData = null;
    if (userParam) {
      try {
        userData = JSON.parse(decodeURIComponent(userParam));
        localStorage.setItem("user", JSON.stringify(userData));
        localStorage.setItem("userData", JSON.stringify(userData));
        console.log('[AuthCallback] User stored:', userData.email);
      } catch (e) {
        console.error("Failed to parse user data:", e);
      }
    }

    const email = userData?.email || '';
    if (!email) {
      showError("No email received. Please try again.");
      navigate("/login", { replace: true });
      setLoading(false);
      return;
    }

    // ─── SYNC USER ──────────────────────────────────────────────
    const syncUser = async () => {
      try {
        console.log('[AuthCallback] Calling /api/auth/sync-user for:', email);
        const response = await fetch('/api/auth/sync-user', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ email, vexaToken: token })
        });

        const data = await response.json();
        console.log('[AuthCallback] Sync response:', data);

        if (!data.success) {
          throw new Error(data.message || 'Sync failed');
        }

        // Store updated user data with VexaTrade fields
        if (data.user) {
          const mergedUser = {
            ...userData,
            id: data.user.id,
            email_verified: data.user.email_verified || 0,
            kyc_status: data.user.kyc_status || 'not_submitted',
            status: data.user.status || 'pending',
            first_name: data.user.first_name,
            last_name: data.user.last_name,
            gender: data.user.gender,
            dob: data.user.dob,
            country: data.user.country
          };
          localStorage.setItem("user", JSON.stringify(mergedUser));
          localStorage.setItem("userData", JSON.stringify(mergedUser));
        }

        if (data.needsVerification) {
          showSuccess("Account created! Please complete verification.");
          navigate("/account-verification", { replace: true });
        } else {
          showSuccess("Login successful!");
          navigate("/dashboard", { replace: true });
        }
      } catch (error) {
        console.error('[AuthCallback] Sync error:', error);
        setErrorMsg(error.message);
        showError("Failed to sync account. Please try again.");
        // Fallback: go to verification anyway (maybe user exists but needs verification)
        navigate("/account-verification", { replace: true });
      } finally {
        setLoading(false);
      }
    };

    syncUser();
  }, [location, navigate, showSuccess, showError]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#050812]">
        <div className="text-center">
          <div className="spinner border-4 border-cyan-500 border-t-transparent rounded-full w-12 h-12 animate-spin mx-auto"></div>
          <p className="text-white mt-4">Setting up your account...</p>
          {errorMsg && <p className="text-red-400 mt-2 text-sm">{errorMsg}</p>}
        </div>
      </div>
    );
  }

  return <div>Completing authentication...</div>;
}
