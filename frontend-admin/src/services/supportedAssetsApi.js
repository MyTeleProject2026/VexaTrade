import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "https://vexatrade-5ycu.onrender.com";

const getAdminToken = () =>
  localStorage.getItem("adminToken") || localStorage.getItem("admin_token") || "";

const request = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: { "Content-Type": "application/json" },
});

export async function getAdminSupportedAssets() {
  return request.get("/api/admin/supported-assets", {
    headers: { Authorization: `Bearer ${getAdminToken()}` },
  });
}
