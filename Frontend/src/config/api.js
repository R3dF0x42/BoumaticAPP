function getDefaultApiUrl() {
  if (typeof window === "undefined") return "http://localhost:4000/api";

  const { protocol, hostname } = window.location;
  const isLocalHost = hostname === "localhost" || hostname === "127.0.0.1";

  if (isLocalHost) return "http://localhost:4000/api";

  return `${protocol}//${hostname}:4000/api`;
}

const rawApiUrl = import.meta.env.VITE_API_URL || getDefaultApiUrl();

export const API_URL = rawApiUrl.replace(/\/+$/, "");

export async function apiFetch(url, options = {}) {
  const response = await globalThis.fetch(url, { ...options, credentials: "include" });
  if (response.status === 401 && !String(url).includes("/auth/")) {
    window.dispatchEvent(new Event("sessionExpired"));
  }
  return response;
}

export function getApiOrigin() {
  return API_URL.replace(/\/api$/, "");
}
