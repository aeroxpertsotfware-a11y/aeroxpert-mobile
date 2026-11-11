import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import * as DocumentPicker from "expo-document-picker";
import MapView, { Marker, Polygon, PROVIDER_GOOGLE } from "react-native-maps";
import { API_URL } from "../config/api";

type Props = {
  token: string;
  onClose: () => void;
  onCreated?: () => void;
};
type PickedFile = { uri: string; name: string; mimeType?: string | null; size?: number | null };
type Pilot = {
  _id: string;
  nombre?: string;
  documento?: string;
  email?: string;
  telefono?: string;
  cipu?: string;
  rol?: string;
  roles?: string[];
  fechaVencimientoCertificadoMedico?: string | null;
  fechaCertificado?: string | null;
  documentosCampo?: {
    certificadoMedico?: {
      fechaInicio?: string | null;
      fechaVencimiento?: string | null;
    } | null;
  };
  certificadoVigente?: boolean;
  estadoOperacional?: "disponible" | "fuera_operacion" | string;
};
type Equipment = { _id: string; nombre?: string; marca?: string; modelo?: string; serie?: string; numeroSerie?: string; ruas?: string };
type CurrentUser = { _id: string; empresaId?: string; rol?: string; rolActivo?: string };
type GeoPoint = [number, number];

const FLYNORTH_EMPRESA_ID = "69e04f2d17205ef6e90e5e95";
const STEPS = ["Datos", "Autorización", "Operación", "Equipo humano", "Briefing", "Área", "Resumen"];
const OPERATION_TYPES = [
  "Simple captura de imágenes o datos",
  "Aspersión",
  "Dispersión",
  "Apoyo en atención de calamidad pública, desastre o emergencia",
];

const normalizePath = (path: string) => {
  const base = String(API_URL || "").replace(/\/+$/, "");
  const clean = `/${String(path || "").replace(/^\/+/, "")}`;
  if (base.endsWith("/api") && clean.startsWith("/api/")) return `${base}${clean.slice(4)}`;
  return `${base}${clean}`;
};

async function parseResponse<T>(response: Response): Promise<T> {
  const raw = await response.text();
  let body: any = {};
  try { body = raw ? JSON.parse(raw) : {}; } catch { body = { message: raw }; }
  if (!response.ok) throw new Error(body?.message || body?.error || `Error HTTP ${response.status}`);
  return body as T;
}

async function requestJson<T>(token: string, path: string): Promise<T> {
  return parseResponse<T>(await fetch(normalizePath(path), {
    headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
  }));
}

const todayInput = () => {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

const hasPilotRole = (user: Pilot) => {
  const roles = [user.rol, ...(Array.isArray(user.roles) ? user.roles : [])]
    .map((role) => String(role || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[\s_-]+/g, ""));
  return roles.some((role) => role === "piloto" || role === "jefepilotos");
};

const toDateKey = (value?: string | null) => {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString().slice(0, 10);
};

const getPilotMedicalExpiry = (pilot: Pilot) => {
  const documentExpiry = toDateKey(pilot.documentosCampo?.certificadoMedico?.fechaVencimiento);
  if (documentExpiry) return documentExpiry;
  const calculated = toDateKey(pilot.fechaVencimientoCertificadoMedico);
  if (calculated) return calculated;
  return toDateKey(pilot.fechaCertificado);
};

const isPilotOperationalOn = (pilot: Pilot, requiredDate: string) => {
  const expiry = getPilotMedicalExpiry(pilot);
  return Boolean(expiry && /^\d{4}-\d{2}-\d{2}$/.test(requiredDate) && expiry >= requiredDate);
};

function decodeJwtAccess(tokenValue: string): CurrentUser {
  try {
    const payload = String(tokenValue || "").split(".")[1] || "";
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    return JSON.parse(globalThis.atob(padded)) as CurrentUser;
  } catch {
    return {} as CurrentUser;
  }
}

const toFormFile = (file: PickedFile) => ({
  uri: file.uri,
  name: file.name,
  type: file.mimeType || "application/octet-stream",
}) as any;

const polygonGeoJson = (points: GeoPoint[]) => {
  if (points.length < 3) return null;
  const ring = [...points, points[0]].map(([lat, lon]) => [lon, lat]);
  return { type: "Feature", properties: { source: "mobile" }, geometry: { type: "Polygon", coordinates: [ring] } };
};

function buildAreaMapHtml(points: GeoPoint[]) {
  const serialized = JSON.stringify(points);
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"/>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
  <style>html,body,#map{height:100%;margin:0}.tip{position:absolute;z-index:999;top:10px;left:10px;right:10px;background:#fff;padding:8px 10px;border-radius:10px;font:12px Arial;box-shadow:0 2px 10px #0002}</style></head>
  <body><div id="map"></div><div class="tip">Toca el mapa para agregar los vértices del polígono.</div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script><script>
  const pts=${serialized}; const map=L.map('map').setView(pts.length?pts[0]:[4.5709,-74.2973],pts.length?15:6);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19}).addTo(map);
  let layer=null; function draw(){if(layer)map.removeLayer(layer);if(!pts.length)return;layer=L.polygon(pts,{color:'#111918',fillColor:'#64748b',fillOpacity:.25}).addTo(map);if(pts.length>1)map.fitBounds(layer.getBounds(),{padding:[24,24]});}
  draw(); map.on('click',e=>{pts.push([e.latlng.lat,e.latlng.lng]);draw();window.ReactNativeWebView.postMessage(JSON.stringify({type:'points',points:pts}));});
  </script></body></html>`;
}

function buildArcGisAreaMapHtml(points: GeoPoint[]) {
  const initial = JSON.stringify(points);
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"/>
  <link rel="stylesheet" href="https://js.arcgis.com/4.32/esri/themes/light/main.css"/>
  <style>html,body,#map{height:100%;width:100%;margin:0;overflow:hidden}.tip{position:absolute;z-index:9;left:8px;right:58px;bottom:8px;background:#fff;padding:8px;border-radius:9px;font:11px Arial;box-shadow:0 2px 10px #0003}</style></head>
  <body><div id="map"></div><div class="tip">Dibuja el polígono y pulsa dos veces para terminar. Después puedes seleccionarlo y editar sus vértices.</div>
  <script src="https://js.arcgis.com/4.32/"></script><script>
  const initialPoints=${initial};
  require(["esri/Map","esri/views/MapView","esri/layers/GraphicsLayer","esri/widgets/Sketch","esri/Graphic","esri/geometry/Polygon","esri/geometry/support/webMercatorUtils"],
  function(Map,MapView,GraphicsLayer,Sketch,Graphic,Polygon,webMercatorUtils){
    const drawLayer=new GraphicsLayer({title:"Área de operación"});
    const map=new Map({basemap:"hybrid",layers:[drawLayer]});
    const center=initialPoints.length?[initialPoints[0][1],initialPoints[0][0]]:[-74.1,4.65];
    const view=new MapView({container:"map",map,center,zoom:initialPoints.length?15:7});
    const symbol={type:"simple-fill",color:[37,99,235,.25],outline:{color:[37,99,235,1],width:2}};
    function emit(graphic){
      if(!graphic||!graphic.geometry)return;
      let geom=graphic.geometry;
      if(geom.spatialReference&&geom.spatialReference.isWebMercator)geom=webMercatorUtils.webMercatorToGeographic(geom);
      const ring=(geom.rings&&geom.rings[0])||[];
      const next=ring.map(p=>[p[1],p[0]]);
      if(next.length>1&&next[0][0]===next[next.length-1][0]&&next[0][1]===next[next.length-1][1])next.pop();
      window.ReactNativeWebView.postMessage(JSON.stringify({type:"points",points:next}));
    }
    view.when(()=>{
      if(initialPoints.length>=3){
        const ring=initialPoints.map(p=>[p[1],p[0]]);ring.push(ring[0]);
        const graphic=new Graphic({geometry:new Polygon({rings:[ring],spatialReference:{wkid:4326}}),symbol:symbol});
        drawLayer.add(graphic);view.goTo(graphic).catch(()=>{});
      }
      const sketch=new Sketch({view:view,layer:drawLayer,creationMode:"update",availableCreateTools:["polygon"],visibleElements:{createTools:{point:false,polyline:false,rectangle:false,circle:false},selectionTools:{"lasso-selection":false,"rectangle-selection":false},settingsMenu:false}});
      view.ui.add(sketch,"top-right");
      function keep(graphic){drawLayer.removeAll();graphic.symbol=symbol;drawLayer.add(graphic);emit(graphic);}
      sketch.on("create",evt=>{if(evt.state==="complete")keep(evt.graphic);});
      sketch.on("update",evt=>{if(evt.state==="complete"&&evt.graphics&&evt.graphics[0])emit(evt.graphics[0]);});
      window.startPolygon=()=>{sketch.cancel();sketch.create("polygon");};
      window.clearPolygon=()=>{sketch.cancel();drawLayer.removeAll();};
    });
  });
  </script></body></html>`;
}

