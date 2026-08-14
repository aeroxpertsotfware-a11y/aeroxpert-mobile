import { NativeModules, Platform } from "react-native";

export type DJIFlightLogSourceApp = "DJI_FLY" | "DJI_GO_4" | "DJI_PILOT_2";

export type DJIFlightLogKnownSource = {
  sourceApp: DJIFlightLogSourceApp;
  label: string;
  paths: string[];
  persistedUri?: string | null;
  baseDir?: string;
};

export type DJIFlightLogScannedFile = {
  id: string;
  sourceApp: DJIFlightLogSourceApp;
  sourceLabel?: string;
  name: string;
  uri: string;
  path?: string;
  mimeType?: string;
  size: number;
  lastModified: number;
  ext?: string;
  accessMode?: "direct" | "tree";
};

export type DJIFlightLogScannedLocation = {
  sourceApp: DJIFlightLogSourceApp;
  label: string;
  path: string;
  accessMode: "direct" | "tree";
  exists: boolean;
  readable: boolean;
  configured: boolean;
  persistedUri?: string | null;
};

type NativeDJIFlightLogSyncModule = {
  getKnownSources: () => Promise<DJIFlightLogKnownSource[]>;
  scanFlightLogs: () => Promise<{
    files: DJIFlightLogScannedFile[];
    locations: DJIFlightLogScannedLocation[];
  }>;
  pickFolder: (sourceApp: DJIFlightLogSourceApp) => Promise<{
    granted: boolean;
    sourceApp: DJIFlightLogSourceApp;
    uri?: string;
  }>;
  pickLogs: (sourceApp: DJIFlightLogSourceApp) => Promise<{
    canceled: boolean;
    assets: Array<{
      uri: string;
      name: string;
      mimeType?: string;
      size?: number;
    }>;
  }>;
  clearFolderAccess: (sourceApp: DJIFlightLogSourceApp) => Promise<boolean>;
};

const nativeModule = NativeModules.DjiFlightLogSync as NativeDJIFlightLogSyncModule | undefined;

export const DJIFlightLogSync = {
  isAvailable: Platform.OS === "android" && !!nativeModule,
  getKnownSources: () => nativeModule?.getKnownSources?.() ?? Promise.resolve([]),
  scanFlightLogs: () =>
    nativeModule?.scanFlightLogs?.() ?? Promise.resolve({ files: [], locations: [] }),
  pickFolder: (sourceApp: DJIFlightLogSourceApp) =>
    nativeModule?.pickFolder?.(sourceApp) ??
      Promise.resolve({ granted: false, sourceApp }),
  pickLogs: (sourceApp: DJIFlightLogSourceApp) =>
    nativeModule?.pickLogs?.(sourceApp) ??
    Promise.resolve({ canceled: true, assets: [] }),
  clearFolderAccess: (sourceApp: DJIFlightLogSourceApp) =>
    nativeModule?.clearFolderAccess?.(sourceApp) ?? Promise.resolve(false),
};
