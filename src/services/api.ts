// src/services/api.ts
import * as SecureStore from "expo-secure-store";
import { API_URL } from "../config/api";

const SECURE_TOKEN_KEY = "uas_token_v1";

async function getToken() {
  return (await SecureStore.getItemAsync(SECURE_TOKEN_KEY)) || "";
}

function safeJsonParse(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function withTimeout<T>(promise: Promise<T>, ms = 12000): Promise<T> {
  return new Promise((resolve, reject) => {
    const id = setTimeout(() => reject(new Error("Timeout: servidor no respondió")), ms);
    promise
      .then((res) => {
        clearTimeout(id);
        resolve(res);
      })
      .catch((err) => {
        clearTimeout(id);
        reject(err);
      });
  });
}

type ApiOpts = RequestInit & {
  auth?: boolean;          // default true
  tokenOverride?: string;  // si quieres usar token directo (ej: recién logueado)
};

export async function apiFetch<T>(path: string, opts: ApiOpts = { auth: true }): Promise<T> {
  const url = `${API_URL}${path}`;

  const headers: Record<string, string> = {
    Accept: "application/json",
    ...(opts.body ? { "Content-Type": "application/json" } : {}),
    ...(opts.headers as any),
  };

  if (opts.auth !== false) {
    const token = opts.tokenOverride || (await getToken());
    if (!token) throw new Error("No autorizado (sin token). Inicia sesión otra vez.");
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await withTimeout(fetch(url, { ...opts, headers }), 12000);

  const text = await res.text();
  const data = text ? safeJsonParse(text) : null;

  if (!res.ok) {
    const msg = (data && (data.message || data.error)) || `Error ${res.status} en ${path}`;
    throw new Error(msg);
  }

  return (data ?? ({} as any)) as T;
}

// ✅ helpers que te faltaban (apiPost/apiGet/apiPatch)
export function apiGet<T>(path: string, tokenOverride?: string) {
  return apiFetch<T>(path, { method: "GET", auth: true, tokenOverride });
}

export function apiPost<T>(path: string, body: any, tokenOverride?: string) {
  return apiFetch<T>(path, {
    method: "POST",
    auth: true,
    tokenOverride,
    body: JSON.stringify(body),
  });
}

export function apiPatch<T>(path: string, body: any, tokenOverride?: string) {
  return apiFetch<T>(path, {
    method: "PATCH",
    auth: true,
    tokenOverride,
    body: JSON.stringify(body),
  });
}

export function apiDelete<T>(path: string, tokenOverride?: string) {
  return apiFetch<T>(path, { method: "DELETE", auth: true, tokenOverride });
}

type ApiUploadOpts = {
  auth?: boolean;
  tokenOverride?: string;
  timeoutMs?: number;
};

export async function apiUploadForm<T>(
  path: string,
  formData: FormData,
  opts: ApiUploadOpts = { auth: true }
): Promise<T> {
  if (!API_URL) throw new Error("Falta configurar EXPO_PUBLIC_API_BASE_URL");

  const headers: Record<string, string> = {
    Accept: "application/json",
  };

  if (opts.auth !== false) {
    const token = opts.tokenOverride || (await getToken());
    if (!token) throw new Error("No autorizado (sin token). Inicia sesión otra vez.");
    headers.Authorization = `Bearer ${token}`;
  }

  const url = `${API_URL}${path}`;
  const res = await withTimeout(
    fetch(url, {
      method: "POST",
      headers,
      body: formData,
    }),
    opts.timeoutMs ?? 30000
  );

  const text = await res.text();
  const data = text ? safeJsonParse(text) : null;

  if (!res.ok) {
    const msg = (data && (data.message || data.error)) || `Error ${res.status} en ${path}`;
    throw new Error(msg);
  }

  return (data ?? ({} as any)) as T;
}
