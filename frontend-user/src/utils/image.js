export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "https://cryptopulse-4rhe.onrender.com";

export function getFullImageUrl(url) {
  if (!url) return "";
  if (url.startsWith("blob:")) return url;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return `${API_BASE_URL}${url}`;
}