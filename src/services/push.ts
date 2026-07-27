// src/services/push.ts
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { apiPost } from "./api"; // ✅ MISMA carpeta: src/services/api.ts

export async function registerPushToken(jwt: string) {
  try {
    if (!Device.isDevice) {
      console.log("⚠️ Push: solo en dispositivo físico (no emulador).");
      return;
    }

    if (Device.osName?.toLowerCase() === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "default",
        importance: Notifications.AndroidImportance.MAX,
        sound: "default",
        vibrationPattern: [0, 250, 250, 250],
      });
    }

    // 1) permisos
    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;

    if (existing !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") {
      console.log("❌ Push: permisos NO otorgados");
      return;
    }

    // 2) projectId (importante en SDK nuevos)
    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ||
      Constants?.easConfig?.projectId;

    console.log("🔎 Push projectId:", projectId || "(no projectId)");

    // 3) token real
    const expoToken = (
      await Notifications.getExpoPushTokenAsync(
        projectId ? ({ projectId } as any) : (undefined as any)
      )
    ).data;

    console.log("✅ Expo Push Token REAL:", expoToken);

    // 4) registrar en backend
    const resp = await apiPost(
      "/push/register", // ✅ tu apiPost agrega /api automáticamente
      { token: expoToken, platform: Device.osName?.toLowerCase() || "android" },
      jwt
    );

    console.log("✅ push/register resp:", resp);
    return resp;
  } catch (e: any) {
    console.log("❌ Error registerPushToken:", e?.message || e);
    throw e;
  }
}
