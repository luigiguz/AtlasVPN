function resolveApiBase(): string {
  if (typeof window !== "undefined") {
    const w = (window as unknown as { __ATLASVPN_API_BASE__?: string }).__ATLASVPN_API_BASE__;
    if (typeof w === "string" && w.trim()) return w.replace(/\/$/, "");
  }
  const v = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim() ?? "";
  return v.replace(/\/$/, "");
}

/** Base pública del API (p. ej. https://api-atlas-vpn.verkku.com). Vacío = mismo origen. */
export const API_BASE = resolveApiBase();

const TOKEN_KEY = "atlasvpn_access_token";

export function apiUrl(path: string): string {
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  const p = path.startsWith("/") ? path : `/${path}`;
  return API_BASE ? `${API_BASE}${p}` : p;
}

export function getAccessToken(): string | null {
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setAccessToken(token: string | null): void {
  try {
    if (token) sessionStorage.setItem(TOKEN_KEY, token);
    else sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

export function bearerHeaders(): Record<string, string> {
  const t = getAccessToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

function mergeHeaders(init?: RequestInit): Headers {
  const h = new Headers(init?.headers as HeadersInit | undefined);
  if (!h.has("Content-Type") && init?.body != null && init.body !== "") {
    h.set("Content-Type", "application/json");
  }
  const t = getAccessToken();
  if (t) h.set("Authorization", `Bearer ${t}`);
  return h;
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const cross = Boolean(API_BASE);
  const r = await fetch(apiUrl(path), {
    ...init,
    credentials: cross ? "omit" : "include",
    headers: mergeHeaders(init),
  });
  const data = (await r.json().catch(() => ({}))) as {
    message?: string;
    ok?: boolean;
    detail?: string | { msg: string }[];
  };
  if (r.status === 401) {
    window.dispatchEvent(new CustomEvent("atlasvpn-unauthorized"));
  }
  if (!r.ok) {
    let msg = data.message;
    if (!msg && typeof data.detail === "string") msg = data.detail;
    if (!msg && Array.isArray(data.detail) && data.detail[0] && typeof data.detail[0].msg === "string")
      msg = data.detail[0].msg;
    throw new Error(msg || r.statusText);
  }
  return data as T;
}
