const STORAGE_KEY = "vexatrade_preferences";

const defaults = {
  language: "en",
  timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
  appearance: "system",
  notifications: true,
  haptics: true,
  sounds: true,
};

export function getPreferences() {
  try {
    return { ...defaults, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") };
  } catch {
    return { ...defaults };
  }
}

async function syncPreferences(value) {\n  const token = localStorage.getItem("userToken") || localStorage.getItem("accessToken") || localStorage.getItem("token");\n  if (!token) return null;\n  const base = import.meta.env.VITE_API_BASE_URL || "https://vexatrade-5ycu.onrender.com";\n  const response = await fetch(`${base}/api/user/preferences`, { method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(value) });\n  if (!response.ok) throw new Error("Unable to sync preferences");\n  return response.json();\n}\n\nexport async function hydratePreferences() {\n  const token = localStorage.getItem("userToken") || localStorage.getItem("accessToken") || localStorage.getItem("token");\n  if (!token) return getPreferences();\n  try {\n    const base = import.meta.env.VITE_API_BASE_URL || "https://vexatrade-5ycu.onrender.com";\n    const response = await fetch(`${base}/api/user/preferences`, { headers: { Authorization: `Bearer ${token}` } });\n    if (!response.ok) return getPreferences();\n    const remote = (await response.json()).data || {};\n    const value = { ...defaults, ...remote };\n    localStorage.setItem(STORAGE_KEY, JSON.stringify(value));\n    applyAppearance(value.appearance);\n    return value;\n  } catch { return getPreferences(); }\n}\n\nexport function savePreferences(next) {
  const value = { ...getPreferences(), ...next };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  applyAppearance(value.appearance);
  window.dispatchEvent(new CustomEvent("vexatrade-preferences", { detail: value }));
  return value;
}

export function applyAppearance(appearance = getPreferences().appearance) {
  const resolved = appearance === "system"
    ? (window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ? "dark" : "light")
    : appearance;
  document.documentElement.dataset.appearance = resolved;
  document.documentElement.classList.toggle("dark", resolved === "dark");
}

export function getLocale(language = getPreferences().language) {
  const map = { en: "en-US", my: "my-MM", th: "th-TH", zh: "zh-CN", ja: "ja-JP", ko: "ko-KR", es: "es-ES", fr: "fr-FR", de: "de-DE", pt: "pt-BR", ar: "ar-SA", hi: "hi-IN", id: "id-ID", vi: "vi-VN", ru: "ru-RU" };
  return map[language] || "en-US";
}

export function formatDateTime(value, options = {}) {
  const prefs = getPreferences();
  return new Intl.DateTimeFormat(getLocale(prefs.language), {
    timeZone: prefs.timeZone,
    dateStyle: "medium",
    timeStyle: "short",
    ...options,
  }).format(new Date(value));
}

export function triggerHaptic(pattern = 10) {
  if (getPreferences().haptics && navigator.vibrate) navigator.vibrate(pattern);
}

export function playUiSound(type = "click") {
  if (!getPreferences().sounds) return;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;
  try {
    const ctx = new AudioContextClass();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.frequency.value = type === "success" ? 880 : type === "error" ? 180 : 520;
    gain.gain.setValueAtTime(0.035, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.08);
    oscillator.connect(gain).connect(ctx.destination);
    oscillator.start();
    oscillator.stop(ctx.currentTime + 0.08);
  } catch {}
}
