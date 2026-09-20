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

async function syncPreferences(value) {
  const token = localStorage.getItem("userToken") || localStorage.getItem("accessToken") || localStorage.getItem("token");
  if (!token) return null;
  const base = import.meta.env.VITE_API_BASE_URL || "https://vexatrade-5ycu.onrender.com";
  const response = await fetch(`${base}/api/user/preferences`, { method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(value) });
  if (!response.ok) throw new Error("Unable to sync preferences");
  return response.json();
}

export async function hydratePreferences() {
  const token = localStorage.getItem("userToken") || localStorage.getItem("accessToken") || localStorage.getItem("token");
  if (!token) return getPreferences();
  try {
    const base = import.meta.env.VITE_API_BASE_URL || "https://vexatrade-5ycu.onrender.com";
    const response = await fetch(`${base}/api/user/preferences`, { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) return getPreferences();
    const remote = (await response.json()).data || {};
    const value = { ...defaults, ...remote };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    applyAppearance(value.appearance);
    return value;
  } catch { return getPreferences(); }
}

export function savePreferences(next) {
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
