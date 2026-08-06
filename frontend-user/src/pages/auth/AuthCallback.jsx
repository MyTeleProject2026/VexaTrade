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
    const userParam = params.get("user"); // JSON string

    if (token) {
      // Store token with all the keys the app checks
      localStorage.setItem("userToken", token);
      localStorage.setItem("token", token);
      localStorage.setItem("accessToken", token);

      if (userParam) {
        try {
          const user = JSON.parse(decodeURIComponent(userParam));
          localStorage.setItem("user", JSON.stringify(user));
          localStorage.setItem("userData", JSON.stringify(user));
        } catch (e) {
          console.error("Failed to parse user data:", e);
        }
      }

      showSuccess("Login successful");
      navigate("/dashboard", { replace: true });
    } else {
      const error = params.get("error");
      showError(error || "Authentication failed");
      navigate("/login", { replace: true });
    }
  }, [location, navigate, showSuccess, showError]);

  return (
    <div className="min-h-screen bg-[#050812] flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin h-8 w-8 border-2 border-cyan-500 border-t-transparent rounded-full mx-auto" />
        <p className="text-white/60 mt-4">Completing login...</p>
      </div>
    </div>
  );
}
