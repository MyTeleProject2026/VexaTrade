import { Navigate } from "react-router-dom";

export default function ProtectedRoute({ children, role = "user" }) {
  const userToken =
    localStorage.getItem("userToken") ||
    localStorage.getItem("token") ||
    localStorage.getItem("accessToken");

  const adminToken =
    localStorage.getItem("adminToken") ||
    localStorage.getItem("admin_token");

  if (role === "user") {
    if (!userToken) {
      return <Navigate to="/login" replace />;
    }
    return children;
  }

  if (role === "admin") {
    if (!adminToken) {
      return <Navigate to="/admin/login" replace />;
    }
    return children;
  }

  return <Navigate to="/login" replace />;
}