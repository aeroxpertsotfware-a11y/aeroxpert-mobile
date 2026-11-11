// src/screens/QrScanScreen.tsx
import React, { useEffect, useState, useCallback, useRef } from "react";
import { View, Text, Pressable, StyleSheet, Alert, ActivityIndicator } from "react-native";
import { CameraView, useCameraPermissions, BarcodeScanningResult } from "expo-camera";
import { Ionicons } from "@expo/vector-icons";
import * as SecureStore from "expo-secure-store";
import { apiGet, apiPost } from "../config/api";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import { isNetInfoStateOnline } from "../offline/net";
import { enqueueOfflineAction } from "../offline/fieldSync";

const SECURE_TOKEN_KEY = "uas_token_v1";
const QR_CACHE_KEY = "uas_qr_equipment_cache_v1";

async function getToken() {
  return (await SecureStore.getItemAsync(SECURE_TOKEN_KEY)) || "";
}

function extractBatteryToken(raw: string) {
  const s = (raw || "").trim();
  if (!s) return "";
  return s.replace(/^bat[:\-]\s*/i, "").trim();
}

function looksLikeToken(t: string) {
  return /^[a-f0-9]{32}$/i.test(t);
}

type Props = { navigation: any; route?: { params?: { missionId?: string; operationContext?: boolean } } };

const FONT = {
  regular: "Nunito_400Regular",
  semibold: "Nunito_600SemiBold",
  bold: "Nunito_700Bold",
  extrabold: "Nunito_800ExtraBold",
} as const;

