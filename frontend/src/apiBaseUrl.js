const RAW_API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "").trim();

function normalize(url) {
  return url.replace(/\/$/, "");
}

function resolveApiBaseUrl() {
  if (RAW_API_BASE_URL) {
    return normalize(RAW_API_BASE_URL);
  }

  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    const isLocalHost =
      host === "localhost" || host === "127.0.0.1" || host === "::1";

    if (isLocalHost) {
      return "http://localhost:7001";
    }
  }

  return "";
}

export const API_BASE_URL = resolveApiBaseUrl();
export const IS_BACKEND_CONFIGURED =
  RAW_API_BASE_URL.length > 0 || typeof window !== "undefined";

export function apiUrl(path) {
  return `${API_BASE_URL}${path}`;
}
