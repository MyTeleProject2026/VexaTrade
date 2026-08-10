export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "https://vexatrade-5ycu.onrender.com";

/**
 * Get a fully qualified image URL.
 * Supports blob URLs, absolute URLs, and relative paths.
 */
export function getFullImageUrl(url) {
  if (!url) return "";
  if (url.startsWith("blob:")) return url;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;

  // ✅ Prevent double slashes: strip trailing slash from base, ensure leading slash on url
  const base = API_BASE_URL.endsWith("/") ? API_BASE_URL.slice(0, -1) : API_BASE_URL;
  const cleanUrl = url.startsWith("/") ? url : `/${url}`;
  
  return `${base}${cleanUrl}`;
}
