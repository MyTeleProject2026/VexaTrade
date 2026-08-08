// frontend-user/src/pages/auth/AuthCallback.jsx
import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useNotification } from "../../hooks/useNotification";

export default function AuthCallback() {
  const navigate = useNavigate();
  const location = useLocation();
  const { showSuccess, showError } = useNotification();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const token = params.get("token");
    const userParam = params.get("user");

    console.log('[AuthCallback] Full URL:', window.location.href);
    console.log('[AuthCallback] Token present:', !!token);
    console.log('[AuthCallback] User param present:', !!userParam);

    if (token) {
      // ✅ Store token
      localStorage.setItem("userToken", token);
      localStorage.setItem("token", token);
      localStorage.setItem("accessToken", token);

      if (userParam) {
        try {
          const user = JSON.parse(decodeURIComponent(userParam));
          localStorage.setItem("user", JSON.stringify(user));
          localStorage.setItem("userData", JSON.stringify(user));
          console.log('[AuthCallback] User stored:', user.email);
        } catch (e) {
          console.error("Failed to parse user data:", e);
        }
      }

      showSuccess("Login successful!");
      navigate("/dashboard", { replace: true });
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
    }
  }, [location, navigate, showSuccess, showError]);

  return <div>Completing authentication...</div>;
}
