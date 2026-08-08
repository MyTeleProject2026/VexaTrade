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

    if (token) {
      // Store token from VexaAccount
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

      // ──────────────────────────────────────────────────────────
      // ✅ FIX: Check if user exists in VexaTrade database
      // ──────────────────────────────────────────────────────────
      const checkUserInVexaTrade = async () => {
        try {
          const email = userData?.email || '';
          
          const response = await fetch('/api/auth/check-user', {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ 
              email: email,
              vexaToken: token 
            })
          });

          const data = await response.json();
          console.log('[AuthCallback] User check response:', data);

          if (data.success && data.user) {
            // Store user data with VexaTrade fields
            const userWithTradeData = {
              ...userData,
              id: data.user.id,
              email_verified: data.user.email_verified || 0,
              kyc_status: data.user.kyc_status || 'not_submitted',
              status: data.user.status || 'pending'
            };
            localStorage.setItem("user", JSON.stringify(userWithTradeData));
            localStorage.setItem("userData", JSON.stringify(userWithTradeData));
          }

          if (data.exists && !data.needsVerification) {
            // User exists and is fully verified – go to dashboard
            showSuccess("Login successful!");
            navigate("/dashboard", { replace: true });
          } else {
            // New user or needs verification – go to Account Verification page
            showSuccess("Account created! Please complete verification.");
            navigate("/account-verification", { replace: true });
          }
        } catch (error) {
          console.error('[AuthCallback] Error checking user:', error);
          // On error, go to verification as safe fallback
          navigate("/account-verification", { replace: true });
        } finally {
          setLoading(false);
        }
      };

      if (userData?.email) {
        checkUserInVexaTrade();
      } else {
        // No user data – redirect to login
        showError("No user data received. Please try again.");
        navigate("/login", { replace: true });
        setLoading(false);
      }

    } else {
      const error = params.get("error");
      const registered = params.get("registered");

      if (registered === "true") {
        showSuccess("Account created! Please login.");
        navigate("/login", { replace: true });
        return;
      }

      showError(error || "Authentication failed. Please try again.");
      navigate("/login", { replace: true });
      setLoading(false);
    }
  }, [location, navigate, showSuccess, showError]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#050812]">
        <div className="text-center">
          <div className="spinner border-4 border-cyan-500 border-t-transparent rounded-full w-12 h-12 animate-spin mx-auto"></div>
          <p className="text-white mt-4">Completing authentication...</p>
        </div>
      </div>
    );
  }

  return <div>Completing authentication...</div>;
}
