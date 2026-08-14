import { NativeModules, Platform } from "react-native";

export type BroadcastDeviceInfo = {
  manufacturer: string;
  brand: string;
  model: string;
  product: string;
  deviceName: string;
  isRcPlus: boolean;
  androidApi: number;
};

export type BroadcastStatus = {
  state: "idle" | "connecting" | "live" | "reconnecting" | "stopping" | "error";
  detail: string;
  bitrate: number;
  isStreaming: boolean;
  sessionId?: string;
};

const native = NativeModules.ScreenBroadcast;

function requireNative() {
  if (Platform.OS !== "android" || !native) {
    throw new Error("La transmisión de pantalla requiere la versión Android instalada en un DJI RC Plus.");
  }
  return native;
}

export const screenBroadcast = {
  getDeviceInfo: (): Promise<BroadcastDeviceInfo> => requireNative().getDeviceInfo(),
  getStatus: (): Promise<BroadcastStatus> => requireNative().getStatus(),
  start: (rtmpUrl: string, title: string, sessionId: string): Promise<boolean> => requireNative().start(rtmpUrl, title, sessionId),
  stop: (): Promise<boolean> => requireNative().stop(),
};
