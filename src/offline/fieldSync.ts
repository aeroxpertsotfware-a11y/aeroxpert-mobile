import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { Directory, File, Paths } from "expo-file-system";
import { API_URL } from "../config/api";

const QUEUE_KEY = "uas_field_offline_queue_v1";
const TOKEN_KEY = "uas_token_v1";

export type OfflineFile = {
  field: string;
  uri: string;
  name: string;
  mimeType: string;
};

export type OfflineAction = {
  id: string;
  clientId: string;
  createdAt: string;
  category: "procedure" | "operation" | "evidence" | "mission" | "novelty" | "briefing";
  missionId?: string;
  endpoint: string;
  method: "POST" | "PATCH" | "PUT";
  body?: Record<string, any>;
  files?: OfflineFile[];
  attempts: number;
  lastError?: string;
};

const makeId = () => `offline_${Date.now()}_${Math.random().toString(16).slice(2)}`;

const normalizeUrl = (endpoint: string) => {
  const base = String(API_URL || "").replace(/\/+$/, "");
  const clean = `/${String(endpoint || "").replace(/^\/+/, "")}`;
  if (base.endsWith("/api") && clean.startsWith("/api/")) return `${base}${clean.slice(4)}`;
  return `${base}${clean}`;
};

export async function getOfflineActions(): Promise<OfflineAction[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function saveOfflineActions(actions: OfflineAction[]) {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(actions));
}

export async function persistOfflineFiles(
  files: Array<{ uri: string; name: string; mimeType?: string | null }>,
  field = "evidencias"
): Promise<OfflineFile[]> {
  const directory = new Directory(Paths.document, "offline-field-files");
  directory.create({ idempotent: true, intermediates: true });
  return files.map((item, index) => {
    const safeName = String(item.name || `archivo_${index}`)
      .replace(/[^\w.\-]+/g, "_")
      .slice(-100);
    const target = new File(directory, `${Date.now()}_${index}_${safeName}`);
    new File(item.uri).copy(target);
    return {
      field,
      uri: target.uri,
      name: safeName,
      mimeType: item.mimeType || "application/octet-stream",
    };
  });
}

export async function enqueueOfflineAction(
  input: Omit<OfflineAction, "id" | "clientId" | "createdAt" | "attempts">
) {
  const actions = await getOfflineActions();
  const id = makeId();
  actions.push({
    ...input,
    id,
    clientId: id,
    createdAt: new Date().toISOString(),
    attempts: 0,
  });
  await saveOfflineActions(actions);
  return id;
}

function deletePersistedFiles(files?: OfflineFile[]) {
  for (const item of files || []) {
    try {
      const file = new File(item.uri);
      if (file.exists) file.delete();
    } catch {}
  }
}

export async function syncOfflineActions(): Promise<{
  sent: number;
  pending: number;
  errors: string[];
}> {
  const token = String(await SecureStore.getItemAsync(TOKEN_KEY) || "").trim();
  const actions = await getOfflineActions();
  if (!token || !actions.length) return { sent: 0, pending: actions.length, errors: [] };

  const remaining: OfflineAction[] = [];
  const errors: string[] = [];
  let sent = 0;

  for (const action of actions) {
    try {
      let body: BodyInit | undefined;
      const headers: Record<string, string> = {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        "X-Offline-Client-Id": action.clientId,
      };
      if (action.files?.length) {
        const form = new FormData();
        Object.entries(action.body || {}).forEach(([key, value]) => {
          form.append(key, typeof value === "string" ? value : JSON.stringify(value));
        });
        form.append("clientId", action.clientId);
        form.append("offlineCreatedAt", action.createdAt);
        action.files.forEach((item) => {
          form.append(item.field, {
            uri: item.uri,
            name: item.name,
            type: item.mimeType,
          } as any);
        });
        body = form;
      } else {
        headers["Content-Type"] = "application/json";
        body = JSON.stringify({
          ...(action.body || {}),
          clientId: action.clientId,
          offlineCreatedAt: action.createdAt,
        });
      }

      const response = await fetch(normalizeUrl(action.endpoint), {
        method: action.method,
        headers,
        body,
      });
      const raw = await response.text();
      let data: any = {};
      try { data = raw ? JSON.parse(raw) : {}; } catch { data = {}; }
      if (!response.ok && response.status !== 409) {
        throw new Error(data?.message || `Error HTTP ${response.status}`);
      }
      sent += 1;
      deletePersistedFiles(action.files);
    } catch (error: any) {
      const lastError = error?.message || "No se pudo sincronizar";
      remaining.push({ ...action, attempts: action.attempts + 1, lastError });
      errors.push(lastError);
      // Preserve ordering for dependent field actions.
      const index = actions.indexOf(action);
      remaining.push(...actions.slice(index + 1));
      break;
    }
  }

  await saveOfflineActions(remaining);
  return { sent, pending: remaining.length, errors };
}
