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
