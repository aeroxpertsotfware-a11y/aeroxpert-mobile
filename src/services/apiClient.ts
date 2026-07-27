import * as SecureStore from "expo-secure-store";

const SECURE_TOKEN_KEY = "uas_token_v1";
const SECURE_DOC_KEY = "uas_doc_v1";

type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: any;
  token?: string | null;
  timeoutMs?: number;
  headers?: Record<string, string>;
};

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

export async function getStoredToken() {
  return SecureStore.getItemAsync(SECURE_TOKEN_KEY);
}

export async function getStoredDoc() {
  return SecureStore.getItemAsync(SECURE_DOC_KEY);
}

export async function clearStoredAuth() {
  await SecureStore.deleteItemAsync(SECURE_TOKEN_KEY);
  await SecureStore.deleteItemAsync(SECURE_DOC_KEY);
}

export async function apiRequest<T>(
  baseUrl: string,
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const method = options.method || "GET";
  const timeoutMs = options.timeoutMs ?? 12000;

  const token = options.token ?? (await getStoredToken());

  const headers: Record<string, string> = {
    Accept: "application/json",
    ...(options.body ? { "Content-Type": "application/json" } : {}),
    ...(options.headers || {}),
  };

  if (token) headers.Authorization = `Bearer ${token}`;

  const url = `${baseUrl}${path}`;

  const res = await withTimeout(
    fetch(url, {
      method,
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    }),
    timeoutMs
  );

  const raw = await res.text();
  let data: any = {};
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    data = { raw };
  }

  if (!res.ok) {
    const msg = data?.message || data?.msg || data?.raw || `Error HTTP ${res.status}`;
    const err: any = new Error(msg);
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data as T;
}
