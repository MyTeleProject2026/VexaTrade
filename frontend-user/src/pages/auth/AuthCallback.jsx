// frontend-user/src/pages/auth/AuthCallback.jsx
import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useNotification } from "../../hooks/useNotification";

export default function AuthCallback() {
  const navigate = useNavigate();
  const location = useLocation();
  const { showSuccess, showError } = useNotification();
  const [loading, setLoading] = useState(true);

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
        showError(error || "Authentication failed.");
        navigate("/login", { replace: true });
      }
      setLoading(false);
      return;
    }

    // ✅ Store token immediately
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
      showError("No email received.");
      navigate("/login", { replace: true });
      setLoading(false);
      return;
    }

    // ─── STEP 1: Check if user exists in VexaTrade ──────────
    const handleAuth = async () => {
      try {
        console.log('[AuthCallback] Checking user existence:', email);
        const checkRes = await fetch('/api/auth/check-user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ email })
        });
        const checkData = await checkRes.json();
        console.log('[AuthCallback] Check response:', checkData);

        if (checkData.success && checkData.exists) {
          // User exists – update stored data
          const merged = { ...userData, ...checkData.user };
          localStorage.setItem("user", JSON.stringify(merged));
          localStorage.setItem("userData", JSON.stringify(merged));
          if (checkData.needsVerification) {
            showSuccess("Please complete verification.");
            navigate("/account-verification", { replace: true });
          } else {
            showSuccess("Login successful!");
            navigate("/dashboard", { replace: true });
          }
          setLoading(false);
          return;
        }

        // ─── STEP 2: User does not exist – sync/create ──────
        console.log('[AuthCallback] User not found, syncing...');
        const syncRes = await fetch('/api/auth/sync-user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ email, vexaToken: token })
        });
        const syncData = await syncRes.json();
        console.log('[AuthCallback] Sync response:', syncData);

        if (!syncData.success) {
          throw new Error(syncData.message || 'Sync failed');
        }

        // Store synced user data
        const merged = { ...userData, ...syncData.user };
        localStorage.setItem("user", JSON.stringify(merged));
        localStorage.setItem("userData", JSON.stringify(merged));

        if (syncData.needsVerification) {
          showSuccess("Account created! Please complete verification.");
          navigate("/account-verification", { replace: true });
        } else {
          showSuccess("Login successful!");
          navigate("/dashboard", { replace: true });
        }
      } catch (error) {
        console.error('[AuthCallback] Error:', error);
        showError("Authentication error. Please try again.");
        navigate("/login", { replace: true });
      } finally {
        setLoading(false);
      }
    };

    handleAuth();
  }, [location, navigate, showSuccess, showError]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#050812]">
        <div className="text-center">
          <div className="spinner border-4 border-cyan-500 border-t-transparent rounded-full w-12 h-12 animate-spin mx-auto"></div>
          <p className="text-white mt-4">Setting up your account...</p>
        </div>
      </div>
    );
  }

  return <div>Completing authentication...</div>;
}
