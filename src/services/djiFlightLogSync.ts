import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  DJIFlightLogScannedFile,
  DJIFlightLogSourceApp,
} from "../native/djiFlightLogSync";

export type DJIDirectSyncSettings = {
  enabled: boolean;
  lastScanAt?: string | null;
  lastSuccessAt?: string | null;
  lastError?: string | null;
};

export type DJIDirectSyncSnapshot = {
  knownFingerprints: string[];
  lastUploads: Array<{
    id: string;
    name: string;
    sourceApp: DJIFlightLogSourceApp;
    uploadedAt: string;
  }>;
};

const SETTINGS_KEY = "dji_direct_sync_settings_v1";
const SNAPSHOT_KEY = "dji_direct_sync_snapshot_v1";
const MAX_HISTORY = 60;
const MAX_FINGERPRINTS = 4000;

export async function getDJIDirectSyncSettings(): Promise<DJIDirectSyncSettings> {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    if (!raw) return { enabled: false };
    const parsed = JSON.parse(raw);
    return {
      enabled: !!parsed?.enabled,
      lastScanAt: parsed?.lastScanAt || null,
      lastSuccessAt: parsed?.lastSuccessAt || null,
      lastError: parsed?.lastError || null,
    };
  } catch {
    return { enabled: false };
  }
}

export async function saveDJIDirectSyncSettings(
  patch: Partial<DJIDirectSyncSettings>
): Promise<DJIDirectSyncSettings> {
  const current = await getDJIDirectSyncSettings();
  const next = {
    ...current,
    ...patch,
  };
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
  return next;
}

export async function getDJIDirectSyncSnapshot(): Promise<DJIDirectSyncSnapshot> {
  try {
    const raw = await AsyncStorage.getItem(SNAPSHOT_KEY);
    if (!raw) return { knownFingerprints: [], lastUploads: [] };
    const parsed = JSON.parse(raw);
    return {
      knownFingerprints: Array.isArray(parsed?.knownFingerprints) ? parsed.knownFingerprints : [],
      lastUploads: Array.isArray(parsed?.lastUploads) ? parsed.lastUploads : [],
    };
  } catch {
    return { knownFingerprints: [], lastUploads: [] };
  }
}

export async function markDJIFlightLogsUploaded(
  files: DJIFlightLogScannedFile[]
): Promise<DJIDirectSyncSnapshot> {
  const snapshot = await getDJIDirectSyncSnapshot();
  const known = new Set(snapshot.knownFingerprints);
  const uploads = [...snapshot.lastUploads];
  const now = new Date().toISOString();

  for (const file of files) {
    known.add(file.id);
    uploads.unshift({
      id: file.id,
      name: file.name,
      sourceApp: file.sourceApp,
      uploadedAt: now,
    });
  }

  const next: DJIDirectSyncSnapshot = {
    knownFingerprints: Array.from(known).slice(-MAX_FINGERPRINTS),
    lastUploads: uploads.slice(0, MAX_HISTORY),
  };

  await AsyncStorage.setItem(SNAPSHOT_KEY, JSON.stringify(next));
  return next;
}

export async function getPendingDJIFlightLogs(
  files: DJIFlightLogScannedFile[]
): Promise<DJIFlightLogScannedFile[]> {
  const snapshot = await getDJIDirectSyncSnapshot();
  const known = new Set(snapshot.knownFingerprints);
  return files.filter((file) => !known.has(file.id));
}
