// src/config/api.ts
const DEFAULT_API_BASE_URL = "https://backend-uas-production.up.railway.app";

export const API_BASE = (process.env.EXPO_PUBLIC_API_BASE_URL || DEFAULT_API_BASE_URL).trim();
export const API_URL = API_BASE.replace(/\/+$/, "");

const DEFAULT_TIMEOUT_MS = 12000;

function normalizePath(path: string) {
  const p = path.startsWith("/") ? path : `/${path}`;
  return p.startsWith("/api/") ? p : `/api${p}`;
}

async function safeReadText(res: Response) {
  try {
    return await res.text();
  } catch {
    return "";
  }
}

function buildError(res: Response, text: string) {
  const snippet = (text || "").slice(0, 200).trim();
  return new Error(`${res.status} ${res.statusText}${snippet ? ` - ${snippet}` : ""}`);
}

async function handleResponse<T>(res: Response): Promise<T> {
  const text = await safeReadText(res);

  if (!res.ok) throw buildError(res, text);

  if (!text) return {} as T;

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`Respuesta no es JSON: ${text.slice(0, 200)}`);
  }
}

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

function ensureApiUrl() {
  if (!API_URL) {
    throw new Error("Falta configurar EXPO_PUBLIC_API_BASE_URL");
  }
}

export async function apiGet<T>(path: string, token?: string, timeoutMs?: number): Promise<T> {
  ensureApiUrl();
  const url = `${API_URL}${normalizePath(path)}`;
  console.log("[API GET]", url);

  try {
    const res = await fetchWithTimeout(
      url,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      },
      timeoutMs ?? DEFAULT_TIMEOUT_MS
    );

    return handleResponse<T>(res);
  } catch (e: any) {
    if (e?.name === "AbortError") {
      throw new Error(`Timeout (${timeoutMs ?? DEFAULT_TIMEOUT_MS}ms). Revisa la conexión con el servidor.`);
    }
    throw e;
  }
}

export async function apiPost<T>(path: string, body: any, token?: string, timeoutMs?: number): Promise<T> {
  ensureApiUrl();
  const url = `${API_URL}${normalizePath(path)}`;
  console.log("[API POST]", url);

  try {
    const res = await fetchWithTimeout(
      url,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
      },
      timeoutMs ?? DEFAULT_TIMEOUT_MS
    );

    return handleResponse<T>(res);
  } catch (e: any) {
    if (e?.name === "AbortError") {
      throw new Error(`Timeout (${timeoutMs ?? DEFAULT_TIMEOUT_MS}ms). Revisa la conexión con el servidor.`);
    }
    throw e;
  }
}

export async function apiPatch<T>(path: string, body: any, token?: string): Promise<T> {
  ensureApiUrl();
  const url = `${API_URL}${normalizePath(path)}`;
  console.log("[API PATCH]", url);

  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });

  return handleResponse<T>(res);
}

export async function apiPut<T>(path: string, body: any, token?: string): Promise<T> {
  ensureApiUrl();
  const url = `${API_URL}${normalizePath(path)}`;
  const res = await fetchWithTimeout(url, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  return handleResponse<T>(res);
}
