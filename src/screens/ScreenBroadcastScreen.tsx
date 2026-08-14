import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { apiPost } from "../config/api";
import { BroadcastDeviceInfo, BroadcastStatus, screenBroadcast } from "../native/screenBroadcast";

type Props = { navigation: any; token: string };
const INITIAL_STATUS: BroadcastStatus = { state: "idle", detail: "", bitrate: 0, isStreaming: false };

function readableError(error: any) {
  const text = String(error?.message || error || "No fue posible completar la operación.");
  const jsonStart = text.indexOf("{");
  if (jsonStart >= 0) {
    try { return JSON.parse(text.slice(jsonStart))?.message || text; } catch {}
  }
  return text;
}

export default function ScreenBroadcastScreen({ navigation, token }: Props) {
  const [device, setDevice] = useState<BroadcastDeviceInfo | null>(null);
  const [status, setStatus] = useState<BroadcastStatus>(INITIAL_STATUS);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [deviceInfo, currentStatus] = await Promise.all([
        screenBroadcast.getDeviceInfo(),
        screenBroadcast.getStatus(),
      ]);
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
    if (!device?.isRcPlus) {
      Alert.alert("DJI RC Plus requerido", "Instala y abre S-GO directamente en el control DJI RC Plus.");
      return;
    }
    setBusy(true);
    let createdSessionId = "";
    try {
      const response = await apiPost<{
        credentials: { sessionId: string; rtmpUrl: string; titulo: string };
        viewerUrl: string;
      }>(
        "/media/mobile/start",
        { device },
        token,
      );
      createdSessionId = response.credentials.sessionId;
      await screenBroadcast.start(
        response.credentials.rtmpUrl,
        response.credentials.titulo,
        response.credentials.sessionId,
      );
      setStatus(await screenBroadcast.getStatus());
      Alert.alert(
        "Captura iniciada",
        "Ahora abre DJI Pilot 2. S-GO continuará transmitiendo todo lo que aparezca en la pantalla.",
      );
    } catch (e) {
      if (createdSessionId) {
        apiPost(`/media/mobile/sessions/${createdSessionId}/stop`, {}, token).catch(() => {});
      }
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
      if (sessionId) {
        await apiPost(`/media/mobile/sessions/${sessionId}/stop`, {}, token).catch(() => {});
      }
      setStatus(INITIAL_STATUS);
    } catch (e) {
      Alert.alert("No se pudo detener", readableError(e));
    } finally {
      setBusy(false);
    }
  };

  const isLive = status.isStreaming;
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable style={styles.back} onPress={() => navigation.goBack()}><Ionicons name="arrow-back" size={22} color="#062d50" /></Pressable>
        <View><Text style={styles.eyebrow}>CENTRO DE CONTROL</Text><Text style={styles.title}>Transmitir pantalla</Text></View>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        {loading ? <ActivityIndicator size="large" color="#0598bf" /> : (
          <>
            <View style={[styles.deviceCard, device?.isRcPlus ? styles.deviceOk : styles.deviceBlocked]}>
              <MaterialCommunityIcons name="remote" size={30} color={device?.isRcPlus ? "#07865f" : "#a56500"} />
              <View style={styles.flex}>
                <Text style={styles.cardTitle}>{device?.isRcPlus ? "DJI RC Plus detectado" : "Control no compatible"}</Text>
                <Text style={styles.muted}>{device ? `${device.manufacturer} ${device.model}`.trim() : "Sin información del dispositivo"}</Text>
              </View>
              <Ionicons name={device?.isRcPlus ? "checkmark-circle" : "alert-circle"} size={24} color={device?.isRcPlus ? "#07865f" : "#a56500"} />
            </View>

            {error ? <View style={styles.error}><Text style={styles.errorText}>{error}</Text></View> : null}

            <View style={styles.empty}>
              <Text style={styles.cardTitle}>Transmisión automática</Text>
              <Text style={styles.muted}>Al iniciar, S-GO creará la sesión y enviará al jefe de pilotos un enlace privado para verla a pantalla completa.</Text>
            </View>

            <View style={styles.statusCard}>
              <View style={[styles.liveDot, isLive && styles.liveDotActive]} />
              <View style={styles.flex}>
                <Text style={styles.cardTitle}>{status.state === "live" ? "EN VIVO" : status.state === "connecting" ? "Conectando…" : status.state === "reconnecting" ? "Reconectando…" : "Lista para transmitir"}</Text>
                <Text style={styles.muted}>{status.detail || (isLive ? `${Math.round(status.bitrate / 1000)} kbps` : "La captura continuará al abrir DJI Pilot 2")}</Text>
              </View>
            </View>

            <Pressable style={[styles.primary, (busy || (!isLive && !device?.isRcPlus)) && styles.disabled]} disabled={busy || (!isLive && !device?.isRcPlus)} onPress={isLive ? stop : start}>
              {busy ? <ActivityIndicator color="#fff" /> : <MaterialCommunityIcons name={isLive ? "stop-circle-outline" : "broadcast"} size={22} color="#fff" />}
              <Text style={styles.primaryText}>{isLive ? "Detener transmisión" : "Transmitir pantalla"}</Text>
            </Pressable>
            <Text style={styles.notice}>Android mostrará una autorización de captura. Después de aceptarla, abre DJI Pilot 2 y opera normalmente.</Text>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f7fafc" },
  header: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 18, paddingVertical: 16, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#dce6ef" },
  back: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", backgroundColor: "#eef4f8" },
  eyebrow: { fontFamily: "Nunito_800ExtraBold", color: "#078db6", fontSize: 11, letterSpacing: 1.2 },
  title: { fontFamily: "Nunito_800ExtraBold", color: "#041f3b", fontSize: 24 },
  content: { padding: 18, paddingBottom: 40, gap: 13 },
  flex: { flex: 1 },
  deviceCard: { flexDirection: "row", gap: 12, alignItems: "center", padding: 16, borderRadius: 18, borderWidth: 1 },
  deviceOk: { backgroundColor: "#edfbf5", borderColor: "#a9e3cc" },
  deviceBlocked: { backgroundColor: "#fff8e9", borderColor: "#f2d49b" },
  cardTitle: { fontFamily: "Nunito_700Bold", color: "#062d50", fontSize: 16 },
  muted: { fontFamily: "Nunito_400Regular", color: "#687b8e", fontSize: 13, marginTop: 2 },
  label: { fontFamily: "Nunito_800ExtraBold", color: "#526a82", fontSize: 12, letterSpacing: .8, marginTop: 8 },
  session: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#fff", borderRadius: 16, padding: 15, borderWidth: 1, borderColor: "#d8e3ed" },
  sessionSelected: { borderColor: "#0799c1", backgroundColor: "#f1fbfe" },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: "#9aabba" },
  radioSelected: { borderWidth: 5, borderColor: "#0799c1" },
  statusCard: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#fff", padding: 16, borderRadius: 16, borderWidth: 1, borderColor: "#d8e3ed", marginTop: 6 },
  liveDot: { width: 13, height: 13, borderRadius: 7, backgroundColor: "#9aacbb" },
  liveDotActive: { backgroundColor: "#e12631" },
  primary: { minHeight: 56, borderRadius: 16, backgroundColor: "#0799c1", flexDirection: "row", gap: 10, alignItems: "center", justifyContent: "center" },
  primaryText: { fontFamily: "Nunito_800ExtraBold", color: "#fff", fontSize: 16 },
  disabled: { opacity: .45 },
  notice: { fontFamily: "Nunito_400Regular", color: "#65798d", fontSize: 13, lineHeight: 19, textAlign: "center", paddingHorizontal: 10 },
  empty: { padding: 18, borderRadius: 16, backgroundColor: "#fff", borderWidth: 1, borderColor: "#d8e3ed" },
  error: { padding: 14, borderRadius: 14, backgroundColor: "#fff0f0", borderWidth: 1, borderColor: "#ffc5c5" },
  errorText: { color: "#a82029", fontFamily: "Nunito_600SemiBold" },
});
