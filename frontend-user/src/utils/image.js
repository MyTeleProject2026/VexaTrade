// ─── NORMALIZE BASE URL ──────────────────────────────────────────
const getBaseUrl = () => {
  let base = import.meta.env.VITE_API_BASE_URL || "https://vexatrade-5ycu.onrender.com";
  // ✅ Remove trailing slash to avoid double slashes when joining
  return base.replace(/\/+$/, '');
};

export const API_BASE_URL = getBaseUrl();

// ─── GET FULL IMAGE URL ──────────────────────────────────────────
export function getFullImageUrl(url) {
  // ✅ Handle null, undefined, or empty string
  if (!url) return "";

  // ✅ Trim whitespace to prevent "   " from becoming a valid URL
  const trimmedUrl = String(url).trim();
  if (!trimmedUrl) return "";

  // ✅ Return blob URLs and absolute URLs as-is
  if (trimmedUrl.startsWith("blob:")) return trimmedUrl;
  if (trimmedUrl.startsWith("http://") || trimmedUrl.startsWith("https://")) {
    return trimmedUrl;
  }

  // ✅ Ensure relative paths start with a single slash
  const normalizedPath = trimmedUrl.startsWith("/") ? trimmedUrl : `/${trimmedUrl}`;
  
  return `${API_BASE_URL}${normalizedPath}`;
}
