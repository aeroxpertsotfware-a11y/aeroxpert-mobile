import { NativeEventEmitter, NativeModules, Platform } from "react-native";

export type DJITelemetryPayload = {
  timestamp?: number;
  lat?: number;
  lng?: number;
  altitude?: number;
  batteryPercent?: number;
  speed?: number;
};

export type DJIStatusPayload = {
  status: string;
  message?: string;
  timestamp?: number;
};

type DJITelemetryNativeModule = {
  startTelemetry: () => Promise<boolean>;
  stopTelemetry: () => Promise<boolean>;
};

const nativeModule = NativeModules.DjiTelemetry as DJITelemetryNativeModule | undefined;
const emitter = nativeModule ? new NativeEventEmitter(nativeModule as any) : null;

export const DJITelemetry = {
  isAvailable: Platform.OS === "android" && !!nativeModule,
  start: () => nativeModule?.startTelemetry?.() ?? Promise.resolve(false),
  stop: () => nativeModule?.stopTelemetry?.() ?? Promise.resolve(false),
  onTelemetry: (handler: (payload: DJITelemetryPayload) => void) =>
    emitter?.addListener("DJI_TELEMETRY", handler) ?? { remove: () => undefined },
  onStatus: (handler: (payload: DJIStatusPayload) => void) =>
    emitter?.addListener("DJI_STATUS", handler) ?? { remove: () => undefined },
};