export default function QrScanScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();

  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [loading, setLoading] = useState(false);

  const navLock = useRef(false);

  useEffect(() => {
    if (!permission) return;
    if (!permission.granted) requestPermission();
  }, [permission, requestPermission]);

  const onBarcodeScanned = useCallback(
    async (result: BarcodeScanningResult) => {
      if (navLock.current) return;
      if (scanned || loading) return;

      const raw = (result.data || "").trim();
      const tokenQR = extractBatteryToken(raw);

      if (!tokenQR) return;

      if (!looksLikeToken(tokenQR)) {
        setScanned(true);
        Alert.alert("QR", `Token inválido:\n${raw}`);
        setTimeout(() => setScanned(false), 1200);
        return;
      }

      setScanned(true);
      setLoading(true);

      try {
        const auth = await getToken();

        // ✅ usa el endpoint directo
        let bateria: any;
        const net = await NetInfo.fetch();
        const online = isNetInfoStateOnline(net);
        try {
          if (!online) throw new Error("offline");
          bateria = await apiGet<any>(`/baterias/by-token/${tokenQR}`, auth);
          const rawCache = await AsyncStorage.getItem(QR_CACHE_KEY);
          const cache = rawCache ? JSON.parse(rawCache) : {};
          cache[tokenQR] = { data: bateria, cachedAt: new Date().toISOString() };
          await AsyncStorage.setItem(QR_CACHE_KEY, JSON.stringify(cache));
        } catch (networkError) {
          const rawCache = await AsyncStorage.getItem(QR_CACHE_KEY);
          const cache = rawCache ? JSON.parse(rawCache) : {};
          bateria = cache?.[tokenQR]?.data;
          if (!bateria) throw networkError;
          bateria = { ...bateria, offlineCache: true };
        }

        const missionId = String(route?.params?.missionId || "").trim();
        if (missionId && route?.params?.operationContext) {
          const endpoint = `/api/misiones/${missionId}/flujo-operacion/leer-qr`;
          const body = { qrToken: tokenQR, bateriaId: bateria?._id || null, contexto: "OPERACION" };
          if (online) {
            await apiPost(endpoint, body, auth);
          } else {
            await enqueueOfflineAction({
              category: "operation",
              missionId,
              endpoint,
              method: "POST",
              body,
            });
          }
        }

        navLock.current = true;

        // ✅ reemplaza para que el scanner no quede “atrás” vivo
        navigation.replace("BateriaDetalle", { bateria });
      } catch (e: any) {
        console.log("Error QR:", e?.message);
        Alert.alert("QR", e?.message || "Error leyendo QR");
        navLock.current = false;
        setTimeout(() => setScanned(false), 1200);
      } finally {
        setLoading(false);
      }
    },
    [scanned, loading, navigation, route?.params?.missionId, route?.params?.operationContext]
  );

  // ✅ Pantalla de permiso profesional
      if (!permission || !permission.granted) {
        return (
          <View style={styles.permissionScreen}>
            <StatusBar style="dark" />

            <Ionicons name="camera-outline" size={54} color="#0b2f5f" />

            <Text style={styles.permissionTitle}>Permiso de cámara</Text>

            <Text style={styles.permissionText}>
              Necesitamos acceso a la cámara para escanear códigos QR de las baterías y equipos.
            </Text>

            <Pressable style={styles.permissionBtn} onPress={requestPermission}>
              <Text style={styles.permissionBtnText}>Continuar</Text>
            </Pressable>
          </View>
        );
      }


  return (
    <View style={styles.container}>
      {/* ✅ Barra superior transparente (sin azul) */}
      <StatusBar style="light" translucent backgroundColor="transparent" />

      {/* ✅ desmonta cámara cuando ya escaneó: evita “doble cámara” */}
      {!scanned && (
        <CameraView
          style={StyleSheet.absoluteFillObject}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
          onBarcodeScanned={onBarcodeScanned}
        />
      )}

      <View style={[styles.overlay, { paddingTop: insets.top + 14 }]}>
        <Text style={styles.title}>Escanea tu QR</Text>
        <Text style={styles.subtitle}>Alinea el código dentro del recuadro</Text>

        <View style={styles.frame} />

        {loading ? (
          <View style={{ alignItems: "center", paddingBottom: 24 }}>
            <ActivityIndicator color="#fff" />
            <Text style={{ color: "#fff", marginTop: 8, fontFamily: FONT.semibold }}>Buscando batería…</Text>
          </View>
        ) : (
          <View style={styles.bottomRow}>
            <Pressable
              style={[styles.btn, { opacity: scanned ? 1 : 0.6 }]}
              onPress={() => {
                navLock.current = false;
                setScanned(false);
              }}
              disabled={!scanned}
            >
              <Text style={styles.btnText}>Escanear otra vez</Text>
            </Pressable>

            <Pressable style={[styles.btn, styles.btnGhost]} onPress={() => navigation.goBack()}>
              <Text style={[styles.btnText, { color: "#111" }]}>Volver</Text>
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },

  // ✅ quitamos paddingTop fijo (ahora depende del safe area)
  overlay: { flex: 1, paddingHorizontal: 18, justifyContent: "space-between" },

  title: { color: "#fff", fontSize: 18, fontFamily: FONT.bold },
  subtitle: { color: "rgba(255,255,255,0.85)", marginTop: 6, fontFamily: FONT.regular },

  frame: {
    alignSelf: "center",
    width: 260,
    height: 260,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.9)",
    borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.15)",
  },

  bottomRow: { flexDirection: "row", gap: 12, paddingBottom: 24 },

  btn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    backgroundColor: "#02c2f1",
    alignItems: "center",
    justifyContent: "center",
  },
  btnGhost: { backgroundColor: "rgba(255,255,255,0.85)" },
  btnText: { fontFamily: FONT.bold, color: "#0b2f5f" },

  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 18 },
  text: { marginTop: 10, textAlign: "center", fontFamily: FONT.regular },

  permissionScreen: {
  flex: 1,
  backgroundColor: "#f4f7fb",
  alignItems: "center",
  justifyContent: "center",
  padding: 24,
},

permissionTitle: {
  marginTop: 16,
  fontSize: 20,
  fontFamily: FONT.extrabold,
  color: "#0b2f5f",
},

permissionText: {
  marginTop: 10,
  textAlign: "center",
  fontSize: 14,
  fontFamily: FONT.regular,
  color: "#334",
  paddingHorizontal: 10,
},

permissionBtn: {
  marginTop: 22,
  height: 48,
  paddingHorizontal: 28,
  borderRadius: 14,
  backgroundColor: "#02c2f1",
  alignItems: "center",
  justifyContent: "center",
},

permissionBtnText: {
  fontFamily: FONT.extrabold,
  color: "#0b2f5f",
},

});
