import { Navigate } from "react-router-dom";

function safeParse(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function clearUserStorage() {
  localStorage.removeItem("userToken");
  localStorage.removeItem("token");
  localStorage.removeItem("accessToken");
  localStorage.removeItem("userRefreshToken");
  localStorage.removeItem("user");
  localStorage.removeItem("userData");
  localStorage.removeItem("role");
}

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

  if (role === "admin") {
    if (!adminToken) {
      return <Navigate to="/admin/login" replace />;
    }

    return children;
  }

  if (role === "user") {
    if (!userToken) {
      return <Navigate to="/login" replace />;
    }

    if (user?.status) {
      const status = String(user.status).toLowerCase();

      if (["blocked", "disabled", "frozen"].includes(status)) {
        if (status === "frozen") {
          alert("Your account is frozen. Please contact support.");
        }

        clearUserStorage();
        return <Navigate to="/login" replace />;
      }
    }

    return children;
  }

  return children;
}