const rawApiUrl = import.meta.env.VITE_API_URL || "http://localhost:4000/api";

export const API_URL = rawApiUrl.replace(/\/+$/, "");

export function getApiOrigin() {
  return API_URL.replace(/\/api$/, "");
}
