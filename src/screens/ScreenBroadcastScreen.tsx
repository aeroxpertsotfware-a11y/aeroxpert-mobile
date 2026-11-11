import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, PermissionsAndroid, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { apiPost } from "../config/api";
import { BroadcastDeviceInfo, BroadcastStatus, screenBroadcast } from "../native/screenBroadcast";

type Props = { navigation: any; token: string };
const INITIAL_STATUS: BroadcastStatus = { state: "idle", detail: "", bitrate: 0, isStreaming: false };
const FONT = {
  regular: "Nunito_400Regular",
  semi: "Nunito_600SemiBold",
  bold: "Nunito_700Bold",
};

function readableError(error: any) {
  const text = String(error?.message || error || "No fue posible completar la operación.");
  const jsonStart = text.indexOf("{");
  if (jsonStart >= 0) {
    try { return JSON.parse(text.slice(jsonStart))?.message || text; } catch {}
  }
  return text;
}

export default function ScreenBroadcastScreen({ navigation, token }: Props) {
  const insets = useSafeAreaInsets();
  const [device, setDevice] = useState<BroadcastDeviceInfo | null>(null);
  const [status, setStatus] = useState<BroadcastStatus>(INITIAL_STATUS);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [deviceInfo, currentStatus] = await Promise.all([screenBroadcast.getDeviceInfo(), screenBroadcast.getStatus()]);
      setDevice(deviceInfo);
      setStatus(currentStatus);
    } catch (e) {
      setError(readableError(e));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const timer = setInterval(() => screenBroadcast.getStatus().then(setStatus).catch(() => {}), 1000);
    return () => clearInterval(timer);
  }, []);

  const start = async () => {
    if (!device?.isSupportedController) {
      Alert.alert("Control no compatible", "Instala y abre S-GO en un DJI RC Plus o RC Pro Enterprise.");
      return;
    }
    setBusy(true);
    let createdSessionId = "";
    try {
      if (Platform.OS === "android") {
        const audioPermission = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          {
            title: "Audio de la transmisiÃ³n",
            message: "AeroXpert necesita acceso al micrófono para transmitir la pantalla del control.",
            buttonPositive: "Permitir",
            buttonNegative: "Cancelar",
          },
        );
        if (audioPermission !== PermissionsAndroid.RESULTS.GRANTED) {
          throw new Error("Debes permitir el micrÃ³fono para iniciar la transmisiÃ³n de pantalla.");
        }
      }
      const response = await apiPost<{ credentials: { sessionId: string; rtmpUrl: string; titulo: string }; viewerUrl: string }>("/media/mobile/start", { device }, token);
      createdSessionId = response.credentials.sessionId;
      await screenBroadcast.start(response.credentials.rtmpUrl, response.credentials.titulo, response.credentials.sessionId);
      setStatus(await screenBroadcast.getStatus());
      Alert.alert("Captura iniciada", "Ahora abre DJI Pilot 2. S-GO continuará transmitiendo todo lo que aparezca en la pantalla.");
    } catch (e) {
      if (createdSessionId) apiPost(`/media/mobile/sessions/${createdSessionId}/stop`, {}, token).catch(() => {});
      Alert.alert("No se pudo transmitir", readableError(e));
    } finally {
      setBusy(false);
    }
  };

  const stop = async () => {
    setBusy(true);
    try {
      const sessionId = status.sessionId;
      await screenBroadcast.stop();
      if (sessionId) await apiPost(`/media/mobile/sessions/${sessionId}/stop`, {}, token).catch(() => {});
      setStatus(INITIAL_STATUS);
    } catch (e) {
      Alert.alert("No se pudo detener", readableError(e));
    } finally {
      setBusy(false);
    }
  };

  const isLive = status.isStreaming;
  const supportedController = !!device?.isSupportedController;
  const disabled = busy || (!isLive && !supportedController);

  return (
    <View style={styles.safe}>
      <StatusBar style="light" backgroundColor="#0d437c" />
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Pressable style={styles.back} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={22} color="#fff" />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>CENTRO DE CONTROL</Text>
          <Text style={styles.title}>Transmitir pantalla</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={styles.loading}><ActivityIndicator size="large" color="#0ea5e9" /><Text style={styles.muted}>Preparando transmisión...</Text></View>
        ) : (
          <>
            <View style={styles.introCard}>
              <LinearGradient colors={["#16b8d4", "#0785a8"]} style={styles.introIcon}><MaterialCommunityIcons name="broadcast" size={28} color="#fff" /></LinearGradient>
              <View style={styles.flex}><Text style={styles.introTitle}>Emisión operacional en vivo</Text><Text style={styles.introText}>Comparte la pantalla del control DJI con el centro de control de forma privada.</Text></View>
            </View>

            <View style={[styles.deviceCard, supportedController ? styles.deviceOk : styles.deviceBlocked]}>
              <View style={[styles.deviceIcon, supportedController ? styles.deviceIconOk : styles.deviceIconBlocked]}><MaterialCommunityIcons name="remote" size={25} color={supportedController ? "#07865f" : "#a56500"} /></View>
              <View style={styles.flex}><Text style={styles.cardTitle}>{device?.isRcProEnterprise ? "DJI RC Pro Enterprise detectado" : device?.isRcPlus ? "DJI RC Plus detectado" : "Control no compatible"}</Text><Text style={styles.muted}>{device ? `${device.manufacturer} ${device.model}`.trim() : "Sin información del dispositivo"}</Text></View>
              <Ionicons name={supportedController ? "checkmark-circle" : "alert-circle"} size={24} color={supportedController ? "#07865f" : "#a56500"} />
            </View>

            {error ? <View style={styles.error}><Ionicons name="alert-circle" size={18} color="#b4232b" /><Text style={styles.errorText}>{error}</Text></View> : null}

            <View style={styles.guideCard}>
              <Text style={styles.sectionEyebrow}>CÓMO FUNCIONA</Text><Text style={styles.sectionTitle}>Transmisión automática</Text>
              {["Inicia la transmisión y acepta el permiso de captura de Android.", "Abre DJI Pilot 2 y continúa la operación normalmente.", "El jefe de pilotos recibirá un enlace privado para verla."].map((text, index) => (
                <View key={text} style={styles.guideStep}><View style={styles.stepNumber}><Text style={styles.stepNumberText}>{index + 1}</Text></View><Text style={styles.guideText}>{text}</Text></View>
              ))}
            </View>

            <View style={[styles.statusCard, isLive && styles.statusCardLive]}>
              <View style={styles.statusIcon}><View style={[styles.liveDot, isLive && styles.liveDotActive]} /></View>
              <View style={styles.flex}><Text style={styles.cardTitle}>{status.state === "live" ? "EN VIVO" : status.state === "connecting" ? "Conectando…" : status.state === "reconnecting" ? "Reconectando…" : status.state === "error" ? "Error de transmisión" : "Lista para transmitir"}</Text><Text style={styles.muted}>{status.state === "live" ? `Pantalla en vivo · ${Math.round(status.bitrate / 1000)} kbps` : status.detail || "La captura continuará al abrir DJI Pilot 2"}</Text></View>
            </View>

            <Pressable disabled={disabled} onPress={isLive ? stop : start}>
              <LinearGradient colors={disabled ? ["#e2e8ec", "#d7e0e5"] : isLive ? ["#dc2626", "#b91c1c"] : ["#0d437c", "#0799c1"]} style={[styles.primary, disabled && styles.disabled]}>
                {busy ? <ActivityIndicator color={disabled ? "#64748b" : "#fff"} /> : <MaterialCommunityIcons name={isLive ? "stop-circle-outline" : "broadcast"} size={21} color={disabled ? "#64748b" : "#fff"} />}
                <Text style={[styles.primaryText, disabled && styles.primaryTextDisabled]}>{isLive ? "Detener transmisión" : !supportedController ? "Control no compatible" : "Transmitir pantalla"}</Text>
              </LinearGradient>
            </Pressable>

            <View style={styles.noticeCard}><Ionicons name="shield-checkmark-outline" size={19} color="#64748b" /><Text style={styles.notice}>La transmisión es privada y solo estará disponible durante la sesión operacional.</Text></View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f3f5f7" },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingBottom: 18, backgroundColor: "#0d437c", borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  back: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.14)", borderWidth: 1, borderColor: "rgba(255,255,255,0.2)" },
  headerCopy: { flex: 1, justifyContent: "center", minHeight: 44 },
  eyebrow: { fontFamily: FONT.semi, color: "#bdeeff", fontSize: 10, letterSpacing: 1.1 },
  title: { fontFamily: FONT.semi, color: "#fff", fontSize: 20, marginTop: 1 },
  content: { padding: 16, paddingBottom: 42, gap: 12 },
  loading: { minHeight: 320, alignItems: "center", justifyContent: "center", gap: 12 },
  flex: { flex: 1 },
  introCard: { flexDirection: "row", alignItems: "center", gap: 13, padding: 16, borderRadius: 22, backgroundColor: "#fff", shadowColor: "#0f172a", shadowOpacity: .08, shadowRadius: 16, shadowOffset: { width: 0, height: 7 }, elevation: 3 },
  introIcon: { width: 54, height: 54, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  introTitle: { fontFamily: FONT.semi, color: "#1b2b3a", fontSize: 16 },
  introText: { fontFamily: FONT.regular, color: "#64748b", fontSize: 12, lineHeight: 17, marginTop: 3 },
  deviceCard: { flexDirection: "row", gap: 12, alignItems: "center", padding: 14, borderRadius: 19, borderWidth: 1 },
  deviceOk: { backgroundColor: "#edf9f3", borderColor: "#b8e3cf" },
  deviceBlocked: { backgroundColor: "#fff8e9", borderColor: "#f2d49b" },
  deviceIcon: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  deviceIconOk: { backgroundColor: "#d8f3e6" },
  deviceIconBlocked: { backgroundColor: "#ffedc6" },
  cardTitle: { fontFamily: FONT.semi, color: "#1b2b3a", fontSize: 14 },
  muted: { fontFamily: FONT.regular, color: "#687b8e", fontSize: 12, lineHeight: 17, marginTop: 2 },
  guideCard: { padding: 17, borderRadius: 22, backgroundColor: "#fff", shadowColor: "#0f172a", shadowOpacity: .06, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 2 },
  sectionEyebrow: { fontFamily: FONT.semi, color: "#0d6f9f", fontSize: 10, letterSpacing: 1 },
  sectionTitle: { fontFamily: FONT.semi, color: "#1b2b3a", fontSize: 16, marginTop: 2, marginBottom: 12 },
  guideStep: { flexDirection: "row", alignItems: "center", gap: 11, marginBottom: 10 },
  stepNumber: { width: 28, height: 28, borderRadius: 10, backgroundColor: "#e7f8fb", alignItems: "center", justifyContent: "center" },
  stepNumberText: { fontFamily: FONT.semi, color: "#0785a8", fontSize: 12 },
  guideText: { flex: 1, fontFamily: FONT.regular, color: "#475569", fontSize: 12, lineHeight: 17 },
  statusCard: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#fff", padding: 15, borderRadius: 19, borderWidth: 1, borderColor: "#e2e8f0" },
  statusCardLive: { borderColor: "#fecaca", backgroundColor: "#fff7f7" },
  statusIcon: { width: 38, height: 38, borderRadius: 13, backgroundColor: "#f1f5f9", alignItems: "center", justifyContent: "center" },
  liveDot: { width: 11, height: 11, borderRadius: 6, backgroundColor: "#94a3b8" },
  liveDotActive: { backgroundColor: "#dc2626" },
  primary: { minHeight: 56, borderRadius: 18, flexDirection: "row", gap: 10, alignItems: "center", justifyContent: "center", shadowColor: "#0785a8", shadowOpacity: .22, shadowRadius: 14, shadowOffset: { width: 0, height: 7 }, elevation: 4 },
  primaryText: { fontFamily: FONT.semi, color: "#fff", fontSize: 14 },
  primaryTextDisabled: { color: "#64748b" },
  disabled: { shadowOpacity: 0, elevation: 0 },
  noticeCard: { flexDirection: "row", alignItems: "flex-start", gap: 9, paddingHorizontal: 12, paddingVertical: 10 },
  notice: { flex: 1, fontFamily: FONT.regular, color: "#64748b", fontSize: 11, lineHeight: 16 },
  error: { flexDirection: "row", alignItems: "center", gap: 8, padding: 13, borderRadius: 15, backgroundColor: "#fff0f0", borderWidth: 1, borderColor: "#ffc5c5" },
  errorText: { flex: 1, color: "#a82029", fontFamily: FONT.semi, fontSize: 12 },
});
