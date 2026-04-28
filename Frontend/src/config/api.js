function getDefaultApiUrl() {
  if (typeof window === "undefined") return "http://localhost:4000/api";

  const { protocol, hostname } = window.location;
  const isLocalHost = hostname === "localhost" || hostname === "127.0.0.1";

  if (isLocalHost) return "http://localhost:4000/api";

  return `${protocol}//${hostname}:4000/api`;
}

const rawApiUrl = import.meta.env.VITE_API_URL || getDefaultApiUrl();

export const API_URL = rawApiUrl.replace(/\/+$/, "");

export function getApiOrigin() {
  return API_URL.replace(/\/api$/, "");
}