export default function MissionPlannerScreen({ onClose, onCreated, token }: Props) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [pilots, setPilots] = useState<Pilot[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [selectedPilots, setSelectedPilots] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(todayInput());
  const [isRecurring, setIsRecurring] = useState<"" | "si" | "no">("no");
  const [recurrenceStart, setRecurrenceStart] = useState(todayInput());
  const [recurrenceEnd, setRecurrenceEnd] = useState(todayInput());
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [location, setLocation] = useState("");
  const [attachments, setAttachments] = useState<PickedFile[]>([]);
  const [authorizationChoice, setAuthorizationChoice] = useState<"" | "disponible" | "pendiente_gestion" | "no_requiere">("");
  const [authorizationResponsible, setAuthorizationResponsible] = useState<"" | "piloto" | "jefepilotos">("");
  const [authorizationId, setAuthorizationId] = useState("");
  const [authorizationFile, setAuthorizationFile] = useState<PickedFile | null>(null);
  const [equipmentId, setEquipmentId] = useState("");
  const [maxAltitude, setMaxAltitude] = useState("120");
  const [operationType, setOperationType] = useState("");
  const [visualContact, setVisualContact] = useState("");
  const [flightCondition, setFlightCondition] = useState("");
  const [requiresObserver, setRequiresObserver] = useState<"" | "si" | "no">("");
  const [observerId, setObserverId] = useState("");
  const [observerPickerOpen, setObserverPickerOpen] = useState(false);
  const [observerName, setObserverName] = useState("");
  const [observerCipu, setObserverCipu] = useState("");
  const [observerPhone, setObserverPhone] = useState("");
  const [observerEmail, setObserverEmail] = useState("");
  const [instructions, setInstructions] = useState("");
  const [risks, setRisks] = useState("");
  const [areaPoints, setAreaPoints] = useState<GeoPoint[]>([]);
  const [mapKey, setMapKey] = useState(0);
  const [kmlFile, setKmlFile] = useState<PickedFile | null>(null);
  const areaMapRef = useRef<MapView>(null);
  const formScrollRef = useRef<ScrollView>(null);

  const pickTime = useCallback((current: string, onSelect: (value: string) => void) => {
    const [hours, minutes] = /^\d{2}:\d{2}$/.test(current)
      ? current.split(":").map(Number)
      : [8, 0];
    const value = new Date();
    value.setHours(hours, minutes, 0, 0);
    DateTimePickerAndroid.open({
      value,
      mode: "time",
      is24Hour: true,
      onChange: (event, selected) => {
        if (event.type === "set" && selected) {
          onSelect(
            `${String(selected.getHours()).padStart(2, "0")}:${String(selected.getMinutes()).padStart(2, "0")}`
          );
        }
      },
    });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const profile = await requestJson<CurrentUser>(token, "/api/me");
      const claims = decodeJwtAccess(token);
      const me = {
        ...profile,
        empresaId: profile?.empresaId || claims?.empresaId,
        rolActivo: profile?.rolActivo || claims?.rolActivo,
        rol: profile?.rol || claims?.rol,
      };
      const role = String(me?.rolActivo || me?.rol || "").toLowerCase().trim();
      if (String(me?.empresaId || "") !== FLYNORTH_EMPRESA_ID || !["piloto", "jefepilotos", "admin"].includes(role)) {
        Alert.alert("Acceso restringido", "Nueva Operación está habilitada únicamente para FLYNORTH.", [
          { text: "Volver", onPress: onClose },
        ]);
        return;
      }
      const [options, missions, companyUsers] = await Promise.all([
        requestJson<any>(token, "/api/misiones/planning-options").catch(async (error: any) => {
          const message = String(error?.message || "");
          if (!message.includes("404") && !message.includes("Cannot GET")) throw error;
          const uas = await requestJson<any>(token, "/api/equipos");
          return {
            pilotos: [{ _id: me._id, nombre: "Usuario actual", rol: "piloto" }],
            equipos: Array.isArray(uas) ? uas : uas?.equipos || uas?.data || [],
            compatibilityMode: true,
          };
        }),
        requestJson<any>(token, "/api/misiones"),
        requestJson<any>(token, "/api/usuarios").catch(() => []),
      ]);
      const missionList = Array.isArray(missions) ? missions : missions?.misiones || missions?.data || [];
      const maxMission = missionList.reduce((max: number, mission: any) => {
        const match = String(mission?.titulo || "").match(/^M-(\d+)$/i);
        return match ? Math.max(max, Number(match[1]) || 0) : max;
      }, 0);
      const usersList = Array.isArray(companyUsers) ? companyUsers : companyUsers?.data || companyUsers?.usuarios || [];
      const usersById = new Map(
        usersList.map((user: any) => [String(user?._id || ""), user])
      );
      const pilotOptions = (Array.isArray(options?.pilotos) ? options.pilotos : [])
        .map((pilot: Pilot) => {
          const latest: any = usersById.get(String(pilot?._id || ""));
          if (!latest) return pilot;
          return {
            ...pilot,
            fechaCertificado: latest.fechaCertificado ?? pilot.fechaCertificado,
            documentosCampo: latest.documentosCampo ?? pilot.documentosCampo,
            rol: latest.rol || pilot.rol,
            roles: Array.from(new Set([...(pilot.roles || []), ...(latest.roles || [])])),
          };
        })
        .filter(hasPilotRole);
      setCurrentUser(me);
      setPilots(pilotOptions);
      setEquipment(Array.isArray(options?.equipos) ? options.equipos : []);
      const currentPilot = pilotOptions.find((pilot: Pilot) => String(pilot._id) === String(me?._id || ""));
      setSelectedPilots(
        currentPilot && isPilotOperationalOn(currentPilot, todayInput())
          ? [String(currentPilot._id)]
          : []
      );
      setTitle(String(options?.nextConsecutive || `M-${String(maxMission + 1).padStart(3, "0")}`));
    } catch (error: any) {
      Alert.alert("No se pudo cargar", error?.message || "Verifica la conexión.");
    } finally {
      setLoading(false);
    }
  }, [onClose, token]);

  useEffect(() => { load(); }, [load]);

  const requiredCertificateDate = isRecurring === "si" ? recurrenceEnd : date;
  useEffect(() => {
    setSelectedPilots((current) =>
      current.filter((id) => {
        const pilot = pilots.find((item) => item._id === id);
        return Boolean(pilot && isPilotOperationalOn(pilot, requiredCertificateDate));
      })
    );
    if (observerId) {
      const observer = pilots.find((pilot) => pilot._id === observerId);
      if (!observer || !isPilotOperationalOn(observer, requiredCertificateDate)) {
        setObserverId("");
        setObserverName("");
        setObserverCipu("");
        setObserverPhone("");
        setObserverEmail("");
      }
    }
  }, [observerId, pilots, requiredCertificateDate]);

  const pickDocuments = async (multiple: boolean, type: string | string[] = "*/*") => {
    const result = await DocumentPicker.getDocumentAsync({ multiple, type, copyToCacheDirectory: true });
    if (result.canceled) return [];
    return result.assets.map((asset) => ({
      uri: asset.uri, name: asset.name, mimeType: asset.mimeType, size: asset.size,
    }));
  };

  const equipmentLabel = (item: Equipment) =>
    [item.modelo, item.ruas, item.marca, item.serie || item.numeroSerie].map((v) => String(v || "").trim()).filter(Boolean).join(" · ") || "Equipo UAS";

  const validateStep = () => {
    if (step === 1 && !title.trim()) return "El consecutivo es obligatorio.";
    if (step === 1 && isRecurring === "no" && !/^\d{4}-\d{2}-\d{2}$/.test(date)) return "La fecha de operación no es válida.";
    if (step === 1 && isRecurring === "si" && (!/^\d{4}-\d{2}-\d{2}$/.test(recurrenceStart) || !/^\d{4}-\d{2}-\d{2}$/.test(recurrenceEnd))) return "Las fechas de inicio y fin no son válidas.";
    if (step === 1 && isRecurring === "si" && recurrenceEnd < recurrenceStart) return "La fecha final no puede ser anterior a la fecha inicial.";
    if (step === 1 && isRecurring === "si" && (!startTime.trim() || !endTime.trim())) return "El horario es obligatorio para una operación repetitiva.";
    if (step === 2 && !authorizationChoice) return "Selecciona el estado de la autorización de vuelo.";
    if (step === 2 && authorizationChoice === "disponible" && (!authorizationId.trim() || !authorizationFile)) return "Ingresa el ID y adjunta la autorización.";
    if (step === 2 && authorizationChoice === "pendiente_gestion" && !authorizationResponsible) return "Indica quién gestionará la autorización.";
    if (step === 3 && (!equipmentId || !operationType || !visualContact || !flightCondition)) return "Completa aeronave, tipo de operación, contacto visual y condición de vuelo.";
    if (step === 4 && !selectedPilots.length) return "Asigna al menos un piloto.";
    if (step === 4 && !requiresObserver) return "Indica si requiere observador.";
    if (step === 4 && requiresObserver === "si" && !observerId) return "Selecciona un piloto como observador.";
    return "";
  };

  const goNext = () => {
    const message = validateStep();
    if (message) return Alert.alert("Faltan datos", message);
    setStep((value) => Math.min(7, value + 1));
  };

  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const form = new FormData();
      const values: Record<string, any> = {
        titulo: title.trim(), fechaOperacion: isRecurring === "si" ? recurrenceStart : date, horaInicio: startTime.trim(), horaFin: endTime.trim(),
        esRepetitiva: isRecurring === "si",
        fechaInicioRepeticion: isRecurring === "si" ? recurrenceStart : "",
        fechaFinRepeticion: isRecurring === "si" ? recurrenceEnd : "",
        ubicacionGeneral: location.trim(), altitudMax: Number(maxAltitude || 0), equipoId: equipmentId,
        tipoOperacion: operationType, tipoContactoVisual: visualContact, condicionVuelo: flightCondition,
        instrucciones: instructions.trim(), riesgosPotenciales: risks.trim(), requiereObservador: requiresObserver,
        observadorId: requiresObserver === "si" ? observerId : "",
        observadorNombre: requiresObserver === "si" ? observerName.trim() : "",
        observadorCipu: requiresObserver === "si" ? observerCipu.trim() : "",
        observadorTelefono: requiresObserver === "si" ? observerPhone.trim() : "",
        observadorCorreo: requiresObserver === "si" ? observerEmail.trim() : "",
        pilotosAsignados: JSON.stringify(selectedPilots),
        cuentaAutorizacionVuelo: authorizationChoice === "disponible",
        idAutorizacion: authorizationChoice === "disponible" ? authorizationId.trim() : "",
        autorizacionSolicitada: authorizationChoice === "pendiente_gestion",
        estadoAutorizacionVuelo: authorizationChoice,
        responsableAutorizacionVuelo: authorizationChoice === "pendiente_gestion" ? authorizationResponsible : "",
      };
      const area = polygonGeoJson(areaPoints);
      if (area) values.areaOperacion = JSON.stringify(area);
      Object.entries(values).forEach(([key, value]) => form.append(key, String(value)));
      attachments.forEach((file) => form.append("adjunto", toFormFile(file)));
      if (authorizationFile) form.append("autorizacionVuelo", toFormFile(authorizationFile));
      if (kmlFile) form.append("kmlBase", toFormFile(kmlFile));

      const created = await parseResponse<any>(await fetch(normalizePath("/api/misiones"), {
        method: "POST",
        headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
        body: form,
      }));
      const createdCount = Number(created?.cantidadCreada || 1);
      Alert.alert(
        createdCount > 1 ? "Serie de operaciones creada" : "Operación creada",
        createdCount > 1
          ? `Se programaron ${createdCount} misiones diarias. Cada fecha tendrá sus propias listas de verificación y estado.`
          : "La misión quedó planificada y se notificará a los pilotos asignados.",
        [
        {
          text: "Aceptar",
          onPress: () => {
            onCreated?.();
            onClose();
          },
        },
      ]);
    } catch (error: any) {
      Alert.alert("No se pudo guardar", error?.message || "Intenta nuevamente.");
    } finally {
      setSaving(false);
    }
  };

  const togglePilot = (id: string) => {
    const pilot = pilots.find((item) => item._id === id);
    if (!pilot || !isPilotOperationalOn(pilot, requiredCertificateDate)) return;
    setSelectedPilots((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  };

  const selectObserver = (pilot: Pilot) => {
    if (!isPilotOperationalOn(pilot, requiredCertificateDate)) return;
    setObserverId(pilot._id);
    setObserverName(String(pilot.nombre || "").trim());
    setObserverCipu(String(pilot.cipu || pilot.documento || "").trim());
    setObserverPhone(String(pilot.telefono || "").trim());
    setObserverEmail(String(pilot.email || "").trim());
    setObserverPickerOpen(false);
  };

  const selectedPilotNames = pilots.filter((p) => selectedPilots.includes(p._id)).map((p) => p.nombre || "Piloto").join(", ");
  const selectedObserver = pilots.find((pilot) => pilot._id === observerId);
  const selectedEquipment = equipment.find((item) => item._id === equipmentId);
  const stepSubtitle = [
    "Define fecha, horario, ubicación y adjuntos iniciales.",
    "Registra el soporte o la solicitud de autorización.",
    "Selecciona aeronave, altitud y condiciones de operación.",
    "Asigna pilotos y datos del observador cuando aplique.",
    "Documenta instrucciones, riesgos y briefing.",
    "Dibuja el polígono o carga un archivo KML/KMZ.",
    "Revisa los datos antes de guardar.",
  ][step - 1];

  if (loading) return <SafeAreaView style={styles.safe}><View style={styles.center}><ActivityIndicator size="large" color="#111918" /><Text style={styles.helper}>Preparando Nueva Operación...</Text></View></SafeAreaView>;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <View style={styles.headerIcon}><Ionicons name="clipboard-outline" size={21} color="#ffffff" /></View>
        <View style={{ flex: 1 }}><Text style={styles.title}>Nueva Operación</Text><Text style={styles.subtitle}>Briefing + Área de operación</Text></View>
        <Pressable style={styles.closeButton} onPress={onClose}><Ionicons name="close" size={18} color="#ffffff" /><Text style={styles.closeText}>Cerrar</Text></Pressable>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
      >
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.stepBar} contentContainerStyle={styles.stepBarContent}>
        {STEPS.map((label, index) => {
          const id = index + 1;
          return <Pressable key={label} style={[styles.stepChip, step === id && styles.stepChipActive]} onPress={() => setStep(id)}>
            <View style={[styles.stepNumber, step === id && styles.stepNumberActive]}><Text style={[styles.stepNumberText, step === id && styles.stepNumberTextActive]}>{id}</Text></View>
            <Text style={[styles.stepLabel, step === id && styles.stepLabelActive]}>{label}</Text>
          </Pressable>;
        })}
      </ScrollView>

      <ScrollView
        ref={formScrollRef}
        style={styles.formScroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="always"
        keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
        automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
        nestedScrollEnabled
        decelerationRate="normal"
        showsVerticalScrollIndicator
      >
        <View style={styles.stepIntro}><Text style={styles.stepEyebrow}>PASO {step} DE 7</Text><Text style={styles.stepTitle}>{STEPS[step - 1]}</Text><Text style={styles.stepSubtitle}>{stepSubtitle}</Text></View>

        {step === 1 && <Card>
          <Field label="Consecutivo" value={title} editable={false} />
          <Text style={styles.label}>¿Es una operación repetitiva? *</Text>
          <ChoiceRow values={["si", "no"]} labels={["Sí", "No"]} selected={isRecurring} onSelect={(value) => {
            setIsRecurring(value as any);
            if (value === "si") {
              setRecurrenceStart(date);
              setRecurrenceEnd(date);
            }
          }} />
          {isRecurring === "si" ? (
            <Row>
              <FieldBox><Field label="Fecha de inicio *" value={recurrenceStart} onChangeText={setRecurrenceStart} placeholder="AAAA-MM-DD" /></FieldBox>
              <FieldBox><Field label="Fecha final *" value={recurrenceEnd} onChangeText={setRecurrenceEnd} placeholder="AAAA-MM-DD" /></FieldBox>
            </Row>
          ) : (
            <Field label="Fecha operación *" value={date} onChangeText={setDate} placeholder="AAAA-MM-DD" onFocus={() => setTimeout(() => formScrollRef.current?.scrollTo({ y: 120, animated: true }), 250)} />
          )}
          <Row>
            <FieldBox><TimeField label="Hora inicio" value={startTime} onPress={() => pickTime(startTime, setStartTime)} /></FieldBox>
            <FieldBox><TimeField label="Hora fin" value={endTime} onPress={() => pickTime(endTime, setEndTime)} /></FieldBox>
          </Row>
          {isRecurring === "si" ? <Text style={styles.helperLeft}>Se creará una misión independiente por cada día del rango, con sus propias listas de verificación.</Text> : null}
          <Field label="Ubicación general" value={location} onChangeText={setLocation} placeholder="Ej: La Mesa, Cundinamarca" onFocus={() => setTimeout(() => formScrollRef.current?.scrollToEnd({ animated: true }), 250)} />
          <FileButton label="Adjuntos opcionales" files={attachments} onPress={async () => setAttachments(await pickDocuments(true))} />
        </Card>}

        {step === 2 && <Card>
          <Text style={styles.label}>Estado de la autorización de vuelo *</Text>
          <View style={styles.choiceList}>
            <SelectableRow label="Ya está disponible" selected={authorizationChoice === "disponible"} onPress={() => { setAuthorizationChoice("disponible"); setAuthorizationResponsible(""); }} />
            <SelectableRow label="Pendiente de gestionar" selected={authorizationChoice === "pendiente_gestion"} onPress={() => setAuthorizationChoice("pendiente_gestion")} />
            <SelectableRow label="No requiere autorización" selected={authorizationChoice === "no_requiere"} onPress={() => { setAuthorizationChoice("no_requiere"); setAuthorizationResponsible(""); setAuthorizationFile(null); setAuthorizationId(""); }} />
          </View>
          {authorizationChoice === "disponible" && <>
            <Field label="ID autorización *" value={authorizationId} onChangeText={setAuthorizationId} placeholder="Ej: OS-0003" onFocus={() => setTimeout(() => formScrollRef.current?.scrollToEnd({ animated: true }), 250)} />
            <FileButton label="Subir autorización de vuelo *" files={authorizationFile ? [authorizationFile] : []} onPress={async () => setAuthorizationFile((await pickDocuments(false))[0] || null)} />
          </>}
          {authorizationChoice === "pendiente_gestion" && <>
            <Text style={styles.label}>¿Quién gestionará y cargará la autorización? *</Text>
            <ChoiceRow
              values={["piloto", "jefepilotos"]}
              labels={["Piloto asignado", "Jefe de pilotos"]}
              selected={authorizationResponsible}
              onSelect={(value) => setAuthorizationResponsible(value as any)}
            />
            <Text style={styles.warning}>
              {authorizationResponsible === "jefepilotos"
                ? "Al finalizar, la operación se enviará al jefe de pilotos para cargar, revisar y aprobar."
                : authorizationResponsible === "piloto"
                  ? "La operación quedará pendiente. Cuando el piloto cargue la autorización se enviará al jefe de pilotos para aprobación."
                  : "Selecciona quién será responsable de la autorización."}
            </Text>
          </>}
          {authorizationChoice === "disponible" ? <Text style={styles.warning}>La operación se enviará al jefe de pilotos para revisión y aprobación.</Text> : null}
        </Card>}

        {step === 3 && <Card>
          <Field label="Altitud máxima (m)" value={maxAltitude} onChangeText={setMaxAltitude} keyboardType="numeric" onFocus={() => setTimeout(() => formScrollRef.current?.scrollToEnd({ animated: true }), 250)} />
          <Text style={styles.label}>Aeronave seleccionada *</Text>
          {equipment.map((item) => <SelectableRow key={item._id} label={equipmentLabel(item)} selected={equipmentId === item._id} onPress={() => setEquipmentId(item._id)} />)}
          <Text style={styles.label}>Tipo de operación *</Text>
          {OPERATION_TYPES.map((value) => <SelectableRow key={value} label={value} selected={operationType === value} onPress={() => setOperationType(value)} />)}
          <Text style={styles.label}>Tipo de contacto visual *</Text>
          <ChoiceRow values={["VLOS", "EVLOS", "BVLOS"]} selected={visualContact} onSelect={setVisualContact} />
          <Text style={styles.label}>Condición de vuelo *</Text>
          <ChoiceRow values={["DIURNO", "NOCTURNO", "MIXTO"]} selected={flightCondition} onSelect={setFlightCondition} />
        </Card>}

        {step === 4 && <Card>
          <Text style={styles.label}>Pilotos asignados *</Text>
          {pilots.map((pilot) => {
            const available = isPilotOperationalOn(pilot, requiredCertificateDate);
            const expiry = getPilotMedicalExpiry(pilot);
            return (
              <SelectableRow
                key={pilot._id}
                label={`${pilot.nombre || "Piloto"}${pilot._id === currentUser?._id ? " (yo)" : ""}`}
                detail={
                  available
                    ? `Disponible · Certificado vigente hasta ${expiry}`
                    : `Fuera de operación · ${expiry ? `El certificado vence ${expiry} y no cubre la operación del ${requiredCertificateDate}` : "Certificado médico no registrado"}`
                }
                selected={selectedPilots.includes(pilot._id)}
                disabled={!available}
                onPress={() => togglePilot(pilot._id)}
              />
            );
          })}
          <Text style={styles.label}>¿Requiere observador? *</Text>
          <ChoiceRow values={["si", "no"]} labels={["Sí", "No"]} selected={requiresObserver} onSelect={(value) => {
            setRequiresObserver(value as any);
            setObserverPickerOpen(false);
            if (value === "no") {
              setObserverId("");
              setObserverName("");
              setObserverCipu("");
              setObserverPhone("");
              setObserverEmail("");
            }
          }} />
          {requiresObserver === "si" && <>
            <Text style={styles.label}>Piloto observador *</Text>
            <Pressable style={styles.dropdownButton} onPress={() => setObserverPickerOpen((open) => !open)}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.dropdownText, !selectedObserver && styles.dropdownPlaceholder]}>
                  {selectedObserver?.nombre || "Seleccionar piloto observador"}
                </Text>
                {selectedObserver?.email ? <Text style={styles.selectDetail}>{selectedObserver.email}</Text> : null}
              </View>
              <Ionicons name={observerPickerOpen ? "chevron-up" : "chevron-down"} size={19} color="#111918" />
            </Pressable>
            {observerPickerOpen && <View style={styles.dropdownMenu}>
              {pilots.map((pilot) => {
                const available = isPilotOperationalOn(pilot, requiredCertificateDate);
                const expiry = getPilotMedicalExpiry(pilot);
                return <Pressable key={pilot._id} disabled={!available} style={[styles.dropdownOption, !available && styles.selectRowDisabled]} onPress={() => selectObserver(pilot)}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.selectLabel}>{pilot.nombre || "Piloto"}</Text>
                  <Text style={[styles.selectDetail, !available && styles.outOfOperationText]}>
                    {available
                      ? `Disponible · Certificado hasta ${expiry}`
                      : `Fuera de operación · ${expiry ? `Vence ${expiry} y no cubre el ${requiredCertificateDate}` : "Sin certificado médico"}`}
                  </Text>
                </View>
                {available
                  ? observerId === pilot._id
                    ? <Ionicons name="checkmark-circle" size={21} color="#111918" />
                    : null
                  : <Ionicons name="lock-closed-outline" size={20} color="#b42318" />}
              </Pressable>;
              })}
            </View>}
            {selectedObserver ? <Text style={styles.helperLeft}>Recibirá una notificación al crear la operación.</Text> : null}
          </>}
        </Card>}

        {step === 5 && <Card>
          <Field label="Instrucciones / Briefing" value={instructions} onChangeText={setInstructions} multiline placeholder="Objetivos, comunicaciones, emergencia, NOTAM..." onFocus={() => setTimeout(() => formScrollRef.current?.scrollTo({ y: 100, animated: true }), 250)} />
          <Field label="Peligros" value={risks} onChangeText={setRisks} multiline placeholder="Describe riesgos y controles." onFocus={() => setTimeout(() => formScrollRef.current?.scrollToEnd({ animated: true }), 250)} />
        </Card>}

        {step === 6 && <Card>
          <Text style={styles.areaTitle}>Área de operación</Text><Text style={styles.helperLeft}>Toca el mapa para delimitar la zona.</Text>
          <View style={styles.mapWrap}>
            <MapView ref={areaMapRef} key={mapKey} style={StyleSheet.absoluteFillObject} provider={PROVIDER_GOOGLE} mapType="hybrid"
              initialRegion={{ latitude: areaPoints[0]?.[0] ?? 4.65, longitude: areaPoints[0]?.[1] ?? -74.1, latitudeDelta: areaPoints.length ? 0.025 : 5, longitudeDelta: areaPoints.length ? 0.025 : 5 }}
              onPress={(event) => { const { latitude, longitude } = event.nativeEvent.coordinate; setAreaPoints((current) => [...current, [latitude, longitude]]); }}>
              {areaPoints.length >= 2 && <Polygon coordinates={areaPoints.map(([latitude, longitude]) => ({ latitude, longitude }))} strokeColor="#2563eb" strokeWidth={3} fillColor="rgba(37,99,235,.25)" />}
              {areaPoints.map(([latitude, longitude], index) => <Marker key={`vertex-${index}`} coordinate={{ latitude, longitude }} draggable pinColor={index === 0 ? "#16a34a" : "#2563eb"} title={index === 0 ? "Primer punto" : `Vértice ${index + 1}`}
                onDragEnd={(event) => setAreaPoints((current) => current.map((point, pointIndex) => pointIndex === index ? [event.nativeEvent.coordinate.latitude, event.nativeEvent.coordinate.longitude] : point))} />)}
            </MapView>
          </View>
          <View style={styles.mapActions}>
            <Pressable style={styles.primaryButton} onPress={() => { setAreaPoints([]); setMapKey((value) => value + 1); }}><Ionicons name="pencil-outline" size={17} color="#fff" /><Text style={styles.primaryText}>Nuevo polígono</Text></Pressable>
            <Pressable style={styles.outlineButton} onPress={() => { setAreaPoints([]); setMapKey((value) => value + 1); }}><Ionicons name="trash-outline" size={17} color="#111918" /><Text style={styles.outlineText}>Limpiar</Text></Pressable>
            <Pressable style={styles.outlineButton} onPress={async () => setKmlFile((await pickDocuments(false, ["application/vnd.google-earth.kml+xml", "application/vnd.google-earth.kmz", "*/*"]))[0] || null)}><Ionicons name="document-attach-outline" size={17} color="#111918" /><Text style={styles.outlineText}>Subir KML/KMZ</Text></Pressable>
          </View>
          <Text style={styles.helperLeft}>{areaPoints.length} vértices {kmlFile ? `· ${kmlFile.name}` : ""}</Text>
        </Card>}

        {step === 7 && <Card>
          <Summary label="Consecutivo inicial" value={title} />
          <Summary label="Repetitiva" value={isRecurring === "si" ? "Sí, diariamente" : "No"} />
          <Summary label={isRecurring === "si" ? "Rango de fechas" : "Fecha"} value={isRecurring === "si" ? `${recurrenceStart} a ${recurrenceEnd}` : date} />
          <Summary label="Horario" value={`${startTime || "—"} - ${endTime || "—"}`} />
          <Summary label="Ubicación" value={location || "—"} />
          <Summary label="Autorización" value={
            authorizationChoice === "disponible"
              ? `Disponible · ${authorizationId}`
              : authorizationChoice === "pendiente_gestion"
                ? `Pendiente · ${authorizationResponsible === "jefepilotos" ? "Jefe de pilotos" : "Piloto asignado"}`
                : "No requiere"
          } />
          <Summary label="Altitud máxima" value={`${maxAltitude || "—"} m`} /><Summary label="Aeronave" value={selectedEquipment ? equipmentLabel(selectedEquipment) : "—"} />
          <Summary label="Tipo operación" value={operationType || "—"} /><Summary label="Contacto visual" value={visualContact || "—"} /><Summary label="Condición de vuelo" value={flightCondition || "—"} />
          <Summary label="Pilotos" value={selectedPilotNames || "—"} /><Summary label="Observador" value={requiresObserver === "si" ? selectedObserver?.nombre || "Sin seleccionar" : "No"} />
          <Summary label="Adjuntos" value={`${attachments.length + (authorizationFile ? 1 : 0) + (kmlFile ? 1 : 0)} archivo(s)`} />
          <Summary label="Área" value={areaPoints.length >= 3 ? `Polígono de ${areaPoints.length} vértices` : kmlFile?.name || "Sin polígono"} />
        </Card>}

        <View style={styles.footer}>
          <Pressable style={styles.outlineButton} onPress={() => step === 1 ? onClose() : setStep((value) => value - 1)}><Ionicons name="chevron-back" size={18} color="#111918" /><Text style={styles.outlineText}>{step === 1 ? "Cancelar" : "Anterior"}</Text></Pressable>
          {step < 7 ? <Pressable style={styles.primaryButton} onPress={goNext}><Text style={styles.primaryText}>Siguiente</Text><Ionicons name="chevron-forward" size={18} color="#fff" /></Pressable>
            : <Pressable style={[styles.primaryButton, saving && styles.disabled]} disabled={saving} onPress={save}>{saving ? <ActivityIndicator color="#fff" /> : <Ionicons name="checkmark-circle-outline" size={19} color="#fff" />}<Text style={styles.primaryText}>{saving ? "Guardando..." : authorizationChoice === "disponible" || authorizationResponsible === "jefepilotos" ? "Enviar para aprobación" : "Crear Operación"}</Text></Pressable>}
        </View>
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Card({ children }: React.PropsWithChildren) { return <View style={styles.card}>{children}</View>; }
function Row({ children }: React.PropsWithChildren) { return <View style={styles.row}>{children}</View>; }
function FieldBox({ children }: React.PropsWithChildren) { return <View style={{ flex: 1 }}>{children}</View>; }
function Field({ label, multiline, ...props }: React.ComponentProps<typeof TextInput> & { label: string }) {
  return <View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput {...props} multiline={multiline} style={[styles.input, multiline && styles.multiline, props.editable === false && styles.readonly]} placeholderTextColor="#8a98a8" /></View>;
}
function TimeField({ label, value, onPress }: { label: string; value: string; onPress: () => void }) {
  return <View style={styles.field}>
    <Text style={styles.label}>{label}</Text>
    <Pressable style={[styles.input, styles.timeButton]} onPress={onPress}>
      <Text style={[styles.timeText, !value && styles.dropdownPlaceholder]}>{value || "Seleccionar"}</Text>
      <Ionicons name="time-outline" size={19} color="#111918" />
    </Pressable>
  </View>;
}
function ChoiceRow({ values, labels, selected, onSelect }: { values: string[]; labels?: string[]; selected: string; onSelect: (value: string) => void }) {
  return <View style={styles.choices}>{values.map((value, index) => <Pressable key={value} style={[styles.choice, selected === value && styles.choiceSelected]} onPress={() => onSelect(value)}><Text style={[styles.choiceText, selected === value && styles.choiceTextSelected]}>{labels?.[index] || value}</Text></Pressable>)}</View>;
}
function SelectableRow({ label, detail, selected, disabled = false, onPress }: { label: string; detail?: string; selected: boolean; disabled?: boolean; onPress: () => void }) {
  return <Pressable disabled={disabled} style={[styles.selectRow, selected && styles.selectRowSelected, disabled && styles.selectRowDisabled]} onPress={onPress}><Ionicons name={disabled ? "lock-closed-outline" : selected ? "checkbox" : "square-outline"} size={22} color={disabled ? "#b42318" : selected ? "#111918" : "#728092"} /><View style={{ flex: 1 }}><Text style={styles.selectLabel}>{label}</Text>{detail ? <Text style={[styles.selectDetail, disabled && styles.outOfOperationText]}>{detail}</Text> : null}</View></Pressable>;
}
function FileButton({ label, files, onPress }: { label: string; files: PickedFile[]; onPress: () => void }) {
  return <View style={styles.field}><Text style={styles.label}>{label}</Text><Pressable style={styles.fileButton} onPress={onPress}><Ionicons name="attach-outline" size={19} color="#111918" /><Text style={styles.fileButtonText}>{files.length ? `${files.length} archivo(s)` : "Elegir archivos"}</Text></Pressable>{files.map((file) => <Text key={`${file.uri}-${file.name}`} style={styles.fileName}>{file.name}</Text>)}</View>;
}
function Summary({ label, value }: { label: string; value: string }) { return <View style={styles.summaryRow}><Text style={styles.summaryLabel}>{label}</Text><Text style={styles.summaryValue}>{value}</Text></View>; }

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f6f7f8" }, center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  formScroll: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: 11, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 22, backgroundColor: "#070b0d", borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  headerIcon: { width: 43, height: 43, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,.14)", borderWidth: 1, borderColor: "rgba(255,255,255,.2)" },
  title: { fontFamily: "Nunito_800ExtraBold", fontSize: 19, color: "#ffffff" }, subtitle: { fontFamily: "Nunito_600SemiBold", fontSize: 11, color: "rgba(255,255,255,.75)" },
  closeButton: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 12, height: 40, borderRadius: 14, borderWidth: 1, borderColor: "rgba(255,255,255,.22)", backgroundColor: "rgba(255,255,255,.1)" }, closeText: { fontFamily: "Nunito_700Bold", color: "#ffffff" },
  stepBar: { flexGrow: 0, backgroundColor: "#fff" }, stepBarContent: { paddingHorizontal: 12, paddingVertical: 10, gap: 7 },
  stepChip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 9, height: 36, borderRadius: 10, borderWidth: 1, borderColor: "#d5e0eb" },
  stepChipActive: { backgroundColor: "#111918", borderColor: "#111918" }, stepNumber: { width: 21, height: 21, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: "#edf2f7" },
  stepNumberActive: { backgroundColor: "#fff" }, stepNumberText: { fontFamily: "Nunito_800ExtraBold", fontSize: 11, color: "#58708a" }, stepNumberTextActive: { color: "#111918" },
  stepLabel: { fontFamily: "Nunito_700Bold", fontSize: 11, color: "#58708a" }, stepLabelActive: { color: "#fff" },
  content: { padding: 15, paddingBottom: 45 }, stepIntro: { backgroundColor: "#ffffff", borderRadius: 20, padding: 15, marginBottom: 13, shadowColor: "#000", shadowOpacity: .07, shadowRadius: 12, shadowOffset: { width: 0, height: 7 }, elevation: 3 },
  stepEyebrow: { fontFamily: "Nunito_800ExtraBold", fontSize: 10, color: "#57718c", letterSpacing: 1 }, stepTitle: { fontFamily: "Nunito_800ExtraBold", fontSize: 17, color: "#102a43", marginTop: 4 },
  stepSubtitle: { fontFamily: "Nunito_600SemiBold", fontSize: 12, color: "#64748b", marginTop: 3 }, card: { backgroundColor: "#fff", borderRadius: 22, padding: 15, shadowColor: "#000", shadowOpacity: .08, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 4 },
  field: { marginBottom: 12 }, label: { fontFamily: "Nunito_700Bold", fontSize: 12, color: "#425466", marginBottom: 6 },
  input: { minHeight: 46, borderWidth: 1, borderColor: "#ced8e3", borderRadius: 12, paddingHorizontal: 13, paddingVertical: 10, color: "#102a43", backgroundColor: "#fbfdff", fontFamily: "Nunito_600SemiBold" },
  timeButton: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  timeText: { fontFamily: "Nunito_700Bold", color: "#102a43" },
  readonly: { backgroundColor: "#f1f5f9" }, multiline: { minHeight: 115, textAlignVertical: "top" }, row: { flexDirection: "row", gap: 10 },
  choices: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 }, choice: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, borderWidth: 1, borderColor: "#c9d5e2" },
  choiceList: { marginBottom: 8 },
  choiceSelected: { backgroundColor: "#111918", borderColor: "#111918" }, choiceText: { fontFamily: "Nunito_700Bold", fontSize: 12, color: "#45617c" }, choiceTextSelected: { color: "#fff" },
  selectRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 11, borderRadius: 12, borderWidth: 1, borderColor: "#dce4ed", marginBottom: 8 },
  selectRowSelected: { borderColor: "#78a8d2", backgroundColor: "#eef6fc" },
  selectRowDisabled: { opacity: 0.72, backgroundColor: "#fff4f2", borderColor: "#fecaca" },
  selectLabel: { fontFamily: "Nunito_700Bold", fontSize: 12, color: "#243b53" },
  selectDetail: { fontFamily: "Nunito_600SemiBold", fontSize: 10, color: "#718096", marginTop: 2 },
  outOfOperationText: { color: "#b42318" },
  dropdownButton: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 13, paddingVertical: 9, borderRadius: 12, borderWidth: 1, borderColor: "#ced8e3", backgroundColor: "#fbfdff" },
  dropdownText: { fontFamily: "Nunito_700Bold", fontSize: 12, color: "#243b53" }, dropdownPlaceholder: { color: "#8a98a8" },
  dropdownMenu: { marginTop: 6, marginBottom: 5, overflow: "hidden", borderRadius: 12, borderWidth: 1, borderColor: "#dce4ed", backgroundColor: "#fff" },
  dropdownOption: { minHeight: 50, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 13, paddingVertical: 9, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#dce4ed" },
  fileButton: { minHeight: 46, borderRadius: 12, borderWidth: 1, borderColor: "#b9cbe0", borderStyle: "dashed", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, backgroundColor: "#f8fbfe" },
  fileButtonText: { fontFamily: "Nunito_700Bold", color: "#111918" }, fileName: { fontFamily: "Nunito_600SemiBold", fontSize: 11, color: "#64748b", marginTop: 5 },
  warning: { fontFamily: "Nunito_600SemiBold", fontSize: 12, color: "#9a5800", backgroundColor: "#fff5db", borderRadius: 10, padding: 10 },
  areaTitle: { fontFamily: "Nunito_800ExtraBold", fontSize: 16, color: "#111918" }, helper: { fontFamily: "Nunito_600SemiBold", color: "#64748b" }, helperLeft: { fontFamily: "Nunito_600SemiBold", color: "#64748b", fontSize: 11, marginVertical: 7 },
  mapWrap: { height: 380, overflow: "hidden", borderRadius: 14, borderWidth: 1, borderColor: "#cbd8e5" }, mapActions: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  summaryRow: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#edf1f5" }, summaryLabel: { fontFamily: "Nunito_700Bold", fontSize: 11, color: "#64748b" }, summaryValue: { fontFamily: "Nunito_800ExtraBold", fontSize: 13, color: "#1f3449", marginTop: 3 },
  footer: { flexDirection: "row", justifyContent: "space-between", gap: 12, marginTop: 15 }, outlineButton: { minHeight: 46, paddingHorizontal: 15, borderRadius: 13, borderWidth: 1, borderColor: "#cdd8e4", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5 },
  outlineText: { fontFamily: "Nunito_700Bold", color: "#111918" }, primaryButton: { minHeight: 46, paddingHorizontal: 17, borderRadius: 16, backgroundColor: "#111918", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5 },
  primaryText: { fontFamily: "Nunito_800ExtraBold", color: "#fff" }, disabled: { opacity: .55 },
});
