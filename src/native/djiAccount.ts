import { NativeModules, Platform } from "react-native";

export type DJIAccountState =
  | "NOT_LOGGED_IN"
  | "NOT_AUTHORIZED"
  | "AUTHORIZED"
  | "TOKEN_OUT_OF_DATE"
  | "UNKNOWN";

export type DJIAccountStatus = {
  available: boolean;
  loggedIn: boolean;
  state: DJIAccountState | string;
  accountName?: string;
  message?: string;
};

type NativeDJIAccountModule = {
  getStatus: () => Promise<DJIAccountStatus>;
  login: () => Promise<DJIAccountStatus>;
  logout: () => Promise<DJIAccountStatus>;
};

const nativeModule = NativeModules.DjiAccount as NativeDJIAccountModule | undefined;

const unavailableStatus: DJIAccountStatus = {
  available: false,
  loggedIn: false,
  state: "UNKNOWN",
  message: "El login oficial de DJI solo está disponible en Android.",
};

export const DJIAccount = {
  isAvailable: Platform.OS === "android" && !!nativeModule,
  getStatus: () => nativeModule?.getStatus?.() ?? Promise.resolve(unavailableStatus),
  login: () => nativeModule?.login?.() ?? Promise.resolve(unavailableStatus),
  logout: () => nativeModule?.logout?.() ?? Promise.resolve(unavailableStatus),
};
