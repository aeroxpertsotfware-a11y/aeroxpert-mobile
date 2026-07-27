// src/screens/BateriaDetalleScreen.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";

import * as SecureStore from "expo-secure-store";
import { apiPost } from "../config/api"; 

const SECURE_TOKEN_KEY = "uas_token_v1";

async function getToken() {
  return (await SecureStore.getItemAsync(SECURE_TOKEN_KEY)) || "";
}

const FONT = {
  regular: "Nunito_400Regular",
  semibold: "Nunito_600SemiBold",
  bold: "Nunito_700Bold",
  extrabold: "Nunito_800ExtraBold",
  black: "Nunito_900Black",
} as const;

export default function BateriaDetalleScreen({ route, navigation }: any) {
  const bateriaInicial = route?.params?.bateria;

  const [bateria, setBateria] = useState<any>(bateriaInicial);

  const [modal, setModal] = useState(false);
  const [delta, setDelta] = useState("1");
  const [saving, setSaving] = useState(false);

  const ciclosActuales = useMemo(() => Number(bateria?.ciclos ?? 0), [bateria]);
  const maxCiclos = useMemo(() => Number(bateria?.maxCiclos ?? 200), [bateria]);
  const estado = bateria?.estado || "Activa";

  const openRegistrar = () => {
    setDelta("1");
    setModal(true);
  };

  const guardarDelta = async () => {
    const d = Number(String(delta).trim());

    if (!Number.isFinite(d) || d < 1) {
      Alert.alert("Ciclos", "Ingresa un número válido (mínimo 1).");
      return;
    }

    if (!bateria?._id) {
      Alert.alert("Error", "No hay ID de batería.");
      return;
    }

    setSaving(true);

    try {
      const token = await getToken();
      const updated = await apiPost<any>(
        `/baterias/${bateria._id}/add-cycles`,
        { delta: d },
        token
      );

      setBateria(updated);

      setModal(false);

      Alert.alert(" Listo", `Se sumaron ${d} ciclo(s).`);
    } catch (e: any) {
      Alert.alert("Error", e?.message || "No se pudieron registrar los ciclos");
    } finally {
      setSaving(false);
    }
  };

  if (!bateria) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>No hay batería para mostrar</Text>
        <Pressable style={styles.btnPrimary} onPress={() => navigation.goBack()}>
          <Text style={styles.btnPrimaryText}>Volver</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <Text style={styles.h1}>{bateria.nombre}</Text>
        <Text style={styles.sub}>Estado: {estado}</Text>
      </View>

      {/* BODY */}
      <ScrollView contentContainerStyle={styles.body}>
        <Card>
          <Row label="Marca" value={bateria.marca} />
          <Row label="Modelo" value={bateria.modelo} />
          <Row label="Serial" value={bateria.serial} />
          <Row label="Ciclos" value={`${ciclosActuales}`} />
          <Row label="Máx Ciclos" value={`${maxCiclos}`} />
          <Row label="Token QR" value={bateria.qrToken} />
        </Card>

        {/* ✅ BOTÓN REGISTRAR */}
        <Pressable style={styles.btnPrimary} onPress={openRegistrar}>
          <Text style={styles.btnPrimaryText}>Registrar ciclos</Text>
        </Pressable>

        {/* VOLVER */}
        <Pressable style={styles.btnGhost} onPress={() => navigation.goBack()}>
          <Text style={styles.btnGhostText}>Volver</Text>
        </Pressable>
      </ScrollView>

      {/* ✅ MODAL */}
      <Modal visible={modal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Registrar ciclos</Text>

              <Text style={styles.modalSub}>
                Ciclos actuales:{" "}
                <Text style={{ fontFamily: FONT.black }}>{ciclosActuales}</Text>
              </Text>

              <Text style={styles.modalHint}>¿Cuántos ciclos quieres sumar?</Text>

              <TextInput
                value={delta}
                onChangeText={setDelta}
                keyboardType="number-pad"
                style={styles.input}
              />

              <View style={styles.modalRow}>
                <Pressable
                  style={[styles.modalBtn, styles.modalCancel]}
                  onPress={() => setModal(false)}
                  disabled={saving}
                >
                  <Text style={styles.modalCancelText}>Cancelar</Text>
                </Pressable>

                <Pressable
                  style={[styles.modalBtn, styles.modalSave]}
                  onPress={guardarDelta}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator />
                  ) : (
                    <Text style={styles.modalSaveText}>Guardar</Text>
                  )}
                </Pressable>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}

/* COMPONENTES UI */
function Card({ children }: any) {
  return <View style={styles.card}>{children}</View>;
}

function Row({ label, value }: { label: string; value?: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value ?? "-"}</Text>
    </View>
  );
}

/* ESTILOS */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },

  header: {
    paddingTop: 50,
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: "#0b2f5f",
  },
  h1: { color: "#fff", fontSize: 20, fontFamily: FONT.black },
  sub: { color: "rgba(255,255,255,0.8)", marginTop: 6, fontFamily: FONT.regular },

  body: { padding: 16, gap: 14 },

  card: {
    padding: 12,
    borderRadius: 16,
    backgroundColor: "#f3f6fb",
    borderWidth: 1,
    borderColor: "rgba(11,47,95,0.12)",
    gap: 10,
  },

  row: {},
  label: { fontSize: 12, fontFamily: FONT.extrabold, color: "#0b2f5f" },
  value: { fontSize: 14, color: "#111", fontFamily: FONT.regular },

  btnPrimary: {
    height: 52,
    borderRadius: 14,
    backgroundColor: "#02c2f1",
    alignItems: "center",
    justifyContent: "center",
  },
  btnPrimaryText: { fontFamily: FONT.black, color: "#0b2f5f", fontSize: 15 },

  btnGhost: {
    height: 48,
    borderRadius: 14,
    backgroundColor: "rgba(2,194,241,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  btnGhostText: { fontFamily: FONT.black, color: "#0b2f5f" },

  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 16, fontFamily: FONT.black },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  modalCard: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 16,
    backgroundColor: "#fff",
    padding: 16,
  },
  modalTitle: { fontSize: 18, fontFamily: FONT.black },
  modalSub: { marginTop: 8, color: "#333", fontFamily: FONT.regular },
  modalHint: { marginTop: 10, color: "#444", fontFamily: FONT.regular },

  input: {
    marginTop: 10,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#ddd",
    paddingHorizontal: 12,
  },

  modalRow: { flexDirection: "row", gap: 12, marginTop: 14 },

  modalBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  modalCancel: { backgroundColor: "#f2f2f2" },
  modalCancelText: { fontFamily: FONT.black },

  modalSave: { backgroundColor: "#02c2f1" },
  modalSaveText: { fontFamily: FONT.black, color: "#0b2f5f" },
});
