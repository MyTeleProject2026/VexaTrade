import { Navigate } from "react-router-dom";

// ─── HELPER FUNCTIONS ──────────────────────────────────────────────
function safeParse(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

const BLOCKED_STATUSES = ["blocked", "disabled", "frozen"];

function clearAllAuthStorage() {
  // Clear user tokens
  localStorage.removeItem("userToken");
  localStorage.removeItem("token");
  localStorage.removeItem("accessToken");
  localStorage.removeItem("userRefreshToken");
  localStorage.removeItem("user");
  localStorage.removeItem("userData");
  localStorage.removeItem("role");

  // ✅ Also clear admin tokens to prevent stale data
  localStorage.removeItem("adminToken");
  localStorage.removeItem("admin_token");
  localStorage.removeItem("admin");
  localStorage.removeItem("adminData");
}

// ─── COMPONENT ──────────────────────────────────────────────────────
export default function ProtectedRoute({ children, role = "user" }) {
  const userToken =
    localStorage.getItem("userToken") ||
    localStorage.getItem("token") ||
    localStorage.getItem("accessToken") ||
    "";

  const adminToken =
    localStorage.getItem("adminToken") ||
    localStorage.getItem("admin_token") ||
    "";

  const user =
    safeParse(localStorage.getItem("user")) ||
    safeParse(localStorage.getItem("userData")) ||
    null;

  // ─── ADMIN ROUTE ──────────────────────────────────────────────
  if (role === "admin") {
    if (!adminToken) {
      return <Navigate to="/admin/login" replace />;
    }
    // Optional: add admin status check here if needed
    return children;
  }

  // ─── USER ROUTE ──────────────────────────────────────────────
  if (role === "user") {
    if (!userToken) {
      return <Navigate to="/login" replace />;
    }

    const status = String(user?.status || "").toLowerCase();

    if (BLOCKED_STATUSES.includes(status)) {
      // ✅ Log the block reason for debugging (instead of alert)
      console.warn(`🚫 Account blocked: ${status}`);

      // ✅ Clear all auth data to prevent redirect loops
      clearAllAuthStorage();

      // Redirect to login
      return <Navigate to="/login" replace />;
    }

    return children;
  }

  // Fallback (should not be reached)
  return children;
}
