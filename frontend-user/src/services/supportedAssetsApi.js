import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "https://vexatrade-5ycu.onrender.com";
const CACHE_KEY = "vexatrade_supported_assets_v1";
const CACHE_TTL_MS = 5 * 60 * 1000;

const token = () =>
  localStorage.getItem("userToken") ||
  localStorage.getItem("accessToken") ||
  localStorage.getItem("token") ||
  "";

function normalizeAsset(asset) {
  const symbol = String(asset?.symbol || asset?.code || "").trim().toUpperCase();
  const networks = Array.isArray(asset?.networks)
    ? asset.networks
        .map((network) => {
          if (typeof network === "string") return { value: network, label: network };
          const value = String(network?.network || network?.code || network?.symbol || "").trim();
          return value ? { ...network, value, label: network?.name || value } : null;
        })
        .filter(Boolean)
    : [];
  return { ...asset, symbol, networks };
}

function readCache() {
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
    if (cached?.expiresAt > Date.now() && Array.isArray(cached.data)) return cached.data;
  } catch (_) {}
  return null;
}

function writeCache(data) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ data, expiresAt: Date.now() + CACHE_TTL_MS }));
  } catch (_) {}
}

export async function getSupportedAssets({ forceRefresh = false } = {}) {
  if (!forceRefresh) {
    const cached = readCache();
    if (cached) return cached;
  }

  const response = await axios.get(`${API_BASE_URL}/api/supported-assets`, {
    headers: token() ? { Authorization: `Bearer ${token()}` } : {},
  });
  const data = Array.isArray(response.data?.data)
    ? response.data.data.map(normalizeAsset).filter((asset) => asset.symbol)
    : [];
  writeCache(data);
  return data;
}

export function groupAssetNetworks(assets = []) {
  return assets.reduce((result, asset) => {
    const symbol = String(asset?.symbol || asset?.code || "").toUpperCase();
    if (!symbol) return result;
    result[symbol] = Array.isArray(asset?.networks) ? asset.networks : [];
    return result;
  }, {});
}

export function getNetworksForAsset(assets = [], symbol = "") {
  const key = String(symbol).trim().toUpperCase();
  const asset = assets.find((item) => String(item?.symbol || item?.code || "").toUpperCase() === key);
  return Array.isArray(asset?.networks) ? asset.networks : [];
}

export function clearSupportedAssetsCache() {
  try { localStorage.removeItem(CACHE_KEY); } catch (_) {}
}
