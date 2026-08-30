import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "https://vexatrade-5ycu.onrender.com";

const token = () => localStorage.getItem("userToken") || localStorage.getItem("accessToken") || localStorage.getItem("token") || "";

export async function getSupportedAssets() {
  const response = await axios.get(`${API_BASE_URL}/api/supported-assets`, {
    headers: token() ? { Authorization: `Bearer ${token()}` } : {},
  });
  return response.data?.data || [];
}

export function groupAssetNetworks(assets = []) {
  return assets.reduce((result, asset) => {
    const symbol = String(asset.symbol || asset.code || "").toUpperCase();
    if (!symbol) return result;
    result[symbol] = Array.isArray(asset.networks) ? asset.networks : [];
    return result;
  }, {});
}
