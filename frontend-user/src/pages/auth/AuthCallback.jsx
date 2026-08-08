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
      // ✅ FIX: Sync user from VexaAccount to VexaTrade
      // ──────────────────────────────────────────────────────────
      const syncUser = async () => {
        try {
          const email = userData?.email || '';
          
          console.log('[AuthCallback] Syncing user:', email);
          
          const response = await fetch('/api/auth/sync-user', {
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
          console.log('[AuthCallback] Sync response:', data);

          if (data.success && data.user) {
            // Store complete user data
            const userWithTradeData = {
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
            localStorage.setItem("user", JSON.stringify(userWithTradeData));
            localStorage.setItem("userData", JSON.stringify(userWithTradeData));
            
            if (data.needsVerification) {
              // Needs verification – go to Account Verification page
              showSuccess("Account created! Please complete verification.");
              navigate("/account-verification", { replace: true });
            } else {
              // Fully approved – go to dashboard
              showSuccess("Login successful!");
              navigate("/dashboard", { replace: true });
            }
          } else {
            // Fallback – go to verification
            showSuccess("Account created! Please complete verification.");
            navigate("/account-verification", { replace: true });
          }
        } catch (error) {
          console.error('[AuthCallback] Sync error:', error);
          showError("Failed to sync account. Please try again.");
          navigate("/login", { replace: true });
        } finally {
          setLoading(false);
        }
      };

      if (userData?.email) {
        syncUser();
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
          <p className="text-white mt-4">Setting up your account...</p>
        </div>
      </div>
    );
  }

  return <div>Completing authentication...</div>;
}
