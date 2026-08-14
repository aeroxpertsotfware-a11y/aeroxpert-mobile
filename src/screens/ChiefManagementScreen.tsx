import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as SecureStore from "expo-secure-store";
import { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { apiGet, apiPost, apiPut } from "../config/api";

const TOKEN_KEY = "uas_token_v1";

type ModuleKey =
  | "planning" | "execution" | "control" | "records"
  | "uas" | "eta" | "battery-qr"
  | "hours" | "maintenance"
  | "personnel" | "departments" | "log-requests" | "availability"
  | "sms" | "repository" | "minutes";

type ModuleDefinition = {
  key: ModuleKey;
  label: string;
  description: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  endpoint: string;
  group: string;
};

const MODULES: ModuleDefinition[] = [
  { key: "planning", label: "Planificación", description: "Misiones programadas y pendientes de aprobación", icon: "map-marker-path", endpoint: "/misiones", group: "Gestión Operaciones" },
  { key: "execution", label: "Ejecución", description: "Seguimiento de operaciones asignadas", icon: "map-marker-distance", endpoint: "/misiones", group: "Gestión Operaciones" },
  { key: "control", label: "Centro Control OPS", description: "Estado operacional y trazabilidad", icon: "access-point", endpoint: "/misiones", group: "Gestión Operaciones" },
  { key: "records", label: "Registros", description: "Registros operacionales de la empresa", icon: "map-marker", endpoint: "/misiones", group: "Gestión Operaciones" },
  { key: "uas", label: "UAS", description: "Aeronaves y estado de aeronavegabilidad", icon: "airplane", endpoint: "/equipos", group: "Gestión Equipos" },
  { key: "eta", label: "ETA", description: "Equipos tecnológicos asociados", icon: "camera", endpoint: "/eta", group: "Gestión Equipos" },
  { key: "battery-qr", label: "Generar QR Baterías", description: "Baterías, seriales, ciclos y códigos QR", icon: "qrcode", endpoint: "/baterias", group: "Gestión Equipos" },
  { key: "hours", label: "Control Horas", description: "Horas y ciclos acumulados por aeronave", icon: "gauge", endpoint: "/equipos", group: "Mantenimiento" },
  { key: "maintenance", label: "Bitácora Mantenimiento", description: "Historial preventivo y correctivo", icon: "clipboard-text-outline", endpoint: "/equipos/mantenimiento/bitacora", group: "Mantenimiento" },
  { key: "personnel", label: "Usuarios", description: "Carnés, perfiles y certificados del personal", icon: "account-group-outline", endpoint: "/usuarios", group: "Gestión de Personal" },
  { key: "departments", label: "Departamentos", description: "Áreas y responsables de la empresa", icon: "office-building", endpoint: "/departamentos", group: "Gestión de Personal" },
  { key: "log-requests", label: "Solicitudes de Bitácora", description: "Solicitudes pendientes de revisión", icon: "file-sign", endpoint: "/bitacoras-vuelo/solicitudes", group: "Gestión de Personal" },
  { key: "availability", label: "Control Disponibilidad", description: "Disponibilidad operacional del personal", icon: "bed", endpoint: "/control-disponibilidad", group: "Gestión de Personal" },
  { key: "sms", label: "Reportes SMS", description: "Reportes de seguridad operacional", icon: "alert-outline", endpoint: "/reportes", group: "Seguridad Operacional" },
  { key: "repository", label: "Repositorio Documental", description: "Documentos vigentes de la organización", icon: "folder", endpoint: "/documentos", group: "Gestión Documental" },
  { key: "minutes", label: "Actas y Reportes", description: "Actas del comité y reportes de entrenamiento", icon: "file-clock-outline", endpoint: "/actas-comite-seguridad", group: "Gestión Documental" },
];

function extractRows(value: any): any[] {
  if (Array.isArray(value)) return value;
  for (const key of ["data", "items", "rows", "misiones", "equipos", "usuarios", "reportes", "documentos", "solicitudes"]) {
    if (Array.isArray(value?.[key])) return value[key];
  }
  return [];
}

function firstText(row: any, keys: string[], fallback: string) {
  for (const key of keys) {
    const value = row?.[key];
    if (value !== undefined && value !== null && String(value).trim()) return String(value).trim();
  }
  return fallback;
}

function rowLabels(module: ModuleKey, row: any) {
  if (["planning", "execution", "control", "records"].includes(module)) {
    return {
      title: firstText(row, ["consecutivo", "titulo", "nombre"], "Misión"),
      subtitle: firstText(row, ["ubicacionGeneral", "tipoOperacion", "fechaOperacion"], "Sin ubicación"),
      status: firstText(row, ["estado"], "Programada"),
    };
  }
  if (module === "uas" || module === "hours") {
    return {
      title: firstText(row, ["modelo", "ruas", "serie"], "Aeronave UAS"),
      subtitle: `Serie: ${firstText(row, ["serie", "numeroSerie"], "—")} · ${firstText(row, ["horasVuelo"], "0")} h`,
      status: firstText(row, ["estado"], "Sin estado"),
    };
  }
  if (module === "eta") {
    return {
      title: firstText(row, ["tipoEquipo", "modelo", "marca"], "Equipo ETA"),
      subtitle: `${firstText(row, ["marca"], "—")} · Serie ${firstText(row, ["numeroSerie"], "—")}`,
      status: firstText(row, ["numeroRegistro", "estado"], "Registrado"),
    };
  }
  if (module === "battery-qr") {
    return {
      title: firstText(row, ["serial", "numeroSerie", "nombre"], "Batería"),
      subtitle: `${firstText(row, ["ciclos", "ciclosVuelo"], "0")} ciclos · ${firstText(row, ["minutosVuelo"], "0")} min`,
      status: firstText(row, ["estado"], "Disponible"),
    };
  }
  if (module === "personnel" || module === "availability") {
    return {
      title: firstText(row, ["nombre", "usuarioNombre"], "Integrante"),
      subtitle: firstText(row, ["email", "documento", "rol"], "Sin información adicional"),
      status: firstText(row, ["estadoDisponibilidad", "estado", "rolActivo", "rol"], "Activo"),
    };
  }
  return {
    title: firstText(row, ["nombre", "titulo", "tipo", "consecutivo", "numeroActa"], "Registro"),
    subtitle: firstText(row, ["descripcion", "mensaje", "fecha", "createdAt"], "Sin descripción"),
    status: firstText(row, ["estado", "tipoDocumento", "categoria"], "Registrado"),
  };
}

export default function ChiefManagementScreen({
  navigation,
  embedded = false,
  onNavigate,
}: {
  navigation?: any;
  embedded?: boolean;
  onNavigate?: (section: string, moduleKey?: ModuleKey) => void;
}) {
  const [selected, setSelected] = useState<ModuleDefinition | null>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [savingUser, setSavingUser] = useState(false);
  const [userForm, setUserForm] = useState({
    nombre: "",
    documento: "",
    email: "",
    telefono: "",
    cipu: "",
    rol: "piloto",
    fechaCertificado: "",
    activo: true,
  });

  const loadModule = useCallback(async (module: ModuleDefinition) => {
    setLoading(true);
    setError("");
    try {
      const token = String(await SecureStore.getItemAsync(TOKEN_KEY) || "");
      const response = await apiGet<any>(module.endpoint, token, 18000);
      setRows(extractRows(response));
    } catch (e: any) {
      setRows([]);
      setError(e?.message || "No se pudo cargar la información.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selected) loadModule(selected);
  }, [loadModule, selected]);

  const filteredRows = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return rows;
    return rows.filter((row) => JSON.stringify(row).toLowerCase().includes(normalized));
  }, [query, rows]);

  const openUserDocument = useCallback(async (document: any, label: string) => {
    const key = String(document?.key || "").trim();
    if (!key) {
      Alert.alert("Documento no disponible", `${label} no está cargado para este usuario.`);
      return;
    }
    try {
      const token = String(await SecureStore.getItemAsync(TOKEN_KEY) || "");
      const response = await apiPost<{ url?: string }>("/usuarios/adjuntos/url", { key }, token);
      if (!response?.url) throw new Error("No se recibió una URL de descarga.");
      await Linking.openURL(response.url);
    } catch (e: any) {
      Alert.alert("No se pudo descargar", e?.message || `No se pudo descargar ${label}.`);
    }
  }, []);

  const medicalStatus = useCallback((row: any) => {
    const raw = row?.documentosCampo?.certificadoMedico?.fechaVencimiento || row?.fechaCertificado;
    if (!raw) return { label: "Sin vigencia", color: "#92400e", background: "#fef3c7" };
    const expires = new Date(raw);
    if (Number.isNaN(expires.getTime())) return { label: "Por revisar", color: "#92400e", background: "#fef3c7" };
    if (expires.getTime() < Date.now()) return { label: "Vencido", color: "#b91c1c", background: "#fee2e2" };
    return { label: "Vigente", color: "#15803d", background: "#dcfce7" };
  }, []);

  const openEditUser = useCallback((row: any) => {
    setEditingUser(row);
    setUserForm({
      nombre: String(row?.nombre || ""),
      documento: String(row?.documento || ""),
      email: String(row?.email || ""),
      telefono: String(row?.telefono || ""),
      cipu: String(row?.cipu || ""),
      rol: String(row?.rol || "piloto"),
      fechaCertificado: String(row?.documentosCampo?.certificadoMedico?.fechaVencimiento || row?.fechaCertificado || "").slice(0, 10),
      activo: row?.activo !== false,
    });
  }, []);

  const saveEditedUser = useCallback(async () => {
    if (!editingUser?._id || !userForm.nombre.trim() || !userForm.documento.trim() || !userForm.email.trim()) {
      Alert.alert("Faltan datos", "Nombre, documento y correo son obligatorios.");
      return;
    }
    try {
      setSavingUser(true);
      const token = String(await SecureStore.getItemAsync(TOKEN_KEY) || "");
      await apiPut(`/usuarios/${editingUser._id}`, {
        nombre: userForm.nombre.trim(),
        documento: userForm.documento.trim(),
        email: userForm.email.trim().toLowerCase(),
        telefono: userForm.telefono.trim(),
        cipu: userForm.cipu.trim(),
        rol: userForm.rol,
        fechaCertificado: userForm.fechaCertificado || null,
        documentosCampo: {
          ...(editingUser?.documentosCampo || {}),
          certificadoMedico: editingUser?.documentosCampo?.certificadoMedico
            ? {
                ...editingUser.documentosCampo.certificadoMedico,
                fechaVencimiento: userForm.fechaCertificado || null,
              }
            : editingUser?.documentosCampo?.certificadoMedico || null,
        },
        activo: userForm.activo,
      }, token);
      setEditingUser(null);
      if (selected) await loadModule(selected);
      Alert.alert("Usuario actualizado", "Los cambios quedaron guardados correctamente.");
    } catch (e: any) {
      Alert.alert("No se pudo actualizar", e?.message || "Intenta nuevamente.");
    } finally {
      setSavingUser(false);
    }
  }, [editingUser, loadModule, selected, userForm]);

  const openModule = useCallback((module: ModuleDefinition) => {
    if (embedded && onNavigate) {
      const existingSections: Partial<Record<ModuleKey, string>> = {
        planning: "missions",
        execution: "procedures",
        control: "ops-summary",
        records: "flight-log",
        uas: "equipos-uas",
        hours: "equipos-uas",
        sms: "my-reports",
      };
      const section = existingSections[module.key];
      if (section) {
        onNavigate(section, module.key);
        return;
      }
    }
    setSelected(module);
  }, [embedded, onNavigate]);

  if (!selected) {
    const groups = Array.from(new Set(MODULES.map((item) => item.group)));
    return (
      <SafeAreaView style={[styles.screen, embedded && styles.embeddedScreen]}>
        {!embedded ? (
          <View style={styles.header}>
            <Pressable style={styles.backButton} onPress={() => navigation?.goBack()}>
              <Ionicons name="arrow-back" size={21} color="#fff" />
            </Pressable>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerTitle}>Gestión jefe de pilotos</Text>
              <Text style={styles.headerSubtitle}>Operaciones y administración móvil</Text>
            </View>
          </View>
        ) : (
          <View style={styles.embeddedIntro}>
            <View style={styles.embeddedIntroIcon}>
              <MaterialCommunityIcons name="briefcase-outline" size={23} color="#111918" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.embeddedTitle}>Gestión jefe de pilotos</Text>
              <Text style={styles.embeddedSubtitle}>Selecciona el módulo que deseas administrar.</Text>
            </View>
          </View>
        )}
        <ScrollView
          scrollEnabled={!embedded}
          nestedScrollEnabled
          contentContainerStyle={[styles.menuContent, embedded && styles.embeddedContent]}
          showsVerticalScrollIndicator={false}
        >
          {groups.map((group) => (
            <View key={group} style={styles.group}>
              <Text style={styles.groupTitle}>{group}</Text>
              {MODULES.filter((item) => item.group === group).map((item) => (
                <Pressable key={item.key} style={styles.moduleCard} onPress={() => openModule(item)}>
                  <View style={styles.moduleIcon}>
                    <MaterialCommunityIcons name={item.icon} size={22} color="#111918" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.moduleTitle}>{item.label}</Text>
                    <Text style={styles.moduleDescription}>{item.description}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#8aa0b3" />
                </Pressable>
              ))}
            </View>
          ))}
          <View style={{ height: 24 }} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.screen, embedded && styles.embeddedScreen]}>
      <View style={embedded ? styles.embeddedModuleHeader : styles.header}>
        <Pressable style={styles.backButton} onPress={() => { setSelected(null); setRows([]); setQuery(""); }}>
          <Ionicons name="arrow-back" size={21} color={embedded ? "#111918" : "#fff"} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={embedded ? styles.embeddedTitle : styles.headerTitle}>{selected.label}</Text>
          <Text style={embedded ? styles.embeddedSubtitle : styles.headerSubtitle}>{selected.group}</Text>
        </View>
        <Pressable style={[styles.refreshButton, embedded && styles.embeddedRefresh]} onPress={() => loadModule(selected)}>
          <Ionicons name="refresh" size={20} color={embedded ? "#111918" : "#fff"} />
        </Pressable>
      </View>
      <View style={styles.searchWrap}>
        <Ionicons name="search" size={19} color="#7790a5" />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Buscar..."
          placeholderTextColor="#8da0b0"
          style={styles.searchInput}
        />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color="#0b5d8b" size="large" />
          <Text style={styles.centerText}>Cargando información...</Text>
        </View>
      ) : error ? (
        <View style={styles.emptyCard}>
          <MaterialCommunityIcons name="cloud-alert-outline" size={35} color="#d97706" />
          <Text style={styles.emptyTitle}>No fue posible cargar</Text>
          <Text style={styles.emptyText}>{error}</Text>
          <Pressable style={styles.retryButton} onPress={() => loadModule(selected)}>
            <Text style={styles.retryText}>Reintentar</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          scrollEnabled={!embedded}
          nestedScrollEnabled
          data={filteredRows}
          keyExtractor={(item, index) => String(item?._id || item?.id || index)}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={() => loadModule(selected)} tintColor="#0b5d8b" />}
          ListEmptyComponent={
            <View style={styles.emptyCard}>
              <MaterialCommunityIcons name={selected.icon} size={36} color="#7890a2" />
              <Text style={styles.emptyTitle}>Sin registros</Text>
              <Text style={styles.emptyText}>No hay información disponible para esta sección.</Text>
            </View>
          }
          renderItem={({ item }) => {
            if (selected.key === "personnel") {
              const medical = item?.documentosCampo?.certificadoMedico;
              const cipu = item?.documentosCampo?.cipu;
              const arl = item?.documentosCampo?.arl;
              const status = medicalStatus(item);
              const photo = String(item?.fotoUrl || item?.foto || "").trim();
              const initials = String(item?.nombre || "U")
                .split(/\s+/)
                .slice(0, 2)
                .map((part: string) => part.charAt(0).toUpperCase())
                .join("");
              return (
                <View style={styles.userCard}>
                  <View style={styles.userCardTop}>
                    <View style={styles.userPhotoWrap}>
                      {photo ? (
                        <Image source={{ uri: photo }} style={styles.userPhoto} />
                      ) : (
                        <Text style={styles.userInitials}>{initials || "U"}</Text>
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.userCardName}>{item?.nombre || "Usuario"}</Text>
                      <Text style={styles.userCardRole}>{String(item?.rolActivo || item?.rol || "Usuario").toUpperCase()}</Text>
                      <View style={[styles.userStatusChip, { backgroundColor: status.background }]}>
                        <Text style={[styles.userStatusText, { color: status.color }]}>Médico {status.label}</Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.userCardData}>
                    <View style={styles.userDataCell}>
                      <Text style={styles.userDataLabel}>Documento</Text>
                      <Text style={styles.userDataValue}>{item?.documento || "—"}</Text>
                    </View>
                    <View style={styles.userDataCell}>
                      <Text style={styles.userDataLabel}>CIPU</Text>
                      <Text style={styles.userDataValue}>{item?.cipu || "—"}</Text>
                    </View>
                    <View style={styles.userDataCell}>
                      <Text style={styles.userDataLabel}>Correo</Text>
                      <Text style={styles.userDataValue} numberOfLines={1}>{item?.email || "—"}</Text>
                    </View>
                    <View style={styles.userDataCell}>
                      <Text style={styles.userDataLabel}>Estado</Text>
                      <Text style={styles.userDataValue}>{item?.activo === false ? "Inactivo" : "Activo"}</Text>
                    </View>
                  </View>

                  <View style={styles.medicalCard}>
                    <Text style={styles.medicalTitle}>Certificado médico</Text>
                    <Text style={styles.medicalMeta}>Inicio: {String(medical?.fechaInicio || "—").slice(0, 10)}</Text>
                    <Text style={styles.medicalMeta}>Vencimiento: {String(medical?.fechaVencimiento || item?.fechaCertificado || "—").slice(0, 10)}</Text>
                    <Text style={styles.medicalMeta} numberOfLines={1}>Archivo: {medical?.name || "Sin archivo"}</Text>
                  </View>

                  <View style={styles.userDocumentActions}>
                    {([
                      [medical, "Certificado médico", "medical-bag"],
                      [cipu, "CIPU", "card-account-details-outline"],
                      [arl, "ARL", "shield-account-outline"],
                    ] as const).map(([document, label, icon]) => (
                      <Pressable
                        key={label}
                        style={[styles.userDocumentButton, !document?.key && styles.userDocumentButtonDisabled]}
                        disabled={!document?.key}
                        onPress={() => openUserDocument(document, label)}
                      >
                        <MaterialCommunityIcons name={icon} size={17} color={document?.key ? "#111918" : "#9aa7b2"} />
                        <Text style={[styles.userDocumentText, !document?.key && { color: "#9aa7b2" }]}>{label}</Text>
                        <Ionicons name="download-outline" size={16} color={document?.key ? "#111918" : "#9aa7b2"} />
                      </Pressable>
                    ))}
                    <Pressable style={styles.userEditButton} onPress={() => openEditUser(item)}>
                      <Ionicons name="create-outline" size={17} color="#ffffff" />
                      <Text style={styles.userEditButtonText}>Editar usuario</Text>
                    </Pressable>
                  </View>
                </View>
              );
            }
            const labels = rowLabels(selected.key, item);
            return (
              <View style={styles.dataCard}>
                <View style={styles.dataTop}>
                  <View style={[styles.moduleIcon, { marginRight: 11 }]}>
                    <MaterialCommunityIcons name={selected.icon} size={21} color="#111918" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.dataTitle}>{labels.title}</Text>
                    <Text style={styles.dataSubtitle}>{labels.subtitle}</Text>
                  </View>
                </View>
                <View style={styles.statusChip}>
                  <Text style={styles.statusText}>{labels.status}</Text>
                </View>
              </View>
            );
          }}
        />
      )}

      <Modal
        visible={!!editingUser}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => !savingUser && setEditingUser(null)}
      >
        <View style={styles.editOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.editKeyboard}>
            <View style={styles.editSheet}>
              <View style={styles.editHeader}>
                <View style={styles.editHeaderIcon}>
                  <Ionicons name="person-outline" size={21} color="#111918" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.editTitle}>Editar usuario</Text>
                  <Text style={styles.editSubtitle}>Información personal y operacional</Text>
                </View>
                <Pressable style={styles.editClose} onPress={() => !savingUser && setEditingUser(null)}>
                  <Ionicons name="close" size={21} color="#111918" />
                </Pressable>
              </View>
              <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={styles.editBody}>
                {([
                  ["nombre", "Nombre completo", "Nombre y apellidos"],
                  ["documento", "Documento", "Número de identificación"],
                  ["email", "Correo electrónico", "correo@empresa.com"],
                  ["telefono", "Teléfono", "Número de contacto"],
                  ["cipu", "CIPU", "Número CIPU"],
                ] as const).map(([field, label, placeholder]) => (
                  <View key={field} style={styles.editField}>
                    <Text style={styles.editLabel}>{label}</Text>
                    <TextInput
                      value={userForm[field]}
                      onChangeText={(value) => setUserForm((prev) => ({ ...prev, [field]: value }))}
                      style={styles.editInput}
                      placeholder={placeholder}
                      placeholderTextColor="#8da0b0"
                      autoCapitalize={field === "email" ? "none" : "sentences"}
                      keyboardType={field === "email" ? "email-address" : field === "telefono" ? "phone-pad" : "default"}
                    />
                  </View>
                ))}

                <Text style={styles.editLabel}>Rol principal</Text>
                <View style={styles.editChips}>
                  {[
                    ["piloto", "Piloto"],
                    ["jefepilotos", "Jefe de pilotos"],
                    ["instructor", "Instructor"],
                    ["gerentesms", "Gerente SMS"],
                  ].map(([value, label]) => (
                    <Pressable
                      key={value}
                      style={[styles.editChip, userForm.rol === value && styles.editChipActive]}
                      onPress={() => setUserForm((prev) => ({ ...prev, rol: value }))}
                    >
                      <Text style={[styles.editChipText, userForm.rol === value && styles.editChipTextActive]}>{label}</Text>
                    </Pressable>
                  ))}
                </View>

                <Text style={styles.editLabel}>Vencimiento certificado médico</Text>
                <Pressable
                  style={styles.editDate}
                  onPress={() => DateTimePickerAndroid.open({
                    value: userForm.fechaCertificado ? new Date(`${userForm.fechaCertificado}T12:00:00`) : new Date(),
                    mode: "date",
                    onChange: (event, date) => {
                      if (event.type === "dismissed" || !date) return;
                      const year = date.getFullYear();
                      const month = String(date.getMonth() + 1).padStart(2, "0");
                      const day = String(date.getDate()).padStart(2, "0");
                      setUserForm((prev) => ({ ...prev, fechaCertificado: `${year}-${month}-${day}` }));
                    },
                  })}
                >
                  <Text style={{ color: userForm.fechaCertificado ? "#172a3a" : "#8da0b0", fontFamily: FONT.regular }}>
                    {userForm.fechaCertificado || "Seleccionar fecha"}
                  </Text>
                  <Ionicons name="calendar-outline" size={18} color="#111918" />
                </Pressable>

                <Pressable
                  style={styles.activeToggleRow}
                  onPress={() => setUserForm((prev) => ({ ...prev, activo: !prev.activo }))}
                >
                  <View>
                    <Text style={styles.editLabel}>Usuario activo</Text>
                    <Text style={styles.editSubtitle}>{userForm.activo ? "Puede ingresar a la plataforma" : "Acceso deshabilitado"}</Text>
                  </View>
                  <View style={[styles.toggleTrack, userForm.activo && styles.toggleTrackActive]}>
                    <View style={[styles.toggleKnob, userForm.activo && styles.toggleKnobActive]} />
                  </View>
                </Pressable>

                <View style={styles.editActions}>
                  <Pressable style={styles.editCancel} disabled={savingUser} onPress={() => setEditingUser(null)}>
                    <Text style={styles.editCancelText}>Cancelar</Text>
                  </Pressable>
                  <Pressable style={[styles.editSave, savingUser && { opacity: 0.65 }]} disabled={savingUser} onPress={saveEditedUser}>
                    {savingUser ? <ActivityIndicator color="#fff" /> : <Ionicons name="save-outline" size={18} color="#fff" />}
                    <Text style={styles.editSaveText}>{savingUser ? "Guardando..." : "Guardar cambios"}</Text>
                  </Pressable>
                </View>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const FONT = {
  regular: "Nunito_400Regular",
  semi: "Nunito_600SemiBold",
  bold: "Nunito_700Bold",
  extra: "Nunito_800ExtraBold",
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f3f7fa" },
  embeddedScreen: { backgroundColor: "transparent" },
  embeddedContent: { paddingHorizontal: 0, paddingTop: 10 },
  embeddedIntro: {
    flexDirection: "row", alignItems: "center", padding: 15, borderRadius: 20,
    backgroundColor: "#fff", borderWidth: 1, borderColor: "#e1eaf0", marginTop: 4,
  },
  embeddedIntroIcon: {
    width: 44, height: 44, borderRadius: 14, marginRight: 12,
    backgroundColor: "#f1f3f4", alignItems: "center", justifyContent: "center",
  },
  embeddedTitle: { color: "#1b2b3a", fontSize: 16, fontFamily: FONT.bold },
  embeddedSubtitle: { color: "#708596", fontSize: 12, marginTop: 2, fontFamily: FONT.regular },
  embeddedModuleHeader: {
    minHeight: 70, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 20,
    backgroundColor: "#fff", borderWidth: 1, borderColor: "#e1eaf0",
    flexDirection: "row", alignItems: "center", marginTop: 4,
  },
  embeddedRefresh: { backgroundColor: "#f1f3f4" },
  header: {
    minHeight: 88, paddingHorizontal: 16, paddingTop: 18, paddingBottom: 14,
    backgroundColor: "#070b0d", flexDirection: "row", alignItems: "center",
  },
  backButton: {
    width: 40, height: 40, borderRadius: 13, marginRight: 12,
    alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,.13)",
  },
  refreshButton: {
    width: 40, height: 40, borderRadius: 13,
    alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,.13)",
  },
  headerTitle: { color: "#fff", fontSize: 18, fontFamily: FONT.bold },
  headerSubtitle: { color: "rgba(255,255,255,.72)", fontSize: 12, marginTop: 2, fontFamily: FONT.regular },
  menuContent: { padding: 15 },
  group: { marginBottom: 16 },
  groupTitle: { color: "#19364d", fontSize: 14, marginBottom: 8, fontFamily: FONT.extra },
  moduleCard: {
    minHeight: 70, padding: 13, marginBottom: 9, borderRadius: 18,
    backgroundColor: "#fff", flexDirection: "row", alignItems: "center",
    shadowColor: "#0b2f57", shadowOpacity: 0.07, shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 }, elevation: 2,
  },
  moduleIcon: {
    width: 42, height: 42, borderRadius: 14, marginRight: 12,
    backgroundColor: "#f1f3f4", alignItems: "center", justifyContent: "center",
  },
  moduleTitle: { color: "#132a3a", fontSize: 14, fontFamily: FONT.bold },
  moduleDescription: { color: "#6d8292", fontSize: 11.5, lineHeight: 16, marginTop: 2, fontFamily: FONT.regular },
  searchWrap: {
    height: 48, margin: 14, marginBottom: 4, paddingHorizontal: 14, borderRadius: 15,
    backgroundColor: "#fff", flexDirection: "row", alignItems: "center",
    borderWidth: 1, borderColor: "#dfe9f0",
  },
  searchInput: { flex: 1, height: "100%", marginLeft: 9, color: "#183247", fontFamily: FONT.regular },
  listContent: { padding: 14, paddingBottom: 32 },
  dataCard: {
    padding: 14, marginBottom: 10, borderRadius: 18, backgroundColor: "#fff",
    borderWidth: 1, borderColor: "#e1eaf0",
  },
  dataTop: { flexDirection: "row", alignItems: "center" },
  dataTitle: { color: "#132a3a", fontSize: 14, fontFamily: FONT.bold },
  dataSubtitle: { color: "#708596", fontSize: 12, lineHeight: 17, marginTop: 3, fontFamily: FONT.regular },
  statusChip: {
    alignSelf: "flex-start", marginTop: 11, paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 999, backgroundColor: "#e8f5fb",
  },
  statusText: { color: "#075985", fontSize: 10.5, fontFamily: FONT.bold },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  centerText: { color: "#6b8090", marginTop: 10, fontFamily: FONT.regular },
  emptyCard: {
    margin: 18, padding: 26, borderRadius: 20, backgroundColor: "#fff",
    alignItems: "center", borderWidth: 1, borderColor: "#e0e8ee",
  },
  emptyTitle: { color: "#1b3445", fontSize: 15, marginTop: 10, fontFamily: FONT.bold },
  emptyText: { color: "#708596", fontSize: 12, lineHeight: 17, textAlign: "center", marginTop: 5, fontFamily: FONT.regular },
  retryButton: { marginTop: 14, backgroundColor: "#0b5d8b", borderRadius: 13, paddingHorizontal: 18, paddingVertical: 10 },
  retryText: { color: "#fff", fontFamily: FONT.bold },
  userCard: {
    marginBottom: 13,
    padding: 15,
    borderRadius: 22,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e1e8ed",
    shadowColor: "#0b2f57",
    shadowOpacity: 0.07,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  userCardTop: { flexDirection: "row", alignItems: "center" },
  userPhotoWrap: {
    width: 76,
    height: 90,
    marginRight: 13,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#111918",
    alignItems: "center",
    justifyContent: "center",
  },
  userPhoto: { width: "100%", height: "100%", resizeMode: "cover" },
  userInitials: { color: "#ffffff", fontSize: 22, fontFamily: FONT.extra },
  userCardName: { color: "#111918", fontSize: 16, fontFamily: FONT.bold },
  userCardRole: { color: "#667788", fontSize: 10, marginTop: 2, fontFamily: FONT.bold },
  userStatusChip: {
    alignSelf: "flex-start",
    marginTop: 8,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
  },
  userStatusText: { fontSize: 9.5, fontFamily: FONT.bold },
  userCardData: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 13,
    paddingTop: 11,
    borderTopWidth: 1,
    borderTopColor: "#e5eaee",
  },
  userDataCell: { width: "50%", paddingRight: 8, marginBottom: 10 },
  userDataLabel: { color: "#7a8b98", fontSize: 9.5, fontFamily: FONT.regular },
  userDataValue: { color: "#152b3b", fontSize: 12, marginTop: 2, fontFamily: FONT.semi },
  medicalCard: {
    padding: 11,
    borderRadius: 14,
    backgroundColor: "#f4f6f7",
    borderWidth: 1,
    borderColor: "#e2e7ea",
  },
  medicalTitle: { color: "#111918", fontSize: 12, fontFamily: FONT.bold },
  medicalMeta: { color: "#667788", fontSize: 10.5, marginTop: 3, fontFamily: FONT.regular },
  userDocumentActions: { marginTop: 10 },
  userDocumentButton: {
    minHeight: 40,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    marginBottom: 7,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#d7e0e7",
    backgroundColor: "#ffffff",
  },
  userDocumentButtonDisabled: { backgroundColor: "#f4f6f7", borderColor: "#e6eaed" },
  userDocumentText: { flex: 1, marginLeft: 8, color: "#111918", fontSize: 11, fontFamily: FONT.bold },
  userEditButton: {
    minHeight: 43,
    marginTop: 3,
    borderRadius: 14,
    backgroundColor: "#111918",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  userEditButtonText: { color: "#ffffff", marginLeft: 7, fontSize: 12, fontFamily: FONT.bold },
  editOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,.38)" },
  editKeyboard: { width: "100%", maxHeight: "94%" },
  editSheet: {
    width: "100%",
    maxHeight: "92%",
    paddingHorizontal: 16,
    paddingTop: 14,
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  editHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingBottom: 11,
    borderBottomWidth: 1,
    borderBottomColor: "#e4e9ed",
  },
  editHeaderIcon: {
    width: 42,
    height: 42,
    marginRight: 11,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f1f3f4",
  },
  editTitle: { color: "#111918", fontSize: 16, fontFamily: FONT.bold },
  editSubtitle: { color: "#708292", fontSize: 10.5, marginTop: 2, fontFamily: FONT.regular },
  editClose: {
    width: 36, height: 36, borderRadius: 12, backgroundColor: "#f1f3f4",
    alignItems: "center", justifyContent: "center",
  },
  editBody: { paddingVertical: 14, paddingBottom: 28 },
  editField: { marginBottom: 11 },
  editLabel: { color: "#304657", fontSize: 11, fontFamily: FONT.semi },
  editInput: {
    minHeight: 47, marginTop: 6, paddingHorizontal: 13, borderRadius: 14,
    borderWidth: 1, borderColor: "#dbe4eb", color: "#172a3a",
    backgroundColor: "#ffffff", fontFamily: FONT.regular,
  },
  editChips: { flexDirection: "row", flexWrap: "wrap", marginTop: 7, marginBottom: 11 },
  editChip: {
    paddingHorizontal: 11, paddingVertical: 8, marginRight: 7, marginBottom: 7,
    borderRadius: 999, borderWidth: 1, borderColor: "#d8e1e8", backgroundColor: "#ffffff",
  },
  editChipActive: { backgroundColor: "#111918", borderColor: "#111918" },
  editChipText: { color: "#526879", fontSize: 10, fontFamily: FONT.semi },
  editChipTextActive: { color: "#ffffff" },
  editDate: {
    minHeight: 47, marginTop: 6, paddingHorizontal: 13, marginBottom: 12,
    borderRadius: 14, borderWidth: 1, borderColor: "#dbe4eb",
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
  },
  activeToggleRow: {
    minHeight: 62, padding: 12, borderRadius: 15, borderWidth: 1,
    borderColor: "#dbe4eb", flexDirection: "row", alignItems: "center", justifyContent: "space-between",
  },
  toggleTrack: { width: 45, height: 26, borderRadius: 13, padding: 3, backgroundColor: "#cbd5df" },
  toggleTrackActive: { backgroundColor: "#111918" },
  toggleKnob: { width: 20, height: 20, borderRadius: 10, backgroundColor: "#ffffff" },
  toggleKnobActive: { alignSelf: "flex-end" },
  editActions: { flexDirection: "row", marginTop: 17 },
  editCancel: {
    flex: 1, minHeight: 45, marginRight: 9, borderRadius: 14, borderWidth: 1,
    borderColor: "#d4dee6", alignItems: "center", justifyContent: "center",
  },
  editCancelText: { color: "#243949", fontSize: 11.5, fontFamily: FONT.bold },
  editSave: {
    flex: 1.35, minHeight: 45, borderRadius: 14, backgroundColor: "#111918",
    flexDirection: "row", alignItems: "center", justifyContent: "center",
  },
  editSaveText: { color: "#ffffff", marginLeft: 7, fontSize: 11.5, fontFamily: FONT.bold },
});
