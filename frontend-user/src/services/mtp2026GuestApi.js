const API_PATH = "/api/mtp2026";
const REQUIRED = ["mtp2026","android","windows11","gaming"];

export async function fetchMtp2026GuestManifest({ signal } = {}) {
  const response = await fetch(`${API_PATH}/guest-manifest.json`, {
    method: "GET",
    credentials: "include",
    cache: "no-store",
    signal,
    headers: { Accept: "application/json" },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data?.error || "GUEST_MANIFEST_UNAVAILABLE");
    error.code = data?.error || "GUEST_MANIFEST_UNAVAILABLE";
    error.profiles = data?.profiles || [];
    error.manifest = data?.manifest || null;
    throw error;
  }
  const missing = REQUIRED.filter((id) => !data?.guests?.[id]?.imageSource?.url || !data?.guests?.[id]?.imageSource?.sha256);
  if (missing.length) {
    const error = new Error("GUEST_MANIFEST_INCOMPLETE");
    error.code = "GUEST_MANIFEST_INCOMPLETE";
    error.profiles = missing;
    throw error;
  }
  return data;
}

export async function fetchMtp2026GuestProfile(id, { signal } = {}) {
  if (!REQUIRED.includes(id)) throw new Error("GUEST_PROFILE_NOT_FOUND");
  const response = await fetch(`${API_PATH}/guest-profile/${encodeURIComponent(id)}`, {
    credentials: "include", cache: "no-store", signal, headers: { Accept: "application/json" },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error || "GUEST_PROFILE_UNAVAILABLE");
  return data;
}

export function getGuestInstallUrl(profile) {
  return profile?.imageSource?.url || null;
}
