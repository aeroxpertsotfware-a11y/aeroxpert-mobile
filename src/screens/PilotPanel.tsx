// src/screens/PilotPanel.tsx
import React, { useEffect, useMemo, useState, useCallback, ReactNode } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  Modal,
  Keyboard,
  KeyboardAvoidingView,
  Image,
  Platform,
  ActivityIndicator,
  RefreshControl,
  GestureResponderEvent,
  Animated,
  Easing,
  PanResponder,
  Dimensions,
  Linking,
  AppState,
  TouchableWithoutFeedback,
  Alert,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";


import { StatusBar } from "expo-status-bar";
import { MaterialCommunityIcons, Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import * as SecureStore from "expo-secure-store";
import DateTimePicker, { DateTimePickerAndroid, DateTimePickerEvent } from "@react-native-community/datetimepicker";
import * as Speech from "expo-speech";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { WebView } from "react-native-webview";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import * as Location from "expo-location";
import { Magnetometer } from "expo-sensors";
import { ExpoSpeechRecognitionModule,useSpeechRecognitionEvent,} from "expo-speech-recognition";
import { apiPost as apiPostReq } from "../config/api";
import Toast from "react-native-toast-message";
import { useAuth } from "../context/AuthContext";
import NetInfo from "@react-native-community/netinfo";
import {
  enqueueOfflineAction,
  getOfflineActions,
  persistOfflineFiles,
  syncOfflineActions,
} from "../offline/fieldSync";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";








import { API_URL } from "../config/api";
import { apiUploadForm } from "../services/api";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { socket } from "../services/socket";
import { DJITelemetry } from "../native/djiTelemetry";
import {
  DJIFlightLogKnownSource,
  DJIFlightLogScannedFile,
  DJIFlightLogScannedLocation,
  DJIFlightLogSourceApp,
  DJIFlightLogSync,
} from "../native/djiFlightLogSync";
import {
  getDJIDirectSyncSettings,
  getDJIDirectSyncSnapshot,
  getPendingDJIFlightLogs,
  markDJIFlightLogsUploaded,
  saveDJIDirectSyncSettings,
} from "../services/djiFlightLogSync";
import {
  FlightLogUploadResult,
  MAX_FLIGHT_LOG_SIZE_BYTES,
  uploadFlightLogsOnline as uploadFlightLogsOnlineService,
} from "../services/flightLogUpload";
import { getFlightLogBitacoraPrefill } from "../services/flightLogBitacora";
import MissionPlannerScreen from "./MissionPlannerScreen";
import ChiefManagementScreen from "./ChiefManagementScreen";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

type ApiOk<T = any> = {
  ok: boolean;
  data?: T;
  msg?: string;
};

type GpsCellState = {
  enabled: boolean;
  label: string;
  lat?: number | null;
  lon?: number | null;
};

type WeatherState = {
  ok: boolean;
  label: string;
  tempC?: number | null;
  windMs?: number | null;
};

type WeatherFlightState = "APTAS" | "MARGINALES" | "NO_RECOMENDADAS";

type WeatherDetailState = WeatherState & {
  windDirDeg?: number | null;
  windDirLabel?: string;
  windGustMs?: number | null;
  precipProbPct?: number | null;
  rainMm?: number | null;
  visibilityM?: number | null;
  cloudCoverPct?: number | null;
  cloudBaseM?: number | null;
  humidityPct?: number | null;
  pressureHpa?: number | null;
  radiationWm2?: number | null;
  kpIndex?: number | null;
  satVisibleEst?: number | null;
  satBlockedEstPct?: number | null;
  flightState: WeatherFlightState;
  reasons: string[];
  updatedAt?: string | null;
};

type WeatherHourItem = {
  key: string;
  isoTime: string;
  dayKey: string;
  timeLabel: string;
  satVisibleEst: number | null;
  cloudBaseM: number | null;
  precipProbPct: number | null;
  flightState: WeatherFlightState;
};

type CompassState = {
  supported: boolean;
  headingDeg: number | null;
  headingLabel: string;
};

type ChatMsg = { role: "user" | "bot"; text: string; at: string };

type Section =
  | "dashboard"
  | "ops-summary"
  | "pilot-profile"
  | "dji-cloud"
  | "weather"
  | "equipos-uas"
  | "new-report"
  | "my-reports"
  | "mor-reports"
  | "flight-log"
  | "missions"
  | "procedures"
  | "chief-management";

type AlertTipo = "warning" | "info" | "error" | "success";

type Usuario = {
  _id: string;
  nombre: string;
  documento?: string;
  cipu?: string;
  foto?: string | null;
  fechaCertificado?: string; 
  fechaLicencia?: string;
  fechaLicenciaUas?: string;
  fechaPoliza?: string;
  fechaSeguro?: string;
  adiciones?: string[];
  rol?: string;
  roles?: string[];
  email?: string;
  empresaId?: string;
  rolActivo?: string;
  fechaCertificadoInicio?: string;
  documentosCampo?: {
    certificadoMedico?: CampoDocument | null;
    cipu?: CampoDocument | null;
    arl?: CampoDocument | null;
  };
};

type CampoDocument = {
  key?: string;
  name?: string;
  mime?: string;
  size?: number;
  uploadedAt?: string;
  fechaInicio?: string | null;
  fechaVencimiento?: string | null;
};

type PanicAlertApiResponse = {
  ok: boolean;
  message?: string;
  alertaId?: string;
  mapa?: {
    googleMaps?: string;
    openStreetMap?: string;
  };
};

type Alerta = {
  _id: string;
  fecha: string;
  tipo: string;
  mensaje: string;
  estado: string;
  nivel?: AlertTipo;
};

type ReporteUI = Reporte & {
  _local?: boolean;     
  localId?: string;     
  createdAt?: string;   
};

type Reporte = {
  _id: string;
  fecha: string;
  tipo: string;
  tipoCode?: string;
  tipoLabel?: string;
  spiCode?: string;
  spiLabel?: string;
  tipoSituacion?: string;
  esAnonimo?: boolean;
  evidencias?: Array<{ nombre?: string; mime?: string; uri?: string }>;
  descripcion: string;
  ubicacion?: string;
  userId?: any;
  reporteClase?: "SMS" | "MOR" | "VOLUNTARIO" | string;
  mor?: any;
  estado: "Pendiente" | "En revisión" | "Cerrado" | "Abierto" | string;
};



type DjiCloudStatus = {
  ok: boolean;
  connected: boolean;
  sourceApp: "DJI_FLY" | "DJI_GO_4" | "DJI_PILOT_2";
  integrationMode?: "consumer_local" | "enterprise_cloud";
  accountIdentifier: string;
  accountDisplayName: string;
  estado: "desconectada" | "conectada" | "pendiente_sync" | "sync_error";
  syncEnabled: boolean;
  ultimoSyncAt?: string | null;
  ultimoIntentoSyncAt?: string | null;
  syncSolicitadoAt?: string | null;
  ultimoVueloAt?: string | null;
  totalVuelosSincronizados: number;
  ultimoError?: string;
  ultimoResumenSync?: string;
  ultimoRunId?: string | null;
  notasIntegracion?: string;
  message?: string;
  sync?: {
    ok?: boolean;
    connectorReady?: boolean;
    runId?: string;
    estado?: string;
    flightsDetected?: number;
    flightsCreated?: number;
    flightsUpdated?: number;
    message?: string;
  };
};

type DjiCloudFlight = {
  id: string;
  originalName: string;
  source: string;
  externalProvider: string;
  externalFlightId: string;
  deviceTime?: string | null;
  createdAt?: string | null;
  summary?: {
    durationSec?: number | null;
    startTime?: string | null;
    endTime?: string | null;
    maxAltitudeM?: number | null;
    totalDistanceM?: number | null;
    maxSpeedMps?: number | null;
  };
  parseStatus?: string;
};

type DjiCloudSyncRunItem = {
  id: string;
  estado: string;
  sourceApp: string;
  requestedAt?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  flightsDetected: number;
  flightsCreated: number;
  flightsUpdated: number;
  connectorReady: boolean;
  message?: string;
  error?: string;
};

type DJIDirectSyncSettingsState = {
  enabled: boolean;
  lastScanAt?: string | null;
  lastSuccessAt?: string | null;
  lastError?: string | null;
};

type DJIDirectSyncUploadEntry = {
  id: string;
  name: string;
  sourceApp: DJIFlightLogSourceApp;
  uploadedAt: string;
};

const DJI_SOURCE_PICKER_HINTS: Record<DJIFlightLogSourceApp, string> = {
  DJI_FLY: "Selecciona la carpeta Android/data/dji.go.v5/files/LOG de DJI Fly.",
  DJI_GO_4: "Selecciona la carpeta DJI/dji.go.v4/LOG o la carpeta de FlightRecord de DJI GO 4.",
  DJI_PILOT_2: "Selecciona la carpeta LOG o FlightRecord de DJI Pilot / Pilot 2.",
};

function uniqueById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const id = String(item?.id || "");
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

const REPORT_TAXONOMY = [
  { code: "U-ARC", label: "Aterrizaje en ubicación no planeada/emergencia (La aeronave no llega al punto autorizado)" },
  { code: "U-MAC-1", label: "Cuasi colisión con aeronave tripulada (pérdida de separación con aeronave tripulada)" },
  { code: "U-WILD", label: "Cuasi colisión con fauna (eventos relacionados con fauna durante la operación)" },
  { code: "U-MAC-2", label: "Cuasi colisión con otro UA (dos UA casi impactan, riesgo de daño significativo)" },
  { code: "U-CFIT-1", label: "Cuasi colisión con obstáculo/infraestructura (acercamiento no controlado a elementos fijos)" },
  { code: "U-SCF-NP(1)", label: "Fallas en baterías (descargas abruptas, voltajes anómalos, degradación)" },
  { code: "U-GTI", label: "Lesiones o golpes/impactos a terceros (daños leves no significativos a personas o bienes)" },
  { code: "U-LOC-1", label: "Pérdida de control (piloto o UA pierde control total generando riesgo severo)" },
  { code: "U-CFIT-2", label: "Pérdida de control con colisión contra el terreno (pierde control e impacta el terreno)" },
  { code: "U-SCF-NP(2)", label: "Pérdida del enlace C2 (monitoreo del deterioro del enlace antes de pérdida total)" },
] as const;

const INCIDENT_TYPES = [
  "Caída de dron",
  "Pérdida de enlace",
  "Intrusión espacio aéreo",
  "Lesión personal",
  "Daño a propiedad",
  "Otro",
] as const;

const MOR_TAXONOMY = [
  { code: "UA-CTOL", label: "Colisión con obstúculos durante despegue o aterrizaje" },
  { code: "UA-SCF-NP", label: "Falla o mal funcionamiento de transmisi?n desde estación de control" },
  { code: "UA-SCF-NP", label: "Falla en sistemas o componentes de comunicaciones a bordo" },
  { code: "UA-SCF-NP", label: "Falla de componentes del datalink" },
  { code: "UA-LOC-I", label: "Pérdida de control en vuelo" },
  { code: "UA-GCOL", label: "Cuasi colisión con RPA" },
  { code: "UA-SEC", label: "Operación sin autorización" },
  { code: "UA-SEC", label: "Ingreso a espacio aéreo sin autorización" },
  { code: "UA-SEC", label: "Excursión de límites del Mando Operativo Aeroespacial (MOA)" },
  { code: "UA-ATM", label: "Comunicaciones incorrectas o ausentes con ATC" },
  { code: "UA-ATM", label: "Coordinación deficiente relacionada con operación UAS" },
  { code: "UA-NAV", label: "Reporte incorrecto de posición del RPA" },
] as const;


type SpiRelation = {
  spiCode: string;
  spiLabel: string;
};

const SPI_TAXONOMY_BY_CODE: Record<string, string> = {
  ...Object.fromEntries(REPORT_TAXONOMY.map((item) => [item.code, item.label])),
  "U-MAC-3": "Pérdida de separación entre aeronaves",
};

function normalizeTaxonomyText(value: string) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim();
}

function resolveSpiRelation(
  reporteClase: string,
  tipoCode: string,
  tipoLabel: string
): SpiRelation | null {
  const code = String(tipoCode || "").trim().toUpperCase();
  const label = normalizeTaxonomyText(tipoLabel);

  if (!code) return null;

  if (code.startsWith("U-")) {
    const spiLabel = SPI_TAXONOMY_BY_CODE[code];
    return spiLabel ? { spiCode: code, spiLabel } : null;
  }

  if (code === "UA-CTOL" || label.includes("COLISION CON OBSTACULO")) {
    return {
      spiCode: "U-ARC",
      spiLabel: SPI_TAXONOMY_BY_CODE["U-ARC"],
    };
  }


  if (code === "UA-GCOL" || label.includes("CUASI COLISION CON OTRA AERONAVE") || label.includes("CUASI COLISION CON RPA")) {
    return {
      spiCode: "U-MAC-2",
      spiLabel: SPI_TAXONOMY_BY_CODE["U-MAC-2"],
    };
  }

  if (code === "UA-LOC-I" || label.includes("PERDIDA DE CONTROL EN VUELO")) {
    return {
      spiCode: "U-LOC-1",
      spiLabel: SPI_TAXONOMY_BY_CODE["U-LOC-1"],
    };
  }

  if (code === "UA-SCF-NP" && label.includes("BATER")) {
    return {
      spiCode: "U-SCF-NP(1)",
      spiLabel: SPI_TAXONOMY_BY_CODE["U-SCF-NP(1)"],
    };
  }

  if (
    code === "UA-SCF-NP" ||
    label.includes("TRANSMISION DESDE ESTACION DE CONTROL") ||
    label.includes("COMUNICACIONES A BORDO") ||
    label.includes("DATALINK")
  ) {
    return {
      spiCode: "U-SCF-NP(2)",
      spiLabel: SPI_TAXONOMY_BY_CODE["U-SCF-NP(2)"],
    };
  }

  if (code === "UA-SEC") {
    return {
      spiCode: "U-GTI",
      spiLabel: SPI_TAXONOMY_BY_CODE["U-GTI"],
    };
  }

  if (code === "UA-ATM") {
    return {
      spiCode: "U-MAC-1",
      spiLabel: SPI_TAXONOMY_BY_CODE["U-MAC-1"],
    };
  }

  if (code === "UA-NAV") {
    return {
      spiCode: "U-MAC-3",
      spiLabel: SPI_TAXONOMY_BY_CODE["U-MAC-3"],
    };
  }

  return null;
}

type Mision = {
  adjuntos?: Array<{
    key?: string;
    name?: string;
    mime?: string;
    size?: number;
    uploadedAt?: string;
  }>;
  autorizacionVuelo?: {
    key?: string;
    name?: string;
    mime?: string;
    size?: number;
    uploadedAt?: string;
  } | null;
  prioridad?: "Alta" | "Media" | "Baja" | string;
  aeronaveSugerida?: string;
  evidenciasPendientes?: number;
  kmzUrl: any;
  kmlUrl: any;
  fecha: ReactNode;
  piloto: ReactNode;
  _id: string;
  titulo: string;
  descripcion?: string;
  instrucciones?: string;
  fechaOperacion: string;   
  horaInicio?: string;
  horaFin?: string;
  ubicacionGeneral?: string;
  altitudMax?: number;
  vientoMax?: number;
  estado: string;
  areaOperacion?: any | null; // acá viene el polígono/geojson
  pilotosAsignados?: any[];   // si lo populaste
  creadoPor?: any;
  observadorId?: any;
  esRepetitiva?: boolean;
  serieRepetitivaId?: string | null;
  fechaInicioRepeticion?: string | null;
  fechaFinRepeticion?: string | null;
  estadoAutorizacionVuelo?: "disponible" | "pendiente_gestion" | "no_requiere" | string;
  responsableAutorizacionVuelo?: "piloto" | "jefepilotos" | string;
  estadoAprobacion?: "no_requerida" | "pendiente" | "aprobada" | "devuelta" | string;
  motivoDevolucion?: string;
  relacionUsuario?: {
    creadaPorMi?: boolean;
    asignadaAMi?: boolean;
    soyObservador?: boolean;
  };
};
type Vuelo = {
  _id: string;
  misionId?: string;
  fechaHora: string;
  horaInicio?: string;
  horaFin?: string;
  ubicacion: string;
  uas: string;
  proposito: string;
  tipoOperacion: "VLOS" | "EVLOS" | "BVLOS";
  categoriaOperacion?: "recreativa" | "comercial" | "entrenamiento" | "inspección" | "filmación" | "topografía" | string;
  duracionMin: number;
  nombrePiloto?: string;
  identificacionPiloto?: string;
  licenciaPiloto?: string;
  empresaOperador?: string;
  lugarOperacion?: string;
  municipio?: string;
  departamento?: string;
  coordenadasOperacion?: string;
  altitudMaxAlcanzada?: number | null;
  areaOperacion?: string;
  tipoMision?: "inspección" | "vigilancia" | "fotografía" | "topografía" | "mapeo" | string;
  condicionMeteorologica?: "despejado" | "parcialmente nublado" | "nublado" | "lluvia" | string;
  velocidadViento?: number | null;
  temperatura?: number | null;
  visibilidad?: string;
  numeroDespegues?: number | null;
  numeroAterrizajes?: number | null;
  tiempoTotalVueloMin?: number | null;
  bateriasUtilizadas?: string;
  bateriasDetalle?: Array<{
    serial: string;
    duracionMin: number;
    logs: number;
    cicloReportado?: number | null;
  }>;
  distanciaTotalM?: number;
  velocidadPromedioMps?: number;
  velocidadMaximaMps?: number;
  fotografiasCapturadas?: number;
  rutaConsolidada?: Array<{
    lat: number;
    lon: number;
    alt?: number | null;
    t?: number | null;
    logId?: string | null;
  }>;
  payload?: string;
  checklistPrevueloRealizado?: boolean | null;
  evaluacionRiesgos?: string;
  zonaSeguraEstablecida?: boolean | null;
  huboIncidente?: boolean | null;
  descripcionNovedad?: string;
  accionesTomadas?: string;
  nombrePilotoResponsable?: string;
  firmaPiloto?: string;
  firmaOperador?: string;
  notas?: string;
  logUrl?: string | null;
};

type EquipoUAS = {
  _id: string;
  ruas: string;
  serie: string;
  modelo: string;
  horasVuelo?: number;
  estado?: string;
  fotoUrl?: string | null;
  polizaVigencia?: string | null;
  polizaVence?: string | null;
  manualUsuarioLink?: string | null;
  polizaPdf?: { key?: string; name?: string } | null;
  ruasPdf?: { key?: string; name?: string } | null;
  arrendado?: boolean;
  fechaInicioArrendamiento?: string | null;
  fechaFinArrendamiento?: string | null;
  mantIntervaloHoras?: number;
  mantUmbralAviso?: number;
  mantUltimaHora?: number;
  createdAt?: string;
};

const normalizarEstadoEquipo = (estado?: string): string =>
  String(estado || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

const filtrarEquiposVisiblesParaPiloto = (rows: any[]): EquipoUAS[] =>
  (Array.isArray(rows) ? rows : []).filter((e) => {
    const s = normalizarEstadoEquipo(e?.estado);
    return s === "aeronavegable" || s === "operativo";
  });


type NuevoReportePayload = {
  tipoCode: string;
  tipoLabel: string;
  tipoSituacion?: string;
  esAnonimo?: boolean;
  evidencias?: Array<{ nombre: string; mime: string; uri: string }>;
  fechaHora: string;
  ubicacion: string;
  misionId?: string;      // ✅ nuevo
  descripcion: string;
  gravedad: string;
  reporteClase?: "SMS" | "MOR" | "VOLUNTARIO";
  mor?: any;
};


type NuevoVueloPayload = {
  misionId?: string;
  fechaHora: string;
  horaInicio?: string;
  horaFin?: string;
  ubicacion: string;
  uas: string;
  equipoId?: string;
  proposito: string;
  tipoOperacion: "VLOS" | "EVLOS" | "BVLOS";
  categoriaOperacion?: "recreativa" | "comercial" | "entrenamiento" | "inspección" | "filmación" | "topografía";
  duracionMin: number;
  nombrePiloto?: string;
  identificacionPiloto?: string;
  licenciaPiloto?: string;
  empresaOperador?: string;
  lugarOperacion?: string;
  municipio?: string;
  departamento?: string;
  coordenadasOperacion?: string;
  altitudMaxAlcanzada?: number;
  areaOperacion?: string;
  tipoMision?: "inspección" | "vigilancia" | "fotografía" | "topografía" | "mapeo";
  condicionMeteorologica?: "despejado" | "parcialmente nublado" | "nublado" | "lluvia";
  velocidadViento?: number;
  temperatura?: number;
  visibilidad?: string;
  numeroDespegues?: number;
  numeroAterrizajes?: number;
  tiempoTotalVueloMin?: number;
  bateriasUtilizadas?: string;
  bateriasDetalle?: Array<{
    serial: string;
    duracionMin: number;
    logs: number;
    cicloReportado?: number | null;
  }>;
  distanciaTotalM?: number;
  velocidadPromedioMps?: number;
  velocidadMaximaMps?: number;
  fotografiasCapturadas?: number;
  rutaConsolidada?: Array<{
    lat: number;
    lon: number;
    alt?: number | null;
    t?: number | null;
    logId?: string | null;
  }>;
  payload?: string;
  checklistPrevueloRealizado?: boolean;
  evaluacionRiesgos?: string;
  zonaSeguraEstablecida?: boolean;
  huboIncidente?: boolean;
  descripcionNovedad?: string;
  accionesTomadas?: string;
  nombrePilotoResponsable?: string;
  firmaPiloto?: string;
  firmaOperador?: string;
  flightLogIds?: string[];
  notas?: string;
};

type EvidencePicked = {
  id: string;
  uri: string;
  mime: string;
  name: string;
};

type FlightLogPicked = {
  id: string;
  uri: string;
  name: string;
  mimeType: string;
  size: number;
  ext: string;
};



/** ===================== PROPS ===================== */
type PilotPanelProps = {
  initialUser?: Usuario | null;
  logoSource?: any | null;
 onLogout: () => void | Promise<void>;
};


/** ===================== TIPOGRAFÍA ===================== */
const FONT = {
  regular: "Nunito_400Regular",
  semi: "Nunito_600SemiBold",
  bold: "Nunito_700Bold",
  extra: "Nunito_800ExtraBold",
  black: "Nunito_900Black",
};

const TEXT = {
  h1: { fontFamily: FONT.semi, fontSize: 18 },
  h2: { fontFamily: FONT.semi, fontSize: 16 },
  h3: { fontFamily: FONT.semi, fontSize: 14 },
  body: { fontFamily: FONT.semi, fontSize: 13, lineHeight: 18 },
  small: { fontFamily: FONT.semi, fontSize: 12, lineHeight: 16 },
};

/** ===================== HELPERS API ===================== */
const SECURE_TOKEN_KEY = "uas_token_v1";
const SECURE_PROFILE_KEY = "uas_profile_v1";
const SECURE_VUELOS_KEY = "uas_vuelos_v1";
const SECURE_EQUIPOS_KEY = "uas_equipos_v1";
const SECURE_REPORTES_KEY = "uas_reportes_v1";
const SECURE_MISIONES_KEY = "uas_misiones_v1";
const SECURE_PROC_QUEUE_KEY = "uas_proc_queue_v1";
const SECURE_REPORTES_QUEUE_KEY = "uas_reportes_queue_v1";
const SECURE_VUELOS_QUEUE_KEY = "uas_vuelos_queue_v1";
const SECURE_MISION_CUMPLIDA_QUEUE_KEY = "uas_mision_cumplida_queue_v1";
const SECURE_REPORTE_DRAFT_KEY = "uas_reporte_draft_v1";
const SECURE_FRAT_KEY = "uas_frat_v1";
const PAGE_SIZE_REPORTES = 6;
const PAGE_SIZE_BITACORA = 6;
const PAGE_SIZE_MISIONES = 4;

function normalizeMissionStatus(value: unknown): string {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function isMissionCompletedStatus(value: unknown): boolean {
  const status = normalizeMissionStatus(value);
  return status === "cumplida" || status === "finalizada";
}

function isMissionVisiblePendingStatus(value: unknown): boolean {
  return !isMissionCompletedStatus(value);
}
const PILOT_CARD_HEADER_LOGO = require("../../assets/avatar.png");
const PILOT_PANEL_BANNER_LOGO = require("../../assets/logo-inicio.png");
const FLYNORTH_BANNER_LOGO = require("../../assets/flynorth-empresa.png");
const ALFABOT_BOT_IMG = require("../../assets/AlfaBot.jpg");


type ProcKind = "preflight" | "autoeval" | "battery";

type PendingProc = {
  localId: string;
  createdAt: string;
  misionId: string;
  kind: ProcKind;
  payload: any; // el payload final que mandas al backend
};

function makeLocalId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function relationEntityId(value: any) {
  return String(value?._id || value?.id || value || "").trim();
}

function getMissionRelationLabels(mission: Mision, userId?: string) {
  const uid = String(userId || "").trim();
  const labels: Array<{ key: string; text: string; tone: "created" | "assigned" | "observer" }> = [];
  const createdByMe = mission.relacionUsuario?.creadaPorMi === true || (!!uid && relationEntityId(mission.creadoPor) === uid);
  const assignedToMe =
    mission.relacionUsuario?.asignadaAMi === true ||
    (!!uid && (mission.pilotosAsignados || []).some((pilot) => relationEntityId(pilot) === uid));
  const observerForMe = mission.relacionUsuario?.soyObservador === true || (!!uid && relationEntityId(mission.observadorId) === uid);
  if (createdByMe) {
    labels.push({ key: "created", text: "Creada por mí", tone: "created" });
  }
  if (assignedToMe) {
    labels.push({ key: "assigned", text: "Asignada a mí", tone: "assigned" });
  }
  if (observerForMe) {
    labels.push({ key: "observer", text: "Soy observador", tone: "observer" });
  }
  return labels;
}




async function enqueueProc(misionId: string, kind: ProcKind, payload: any) {
  const q = await getQueue<PendingProc>(SECURE_PROC_QUEUE_KEY);
  q.unshift({
    localId: makeLocalId("proc"),
    createdAt: new Date().toISOString(),
    misionId,
    kind,
    payload,
  });
  await setQueue(SECURE_PROC_QUEUE_KEY, q);
}

async function enqueueMisionCumplida(misionId: string) {
  const q = await getQueue<PendingMisionDone>(SECURE_MISION_CUMPLIDA_QUEUE_KEY);
  // evita duplicar por la misma misión
  if (q.some(x => x.misionId === misionId)) return;
  q.unshift({
    localId: makeLocalId("done"),
    createdAt: new Date().toISOString(),
    misionId,
  });
  await setQueue(SECURE_MISION_CUMPLIDA_QUEUE_KEY, q);
}



async function getQueue<T>(key: string): Promise<T[]> {
  const raw = await SecureStore.getItemAsync(key);
  if (!raw) return [];
  try { const arr = JSON.parse(raw); return Array.isArray(arr) ? arr : []; }
  catch { return []; }
}

async function setQueue<T>(key: string, arr: T[]) {
  await SecureStore.setItemAsync(key, JSON.stringify(arr), {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

type PendingMisionDone = {
  localId: string;
  createdAt: string;
  misionId: string;
};

type FratAnswerValue = string;

type FratAnswers = {
  sleep: FratAnswerValue;
  fitness: FratAnswerValue;
  weather: FratAnswerValue;
  daytime: FratAnswerValue;
  planning: FratAnswerValue;
  hazardId: FratAnswerValue;
  mitigation: FratAnswerValue;
  batteryStatus: FratAnswerValue;
  briefing: FratAnswerValue;
};

type FratRecord = {
  misionId: string;
  missionTitle: string;
  createdAt: string;
  leftTotal: number;
  rightTotal: number;
  total: number;
  riskLevel: "BAJO" | "PRECAUCION" | "PREOCUPACION" | "PELIGRO";
  blocked: boolean;
  observation: string;
  answers: FratAnswers;
};

type FratOption = {
  value: string;
  label: string;
  score: number;
};

type FratQuestion = {
  key: keyof FratAnswers;
  label: string;
  options: FratOption[];
};

type VueloUI = Vuelo & {
  _local?: boolean;
  localId?: string;
  createdAt?: string;
};

const FRAT_LEFT_QUESTIONS: FratQuestion[] = [
  {
    key: "sleep",
    label: "¿Dormiste bien?",
    options: [
      { value: "sleep_lt8", label: "Menos de 8 horas", score: 2 },
      { value: "sleep_gte8", label: "8 horas o más", score: 0 },
    ],
  },
  {
    key: "fitness",
    label: "¿Te sientes bien para volar?",
    options: [
      { value: "fitness_sick", label: "Resfriado / enfermo", score: 4 },
      { value: "fitness_tired", label: "Un poco cansado", score: 2 },
      { value: "fitness_ok", label: "Bien", score: 0 },
    ],
  },
  {
    key: "weather",
    label: "¿Cuáles son las condiciones meteorológicas al despegue?",
    options: [
      { value: "weather_visual", label: "Visual", score: 1 },
      { value: "weather_bruma", label: "Niebla o bruma", score: 3 },
      { value: "weather_storm", label: "Tormenta cercana", score: 4 },
    ],
  },
];

const FRAT_RIGHT_QUESTIONS: FratQuestion[] = [
  {
    key: "daytime",
    label: "¿El vuelo es de día o de noche?",
    options: [
      { value: "day", label: "Día", score: 1 },
      { value: "night", label: "Noche", score: 3 },
    ],
  },
  {
    key: "planning",
    label: "¿Cómo planificaste tu vuelo?",
    options: [
      { value: "rush", label: "Te apresuraste a despegar", score: 3 },
      { value: "planned", label: "Planificas sin prisa", score: 1 },
      { value: "checklist", label: "Planificas y sigues listas", score: 0 },
    ],
  },
  {
    key: "hazardId",
    label: "¿Realizaste identificación de peligros antes de la operación?",
    options: [
      { value: "yes", label: "Sí", score: 0 },
      { value: "no", label: "No", score: 3 },
    ],
  },
  {
    key: "mitigation",
    label: "¿Realizó medidas de mitigación ante peligros?",
    options: [
      { value: "yes", label: "Sí", score: 0 },
      { value: "no", label: "No", score: 3 },
    ],
  },
  {
    key: "batteryStatus",
    label: "¿Evaluó el estado de la batería antes del vuelo?",
    options: [
      { value: "yes", label: "Sí", score: 0 },
      { value: "no", label: "No", score: 3 },
    ],
  },
  {
    key: "briefing",
    label: "¿Realizó briefing con el personal?",
    options: [
      { value: "yes", label: "Sí", score: 0 },
      { value: "no", label: "No", score: 3 },
    ],
  },
];

const FRAT_ALL_QUESTIONS: FratQuestion[] = [...FRAT_LEFT_QUESTIONS, ...FRAT_RIGHT_QUESTIONS];

function createEmptyFratAnswers(): FratAnswers {
  return {
    sleep: "",
    fitness: "",
    weather: "",
    daytime: "",
    planning: "",
    hazardId: "",
    mitigation: "",
    batteryStatus: "",
    briefing: "",
  };
}

function getFratOptionScore(question: FratQuestion, value: string): number {
  return Number(question.options.find((option) => option.value === value)?.score ?? 0);
}

function getFratRiskLevel(total: number): FratRecord["riskLevel"] {
  if (total >= 30) return "PELIGRO";
  if (total >= 20) return "PREOCUPACION";
  if (total >= 10) return "PRECAUCION";
  return "BAJO";
}

function getFratRiskPresentation(level: FratRecord["riskLevel"]) {
  switch (level) {
    case "PELIGRO":
      return {
        accent: "#dc2626",
        pillBg: "#fee2e2",
        pillText: "#991b1b",
        helper: "Riesgo crítico. No debe iniciar la operación desde la app.",
      };
    case "PREOCUPACION":
      return {
        accent: "#f97316",
        pillBg: "#ffedd5",
        pillText: "#9a3412",
        helper: "Área de preocupación. Registra una observación antes de continuar.",
      };
    case "PRECAUCION":
      return {
        accent: "#ca8a04",
        pillBg: "#fef3c7",
        pillText: "#854d0e",
        helper: "Opera con precaución. Verifica controles y confirma el entorno.",
      };
    default:
      return {
        accent: "#16a34a",
        pillBg: "#dcfce7",
        pillText: "#166534",
        helper: "Riesgo bajo. Puedes iniciar la operación al finalizar la evaluación.",
      };
  }
}

function pendingToVueloUI(p: PendingVuelo): VueloUI {
  return {
    _id: p.localId,
    fechaHora: p.payload.fechaHora,
    horaInicio: p.payload.horaInicio,
    horaFin: p.payload.horaFin,
    ubicacion: p.payload.ubicacion,
    uas: p.payload.uas,
    proposito: p.payload.proposito,
    tipoOperacion: p.payload.tipoOperacion,
    categoriaOperacion: p.payload.categoriaOperacion,
    duracionMin: p.payload.duracionMin,
    nombrePiloto: p.payload.nombrePiloto,
    identificacionPiloto: p.payload.identificacionPiloto,
    licenciaPiloto: p.payload.licenciaPiloto,
    empresaOperador: p.payload.empresaOperador,
    lugarOperacion: p.payload.lugarOperacion,
    municipio: p.payload.municipio,
    departamento: p.payload.departamento,
    coordenadasOperacion: p.payload.coordenadasOperacion,
    altitudMaxAlcanzada: p.payload.altitudMaxAlcanzada,
    areaOperacion: p.payload.areaOperacion,
    tipoMision: p.payload.tipoMision,
    condicionMeteorologica: p.payload.condicionMeteorologica,
    velocidadViento: p.payload.velocidadViento,
    temperatura: p.payload.temperatura,
    visibilidad: p.payload.visibilidad,
    numeroDespegues: p.payload.numeroDespegues,
    numeroAterrizajes: p.payload.numeroAterrizajes,
    tiempoTotalVueloMin: p.payload.tiempoTotalVueloMin,
    bateriasUtilizadas: p.payload.bateriasUtilizadas,
    payload: p.payload.payload,
    checklistPrevueloRealizado: p.payload.checklistPrevueloRealizado,
    evaluacionRiesgos: p.payload.evaluacionRiesgos,
    zonaSeguraEstablecida: p.payload.zonaSeguraEstablecida,
    huboIncidente: p.payload.huboIncidente,
    descripcionNovedad: p.payload.descripcionNovedad,
    accionesTomadas: p.payload.accionesTomadas,
    nombrePilotoResponsable: p.payload.nombrePilotoResponsable,
    firmaPiloto: p.payload.firmaPiloto,
    firmaOperador: p.payload.firmaOperador,
    notas: p.payload.notas,
    logUrl: p.logs?.length ? "PENDIENTE_OFFLINE" : null,
    _local: true,
    localId: p.localId,
    createdAt: p.createdAt,
  };
}

type PendingVuelo = {
  localId: string;
  createdAt: string;
  sending?: boolean;
  payload: NuevoVueloPayload;

  logs?: Array<{
    uri: string;
    name?: string;
    mimeType?: string;
    size?: number;
    sourceApp: "DJI_FLY" | "DJI_PILOT_2" | "DJI_GO_4";
  }>;
};

function makeLocalIdVuelo() {
  return `v_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

async function getVuelosQueue(): Promise<PendingVuelo[]> {
  const raw = await SecureStore.getItemAsync(SECURE_VUELOS_QUEUE_KEY);
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

async function setVuelosQueue(arr: PendingVuelo[]) {
  await SecureStore.setItemAsync(
    SECURE_VUELOS_QUEUE_KEY,
    JSON.stringify(arr),
    { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY }
  );
}

async function enqueueVuelo(payload: NuevoVueloPayload, logs?: PendingVuelo["logs"]) {
  const q = await getVuelosQueue();
  q.unshift({
    localId: makeLocalIdVuelo(),
    createdAt: new Date().toISOString(),
    payload,
    ...(logs?.length ? { logs } : {}),
  });
  await setVuelosQueue(q);
}

function getFlightLogExtension(name?: string) {
  const match = String(name || "").match(/\.([^.]+)$/);
  return match ? match[1].toLowerCase() : "";
}

function formatFlightLogSize(size?: number) {
  const bytes = Number(size || 0);
  if (!bytes) return "0 B";
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

function toFlightLogPicked(asset: any): FlightLogPicked {
  return {
    id: makeLocalId("flight_log"),
    uri: String(asset?.uri || ""),
    name: String(asset?.name || "archivo"),
    mimeType: String(asset?.mimeType || "application/octet-stream"),
    size: Number(asset?.size || 0),
    ext: getFlightLogExtension(asset?.name),
  };
}


type PendingReporte = {
  localId: string;
  createdAt: string;
  payload: {
    misionId?: string;
    fecha: string;
    tipoCode: string;
    tipoLabel: string;
    tipoSituacion?: string;
    esAnonimo?: boolean;
    evidencias?: Array<{ nombre: string; mime: string; uri: string }>;
    descripcion: string;
    gravedad: string;
    ubicacion?: string;
    reporteClase?: "SMS" | "MOR" | "VOLUNTARIO";
    mor?: any;
  };
};


async function getReporteQueue(): Promise<PendingReporte[]> {
  const raw = await SecureStore.getItemAsync(SECURE_REPORTES_QUEUE_KEY);
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

async function setReporteQueue(arr: PendingReporte[]) {
  await SecureStore.setItemAsync(
    SECURE_REPORTES_QUEUE_KEY,
    JSON.stringify(arr),
    { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY }
  );
}

async function enqueueReporte(payload: PendingReporte["payload"]) {
  const q = await getReporteQueue();
  q.unshift({
    localId: makeLocalId("reporte"),
    createdAt: new Date().toISOString(),
    payload,
  });
  await setReporteQueue(q);
}

async function getToken() {
  return (await SecureStore.getItemAsync(SECURE_TOKEN_KEY)) || "";
}

function decodeJwtAccess(tokenValue: string): { empresaId?: string; rolActivo?: string; rol?: string } {
  try {
    const payload = String(tokenValue || "").split(".")[1] || "";
    if (!payload) return {};
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const decoded = globalThis.atob(padded);
    const claims = JSON.parse(decoded);
    return {
      empresaId: String(claims?.empresaId || ""),
      rolActivo: String(claims?.rolActivo || claims?.rol || ""),
      rol: String(claims?.rol || ""),
    };
  } catch {
    return {};
  }
}

export async function apiPost<T>(
  path: string,
  body: any,
  token?: string,
  timeoutMs?: number
): Promise<T> {
  const url = `${API_URL}${normalizePath(path)}`;
  console.log("✅ [API POST]", url);

  try {
    const res = await withTimeout(
      fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
      }),
      timeoutMs ?? 12000
    );

    return handleResponse<T>(res); // res es Response ✅
  } catch (e: any) {
    if (e?.message?.includes("Timeout")) {
      throw new Error(`Timeout (${timeoutMs ?? 12000}ms). Revisa Wi-Fi/IP del servidor.`);
    }
    throw e;
  }
}



export async function apiPatch<T>(
  path: string,
  body: any,
  token?: string,
  timeoutMs?: number
): Promise<T> {
  const url = `${API_URL}${normalizePath(path)}`;
  console.log("✅ [API PATCH]", url);

  try {
    const res = await withTimeout(
      fetch(url, {
        method: "PATCH", // ✅ correcto
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
      }),
      timeoutMs ?? 12000 // ✅ timeout
    );

    return handleResponse<T>(res);
  } catch (e: any) {
    if (e?.name === "AbortError") {
      throw new Error(
        `Timeout (${timeoutMs ?? 12000}ms). Revisa Wi-Fi/IP del servidor.`
      );
    }
    throw e;
  }
}



function withTimeout<T>(promise: Promise<T>, ms = 12000): Promise<T> {
  return new Promise((resolve, reject) => {
    const id = setTimeout(() => reject(new Error("Timeout: servidor no respondió")), ms);

    promise
      .then((res) => {
        clearTimeout(id);
        resolve(res);
      })
      .catch((err) => {
        clearTimeout(id);
        reject(err);
      });
  });
}


function safeJsonParse(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}



async function apiFetch<T>(
  path: string,
  opts: RequestInit & { auth?: boolean } = { auth: true }
): Promise<T> {
  const url = `${API_URL}${normalizePath(path)}`;

  const headers: Record<string, string> = {
    Accept: "application/json",
    ...(opts.headers as any),
  };
  if (opts.body) {
    headers["Content-Type"] = "application/json";
  }

  if (opts.auth !== false) {
    const token = await getToken();
    if (!token) throw new Error("No autorizado (sin token). Inicia sesión otra vez.");
    headers.Authorization = `Bearer ${token}`;
  }

  // ✅ LOG 1: URL real
  console.log("ðŸŒ apiFetch URL:", url);

  // ✅ LOG 2: método + headers (sin mostrar token completo)
  console.log("➡️ apiFetch", opts.method || "GET", {
    ...headers,
    Authorization: headers.Authorization ? "Bearer ***" : undefined,
  });

  let res: Response;
  try {
    res = await withTimeout(fetch(url, { ...opts, headers }), 12000);
  } catch (e: any) {
    throw new Error(e?.message || "Network request failed");
  }

  const text = await res.text();
  const data = text ? safeJsonParse(text) : null;

  if (!res.ok) {
    // ✅ LOG 3: status + body del backend (CLAVE)
    console.log("❌ apiFetch FAIL", res.status, "body:", text);

    const msg =
      (data && (data.message || data.error || data.msg)) ||
      `Error ${res.status} en ${path}`;
    throw new Error(msg);
  }

  return (data ?? ({} as any)) as T;
}


async function getLocalProcStatusForMission(misionId: string) {
  const [q, fieldQueue] = await Promise.all([
    getQueue<PendingProc>(SECURE_PROC_QUEUE_KEY),
    getOfflineActions(),
  ]);
  const pendingKinds = fieldQueue
    .filter((item) => item.category === "procedure" && item.missionId === misionId)
    .map((item) => String(item.body?.offlineProcedureKind || ""));

  const local = {
    preflight: q.some(p => p.misionId === misionId && p.kind === "preflight") || pendingKinds.includes("preflight"),
    autoeval:  q.some(p => p.misionId === misionId && p.kind === "autoeval") || pendingKinds.includes("autoeval"),
    battery:   q.some(p => p.misionId === misionId && p.kind === "battery") || pendingKinds.includes("battery"),
  };

  return local;
}

type ProcStatus = { preflight: boolean; autoeval: boolean; battery: boolean };

async function canMarkMissionDone(
  misionId: string,
  procStatusMap: Record<string, ProcStatus>
) {
  const server = procStatusMap[misionId] || { preflight: false, autoeval: false, battery: false };
  const local = await getLocalProcStatusForMission(misionId);

  return {
    ok:
      (server.preflight || local.preflight) &&
      (server.autoeval || local.autoeval) &&
      (server.battery || local.battery),
    detail: { server, local },
  };
}


/** ===================== HELPERS FECHA/HORA ===================== */
function pad2(n: number) {
  return String(n).padStart(2, "0");
}
function formatDateTime(d: Date) {
  const yyyy = d.getFullYear();
  const mm = pad2(d.getMonth() + 1);
  const dd = pad2(d.getDate());
  const hh = pad2(d.getHours());
  const min = pad2(d.getMinutes());
  return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
}

function formatDateOnly(value?: string | Date | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10) || "—";
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function formatWeatherObservation(value?: string | null) {
  if (!value) return "sin hora";
  const raw = String(value);
  const localIso = raw.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/);
  if (localIso) return `${localIso[1]} ${localIso[2]}`;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? raw : formatDateTime(date);
}

function dateFromYmd(value?: string | null) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return new Date();
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function formatHourOnly(value?: string | Date | null) {
  if (!value) return "—";
  if (typeof value === "string" && /^\d{2}:\d{2}/.test(value)) return value.slice(0, 5);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

function hourOrEmpty(value?: string | Date | null) {
  const h = formatHourOnly(value);
  return h === "—" ? "" : h;
}

function normalizeVueloTimes(v: Vuelo): Vuelo {
  const inicio = (v.horaInicio || "").trim() || hourOrEmpty(v.fechaHora);
  let fin = (v.horaFin || "").trim();

  if (!fin && v.fechaHora && Number.isFinite(Number(v.duracionMin))) {
    const base = new Date(v.fechaHora);
    if (!Number.isNaN(base.getTime())) {
      const mins = Number(v.duracionMin || 0);
      if (mins > 0) {
        base.setMinutes(base.getMinutes() + mins);
        fin = hourOrEmpty(base);
      }
    }
  }

  return {
    ...v,
    horaInicio: inicio || v.horaInicio,
    horaFin: fin || v.horaFin,
  };
}

function startOfToday() {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now;
}

function sameDay(value?: string | Date | null) {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const base = startOfToday();
  return date.getFullYear() === base.getFullYear()
    && date.getMonth() === base.getMonth()
    && date.getDate() === base.getDate();
}

function diffMinutesFromNow(value?: string | Date | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return Math.round((date.getTime() - Date.now()) / 60000);
}

function formatRemainingMinutes(mins?: number | null) {
  if (mins == null || !Number.isFinite(mins)) return "—";
  if (mins <= 0) return "En curso";
  const hours = Math.floor(mins / 60);
  const minutes = mins % 60;
  if (hours <= 0) return `${minutes} min`;
  return `${hours} h ${minutes} min`;
}

function weatherCodeToEs(code?: number | null) {
  if (code == null || Number.isNaN(code)) return "Sin dato";
  if (code === 0) return "Despejado";
  if ([1, 2].includes(code)) return "Parcialmente nublado";
  if (code === 3) return "Nublado";
  if ([45, 48].includes(code)) return "Niebla";
  if ([51, 53, 55, 56, 57].includes(code)) return "Llovizna";
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return "Lluvia";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "Nieve";
  if ([95, 96, 99].includes(code)) return "Tormenta";
  return "Variable";
}

function deriveCurrentSkyLabel(input: {
  weatherCode?: number | null;
  cloudCoverPct?: number | null;
  radiationWm2?: number | null;
  rainMm?: number | null;
  isDay?: boolean;
}) {
  const code = Number(input.weatherCode ?? NaN);
  const cloud = Number(input.cloudCoverPct ?? NaN);
  const radiation = Number(input.radiationWm2 ?? NaN);
  const rain = Number(input.rainMm ?? NaN);
  const coded = weatherCodeToEs(input.weatherCode);

  if ([45, 48, 51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 71, 73, 75, 77, 80, 81, 82, 85, 86, 95, 96, 99].includes(code)) {
    return coded;
  }
  if (Number.isFinite(rain) && rain > 0.05) return "Lluvia";

  // La radiación actual ayuda a no presentar “nublado” cuando en campo
  // existe sol directo, aunque el modelo horario tenga mucha cobertura total.
  if (input.isDay && Number.isFinite(radiation)) {
    if (radiation >= 450 && (!Number.isFinite(cloud) || cloud <= 80)) return "Despejado";
    if (radiation >= 250) return "Parcialmente nublado";
  }
  if (Number.isFinite(cloud)) {
    if (cloud <= 20) return "Despejado";
    if (cloud <= 65) return "Parcialmente nublado";
    return "Nublado";
  }
  return coded;
}

function windDirectionToCardinal(deg?: number | null) {
  if (deg == null || Number.isNaN(deg)) return "—";
  const dirs = ["N", "NE", "E", "SE", "S", "SO", "O", "NO"];
  const index = Math.round((deg % 360) / 45) % 8;
  return dirs[index];
}

function headingToCardinal16(deg?: number | null) {
  if (deg == null || Number.isNaN(deg)) return "—";
  const dirs = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSO", "SO", "OSO", "O", "ONO", "NO", "NNO"];
  const idx = Math.round((((deg % 360) + 360) % 360) / 22.5) % 16;
  return dirs[idx];
}

function toDms(value?: number | null, isLat = true) {
  if (value == null || Number.isNaN(value)) return "—";
  const abs = Math.abs(value);
  const deg = Math.floor(abs);
  const minFloat = (abs - deg) * 60;
  const min = Math.floor(minFloat);
  const sec = Math.round((minFloat - min) * 60);
  const hemi = isLat ? (value >= 0 ? "N" : "S") : (value >= 0 ? "E" : "O");
  return `${deg}\u00B0${min}'${sec}" ${hemi}`;
}

function evaluateWeatherForFlight(input: {
  windMs?: number | null;
  gustMs?: number | null;
  precipProbPct?: number | null;
  rainMm?: number | null;
  visibilityM?: number | null;
  cloudCoverPct?: number | null;
  tempC?: number | null;
  weatherCode?: number | null;
}): { state: WeatherFlightState; reasons: string[] } {
  const reasons: string[] = [];
  const wind = Number(input.windMs ?? NaN);
  const gust = Number(input.gustMs ?? NaN);
  const precipProb = Number(input.precipProbPct ?? NaN);
  const rain = Number(input.rainMm ?? NaN);
  const visibility = Number(input.visibilityM ?? NaN);
  const cloud = Number(input.cloudCoverPct ?? NaN);
  const temp = Number(input.tempC ?? NaN);
  const code = Number(input.weatherCode ?? NaN);

  const hard =
    (Number.isFinite(wind) && wind >= 10) ||
    (Number.isFinite(gust) && gust >= 13) ||
    (Number.isFinite(rain) && rain >= 1) ||
    (Number.isFinite(precipProb) && precipProb >= 70) ||
    (Number.isFinite(visibility) && visibility < 3000) ||
    [95, 96, 99].includes(code);

  const marginal =
    (Number.isFinite(wind) && wind >= 7 && wind < 10) ||
    (Number.isFinite(gust) && gust >= 9 && gust < 13) ||
    (Number.isFinite(rain) && rain > 0 && rain < 1) ||
    (Number.isFinite(precipProb) && precipProb >= 40 && precipProb < 70) ||
    (Number.isFinite(visibility) && visibility >= 3000 && visibility < 5000) ||
    (Number.isFinite(cloud) && cloud > 85) ||
    (Number.isFinite(temp) && (temp < -2 || temp > 35));

  if (hard) {
    if (Number.isFinite(wind) && wind >= 10) reasons.push("Viento alto");
    if (Number.isFinite(gust) && gust >= 13) reasons.push("Ráfagas fuertes");
    if (Number.isFinite(rain) && rain >= 1) reasons.push("Lluvia no recomendable");
    if (Number.isFinite(precipProb) && precipProb >= 70) reasons.push("Alta probabilidad de precipitación");
    if (Number.isFinite(visibility) && visibility < 3000) reasons.push("Visibilidad reducida");
    if ([95, 96, 99].includes(code)) reasons.push("Riesgo de tormenta");
    return { state: "NO_RECOMENDADAS", reasons };
  }

  if (marginal) {
    if (Number.isFinite(wind) && wind >= 7) reasons.push("Viento moderado-alto");
    if (Number.isFinite(gust) && gust >= 9) reasons.push("Ráfagas variables");
    if (Number.isFinite(rain) && rain > 0) reasons.push("Lluvia ligera");
    if (Number.isFinite(precipProb) && precipProb >= 40) reasons.push("Probabilidad de precipitación media");
    if (Number.isFinite(visibility) && visibility < 5000) reasons.push("Visibilidad media");
    if (Number.isFinite(cloud) && cloud > 85) reasons.push("Nubosidad alta");
    if (Number.isFinite(temp) && (temp < -2 || temp > 35)) reasons.push("Temperatura extrema");
    return { state: "MARGINALES", reasons };
  }

  return { state: "APTAS", reasons: ["Condiciones dentro de rango recomendado"] };
}

function daysUntil(value?: string | Date | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const now = new Date();
  const startNow = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startDate = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  return Math.round((startDate - startNow) / (1000 * 60 * 60 * 24));
}

function formatDaysStatus(days?: number | null) {
  if (days == null) return "Sin fecha";
  if (days < 0) return `Vencido hace ${Math.abs(days)} d`;
  if (days === 0) return "Vence hoy";
  return `${days} d restantes`;
}

function legalPriority(days?: number | null) {
  if (days == null) return { label: "Sin dato", color: "#64748b" };
  if (days < 0) return { label: "Alta", color: "#b91c1c" };
  if (days <= 30) return { label: "Media", color: "#b45309" };
  return { label: "Baja", color: "#0f766e" };
}


/** ===================== COMPONENTE ===================== */

export default function PilotPanel({

  
  
  
  initialUser = null,
  logoSource = null,
  onLogout,
}: PilotPanelProps) {
  const { logout, token: ctxToken } = useAuth();

  const [showEvidenceModal, setShowEvidenceModal] = useState(false);
  const [evidenceMissionId, setEvidenceMissionId] = useState<string>("");
  const [evidenceNote, setEvidenceNote] = useState<string>("");
  const [evidenceItems, setEvidenceItems] = useState<EvidencePicked[]>([]);
  const [savingEvidence, setSavingEvidence] = useState(false);
  const [evidenceChecklist, setEvidenceChecklist] = useState({
    area: false,
    aeronave: false,
    equipo: false,
  });
  const [quickVoiceTarget, setQuickVoiceTarget] = useState<"report" | "evidence" | null>(null);

  const [alfabotOpen, setAlfabotOpen] = useState(false);
  const [alfabotLoading, setAlfabotLoading] = useState(false);
  const [alfabotDraft, setAlfabotDraft] = useState("");
  const [alfabotMessages, setAlfabotMessages] = useState<ChatMsg[]>([]);
  const alfabotScrollRef = React.useRef<ScrollView | null>(null);
  const alfabotWave1 = React.useRef(new Animated.Value(0)).current;
  const alfabotWave2 = React.useRef(new Animated.Value(0)).current;
  const [alfabotKbVisible, setAlfabotKbVisible] = useState(false);
  const [alfabotKeyboardHeight, setAlfabotKeyboardHeight] = useState(0);

  const [listening, setListening] = useState(false);
  const [heard, setHeard] = useState("");     // última frase reconocida
  const processingAnswerRef = React.useRef(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true); // por si quieres toggle
  const [isOnline, setIsOnline] = useState(true);

  const [flightLogFiles, setFlightLogFiles] = useState<FlightLogPicked[]>([]);
  const [flightLogResults, setFlightLogResults] = useState<FlightLogUploadResult[]>([]);
  const [savingFlight, setSavingFlight] = useState(false);
  const [showFlightDetailModal, setShowFlightDetailModal] = useState(false);
  const [selectedVuelo, setSelectedVuelo] = useState<VueloUI | null>(null);
  const [flightFilterDate, setFlightFilterDate] = useState("");
  const [flightFilterUas, setFlightFilterUas] = useState("");
  const [flightFilterMission, setFlightFilterMission] = useState("");
  const [showFlightFilterDate, setShowFlightFilterDate] = useState(false);
  const [showFlightFilterUasModal, setShowFlightFilterUasModal] = useState(false);
  const [showFlightFilterMissionModal, setShowFlightFilterMissionModal] = useState(false);
  const [reportesPage, setReportesPage] = useState(1);
  const [bitacoraPage, setBitacoraPage] = useState(1);
  const [bitacoraSolicitudes, setBitacoraSolicitudes] = useState<any[]>([]);
  const [bitacoraSolicitudesLoading, setBitacoraSolicitudesLoading] = useState(false);
  const [bitacoraSolicitando, setBitacoraSolicitando] = useState(false);
  const [misionesProgramadasPage, setMisionesProgramadasPage] = useState(1);
  const [misionesCumplidasPage, setMisionesCumplidasPage] = useState(1);

  const [flightLogSourceApp, setFlightLogSourceApp] =
    useState<"DJI_FLY" | "DJI_PILOT_2" | "DJI_GO_4">("DJI_FLY");
  const [djiCloudStatus, setDjiCloudStatus] = useState<DjiCloudStatus | null>(null);
  const [djiIntegrationMode, setDjiIntegrationMode] = useState<"consumer_local" | "enterprise_cloud">("consumer_local");
  const [djiCloudLoading, setDjiCloudLoading] = useState(false);
  const [djiCloudSaving, setDjiCloudSaving] = useState(false);
  const [djiCloudFlights, setDjiCloudFlights] = useState<DjiCloudFlight[]>([]);
  const [djiCloudRuns, setDjiCloudRuns] = useState<DjiCloudSyncRunItem[]>([]);
  const [djiCloudModalOpen, setDjiCloudModalOpen] = useState(false);
  const [djiCloudForm, setDjiCloudForm] = useState({
    accountIdentifier: "",
    accountDisplayName: "",
    password: "",
    confirmPassword: "",
  });
  const [djiDirectSyncSettings, setDjiDirectSyncSettings] = useState<DJIDirectSyncSettingsState>({ enabled: false });
  const [djiDirectSyncKnownSources, setDjiDirectSyncKnownSources] = useState<DJIFlightLogKnownSource[]>([]);
  const [djiDirectSyncLocations, setDjiDirectSyncLocations] = useState<DJIFlightLogScannedLocation[]>([]);
  const [djiDirectSyncPendingFiles, setDjiDirectSyncPendingFiles] = useState<DJIFlightLogScannedFile[]>([]);
  const [djiDirectSyncUploads, setDjiDirectSyncUploads] = useState<DJIDirectSyncUploadEntry[]>([]);
  const [djiDirectSyncBusy, setDjiDirectSyncBusy] = useState(false);
  const [djiDirectSyncLastMessage, setDjiDirectSyncLastMessage] = useState<string | null>(null);


  


   useEffect(() => {
    const unsub = NetInfo.addEventListener((s) => {
      const online = !!s.isConnected && !!s.isInternetReachable;
      setIsOnline(online);
      isOnlineRef.current = online;
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const makeWave = (v: Animated.Value, delayMs: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delayMs),
          Animated.timing(v, {
            toValue: 1,
            duration: 2000,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(v, { toValue: 0, duration: 0, useNativeDriver: true }),
        ])
      );
    const w1 = makeWave(alfabotWave1, 0);
    const w2 = makeWave(alfabotWave2, 1000);
    w1.start();
    w2.start();
    return () => {
      w1.stop();
      w2.stop();
    };
  }, [alfabotWave1, alfabotWave2]);

  useEffect(() => {
    if (alfabotOpen && !alfabotMessages.length) {
      setAlfabotMessages([
        {
          role: "bot",
          text: `Hola ${firstName || "Usuario"}, soy AlfaBot. Puedo ayudarte con operaciones UAS.`,
          at: new Date().toISOString(),
        },
      ]);
    }
  }, [alfabotOpen, alfabotMessages.length, firstName]);

  useEffect(() => {
    if (!alfabotOpen) return;
    const t = setTimeout(() => {
      alfabotScrollRef.current?.scrollToEnd({ animated: true });
    }, 0);
    return () => clearTimeout(t);
  }, [alfabotMessages, alfabotLoading, alfabotOpen]);

  useEffect(() => {
    const showEvt = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvt = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const showSub = Keyboard.addListener(showEvt, (event) => {
      setAlfabotKbVisible(true);
      setAlfabotKeyboardHeight(event?.endCoordinates?.height || 0);
    });
    const hideSub = Keyboard.addListener(hideEvt, () => {
      setAlfabotKbVisible(false);
      setAlfabotKeyboardHeight(0);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);



    // ===== STT CONFIG =====
  const STT_LANG_PRIMARY = "es-CO";
  const STT_LANG_FALLBACKS = ["es-ES", "es-US"];
  const sttLangRef = React.useRef<string>(STT_LANG_PRIMARY);

      const [user, setUser] = useState<any>(null);
      const [token, setToken] = useState<string>("");


  const [misionesPiloto, setMisionesPiloto] = useState<any[]>([]);
    const [repMisionId, setRepMisionId] = useState<string>("");

  const navigation = useNavigation<any>(); // rápido y funciona

  const insets = useSafeAreaInsets();

  const [section, setSection] = useState<Section>("dashboard");
  const [equiposViewMode, setEquiposViewMode] = useState<"fleet" | "hours">("fleet");
  const [maintenanceConfigMap, setMaintenanceConfigMap] = useState<Record<string, {
    intervaloHoras: string;
    umbralAviso: string;
    ultimaMantHoras: string;
  }>>({});
  const [savingMaintenanceId, setSavingMaintenanceId] = useState("");
  const [showNavScrollHint, setShowNavScrollHint] = useState<boolean>(true);

  const [usuario, setUsuario] = useState<Usuario | null>(initialUser);
  const [medicalCertificateStart, setMedicalCertificateStart] = useState("");
  const [medicalCertificateEnd, setMedicalCertificateEnd] = useState("");
  const [showMedicalStartDate, setShowMedicalStartDate] = useState(false);
  const [showMedicalEndDate, setShowMedicalEndDate] = useState(false);
  const [fieldDocumentBusy, setFieldDocumentBusy] = useState("");
  const [showMissionPlanner, setShowMissionPlanner] = useState(false);
  const [missionPlannerToken, setMissionPlannerToken] = useState("");
  const isFlyNorthCompany =
    String(usuario?.empresaId || "") === "69e04f2d17205ef6e90e5e95";
  const canPlanFlyNorthMission =
    isFlyNorthCompany &&
    ["piloto", "jefepilotos", "admin"].includes(
      String(usuario?.rolActivo || usuario?.rol || "").toLowerCase().trim()
    );
  const canApproveFlyNorthMission =
    isFlyNorthCompany &&
    [usuario?.rolActivo, usuario?.rol, ...(usuario?.roles || [])].some((role) => {
      const normalized = String(role || "").toLowerCase().trim();
      return ["jefepilotos", "jefe", "admin"].includes(normalized) || normalized.includes("jefe");
    });
  const normalizedActiveRole = String(usuario?.rolActivo || usuario?.rol || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[\s_-]+/g, "")
    .trim();
  const isChiefPilotRole = ["jefepilotos", "jefe", "admin", "administrador"].includes(normalizedActiveRole);
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [showPilotNotifications, setShowPilotNotifications] = useState(false);
  const [reportes, setReportes] = useState<Reporte[]>([]);
  const [misiones, setMisiones] = useState<Mision[]>([]);
  const [vuelos, setVuelos] = useState<Vuelo[]>([]);

  const [loadingDashboard, setLoadingDashboard] = useState<boolean>(true);
  const [loadingReportes, setLoadingReportes] = useState<boolean>(false);
  const [loadingVuelos, setLoadingVuelos] = useState<boolean>(false);
  const [loadingMisiones, setLoadingMisiones] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState(false);
  const [telemetry, setTelemetry] = useState<any>(null);
  const [djiStatus, setDjiStatus] = useState<any>(null);
  const [djiActionBusy, setDjiActionBusy] = useState(false);
  const [gpsCell, setGpsCell] = useState<GpsCellState>({
    enabled: false,
    label: "Sin activar",
    lat: null,
    lon: null,
  });
  const [weatherNow, setWeatherNow] = useState<WeatherState>({
    ok: false,
    label: "Sin dato",
    tempC: null,
    windMs: null,
  });
  const [weatherDetail, setWeatherDetail] = useState<WeatherDetailState>({
    ok: false,
    label: "Sin dato",
    tempC: null,
    windMs: null,
    windDirDeg: null,
    windDirLabel: "—",
    windGustMs: null,
    precipProbPct: null,
    rainMm: null,
    visibilityM: null,
    cloudCoverPct: null,
    cloudBaseM: null,
    humidityPct: null,
    pressureHpa: null,
    radiationWm2: null,
    kpIndex: null,
    satVisibleEst: null,
    satBlockedEstPct: null,
    flightState: "MARGINALES",
    reasons: ["Sin datos meteorológicos"],
    updatedAt: null,
  });
  const [weatherForecast, setWeatherForecast] = useState<WeatherHourItem[]>([]);
  const [dashboardMapTouchActive, setDashboardMapTouchActive] = useState(false);
  const [expandedForecastKeys, setExpandedForecastKeys] = useState<string[]>([]);
  const [selectedForecastDayIndex, setSelectedForecastDayIndex] = useState(0);
  const [currentPlaceLabel, setCurrentPlaceLabel] = useState("Ubicación actual");
  const [dashboardMapCenterTick, setDashboardMapCenterTick] = useState(0);
  const lastGoodGpsRef = React.useRef<{ lat: number | null; lon: number | null }>({
    lat: null,
    lon: null,
  });
  const [compass, setCompass] = useState<CompassState>({
    supported: false,
    headingDeg: null,
    headingLabel: "Inicializando",
  });
  const compassSubRef = React.useRef<any>(null);
  const compassPollRef = React.useRef<any>(null);
  const magnetometerSubRef = React.useRef<any>(null);
  const compassHeadingRef = React.useRef<number | null>(null);
  const gpsWatchRef = React.useRef<any>(null);

  const [showMisionSelectModal, setShowMisionSelectModal] = useState(false);
  const [showFlightMissionModal, setShowFlightMissionModal] = useState(false);

      const repMisionSelected = useMemo(() => {
        if (!repMisionId) return null;
        return (misiones || []).find((m) => m._id === repMisionId) || null;
      }, [repMisionId, misiones]);


  
  // ✅ MAPA DE MISIÓN (modal)
  const [showMisionMapa, setShowMisionMapa] = useState(false);
const [misionMapa, setMisionMapa] = useState<Mision | null>(null);
  const [activeMissionId, setActiveMissionId] = useState<string>("");


  const [showNewFlightModal, setShowNewFlightModal] = useState(false);
  const [flightMisionId, setFlightMisionId] = useState<string>("");
  const [panicSending, setPanicSending] = useState(false);
  const [showReportDetailModal, setShowReportDetailModal] = useState(false);
  const [showChecklistModal, setShowChecklistModal] = useState(false);
  const [showAutoevalModal, setShowAutoevalModal] = useState(false);
  const [showBatteryModal, setShowBatteryModal] = useState(false);
  const [showOperationFlowModal, setShowOperationFlowModal] = useState(false);
  const [showFratModal, setShowFratModal] = useState(false);
  const [operationMission, setOperationMission] = useState<Mision | null>(null);
  const [fratAnswers, setFratAnswers] = useState<FratAnswers>(createEmptyFratAnswers);
  const [fratObservation, setFratObservation] = useState("");
  const [fratRecordsMap, setFratRecordsMap] = useState<Record<string, FratRecord>>({});
  const [guidedFlowMissionId, setGuidedFlowMissionId] = useState<string | null>(null);
  const [operationStatusMap, setOperationStatusMap] = useState<
    Record<
      string,
      {
        qrReads: number;
        started: boolean;
        batteryChanges: number;
        finalized: boolean;
        awaitingTakeoff: boolean;
      }
    >
  >({});
  const operationLocationSubRef = React.useRef<Location.LocationSubscription | null>(null);
  const operationTrackRef = React.useRef<Array<{ lat: number; lon: number; accuracy?: number | null; at: string }>>([]);
  const operationTrackMissionRef = React.useRef("");

  type FlujoOperacionApi = {
    _id: string;
    misionId: string;
    pilotoId: string;
    estado: "PENDIENTE" | "EN_OPERACION" | "ATERRIZAJE_CAMBIO_BATERIA" | "FINALIZADA" | string;
    iniciadoAt?: string | null;
    finalizadoAt?: string | null;
    cambiosBateria?: any[];
    lecturasQr?: any[];
    eventos?: any[];
  };

  const [selectedReporte, setSelectedReporte] = useState<Reporte | null>(null);

  /** FORM: NUEVO REPORTE */
  const [repFormOpen, setRepFormOpen] = useState(false);
  const [repClase, setRepClase] = useState<"SMS" | "MOR" | "VOLUNTARIO">("SMS");
  const [repTipoCode, setRepTipoCode] = useState("");
const [repTipoLabel, setRepTipoLabel] = useState("");
const [showTipoReporteModal, setShowTipoReporteModal] = useState(false);
  const repSpiRelation = useMemo(
    () => resolveSpiRelation(repClase, repTipoCode, repTipoLabel),
    [repClase, repTipoCode, repTipoLabel]
  );
  const [reporteDraftReady, setReporteDraftReady] = useState(false);
  const [reportAttachments, setReportAttachments] = useState<EvidencePicked[]>([]);

  const [repFechaHora, setRepFechaHora] = useState("");
  const [repUbicacion, setRepUbicacion] = useState("");
  const [repNumeroVuelo, setRepNumeroVuelo] = useState("");
  const [repDescripcion, setRepDescripcion] = useState("");
  const [repGravedad, setRepGravedad] = useState("");
  const [repTipoSituacion, setRepTipoSituacion] = useState("");
  const [repEsAnonimo, setRepEsAnonimo] = useState(false);
  const [morCiudad, setMorCiudad] = useState("");
  const [morHoraLocal, setMorHoraLocal] = useState("");
  const [morNarrativa, setMorNarrativa] = useState("");
  const [morSeveridad, setMorSeveridad] = useState("Moderado");
  const [morRiesgo, setMorRiesgo] = useState("Tolerable");
  const [morReportaNombre, setMorReportaNombre] = useState("");
  const [morReportaCorreo, setMorReportaCorreo] = useState("");
  const [morExtra, setMorExtra] = useState({
    fechaActualizacion: "",
    proveedorNit: "",
    proveedorNombre: "",
    tipoProveedor: "Operador UAS",
    tipoProveedorOtro: "",
    modalidadOperacion: "Comercial",
    modalidadOperacionOtro: "",
    aeronave1Identificacion: "",
    aeronave1Marca: "",
    aeronave1Modelo: "",
    aeronave1Mtow: "",
    aeronave1Tipo: "Multirrotor",
    aeronave2Identificacion: "",
    aeronave2Marca: "",
    aeronave2Modelo: "",
    zonaOperacion: "Zona urbana",
    condicionMeteorologica: "VFR",
    latitud: "",
    longitud: "",
    altitudAprox: "",
    oaci: "",
    aerodromoNombre: "",
    tipoContactoVisual: "VLOS",
    faseOperacion: "Misión / Operación",
    pilotoNombre: "",
    pilotoDocumento: "",
    pilotoCertificado: "",
    observadorNombre: "",
    observadorDocumento: "",
    observadorCertificado: "",
    tipoDetalleEvento: "",
    evidenciaFotos: false,
    evidenciaVideo: false,
    evidenciaLogVuelo: false,
    evidenciaTelemetria: false,
    evidenciaOtros: false,
    evidenciaOtrosDetalle: "",
    causa1: "",
    causa2: "",
    causa3: "",
    causa4: "",
    causa5: "",
    reportaCargo: "",
    reportaContacto: "",
    firma: "",
    fechaFirma: "",
  });

  /** FORM: NUEVO INCIDENTE */
  const [showIncidentModal, setShowIncidentModal] = useState(false);
  const [incFecha, setIncFecha] = useState("");
  const [incTipo, setIncTipo] = useState("");
  const [incSeveridad, setIncSeveridad] = useState("");
  const [incUbicacion, setIncUbicacion] = useState("");
  const [incTitulo, setIncTitulo] = useState("");
  const [incDescripcion, setIncDescripcion] = useState("");
  const [incCausas, setIncCausas] = useState("");
  const [incAcciones, setIncAcciones] = useState("");
  const [incSaving, setIncSaving] = useState(false);
  const [incAttachments, setIncAttachments] = useState<EvidencePicked[]>([]);

  /** ✅ DATEPICKER (REPORTE) */
  const [repDateObj, setRepDateObj] = useState<Date | null>(null);
  const [showRepDate, setShowRepDate] = useState(false);
  const [showRepTime, setShowRepTime] = useState(false);
  const [syncSummary, setSyncSummary] = useState({
    reportes: 0,
    vuelos: 0,
    logs: 0,
    procedimientos: 0,
    misiones: 0,
  });

  /** FORM: NUEVO VUELO */
  const [flightFechaHora, setFlightFechaHora] = useState("");
  const [flightHoraInicio, setFlightHoraInicio] = useState("");
  const [flightHoraFin, setFlightHoraFin] = useState("");
  const [flightUbicacion, setFlightUbicacion] = useState("");
  const [flightUas, setFlightUas] = useState("");
  const [flightProposito, setFlightProposito] = useState("");
  const [flightTipoOperacion, setFlightTipoOperacion] = useState<"VLOS" | "EVLOS" | "BVLOS">("VLOS");
  const [flightCategoriaOperacion, setFlightCategoriaOperacion] = useState<"recreativa" | "comercial" | "entrenamiento" | "inspección" | "filmación" | "topografía">("comercial");
  const [flightDuracion, setFlightDuracion] = useState("");
  const [flightNombrePiloto, setFlightNombrePiloto] = useState("");
  const [flightIdentificacionPiloto, setFlightIdentificacionPiloto] = useState("");
  const [flightLicenciaPiloto, setFlightLicenciaPiloto] = useState("");
  const [flightEmpresaOperador, setFlightEmpresaOperador] = useState("");
  const [flightLugarOperacion, setFlightLugarOperacion] = useState("");
  const [flightMunicipio, setFlightMunicipio] = useState("");
  const [flightDepartamento, setFlightDepartamento] = useState("");
  const [flightCoordenadasOperacion, setFlightCoordenadasOperacion] = useState("");
  const [flightAltitudMaxAlcanzada, setFlightAltitudMaxAlcanzada] = useState("");
  const [flightAreaOperacion, setFlightAreaOperacion] = useState("");
  const [flightTipoMision, setFlightTipoMision] = useState<"inspección" | "vigilancia" | "fotografía" | "topografía" | "mapeo">("inspección");
  const [flightCondicionMeteorologica, setFlightCondicionMeteorologica] = useState<"despejado" | "parcialmente nublado" | "nublado" | "lluvia">("despejado");
  const [flightVelocidadViento, setFlightVelocidadViento] = useState("");
  const [flightTemperatura, setFlightTemperatura] = useState("");
  const [flightVisibilidad, setFlightVisibilidad] = useState("");
  const [flightNumeroDespegues, setFlightNumeroDespegues] = useState("");
  const [flightNumeroAterrizajes, setFlightNumeroAterrizajes] = useState("");
  const [flightTiempoTotalVueloMin, setFlightTiempoTotalVueloMin] = useState("");
  const [flightBateriasUtilizadas, setFlightBateriasUtilizadas] = useState("");
  const [flightPayload, setFlightPayload] = useState("");
  const [flightChecklistPrevueloRealizado, setFlightChecklistPrevueloRealizado] = useState<boolean>(false);
  const [flightEvaluacionRiesgos, setFlightEvaluacionRiesgos] = useState("");
  const [flightZonaSeguraEstablecida, setFlightZonaSeguraEstablecida] = useState<boolean>(false);
  const [flightHuboIncidente, setFlightHuboIncidente] = useState<boolean>(false);
  const [flightDescripcionNovedad, setFlightDescripcionNovedad] = useState("");
  const [flightAccionesTomadas, setFlightAccionesTomadas] = useState("");
  const [flightNombrePilotoResponsable, setFlightNombrePilotoResponsable] = useState("");
  const [flightFirmaPiloto, setFlightFirmaPiloto] = useState("");
  const [flightFirmaOperador, setFlightFirmaOperador] = useState("");
  const [flightNotas, setFlightNotas] = useState("");
  

  // ✅ AERONAVES (Equipos UAS)
  const [equipos, setEquipos] = useState<EquipoUAS[]>([]);
  const [loadingEquipos, setLoadingEquipos] = useState(false);
  const [equiposError, setEquiposError] = useState("");
  const [showEquipoForm, setShowEquipoForm] = useState(false);
  const [savingEquipo, setSavingEquipo] = useState(false);
  const [expandedEquipoIds, setExpandedEquipoIds] = useState<Record<string, boolean>>({});
  const [showBatteryForm, setShowBatteryForm] = useState(false);
  const [savingBattery, setSavingBattery] = useState(false);
  const [batteryForm, setBatteryForm] = useState({
    equipoId: "",
    nombre: "",
    marca: "",
    modelo: "",
    serial: "",
    ciclos: "0",
    maxCiclos: "200",
    fechaAdquisicion: "",
    notas: "",
  });
  const [editingEquipoId, setEditingEquipoId] = useState("");
  const [equipoForm, setEquipoForm] = useState({
    ruas: "",
    serie: "",
    modelo: "",
    horasVuelo: "0",
    estado: "Aeronavegable",
    polizaVigencia: "",
    polizaVence: "",
    manualUsuarioLink: "",
    arrendado: false,
    fechaInicioArrendamiento: "",
    fechaFinArrendamiento: "",
  });
  const [equipoFiles, setEquipoFiles] = useState<{
    foto?: { uri: string; name: string; mimeType: string };
    polizaPdf?: { uri: string; name: string; mimeType: string };
    ruasPdf?: { uri: string; name: string; mimeType: string };
  }>({});

  const [showEquiposModal, setShowEquiposModal] = useState(false);
  const [equipoSel, setEquipoSel] = useState<EquipoUAS | null>(null);


  // ✅ DATEPICKER (VUELO)
  const [flightDateObj, setFlightDateObj] = useState<Date | null>(null);
  const [showFlightDate, setShowFlightDate] = useState(false);
  const [showFlightTime, setShowFlightTime] = useState(false);
  type ProcStatus = { preflight: boolean; autoeval: boolean; battery: boolean };
  const [procStatusMap, setProcStatusMap] = useState<Record<string, ProcStatus>>({});
  const lastLocationPushRef = React.useRef<{ ts: number; lat: number | null; lng: number | null }>({
    ts: 0,
    lat: null,
    lng: null,
  });


    /** ✅ Keyboard helpers (fix teclado pegado en modales) */
  const closeKeyboard = useCallback(() => {
    Keyboard.dismiss();
    // En Android a veces queda el foco vivo: forzamos 2° dismiss
    if (Platform.OS === "android") {
      setTimeout(() => Keyboard.dismiss(), 50);
    }
  }, []);

  const closeMisionMapa = useCallback(() => {
    closeKeyboard();
    setShowMisionMapa(false);
    setMisionMapa(null);
  }, [closeKeyboard]);

  const closeEvidenceModal = useCallback(() => {
    closeKeyboard();
    setShowEvidenceModal(false);
    setEvidenceMissionId("");
    setEvidenceNote("");
    setEvidenceItems([]);
    setEvidenceChecklist({ area: false, aeronave: false, equipo: false });
    setQuickVoiceTarget(null);
  }, [closeKeyboard]);

  const closeFlightDetail = useCallback(() => {
    closeKeyboard();
    setShowFlightDetailModal(false);
    setSelectedVuelo(null);
  }, [closeKeyboard]);

  // ✅ Cerrar modales de forma segura (siempre cierran teclado)
  const closeReportDetail = useCallback(() => {
    closeKeyboard();
    setShowReportDetailModal(false);
  }, [closeKeyboard]);

  const closeChecklist = useCallback(() => {
    closeKeyboard();
    Speech.stop();
    stopAllVoice();
    setAssistantOn(false);
    setShowChecklistModal(false);
  }, [closeKeyboard]);

  const closeNewFlight = useCallback(() => {
    closeKeyboard();
    setShowEquiposModal(false);
    setFlightLogFiles([]);
    setFlightLogResults([]);
    setFlightFechaHora("");
    setFlightHoraInicio("");
    setFlightHoraFin("");
    setFlightUbicacion("");
    setFlightUas("");
    setFlightProposito("");
    setFlightTipoOperacion("VLOS");
    setFlightCategoriaOperacion("comercial");
    setFlightDuracion("");
    setFlightNombrePiloto("");
    setFlightIdentificacionPiloto("");
    setFlightLicenciaPiloto("");
    setFlightEmpresaOperador("");
    setFlightLugarOperacion("");
    setFlightMunicipio("");
    setFlightDepartamento("");
    setFlightCoordenadasOperacion("");
    setFlightAltitudMaxAlcanzada("");
    setFlightAreaOperacion("");
    setFlightTipoMision("inspección");
    setFlightCondicionMeteorologica("despejado");
    setFlightVelocidadViento("");
    setFlightTemperatura("");
    setFlightVisibilidad("");
    setFlightNumeroDespegues("");
    setFlightNumeroAterrizajes("");
    setFlightTiempoTotalVueloMin("");
    setFlightBateriasUtilizadas("");
    setFlightPayload("");
    setFlightChecklistPrevueloRealizado(false);
    setFlightEvaluacionRiesgos("");
    setFlightZonaSeguraEstablecida(false);
    setFlightHuboIncidente(false);
    setFlightDescripcionNovedad("");
    setFlightAccionesTomadas("");
    setFlightNombrePilotoResponsable("");
    setFlightFirmaPiloto("");
    setFlightFirmaOperador("");
    setFlightNotas("");
    setFlightMisionId("");
    setFlightLogSourceApp("DJI_FLY");
    setFlightDateObj(null);
    setShowFlightDate(false);
    setShowFlightTime(false);
    setShowNewFlightModal(false);
  }, [closeKeyboard]);

  const closeAutoeval = useCallback(() => {
    closeKeyboard();
    stopAllVoice();
    setShowAutoevalModal(false);
  }, [closeKeyboard]);

  const closeBattery = useCallback(() => {
    closeKeyboard();
    stopAllVoice();
    setShowBatteryModal(false);
  }, [closeKeyboard]);

  const closeFrat = useCallback(() => {
    closeKeyboard();
    setShowFratModal(false);
  }, [closeKeyboard]);

  const persistFratRecords = useCallback(async (next: Record<string, FratRecord>) => {
    await SecureStore.setItemAsync(SECURE_FRAT_KEY, JSON.stringify(next), {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  }, []);

  const loadFratRecords = useCallback(async () => {
    try {
      const raw = await SecureStore.getItemAsync(SECURE_FRAT_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        setFratRecordsMap(parsed);
      }
    } catch (e) {
      console.log("⚠️ cargar FRAT:", (e as any)?.message || e);
    }
  }, []);

  const fratLeftTotal = useMemo(
    () => FRAT_LEFT_QUESTIONS.reduce((acc, question) => acc + getFratOptionScore(question, fratAnswers[question.key]), 0),
    [fratAnswers]
  );

  const fratRightTotal = useMemo(
    () => FRAT_RIGHT_QUESTIONS.reduce((acc, question) => acc + getFratOptionScore(question, fratAnswers[question.key]), 0),
    [fratAnswers]
  );

  const fratTotal = fratLeftTotal + fratRightTotal;
  const fratRiskLevel = useMemo(() => getFratRiskLevel(fratTotal), [fratTotal]);
  const fratCompleted = useMemo(
    () => FRAT_ALL_QUESTIONS.every((question) => !!String(fratAnswers[question.key] || "").trim()),
    [fratAnswers]
  );

  const activeFratRecord = useMemo(
    () => (operationMission?._id ? fratRecordsMap[operationMission._id] || null : null),
    [operationMission?._id, fratRecordsMap]
  );

  const fratRiskMeta = useMemo(() => getFratRiskPresentation(fratRiskLevel), [fratRiskLevel]);
  const activeFratMeta = useMemo(
    () => (activeFratRecord ? getFratRiskPresentation(activeFratRecord.riskLevel) : null),
    [activeFratRecord]
  );

  const openFratForOperation = useCallback((mission: Mision | null) => {
    if (!mission?._id) return;
    const existing = fratRecordsMap[mission._id];
    setFratAnswers(existing?.answers || createEmptyFratAnswers());
    setFratObservation(existing?.observation || "");
    setShowFratModal(true);
  }, [fratRecordsMap]);

  const applySmartBitacoraSuggestion = useCallback(() => {
    const now = new Date();
    const hhmm = `${pad2(now.getHours())}:${pad2(now.getMinutes())}`;
    const missionForSuggestion =
      (misiones || []).find((m) => m.estado !== "Cumplida" && sameDay(m.fechaOperacion))
      || (misiones || []).find((m) => m.estado !== "Cumplida")
      || null;
    const locationRaw = String(missionForSuggestion?.ubicacionGeneral || "").trim();
    const [municipioRaw = "", departamentoRaw = ""] = locationRaw.split(",").map((item) => item.trim());
    const coords = gpsCell.enabled && gpsCell.lat != null && gpsCell.lon != null
      ? `${gpsCell.lat.toFixed(6)}, ${gpsCell.lon.toFixed(6)}`
      : "";
    const suggestion = {
      horaInicio: hhmm,
      municipio: municipioRaw,
      departamento: departamentoRaw,
      coordenadas: coords,
      condicion: weatherNow.ok ? weatherNow.label.toLowerCase() : "",
      viento: weatherNow.windMs != null ? String(Number(weatherNow.windMs.toFixed(1))) : "",
      temperatura: weatherNow.tempC != null ? String(Number(weatherNow.tempC.toFixed(1))) : "",
      lugar: locationRaw,
    };

    if (suggestion.horaInicio && !flightHoraInicio) {
      setFlightHoraInicio(suggestion.horaInicio);
    }
    if (suggestion.municipio && !flightMunicipio) {
      setFlightMunicipio(suggestion.municipio);
    }
    if (suggestion.departamento && !flightDepartamento) {
      setFlightDepartamento(suggestion.departamento);
    }
    if (suggestion.coordenadas && !flightCoordenadasOperacion) {
      setFlightCoordenadasOperacion(suggestion.coordenadas);
    }
    if (suggestion.condicion) {
      const value = suggestion.condicion;
      if (
        value === "despejado" ||
        value === "parcialmente nublado" ||
        value === "nublado" ||
        value === "lluvia"
      ) {
        setFlightCondicionMeteorologica(value);
      }
    }
    if (suggestion.viento && !flightVelocidadViento) {
      setFlightVelocidadViento(suggestion.viento);
    }
    if (suggestion.temperatura && !flightTemperatura) {
      setFlightTemperatura(suggestion.temperatura);
    }
    if (suggestion.lugar && !flightLugarOperacion) {
      setFlightLugarOperacion(suggestion.lugar);
    }
    Toast.show({
      type: "success",
      text1: "Sugerencias aplicadas",
      text2: "Se cargaron hora, ubicación y clima sugeridos.",
    });
  }, [
    flightCoordenadasOperacion,
    flightDepartamento,
    flightHoraInicio,
    flightLugarOperacion,
    flightMunicipio,
    flightTemperatura,
    flightVelocidadViento,
    misiones,
    gpsCell.enabled,
    gpsCell.lat,
    gpsCell.lon,
    weatherNow.ok,
    weatherNow.label,
    weatherNow.tempC,
    weatherNow.windMs,
  ]);

  const closeEquipos = useCallback(() => {
    closeKeyboard();
    setShowEquiposModal(false);
  }, [closeKeyboard]);

  // ✅ Cambiar secciones cerrando teclado
  const goSection = useCallback((s: Section) => {
    closeKeyboard();
    setSection(s);
  }, [closeKeyboard]);

    useEffect(() => {
    closeKeyboard();
  }, [section, closeKeyboard]);

  useEffect(() => {
    if (section === "dashboard") {
      setShowNavScrollHint(true);
    }
  }, [section]);

    useEffect(() => {
      registerForPushAndSendToBackend(apiFetch);
    }, []);

       
      
    useEffect(() => {
  if (!usuario?._id) return;

  const onConnect = () => {
    console.log("ðŸ”Œ socket connected:", socket.id);
    socket.emit("join", usuario._id);
    console.log(" join emit:", usuario._id);
  };

  const onMissionAssigned = (payload: any) => {
    const mission = payload?.mision ?? payload; // soporta ambos formatos
    console.log("mission_assigned:", mission);

Toast.show({
  type: "info",
  text1: "Nueva misión",
  text2: mission?.titulo || "Te asignaron una misión",
});

    if (mission?._id) {
      setMisiones((prev) => {
        if (prev.some((x) => x._id === mission._id)) return prev; // no duplicar
        return [mission, ...prev];
      });
    } else {
      
    }
  };

  socket.on("mission_assigned", onMissionAssigned);

  socket.on("connect", onConnect);
  socket.on("reconnect", onConnect);

  if (!socket.connected) socket.connect();
  else onConnect();

  return () => {
    socket.off("mission_assigned", onMissionAssigned);
    socket.off("connect", onConnect);
    socket.off("reconnect", onConnect);
  };
}, [usuario?._id]);






function pendingToReporteUI(p: PendingReporte): ReporteUI {
  return {
    _id: p.localId, // para que el map tenga key
    fecha: p.payload.fecha,
    tipo: `${p.payload.tipoCode} — ${p.payload.tipoLabel}`,
    descripcion: p.payload.descripcion,
    estado: "Pendiente",
    _local: true,
    localId: p.localId,
    createdAt: p.createdAt,
  };
}

async function getPendingReportesUI(): Promise<ReporteUI[]> {
  const q = await getReporteQueue();
  return q.map(pendingToReporteUI);
}


useEffect(() => {
  cargarMisionesDelPiloto();
}, []);

const cargarMisionesDelPiloto = async () => {
  try {
    // ✅ asumiendo que guardas userId del piloto en auth/user
    const pilotoId = user._id || user.id;

    const res = await fetch(`${API_URL}${normalizePath(`/misiones?pilotoId=${pilotoId}`)}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    const data = await res.json();
    const rows = Array.isArray(data) ? data : (data.items || data.data || []);

    // ✅ opcional: solo misiones en el rango / estado
    setMisionesPiloto(rows);
  } catch (e) {
    console.log("Error cargando misiones:", e);
  }
};

const descargarArchivoMision = async (
  misionId: string,
  kind: "adjuntos" | "autorizacionVuelo",
  index?: number
) => {
  try {
    const suffix =
      kind === "adjuntos" && typeof index === "number"
        ? `/api/misiones/${misionId}/file-url?kind=${kind}&index=${index}`
        : `/api/misiones/${misionId}/file-url?kind=${kind}`;

    const resp = await apiFetch<{ ok?: boolean; url?: string }>(suffix);
    if (!resp?.url) throw new Error("No se recibió el enlace de descarga.");
    await Linking.openURL(resp.url);
  } catch (e: any) {
    Toast.show({
      type: "error",
      text1: "No se pudo descargar",
      text2: e?.message || "Intenta nuevamente.",
    });
  }
};

async function uploadFlightLogsOnline(
  files: FlightLogPicked[],
  missionId?: string
): Promise<FlightLogUploadResult[]> {
  const results: FlightLogUploadResult[] = [];

  for (const file of files) {
    if (file.size > MAX_FLIGHT_LOG_SIZE_BYTES) {
      results.push({
        id: file.id,
        name: file.name,
        ok: false,
        message: "Supera el tamaño máximo de 50 MB.",
      });
      continue;
    }

    const form = new FormData();
    form.append("file", {
      uri: file.uri,
      name: file.name,
      type: file.mimeType || "application/octet-stream",
    } as any);
    form.append("originalName", file.name);
    form.append("mimeType", file.mimeType || "application/octet-stream");
    form.append("ext", file.ext);
    form.append("size", String(file.size || 0));
    form.append("source", "mobile");
    form.append("deviceTime", new Date().toISOString());
    if (missionId) {
      form.append("missionId", missionId);
    }

    try {
      const response: any = await apiUploadForm("/api/flight-logs/upload", form, { timeoutMs: 30000 });
      const alreadyInBitacora = Boolean(response?.duplicate && response?.data?.vueloId);
      results.push({
        id: file.id,
        name: file.name,
        ok: !alreadyInBitacora,
        message: alreadyInBitacora
          ? "Este log ya pertenece a otra bitácora."
          : response?.duplicate
            ? "Log duplicado reutilizado sin volver a cargarlo."
            : "Subido correctamente.",
        serverFlightLogId:
          !alreadyInBitacora && response?.data?._id ? String(response.data._id) : undefined,
        summary: response?.data?.summary || null,
        telemetry: response?.data?.telemetry || null,
      });
    } catch (error: any) {
      results.push({
        id: file.id,
        name: file.name,
        ok: false,
        message: error?.message || "No se pudo subir.",
      });
    }
  }

  return results;
}



const pickEvidenceImages = useCallback(async () => {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    Toast.show({ type: "error", text1: "Permiso", text2: "Habilita galería para adjuntar evidencias." });
    return;
  }

  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsMultipleSelection: true,
    quality: 0.85,
  });

  if (res.canceled) return;

  const assets = res.assets || [];
  const added: EvidencePicked[] = assets.map((a) => ({
    id: makeLocalId("evi"),
    uri: a.uri,
    mime: a.mimeType || "image/jpeg",
    name: `evidencia_${Date.now()}.jpg`,
  }));

  setEvidenceItems((prev) => [...added, ...prev]);
}, []);

const takeEvidencePhoto = useCallback(async () => {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) {
    Toast.show({ type: "error", text1: "Permiso", text2: "Habilita la cámara para tomar evidencias." });
    return;
  }

  const res = await ImagePicker.launchCameraAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    quality: 0.85,
  });

  if (res.canceled) return;
  const assets = res.assets || [];
  const added: EvidencePicked[] = assets.map((a) => ({
    id: makeLocalId("cam"),
    uri: a.uri,
    mime: a.mimeType || "image/jpeg",
    name: `cam_${Date.now()}.jpg`,
  }));
  setEvidenceItems((prev) => [...added, ...prev]);
}, []);

const pickReportAttachments = useCallback(async () => {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    Toast.show({ type: "error", text1: "Permiso", text2: "Habilita galería para adjuntar soportes." });
    return;
  }

  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsMultipleSelection: true,
    quality: 0.8,
  });
  if (res.canceled) return;

  const assets = res.assets || [];
  const added: EvidencePicked[] = assets.map((a) => ({
    id: makeLocalId("rep_adj"),
    uri: a.uri,
    mime: a.mimeType || "image/jpeg",
    name: `reporte_${Date.now()}.jpg`,
  }));
  setReportAttachments((prev) => [...prev, ...added]);
}, []);

const pickIncidentAttachments = useCallback(async () => {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    Toast.show({ type: "error", text1: "Permiso", text2: "Habilita galería para adjuntar soportes." });
    return;
  }

  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsMultipleSelection: true,
    quality: 0.8,
  });
  if (res.canceled) return;

  const assets = res.assets || [];
  const added: EvidencePicked[] = assets.map((a) => ({
    id: makeLocalId("inc_adj"),
    uri: a.uri,
    mime: a.mimeType || "image/jpeg",
    name: `incidente_${Date.now()}.jpg`,
  }));

  setIncAttachments((prev) => [...prev, ...added]);
}, []);

const removeIncidentAttachment = useCallback((idx: number) => {
  setIncAttachments((prev) => prev.filter((_, i) => i !== idx));
}, []);

const resetIncidentForm = useCallback(() => {
  setIncFecha("");
  setIncTipo("");
  setIncSeveridad("");
  setIncUbicacion("");
  setIncTitulo("");
  setIncDescripcion("");
  setIncCausas("");
  setIncAcciones("");
  setIncAttachments([]);
}, []);

const closeIncidentModal = useCallback(() => {
  closeKeyboard();
  setShowIncidentModal(false);
  setIncSaving(false);
  resetIncidentForm();
}, [closeKeyboard, resetIncidentForm]);

const saveIncident = useCallback(async () => {
  if (!incFecha || !incTipo || !incSeveridad || !incUbicacion || !incTitulo || !incDescripcion) {
    Toast.show({
      type: "error",
      text1: "Validación",
      text2: "Completa todos los campos obligatorios (*)",
    });
    return;
  }

  try {
    setIncSaving(true);
    const evidencias = (incAttachments || []).map((a) => ({
      url: a.uri,
      tipo: a.mime?.startsWith("image/") ? "foto" : a.mime?.startsWith("video/") ? "video" : "doc",
    }));

    await apiFetch("/api/incidentes", {
      method: "POST",
      body: JSON.stringify({
        fecha: incFecha.trim(),
        tipo: incTipo.trim(),
        severidad: incSeveridad.trim(),
        ubicacion: incUbicacion.trim(),
        titulo: incTitulo.trim(),
        descripcion: incDescripcion.trim(),
        causas: incCausas.trim(),
        accionesInmediatas: incAcciones.trim(),
        evidencias,
      }),
    });

    Toast.show({ type: "success", text1: "Incidente registrado", text2: "Se guardó correctamente." });
    closeIncidentModal();
  } catch (e: any) {
    Toast.show({ type: "error", text1: "Error", text2: String(e?.message || "No se pudo guardar el incidente.") });
    setIncSaving(false);
  }
}, [
  incAcciones,
  incAttachments,
  incCausas,
  incDescripcion,
  incFecha,
  incSeveridad,
  incTipo,
  incTitulo,
  incUbicacion,
  closeIncidentModal,
]);

const removeReportAttachment = useCallback((id: string) => {
  setReportAttachments((prev) => prev.filter((item) => item.id !== id));
}, []);

const removeEvidence = useCallback((id: string) => {
  setEvidenceItems((prev) => prev.filter((x) => x.id !== id));
}, []);






  
  /** CHECKLIST */
  const [checklist, setChecklist] = useState({
    v1a: false,
    v1b: false,
    v2: false,
    v3a: false,
    v3b: false,
    v4a: false,
    v4b: false,
    v5: false,
    obs1: "",
    obs2: "",
    obs3: "",
    obs4: "",
    obs5: "",
    obsGeneral: "",
    apto: "" as "" | "si" | "no",
  });

  /** AUTOEVAL */
  const [autoeval, setAutoeval] = useState({
    alcohol: "" as "" | "Sí" | "No",
    psico: "" as "" | "Sí" | "No",
    meds: "" as "" | "Sí" | "No",
    jefe: "" as "" | "Sí" | "No",
    lesiones: "" as "" | "Sí" | "No",
    lesionesDetalle: "",
    acepto: false,
  });

  /** BATERÍAS */
  const [batteryChecks, setBatteryChecks] = useState({
    c1: false,
    c2: false,
    c3: false,
    c4: false,
    p1: false,
    p2: false,
    p3: false,
    p4: false,
    p5: false,
    p6: false,
    p7: false,
  });

  const title = useMemo(() => {
    switch (section) {
      case "dashboard":
        return "Inicio";
      case "dji-cloud":
        return "Sincronización DJI";
      case "new-report":
        return repClase === "VOLUNTARIO"
          ? "Reporte voluntario"
          : repClase === "MOR"
          ? "Reporte MOR"
          : "";
      case "my-reports":
        return "Reportes SMS";
      case "flight-log":
        return "Bitácora de Vuelo";
      case "weather":
        return "Clima operacional";
      case "equipos-uas":
        return "Equipos UAS";
      case "missions":
        return "Misiones";
      case "procedures":
        return "Procedimientos";
      default:
        return "Piloto UAS";
    }
  }, [section]);

  const misionesPendientes = useMemo(
  () => misiones.filter((m) => isMissionVisiblePendingStatus(m.estado)).length,
  [misiones]
);

  const djiCloudSourceLabel = useMemo(() => {
    switch (flightLogSourceApp) {
      case "DJI_GO_4":
        return "DJI GO 4";
      case "DJI_PILOT_2":
        return "DJI Pilot 2";
      default:
        return "DJI Fly";
    }
  }, [flightLogSourceApp]);

  const refreshDJIDirectSyncState = useCallback(async () => {
    if (!DJIFlightLogSync.isAvailable) {
      setDjiDirectSyncKnownSources([]);
      setDjiDirectSyncLocations([]);
      setDjiDirectSyncPendingFiles([]);
      setDjiDirectSyncUploads([]);
      setDjiDirectSyncSettings({ enabled: false, lastError: "Disponible solo en Android." });
      return;
    }

    const [settings, snapshot, knownSources] = await Promise.all([
      getDJIDirectSyncSettings(),
      getDJIDirectSyncSnapshot(),
      DJIFlightLogSync.getKnownSources(),
    ]);

    setDjiDirectSyncSettings(settings);
    setDjiDirectSyncKnownSources(knownSources);
    setDjiDirectSyncUploads(uniqueById(snapshot.lastUploads));
  }, []);

  const runDJIDirectSyncScan = useCallback(
    async ({ upload = false, silent = false }: { upload?: boolean; silent?: boolean } = {}) => {
      if (!DJIFlightLogSync.isAvailable) {
        setDjiDirectSyncSettings({ enabled: false, lastError: "Disponible solo en Android." });
        return;
      }

      if (!silent) setDjiDirectSyncBusy(true);

      try {
        const [settings, snapshot, knownSources, scan] = await Promise.all([
          getDJIDirectSyncSettings(),
          getDJIDirectSyncSnapshot(),
          DJIFlightLogSync.getKnownSources(),
          DJIFlightLogSync.scanFlightLogs(),
        ]);

        let pendingFiles = uniqueById(await getPendingDJIFlightLogs(scan.files));
        let nextSnapshot = snapshot;
        let lastError: string | null = null;
        let lastSuccessAt = settings.lastSuccessAt || null;
        let uploadedCount = 0;

        if ((upload || settings.enabled) && pendingFiles.length) {
          if (!isOnlineRef.current) {
            lastError = "Sin conexión. Los logs detectados quedarán pendientes para el próximo escaneo.";
          } else {
            const uploadResults = await uploadFlightLogsOnlineService(
              pendingFiles.map((file) => ({
                id: file.id,
                uri: file.uri,
                name: file.name,
                mimeType: file.mimeType,
                size: file.size,
                ext: file.ext,
              }))
            );

            const uploadedIds = new Set(uploadResults.filter((item) => item.ok).map((item) => item.id));
            const uploadedFiles = pendingFiles.filter((file) => uploadedIds.has(file.id));
            uploadedCount = uploadedFiles.length;

            if (uploadedFiles.length) {
              nextSnapshot = await markDJIFlightLogsUploaded(uploadedFiles);
              pendingFiles = pendingFiles.filter((file) => !uploadedIds.has(file.id));
              lastSuccessAt = new Date().toISOString();
            }

            const failedResult = uploadResults.find((item) => !item.ok);
            lastError = failedResult ? failedResult.message : null;
          }
        }

        const nextSettings = await saveDJIDirectSyncSettings({
          lastScanAt: new Date().toISOString(),
          lastSuccessAt,
          lastError,
        });

        setDjiDirectSyncSettings(nextSettings);
        setDjiDirectSyncKnownSources(knownSources);
        setDjiDirectSyncLocations(scan.locations);
        setDjiDirectSyncPendingFiles(uniqueById(pendingFiles));
        setDjiDirectSyncUploads(uniqueById(nextSnapshot.lastUploads));
        setDjiDirectSyncLastMessage(
          uploadedCount
            ? `${uploadedCount} log${uploadedCount === 1 ? "" : "s"} sincronizado${uploadedCount === 1 ? "" : "s"} en este escaneo.`
            : pendingFiles.length
            ? `${pendingFiles.length} log${pendingFiles.length === 1 ? "" : "s"} pendiente${pendingFiles.length === 1 ? "" : "s"}.`
            : "No se encontraron logs nuevos pendientes."
        );

        if (!silent && upload) {
          Toast.show({
            type: lastError ? "error" : "success",
            text1: "Sincronización DJI",
            text2: lastError || (uploadedCount ? `Se subieron ${uploadedCount} logs nuevos.` : "No había logs nuevos por subir."),
          });
        }
      } catch (e: any) {
        const message = e?.message || "No se pudo revisar las carpetas DJI.";
        const nextSettings = await saveDJIDirectSyncSettings({
          lastScanAt: new Date().toISOString(),
          lastError: message,
        });
        setDjiDirectSyncSettings(nextSettings);
        setDjiDirectSyncLastMessage(message);
        if (!silent) {
          Toast.show({
            type: "error",
            text1: "Sincronización DJI",
            text2: message,
          });
        }
      } finally {
        if (!silent) setDjiDirectSyncBusy(false);
      }
    },
    []
  );

  const toggleDJIDirectSyncEnabled = useCallback(async () => {
    const next = await saveDJIDirectSyncSettings({
      enabled: !djiDirectSyncSettings.enabled,
      lastError: null,
    });
    setDjiDirectSyncSettings(next);
    setDjiDirectSyncLastMessage(
      next.enabled
        ? "La sincronización automática quedó activa."
        : "La sincronización automática quedó pausada."
    );
    if (next.enabled) {
      await runDJIDirectSyncScan({ upload: true, silent: true });
    }
  }, [djiDirectSyncSettings.enabled, runDJIDirectSyncScan]);

  const requestDJIFolderAccess = useCallback(
    async (sourceApp: DJIFlightLogSourceApp) => {
      try {
        setDjiDirectSyncBusy(true);
        const result = await DJIFlightLogSync.pickFolder(sourceApp);
        if (result?.granted) {
          Toast.show({
            type: "success",
            text1: "Sincronización DJI",
            text2: "Permiso de carpeta guardado correctamente.",
          });
        }
        await runDJIDirectSyncScan({ upload: false, silent: true });
      } catch (e: any) {
        Toast.show({
          type: "error",
          text1: "Sincronización DJI",
          text2: e?.message || "No se pudo autorizar la carpeta.",
        });
      } finally {
        setDjiDirectSyncBusy(false);
      }
    },
    [runDJIDirectSyncScan]
  );

  const clearDJIFolderAccess = useCallback(
    async (sourceApp: DJIFlightLogSourceApp) => {
      try {
        setDjiDirectSyncBusy(true);
        await DJIFlightLogSync.clearFolderAccess(sourceApp);
        await runDJIDirectSyncScan({ upload: false, silent: true });
        Toast.show({
          type: "success",
          text1: "Sincronización DJI",
          text2: "El permiso persistente de la carpeta fue removido.",
        });
      } catch (e: any) {
        Toast.show({
          type: "error",
          text1: "Sincronización DJI",
          text2: e?.message || "No se pudo limpiar el permiso de la carpeta.",
        });
      } finally {
        setDjiDirectSyncBusy(false);
      }
    },
    [runDJIDirectSyncScan]
  );

  const loadDjiCloudStatus = useCallback(async () => {
    try {
      setDjiCloudLoading(true);
      const response = await apiFetch<DjiCloudStatus>("/api/dji-cloud/status");
      setDjiCloudStatus(response);
      if (response?.sourceApp) setFlightLogSourceApp(response.sourceApp);
      setDjiIntegrationMode("consumer_local");
      setDjiCloudForm({
        accountIdentifier: response?.accountIdentifier || "",
        accountDisplayName: response?.accountDisplayName || "",
        password: "",
        confirmPassword: "",
      });
    } catch (e: any) {
      Toast.show({
        type: "error",
        text1: "DJI Cloud",
        text2: e?.message || "No se pudo cargar el estado de la cuenta DJI.",
      });
    } finally {
      setDjiCloudLoading(false);
    }
  }, []);

  const loadDjiCloudFlights = useCallback(async () => {
    try {
      const response = await apiFetch<{ ok: boolean; items?: DjiCloudFlight[] }>("/api/dji-cloud/flights");
      setDjiCloudFlights(Array.isArray(response?.items) ? response.items : []);
    } catch {
      setDjiCloudFlights([]);
    }
  }, []);

  const loadDjiCloudRuns = useCallback(async () => {
    try {
      const response = await apiFetch<{ ok: boolean; items?: DjiCloudSyncRunItem[] }>("/api/dji-cloud/runs");
      setDjiCloudRuns(Array.isArray(response?.items) ? response.items : []);
    } catch {
      setDjiCloudRuns([]);
    }
  }, []);

  const saveDjiCloudMode = useCallback(
    async (mode: "consumer_local" | "enterprise_cloud") => {
      try {
        setDjiCloudSaving(true);
        const sourceApp = "DJI_FLY";
        const response = await apiFetch<DjiCloudStatus & { message?: string }>("/api/dji-cloud/mode", {
          method: "POST",
          body: JSON.stringify({
            integrationMode: "consumer_local",
            sourceApp,
          }),
        });
        setDjiCloudStatus(response);
        setDjiIntegrationMode("consumer_local");
        setFlightLogSourceApp(response?.sourceApp || sourceApp);
        Toast.show({
          type: "success",
          text1: "DJI",
          text2: response?.message || "Modo de integración actualizado.",
        });
      } catch (e: any) {
        Toast.show({
          type: "error",
          text1: "DJI",
          text2: e?.message || "No se pudo actualizar el modo de integración.",
        });
      } finally {
        setDjiCloudSaving(false);
      }
    },
    []
  );

  const openDjiCloudModal = useCallback(() => {
    setDjiCloudForm({
      accountIdentifier: djiCloudStatus?.accountIdentifier || "",
      accountDisplayName: djiCloudStatus?.accountDisplayName || "",
      password: "",
      confirmPassword: "",
    });
    setDjiCloudModalOpen(true);
  }, [djiCloudStatus]);

  const closeDjiCloudModal = useCallback(() => {
    setDjiCloudModalOpen(false);
  }, []);

  const submitDjiCloudConnection = useCallback(async () => {
    if (!djiCloudForm.accountIdentifier.trim()) {
      Toast.show({
        type: "error",
        text1: "DJI Cloud",
        text2: "Ingresa la cuenta DJI del piloto.",
      });
      return;
    }

    if (djiIntegrationMode === "consumer_local" && !djiCloudForm.password.trim()) {
      Toast.show({
        type: "error",
        text1: "DJI Cloud",
        text2: "Ingresa la contraseña DJI del piloto.",
      });
      return;
    }

    if (
      djiIntegrationMode === "consumer_local" &&
      djiCloudForm.password.trim() !== djiCloudForm.confirmPassword.trim()
    ) {
      Toast.show({
        type: "error",
        text1: "DJI Cloud",
        text2: "La confirmación de contraseña no coincide.",
      });
      return;
    }

    try {
      setDjiCloudSaving(true);
      const response = await apiFetch<DjiCloudStatus & { message?: string }>("/api/dji-cloud/connect", {
        method: "POST",
        body: JSON.stringify({
          accountIdentifier: djiCloudForm.accountIdentifier.trim(),
          accountDisplayName: djiCloudForm.accountDisplayName.trim(),
          sourceApp: flightLogSourceApp,
          integrationMode: djiIntegrationMode,
          authPayload:
            djiIntegrationMode === "consumer_local"
              ? {
                  usernameOrEmail: djiCloudForm.accountIdentifier.trim(),
                  password: djiCloudForm.password.trim(),
                }
              : null,
        }),
      });
      setDjiCloudStatus(response);
      setDjiIntegrationMode(response?.integrationMode === "enterprise_cloud" ? "enterprise_cloud" : "consumer_local");
      if (response?.sourceApp) setFlightLogSourceApp(response.sourceApp);
      setDjiCloudModalOpen(false);
      setDjiCloudForm((prev) => ({ ...prev, password: "", confirmPassword: "" }));
      await Promise.all([loadDjiCloudRuns(), loadDjiCloudFlights()]);
      Toast.show({
        type: "success",
        text1: "DJI Cloud",
        text2: response?.message || "Cuenta DJI vinculada correctamente.",
      });
    } catch (e: any) {
      Toast.show({
        type: "error",
        text1: "DJI Cloud",
        text2: e?.message || "No se pudo vincular la cuenta DJI.",
      });
    } finally {
      setDjiCloudSaving(false);
    }
  }, [djiCloudForm, djiIntegrationMode, flightLogSourceApp, loadDjiCloudFlights, loadDjiCloudRuns]);

  const requestDjiCloudSync = useCallback(async () => {
    try {
      setDjiCloudSaving(true);
      const response = await apiFetch<DjiCloudStatus & { message?: string }>("/api/dji-cloud/sync", {
        method: "POST",
        body: JSON.stringify({}),
      });
      setDjiCloudStatus(response);
      await Promise.all([loadDjiCloudRuns(), loadDjiCloudFlights()]);
      Toast.show({
        type: "success",
        text1: "DJI Cloud",
        text2: response?.sync?.message || response?.message || "Sincronización solicitada.",
      });
    } catch (e: any) {
      Toast.show({
        type: "error",
        text1: "DJI Cloud",
        text2: e?.message || "No se pudo solicitar la sincronización DJI.",
      });
    } finally {
      setDjiCloudSaving(false);
    }
  }, [loadDjiCloudFlights, loadDjiCloudRuns]);

  const disconnectDjiCloud = useCallback(async () => {
    try {
      setDjiCloudSaving(true);
      const response = await apiFetch<DjiCloudStatus & { message?: string }>("/api/dji-cloud/disconnect", {
        method: "POST",
        body: JSON.stringify({}),
      });
      setDjiCloudStatus(response);
      setDjiCloudFlights([]);
      setDjiCloudRuns([]);
      Toast.show({
        type: "success",
        text1: "DJI Cloud",
        text2: response?.message || "Cuenta DJI desvinculada.",
      });
    } catch (e: any) {
      Toast.show({
        type: "error",
        text1: "DJI Cloud",
        text2: e?.message || "No se pudo desvincular la cuenta DJI.",
      });
    } finally {
      setDjiCloudSaving(false);
    }
  }, []);

  useEffect(() => {
    if (section === "dji-cloud") {
      loadDjiCloudStatus().catch(() => {});
    }
  }, [section, loadDjiCloudStatus]);

  useEffect(() => {
    if (section === "dji-cloud" && djiIntegrationMode === "enterprise_cloud") {
      loadDjiCloudRuns().catch(() => {});
      loadDjiCloudFlights().catch(() => {});
    }
  }, [section, djiIntegrationMode, loadDjiCloudRuns, loadDjiCloudFlights]);


const speakThenListen = useCallback((msg: string) => {
  if (!voiceEnabled) return;

  // corta cualquier cosa anterior
  Speech.stop();
  try { ExpoSpeechRecognitionModule.stop(); } catch {}

  setSpeaking(true);
  setHeard("");

  Speech.speak(msg, {
    language: isOnline ? "es-CO" : "es-ES",
    rate: 1.15, // ðŸ”¥ baja un poco (1.3 es muy agresivo en Android)
    onDone: () => {
      setSpeaking(false);

      // ✅ Delay para que Android libere el audio focus
      setTimeout(() => {
        startListeningAuto();
      }, 450); // prueba entre 400–600 si quieres
    },
    onStopped: () => setSpeaking(false),
    onError: () => setSpeaking(false),
  });
}, [voiceEnabled, setListening]);


  const initials = useMemo(() => {
    const nombre = usuario?.nombre || "Piloto UAS";
    const parts = nombre.trim().split(/\s+/).filter(Boolean);
    const a = (parts[0]?.[0] || "P").toUpperCase();
    const b = (parts[1]?.[0] || "U").toUpperCase();
    return `${a}${b}`;
  }, [usuario?.nombre]);

  const firstName = useMemo(() => {
    const n = usuario?.nombre?.trim() || "Piloto";
    return n.split(/\s+/)[0] || "Piloto";
  }, [usuario?.nombre]);

  const [avatarLoadError, setAvatarLoadError] = useState(false);
  const userAvatarUri = useMemo(() => {
    const raw = String((usuario as any)?.fotoUrl || (usuario as any)?.foto || "").trim();
    if (!raw) return null;
    if (/^https?:\/\//i.test(raw) || raw.startsWith("data:")) return raw;
    if (raw.startsWith("/")) return `${API_URL}${raw}`;
    return `${API_URL}/${raw}`;
  }, [(usuario as any)?.foto, (usuario as any)?.fotoUrl]);
  const userAvatarUriWithVersion = useMemo(() => {
    if (!userAvatarUri) return null;
    const v = encodeURIComponent(String((usuario as any)?.updatedAt || ""));
    if (!v) return userAvatarUri;
    return userAvatarUri.includes("?") ? `${userAvatarUri}&v=${v}` : `${userAvatarUri}?v=${v}`;
  }, [userAvatarUri, (usuario as any)?.updatedAt]);

  useEffect(() => {
    setAvatarLoadError(false);
  }, [userAvatarUriWithVersion]);

  const certStatus = useMemo(
    () => getCertStatus(usuario?.fechaCertificado),
    [usuario?.fechaCertificado]
  );
  const pilotNotifications = useMemo(() => {
    const items: Array<{
      id: string;
      title: string;
      detail: string;
      icon: keyof typeof MaterialCommunityIcons.glyphMap;
      tone: "danger" | "info" | "warning";
    }> = [];

    if (certStatus.label === "Vencido") {
      items.push({
        id: "medical-expired",
        title: "Certificado médico vencido",
        detail: "Actualiza el certificado para volver a estar disponible para operaciones.",
        icon: "medical-bag",
        tone: "danger",
      });
    } else if (certStatus.label === "—") {
      items.push({
        id: "medical-missing",
        title: "Certificado médico pendiente",
        detail: "No encontramos una vigencia registrada en tu perfil.",
        icon: "file-alert-outline",
        tone: "warning",
      });
    }

    misiones
      .filter((mission) => !["Cumplida", "Cancelada", "Finalizada"].includes(String(mission.estado || "")))
      .slice(0, 8)
      .forEach((mission) => {
        items.push({
          id: `mission-${mission._id}`,
          title: mission.titulo || "Misión asignada",
          detail: `${formatDateOnly(mission.fechaOperacion)} · ${mission.estado || "Programada"}`,
          icon: "clipboard-text-outline",
          tone: "info",
        });
      });

    alertas.slice(0, 8).forEach((alerta) => {
      items.push({
        id: `alert-${alerta._id}`,
        title: alerta.tipo || "Alerta operacional",
        detail: alerta.mensaje || formatDateOnly(alerta.fecha),
        icon: "alert-circle-outline",
        tone: alerta.nivel === "error" ? "danger" : alerta.nivel === "info" ? "info" : "warning",
      });
    });

    return items;
  }, [alertas, certStatus.label, misiones]);
  const notificationBellMotion = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    notificationBellMotion.stopAnimation();
    notificationBellMotion.setValue(0);
    if (!pilotNotifications.length) return;

    const animation = Animated.loop(
      Animated.sequence([
        Animated.delay(1200),
        Animated.timing(notificationBellMotion, { toValue: 1, duration: 90, easing: Easing.linear, useNativeDriver: true }),
        Animated.timing(notificationBellMotion, { toValue: -1, duration: 90, easing: Easing.linear, useNativeDriver: true }),
        Animated.timing(notificationBellMotion, { toValue: 0.75, duration: 90, easing: Easing.linear, useNativeDriver: true }),
        Animated.timing(notificationBellMotion, { toValue: -0.75, duration: 90, easing: Easing.linear, useNativeDriver: true }),
        Animated.timing(notificationBellMotion, { toValue: 0, duration: 90, easing: Easing.linear, useNativeDriver: true }),
        Animated.delay(2200),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [notificationBellMotion, pilotNotifications.length]);

  const notificationBellRotate = notificationBellMotion.interpolate({
    inputRange: [-1, 1],
    outputRange: ["-12deg", "12deg"],
  });
  useEffect(() => {
    const medical = usuario?.documentosCampo?.certificadoMedico;
    setMedicalCertificateStart(String(medical?.fechaInicio || usuario?.fechaCertificadoInicio || "").slice(0, 10));
    setMedicalCertificateEnd(String(medical?.fechaVencimiento || usuario?.fechaCertificado || "").slice(0, 10));
  }, [
    usuario?.documentosCampo?.certificadoMedico?.fechaInicio,
    usuario?.documentosCampo?.certificadoMedico?.fechaVencimiento,
    usuario?.fechaCertificado,
    usuario?.fechaCertificadoInicio,
  ]);

  const openMedicalDatePicker = useCallback((field: "start" | "end") => {
    const currentValue = field === "start"
      ? medicalCertificateStart
      : medicalCertificateEnd || medicalCertificateStart;
    if (Platform.OS === "android") {
      DateTimePickerAndroid.open({
        value: dateFromYmd(currentValue),
        mode: "date",
        minimumDate:
          field === "end" && medicalCertificateStart
            ? dateFromYmd(medicalCertificateStart)
            : undefined,
        onChange: (event: DateTimePickerEvent, selected?: Date) => {
          if (event.type === "dismissed" || !selected) return;
          const value = formatDateOnly(selected);
          if (field === "start") {
            setMedicalCertificateStart(value);
            if (medicalCertificateEnd && medicalCertificateEnd < value) {
              setMedicalCertificateEnd("");
            }
          } else {
            setMedicalCertificateEnd(value);
          }
        },
      });
      return;
    }
    if (field === "start") setShowMedicalStartDate(true);
    else setShowMedicalEndDate(true);
  }, [medicalCertificateEnd, medicalCertificateStart]);

  const missionToday = useMemo(
    () => misiones.find((m) => m.estado !== "Cumplida" && sameDay(m.fechaOperacion)) || misiones.find((m) => m.estado !== "Cumplida") || null,
    [misiones]
  );

  const activeMission = useMemo(
    () => misiones.find((m) => m._id === activeMissionId) || missionToday || null,
    [activeMissionId, misiones, missionToday]
  );
  const dashboardMapCenter = useMemo<LatLng | null>(() => {
    if (gpsCell.lat != null && gpsCell.lon != null) {
      return { latitude: gpsCell.lat, longitude: gpsCell.lon };
    }
    if (lastGoodGpsRef.current.lat != null && lastGoodGpsRef.current.lon != null) {
      return {
        latitude: lastGoodGpsRef.current.lat,
        longitude: lastGoodGpsRef.current.lon,
      };
    }
    return null;
  }, [gpsCell.lat, gpsCell.lon]);
  const dashboardMapHtml = useMemo(() => {
    if (!dashboardMapCenter) return null;
    return buildDashboardMapHtml({
      center: dashboardMapCenter,
      markerLabel:
        gpsCell.enabled && gpsCell.lat != null && gpsCell.lon != null
          ? `Posición actual ${gpsCell.lat.toFixed(5)}, ${gpsCell.lon.toFixed(5)}`
          : "Ubicación de referencia",
      weather: {
        ok: weatherDetail.ok,
        label: weatherDetail.label,
        tempC: weatherDetail.tempC,
        windMs: weatherDetail.windMs,
        precipProbPct: weatherDetail.precipProbPct,
        flightState: weatherDetail.flightState,
      },
      centerTick: dashboardMapCenterTick,
    });
  }, [
    dashboardMapCenter,
    dashboardMapCenterTick,
    gpsCell.enabled,
    gpsCell.lat,
    gpsCell.lon,
    weatherDetail.flightState,
    weatherDetail.label,
    weatherDetail.ok,
    weatherDetail.precipProbPct,
    weatherDetail.tempC,
    weatherDetail.windMs,
  ]);
  const dashboardLocationLabel = useMemo(() => {
    const base = String(currentPlaceLabel || "").trim();
    if (base) return base;
    if (gpsCell.lat != null && gpsCell.lon != null) {
      return `${gpsCell.lat.toFixed(5)}, ${gpsCell.lon.toFixed(5)}`;
    }
    return "Ubicación actual";
  }, [currentPlaceLabel, gpsCell.lat, gpsCell.lon]);
  const dashboardForecastRows = useMemo(() => {
    if (weatherForecast.length) {
      const uniqueDays = Array.from(new Set(weatherForecast.map((item) => item.dayKey)));
      const selectedDayKey = uniqueDays[Math.max(0, Math.min(selectedForecastDayIndex, uniqueDays.length - 1))];
      const rows = weatherForecast.filter((item) => item.dayKey === selectedDayKey);
      const todayKey = new Date().toISOString().slice(0, 10);
      const currentHour = new Date().getHours();
      let startIndex = 0;

      if (selectedDayKey === todayKey) {
        const nextCurrentSlot = rows.findIndex((item) => {
          const date = new Date(item.isoTime);
          return !Number.isNaN(date.getTime()) && date.getHours() >= currentHour;
        });
        startIndex = nextCurrentSlot >= 0 ? nextCurrentSlot : Math.max(0, rows.length - 6);
      } else {
        const morningSlot = rows.findIndex((item) => {
          const date = new Date(item.isoTime);
          return !Number.isNaN(date.getTime()) && date.getHours() >= 6;
        });
        startIndex = morningSlot >= 0 ? morningSlot : 0;
      }

      return rows.slice(startIndex, startIndex + 6);
    }
    return [
      {
        key: "fallback-now",
        isoTime: new Date().toISOString(),
        dayKey: new Date().toISOString().slice(0, 10),
        timeLabel: "ahora",
        satVisibleEst: weatherDetail.satVisibleEst ?? null,
        cloudBaseM: weatherDetail.cloudBaseM ?? null,
        precipProbPct: weatherDetail.precipProbPct ?? null,
        flightState: weatherDetail.flightState,
      },
    ];
  }, [selectedForecastDayIndex, weatherDetail.cloudBaseM, weatherDetail.flightState, weatherDetail.precipProbPct, weatherDetail.satVisibleEst, weatherForecast]);
  const forecastDayKeys = useMemo(
    () => Array.from(new Set(weatherForecast.map((item) => item.dayKey))),
    [weatherForecast]
  );
  const forecastDayCount = Math.max(forecastDayKeys.length, 1);
  const selectedForecastDate = useMemo(() => {
    const sourceIso = dashboardForecastRows[0]?.isoTime;
    const date = sourceIso ? new Date(sourceIso) : new Date();
    return Number.isNaN(date.getTime()) ? new Date() : date;
  }, [dashboardForecastRows]);
  const toggleForecastKey = useCallback((key: string) => {
    setExpandedForecastKeys((prev) =>
      prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key]
    );
  }, []);
  useEffect(() => {
    setExpandedForecastKeys([]);
    setSelectedForecastDayIndex((prev) => Math.max(0, Math.min(prev, Math.max(forecastDayCount - 1, 0))));
  }, [forecastDayCount]);

  const procedimientosPendientes = useMemo(
    () =>
      Object.values(procStatusMap).reduce((acc, status) => {
        const pending = [status?.preflight, status?.autoeval, status?.battery].filter((item) => !item).length;
        return acc + pending;
      }, 0),
    [procStatusMap]
  );

  const vuelosDelMes = useMemo(() => {
    const now = new Date();
    return vuelos.filter((v) => {
      const date = new Date(v.fechaHora);
      return !Number.isNaN(date.getTime())
        && date.getMonth() === now.getMonth()
        && date.getFullYear() === now.getFullYear();
    });
  }, [vuelos]);

  const horasAcumuladas = useMemo(
    () => vuelos.reduce((acc, v) => acc + Number(v.duracionMin || 0), 0) / 60,
    [vuelos]
  );

  const horasDelMes = useMemo(
    () => vuelosDelMes.reduce((acc, v) => acc + Number(v.duracionMin || 0), 0) / 60,
    [vuelosDelMes]
  );

  const horasHoy = useMemo(() => {
    const now = new Date();
    return vuelos.reduce((acc, v) => {
      const d = new Date(v.fechaHora);
      if (Number.isNaN(d.getTime())) return acc;
      const same = d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
      return same ? acc + Number(v.duracionMin || 0) : acc;
    }, 0) / 60;
  }, [vuelos]);

  const horasSemana = useMemo(() => {
    const now = new Date();
    const day = now.getDay();
    const diff = day === 0 ? 6 : day - 1;
    const monday = new Date(now);
    monday.setDate(now.getDate() - diff);
    monday.setHours(0, 0, 0, 0);
    return vuelos.reduce((acc, v) => {
      const d = new Date(v.fechaHora);
      if (Number.isNaN(d.getTime())) return acc;
      return d >= monday ? acc + Number(v.duracionMin || 0) : acc;
    }, 0) / 60;
  }, [vuelos]);

  const tasaIncidentesMes = useMemo(() => {
    const vuelosMes = vuelosDelMes.length;
    if (!vuelosMes) return 0;
    const now = new Date();
    const reportesMes = reportes.filter((r) => {
      const d = new Date(r.fecha);
      if (Number.isNaN(d.getTime())) return false;
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length;
    return (reportesMes / vuelosMes) * 100;
  }, [reportes, vuelosDelMes.length]);

  const cumplimientoChecklist = useMemo(() => {
    const statuses = Object.values(procStatusMap || {});
    if (!statuses.length) return 0;
    const done = statuses.reduce((acc, s) => {
      return acc + [s?.preflight, s?.autoeval, s?.battery].filter(Boolean).length;
    }, 0);
    const total = statuses.length * 3;
    return total > 0 ? (done / total) * 100 : 0;
  }, [procStatusMap]);

  const puntualidadMisiones = useMemo(() => {
    const hoy = (misiones || []).filter((m) => sameDay(m.fechaOperacion));
    if (!hoy.length) return 100;
    let onTime = 0;
    const now = new Date();
    for (const m of hoy) {
      const scheduleRaw = `${formatDateOnly(m.fechaOperacion)} ${formatHourOnly(m.horaInicio)}`;
      const schedule = new Date(scheduleRaw.replace(" ", "T"));
      if (m.estado === "Cumplida") {
        onTime += 1;
        continue;
      }
      if (Number.isNaN(schedule.getTime())) {
        continue;
      }
      if (schedule.getTime() >= now.getTime()) onTime += 1;
    }
    return (onTime / hoy.length) * 100;
  }, [misiones]);

  const horasPorAeronave = useMemo(() => {
    const grouped = vuelos.reduce<Record<string, number>>((acc, vuelo) => {
      const key = vuelo.uas || "Sin aeronave";
      acc[key] = (acc[key] || 0) + Number(vuelo.duracionMin || 0);
      return acc;
    }, {});
    return Object.entries(grouped)
      .map(([uas, totalMin]) => ({ uas, horas: totalMin / 60 }))
      .sort((a, b) => b.horas - a.horas)
      .slice(0, 3);
  }, [vuelos]);

  const logsPendientes = useMemo(
    () => syncSummary.logs + vuelos.filter((v: any) => v?.logUrl === "PENDIENTE_OFFLINE").length,
    [syncSummary.logs, vuelos]
  );

  const legalSummary = useMemo(() => {
    const baseDate = usuario?.fechaCertificado;
    const certDays = daysUntil(baseDate);
    return [
      {
        key: "certificado",
        title: "Certificado médico",
        date: formatDateOnly(baseDate),
        days: certDays,
      },
    ];
  }, [usuario?.fechaCertificado]);

  const smartBitacoraSuggestion = useMemo(() => {
    const now = new Date();
    const hhmm = `${pad2(now.getHours())}:${pad2(now.getMinutes())}`;
    const coords = gpsCell.enabled && gpsCell.lat != null && gpsCell.lon != null
      ? `${gpsCell.lat.toFixed(6)}, ${gpsCell.lon.toFixed(6)}`
      : "";
    const locationRaw = String(activeMission?.ubicacionGeneral || missionToday?.ubicacionGeneral || "").trim();
    const [municipioRaw = "", departamentoRaw = ""] = locationRaw.split(",").map((item) => item.trim());
    return {
      horaInicio: hhmm,
      municipio: municipioRaw,
      departamento: departamentoRaw,
      coordenadas: coords,
      condicion: weatherNow.ok ? weatherNow.label.toLowerCase() : "",
      viento: weatherNow.windMs != null ? String(Number(weatherNow.windMs.toFixed(1))) : "",
      temperatura: weatherNow.tempC != null ? String(Number(weatherNow.tempC.toFixed(1))) : "",
      lugar: locationRaw,
      tipoMision: activeMission?.titulo ? "inspección" : "",
    };
  }, [activeMission?.titulo, activeMission?.ubicacionGeneral, gpsCell.enabled, gpsCell.lat, gpsCell.lon, missionToday?.ubicacionGeneral, weatherNow.label, weatherNow.ok, weatherNow.tempC, weatherNow.windMs]);

  const selectedVueloDisplay = useMemo(() => {
    if (!selectedVuelo) return null;

    const safe = (value: unknown) => String(value ?? "").trim();
    const firstNonEmpty = (...values: unknown[]) => {
      for (const value of values) {
        const text = safe(value);
        if (text) return text;
      }
      return "";
    };

    const inferredBaseLocation = firstNonEmpty(
      selectedVuelo.lugarOperacion,
      selectedVuelo.ubicacion,
      currentPlaceLabel
    );
    const locationParts = inferredBaseLocation
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    const missionHint = firstNonEmpty(selectedVuelo.tipoMision, selectedVuelo.proposito, selectedVuelo.notas, activeMission?.titulo, missionToday?.titulo).toLowerCase();
    let inferredMissionType = safe(selectedVuelo.tipoMision);
    if (!inferredMissionType) {
      if (/map|topograf/i.test(missionHint)) inferredMissionType = "topografía";
      else if (/foto|film|video/i.test(missionHint)) inferredMissionType = "fotografía";
      else if (/vigilan|seguridad|patrull/i.test(missionHint)) inferredMissionType = "vigilancia";
      else if (/inspe|linea|torre|techo|panel|estructura/i.test(missionHint)) inferredMissionType = "inspección";
      else if (/orto|mosaico/i.test(missionHint)) inferredMissionType = "mapeo";
    }

    const inferredVisibility =
      firstNonEmpty(
        selectedVuelo.visibilidad,
        weatherDetail.visibilityM != null ? `${(weatherDetail.visibilityM / 1000).toFixed(1)} km` : "",
      );
    const inferredWeather = firstNonEmpty(selectedVuelo.condicionMeteorologica, weatherDetail.label);
    const inferredArea = firstNonEmpty(
      selectedVuelo.areaOperacion,
      selectedVuelo.coordenadasOperacion ? "Área derivada del log" : "",
      inferredBaseLocation ? `Entorno de ${inferredBaseLocation}` : "",
    );
    const inferredPayload = firstNonEmpty(
      selectedVuelo.payload,
      selectedVuelo.logUrl ? "Log de vuelo consolidado" : "",
      /log/i.test(safe(selectedVuelo.notas)) ? "Log de vuelo consolidado" : "",
    );
    const inferredCoords = firstNonEmpty(
      selectedVuelo.coordenadasOperacion,
      gpsCell.lat != null && gpsCell.lon != null ? `${gpsCell.lat.toFixed(6)}, ${gpsCell.lon.toFixed(6)}` : "",
    );
    const inferredMunicipio = firstNonEmpty(selectedVuelo.municipio, locationParts[0]);
    const inferredDepartamento = firstNonEmpty(selectedVuelo.departamento, locationParts[1]);
    const inferredLugar = firstNonEmpty(selectedVuelo.lugarOperacion, selectedVuelo.ubicacion, currentPlaceLabel);
    const inferredEmpresa = firstNonEmpty(selectedVuelo.empresaOperador, "Aeroxpert UAV");
    const inferredResponsable = firstNonEmpty(selectedVuelo.nombrePilotoResponsable, selectedVuelo.nombrePiloto, usuario?.nombre);
    const inferredLogBased = !!(inferredPayload || selectedVuelo.logUrl);
    const inferredChecklist = selectedVuelo.checklistPrevueloRealizado ?? (inferredLogBased ? true : null);
    const inferredZonaSegura = selectedVuelo.zonaSeguraEstablecida ?? (inferredLogBased ? true : null);
    const inferredIncidente = selectedVuelo.huboIncidente ?? (inferredLogBased ? false : null);
    const inferredRiesgos = firstNonEmpty(
      selectedVuelo.evaluacionRiesgos,
      inferredLogBased ? "Sin hallazgos críticos reportados" : "",
    );
    const inferredNovedad = firstNonEmpty(
      selectedVuelo.descripcionNovedad,
      inferredIncidente === false ? "Sin novedades registradas" : "",
    );
    const inferredAcciones = firstNonEmpty(
      selectedVuelo.accionesTomadas,
      inferredIncidente === false ? "No se requirieron acciones correctivas" : "",
    );

    return {
      empresaOperador: inferredEmpresa,
      lugarOperacion: inferredLugar,
      municipio: inferredMunicipio,
      departamento: inferredDepartamento,
      coordenadasOperacion: inferredCoords,
      areaOperacion: inferredArea,
      tipoMision: inferredMissionType,
      condicionMeteorologica: inferredWeather,
      velocidadViento:
        selectedVuelo.velocidadViento != null
          ? `${selectedVuelo.velocidadViento} m/s`
          : weatherDetail.windMs != null
            ? `${weatherDetail.windMs.toFixed(1)} m/s`
            : "",
      temperatura:
        selectedVuelo.temperatura != null
          ? `${selectedVuelo.temperatura} °C`
          : weatherDetail.tempC != null
            ? `${weatherDetail.tempC.toFixed(1)} °C`
            : "",
      visibilidad: inferredVisibility,
      payload: inferredPayload,
      checklistPrevueloRealizado: inferredChecklist,
      evaluacionRiesgos: inferredRiesgos,
      zonaSeguraEstablecida: inferredZonaSegura,
      huboIncidente: inferredIncidente,
      descripcionNovedad: inferredNovedad,
      accionesTomadas: inferredAcciones,
      nombrePilotoResponsable: inferredResponsable,
      firmaPiloto: safe(selectedVuelo.firmaPiloto) || "Pendiente",
      firmaOperador: safe(selectedVuelo.firmaOperador) || "Pendiente",
    };
  }, [
    activeMission?.titulo,
    currentPlaceLabel,
    gpsCell.lat,
    gpsCell.lon,
    missionToday?.titulo,
    selectedVuelo,
    usuario?.nombre,
    weatherDetail.label,
    weatherDetail.tempC,
    weatherDetail.visibilityM,
    weatherDetail.windMs,
  ]);

  const missionTimeline = useMemo(() => {
    if (!activeMission) return [];
    const status = procStatusMap[activeMission._id] || { preflight: false, autoeval: false, battery: false };
    return [
      { key: "mision", label: "Misión seleccionada", done: true },
      { key: "preflight", label: "Checklist preflight", done: !!status.preflight },
      { key: "autoeval", label: "Autoevaluación", done: !!status.autoeval },
      { key: "battery", label: "Variables críticas", done: !!status.battery },
      { key: "vuelo", label: "Registrar vuelo", done: vuelos.some((v: any) => v?.misionId === activeMission._id) },
      { key: "log", label: "Subir log", done: vuelos.some((v: any) => v?.misionId === activeMission._id && !!v?.logUrl) },
      { key: "evidencias", label: "Subir evidencias", done: activeMission.estado === "Cumplida" },
      { key: "cerrar", label: "Cerrar misión", done: activeMission.estado === "Cumplida" },
    ];
  }, [activeMission, procStatusMap, vuelos]);

  const missionProgress = useMemo(() => {
    if (!missionTimeline.length) return 0;
    const done = missionTimeline.filter((step) => step.done).length;
    return Math.round((done / missionTimeline.length) * 100);
  }, [missionTimeline]);

  const prepChecks = useMemo(() => {
    const checklistDone = activeMission ? !!procStatusMap[activeMission._id]?.preflight : false;
    const checks = [
      { key: "cert", label: "Certificado médico", value: certStatus.label, ok: certStatus.label === "Vigente" },
      { key: "cipu", label: "CIPU", value: usuario?.cipu || "Pendiente", ok: !!usuario?.cipu },
      { key: "mision", label: "Misión asignada hoy", value: missionToday?.titulo || "Sin misión", ok: !!missionToday },
      { key: "checklist", label: "Checklist", value: checklistDone ? "Completo" : "Pendiente", ok: checklistDone },
    ];
    return checks;
  }, [activeMission, certStatus.label, missionToday, procStatusMap, usuario?.cipu]);

  const prepReady = useMemo(
    () => prepChecks.filter((item) => !item.optional).every((item) => item.ok),
    [prepChecks]
  );

  const bitacoraUasOptions = useMemo(() => {
    const set = new Set<string>();
    for (const v of vuelos || []) {
      const uas = String((v as any)?.uas || "").trim();
      if (uas) set.add(uas);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "es"));
  }, [vuelos]);

  const bitacoraMissionOptions = useMemo(() => {
    return [...(misiones || [])].sort((a: any, b: any) => {
      const da = new Date(a?.fechaOperacion || a?.fecha || 0).getTime();
      const db = new Date(b?.fechaOperacion || b?.fecha || 0).getTime();
      return db - da;
    });
  }, [misiones]);

  const selectedBitacoraMissionLabel = useMemo(() => {
    if (!flightFilterMission) return "";
    const found = bitacoraMissionOptions.find((m: any) => String(m?._id) === String(flightFilterMission));
    if (!found) return "";
    return `${found?.titulo || "Misión"} · ${found?.estado || "Sin estado"}`;
  }, [bitacoraMissionOptions, flightFilterMission]);

  const selectedFlightMission = useMemo(
    () => (flightMisionId ? (misiones || []).find((m) => String(m._id) === String(flightMisionId)) || null : null),
    [flightMisionId, misiones]
  );

  const selectedFlightMissionLabel = useMemo(() => {
    if (selectedFlightMission?.titulo) return selectedFlightMission.titulo;
    if (activeMission?.titulo) return activeMission.titulo;
    if (missionToday?.titulo) return missionToday.titulo;
    return "";
  }, [selectedFlightMission, activeMission, missionToday]);

  const vuelosFiltrados = useMemo(() => {
    return vuelos.filter((vuelo: any) => {
      const vueloDate = formatDateOnly(vuelo.fechaHora);
      const byDate = !flightFilterDate || vueloDate === flightFilterDate;
      const byUas = !flightFilterUas || String(vuelo.uas || "").trim() === flightFilterUas;
      const byMission = !flightFilterMission || String(vuelo.misionId || "") === String(flightFilterMission);
      return byDate && byUas && byMission;
    });
  }, [flightFilterDate, flightFilterMission, flightFilterUas, vuelos]);

  const similarReports = useMemo(() => {
    if (!repTipoCode) return [];
    return reportes.filter((r) => String(r.tipo || "").includes(repTipoCode)).slice(0, 3);
  }, [repTipoCode, reportes]);

  const reportesVisibles = useMemo(() => {
    return reportes.filter((r) => String(r.reporteClase || "SMS").toUpperCase() !== "MOR");
  }, [reportes, section]);

  const reportesPaginados = useMemo(() => {
    const start = (reportesPage - 1) * PAGE_SIZE_REPORTES;
    return reportesVisibles.slice(start, start + PAGE_SIZE_REPORTES);
  }, [reportesVisibles, reportesPage]);

  const reportesPages = useMemo(
    () => Math.max(1, Math.ceil(reportesVisibles.length / PAGE_SIZE_REPORTES)),
    [reportesVisibles.length]
  );

  const vuelosPaginados = useMemo(() => {
    const start = (bitacoraPage - 1) * PAGE_SIZE_BITACORA;
    return vuelosFiltrados.slice(start, start + PAGE_SIZE_BITACORA);
  }, [bitacoraPage, vuelosFiltrados]);

  const bitacoraPages = useMemo(
    () => Math.max(1, Math.ceil(vuelosFiltrados.length / PAGE_SIZE_BITACORA)),
    [vuelosFiltrados.length]
  );

  const misionesProgramadas = useMemo(
    () => misiones.filter((m) => isMissionVisiblePendingStatus(m.estado)),
    [misiones]
  );

  const misionesCumplidas = useMemo(
    () => misiones.filter((m) => isMissionCompletedStatus(m.estado)),
    [misiones]
  );

  const misionesProgramadasPaginadas = useMemo(() => {
    const start = (misionesProgramadasPage - 1) * PAGE_SIZE_MISIONES;
    return misionesProgramadas.slice(start, start + PAGE_SIZE_MISIONES);
  }, [misionesProgramadas, misionesProgramadasPage]);

  const misionesCumplidasPaginadas = useMemo(() => {
    const start = (misionesCumplidasPage - 1) * PAGE_SIZE_MISIONES;
    return misionesCumplidas.slice(start, start + PAGE_SIZE_MISIONES);
  }, [misionesCumplidas, misionesCumplidasPage]);

  const misionesProgramadasPages = useMemo(
    () => Math.max(1, Math.ceil(misionesProgramadas.length / PAGE_SIZE_MISIONES)),
    [misionesProgramadas.length]
  );

  const misionesCumplidasPages = useMemo(
    () => Math.max(1, Math.ceil(misionesCumplidas.length / PAGE_SIZE_MISIONES)),
    [misionesCumplidas.length]
  );

  useEffect(() => {
    setReportesPage((prev) => Math.min(prev, reportesPages));
  }, [reportesPages]);

  useEffect(() => {
    setBitacoraPage((prev) => Math.min(prev, bitacoraPages));
  }, [bitacoraPages]);

  useEffect(() => {
    setMisionesProgramadasPage((prev) => Math.min(prev, misionesProgramadasPages));
  }, [misionesProgramadasPages]);

  useEffect(() => {
    setMisionesCumplidasPage((prev) => Math.min(prev, misionesCumplidasPages));
  }, [misionesCumplidasPages]);

  useEffect(() => {
    setBitacoraPage(1);
  }, [flightFilterDate, flightFilterMission, flightFilterUas]);

  useEffect(() => {
    if (section !== "my-reports") setReportesPage(1);
    if (section !== "flight-log") setBitacoraPage(1);
    if (section !== "missions") {
      setMisionesProgramadasPage(1);
      setMisionesCumplidasPage(1);
    }
  }, [section]);

  useEffect(() => {
    if (!showNewFlightModal) return;
    if (!flightNombrePiloto) setFlightNombrePiloto(usuario?.nombre || "");
    if (!flightNombrePilotoResponsable) setFlightNombrePilotoResponsable(usuario?.nombre || "");
    if (!flightIdentificacionPiloto) setFlightIdentificacionPiloto(usuario?.documento || "");
    if (!flightMisionId) {
      const suggestedMissionId = String(activeMission?._id || missionToday?._id || "").trim();
      if (suggestedMissionId) setFlightMisionId(suggestedMissionId);
    }
  }, [
    showNewFlightModal,
    flightNombrePiloto,
    flightNombrePilotoResponsable,
    flightIdentificacionPiloto,
    flightMisionId,
    activeMission?._id,
    missionToday?._id,
    usuario?.nombre,
    usuario?.documento,
  ]);

  const loadSyncSummary = useCallback(async () => {
    const [procQueue, reportesQueue, vuelosQueue, doneQueue, fieldQueue] = await Promise.all([
      getQueue<PendingProc>(SECURE_PROC_QUEUE_KEY),
      getReporteQueue(),
      getVuelosQueue(),
      getQueue<PendingMisionDone>(SECURE_MISION_CUMPLIDA_QUEUE_KEY),
      getOfflineActions(),
    ]);

    setSyncSummary({
      procedimientos: procQueue.length + fieldQueue.filter((item) => item.category === "procedure").length,
      reportes: reportesQueue.length + fieldQueue.filter((item) => item.category === "novelty").length,
      vuelos: vuelosQueue.length,
      logs: vuelosQueue.reduce((acc, item) => acc + (item.logs?.length || 0), 0),
      misiones: doneQueue.length + fieldQueue.filter((item) => ["operation", "evidence", "mission", "briefing"].includes(item.category)).length,
    });
  }, []);

  const setMorField = useCallback((key: string, value: any) => {
    setMorExtra((prev) => ({ ...prev, [key]: value }));
  }, []);

  useEffect(() => {
    loadSyncSummary();
  }, [loadSyncSummary, reportes, vuelos, misiones]);

  useEffect(() => {
    loadFratRecords();
  }, [loadFratRecords]);

  useEffect(() => {
    (async () => {
      try {
        const raw = await SecureStore.getItemAsync(SECURE_REPORTE_DRAFT_KEY);
        if (!raw) {
          setReporteDraftReady(true);
          return;
        }
        const draft = JSON.parse(raw || "{}");
        if (draft && typeof draft === "object") {
          setRepClase(draft.repClase || "SMS");
          setRepTipoCode(draft.repTipoCode || "");
          setRepTipoLabel(draft.repTipoLabel || "");
          setRepFechaHora(draft.repFechaHora || "");
          setRepUbicacion(draft.repUbicacion || "");
          setRepNumeroVuelo(draft.repNumeroVuelo || "");
          setRepDescripcion(draft.repDescripcion || "");
          setRepGravedad(draft.repGravedad || "");
          setRepTipoSituacion(draft.repTipoSituacion || "");
          setRepEsAnonimo(!!draft.repEsAnonimo);
          setRepMisionId(draft.repMisionId || "");
          setMorCiudad(draft.morCiudad || "");
          setMorHoraLocal(draft.morHoraLocal || "");
          setMorNarrativa(draft.morNarrativa || "");
          setMorSeveridad(draft.morSeveridad || "Moderado");
          setMorRiesgo(draft.morRiesgo || "Tolerable");
          setMorReportaNombre(draft.morReportaNombre || "");
          setMorReportaCorreo(draft.morReportaCorreo || "");
          setMorExtra({
            fechaActualizacion: draft?.morExtra?.fechaActualizacion || "",
            proveedorNit: draft?.morExtra?.proveedorNit || "",
            proveedorNombre: draft?.morExtra?.proveedorNombre || "",
            tipoProveedor: draft?.morExtra?.tipoProveedor || "Operador UAS",
            tipoProveedorOtro: draft?.morExtra?.tipoProveedorOtro || "",
            modalidadOperacion: draft?.morExtra?.modalidadOperacion || "Comercial",
            modalidadOperacionOtro: draft?.morExtra?.modalidadOperacionOtro || "",
            aeronave1Identificacion: draft?.morExtra?.aeronave1Identificacion || "",
            aeronave1Marca: draft?.morExtra?.aeronave1Marca || "",
            aeronave1Modelo: draft?.morExtra?.aeronave1Modelo || "",
            aeronave1Mtow: draft?.morExtra?.aeronave1Mtow || "",
            aeronave1Tipo: draft?.morExtra?.aeronave1Tipo || "Multirrotor",
            aeronave2Identificacion: draft?.morExtra?.aeronave2Identificacion || "",
            aeronave2Marca: draft?.morExtra?.aeronave2Marca || "",
            aeronave2Modelo: draft?.morExtra?.aeronave2Modelo || "",
            zonaOperacion: draft?.morExtra?.zonaOperacion || "Zona urbana",
            condicionMeteorologica: draft?.morExtra?.condicionMeteorologica || "VFR",
            latitud: draft?.morExtra?.latitud || "",
            longitud: draft?.morExtra?.longitud || "",
            altitudAprox: draft?.morExtra?.altitudAprox || "",
            oaci: draft?.morExtra?.oaci || "",
            aerodromoNombre: draft?.morExtra?.aerodromoNombre || "",
            tipoContactoVisual: draft?.morExtra?.tipoContactoVisual || "VLOS",
            faseOperacion: draft?.morExtra?.faseOperacion || "Misión / Operación",
            pilotoNombre: draft?.morExtra?.pilotoNombre || "",
            pilotoDocumento: draft?.morExtra?.pilotoDocumento || "",
            pilotoCertificado: draft?.morExtra?.pilotoCertificado || "",
            observadorNombre: draft?.morExtra?.observadorNombre || "",
            observadorDocumento: draft?.morExtra?.observadorDocumento || "",
            observadorCertificado: draft?.morExtra?.observadorCertificado || "",
            tipoDetalleEvento: draft?.morExtra?.tipoDetalleEvento || "",
            evidenciaFotos: !!draft?.morExtra?.evidenciaFotos,
            evidenciaVideo: !!draft?.morExtra?.evidenciaVideo,
            evidenciaLogVuelo: !!draft?.morExtra?.evidenciaLogVuelo,
            evidenciaTelemetria: !!draft?.morExtra?.evidenciaTelemetria,
            evidenciaOtros: !!draft?.morExtra?.evidenciaOtros,
            evidenciaOtrosDetalle: draft?.morExtra?.evidenciaOtrosDetalle || "",
            causa1: draft?.morExtra?.causa1 || "",
            causa2: draft?.morExtra?.causa2 || "",
            causa3: draft?.morExtra?.causa3 || "",
            causa4: draft?.morExtra?.causa4 || "",
            causa5: draft?.morExtra?.causa5 || "",
            reportaCargo: draft?.morExtra?.reportaCargo || "",
            reportaContacto: draft?.morExtra?.reportaContacto || "",
            firma: draft?.morExtra?.firma || "",
            fechaFirma: draft?.morExtra?.fechaFirma || "",
          });
        }
      } catch (e) {
        console.log("No se pudo cargar borrador:", e);
      } finally {
        setReporteDraftReady(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (!reporteDraftReady) return;
    const draft = {
      repClase,
      repTipoCode,
      repTipoLabel,
      repFechaHora,
      repUbicacion,
      repNumeroVuelo,
      repDescripcion,
      repGravedad,
      repTipoSituacion,
      repEsAnonimo,
      repMisionId,
      morCiudad,
      morHoraLocal,
      morNarrativa,
      morSeveridad,
      morRiesgo,
      morReportaNombre,
      morReportaCorreo,
      morExtra,
    };
    SecureStore.setItemAsync(SECURE_REPORTE_DRAFT_KEY, JSON.stringify(draft), {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    }).catch((e) => console.log("No se pudo guardar borrador:", e));
  }, [reporteDraftReady, repClase, repDescripcion, repFechaHora, repGravedad, repTipoSituacion, repEsAnonimo, repMisionId, repNumeroVuelo, repTipoCode, repTipoLabel, repUbicacion, morCiudad, morHoraLocal, morNarrativa, morSeveridad, morRiesgo, morReportaNombre, morReportaCorreo, morExtra]);

  const loadOfflineMisiones = useCallback(async () => {
  try {
    const raw = await SecureStore.getItemAsync(SECURE_MISIONES_KEY);
    const arr = raw ? (JSON.parse(raw) as Mision[]) : [];
    setMisiones(Array.isArray(arr) ? arr : []);
  } catch (e) {
    console.log("Error cargando misiones offline:", e);
    setMisiones([]);
  }
}, []);

  const loadMisiones = useCallback(async () => {
  try {
    setLoadingMisiones(true);

    const r = await apiFetch<any>("/api/misiones");
    const arr: Mision[] = Array.isArray(r) ? r : (r?.data ?? r?.misiones ?? []);

    setMisiones(arr);

    await SecureStore.setItemAsync(SECURE_MISIONES_KEY, JSON.stringify(arr), {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });

    return arr; // ✅ IMPORTANTE
  } catch (e) {
    Toast.show({ type: "info", text1: "Modo offline", text2: "Mostrando misiones guardadas." });
    await loadOfflineMisiones();
    return []; // ✅
  } finally {
    setLoadingMisiones(false);
  }
}, [loadOfflineMisiones]);

const closeMissionPlanner = useCallback(() => {
  setShowMissionPlanner(false);
}, []);

const handleMissionPlannerCreated = useCallback(async () => {
  await loadMisiones();
}, [loadMisiones]);


useEffect(() => {
  if (section !== "missions" && section !== "procedures") return;

  (async () => {
    const list = await loadMisiones(); // ✅ trae de BD y retorna array

    const ids = (list || [])
      .filter((m) => m.estado !== "Cumplida")
      .map((m) => m._id);

    if (ids.length) {
      await loadProcStatusBatch(ids); // ✅ llena procStatusMap desde BD
    }
  })();
}, [section, loadMisiones]);


// ✅ Asociación de misión para procedimientos
type ProcKind = "preflight" | "autoeval" | "battery";

const [procMission, setProcMission] = useState<Mision | null>(null);
const [showProcMissionModal, setShowProcMissionModal] = useState(false);
const [pendingProc, setPendingProc] = useState<ProcKind | null>(null);



// ✅ Abre selector de misión y luego abre el procedimiento elegido
const openProcedureWithMission = useCallback(
  async (kind: ProcKind) => {
    closeKeyboard();

    // ✅ asegurar misiones cargadas
    let list = misiones;
    try {
      if (!list.length) {
        await loadMisiones();
        list = misiones; // puede que tarde un render, pero sirve para la mayoría de casos
      }
    } catch (e) {
      console.log("⚠️ loadMisiones falló:", (e as any)?.message);
    }

    // ✅ pedir al backend qué ya está completado
    try {
      const ids = (list || [])
        .filter((m) => m.estado !== "Cumplida")
        .map((m) => m._id);

      if (ids.length) {
        await loadProcStatusBatch(ids);
      }
    } catch (e) {
      console.log("⚠️ status batch falló:", (e as any)?.message);
    }

    // ✅ preparar flujo
    setPendingProc(kind);
    setShowProcMissionModal(true);

    // (opcional) voz
    try {
      Speech.stop();
      Speech.speak(
        "¿A cuál misión deseas asociar este procedimiento? Selecciona una misión.",
        {     language: isOnline ? "es-CO" : "es-ES",
 rate: 1.3 }
      );
    } catch {}
  },
  [closeKeyboard, misiones, loadMisiones]
);

const flowToUiStatus = useCallback((flujo: FlujoOperacionApi) => {
  const qrReads = Number(flujo?.lecturasQr?.length || 0);
  const batteryChanges = Number(flujo?.cambiosBateria?.length || 0);
  const estado = String(flujo?.estado || "PENDIENTE").toUpperCase();
  return {
    qrReads,
    batteryChanges,
    started: estado === "EN_OPERACION" || estado === "ATERRIZAJE_CAMBIO_BATERIA" || estado === "FINALIZADA",
    awaitingTakeoff: estado === "ATERRIZAJE_CAMBIO_BATERIA",
    finalized: estado === "FINALIZADA",
  };
}, []);

const applyFlowApiToMissionStatus = useCallback((missionId: string, flujo: FlujoOperacionApi | null | undefined) => {
  if (!flujo) return;
  setOperationStatusMap((prev) => ({
    ...prev,
    [missionId]: flowToUiStatus(flujo),
  }));
}, [flowToUiStatus]);

const fetchFlowStatus = useCallback(async (missionId: string) => {
  try {
    const r = await apiFetch<{ ok?: boolean; flujo?: FlujoOperacionApi }>(`/api/misiones/${missionId}/flujo-operacion`);
    applyFlowApiToMissionStatus(missionId, r?.flujo);
  } catch (e) {
    console.log("⚠️ flow status:", (e as any)?.message || e);
  }
}, [applyFlowApiToMissionStatus]);

const openOperationFlow = useCallback((mision: Mision) => {
  setOperationMission(mision);
  // Si la misión no está cumplida, no debe abrir como "finalizada" por estado viejo en memoria.
  if (mision.estado !== "Cumplida") {
    setOperationStatusMap((prev) => {
      const current = prev[mision._id] || { qrReads: 0, started: false, batteryChanges: 0, finalized: false, awaitingTakeoff: false };
      return { ...prev, [mision._id]: { ...current, finalized: false } };
    });
  }
  setShowOperationFlowModal(true);
  fetchFlowStatus(mision._id);
}, [fetchFlowStatus]);

const continueMissionProcedureFlow = useCallback((mision: Mision) => {
  closeKeyboard();
  setActiveMissionId(mision._id);
  setGuidedFlowMissionId(mision._id);

  const proc = procStatusMap[mision._id] || { preflight: false, autoeval: false, battery: false };
  setProcMission(mision);

  if (!proc.preflight) {
    setShowChecklistModal(true);
    Toast.show({
      type: "info",
      text1: "Flujo operativo",
      text2: "Paso 1/3: completa Checklist pre-vuelo.",
    });
    return;
  }

  if (!proc.autoeval) {
    setShowAutoevalModal(true);
    Toast.show({
      type: "info",
      text1: "Flujo operativo",
      text2: "Paso 2/3: completa Autoevaluación.",
    });
    return;
  }

  if (!proc.battery) {
    setShowBatteryModal(true);
    Toast.show({
      type: "info",
      text1: "Flujo operativo",
      text2: "Paso 3/3: completa Variables críticas.",
    });
    return;
  }

  openOperationFlow(mision);
  Toast.show({
    type: "success",
    text1: "Procedimientos completos",
    text2: "Ahora escanea QR de batería e inicia operación.",
  });
}, [closeKeyboard, procStatusMap, openOperationFlow]);

const iniciarMision = useCallback((mision: Mision) => {
  closeKeyboard();
  setActiveMissionId(mision._id);
  setGuidedFlowMissionId(mision._id);
  setProcMission(mision);
  goSection("procedures");
  Toast.show({
    type: "info",
    text1: "Flujo de misión",
    text2: "Completa procedimientos en la sección Procedimientos.",
  });
}, [closeKeyboard, goSection]);

const openProceduresAll = useCallback(() => {
  setGuidedFlowMissionId(null);
  setProcMission(null);
  goSection("procedures");
}, [goSection]);


// ✅ Confirma misión (o null) y abre el modal correcto
const confirmProcMission = useCallback(
  (m: Mision | null) => {
    setProcMission(m);
    setShowProcMissionModal(false);

    // ✅ Abre el modal según lo que estabas intentando abrir
    if (pendingProc === "preflight") setShowChecklistModal(true);
    if (pendingProc === "autoeval") setShowAutoevalModal(true);
    if (pendingProc === "battery") setShowBatteryModal(true);

    // ✅ Limpia estado transitorio
    setPendingProc(null);
  },
  [pendingProc]
);

const markOperationStatus = useCallback(
  (missionId: string, patch: Partial<{ qrReads: number; started: boolean; batteryChanges: number; finalized: boolean; awaitingTakeoff: boolean }>) => {
    setOperationStatusMap((prev) => {
      const current = prev[missionId] || { qrReads: 0, started: false, batteryChanges: 0, finalized: false, awaitingTakeoff: false };
      return { ...prev, [missionId]: { ...current, ...patch } };
    });
  },
  []
);

const startOperationTracking = useCallback(async (missionId: string) => {
  try {
    operationLocationSubRef.current?.remove();
    const key = `uas_operation_track_${missionId}`;
    const stored = await AsyncStorage.getItem(key);
    operationTrackRef.current = stored ? JSON.parse(stored) : [];
    operationTrackMissionRef.current = missionId;
    const permission = await Location.requestForegroundPermissionsAsync();
    if (permission.status !== "granted") return;
    operationLocationSubRef.current = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: 10000,
        distanceInterval: 5,
      },
      (position) => {
        const point = {
          lat: position.coords.latitude,
          lon: position.coords.longitude,
          accuracy: position.coords.accuracy,
          at: new Date(position.timestamp || Date.now()).toISOString(),
        };
        operationTrackRef.current = [...operationTrackRef.current, point].slice(-5000);
        AsyncStorage.setItem(key, JSON.stringify(operationTrackRef.current)).catch(() => {});
      }
    );
  } catch (error: any) {
    console.log("No se pudo iniciar ruta offline:", error?.message || error);
  }
}, []);

const stopOperationTracking = useCallback(async (missionId: string) => {
  operationLocationSubRef.current?.remove();
  operationLocationSubRef.current = null;
  const key = `uas_operation_track_${missionId}`;
  try {
    const stored = await AsyncStorage.getItem(key);
    const route = stored ? JSON.parse(stored) : operationTrackRef.current;
    return Array.isArray(route) ? route : [];
  } catch {
    return operationTrackRef.current;
  }
}, []);

const queueOperationAction = useCallback(async (
  missionId: string,
  endpoint: string,
  method: "POST" | "PATCH",
  body: Record<string, any> = {}
) => {
  await enqueueOfflineAction({
    category: "operation",
    missionId,
    endpoint,
    method,
    body,
  });
  await loadSyncSummary();
}, [loadSyncSummary]);

const addQrRead = useCallback(async () => {
  if (!operationMission?._id) return;
  const missionId = operationMission._id;
  const net = await NetInfo.fetch();
  const online = !!net.isConnected && !!net.isInternetReachable;
  if (!online) {
    const current = operationStatusMap[missionId] || { qrReads: 0, started: false, batteryChanges: 0, finalized: false, awaitingTakeoff: false };
    markOperationStatus(missionId, { qrReads: current.qrReads + 1 });
    navigation.navigate("QrScan", { missionId, operationContext: true });
    Toast.show({ type: "info", text1: "Lector offline", text2: "El QR se validará con el inventario guardado." });
    return;
  }
  navigation.navigate("QrScan", { missionId, operationContext: true });
}, [operationMission?._id, operationStatusMap, markOperationStatus, navigation, applyFlowApiToMissionStatus, queueOperationAction]);

const performStartOperation = useCallback(async () => {
  if (!operationMission?._id) return;
  const missionId = operationMission._id;
  await startOperationTracking(missionId);
  const net = await NetInfo.fetch();
  const online = !!net.isConnected && !!net.isInternetReachable;
  if (!online) {
    await queueOperationAction(missionId, `/api/misiones/${missionId}/flujo-operacion/iniciar`, "PATCH", {
      frat: fratRecordsMap[missionId] || null,
    });
    markOperationStatus(missionId, { started: true, finalized: false, awaitingTakeoff: false });
    Toast.show({ type: "success", text1: "Operación iniciada offline", text2: "El evento quedó pendiente de sincronización." });
    return;
  }
  apiFetch<{ ok?: boolean; flujo?: FlujoOperacionApi }>(`/api/misiones/${operationMission._id}/flujo-operacion/iniciar`, {
    method: "PATCH",
    body: JSON.stringify({ frat: fratRecordsMap[missionId] || null }),
  })
    .then((r) => {
      applyFlowApiToMissionStatus(operationMission._id, r?.flujo);
      Toast.show({ type: "success", text1: "Operación iniciada", text2: "Puedes continuar con el vuelo." });
    })
    .catch((e) => {
      console.log("⚠️ iniciar operación:", e?.message || e);
      markOperationStatus(operationMission._id, { started: true, finalized: false, awaitingTakeoff: false });
      Toast.show({ type: "success", text1: "Operación iniciada", text2: "Puedes continuar con el vuelo." });
    });
}, [operationMission?._id, markOperationStatus, applyFlowApiToMissionStatus, queueOperationAction, fratRecordsMap, startOperationTracking]);

const startOperation = useCallback(async () => {
  if (!operationMission?._id) return;

  if (!fratCompleted) {
    Toast.show({ type: "info", text1: "Evaluación FRAT", text2: "Completa la evaluación de riesgo antes de iniciar." });
    openFratForOperation(operationMission);
    return;
  }

  if (fratRiskLevel === "PELIGRO") {
    Toast.show({ type: "error", text1: "Operación bloqueada", text2: "El FRAT quedó en peligro. Reduce el riesgo antes de iniciar." });
    openFratForOperation(operationMission);
    return;
  }

  if (fratRiskLevel === "PREOCUPACION" && !fratObservation.trim()) {
    Toast.show({ type: "info", text1: "Observación requerida", text2: "Describe la mitigación antes de iniciar la operación." });
    openFratForOperation(operationMission);
    return;
  }

  const record: FratRecord = {
    misionId: operationMission._id,
    missionTitle: operationMission.titulo || "Misión",
    createdAt: new Date().toISOString(),
    leftTotal: fratLeftTotal,
    rightTotal: fratRightTotal,
    total: fratTotal,
    riskLevel: fratRiskLevel,
    blocked: false,
    observation: fratObservation.trim(),
    answers: fratAnswers,
  };

  const nextMap = { ...fratRecordsMap, [operationMission._id]: record };
  setFratRecordsMap(nextMap);
  await persistFratRecords(nextMap);
  setShowFratModal(false);
  performStartOperation();
}, [
  operationMission,
  fratCompleted,
  fratRiskLevel,
  fratObservation,
  fratLeftTotal,
  fratRightTotal,
  fratTotal,
  fratAnswers,
  fratRecordsMap,
  persistFratRecords,
  performStartOperation,
  openFratForOperation,
]);

const registerBatteryChangeLanding = useCallback(async () => {
  if (!operationMission?._id) return;
  const missionId = operationMission._id;
  const net = await NetInfo.fetch();
  const online = !!net.isConnected && !!net.isInternetReachable;
  if (!online) {
    await queueOperationAction(missionId, `/api/misiones/${missionId}/flujo-operacion/aterrizar-cambio`, "PATCH");
    const current = operationStatusMap[missionId] || { qrReads: 0, started: false, batteryChanges: 0, finalized: false, awaitingTakeoff: false };
    markOperationStatus(missionId, { batteryChanges: current.batteryChanges + 1, awaitingTakeoff: true, started: false });
    navigation.navigate("QrScan", { missionId, operationContext: true });
    Toast.show({ type: "info", text1: "Aterrizaje guardado offline", text2: "Escanea la batería de reemplazo." });
    return;
  }
  apiFetch<{ ok?: boolean; flujo?: FlujoOperacionApi }>(`/api/misiones/${operationMission._id}/flujo-operacion/aterrizar-cambio`, {
    method: "PATCH",
  })
    .then((r) => {
      applyFlowApiToMissionStatus(operationMission._id, r?.flujo);
      Toast.show({ type: "info", text1: "Cambio de batería", text2: "Aterrizaje registrado. Abriendo lector QR." });
      navigation.navigate("QrScan", { missionId, operationContext: true });
    })
    .catch((e) => {
      console.log("⚠️ aterrizar cambio:", e?.message || e);
      const current = operationStatusMap[operationMission._id] || { qrReads: 0, started: false, batteryChanges: 0, finalized: false, awaitingTakeoff: false };
      markOperationStatus(operationMission._id, {
        batteryChanges: current.batteryChanges + 1,
        awaitingTakeoff: true,
        started: false,
      });
      Toast.show({ type: "info", text1: "Cambio de batería", text2: "Aterrizaje registrado. Abriendo lector QR." });
      navigation.navigate("QrScan", { missionId, operationContext: true });
    });
}, [operationMission?._id, operationStatusMap, markOperationStatus, navigation, applyFlowApiToMissionStatus, queueOperationAction]);

const resumeOperationAfterBatteryChange = useCallback(async () => {
  if (!operationMission?._id) return;
  const missionId = operationMission._id;
  const net = await NetInfo.fetch();
  const online = !!net.isConnected && !!net.isInternetReachable;
  if (!online) {
    await queueOperationAction(missionId, `/api/misiones/${missionId}/flujo-operacion/despegar`, "PATCH");
    markOperationStatus(missionId, { awaitingTakeoff: false, started: true });
    Toast.show({ type: "success", text1: "Despegue guardado offline", text2: "Se sincronizará automáticamente." });
    return;
  }
  apiFetch<{ ok?: boolean; flujo?: FlujoOperacionApi }>(`/api/misiones/${operationMission._id}/flujo-operacion/despegar`, {
    method: "PATCH",
  })
    .then((r) => {
      applyFlowApiToMissionStatus(operationMission._id, r?.flujo);
      Toast.show({ type: "success", text1: "Operación reanudada", text2: "Despegue después de cambio de batería registrado." });
    })
    .catch((e) => {
      console.log("⚠️ despegar tras cambio:", e?.message || e);
      markOperationStatus(operationMission._id, { awaitingTakeoff: false, started: true });
      Toast.show({ type: "success", text1: "Operación reanudada", text2: "Despegue después de cambio de batería registrado." });
    });
}, [operationMission?._id, markOperationStatus, applyFlowApiToMissionStatus, queueOperationAction]);

const finalizeOperation = useCallback(async () => {
  if (!operationMission?._id) return;
  const missionId = operationMission._id;
  const rutaGps = await stopOperationTracking(missionId);
  const net = await NetInfo.fetch();
  const online = !!net.isConnected && !!net.isInternetReachable;
  if (!online) {
    await queueOperationAction(missionId, `/api/misiones/${missionId}/flujo-operacion/finalizar`, "PATCH", { rutaGps });
    markOperationStatus(missionId, { started: false, finalized: true, awaitingTakeoff: false });
    setShowOperationFlowModal(false);
    setEvidenceMissionId(missionId);
    setEvidenceNote("");
    setEvidenceItems([]);
    setEvidenceChecklist({ area: false, aeronave: false, equipo: false });
    setShowEvidenceModal(true);
    Toast.show({ type: "info", text1: "Finalización provisional", text2: "Adjunta evidencias; todo se enviará al recuperar conexión." });
    return;
  }
  apiFetch<{ ok?: boolean; flujo?: FlujoOperacionApi }>(`/api/misiones/${operationMission._id}/flujo-operacion/finalizar`, {
    method: "PATCH",
    body: JSON.stringify({ rutaGps }),
  })
    .then((r) => {
      applyFlowApiToMissionStatus(operationMission._id, r?.flujo);
      setShowOperationFlowModal(false);
      setEvidenceMissionId(operationMission._id);
      setEvidenceNote("");
      setEvidenceItems([]);
      setEvidenceChecklist({ area: false, aeronave: false, equipo: false });
      setShowEvidenceModal(true);
      Toast.show({
        type: "info",
        text1: "Cierre de operación",
        text2: "Adjunta evidencias para marcar la misión como cumplida.",
      });
    })
    .catch((e) => {
      Toast.show({
        type: "error",
        text1: "Error",
        text2: e?.message || "No se pudo finalizar la operación",
      });
    });
}, [operationMission?._id, applyFlowApiToMissionStatus, markOperationStatus, queueOperationAction, stopOperationTracking]);

const loadOfflineProfile = useCallback(async () => {
  try {
    const raw = await SecureStore.getItemAsync(SECURE_PROFILE_KEY);
    if (!raw) return;

    const me = JSON.parse(raw);
    const claims = decodeJwtAccess(await getToken());

    // ✅ tu UI usa "usuario"
    setUsuario({
      ...me,
      empresaId: me?.empresaId || claims.empresaId,
      rolActivo: me?.rolActivo || claims.rolActivo,
      rol: me?.rol || claims.rol,
    });
  
  } catch (e) {
    console.log("Error cargando perfil offline:", e);
  }
}, []);


  const loadDashboard = useCallback(async () => {
    setLoadingDashboard(true);
    let profileLoaded = false;
    try {
      // 1) Perfil primero: no debe depender de alertas/misiones
      try {
        const me = await apiFetch<Usuario>("/api/me");
        const claims = decodeJwtAccess(await getToken());
        const profileWithAccess = {
          ...me,
          empresaId: me?.empresaId || claims.empresaId,
          rolActivo: me?.rolActivo || claims.rolActivo,
          rol: me?.rol || claims.rol,
        };
        setUsuario(profileWithAccess);
        profileLoaded = true;
        await SecureStore.setItemAsync(SECURE_PROFILE_KEY, JSON.stringify(profileWithAccess), {
          keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
        });
      } catch (e) {
        console.log("No se pudo refrescar /api/me:", e);
      }

      // 2) Alertas y misiones en paralelo, sin tumbar el perfil
      const [aRes, msRes] = await Promise.allSettled([
        apiFetch<Alerta[]>("/api/alertas"),
        apiFetch<Mision[]>("/api/misiones"),
      ]);

      if (aRes.status === "fulfilled") setAlertas(aRes.value || []);
      if (msRes.status === "fulfilled") setMisiones(msRes.value || []);

      // 3) Solo si ni siquiera el perfil pudo cargar, usar offline
      if (!profileLoaded) {
        Toast.show({
          type: "info",
          text1: "Modo offline",
          text2: "Sin conexión. Mostrando datos guardados.",
        });
        await loadOfflineProfile();
      }
    } catch (e) {
      if (!profileLoaded) {
        Toast.show({
          type: "info",
          text1: "Modo offline",
          text2: "Sin conexión. Mostrando datos guardados.",
        });
        await loadOfflineProfile();
      }
    } finally {
      setLoadingDashboard(false);
    }
  }, [loadOfflineProfile]);

  const triggerPanicAlert = useCallback(async () => {
    if (panicSending) return;

    setPanicSending(true);
    try {
      let lat: number | null = null;
      let lng: number | null = null;
      let accuracy: number | null = null;

      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (servicesEnabled) {
        const perm = await Location.requestForegroundPermissionsAsync();
        if (perm.status === "granted") {
          if (Platform.OS === "android") {
            try {
              await Location.enableNetworkProviderAsync();
            } catch {}
          }

          try {
            const pos = await withTimeout(
              Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
              8000
            );
            const coords = pos?.coords;
            lat = Number.isFinite(Number(coords?.latitude)) ? Number(coords?.latitude) : null;
            lng = Number.isFinite(Number(coords?.longitude)) ? Number(coords?.longitude) : null;
            accuracy = Number.isFinite(Number(coords?.accuracy)) ? Number(coords?.accuracy) : null;
          } catch {
            lat = null;
            lng = null;
            accuracy = null;
          }
        }
      }

      const response = await apiFetch<PanicAlertApiResponse>("/api/panic-alert", {
        method: "POST",
        body: JSON.stringify({ lat, lng, accuracy }),
      });

      Toast.show({
        type: "success",
        text1: "Alerta enviada",
        text2: response?.message || "Se notificó al gerente, admin y jefe de pilotos.",
      });
    } catch (e: any) {
      Toast.show({
        type: "error",
        text1: "Botón de pánico",
        text2: e?.message || "No se pudo enviar la alerta.",
      });
    } finally {
      setPanicSending(false);
    }
  }, [panicSending]);

const loadOfflineReportes = useCallback(async () => {
  try {
    const raw = await SecureStore.getItemAsync(SECURE_REPORTES_KEY);
    const arr = raw ? (JSON.parse(raw) as Reporte[]) : [];
    setReportes(Array.isArray(arr) ? arr : []);
  } catch (e) {
    console.log("Error cargando reportes offline:", e);
    setReportes([]);
  }
}, []);


  const loadReportes = useCallback(async () => {
  try {
    setLoadingReportes(true);

    // ✅ 1) Pendientes offline SIEMPRE arriba
    const pending = await getReporteQueue();
    const pendingUI = pending.map(pendingToReporteUI);

    // ✅ 2) Intentar traer del backend
    const r = await apiFetch<any>("/api/reportes");
    const arr: Reporte[] = Array.isArray(r) ? r : (r?.data ?? r?.reportes ?? []);

    // ✅ 3) Mostrar todo
    setReportes([...(pendingUI as any), ...(arr as any)]);

    // ✅ 4) cache offline SOLO del server (no de la cola)
    await SecureStore.setItemAsync(SECURE_REPORTES_KEY, JSON.stringify(arr), {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  } catch (e: any) {
    // ✅ si no hay internet: pendientes + cache
    Toast.show({
      type: "info",
      text1: "Modo offline",
      text2: "Mostrando reportes guardados + pendientes.",
    });

    const pending = await getReporteQueue();
    const pendingUI = pending.map(pendingToReporteUI);

    const raw = await SecureStore.getItemAsync(SECURE_REPORTES_KEY);
    const cached = raw ? JSON.parse(raw) : [];
    const arr: Reporte[] = Array.isArray(cached) ? cached : [];

    setReportes([...(pendingUI as any), ...(arr as any)]);
  } finally {
    setLoadingReportes(false);
  }
}, []);

const syncReportesQueue = useCallback(async () => {
  try {
    const q = await getReporteQueue();
    console.log("ðŸŸ¦ reportesQueue size:", q.length);
    if (!q.length) return;

    const net = await NetInfo.fetch();
    const online = !!net.isConnected && !!net.isInternetReachable;
    if (!online) return;

    const token = await getToken();
    if (!token) return;

    const still: PendingReporte[] = [];

    for (const item of q) {
      try {
        console.log("ðŸ“¤ Sync reporte localId:", item.localId);
        await apiFetch("/api/reportes", {
          method: "POST",
          body: JSON.stringify(item.payload),
        });
        console.log("✅ Enviado:", item.localId);
      } catch (err: any) {
        console.log("❌ Falló sync:", item.localId, err?.message);
        still.push(item);
      }
    }

    await setReporteQueue(still);

    // ✅ refrescar UI
    await loadReportes();

    if (q.length && still.length === 0) {
      Toast.show({
        type: "success",
        text1: "Sincronizado",
        text2: "Reportes pendientes enviados.",
      });
    }
  } catch (e: any) {
    console.log("❌ syncReportesQueue fatal:", e?.message);
  }
}, [loadReportes]);


useEffect(() => {
  const unsub = NetInfo.addEventListener((state) => {
    const online = !!state.isConnected && !!state.isInternetReachable;
    if (online) syncReportesQueue();
  });
  return () => unsub();
}, [syncReportesQueue]);



const loadOfflineVuelos = useCallback(async () => {
  try {
    const raw = await SecureStore.getItemAsync(SECURE_VUELOS_KEY);
    const arr = raw ? (JSON.parse(raw) as Vuelo[]) : [];
    setVuelos(Array.isArray(arr) ? arr : []);
  } catch (e) {
    console.log("Error cargando vuelos offline:", e);
    setVuelos([]);
  }
}, []);


  const loadVuelos = useCallback(async () => {
  try {
    setLoadingVuelos(true);

    // ✅ 1) Pendientes offline arriba
      const pending = await getVuelosQueue();
      const pendingUI = pending.map(pendingToVueloUI).map(normalizeVueloTimes);

    // ✅ 2) Traer del backend
      const v = await apiFetch<Vuelo[]>("/api/vuelos");
      const arr = (v || []).map(normalizeVueloTimes);

    // ✅ 3) Mostrar todo
    setVuelos([...(pendingUI as any), ...(arr as any)]);

    // ✅ cache offline SOLO server
    await SecureStore.setItemAsync(SECURE_VUELOS_KEY, JSON.stringify(arr), {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  } catch (e: any) {
    Toast.show({
      type: "info",
      text1: "Modo offline",
      text2: "Mostrando bitácoras guardadas + pendientes.",
    });

      const pending = await getVuelosQueue();
      const pendingUI = pending.map(pendingToVueloUI).map(normalizeVueloTimes);

      const raw = await SecureStore.getItemAsync(SECURE_VUELOS_KEY);
      const cached = raw ? JSON.parse(raw) : [];
      const arr: Vuelo[] = Array.isArray(cached) ? cached.map(normalizeVueloTimes) : [];

    setVuelos([...(pendingUI as any), ...(arr as any)]);
  } finally {
    setLoadingVuelos(false);
  }
}, []);

const loadBitacoraSolicitudes = useCallback(async () => {
  try {
    setBitacoraSolicitudesLoading(true);
    const r = await apiFetch<any>("/api/bitacoras-vuelo/mis-solicitudes");
    setBitacoraSolicitudes(Array.isArray(r?.solicitudes) ? r.solicitudes : []);
  } catch (e: any) {
    console.log("Error cargando solicitudes de bitacora:", e?.message || e);
  } finally {
    setBitacoraSolicitudesLoading(false);
  }
}, []);

const solicitarBitacoraVuelo = useCallback(async () => {
  if (bitacoraSolicitando) return;
  try {
    setBitacoraSolicitando(true);
    const r = await apiFetch<any>("/api/bitacoras-vuelo/solicitar", {
      method: "POST",
      body: JSON.stringify({}),
    });
    Toast.show({
      type: "success",
      text1: "Solicitud enviada",
      text2: r?.message || "El jefe de pilotos recibira la solicitud.",
    });
    await loadBitacoraSolicitudes();
  } catch (e: any) {
    Toast.show({
      type: "error",
      text1: "No se pudo solicitar",
      text2: e?.message || "Intenta nuevamente.",
    });
  } finally {
    setBitacoraSolicitando(false);
  }
}, [bitacoraSolicitando, loadBitacoraSolicitudes]);

const descargarBitacoraFirmada = useCallback(async (id: string) => {
  try {
    const r = await apiFetch<any>(`/api/bitacoras-vuelo/${id}/descargar-url`);
    if (!r?.url) throw new Error("No se recibio el enlace de descarga.");
    await Linking.openURL(r.url);
  } catch (e: any) {
    Toast.show({
      type: "error",
      text1: "No se pudo descargar",
      text2: e?.message || "Intenta nuevamente.",
    });
  }
}, []);

const bitacoraSolicitudEstadoLabel = useCallback((s: any) => {
  const estado = String(s?.estado || "").toLowerCase();
  if (estado === "aprobada") return "Aprobada";
  if (estado === "rechazada") return "Rechazada";
  return "Pendiente";
}, []);


const flushingVuelosRef = React.useRef(false);

const flushVuelosQueue = useCallback(async () => {
  if (flushingVuelosRef.current) return;  // ✅ evita doble flush
  flushingVuelosRef.current = true;

  try {
    const net = await NetInfo.fetch();
    const online = !!net.isConnected && !!net.isInternetReachable;
    if (!online) return;

    let q = await getVuelosQueue();
    if (!q.length) return;

    for (const item of q) {
      // ✅ si ya lo está enviando otro flush, lo saltamos
      if (item.sending) continue;

      // ✅ marcar como sending y persistir (clave para evitar duplicados)
      item.sending = true;
      await setVuelosQueue(q);

      try {
        await apiFetch("/api/vuelos", {
          method: "POST",
          body: JSON.stringify(item.payload),
        });

        // ✅ si fue OK => remover de la cola
        q = q.filter((x) => x.localId !== item.localId);
        await setVuelosQueue(q);
      } catch (e) {
        // ✅ si falló => desmarcar y parar (no spamear)
        item.sending = false;
        await setVuelosQueue(q);
        break;
      }
    }

    // opcional: recargar lista ya en servidor
    await loadVuelos();
  } finally {
    flushingVuelosRef.current = false;
  }
}, [loadVuelos]);


const syncingVuelosRef = React.useRef(false);

const syncVuelosQueue = useCallback(async () => {
  // ✅ 1) LOCK (evita doble ejecución simultánea)
  if (syncingVuelosRef.current) return;
  syncingVuelosRef.current = true;

  try {
    const net = await NetInfo.fetch();
    const online = !!net.isConnected && !!net.isInternetReachable;
    if (!online) return;

    const q = await getVuelosQueue();
    console.log("ðŸŸ¦ vuelosQueue size:", q.length);
    if (!q.length) return;

    // ✅ 2) CONSUMIR cola: la vaciamos primero para evitar duplicados
    await setVuelosQueue([]);

    const still: PendingVuelo[] = [];

    for (const item of q) {
      try {
        console.log("ðŸ“¤ Sync vuelo localId:", item.localId);

        // ✅ A) Crear vuelo en backend
        const created: any = await apiFetch("/api/vuelos", {
          method: "POST",
          body: JSON.stringify(item.payload),
        });

        // ✅ B) Obtener el ID real del vuelo creado (ajusta si tu backend devuelve distinto)
        const vueloId =
          created?._id ||
          created?.vuelo?._id ||
          created?.data?._id ||
          created?.data?.vuelo?._id;

        if (vueloId && item.logs?.length) {
          try {
            const queuedFiles = item.logs.map((queuedLog) => ({
              id: makeLocalId("flight_log_sync"),
              uri: queuedLog.uri,
              name: queuedLog.name || "archivo",
              mimeType: queuedLog.mimeType || "application/octet-stream",
              size: Number(queuedLog.size || 0),
              ext: getFlightLogExtension(queuedLog.name),
            }));

            const results = await uploadFlightLogsOnline(queuedFiles);
            if (results.some((result) => !result.ok)) {
              still.push(item);
              continue;
            }
          } catch (e: any) {
            still.push(item);
            continue;
          }
        } else if (item.logs?.length && !vueloId) {
          still.push(item);
          continue;
        }

        console.log("✅ Enviado vuelo:", item.localId);
      } catch (err: any) {
        console.log("❌ Falló sync vuelo:", item.localId, err?.message);
        still.push(item); // vuelve a cola si falló
      }
    }

    // ✅ 3) Re-guardar solo los que fallaron
    await setVuelosQueue(still);

    // ✅ 4) refrescar lista
    await loadVuelos();

    if (q.length && still.length === 0) {
      Toast.show({
        type: "success",
        text1: "Sincronizado",
        text2: "Vuelos pendientes enviados.",
      });
    } else if (still.length > 0) {
      Toast.show({
        type: "info",
        text1: "Sincronización parcial",
        text2: `Quedaron ${still.length} vuelos pendientes por reintentar.`,
      });
    }
  } catch (e: any) {
    console.log("❌ syncVuelosQueue fatal:", e?.message);
  } finally {
    syncingVuelosRef.current = false;
  }
}, [loadVuelos]);

useEffect(() => {
  const unsub = NetInfo.addEventListener((state) => {
    const online = !!state.isConnected && !!state.isInternetReachable;
    if (online) {
      syncReportesQueue?.(); // si existe en tu scope
      syncVuelosQueue();
      syncOfflineActions()
        .then((result) => {
          if (result.sent > 0) {
            Toast.show({
              type: "success",
              text1: "Trabajo de campo sincronizado",
              text2: `${result.sent} acción(es) enviada(s).`,
            });
            loadMisiones();
            loadDashboard();
          }
          loadSyncSummary();
        })
        .catch(() => {});
    }
  });
  return () => unsub();
}, [syncVuelosQueue, loadDashboard, loadMisiones, loadSyncSummary /*, syncReportesQueue */]);


const loadOfflineEquipos = useCallback(async () => {
  try {
    const raw = await SecureStore.getItemAsync(SECURE_EQUIPOS_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    const visibles = isChiefPilotRole ? arr : filtrarEquiposVisiblesParaPiloto(arr);
    setEquipos(visibles);
    setEquipoSel((prev) => (prev && visibles.some((e) => e._id === prev._id) ? prev : null));
  } catch (e) {
    console.log("Error cargando equipos offline:", e);
    setEquipos([]);
    setEquipoSel(null);
  }
}, [isChiefPilotRole]);



const loadEquipos = useCallback(async () => {
  try {
    setLoadingEquipos(true);
    setEquiposError("");

    const data = await apiFetch<any>("/api/equipos");
    const arrRaw = Array.isArray(data) ? data : (data?.data ?? []);
    const arr = isChiefPilotRole ? arrRaw : filtrarEquiposVisiblesParaPiloto(arrRaw);

    setEquipos(arr);
    setMaintenanceConfigMap((current) => {
      const next = { ...current };
      arr.forEach((equipo: EquipoUAS) => {
        if (!next[equipo._id]) {
          next[equipo._id] = {
            intervaloHoras: String(equipo.mantIntervaloHoras ?? 250),
            umbralAviso: String(equipo.mantUmbralAviso ?? 25),
            ultimaMantHoras: String(equipo.mantUltimaHora ?? 0),
          };
        }
      });
      return next;
    });
    setEquipoSel((prev) => (prev && arr.some((e) => e._id === prev._id) ? prev : null));

    // ✅ cache offline
    await SecureStore.setItemAsync(SECURE_EQUIPOS_KEY, JSON.stringify(arr), {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  } catch (e: any) {
    // ✅ fallback offline
    Toast.show({
      type: "info",
      text1: "Modo offline",
      text2: "Mostrando aeronaves guardadas.",
    });

    await loadOfflineEquipos();
  } finally {
    setLoadingEquipos(false);
  }
}, [isChiefPilotRole, loadOfflineEquipos]);

const getMaintenanceMetrics = useCallback((equipo: EquipoUAS) => {
  const config = maintenanceConfigMap[equipo._id];
  const actuales = Number(equipo.horasVuelo || 0);
  const intervalo = Math.max(1, Number(config?.intervaloHoras ?? equipo.mantIntervaloHoras ?? 250));
  const umbral = Math.max(0, Number(config?.umbralAviso ?? equipo.mantUmbralAviso ?? 25));
  const ultima = Math.max(0, Number(config?.ultimaMantHoras ?? equipo.mantUltimaHora ?? 0));
  const proximo = ultima + intervalo;
  const restantes = Math.round((proximo - actuales) * 10) / 10;
  const consumidas = Math.max(0, actuales - ultima);
  const porcentaje = Math.max(0, Math.min(100, (consumidas / intervalo) * 100));
  const estado = restantes <= 0 ? "VENCIDO" : restantes <= umbral ? "PRONTO" : "OK";
  return { actuales, intervalo, umbral, ultima, proximo, restantes, porcentaje, estado };
}, [maintenanceConfigMap]);

const saveMaintenanceConfig = useCallback(async (equipo: EquipoUAS) => {
  const metrics = getMaintenanceMetrics(equipo);
  if (![metrics.intervalo, metrics.umbral, metrics.ultima].every(Number.isFinite)) {
    Toast.show({ type: "error", text1: "Valores inválidos", text2: "Revisa la configuración de mantenimiento." });
    return;
  }
  try {
    setSavingMaintenanceId(equipo._id);
    await apiFetch(`/api/equipos/${equipo._id}/mantenimiento`, {
      method: "PUT",
      body: JSON.stringify({
        mantIntervaloHoras: metrics.intervalo,
        mantUmbralAviso: metrics.umbral,
        mantUltimaHora: metrics.ultima,
      }),
    });
    await loadEquipos();
    Toast.show({ type: "success", text1: "Control de horas actualizado", text2: `${equipo.modelo || "UAS"} recalculado.` });
  } catch (error: any) {
    Toast.show({ type: "error", text1: "No se pudo guardar", text2: error?.message || "Intenta nuevamente." });
  } finally {
    setSavingMaintenanceId("");
  }
}, [getMaintenanceMetrics, loadEquipos]);

const resetEquipoForm = useCallback((equipo?: EquipoUAS | null) => {
  setEditingEquipoId(String(equipo?._id || ""));
  setEquipoForm({
    ruas: String(equipo?.ruas || ""),
    serie: String(equipo?.serie || ""),
    modelo: String(equipo?.modelo || ""),
    horasVuelo: String(equipo?.horasVuelo ?? 0),
    estado: String(equipo?.estado || "Aeronavegable"),
    polizaVigencia: String(equipo?.polizaVigencia || "").slice(0, 10),
    polizaVence: String(equipo?.polizaVence || "").slice(0, 10),
    manualUsuarioLink: String(equipo?.manualUsuarioLink || ""),
    arrendado: !!equipo?.arrendado || String(equipo?.estado || "") === "Arrendado",
    fechaInicioArrendamiento: String(equipo?.fechaInicioArrendamiento || "").slice(0, 10),
    fechaFinArrendamiento: String(equipo?.fechaFinArrendamiento || "").slice(0, 10),
  });
  setEquipoFiles({});
  setShowEquipoForm(true);
}, []);

const pickEquipoFile = useCallback(async (field: "foto" | "polizaPdf" | "ruasPdf") => {
  const picked = await DocumentPicker.getDocumentAsync({
    type: field === "foto" ? "image/*" : "application/pdf",
    multiple: false,
    copyToCacheDirectory: true,
  });
  if (picked.canceled || !picked.assets?.[0]) return;
  const asset = picked.assets[0];
  const maxBytes = field === "foto" ? 5 * 1024 * 1024 : 15 * 1024 * 1024;
  if (Number(asset.size || 0) > maxBytes) {
    Toast.show({
      type: "error",
      text1: "Archivo demasiado grande",
      text2: field === "foto" ? "La foto debe pesar menos de 5 MB." : "El PDF debe pesar menos de 15 MB.",
    });
    return;
  }
  setEquipoFiles((prev) => ({
    ...prev,
    [field]: {
      uri: asset.uri,
      name: asset.name || `${field}.${field === "foto" ? "jpg" : "pdf"}`,
      mimeType: asset.mimeType || (field === "foto" ? "image/jpeg" : "application/pdf"),
    },
  }));
}, []);

const saveEquipo = useCallback(async () => {
  if (!equipoForm.ruas.trim() || !equipoForm.serie.trim() || !equipoForm.modelo.trim()) {
    Toast.show({ type: "error", text1: "Faltan datos", text2: "RUAS, serie y modelo son obligatorios." });
    return;
  }
  const horas = Number(equipoForm.horasVuelo || 0);
  if (!Number.isFinite(horas) || horas < 0) {
    Toast.show({ type: "error", text1: "Horas inválidas", text2: "Ingresa un valor mayor o igual a cero." });
    return;
  }
  try {
    setSavingEquipo(true);
    const tokenValue = await getToken();
    if (!tokenValue) throw new Error("La sesión no está disponible.");
    const form = new FormData();
    const payload = {
      ...equipoForm,
      ruas: equipoForm.ruas.trim(),
      serie: equipoForm.serie.trim(),
      modelo: equipoForm.modelo.trim(),
      horasVuelo: horas,
      arrendado: equipoForm.arrendado,
      estado: equipoForm.arrendado ? "Arrendado" : equipoForm.estado,
    };
    Object.entries(payload).forEach(([key, value]) => form.append(key, String(value ?? "")));
    Object.entries(equipoFiles).forEach(([field, file]) => {
      if (!file) return;
      form.append(field, { uri: file.uri, name: file.name, type: file.mimeType } as any);
    });
    const path = editingEquipoId ? `/api/equipos/${editingEquipoId}` : "/api/equipos";
    const response = await fetch(`${API_URL}${normalizePath(path)}`, {
      method: editingEquipoId ? "PUT" : "POST",
      headers: { Accept: "application/json", Authorization: `Bearer ${tokenValue}` },
      body: form,
    });
    const raw = await response.text();
    let result: any = {};
    try { result = raw ? JSON.parse(raw) : {}; } catch {}
    if (!response.ok) throw new Error(result?.message || `Error HTTP ${response.status}`);
    setShowEquipoForm(false);
    await loadEquipos();
    Toast.show({
      type: "success",
      text1: editingEquipoId ? "UAS actualizado" : "UAS registrado",
      text2: "La información de la aeronave quedó guardada.",
    });
  } catch (error: any) {
    Toast.show({ type: "error", text1: "No se pudo guardar", text2: error?.message || "Intenta nuevamente." });
  } finally {
    setSavingEquipo(false);
  }
}, [editingEquipoId, equipoFiles, equipoForm, loadEquipos]);

const deleteEquipo = useCallback((equipo: EquipoUAS) => {
  Alert.alert(
    "Eliminar aeronave",
    `¿Deseas eliminar ${equipo.modelo || "este UAS"} · ${equipo.serie || "sin serie"}?`,
    [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Eliminar",
        style: "destructive",
        onPress: async () => {
          try {
            await apiFetch(`/api/equipos/${equipo._id}`, { method: "DELETE" });
            setEquipoSel((current) => current?._id === equipo._id ? null : current);
            await loadEquipos();
            Toast.show({ type: "success", text1: "UAS eliminado" });
          } catch (error: any) {
            Toast.show({ type: "error", text1: "No se pudo eliminar", text2: error?.message || "Revisa si tiene registros asociados." });
          }
        },
      },
    ]
  );
}, [loadEquipos]);

const openEquipoDocument = useCallback(async (equipo: EquipoUAS, type: "poliza" | "ruas") => {
  try {
    const response = await apiFetch<{ url?: string }>(`/api/equipos/${equipo._id}/${type}/url`);
    if (!response?.url) throw new Error(`El ${type === "poliza" ? "documento de póliza" : "certificado RUAS"} no está cargado.`);
    await Linking.openURL(response.url);
  } catch (error: any) {
    Toast.show({ type: "error", text1: "Documento no disponible", text2: error?.message || "No se pudo abrir." });
  }
}, []);

const openBatteryFormForEquipo = useCallback((equipo: EquipoUAS) => {
  setBatteryForm({
    equipoId: equipo._id,
    nombre: "",
    marca: "",
    modelo: "",
    serial: "",
    ciclos: "0",
    maxCiclos: "200",
    fechaAdquisicion: "",
    notas: "",
  });
  setShowBatteryForm(true);
}, []);

const saveBattery = useCallback(async () => {
  if (!batteryForm.equipoId || !batteryForm.serial.trim()) {
    Toast.show({ type: "error", text1: "Faltan datos", text2: "El serial de la batería es obligatorio." });
    return;
  }
  try {
    setSavingBattery(true);
    await apiFetch("/api/baterias", {
      method: "POST",
      body: JSON.stringify({
        ...batteryForm,
        nombre: batteryForm.nombre.trim(),
        serial: batteryForm.serial.trim(),
        ciclos: Math.max(0, Number(batteryForm.ciclos || 0)),
        maxCiclos: Math.max(1, Number(batteryForm.maxCiclos || 200)),
      }),
    });
    setShowBatteryForm(false);
    Toast.show({ type: "success", text1: "Batería registrada", text2: "Ya quedó asociada al UAS." });
  } catch (error: any) {
    Toast.show({ type: "error", text1: "No se pudo registrar", text2: error?.message || "Intenta nuevamente." });
  } finally {
    setSavingBattery(false);
  }
}, [batteryForm]);

const openEquipoDatePicker = useCallback((
  field: "polizaVigencia" | "polizaVence" | "fechaInicioArrendamiento" | "fechaFinArrendamiento"
) => {
  const raw = equipoForm[field];
  const current = raw ? new Date(`${raw}T12:00:00`) : new Date();
  DateTimePickerAndroid.open({
    value: Number.isNaN(current.getTime()) ? new Date() : current,
    mode: "date",
    onChange: (event, selectedDate) => {
      if (event.type === "dismissed" || !selectedDate) return;
      setEquipoForm((prev) => ({ ...prev, [field]: formatDateOnly(selectedDate) }));
    },
  });
}, [equipoForm]);

useEffect(() => {
  if (section === "equipos-uas") {
    loadEquipos().catch(() => {});
  }
}, [section, loadEquipos]);

const loadGpsAndWeather = useCallback(async () => {
  const REF_LAT = 4.711;
  const REF_LON = -74.0721;
  // La última posición válida vive en un ref para que actualizar el estado GPS
  // no recree esta función ni dispare nuevamente el efecto meteorológico.
  const fallbackLat = lastGoodGpsRef.current.lat ?? REF_LAT;
  const fallbackLon = lastGoodGpsRef.current.lon ?? REF_LON;

  const fetchWeatherByCoords = async (lat: number, lon: number, reason?: string) => {
    try {
      const places = await withTimeout(
        Location.reverseGeocodeAsync({ latitude: lat, longitude: lon }),
        8000
      );
      const place = Array.isArray(places) ? places[0] : null;
      const pieces = [
        String(place?.district || place?.street || "").trim(),
        String(place?.city || place?.subregion || "").trim(),
      ].filter(Boolean);
      setCurrentPlaceLabel(pieces.length ? pieces.join(", ") : "Ubicación actual");
    } catch {
      setCurrentPlaceLabel("Ubicación actual");
    }

    const toNumberOrNull = (v: any): number | null => {
      if (v === null || v === undefined || v === "") return null;
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    };

    const estimateCloudBaseMeters = (temp: number | null, humidity: number | null): number | null => {
      if (temp == null || humidity == null) return null;
      if (humidity <= 0 || humidity > 100) return null;
      const a = 17.27;
      const b = 237.7;
      const gamma = (a * temp) / (b + temp) + Math.log(humidity / 100);
      const dewPoint = (b * gamma) / (a - gamma);
      const spread = temp - dewPoint;
      if (!Number.isFinite(spread)) return null;
      const baseFeet = Math.max(0, spread * 400);
      const baseMeters = baseFeet * 0.3048;
      return Number.isFinite(baseMeters) ? Math.round(baseMeters) : null;
    };

    const firstFiniteAround = (arr: any[], startIndex: number): number | null => {
      if (!Array.isArray(arr) || !arr.length) return null;
      const direct = toNumberOrNull(arr[startIndex]);
      if (direct != null) return direct;
      for (let offset = 1; offset < arr.length; offset += 1) {
        const left = startIndex - offset;
        const right = startIndex + offset;
        if (left >= 0) {
          const lv = toNumberOrNull(arr[left]);
          if (lv != null) return lv;
        }
        if (right < arr.length) {
          const rv = toNumberOrNull(arr[right]);
          if (rv != null) return rv;
        }
      }
      return null;
    };

    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      "&current=temperature_2m,wind_speed_10m,wind_direction_10m,wind_gusts_10m,weather_code,relative_humidity_2m,surface_pressure,precipitation,rain,cloud_cover,visibility,shortwave_radiation,is_day" +
      "&hourly=precipitation_probability,cloud_base" +
      "&forecast_days=3&timezone=auto";

    const res = await withTimeout(fetch(url), 10000);
    const data = await res.json();
    const current = data?.current || {};
    const tempC = toNumberOrNull(current?.temperature_2m);
    const windKmh = toNumberOrNull(current?.wind_speed_10m);
    const windMs = windKmh != null ? windKmh / 3.6 : null;
    const windDirDeg = toNumberOrNull(current?.wind_direction_10m);
    const windGustKmh = toNumberOrNull(current?.wind_gusts_10m);
    const windGustMs = windGustKmh != null ? windGustKmh / 3.6 : null;
    const weatherCode = toNumberOrNull(current?.weather_code);
    const humidityPct = toNumberOrNull(current?.relative_humidity_2m);
    const pressureHpa = toNumberOrNull(current?.surface_pressure);
    const rainMm = toNumberOrNull(current?.rain);
    const visibilityM = toNumberOrNull(current?.visibility);
    const cloudCoverPct = toNumberOrNull(current?.cloud_cover);
    const radiationWm2 = toNumberOrNull(current?.shortwave_radiation);
    const isDay = Number(current?.is_day) === 1;
    const currentSkyLabel = deriveCurrentSkyLabel({
      weatherCode,
      cloudCoverPct,
      radiationWm2,
      rainMm,
      isDay,
    });

    const hourlyTimes: string[] = Array.isArray(data?.hourly?.time) ? data.hourly.time : [];
    const currentTime = typeof current?.time === "string" ? current.time : "";
    let hourlyIndex = 0;
    if (currentTime && hourlyTimes.length) {
      const exact = hourlyTimes.indexOf(currentTime);
      if (exact >= 0) {
        hourlyIndex = exact;
      } else {
        const targetMs = Date.parse(currentTime);
        if (Number.isFinite(targetMs)) {
          let bestIdx = 0;
          let bestDiff = Number.POSITIVE_INFINITY;
          for (let i = 0; i < hourlyTimes.length; i++) {
            const ms = Date.parse(hourlyTimes[i]);
            if (!Number.isFinite(ms)) continue;
            const diff = Math.abs(ms - targetMs);
            if (diff < bestDiff) {
              bestDiff = diff;
              bestIdx = i;
            }
          }
          hourlyIndex = bestIdx;
        }
      }
    }

    const precipProbPct = firstFiniteAround(data?.hourly?.precipitation_probability || [], hourlyIndex);
    const cloudBaseM =
      firstFiniteAround(data?.hourly?.cloud_base || [], hourlyIndex) ??
      estimateCloudBaseMeters(tempC, humidityPct);

    // Kp geomagnético (NOAA). Si falla, se deja en null.
    let kpIndex: number | null = null;
    try {
      const kpSources = [
        "https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json",
        "https://services.swpc.noaa.gov/json/planetary_k_index_1m.json",
      ];
      for (const kpUrl of kpSources) {
        try {
          const kpRes = await withTimeout(fetch(kpUrl), 7000);
          const kpJson = await kpRes.json();
          if (Array.isArray(kpJson) && kpJson.length > 1 && Array.isArray(kpJson[0])) {
            for (let i = kpJson.length - 1; i >= 1; i -= 1) {
              const row = kpJson[i];
              const parsed = toNumberOrNull(Array.isArray(row) ? row[1] : null);
              if (parsed != null) {
                kpIndex = parsed;
                break;
              }
            }
          } else if (Array.isArray(kpJson) && kpJson.length > 0) {
            for (let i = kpJson.length - 1; i >= 0; i -= 1) {
              const row = kpJson[i];
              const parsed = toNumberOrNull(
                row?.kp_index ?? row?.kp ?? row?.planetary_k_index ?? row?.Kp ?? null
              );
              if (parsed != null) {
                kpIndex = parsed;
                break;
              }
            }
          }
          if (kpIndex != null) break;
        } catch {}
      }

      if (kpIndex == null) {
        const ovationRes = await withTimeout(
          fetch("https://services.swpc.noaa.gov/json/ovation_aurora_latest.json"),
          7000
        );
        const ovationJson = await ovationRes.json();
        kpIndex = toNumberOrNull(
          ovationJson?.Kp ?? ovationJson?.kp ?? ovationJson?.kp_index ?? null
        );
      }
    } catch {}

    if (kpIndex == null) {
      const cloudPenalty = cloudCoverPct != null ? Math.min(1.4, cloudCoverPct / 100) : 0.4;
      const rainPenalty = rainMm != null ? Math.min(1.2, rainMm / 10) : 0;
      kpIndex = Number((2 + cloudPenalty + rainPenalty).toFixed(1));
    }

    // Estimación de satélites visibles/bloqueados basada en cobertura, visibilidad y lluvia.
    const cloud = cloudCoverPct ?? 50;
    const vis = visibilityM ?? 8000;
    const rain = rainMm ?? 0;
    const cloudFactor = Math.max(0.15, (100 - cloud) / 100);
    const visFactor = Math.max(0.25, Math.min(1, vis / 12000));
    const rainPenalty = Math.min(0.45, rain / 20);
    const satVisibleRaw = (10 + 22 * cloudFactor * visFactor) * (1 - rainPenalty);
    const satVisibleEst = Math.max(6, Math.min(32, Math.round(satVisibleRaw)));
    const satBlockedEstPct = Math.max(0, Math.min(100, Number((100 - (satVisibleEst / 32) * 100).toFixed(1))));
    const forecastRows: WeatherHourItem[] = hourlyTimes
      .map((isoTime, idx) => {
        const cloudBaseSlot =
          firstFiniteAround(data?.hourly?.cloud_base || [], idx) ??
          cloudBaseM;
        const precipSlot = firstFiniteAround(data?.hourly?.precipitation_probability || [], idx);
        const satPenalty = Math.min(10, Math.round((Number(precipSlot || 0) / 100) * 6));
        const satSlot = Math.max(
          5,
          Math.min(
            32,
            Math.round(
              (satVisibleEst || 10) -
                satPenalty +
                (Number.isFinite(Number(cloudBaseSlot)) && Number(cloudBaseSlot) > 350 ? 2 : 0)
            )
          )
        );
        const slotFlightState: WeatherFlightState =
          precipSlot != null && precipSlot >= 70
            ? "NO_RECOMENDADAS"
            : precipSlot != null && precipSlot >= 40
            ? "MARGINALES"
            : cloudBaseSlot != null && cloudBaseSlot < 120
            ? "NO_RECOMENDADAS"
            : cloudBaseSlot != null && cloudBaseSlot < 200
            ? "MARGINALES"
            : satSlot < 9
            ? "MARGINALES"
            : "APTAS";
        const date = new Date(isoTime);
        const dayKey = Number.isNaN(date.getTime()) ? `day-${idx}` : date.toISOString().slice(0, 10);
        return {
          key: `${isoTime || "slot"}-${idx}`,
          isoTime,
          dayKey,
          timeLabel: formatForecastHourLabel(isoTime, idx === hourlyIndex ? 0 : 1),
          satVisibleEst: satSlot,
          cloudBaseM: cloudBaseSlot,
          precipProbPct: precipSlot,
          flightState: slotFlightState,
        };
      })
      .filter((item) => !!item.isoTime);

    const evalResult = evaluateWeatherForFlight({
      windMs,
      gustMs: windGustMs,
      precipProbPct,
      rainMm,
      visibilityM,
      cloudCoverPct,
      tempC,
      weatherCode,
    });

    setWeatherNow({
      ok: true,
      label: currentSkyLabel,
      tempC,
      windMs,
    });
    setWeatherDetail({
      ok: true,
      label: currentSkyLabel,
      tempC,
      windMs,
      windDirDeg,
      windDirLabel: windDirectionToCardinal(windDirDeg),
      windGustMs,
      precipProbPct,
      rainMm,
      visibilityM,
      cloudCoverPct,
      cloudBaseM,
      humidityPct,
      pressureHpa,
      radiationWm2,
      kpIndex,
      satVisibleEst,
      satBlockedEstPct,
      flightState: evalResult.state,
      reasons: reason ? [reason, ...evalResult.reasons] : evalResult.reasons,
      updatedAt: currentTime || new Date().toISOString(),
    });
    setWeatherForecast(forecastRows);
  };

  try {
    let lat = fallbackLat;
    let lon = fallbackLon;
    let hasGpsFix = false;
    let gpsReason =
      lastGoodGpsRef.current.lat != null && lastGoodGpsRef.current.lon != null
        ? "Usando última ubicación conocida"
        : "Usando ubicación de referencia";
    let pos: Location.LocationObject | null = null;

    const servicesEnabled = await Location.hasServicesEnabledAsync();
    if (!servicesEnabled) {
      setGpsCell({ enabled: false, label: "GPS desactivado (referencia)", lat, lon });
      gpsReason = "GPS desactivado, usando referencia";
    } else {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== "granted") {
        setGpsCell({ enabled: false, label: "Permiso denegado (referencia)", lat, lon });
        gpsReason = "Sin permisos de ubicación, usando referencia";
      } else {
        if (Platform.OS === "android") {
          try {
            await Location.enableNetworkProviderAsync();
          } catch {}
        }
        pos = await withTimeout(
          Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
          12000
        );
        const pLat = Number(pos?.coords?.latitude);
        const pLon = Number(pos?.coords?.longitude);
        const invalidZero = Math.abs(pLat) < 0.000001 && Math.abs(pLon) < 0.000001;
        if (Number.isFinite(pLat) && Number.isFinite(pLon) && !invalidZero) {
          lat = pLat;
          lon = pLon;
          hasGpsFix = true;
          gpsReason = "";
          lastGoodGpsRef.current = { lat, lon };
          setGpsCell({ enabled: true, label: "Activado", lat, lon });
        } else {
          setGpsCell({ enabled: false, label: "Sin fijación (referencia)", lat, lon });
          gpsReason = "Sin fijación GPS válida, usando referencia";
        }
      }
    }

    if (hasGpsFix && pos) {
      const nowMs = Date.now();
      const last = lastLocationPushRef.current;
      const shouldPush =
        nowMs - last.ts > 60000 ||
        last.lat == null ||
        last.lng == null ||
        Math.abs((last.lat || 0) - lat) > 0.00005 ||
        Math.abs((last.lng || 0) - lon) > 0.00005;

      if (shouldPush && isOnlineRef.current) {
        try {
          await apiFetch("/usuarios/me/location", {
            method: "POST",
            body: JSON.stringify({
              lat,
              lng: lon,
              accuracy: Number(pos?.coords?.accuracy),
              speed: Number(pos?.coords?.speed),
              heading: Number(pos?.coords?.heading),
              deviceTime: new Date(pos?.timestamp || Date.now()).toISOString(),
              source: "mobile",
            }),
          });
          lastLocationPushRef.current = { ts: nowMs, lat, lng: lon };
        } catch {}
      }
    }

    await fetchWeatherByCoords(lat, lon, gpsReason || undefined);
  } catch {
    try {
      setGpsCell({ enabled: false, label: "Sin activar (referencia)", lat: fallbackLat, lon: fallbackLon });
      await fetchWeatherByCoords(
        fallbackLat,
        fallbackLon,
        lastGoodGpsRef.current.lat != null ? "Mostrando última ubicación conocida" : "No fue posible obtener GPS, usando referencia"
      );
    } catch {
      setWeatherNow({ ok: false, label: "Sin dato", tempC: null, windMs: null });
      setWeatherDetail({
        ok: false,
        label: "Sin dato",
        tempC: null,
        windMs: null,
        windDirDeg: null,
        windDirLabel: "—",
        windGustMs: null,
        precipProbPct: null,
        rainMm: null,
        visibilityM: null,
        cloudCoverPct: null,
        cloudBaseM: null,
        humidityPct: null,
        pressureHpa: null,
        radiationWm2: null,
        kpIndex: null,
        satVisibleEst: null,
        satBlockedEstPct: null,
        flightState: "MARGINALES",
        reasons: ["No fue posible actualizar clima"],
        updatedAt: null,
      });
      setWeatherForecast([]);
    }
  }
}, []);

  const loadAll = useCallback(async () => {
  await Promise.all([
    loadDashboard(),
    loadMisiones(),   // si tu loadDashboard ya trae misiones, este puede sobrar
    loadVuelos(),
    loadReportes(),
    loadEquipos(),
    loadGpsAndWeather(),
  ]);
}, [loadDashboard, loadMisiones, loadVuelos, loadReportes, loadEquipos, loadGpsAndWeather]);

useEffect(() => {
  loadAll();
}, [loadAll]);

  useEffect(() => {
    if (section === "my-reports") loadReportes();
   if (section === "flight-log") {
    loadVuelos();
    loadEquipos();   
    loadBitacoraSolicitudes();
  }
    if (section === "missions") loadMisiones();
    if (section === "weather") loadGpsAndWeather();
  }, [section, loadReportes, loadVuelos, loadMisiones, loadEquipos, loadGpsAndWeather, loadBitacoraSolicitudes]);

  useFocusEffect(
    useCallback(() => {
      if (section === "missions") loadMisiones();
    }, [loadMisiones, section])
  );

  useEffect(() => {
    if (section !== "weather" && section !== "dashboard") return;
    loadGpsAndWeather();
    const timer = setInterval(() => {
      loadGpsAndWeather();
    }, 180000);
    return () => clearInterval(timer);
  }, [section, loadGpsAndWeather]);

  useEffect(() => {
    let mounted = true;

    const stopWatch = () => {
      try {
        magnetometerSubRef.current?.remove?.();
      } catch {
        // noop
      }
      magnetometerSubRef.current = null;
      try {
        compassSubRef.current?.remove?.();
      } catch {
        // noop
      }
      compassSubRef.current = null;
      if (compassPollRef.current) {
        clearInterval(compassPollRef.current);
        compassPollRef.current = null;
      }
      compassHeadingRef.current = null;
    };

    const applyHeading = (rawValue: any) => {
      const raw = Number(rawValue);
      if (!Number.isFinite(raw)) return;
      const target = ((raw % 360) + 360) % 360;
      if (!mounted) return;
      const prev = compassHeadingRef.current;
      let normalized = target;
      if (prev != null && Number.isFinite(prev)) {
        // Suavizado rápido por el camino corto (mínimo lag perceptible).
        const delta = ((((target - prev) % 360) + 540) % 360) - 180;
        if (Math.abs(delta) < 0.7) return;
        normalized = (prev + delta * 0.82 + 360) % 360;
      }
      compassHeadingRef.current = normalized;
      setCompass({
        supported: true,
        headingDeg: normalized,
        headingLabel: headingToCardinal16(normalized),
      });
    };

    const startWatch = async () => {
      if (section !== "weather") {
        stopWatch();
        return;
      }

      // Brújula real: gira en sitio al rotar el teléfono
      try {
        const isAvailable = await Magnetometer.isAvailableAsync();
        if (isAvailable) {
          Magnetometer.setUpdateInterval(20);
          stopWatch();
          magnetometerSubRef.current = Magnetometer.addListener((data) => {
            const x = Number((data as any)?.x);
            const y = Number((data as any)?.y);
            if (!Number.isFinite(x) || !Number.isFinite(y)) return;
            const angle = Math.atan2(y, x);
            const heading = ((angle * 180) / Math.PI + 90 + 360) % 360;
            applyHeading(heading);
          });
          return;
        }
      } catch {
        // fallback location heading
      }

      try {
        const perm = await Location.requestForegroundPermissionsAsync();
        if (perm.status !== "granted") {
          if (mounted) {
            setCompass({ supported: false, headingDeg: null, headingLabel: "Sin permiso" });
          }
          return;
        }

        // No bloquear por este check: en algunos equipos el heading llega igual con ubicación activa.
        try {
          const enabled = await Location.hasServicesEnabledAsync();
          if (!enabled && mounted) {
            setCompass({ supported: false, headingDeg: null, headingLabel: "GPS desactivado" });
          }
        } catch {
          // noop
        }

        stopWatch();
        compassSubRef.current = await Location.watchHeadingAsync((h) => {
          const raw =
            Number.isFinite(Number(h?.trueHeading)) && Number(h?.trueHeading) >= 0
              ? Number(h?.trueHeading)
              : Number(h?.magHeading);
          applyHeading(raw);
        });

        if (mounted) {
          setCompass((prev) => ({ ...prev, supported: true, headingLabel: "Usando rumbo GPS" }));
        }
      } catch {
        if (mounted) {
          setCompass({ supported: true, headingDeg: null, headingLabel: "Usando rumbo GPS" });
        }
      }
    };

    startWatch();
    return () => {
      mounted = false;
      stopWatch();
    };
  }, [section]);

  useEffect(() => {
    let mounted = true;

    const stopGpsWatch = () => {
      try {
        gpsWatchRef.current?.remove?.();
      } catch {
        // noop
      }
      gpsWatchRef.current = null;
    };

    const startGpsWatch = async () => {
      if (section !== "weather") {
        stopGpsWatch();
        return;
      }
      try {
        const perm = await Location.requestForegroundPermissionsAsync();
        if (perm.status !== "granted") return;

        stopGpsWatch();
        gpsWatchRef.current = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            timeInterval: 1000,
            distanceInterval: 1,
          },
          (pos) => {
            if (!mounted) return;
            const lat = Number(pos?.coords?.latitude);
            const lon = Number(pos?.coords?.longitude);
            if (Number.isFinite(lat) && Number.isFinite(lon)) {
              lastGoodGpsRef.current = { lat, lon };
              setGpsCell((prev) => ({ ...prev, enabled: true, label: "Activado", lat, lon }));
            }

            const course = Number(pos?.coords?.heading);
            if (!magnetometerSubRef.current && Number.isFinite(course) && course >= 0) {
              const normalized = ((course % 360) + 360) % 360;
              setCompass({
                supported: true,
                headingDeg: normalized,
                headingLabel: headingToCardinal16(normalized),
              });
            }
          }
        );
      } catch {
        // noop
      }
    };

    startGpsWatch();
    return () => {
      mounted = false;
      stopGpsWatch();
    };
  }, [section]);

  const startDjiTelemetry = useCallback(async (manual = false) => {
    if (Platform.OS !== "android") return false;
    if (manual && djiActionBusy) return false;

    if (!DJITelemetry.isAvailable) {
      setDjiStatus({
        status: "modulo_no_cargado",
        message: "El modulo nativo DJI no esta disponible en este APK.",
      });
      return false;
    }

    if (manual) {
      setDjiActionBusy(true);
      setTelemetry(null);
      setDjiStatus({
        status: "reintentando_sdk",
        message: "Buscando nuevamente el control DJI y la aeronave.",
      });
    } else {
      setDjiStatus({
        status: "iniciando_sdk",
        message: "Buscando SDK DJI y conexion con el control.",
      });
    }

    try {
      await DJITelemetry.stop();
    } catch {
      // noop
    }

    try {
      if (manual) {
        await new Promise((resolve) => setTimeout(resolve, 450));
      }
      await DJITelemetry.start();
      return true;
    } catch (error: any) {
      setDjiStatus({
        status: "inicio_fallido",
        message: String(error?.message || error),
      });
      return false;
    } finally {
      if (manual) {
        setTimeout(() => setDjiActionBusy(false), 900);
      }
    }
  }, [djiActionBusy]);

  useEffect(() => {
    if (Platform.OS !== "android") return;

    console.log("DjiTelemetry module available:", DJITelemetry.isAvailable);

    // Si el módulo no está cargado, lo verás aquí
    if (!DJITelemetry.isAvailable) {
      setDjiStatus({
        status: "modulo_no_cargado",
        message: "El modulo nativo DJI no esta disponible en este APK.",
      });
      return;
    }

    const telemetrySub = DJITelemetry.onTelemetry((data) => {
      console.log("DJI telemetry event:", data);
      setTelemetry(data);
    });
    const statusSub = DJITelemetry.onStatus((data) => {
      console.log("DJI status event:", data);
      setDjiStatus(data);
    });

    startDjiTelemetry(false);

    return () => {
      telemetrySub.remove();
      statusSub.remove();
      DJITelemetry.stop().catch(() => undefined);
    };
  }, [startDjiTelemetry]);


  const onRefresh = useCallback(async () => {
    try {
      setRefreshing(true);
      await Promise.all([loadDashboard(), loadReportes(), loadVuelos(), loadMisiones(), loadGpsAndWeather()]);
    } finally {
      setRefreshing(false);
    }
  }, [loadDashboard, loadReportes, loadVuelos, loadMisiones, loadGpsAndWeather]);

  type Step = {
    id: string;
    title: string;
    text: string;
    onYes: () => void;
    onNo: () => void;
  };

  const checklistSteps: Step[] = useMemo(
    () => [
      {
        id: "1",
        title: "Paso 1",
        text:
          "Inspección del área de despegue y aterrizaje. Confirma que está libre de obstáculos en el suelo y en el aire.",
        onYes: () => setChecklist((p) => ({ ...p, v1a: true, v1b: true })),
        onNo: () => setChecklist((p) => ({ ...p, v1a: false, v1b: false })),
      },
      {
        id: "2",
        title: "Paso 2",
        text: "Posicionamiento del helipad de despegue. ¿Está ubicado en una zona segura?",
        onYes: () => setChecklist((p) => ({ ...p, v2: true })),
        onNo: () => setChecklist((p) => ({ ...p, v2: false })),
      },
      {
        id: "3",
        title: "Paso 3",
        text: "Medidas de alejamiento al personal ajeno. ¿Informaste y estableciste perímetro?",
        onYes: () => setChecklist((p) => ({ ...p, v3a: true, v3b: true })),
        onNo: () => setChecklist((p) => ({ ...p, v3a: false, v3b: false })),
      },
      {
        id: "4",
        title: "Paso 4",
        text:
          "Identificación de riesgos. ¿Evaluaste y mitigaste riesgos como niños, animales o elementos sueltos?",
        onYes: () => setChecklist((p) => ({ ...p, v4a: true, v4b: true })),
        onNo: () => setChecklist((p) => ({ ...p, v4a: false, v4b: false })),
      },
      {
        id: "5",
        title: "Paso 5",
        text: "Comunicación constante. ¿Hay comunicación entre piloto UAS y observador?",
        onYes: () => setChecklist((p) => ({ ...p, v5: true })),
        onNo: () => setChecklist((p) => ({ ...p, v5: false })),
      },
    ],
    []
  );

  
type Mode = "IDLE" | "SPEAKING" | "LISTENING" | "CONFIRM_SAVE";

const normalizeYN = (t: string) => {
  const s = t.toLowerCase().trim();
  if (/(^| )si($| )|sí|affirmative|yes|claro|ok|dale/.test(s)) return "yes";
  if (/(^| )no($| )|negative|nope/.test(s)) return "no";
  return null;
};


  const [assistantOn, setAssistantOn] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [speaking, setSpeaking] = useState(false);


// DENTRO del componente PilotPanel
const isOnlineRef = React.useRef(true);

useEffect(() => {
  const unsub = NetInfo.addEventListener((s) => {
    isOnlineRef.current = !!s.isConnected && !!s.isInternetReachable;
  });
  return () => unsub();
}, []);


 type VoiceFlow = "none" | "checklist" | "autoeval" | "battery";
  type VoiceStage =
    | "idle"
    | "asking" // preguntando sí/no
    | "autoeval_lesion_detail"; // captura texto libre


const [voiceFlow, setVoiceFlow] = useState<VoiceFlow>("none");
const [voiceStage, setVoiceStage] = useState<VoiceStage>("idle");

// índices por flujo
const [checkStep, setCheckStep] = useState(0);
const [autoevalStep, setAutoevalStep] = useState(0);
const [batteryStep, setBatteryStep] = useState(0);

// solo para mostrar en UI
const [voicePrompt, setVoicePrompt] = useState("");
const [voiceBusy, setVoiceBusy] = useState(false);

const speakText = useCallback((msg: string, after?: () => void) => {
  Speech.stop();
  setVoiceBusy(true);
  setVoicePrompt(msg);

    Speech.speak(msg, {
          language: isOnline ? "es-CO" : "es-ES",

      rate: 1.55, // más ágil para listas de chequeo
    onDone: () => {
      setVoiceBusy(false);
      // ✅ Android: deja liberar el audio focus antes de escuchar
      setTimeout(() => after?.(), 450);
    },
    onStopped: () => setVoiceBusy(false),
    onError: () => setVoiceBusy(false),
  });
}, []);

// ========= STT start/stop =========
const startListeningAuto = useCallback(async () => {
  try {
    const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!perm.granted) {
      Toast.show({ type: "error", text1: "Permiso", text2: "Habilita el micrófono." });
      return;
    }

    setHeard("");
    setListening(true);
    processingAnswerRef.current = false;

    ExpoSpeechRecognitionModule.start({
      lang: sttLangRef.current,   // ✅ usa el ref
      interimResults: true,
      maxAlternatives: 1,
      continuous: true,
      androidIntentOptions: { EXTRA_LANGUAGE_MODEL: "free_form" },
    });
  } catch (e: any) {
    setListening(false);
    Toast.show({ type: "error", text1: "Voz", text2: e?.message || "No se pudo iniciar STT" });
  }
}, []);


const shouldAutoListen = () =>
  voiceFlow !== "none" &&
  voiceStage !== "idle" &&
  !voiceBusy; // no reiniciar mientras TTS habla

useSpeechRecognitionEvent("end", () => {
  setListening(false);
  if (shouldAutoListen()) {
    setTimeout(() => startListeningAuto(), 350);
  }
});

useSpeechRecognitionEvent("error", (e: any) => {
  setListening(false);
  // opcional: log para ver por qué cae
  console.log("ðŸŽ¤ STT error:", e);

  if (shouldAutoListen()) {
    // mini-backoff
    setTimeout(() => startListeningAuto(), 600);
  }
});


const stopListeningAuto = useCallback(() => {
  try {
    setListening(false);
    ExpoSpeechRecognitionModule.stop();
  } catch {}
}, []);

const startQuickDictation = useCallback(async (target: "report" | "evidence") => {
  try {
    const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!perm.granted) {
      Toast.show({ type: "error", text1: "Permiso", text2: "Habilita el micrófono." });
      return;
    }
    try { ExpoSpeechRecognitionModule.stop(); } catch {}
    try { Speech.stop(); } catch {}
    setVoiceFlow("none");
    setVoiceStage("idle");
    setQuickVoiceTarget(target);
    setVoicePrompt(target === "report" ? "Dictando descripción del reporte..." : "Dictando nota de evidencia...");
    setListening(true);
    setHeard("");
    ExpoSpeechRecognitionModule.start({
      lang: sttLangRef.current,
      interimResults: false,
      maxAlternatives: 1,
      continuous: false,
      androidIntentOptions: { EXTRA_LANGUAGE_MODEL: "free_form" },
    });
  } catch (e: any) {
    setListening(false);
    setQuickVoiceTarget(null);
    Toast.show({ type: "error", text1: "Voz", text2: e?.message || "No se pudo iniciar el dictado." });
  }
}, []);

// ========= Preguntas =========

const checklistVoiceQuestion =
  "Lista de chequeo preoperacional. ¿Confirma que el área, helipad, perímetro, riesgos y comunicación operativa fueron verificados y están en condiciones seguras? Responda sí o no.";

const autoevalVoiceQuestion =
  "Autoevaluación operacional. ¿Confirma que se encuentra apto para operar, sin condiciones médicas, medicamentos, alcohol, sustancias o lesiones que afecten la operación? Responda sí o no.";

const batteryVoiceQuestion =
  "Lista de chequeo de baterías y variables críticas. ¿Confirma que verificó GPS, batería, meteorología, control, navegación, hélices, tren de aterrizaje y demás puntos aplicables? Responda sí o no.";

// AUTOEVAL: orden fijo por voz (sí/no)
const autoevalQuestions = useMemo(
  () => [
    { key: "alcohol", label: "¿Ha consumido alcohol o intoxicantes en las últimas 12 horas?" },
    { key: "psico", label: "¿Ha consumido sustancias psicoactivas?" },
    { key: "meds", label: "¿Está bajo efecto de pastillas para dormir o antidepresivos?" },
    { key: "jefe", label: "¿Ha informado al jefe de pilotos sobre tratamientos médicos relevantes?" },
    { key: "lesiones", label: "¿Sufre de lesiones que afectan su capacidad operativa?" },
  ],
  []
);

// BATERÍAS: c1..c4 + p1..p2 (agrega p3..p7 si los tienes)
const batteryQuestions = useMemo(
  () => [
    { k: "c1", label: "Chequeo 1. Señal de GPS. ¿Verificado?" },
    { k: "c2", label: "Chequeo 2. Nivel de batería. ¿Verificado?" },
    { k: "c3", label: "Chequeo 3. Viento y meteorología. ¿Verificado?" },
    { k: "c4", label: "Chequeo 4. Control y navegación. ¿Verificado?" },

    { k: "p1", label: "Postvuelo 1. Revisión de hélices. ¿Verificado?" },
    { k: "p2", label: "Postvuelo 2. Tren de aterrizaje. ¿Verificado?" },
  ],
  []
);

const applyChecklistVoiceAnswer = useCallback((ok: boolean) => {
  setChecklist((p) => ({
    ...p,
    v1a: ok,
    v1b: ok,
    v2: ok,
    v3a: ok,
    v3b: ok,
    v4a: ok,
    v4b: ok,
    v5: ok,
    apto: ok ? "si" : "no",
  }));
}, []);

const applyAutoevalVoiceAnswer = useCallback((ok: boolean) => {
  setAutoeval((p) => ({
    ...p,
    alcohol: ok ? "No" : "",
    psico: ok ? "No" : "",
    meds: ok ? "No" : "",
    jefe: ok ? "Sí" : "",
    lesiones: ok ? "No" : "",
    lesionesDetalle: ok ? "" : "Respuesta general negativa por voz.",
    acepto: true,
  }));
}, []);

const applyBatteryVoiceAnswer = useCallback((ok: boolean) => {
  setBatteryChecks({
    c1: ok,
    c2: ok,
    c3: ok,
    c4: ok,
    p1: ok,
    p2: ok,
    p3: ok,
    p4: ok,
    p5: ok,
    p6: ok,
    p7: ok,
  });
}, []);

// ========= Start flows (se llaman al abrir modales) =========

const startChecklistVoice = useCallback(() => {
  setVoiceFlow("checklist");
  setVoiceStage("asking");
  setCheckStep(0);

  // reset checklist como ya lo haces
  setChecklist((p) => ({
    ...p,
    v1a: false, v1b: false, v2: false, v3a: false, v3b: false, v4a: false, v4b: false, v5: false,
    obs1: "", obs2: "", obs3: "", obs4: "", obs5: "", obsGeneral: "", apto: "",
  }));

  speakText(checklistVoiceQuestion, startListeningAuto);
}, [checklistVoiceQuestion, speakText, startListeningAuto]);

const startAutoevalVoice = useCallback(() => {
  setVoiceFlow("autoeval");
  setVoiceStage("asking");
  setAutoevalStep(0);

  setAutoeval({
    alcohol: "", psico: "", meds: "", jefe: "", lesiones: "",
    lesionesDetalle: "",
    acepto: false,
  });

  speakText(autoevalVoiceQuestion, startListeningAuto);
}, [autoevalVoiceQuestion, speakText, startListeningAuto]);

const startBatteryVoice = useCallback(() => {
  setVoiceFlow("battery");
  setVoiceStage("asking");
  setBatteryStep(0);

  setBatteryChecks({
    c1: false, c2: false, c3: false, c4: false,
    p1: false, p2: false, p3: false, p4: false, p5: false, p6: false, p7: false,
  });

  speakText(batteryVoiceQuestion, startListeningAuto);
}, [batteryVoiceQuestion, speakText, startListeningAuto]);

// ========= Confirm save =========
  const askSave = useCallback(() => {
    // Guardado automático al finalizar, sin pregunta de confirmación
    setVoiceStage("idle");
    stopListeningAuto();
    speakText("Procedimiento finalizado. Guardando en la base de datos.", async () => {
      try {
        if (voiceFlow === "checklist") await savePreflightChecklist();
        if (voiceFlow === "autoeval") await saveAutoevaluacion();
        if (voiceFlow === "battery") await saveBatteryChecklist();
      } catch (e: any) {
        Toast.show({
          type: "error",
          text1: "Error",
          text2: e?.message || "No se pudo guardar",
        });
      }
    });
  }, [
    voiceFlow,
    speakText,
    stopListeningAuto,
    savePreflightChecklist,
    saveAutoevaluacion,
    saveBatteryChecklist,
  ]);

// ========= Router Sí/No =========
const handleYesNo = useCallback(async (yn: "yes" | "no") => {
  // Evita doble disparo si llega interim + final
  stopListeningAuto();

    // 1) Checklist
  if (voiceFlow === "checklist" && voiceStage === "asking") {
    applyChecklistVoiceAnswer(yn === "yes");
    setTimeout(() => askSave(), 120);
    return;
  }

  // 3) Autoevaluación
  if (voiceFlow === "autoeval" && voiceStage === "asking") {
    applyAutoevalVoiceAnswer(yn === "yes");
    setTimeout(() => askSave(), 120);
    return;
  }

  // 4) Battery
  if (voiceFlow === "battery" && voiceStage === "asking") {
    applyBatteryVoiceAnswer(yn === "yes");
    setTimeout(() => askSave(), 120);
    return;
  }
  }, [
    voiceFlow, voiceStage,
    checkStep, autoevalStep, batteryStep,
    checklistSteps, autoevalQuestions, batteryQuestions,
    applyChecklistVoiceAnswer, applyAutoevalVoiceAnswer, applyBatteryVoiceAnswer,
    askSave,
    speakText, startListeningAuto, stopListeningAuto,
  ]);

// ========= Captura texto libre (lesión) + routing STT =========
useSpeechRecognitionEvent("result", (event: any) => {
  const text =
    event?.results?.[0]?.transcript ||
    event?.transcript ||
    event?.value ||
    "";

  if (!text) return;
  setHeard(text);

  if (quickVoiceTarget) {
    if (quickVoiceTarget === "report") {
      setRepDescripcion((prev) => (prev ? `${prev.trim()} ${text}`.trim() : text));
    } else if (quickVoiceTarget === "evidence") {
      setEvidenceNote((prev) => (prev ? `${prev.trim()} ${text}`.trim() : text));
    }
    setQuickVoiceTarget(null);
    stopListeningAuto();
    Toast.show({
      type: "success",
      text1: "Nota por voz",
      text2: quickVoiceTarget === "report" ? "Descripción agregada al reporte." : "Nota agregada a la evidencia.",
    });
    return;
  }

  // 🔒 si ya procesamos esta frase → ignorar
  if (processingAnswerRef.current) return;

  // ===============================
  // DETALLE DE LESIÓN
  // ===============================
  if (voiceFlow === "autoeval" && voiceStage === "autoeval_lesion_detail") {
    processingAnswerRef.current = true;

    stopListeningAuto();
    setAutoeval((p) => ({ ...p, lesionesDetalle: text, acepto: true }));
    setVoiceStage("asking");

    const next = autoevalStep + 1;
    if (next >= autoevalQuestions.length) {
      askSave();
      return;
    }

    setAutoevalStep(next);
    const nx = autoevalQuestions[next];
    speakText(`${nx.label} Responda sí o no.`, startListeningAuto);
    return;
  }

  // ============
  // SÍ / NO
  // ============
  const yn = detectYesNo(text);
  if (!yn) return;

  processingAnswerRef.current = true;
  handleYesNo(yn);
});


useSpeechRecognitionEvent("error", () => {
  setListening(false);
});

useSpeechRecognitionEvent("end", () => {
  setListening(false);
});


// ========= Auto start cuando abres modal =========





useEffect(() => {
  if (showChecklistModal) startChecklistVoice();
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [showChecklistModal]);

useEffect(() => {
  if (showAutoevalModal) startAutoevalVoice();
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [showAutoevalModal]);

useEffect(() => {
  if (showBatteryModal) startBatteryVoice();
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [showBatteryModal]);

// ========= Al cerrar: corta todo =========
const stopAllVoice = useCallback(() => {
  stopListeningAuto();
  Speech.stop();
  setVoiceFlow("none");
  setVoiceStage("idle");
  setVoicePrompt("");
  setVoiceBusy(false);
  setListening(false);
  setHeard("");
}, [stopListeningAuto]);

const resetReporteForm = () => {
  setRepTipoCode("");
  setRepTipoLabel("");
  setRepFechaHora("");
  setRepUbicacion("");
  setRepNumeroVuelo("");
  setRepDescripcion("");
  setRepGravedad("");
  setRepTipoSituacion("");
  setRepEsAnonimo(false);
  setRepMisionId("");
  setMorCiudad("");
  setMorHoraLocal("");
  setMorNarrativa("");
  setMorSeveridad("Moderado");
  setMorRiesgo("Tolerable");
  setMorReportaNombre("");
  setMorReportaCorreo("");
  setMorExtra({
    fechaActualizacion: "",
    proveedorNit: "",
    proveedorNombre: "",
    tipoProveedor: "Operador UAS",
    tipoProveedorOtro: "",
    modalidadOperacion: "Comercial",
    modalidadOperacionOtro: "",
    aeronave1Identificacion: "",
    aeronave1Marca: "",
    aeronave1Modelo: "",
    aeronave1Mtow: "",
    aeronave1Tipo: "Multirrotor",
    aeronave2Identificacion: "",
    aeronave2Marca: "",
    aeronave2Modelo: "",
    zonaOperacion: "Zona urbana",
    condicionMeteorologica: "VFR",
    latitud: "",
    longitud: "",
    altitudAprox: "",
    oaci: "",
    aerodromoNombre: "",
    tipoContactoVisual: "VLOS",
    faseOperacion: "Misión / Operación",
    pilotoNombre: "",
    pilotoDocumento: "",
    pilotoCertificado: "",
    observadorNombre: "",
    observadorDocumento: "",
    observadorCertificado: "",
    tipoDetalleEvento: "",
    evidenciaFotos: false,
    evidenciaVideo: false,
    evidenciaLogVuelo: false,
    evidenciaTelemetria: false,
    evidenciaOtros: false,
    evidenciaOtrosDetalle: "",
    causa1: "",
    causa2: "",
    causa3: "",
    causa4: "",
    causa5: "",
    reportaCargo: "",
    reportaContacto: "",
    firma: "",
    fechaFirma: "",
  });
  setReportAttachments([]);
  setRepFormOpen(false);
};


  /** ===================== CRUD ===================== */
  const submitReporte = async () => {
  try {
    const requiereMision = repClase === "SMS";
    const descripcionFinal = repClase === "MOR" ? (morNarrativa || repDescripcion) : repDescripcion;
    const tipoSituacionFinal = repClase === "VOLUNTARIO"
      ? String(repTipoSituacion || "").trim()
      : String(repTipoLabel || "").trim();
    const tipoCodeFinal = repClase === "VOLUNTARIO"
      ? tipoSituacionFinal.toUpperCase().replace(/\s+/g, "_")
      : repTipoCode;
    const tipoLabelFinal = repClase === "VOLUNTARIO" ? tipoSituacionFinal : repTipoLabel;
    const spiRelationFinal = resolveSpiRelation(repClase, tipoCodeFinal, tipoLabelFinal);
    const requiereUbicacionManual = repClase === "VOLUNTARIO";
    if (
      !tipoCodeFinal ||
      !tipoLabelFinal ||
      !repFechaHora ||
      !descripcionFinal ||
      !repGravedad ||
      (requiereMision && !repMisionId) ||
      (requiereUbicacionManual && !String(repUbicacion || "").trim())
    ) {
      Toast.show({
        type: "error",
        text1: "Validación",
        text2: "Completa todos los campos obligatorios (*)",
      });
      return;
    }

    const payload = {
      misionId: requiereMision ? repMisionId : undefined,
      fecha: repFechaHora.trim(),
      tipoCode: tipoCodeFinal,
      tipoLabel: tipoLabelFinal,
      spiCode: spiRelationFinal?.spiCode || "",
      spiLabel: spiRelationFinal?.spiLabel || "",
      tipoSituacion: tipoSituacionFinal,
      esAnonimo: repClase === "VOLUNTARIO" ? repEsAnonimo : false,
      descripcion: String(descripcionFinal || "").trim(),
      gravedad: repGravedad.trim(),
      ubicacion: repClase === "MOR"
        ? String(morCiudad || repUbicacion || "").trim()
        : (repClase === "VOLUNTARIO"
            ? String(repUbicacion || "").trim()
            : (repMisionSelected?.ubicacionGeneral?.trim() || "")),
      reporteClase: repClase,
      evidencias: (reportAttachments || []).map((a) => ({
        nombre: String(a?.name || "").trim(),
        mime: String(a?.mime || "").trim(),
        uri: String(a?.uri || "").trim(),
      })),
      mor:
        repClase === "MOR"
          ? {
              proveedor: {
                nombreComercial: String(morExtra.proveedorNombre || "").trim(),
                nit: String(morExtra.proveedorNit || "").trim(),
                fechaActualizacion: String(morExtra.fechaActualizacion || "").trim(),
                tipoProveedor: String(morExtra.tipoProveedor || "").trim(),
                tipoProveedorOtro: String(morExtra.tipoProveedorOtro || "").trim(),
                modalidadOperacion: String(morExtra.modalidadOperacion || "").trim(),
                modalidadOperacionOtro: String(morExtra.modalidadOperacionOtro || "").trim(),
              },
              aeronaves: {
                aeronave1: {
                  identificacionSerial: String(morExtra.aeronave1Identificacion || "").trim(),
                  marca: String(morExtra.aeronave1Marca || "").trim(),
                  modelo: String(morExtra.aeronave1Modelo || "").trim(),
                  mtow: String(morExtra.aeronave1Mtow || "").trim(),
                  tipo: String(morExtra.aeronave1Tipo || "").trim(),
                },
                aeronave2: {
                  identificacionSerial: String(morExtra.aeronave2Identificacion || "").trim(),
                  marca: String(morExtra.aeronave2Marca || "").trim(),
                  modelo: String(morExtra.aeronave2Modelo || "").trim(),
                },
              },
              evento: {
                fechaOcurrencia: repFechaHora.trim().split(" ")[0] || "",
                horaLocal: String(morHoraLocal || "").trim(),
                ciudadMunicipio: String(morCiudad || "").trim(),
                zonaOperacion: String(morExtra.zonaOperacion || "").trim(),
                condicionMeteorologica: String(morExtra.condicionMeteorologica || "").trim(),
                tipoContactoVisual: String(morExtra.tipoContactoVisual || "").trim(),
                faseOperacion: String(morExtra.faseOperacion || "").trim(),
                taxonomia: String(tipoCodeFinal || "").trim(),
                eventoObligatorio: String(tipoLabelFinal || tipoCodeFinal || "").trim(),
                detalleEvento: String(morExtra.tipoDetalleEvento || "").trim(),
                latitud: String(morExtra.latitud || "").trim(),
                longitud: String(morExtra.longitud || "").trim(),
                altitudAprox: String(morExtra.altitudAprox || "").trim(),
                oaci: String(morExtra.oaci || "").trim(),
                aerodromoNombre: String(morExtra.aerodromoNombre || "").trim(),
                narrativa: String(morNarrativa || repDescripcion || "").trim(),
              },
              personal: {
                pilotoMando: {
                  nombre: String(morExtra.pilotoNombre || "").trim(),
                  documento: String(morExtra.pilotoDocumento || "").trim(),
                  certificadoIdoneidad: String(morExtra.pilotoCertificado || "").trim(),
                },
                observador: {
                  nombre: String(morExtra.observadorNombre || "").trim(),
                  documento: String(morExtra.observadorDocumento || "").trim(),
                  certificadoIdoneidad: String(morExtra.observadorCertificado || "").trim(),
                },
              },
              evidencia: {
                fotos: !!morExtra.evidenciaFotos,
                video: !!morExtra.evidenciaVideo,
                logVuelo: !!morExtra.evidenciaLogVuelo,
                telemetria: !!morExtra.evidenciaTelemetria,
                otros: !!morExtra.evidenciaOtros,
                otrosDetalle: String(morExtra.evidenciaOtrosDetalle || "").trim(),
              },
              causalidad: [
                String(morExtra.causa1 || "").trim(),
                String(morExtra.causa2 || "").trim(),
                String(morExtra.causa3 || "").trim(),
                String(morExtra.causa4 || "").trim(),
                String(morExtra.causa5 || "").trim(),
              ].filter(Boolean),
              evaluacion: {
                severidad: String(morSeveridad || "Moderado"),
                riesgo: String(morRiesgo || "Tolerable"),
                estado: "Abierto",
              },
              reporta: {
                nombre: String(morReportaNombre || "").trim(),
                cargo: String(morExtra.reportaCargo || "").trim(),
                correo: String(morReportaCorreo || "").trim(),
                contacto: String(morExtra.reportaContacto || "").trim(),
              },
              declaracion: {
                firma: String(morExtra.firma || "").trim(),
                fecha: String(morExtra.fechaFirma || "").trim(),
              },
            }
          : undefined,
    };

    // ✅ Detectar conexión
    const net = await NetInfo.fetch();
    const online = !!net.isConnected && !!net.isInternetReachable;

    // ✅ SIN INTERNET => guardar en cola offline y salir
    if (!online) {
      await enqueueReporte(payload);
      await loadSyncSummary();

      Toast.show({
        type: "success",
        text1: "Guardado (offline)",
        text2: "El reporte quedó pendiente y se enviará cuando vuelva el internet.",
      });

      await SecureStore.deleteItemAsync(SECURE_REPORTE_DRAFT_KEY);
      resetReporteForm();
      return;
    }

    // ✅ CON INTERNET => enviar normal
    await apiFetch<Reporte>("/api/reportes", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    Toast.show({
      type: "success",
      text1: "OK",
      text2: "Reporte creado.",
    });

    await SecureStore.deleteItemAsync(SECURE_REPORTE_DRAFT_KEY);
    resetReporteForm();

    if (section === "my-reports") await loadReportes();
    await loadDashboard();
  } catch (e: any) {
    // Si aquí cae por red, también lo guardamos offline
    try {
      const tipoSituacionOffline = repClase === "VOLUNTARIO"
        ? String(repTipoSituacion || "").trim()
        : String(repTipoLabel || "").trim();
      const tipoCodeOffline = repClase === "VOLUNTARIO"
        ? tipoSituacionOffline.toUpperCase().replace(/\s+/g, "_")
        : repTipoCode;
      const tipoLabelOffline = repClase === "VOLUNTARIO" ? tipoSituacionOffline : repTipoLabel;
      const spiRelationOffline = resolveSpiRelation(repClase, tipoCodeOffline, tipoLabelOffline);
      await enqueueReporte({
        misionId: repClase === "SMS" ? repMisionId : undefined,
        fecha: repFechaHora.trim(),
        tipoCode: tipoCodeOffline,
        tipoLabel: tipoLabelOffline,
        spiCode: spiRelationOffline?.spiCode || "",
        spiLabel: spiRelationOffline?.spiLabel || "",
        tipoSituacion: tipoSituacionOffline,
        esAnonimo: repClase === "VOLUNTARIO" ? repEsAnonimo : false,
        descripcion: String((repClase === "MOR" ? morNarrativa || repDescripcion : repDescripcion) || "").trim(),
        gravedad: repGravedad.trim(),
        ubicacion: repClase === "MOR"
          ? String(morCiudad || repUbicacion || "").trim()
          : (repClase === "VOLUNTARIO"
              ? String(repUbicacion || "").trim()
              : (repMisionSelected?.ubicacionGeneral?.trim() || "")),
        reporteClase: repClase,
        evidencias: (reportAttachments || []).map((a) => ({
          nombre: String(a?.name || "").trim(),
          mime: String(a?.mime || "").trim(),
          uri: String(a?.uri || "").trim(),
        })),
        mor:
          repClase === "MOR"
            ? {
                proveedor: {
                  nombreComercial: String(morExtra.proveedorNombre || "").trim(),
                  nit: String(morExtra.proveedorNit || "").trim(),
                  fechaActualizacion: String(morExtra.fechaActualizacion || "").trim(),
                  tipoProveedor: String(morExtra.tipoProveedor || "").trim(),
                  tipoProveedorOtro: String(morExtra.tipoProveedorOtro || "").trim(),
                  modalidadOperacion: String(morExtra.modalidadOperacion || "").trim(),
                  modalidadOperacionOtro: String(morExtra.modalidadOperacionOtro || "").trim(),
                },
                aeronaves: {
                  aeronave1: {
                    identificacionSerial: String(morExtra.aeronave1Identificacion || "").trim(),
                    marca: String(morExtra.aeronave1Marca || "").trim(),
                    modelo: String(morExtra.aeronave1Modelo || "").trim(),
                    mtow: String(morExtra.aeronave1Mtow || "").trim(),
                    tipo: String(morExtra.aeronave1Tipo || "").trim(),
                  },
                  aeronave2: {
                    identificacionSerial: String(morExtra.aeronave2Identificacion || "").trim(),
                    marca: String(morExtra.aeronave2Marca || "").trim(),
                    modelo: String(morExtra.aeronave2Modelo || "").trim(),
                  },
                },
                evento: {
                  fechaOcurrencia: repFechaHora.trim().split(" ")[0] || "",
                  horaLocal: String(morHoraLocal || "").trim(),
                  ciudadMunicipio: String(morCiudad || "").trim(),
                  zonaOperacion: String(morExtra.zonaOperacion || "").trim(),
                  condicionMeteorologica: String(morExtra.condicionMeteorologica || "").trim(),
                  tipoContactoVisual: String(morExtra.tipoContactoVisual || "").trim(),
                  faseOperacion: String(morExtra.faseOperacion || "").trim(),
                  taxonomia: String(tipoCodeOffline || "").trim(),
                  eventoObligatorio: String(tipoLabelOffline || tipoCodeOffline || "").trim(),
                  detalleEvento: String(morExtra.tipoDetalleEvento || "").trim(),
                  latitud: String(morExtra.latitud || "").trim(),
                  longitud: String(morExtra.longitud || "").trim(),
                  altitudAprox: String(morExtra.altitudAprox || "").trim(),
                  oaci: String(morExtra.oaci || "").trim(),
                  aerodromoNombre: String(morExtra.aerodromoNombre || "").trim(),
                  narrativa: String(morNarrativa || repDescripcion || "").trim(),
                },
                personal: {
                  pilotoMando: {
                    nombre: String(morExtra.pilotoNombre || "").trim(),
                    documento: String(morExtra.pilotoDocumento || "").trim(),
                    certificadoIdoneidad: String(morExtra.pilotoCertificado || "").trim(),
                  },
                  observador: {
                    nombre: String(morExtra.observadorNombre || "").trim(),
                    documento: String(morExtra.observadorDocumento || "").trim(),
                    certificadoIdoneidad: String(morExtra.observadorCertificado || "").trim(),
                  },
                },
                evidencia: {
                  fotos: !!morExtra.evidenciaFotos,
                  video: !!morExtra.evidenciaVideo,
                  logVuelo: !!morExtra.evidenciaLogVuelo,
                  telemetria: !!morExtra.evidenciaTelemetria,
                  otros: !!morExtra.evidenciaOtros,
                  otrosDetalle: String(morExtra.evidenciaOtrosDetalle || "").trim(),
                },
                causalidad: [
                  String(morExtra.causa1 || "").trim(),
                  String(morExtra.causa2 || "").trim(),
                  String(morExtra.causa3 || "").trim(),
                  String(morExtra.causa4 || "").trim(),
                  String(morExtra.causa5 || "").trim(),
                ].filter(Boolean),
                evaluacion: {
                  severidad: String(morSeveridad || "Moderado"),
                  riesgo: String(morRiesgo || "Tolerable"),
                  estado: "Abierto",
                },
                reporta: {
                  nombre: String(morReportaNombre || "").trim(),
                  cargo: String(morExtra.reportaCargo || "").trim(),
                  correo: String(morReportaCorreo || "").trim(),
                  contacto: String(morExtra.reportaContacto || "").trim(),
                },
                declaracion: {
                  firma: String(morExtra.firma || "").trim(),
                  fecha: String(morExtra.fechaFirma || "").trim(),
                },
              }
            : undefined,
      });

      Toast.show({
        type: "success",
        text1: "Guardado (offline)",
        text2: "No hubo conexión. Se guardó pendiente para enviar luego.",
      });

      await loadSyncSummary();
      await SecureStore.deleteItemAsync(SECURE_REPORTE_DRAFT_KEY);
      resetReporteForm();
      return;
    } catch {}

    Toast.show({
      type: "error",
      text1: "Error",
      text2: e?.message || "No se pudo crear el reporte",
    });
  }
};


  const submitVuelo = async () => {
    try {
      setSavingFlight(true);

      if (!flightLogFiles.length) {
        Toast.show({
          type: "error",
          text1: "Validación",
          text2: "Debes subir al menos un log de vuelo.",
        });
        return;
      }

      const invalidFiles = flightLogFiles.filter((file) => file.size > MAX_FLIGHT_LOG_SIZE_BYTES);
      if (invalidFiles.length) {
        setFlightLogResults(
          invalidFiles.map((file) => ({
            id: file.id,
            name: file.name,
            ok: false,
            message: "Supera el tamaño máximo de 50 MB.",
          }))
        );
        Toast.show({
          type: "error",
          text1: "Validación",
          text2: "Hay archivos que superan el tamaño máximo permitido.",
        });
        return;
      }

      const net = await NetInfo.fetch();
      const online = !!net.isConnected && !!net.isInternetReachable;

      if (!online) {
        Toast.show({
          type: "error",
          text1: "Sin conexión",
          text2: "La bitácora automática por logs necesita internet para procesar los archivos.",
        });
        return;
      }

      const uploadResults = await uploadFlightLogsOnline(
        flightLogFiles,
        flightMisionId || activeMission?._id || missionToday?._id
      );
      setFlightLogResults(uploadResults);

      const successfulServerIds = uploadResults
        .filter((result) => result.ok && result.serverFlightLogId)
        .map((result) => String(result.serverFlightLogId));

      if (!successfulServerIds.length) {
        Toast.show({
          type: "error",
          text1: "No se pudo procesar",
          text2: "No hubo logs válidos para autollenar la bitácora.",
        });
        return;
      }

      const prefillResponse: any = await getFlightLogBitacoraPrefill(successfulServerIds);
      const prefill = prefillResponse?.data?.prefill || prefillResponse?.prefill;

      if (!prefill) {
        Toast.show({
          type: "error",
          text1: "Sin datos",
          text2: "Los logs se subieron, pero no se pudo construir el prellenado de la bitácora.",
        });
        return;
      }

      const consolidatedFlightLogIds = Array.isArray(prefill.flightLogIds)
        ? prefill.flightLogIds.map((id: any) => String(id || "")).filter(Boolean)
        : [];
      if (!consolidatedFlightLogIds.length) {
        Toast.show({
          type: "error",
          text1: "Sin logs válidos",
          text2: "Los archivos no contienen vuelos que puedan consolidarse.",
        });
        return;
      }

      const fechaHora = String(prefill.fechaHora || new Date().toISOString());
      const duracionMin = Math.max(1, Number(prefill.duracionMin || prefill.tiempoTotalVueloMin || 1));
      const missionTitle = String(prefill.missionTitle || activeMission?.titulo || missionToday?.titulo || "").trim();
      const locationRaw = String(
        prefill.lugarOperacion ||
        activeMission?.ubicacionGeneral ||
        missionToday?.ubicacionGeneral ||
        currentPlaceLabel ||
        ""
      ).trim();
      const [municipioRaw = "", departamentoRaw = ""] = locationRaw.split(",").map((item) => item.trim());
      const suggestedCoords =
        String(prefill.coordenadasOperacion || "").trim() ||
        (gpsCell.enabled && gpsCell.lat != null && gpsCell.lon != null
          ? `${gpsCell.lat.toFixed(6)}, ${gpsCell.lon.toFixed(6)}`
          : "");
      const suggestedWeatherLabel = String(weatherNow.label || "").trim().toLowerCase();
      const suggestedWeather =
        suggestedWeatherLabel === "despejado" ||
        suggestedWeatherLabel === "parcialmente nublado" ||
        suggestedWeatherLabel === "nublado" ||
        suggestedWeatherLabel === "lluvia"
          ? suggestedWeatherLabel
          : undefined;
      const suggestedVisibility =
        weatherDetail.visibilityM != null
          ? `${(weatherDetail.visibilityM / 1000).toFixed(1)} km`
          : undefined;
      const ubicacion =
        String(prefill.ubicacion || prefill.lugarOperacion || currentPlaceLabel || "").trim() ||
        "Ubicación derivada del log";
      const missionId = String(prefill.missionId || flightMisionId || activeMission?._id || missionToday?._id || "").trim();
      const uas =
        String(prefill.uas || equipoSel?.ruas || equipoSel?.modelo || flightUas || "").trim() || "UAS";
      const suggestedMissionType = missionTitle
        ? /vigil/i.test(missionTitle)
          ? "vigilancia"
          : /foto|film|imagen/i.test(missionTitle)
            ? "fotografía"
            : /topo|map/i.test(missionTitle)
              ? "topografía"
              : "inspección"
        : undefined;
      const suggestedOperationType = ((activeMission as any)?.tipoOperacion || (missionToday as any)?.tipoOperacion || "VLOS") as
        | "VLOS"
        | "EVLOS"
        | "BVLOS";
      const normalizedOperationType =
        suggestedOperationType === "VLOS" || suggestedOperationType === "EVLOS" || suggestedOperationType === "BVLOS"
          ? suggestedOperationType
          : "VLOS";
      const suggestedAreaLabel =
        locationRaw ||
        (activeMission?.areaOperacion ? "Área definida en misión activa" : "") ||
        ((missionToday as any)?.areaOperacion ? "Área definida en misión programada" : "");
      const normalizedMissionType =
        suggestedMissionType === "inspección" ||
        suggestedMissionType === "vigilancia" ||
        suggestedMissionType === "fotografía" ||
        suggestedMissionType === "topografía" ||
        suggestedMissionType === "mapeo"
          ? suggestedMissionType
          : undefined;
      const normalizedWeather =
        suggestedWeather === "despejado" ||
        suggestedWeather === "parcialmente nublado" ||
        suggestedWeather === "nublado" ||
        suggestedWeather === "lluvia"
          ? suggestedWeather
          : undefined;

      const payload: NuevoVueloPayload = {
        misionId: missionId || undefined,
        fechaHora,
        horaInicio: String(prefill.horaInicio || "").trim() || undefined,
        horaFin: String(prefill.horaFin || "").trim() || undefined,
        ubicacion,
        uas,
        equipoId: equipoSel?._id || undefined,
        proposito: missionTitle
          ? `Operación asociada a ${missionTitle}`
          : "Bitácora autogenerada desde flight log",
        tipoOperacion: normalizedOperationType,
        categoriaOperacion: "comercial",
        duracionMin,
        nombrePiloto: String(usuario?.nombre || "").trim() || undefined,
        identificacionPiloto: String(usuario?.documento || "").trim() || undefined,
        licenciaPiloto: String(usuario?.cipu || "").trim() || undefined,
        empresaOperador: "Aeroxpert UAV",
        lugarOperacion: locationRaw || undefined,
        municipio: municipioRaw || undefined,
        departamento: departamentoRaw || undefined,
        coordenadasOperacion: suggestedCoords || undefined,
        altitudMaxAlcanzada: Number.isFinite(Number(prefill.altitudMaxAlcanzada))
          ? Number(prefill.altitudMaxAlcanzada)
          : undefined,
        areaOperacion: suggestedAreaLabel || undefined,
        tipoMision: normalizedMissionType,
        condicionMeteorologica: normalizedWeather,
        velocidadViento: weatherDetail.windMs != null ? Number(weatherDetail.windMs.toFixed(1)) : undefined,
        temperatura: Number.isFinite(Number(prefill.temperatura))
          ? Number(prefill.temperatura)
          : weatherDetail.tempC != null
            ? Number(weatherDetail.tempC.toFixed(1))
          : undefined,
        visibilidad: suggestedVisibility,
        numeroDespegues: Number.isFinite(Number(prefill.numeroDespegues))
          ? Number(prefill.numeroDespegues)
          : undefined,
        numeroAterrizajes: Number.isFinite(Number(prefill.numeroAterrizajes))
          ? Number(prefill.numeroAterrizajes)
          : undefined,
        tiempoTotalVueloMin: Number.isFinite(Number(prefill.tiempoTotalVueloMin))
          ? Number(prefill.tiempoTotalVueloMin)
          : duracionMin,
        bateriasUtilizadas: String(prefill.bateriasUtilizadas || "").trim() || undefined,
        bateriasDetalle: Array.isArray(prefill.bateriasDetalle) ? prefill.bateriasDetalle : undefined,
        distanciaTotalM: Number.isFinite(Number(prefill.distanciaTotalM))
          ? Number(prefill.distanciaTotalM)
          : undefined,
        velocidadPromedioMps: Number.isFinite(Number(prefill.velocidadPromedioMps))
          ? Number(prefill.velocidadPromedioMps)
          : undefined,
        velocidadMaximaMps: Number.isFinite(Number(prefill.velocidadMaximaMps))
          ? Number(prefill.velocidadMaximaMps)
          : undefined,
        fotografiasCapturadas: Number.isFinite(Number(prefill.fotografiasCapturadas))
          ? Number(prefill.fotografiasCapturadas)
          : undefined,
        rutaConsolidada: Array.isArray(prefill.rutaConsolidada) ? prefill.rutaConsolidada : undefined,
        payload: `${consolidatedFlightLogIds.length} log(s) consolidados`,
        checklistPrevueloRealizado: true,
        evaluacionRiesgos: "Sin hallazgos críticos reportados",
        zonaSeguraEstablecida: true,
        huboIncidente: false,
        descripcionNovedad: "Sin novedades registradas",
        accionesTomadas: "No se requirieron acciones correctivas",
        nombrePilotoResponsable: String(usuario?.nombre || "").trim() || undefined,
        flightLogIds: consolidatedFlightLogIds,
        notas: [
          String(prefill.notas || "").trim(),
          prefill.maxSatellites != null ? `Máx. satélites detectados: ${prefill.maxSatellites}.` : "",
          missionTitle ? `Misión relacionada: ${missionTitle}.` : "",
        ]
          .filter(Boolean)
          .join(" ")
          || undefined,
      };

      await apiFetch("/api/vuelos", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      const uploadedFail = uploadResults.filter((result) => !result.ok).length;
      const rejected = Math.max(0, Number(prefill.logsRechazados || 0));
      const identifiedBatteries = Array.isArray(prefill.bateriasDetalle)
        ? prefill.bateriasDetalle.length
        : 0;
      const summary =
        `Bitácora consolidada: ${duracionMin} min, ${consolidatedFlightLogIds.length} log(s)` +
        `${identifiedBatteries ? `, ${identifiedBatteries} batería(s)` : ""}` +
        `${rejected || uploadedFail ? `. No procesados: ${rejected + uploadedFail}` : ""}.`;

      Toast.show({ type: "success", text1: "OK", text2: summary });

      closeNewFlight();
      await loadVuelos();
    } catch (e: any) {
      Toast.show({ type: "error", text1: "Error", text2: e?.message || "No se pudo registrar el vuelo" });
    } finally {
      setSavingFlight(false);
    }
  };


const uploadAuthorizationAndSubmit = async (mission: Mision) => {
  try {
    const picked = await DocumentPicker.getDocumentAsync({
      type: ["application/pdf", "image/*"],
      multiple: false,
      copyToCacheDirectory: true,
    });
    if (picked.canceled || !picked.assets?.[0]) return;
    const file = picked.assets[0];
    const form = new FormData();
    form.append("autorizacionVuelo", {
      uri: file.uri,
      name: file.name || "autorizacion-vuelo.pdf",
      type: file.mimeType || "application/pdf",
    } as any);
    const authToken = String(ctxToken || token || await getToken()).trim();
    if (!authToken) throw new Error("La sesión venció.");
    const response = await fetch(
      `${API_URL}${normalizePath(`/api/misiones/${mission._id}/autorizacion/enviar-aprobacion`)}`,
      {
        method: "POST",
        headers: { Accept: "application/json", Authorization: `Bearer ${authToken}` },
        body: form,
      }
    );
    const text = await response.text();
    const data = text ? safeJsonParse(text) : {};
    if (!response.ok) throw new Error(data?.message || "No se pudo enviar la autorización.");
    Toast.show({ type: "success", text1: "Enviada para aprobación", text2: "El jefe de pilotos recibió la operación." });
    await loadMisiones();
  } catch (error: any) {
    Toast.show({ type: "error", text1: "No se pudo enviar", text2: error?.message || "Intenta nuevamente." });
  }
};

const approveMissionAuthorization = (mission: Mision) => {
  Alert.alert(
    "Aprobar operación",
    `¿Confirmas la aprobación de ${mission.titulo || "esta operación"}?`,
    [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Aprobar",
        onPress: async () => {
          try {
            await apiFetch(`/api/misiones/${mission._id}/autorizacion/aprobar`, {
              method: "PATCH",
            });
            Toast.show({ type: "success", text1: "Operación aprobada", text2: "La misión quedó programada." });
            await loadMisiones();
          } catch (error: any) {
            Toast.show({ type: "error", text1: "No se pudo aprobar", text2: error?.message || "Revisa la autorización." });
          }
        },
      },
    ]
  );
};

const uploadFieldDocument = async (type: "certificadoMedico" | "cipu" | "arl") => {
  if (type === "certificadoMedico") {
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(medicalCertificateStart) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(medicalCertificateEnd) ||
      medicalCertificateEnd < medicalCertificateStart
    ) {
      Toast.show({ type: "error", text1: "Fechas no válidas", text2: "Verifica la fecha inicial y la fecha de vencimiento." });
      return;
    }
  }
  try {
    const picked = await DocumentPicker.getDocumentAsync({
      type: ["application/pdf", "image/*"],
      multiple: false,
      copyToCacheDirectory: true,
    });
    if (picked.canceled || !picked.assets?.[0]) return;
    setFieldDocumentBusy(type);
    const file = picked.assets[0];
    if (Number(file.size || 0) > 25 * 1024 * 1024) {
      throw new Error("El archivo supera el tamaño máximo permitido de 25 MB.");
    }
    const form = new FormData();
    form.append("docFile", {
      uri: file.uri,
      name: file.name || `${type}.pdf`,
      type: file.mimeType || "application/pdf",
    } as any);
    if (type === "certificadoMedico") {
      form.append("fechaInicio", medicalCertificateStart);
      form.append("fechaVencimiento", medicalCertificateEnd);
    }
    const authToken = String(ctxToken || token || await getToken()).trim();
    if (!authToken) throw new Error("La sesión venció.");
    const response = await fetch(`${API_URL}${normalizePath(`/api/me/documentos-campo/${type}`)}`, {
      method: "POST",
      headers: { Accept: "application/json", Authorization: `Bearer ${authToken}` },
      body: form,
    });
    const raw = await response.text();
    const data = raw ? safeJsonParse(raw) : {};
    if (!response.ok) {
      throw new Error(
        data?.message ||
          data?.error ||
          `El servidor respondió HTTP ${response.status} al cargar el documento.`
      );
    }
    Toast.show({ type: "success", text1: "Documento actualizado", text2: "La certificación quedó guardada en tu perfil." });
    await loadDashboard();
  } catch (error: any) {
    console.error("uploadFieldDocument:", {
      type,
      message: error?.message,
      name: error?.name,
    });
    const detail =
      error?.message === "Network request failed"
        ? "No fue posible conectar con el servidor. Revisa Internet y la URL del backend."
        : error?.message || "Intenta nuevamente.";
    Toast.show({ type: "error", text1: "No se pudo cargar", text2: detail });
  } finally {
    setFieldDocumentBusy("");
  }
};

const openFieldDocument = async (type: "certificadoMedico" | "cipu" | "arl") => {
  try {
    const response = await apiFetch<{ url?: string }>(`/api/me/documentos-campo/${type}/url`);
    if (!response?.url) throw new Error("No se recibió el enlace del documento.");
    await Linking.openURL(response.url);
  } catch (error: any) {
    Toast.show({ type: "error", text1: "No se pudo abrir", text2: error?.message || "Intenta nuevamente." });
  }
};

 const marcarMisionCumplida = async (misionId: string) => {
  try {
    const gate = await canMarkMissionDone(misionId, procStatusMap);

    if (!gate.ok) {
      Toast.show({
        type: "error",
        text1: "No permitido",
        text2: "Debes completar Preflight + Autoevaluación + Variables críticas antes de cerrar la misión.",
      });
      return;
    }

    // ✅ Evidencias y cierre: SOLO ONLINE
    const net = await NetInfo.fetch();
    const online = !!net.isConnected && !!net.isInternetReachable;

    if (!online) {
      setEvidenceMissionId(misionId);
      setEvidenceNote("");
      setEvidenceItems([]);
      setEvidenceChecklist({ area: false, aeronave: false, equipo: false });
      setShowEvidenceModal(true);
      Toast.show({ type: "info", text1: "Cierre offline", text2: "Adjunta evidencias para guardar la finalización provisional." });
      return;
    }

    // ✅ Paso 2: abrir modal de evidencias (no cerrar aquí)
    setEvidenceMissionId(misionId);
    setEvidenceNote("");
    setEvidenceItems([]);
    setShowEvidenceModal(true);
  } catch (e: any) {
    Toast.show({
      type: "error",
      text1: "Error",
      text2: e?.message || "No se pudo validar",
    });
  }
};



async function uploadEvidenceOnline(misionId: string, note: string, items: EvidencePicked[]) {
  const url = `${API_URL}${normalizePath(`/api/misiones/${misionId}/evidencias`)}`;
  const token = await getToken();
  if (!token) throw new Error("No autorizado (sin token).");

  const form = new FormData();
  form.append("note", note || "");

  for (const it of items) {
    form.append("files", {
      uri: it.uri,
      name: it.name,
      type: it.mime,
    } as any);
  }

  const res = await withTimeout(
    fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form as any,
    }),
    20000
  );

  const text = await res.text();
  const data = text ? safeJsonParse(text) : null;

  if (!res.ok) {
    const msg = data?.msg || data?.message || `Error ${res.status} subiendo evidencias`;
    throw new Error(msg);
  }

  return data;
}




  const generarCertificadoHorasUI = () => {
    if (!vuelos.length) {
      Toast.show({
        type: "error",
        text1: "Sin datos",
        text2: "No hay vuelos cargados desde la base de datos.",
      });
      return;
    }
    const totalMin = vuelos.reduce((acc, v) => acc + (v.duracionMin || 0), 0);
    Toast.show({
      type: "success",
      text1: "Certificado de horas",
      text2: `Total acumulado: ${totalMin} min.`,
    });
  };


  const syncingDoneRef = React.useRef(false);

const syncMisionCumplidaQueue = useCallback(async () => {
  if (syncingDoneRef.current) return;
  syncingDoneRef.current = true;

  try {
    const net = await NetInfo.fetch();
    const online = !!net.isConnected && !!net.isInternetReachable;
    if (!online) return;

    const q = await getQueue<PendingMisionDone>(SECURE_MISION_CUMPLIDA_QUEUE_KEY);
    if (!q.length) return;

    await setQueue(SECURE_MISION_CUMPLIDA_QUEUE_KEY, []);

    const still: PendingMisionDone[] = [];

    for (const item of q) {
      const gate = await canMarkMissionDone(item.misionId, procStatusMap);
      if (!gate.ok) {
        // aún no están las 3 => reencolar
        still.push(item);
        continue;
      }

      try {
        await apiFetch(`/api/misiones/${item.misionId}/cumplida`, { method: "PATCH" });
      } catch {
        still.push(item);
      }
    }

    await setQueue(SECURE_MISION_CUMPLIDA_QUEUE_KEY, still);
    await loadMisiones();
    await loadDashboard();
  } finally {
    syncingDoneRef.current = false;
  }
}, [procStatusMap, loadMisiones, loadDashboard]);



 async function savePreflightChecklist() {
  try {
    if (!procMission?._id) {
      Toast.show({ type:"error", text1:"Validación", text2:"Selecciona misión." });
      return;
    }

    const payload = {
      ...checklist,
      misionId: procMission._id,
      fecha: new Date().toISOString(),
      origen: "app",
      clientId: makeLocalId("preflight"), // opcional recomendado para dedupe backend
    };

    const net = await NetInfo.fetch();
    const online = !!net.isConnected && !!net.isInternetReachable;

    if (!online) {
      await enqueueOfflineAction({
        category: "procedure",
        missionId: procMission._id,
        endpoint: "/api/procedures/preflight",
        method: "POST",
        body: { ...payload, offlineProcedureKind: "preflight" },
      });

      // ✅ marca en UI como completado “local”
      setProcStatusMap(prev => ({
        ...prev,
        [procMission._id]: {
          ...(prev[procMission._id] || { preflight:false, autoeval:false, battery:false }),
          preflight: true,
        }
      }));

      Toast.show({ type:"success", text1:"Guardado (offline)", text2:"Preflight quedó pendiente." });
      await loadSyncSummary();
      closeChecklist();
      if (guidedFlowMissionId === procMission._id) {
        setShowAutoevalModal(true);
        Toast.show({ type: "info", text1: "Flujo operativo", text2: "Paso 2/3: completa Autoevaluación." });
      } else {
        setProcMission(null);
      }
      return;
    }

    const r = await apiFetch<ApiOk>("/api/procedures/preflight", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    if (!r?.ok) throw new Error(r?.msg || "No se pudo guardar");

    // ✅ marcar ok en UI
    setProcStatusMap(prev => ({
      ...prev,
      [procMission._id]: {
        ...(prev[procMission._id] || { preflight:false, autoeval:false, battery:false }),
        preflight: true,
      }
    }));

    Toast.show({ type:"success", text1:"Guardado", text2:"Checklist guardado." });
    closeChecklist();
    if (guidedFlowMissionId === procMission._id) {
      setShowAutoevalModal(true);
      Toast.show({ type: "info", text1: "Flujo operativo", text2: "Paso 2/3: completa Autoevaluación." });
    } else {
      setProcMission(null);
    }
  } catch (e:any) {
    Toast.show({ type:"error", text1:"Error", text2: e?.message || "Error guardando" });
  }
}

async function saveAutoevaluacion() {
  try {
    if (!procMission?._id) {
      Toast.show({ type:"error", text1:"Validación", text2:"Selecciona misión." });
      return;
    }
    const payload = {
      ...autoeval,
      acepto: true,
      misionId: procMission._id,
      fecha: new Date().toISOString(),
      origen: "app",
      clientId: makeLocalId("autoeval"),
    };

    const net = await NetInfo.fetch();
    const online = !!net.isConnected && !!net.isInternetReachable;
    if (!online) {
      await enqueueOfflineAction({
        category: "procedure",
        missionId: procMission._id,
        endpoint: "/api/procedures/autoevaluacion",
        method: "POST",
        body: { ...payload, offlineProcedureKind: "autoeval" },
      });
      setProcStatusMap((prev) => ({
        ...prev,
        [procMission._id]: {
          ...(prev[procMission._id] || { preflight: false, autoeval: false, battery: false }),
          autoeval: true,
        },
      }));
      Toast.show({ type: "success", text1: "Guardado offline", text2: "Autoevaluación pendiente de sincronización." });
      closeAutoeval();
      if (guidedFlowMissionId === procMission._id) setShowBatteryModal(true);
      else setProcMission(null);
      await loadSyncSummary();
      return;
    }

    const r = await apiFetch<ApiOk>("/api/procedures/autoevaluacion", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    if (!r?.ok) throw new Error(r?.msg || "No se pudo guardar");

    // ✅ marcar ok en UI
    setProcStatusMap(prev => ({
      ...prev,
      [procMission._id]: {
        ...(prev[procMission._id] || { preflight:false, autoeval:false, battery:false }),
        autoeval: true,
      }
    }));

    Toast.show({ type:"success", text1:"Guardado", text2:"Autoevaluación guardada." });
    closeAutoeval();
    if (guidedFlowMissionId === procMission._id) {
      setShowBatteryModal(true);
      Toast.show({ type: "info", text1: "Flujo operativo", text2: "Paso 3/3: completa Variables críticas." });
    } else {
      setProcMission(null);
    }
  } catch (e:any) {
    Toast.show({ type:"error", text1:"Error", text2: e?.message || "Error guardando autoevaluación" });
  }
}


async function saveBatteryChecklist() {
  try {
    if (!procMission?._id) {
      Toast.show({ type:"error", text1:"Validación", text2:"Selecciona misión." });
      return;
    }

    const payload = {
      ...batteryChecks,
      misionId: procMission._id,
      fecha: new Date().toISOString(),
      origen: "app",
      clientId: makeLocalId("battery"),
    };

    const net = await NetInfo.fetch();
    const online = !!net.isConnected && !!net.isInternetReachable;
    if (!online) {
      await enqueueOfflineAction({
        category: "procedure",
        missionId: procMission._id,
        endpoint: "/api/procedures/battery",
        method: "POST",
        body: { ...payload, offlineProcedureKind: "battery" },
      });
      setProcStatusMap((prev) => ({
        ...prev,
        [procMission._id]: {
          ...(prev[procMission._id] || { preflight: false, autoeval: false, battery: false }),
          battery: true,
        },
      }));
      Toast.show({ type: "success", text1: "Guardado offline", text2: "Variables críticas pendientes de sincronización." });
      closeBattery();
      if (guidedFlowMissionId === procMission._id) {
        const missionDone = (misiones || []).find((m) => m._id === procMission._id) || procMission;
        openOperationFlow(missionDone);
      } else setProcMission(null);
      await loadSyncSummary();
      return;
    }

    const r = await apiFetch<ApiOk>("/api/procedures/battery", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    if (!r?.ok) throw new Error(r?.msg || "No se pudo guardar");

    // ✅ marcar ok en UI
    setProcStatusMap(prev => ({
      ...prev,
      [procMission._id]: {
        ...(prev[procMission._id] || { preflight:false, autoeval:false, battery:false }),
        battery: true,
      }
    }));

    Toast.show({ type:"success", text1:"Guardado", text2:"Variables críticas guardadas." });
    closeBattery();
    if (guidedFlowMissionId === procMission._id) {
      const missionDone = (misiones || []).find((m) => m._id === procMission._id) || procMission;
      openOperationFlow(missionDone);
      Toast.show({ type: "success", text1: "Procedimientos completos", text2: "Escanea QR e inicia operación." });
    } else {
      setProcMission(null);
    }
  } catch (e:any) {
    Toast.show({ type:"error", text1:"Error", text2: e?.message || "Error guardando variables críticas" });
  }
}


async function loadProcStatusBatch(ids: string[]) {
  const r = await apiFetch<{ ok: boolean; map: Record<string, ProcStatus> }>(
    "/api/procedures/status/batch",
    {
      method: "POST",
      body: JSON.stringify({ misionIds: ids }),
    }
  );

  if (r?.ok) setProcStatusMap(r.map || {});
}


const saveEvidenceAndFinishMission = useCallback(async () => {
  if (!evidenceMissionId) return;

  const net = await NetInfo.fetch();
  const online = !!net.isConnected && !!net.isInternetReachable;

  if (!online) {
    if (!evidenceItems.length) {
      Toast.show({ type: "error", text1: "Evidencias requeridas", text2: "Debes adjuntar al menos una evidencia." });
      return;
    }
    if (!Object.values(evidenceChecklist).every(Boolean)) {
      Toast.show({ type: "error", text1: "Checklist visual", text2: "Completa la validación visual." });
      return;
    }
    setSavingEvidence(true);
    try {
      const persisted = await persistOfflineFiles(
        evidenceItems.map((item) => ({ uri: item.uri, name: item.name, mimeType: item.mime })),
        "files"
      );
      await enqueueOfflineAction({
        category: "evidence",
        missionId: evidenceMissionId,
        endpoint: `/api/misiones/${evidenceMissionId}/evidencias`,
        method: "POST",
        body: { note: evidenceNote.trim() },
        files: persisted,
      });
      await enqueueOfflineAction({
        category: "mission",
        missionId: evidenceMissionId,
        endpoint: `/api/misiones/${evidenceMissionId}/cumplida`,
        method: "PATCH",
        body: { finalizacionProvisional: true },
      });
      markOperationStatus(evidenceMissionId, { finalized: true });
      closeEvidenceModal();
      await loadSyncSummary();
      Toast.show({
        type: "success",
        text1: "Misión finalizada offline",
        text2: "Evidencias y cierre pendientes de sincronización.",
      });
    } catch (error: any) {
      Toast.show({ type: "error", text1: "No se pudo guardar offline", text2: error?.message || "Intenta nuevamente." });
    } finally {
      setSavingEvidence(false);
    }
    return;
  }

  if (!evidenceItems.length) {
    Toast.show({
      type: "error",
      text1: "Evidencias requeridas",
      text2: "Debes adjuntar al menos una evidencia para cerrar la misión.",
    });
    return;
  }

  if (!Object.values(evidenceChecklist).every(Boolean)) {
    Toast.show({
      type: "error",
      text1: "Checklist visual",
      text2: "Completa la validación visual antes de cerrar la misión.",
    });
    return;
  }

  setSavingEvidence(true);
  try {
    // 1) subir evidencias
    await uploadEvidenceOnline(evidenceMissionId, evidenceNote.trim(), evidenceItems);

    // 2) cerrar misión
    await apiFetch<Mision>(`/api/misiones/${evidenceMissionId}/cumplida`, { method: "PATCH" });
    markOperationStatus(evidenceMissionId, { finalized: true });

    Toast.show({ type: "success", text1: "OK", text2: "Misión cerrada correctamente." });

    // reset modal
    closeEvidenceModal();

    await loadMisiones();
    await loadDashboard();
  } catch (e: any) {
    Toast.show({ type: "error", text1: "Error", text2: e?.message || "No se pudo finalizar" });
  } finally {
    setSavingEvidence(false);
  }
}, [closeEvidenceModal, evidenceChecklist, evidenceMissionId, evidenceNote, evidenceItems, loadDashboard, loadMisiones, loadSyncSummary, markOperationStatus]);

  const alfabotWaveScale1 = alfabotWave1.interpolate({ inputRange: [0, 1], outputRange: [1, 1.45] });
  const alfabotWaveOpacity1 = alfabotWave1.interpolate({ inputRange: [0, 1], outputRange: [0.9, 0] });
  const alfabotWaveScale2 = alfabotWave2.interpolate({ inputRange: [0, 1], outputRange: [1, 1.45] });
  const alfabotWaveOpacity2 = alfabotWave2.interpolate({ inputRange: [0, 1], outputRange: [0.9, 0] });
  const alfabotBasePad = Math.max(insets.bottom, 12) + 20;
  const alfabotKbPad = Math.max(insets.bottom, 8) + Math.max(0, alfabotKeyboardHeight + 8);

  const PANIC_FAB_SIZE = 58;
  const PANIC_FAB_MARGIN = 22;
  const PANIC_POS_KEY = "panicFabPos";
  const panicFabPos = React.useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const [panicFabReady, setPanicFabReady] = useState(false);

  const getDefaultPanicPos = useCallback(() => {
    const { width, height } = Dimensions.get("window");
    const x = Math.max(16, width - PANIC_FAB_SIZE - PANIC_FAB_MARGIN);
    const y = Math.max(16, height - PANIC_FAB_SIZE - (alfabotBasePad + 200));
    return { x, y };
  }, [alfabotBasePad]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(PANIC_POS_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Number.isFinite(parsed?.x) && Number.isFinite(parsed?.y)) {
            panicFabPos.setValue({ x: parsed.x, y: parsed.y });
            if (mounted) setPanicFabReady(true);
            return;
          }
        }
      } catch {}
      const def = getDefaultPanicPos();
      panicFabPos.setValue(def);
      if (mounted) setPanicFabReady(true);
    })();
    return () => {
      mounted = false;
    };
  }, [getDefaultPanicPos, panicFabPos]);

  const panicPanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          const x = (panicFabPos as any).x.__getValue();
          const y = (panicFabPos as any).y.__getValue();
          panicFabPos.setOffset({ x, y });
          panicFabPos.setValue({ x: 0, y: 0 });
        },
        onPanResponderMove: Animated.event([null, { dx: panicFabPos.x, dy: panicFabPos.y }], {
          useNativeDriver: false,
        }),
        onPanResponderRelease: async (_evt, gestureState) => {
          panicFabPos.flattenOffset();
          const moved = Math.abs(gestureState.dx) > 8 || Math.abs(gestureState.dy) > 8;
          if (!moved) {
            triggerPanicAlert();
            return;
          }
          const { width, height } = Dimensions.get("window");
          const minX = 16;
          const minY = 16;
          const maxX = width - PANIC_FAB_SIZE - 16;
          const maxY = height - PANIC_FAB_SIZE - 16;
          const x = Math.min(Math.max((panicFabPos as any).x.__getValue(), minX), maxX);
          const y = Math.min(Math.max((panicFabPos as any).y.__getValue(), minY), maxY);
          panicFabPos.setValue({ x, y });
          try {
            await AsyncStorage.setItem(PANIC_POS_KEY, JSON.stringify({ x, y }));
          } catch {}
        },
      }),
    [panicFabPos, triggerPanicAlert]
  );

  const toggleAlfabot = useCallback(() => {
    setAlfabotOpen((v) => !v);
  }, []);

  const closeAlfabot = useCallback(() => {
    setAlfabotOpen(false);
  }, []);

  const sendAlfabot = useCallback(async () => {
    const text = alfabotDraft.trim();
    if (!text || alfabotLoading) return;
    setAlfabotDraft("");
    setAlfabotMessages((prev) => [
      ...prev,
      { role: "user", text, at: new Date().toISOString() },
    ]);
    setAlfabotLoading(true);

    try {
      const res = await apiFetch<{ ok: boolean; answer?: string }>(
        "/api/alfabot/chat",
        {
          method: "POST",
          body: JSON.stringify({ panel: "piloto", message: text }),
        }
      );
      let msg = String(res?.answer || "No pude generar respuesta en este momento.");
      msg = msg.replace(/^hola\s+.*?,\s*soy\s+alfabot\.\s*/i, "").trim() || msg;
      setAlfabotMessages((prev) => [
        ...prev,
        { role: "bot", text: msg, at: new Date().toISOString() },
      ]);
    } catch (e: any) {
      setAlfabotMessages((prev) => [
        ...prev,
        {
          role: "bot",
          text: "No pude responder ahora. Verifica conexion o sesion activa.",
          at: new Date().toISOString(),
        },
      ]);
    } finally {
      setAlfabotLoading(false);
    }
  }, [alfabotDraft, alfabotLoading]);

  const rawDjiStatus = String(djiStatus?.status || "esperando_dron");
  const getDjiStatusUi = (status: string, _message?: string, hasTelemetry?: boolean) => {
    if (hasTelemetry) {
        return {
          badge: "Telemetría activa",
          message: "El control y la aeronave están enviando datos en vivo.",
          tone: "success" as const,
        };
    }
    switch (status) {
      case "modulo_no_cargado":
        return {
          badge: "Módulo no cargado",
          message: "Este APK no incluye el módulo nativo DJI.",
          tone: "warn" as const,
        };
      case "api_key_missing":
        return {
          badge: "Falta API key",
          message: "Configura la API key DJI antes de compilar el APK.",
          tone: "warn" as const,
        };
      case "registering_sdk":
      case "register_app_called":
      case "registered":
      case "sdk_already_registered":
      case "connecting_product":
      case "starting":
      case "iniciando_sdk":
      case "reintentando_sdk":
        return {
          badge: "Iniciando SDK",
          message: "Registrando el SDK DJI y buscando el control.",
          tone: "info" as const,
        };
      case "waiting_product":
      case "usb_attached":
        return {
          badge: "Esperando control",
          message: "Conecta el control DJI por USB y enciende la aeronave.",
          tone: "info" as const,
        };
      case "product_connected":
      case "product_ready":
      case "flight_controller_listening":
      case "battery_listening":
        return {
          badge: "Control conectado",
          message: "Conexión detectada. Esperando datos de telemetría.",
          tone: "success" as const,
        };
      case "product_disconnected":
      case "usb_detached":
        return {
          badge: "Sin conexión",
          message: "Se perdió la conexión con el control o la aeronave.",
          tone: "warn" as const,
        };
      case "register_failed":
      case "sdk_unavailable":
      case "bind_failed":
      case "flight_controller_failed":
      case "battery_failed":
      case "inicio_fallido":
      case "connection_start_failed":
        return {
          badge: "Error DJI",
          message: "No fue posible iniciar la telemetría DJI.",
          tone: "warn" as const,
        };
      default:
        return {
          badge: status.replace(/_/g, " "),
          message: "Conecta el control y el dron para recibir datos en vivo.",
          tone: "info" as const,
        };
    }
  };
  const djiHasTelemetry = Boolean(telemetry);
  const djiStatusUi = getDjiStatusUi(rawDjiStatus, djiStatus?.message ? String(djiStatus.message) : "", djiHasTelemetry);
  const djiMetric = (value: any, suffix = "", decimals = 1) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return "--";
    return `${n.toFixed(decimals)}${suffix}`;
  };






  /** ===================== UI ===================== */
  return (
    <>
      <StatusBar style="light" translucent />

      {/* ✅ CAMBIO CLAVE: quitamos TouchableWithoutFeedback que estaba bloqueando los toques */}
      <View style={styles.screen}>
        {/* HERO */}
        <LinearGradient
          colors={["#070b0d", "#070b0d"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.hero, { paddingTop: insets.top + 10 }]}
        >
          <View style={styles.heroTop}>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.heroHello}>Hola, {firstName}</Text>
              <Text style={styles.heroSub}>Piloto UAS · Gestión Operacional</Text>
            </View>

            <View style={styles.heroRight}>
              <Pressable
                style={styles.heroIconBtn}
                onPress={() => setShowPilotNotifications(true)}
                accessibilityRole="button"
                accessibilityLabel={`${pilotNotifications.length} notificaciones`}
              >
                <Animated.View style={{ transform: [{ rotate: notificationBellRotate }] }}>
                  <Ionicons
                    name={pilotNotifications.length ? "notifications" : "notifications-outline"}
                    size={23}
                    color="#ffffff"
                  />
                </Animated.View>
                {!!pilotNotifications.length && (
                  <View style={styles.notificationBadge}>
                    <Text style={styles.notificationBadgeText}>
                      {pilotNotifications.length > 9 ? "9+" : pilotNotifications.length}
                    </Text>
                  </View>
                )}
              </Pressable>

              <Pressable
                style={[styles.heroIconBtn, { marginLeft: 10 }]}
                onPress={async () => await onLogout()}
              >
                <MaterialCommunityIcons name="logout" size={20} color="#ffffff" />
              </Pressable>


            </View>
          </View>

          <View style={[styles.bannerCard, isFlyNorthCompany && styles.flyNorthBannerCard]}>
            <Image
              source={
                isFlyNorthCompany
                  ? FLYNORTH_BANNER_LOGO
                  : typeof logoSource === "number"
                  ? logoSource
                  : typeof logoSource === "string"
                  ? { uri: logoSource }
                  : logoSource?.uri
                  ? logoSource
                  : PILOT_PANEL_BANNER_LOGO
              }
              style={[styles.bannerImg, isFlyNorthCompany && styles.flyNorthBannerImg]}
              resizeMode={isFlyNorthCompany ? "contain" : "cover"}
            />
            {!isFlyNorthCompany && (
              <View style={styles.bannerOverlay}>
                <Text style={styles.bannerTitle}>{title}</Text>
                <Text style={styles.bannerText}>Checklist, bitácoras y reportes SMS en un solo lugar.</Text>
              </View>
            )}
          </View>
        </LinearGradient>

        <Modal
          visible={showPilotNotifications}
          transparent
          animationType="fade"
          statusBarTranslucent
          onRequestClose={() => setShowPilotNotifications(false)}
        >
          <Pressable style={styles.notificationOverlay} onPress={() => setShowPilotNotifications(false)}>
            <Pressable style={styles.notificationSheet} onPress={() => {}}>
              <View style={styles.modalHeader}>
                <View>
                  <Text style={styles.modalTitle}>Notificaciones</Text>
                  <Text style={styles.notificationSubtitle}>
                    {pilotNotifications.length
                      ? `${pilotNotifications.length} novedad${pilotNotifications.length === 1 ? "" : "es"} por revisar`
                      : "Todo está al día"}
                  </Text>
                </View>
                <Pressable style={styles.notificationClose} onPress={() => setShowPilotNotifications(false)}>
                  <Ionicons name="close" size={22} color="#111918" />
                </Pressable>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 8 }}>
                {!pilotNotifications.length ? (
                  <View style={styles.notificationEmpty}>
                    <Ionicons name="notifications-off-outline" size={34} color="#7a8b9a" />
                    <Text style={styles.notificationEmptyTitle}>Sin notificaciones</Text>
                    <Text style={styles.notificationEmptyText}>No tienes alertas ni misiones pendientes.</Text>
                  </View>
                ) : (
                  pilotNotifications.map((item) => (
                    <View key={item.id} style={styles.notificationRow}>
                      <View
                        style={[
                          styles.notificationIcon,
                          item.tone === "danger"
                            ? styles.notificationIconDanger
                            : item.tone === "warning"
                              ? styles.notificationIconWarning
                              : styles.notificationIconInfo,
                        ]}
                      >
                        <MaterialCommunityIcons name={item.icon} size={21} color="#ffffff" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.notificationTitle}>{item.title}</Text>
                        <Text style={styles.notificationDetail}>{item.detail}</Text>
                      </View>
                    </View>
                  ))
                )}
              </ScrollView>
            </Pressable>
          </Pressable>
        </Modal>

        {/* CONTENT */}
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={Platform.OS === "ios" ? insets.top : 0}
        >
          <ScrollView
            style={styles.content}
            scrollEnabled={!dashboardMapTouchActive}
            contentContainerStyle={{ paddingBottom: insets.bottom + 180 }}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
            automaticallyAdjustKeyboardInsets
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          >

          {/* USER STRIP */}
          <View style={styles.userStrip}>
            <View style={styles.row}>
              <View style={styles.avatar}>
                {userAvatarUriWithVersion && !avatarLoadError ? (
                  <Image
                    source={{ uri: userAvatarUriWithVersion }}
                    style={styles.avatarImage}
                    onError={() => setAvatarLoadError(true)}
                  />
                ) : (
                  <Text style={styles.avatarText}>{initials}</Text>
                )}
              </View>
              <View>
                <Text style={styles.userName}>{usuario?.nombre || "Piloto UAS"}</Text>
                <Text style={styles.userMeta}>{usuario?.cipu || "—"}</Text>
              </View>
            </View>
          </View>

          {/* Navegación principal movida a barra inferior fija */}

          {loadingDashboard ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator />
              <Text style={styles.muted}>Cargando datos desde la base de datos...</Text>
            </View>
          ) : (
            <>
              {/* DASHBOARD */}
              {section === "dashboard" && (
                <>
                  <View style={styles.airReadyMapCard}>
                    <View style={styles.airSearchBar}>
                      <View style={{ flex: 1, paddingRight: 10 }}>
                        <Text style={styles.airSearchTitle} numberOfLines={1}>
                          {dashboardLocationLabel}
                        </Text>
                        <Text style={styles.airSearchCoords} numberOfLines={1}>
                          LAT: {gpsCell.lat != null ? gpsCell.lat.toFixed(5) : "—"} | LONG: {gpsCell.lon != null ? gpsCell.lon.toFixed(5) : "—"}
                        </Text>
                      </View>
                      <View style={styles.airAvatarShell}>
                        {userAvatarUriWithVersion && !avatarLoadError ? (
                          <Image
                            source={{ uri: userAvatarUriWithVersion }}
                            style={styles.airAvatarImage}
                            onError={() => setAvatarLoadError(true)}
                          />
                        ) : (
                          <Text style={styles.airAvatarText}>{initials}</Text>
                        )}
                      </View>
                    </View>

                    <View style={styles.airMapShell}>
                      <TouchableWithoutFeedback
                        onPressIn={() => setDashboardMapTouchActive(true)}
                        onPressOut={() => setDashboardMapTouchActive(false)}
                      >
                        <View style={{ flex: 1 }}>
                          {dashboardMapHtml ? (
                            <WebView
                              key={`arcgis-imagery-v1-${dashboardMapCenter?.latitude ?? "na"}-${dashboardMapCenter?.longitude ?? "na"}`}
                              originWhitelist={["*"]}
                              source={{ html: dashboardMapHtml }}
                              javaScriptEnabled
                              domStorageEnabled
                              cacheEnabled={false}
                              scrollEnabled={false}
                              nestedScrollEnabled
                            />
                          ) : (
                            <View style={styles.airMapFallback}>
                              <MaterialCommunityIcons name="map-marker-off-outline" size={26} color="#6b7a8a" />
                              <Text style={styles.muted}>Esperando ubicación para cargar el mapa.</Text>
                            </View>
                          )}
                        </View>
                      </TouchableWithoutFeedback>

                      <View style={styles.airMapTopLeft}>
                        <Text style={styles.airMapBadgeText}>ArcGIS · Satélite</Text>
                      </View>

                      <Pressable
                        style={styles.airMapTopRight}
                        onPress={() => {
                          if (gpsCell.lat != null && gpsCell.lon != null) {
                            lastGoodGpsRef.current = { lat: gpsCell.lat, lon: gpsCell.lon };
                          }
                          setDashboardMapCenterTick((prev) => prev + 1);
                          loadGpsAndWeather().catch(() => {});
                        }}
                      >
                        <Ionicons name="locate" size={18} color="#ffffff" />
                      </Pressable>
                    </View>
                  </View>

                  <View style={styles.airConditionsSheet}>
                    <View style={styles.airSheetHandle} />
                    <Text style={styles.airSectionEyebrow}>Condiciones</Text>

                    <View style={styles.airConditionsHeader}>
                      <Pressable
                        style={[styles.airRoundIcon, selectedForecastDayIndex <= 0 && styles.airRoundIconDisabled]}
                        disabled={selectedForecastDayIndex <= 0}
                        onPress={() => setSelectedForecastDayIndex((prev) => Math.max(0, prev - 1))}
                      >
                        <Ionicons name="arrow-back" size={16} color="#334155" />
                      </Pressable>
                      <View style={{ alignItems: "center", flex: 1 }}>
                        <Text style={styles.airConditionsDay}>
                          {selectedForecastDate.toLocaleDateString("es-CO", { weekday: "long" })}
                        </Text>
                        <Text style={styles.airConditionsDate}>
                          {selectedForecastDate.toLocaleDateString("es-CO", { month: "long", day: "numeric" })}
                        </Text>
                      </View>
                      <Pressable
                        style={[
                          styles.airRoundIcon,
                          selectedForecastDayIndex >= forecastDayCount - 1 && styles.airRoundIconDisabled,
                        ]}
                        disabled={selectedForecastDayIndex >= forecastDayCount - 1}
                        onPress={() =>
                          setSelectedForecastDayIndex((prev) => Math.min(forecastDayCount - 1, prev + 1))
                        }
                      >
                        <Ionicons name="arrow-forward" size={16} color="#334155" />
                      </Pressable>
                    </View>

                    {dashboardForecastRows.map((row) => (
                      <Pressable key={row.key} style={styles.airConditionRow} onPress={() => toggleForecastKey(row.key)}>
                        <View
                          style={[
                            styles.airConditionTimePill,
                            row.flightState === "APTAS"
                              ? styles.airConditionTimePillGood
                              : row.flightState === "MARGINALES"
                              ? styles.airConditionTimePillWarn
                              : styles.airConditionTimePillBad,
                          ]}
                        >
                          <Text style={styles.airConditionTimeText}>{row.timeLabel}</Text>
                        </View>
                        <View style={{ flex: 1, paddingHorizontal: 12 }}>
                          <Text style={styles.airConditionMain}>
                            Probabilidad de lluvia {row.precipProbPct != null ? `${Math.round(row.precipProbPct)}%` : "—"}
                          </Text>
                          {expandedForecastKeys.includes(row.key) ? (
                            <Text style={styles.airConditionSub}>
                              {row.satVisibleEst != null ? `${row.satVisibleEst} satélites visibles` : "Satélites sin dato"} · base nube {toFeetLabel(row.cloudBaseM)} · {weatherDetail.label || "Sin dato"}
                            </Text>
                          ) : null}
                        </View>
                        <Ionicons
                          name={expandedForecastKeys.includes(row.key) ? "chevron-up" : "chevron-down"}
                          size={18}
                          color="#64748b"
                        />
                      </Pressable>
                    ))}
                  </View>

                  <Pressable
                    style={styles.screenBroadcastCard}
                    onPress={() => navigation.navigate("ScreenBroadcast")}
                  >
                    <View style={styles.screenBroadcastIcon}>
                      <MaterialCommunityIcons name="broadcast" size={26} color="#ffffff" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.screenBroadcastTitle}>Transmitir pantalla</Text>
                      <Text style={styles.screenBroadcastText}>Emisión en vivo desde un control DJI RC Plus</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={22} color="#0799c1" />
                  </Pressable>

                  {false && (
                  <View style={styles.card}>
                    <View style={styles.rowBetween}>
                      <View>
                        <Text style={styles.cardTitle}>Telemetria DJI</Text>
                        <Text style={styles.muted}>
                          {djiStatusUi.message}
                        </Text>
                        {djiStatus?.message ? (
                          <Text style={styles.djiStatusDetail}>
                            {String(djiStatus.message)}
                          </Text>
                        ) : null}
                      </View>
                      <View
                        style={[
                          styles.statusBadge,
                          djiStatusUi.tone === "success"
                            ? styles.statusBadgeSuccess
                            : djiStatusUi.tone === "warn"
                            ? styles.statusBadgeWarn
                            : styles.statusBadgeInfo,
                        ]}
                      >
                        <Text style={styles.statusBadgeText}>{djiStatusUi.badge}</Text>
                      </View>
                    </View>
                    <View style={styles.djiActionsRow}>
                      <Pressable
                        style={[styles.btnMini, djiActionBusy && styles.paginationBtnDisabled]}
                        disabled={djiActionBusy}
                        onPress={() => startDjiTelemetry(true)}
                      >
                        <Text style={styles.btnMiniText}>
                          {djiActionBusy ? "Buscando..." : "Buscar o reconectar"}
                        </Text>
                      </Pressable>
                    </View>
                    <View style={styles.kpiDeck}>
                      <View style={styles.kpiTile}>
                        <Text style={styles.kpiTileValue}>{djiMetric(telemetry?.batteryPercent, "%", 0)}</Text>
                        <Text style={styles.kpiTileLabel}>Bateria</Text>
                      </View>
                      <View style={styles.kpiTile}>
                        <Text style={styles.kpiTileValue}>{djiMetric(telemetry?.altitude, " m", 1)}</Text>
                        <Text style={styles.kpiTileLabel}>Altitud</Text>
                      </View>
                      <View style={styles.kpiTile}>
                        <Text style={styles.kpiTileValue}>{djiMetric(telemetry?.speed, " m/s", 1)}</Text>
                        <Text style={styles.kpiTileLabel}>Velocidad</Text>
                      </View>
                      <View style={styles.kpiTile}>
                        <Text style={[styles.kpiTileValue, { fontSize: 14 }]}>
                          {Number.isFinite(Number(telemetry?.lat)) && Number.isFinite(Number(telemetry?.lng))
                            ? `${Number(telemetry.lat).toFixed(5)}, ${Number(telemetry.lng).toFixed(5)}`
                            : "--"}
                        </Text>
                        <Text style={styles.kpiTileLabel}>GPS</Text>
                      </View>
                    </View>
                  </View>
                  )}

                  {false && activeMission ? (
                    <View style={styles.card}>
                      <View style={styles.rowBetween}>
                        <View>
                          <Text style={styles.cardTitle}>Operación activa</Text>
                          <Text style={styles.muted}>{activeMission.titulo || "Misión"} · {formatDateOnly(activeMission.fechaOperacion)}</Text>
                        </View>
                        <Pressable style={styles.btnMini} onPress={() => setSection("missions")}>
                          <Text style={styles.btnMiniText}>Ver misión</Text>
                        </Pressable>
                      </View>

                      <View style={styles.timelineWrap}>
                        <View style={styles.timelineHeader}>
                          <Text style={styles.kLabel}>Progreso operativo</Text>
                          <Text style={styles.kValue}>{missionProgress}%</Text>
                        </View>
                        <View style={styles.timelineBar}>
                          <View style={[styles.timelineBarFill, { width: `${missionProgress}%` }]} />
                        </View>
                        {missionTimeline.map((step) => (
                          <View key={step.key} style={styles.timelineItem}>
                            <View style={[styles.timelineDot, step.done && styles.timelineDotDone]} />
                            <Text style={[styles.timelineText, step.done && styles.timelineTextDone]}>{step.label}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  ) : null}

                  {false && (
                    <>
                  <Text style={styles.sectionTitle}>Acciones rápidas</Text>

                  <View style={styles.grid}>
                    <QuickCard
                      icon="pen"
                      title="Nuevo Reporte SMS"
                      subtitle="Reportar incidente u observación"
                      onPress={() => {
                        setRepClase("SMS");
                        setSection("new-report");
                        setRepFormOpen(true);
                      }}
                    />
                    <QuickCard icon="airplane" title="Registrar Vuelo" subtitle="Documentar operación" onPress={() => setShowNewFlightModal(true)} />
                    <QuickCard icon="file-document-outline" title="Procedimientos" subtitle="Manuales y checklist" onPress={() => setSection("procedures")} />
                    <QuickCard icon="map-marker-path" title="Misiones" subtitle="Misiones asignadas" onPress={() => setSection("missions")} dot={misionesPendientes > 0} />
                  </View>

                    <View style={styles.card}>
                      <Text style={styles.cardTitle}>Resumen operativo</Text>
                      <View style={styles.kpiDeck}>
                        <View style={styles.kpiTile}>
                          <Text style={styles.kpiTileValue}>{misiones.filter((m) => sameDay(m.fechaOperacion)).length}</Text>
                          <Text style={styles.kpiTileLabel}>Misiones de hoy</Text>
                        </View>
                        <View style={styles.kpiTile}>
                          <Text style={styles.kpiTileValue}>{vuelosDelMes.length}</Text>
                          <Text style={styles.kpiTileLabel}>Vuelos del mes</Text>
                        </View>
                        <View style={styles.kpiTile}>
                          <Text style={styles.kpiTileValue}>{horasAcumuladas.toFixed(1)} h</Text>
                          <Text style={styles.kpiTileLabel}>Horas acumuladas</Text>
                        </View>
                        <View style={styles.kpiTile}>
                          <Text style={styles.kpiTileValue}>{procedimientosPendientes}</Text>
                          <Text style={styles.kpiTileLabel}>Procedimientos pendientes</Text>
                        </View>
                        <View style={styles.kpiTile}>
                          <Text style={styles.kpiTileValue}>{alertas.length}</Text>
                          <Text style={styles.kpiTileLabel}>Alertas críticas</Text>
                        </View>
                        <View style={styles.kpiTile}>
                          <Text style={styles.kpiTileValue}>{logsPendientes}</Text>
                          <Text style={styles.kpiTileLabel}>Logs pendientes</Text>
                        </View>
                      </View>
                    </View>

                  <View style={styles.card}>
                    <Text style={styles.cardTitle}>KPIs de pilotaje</Text>
                    <View style={styles.kpiDeck}>
                      <View style={styles.kpiTile}>
                        <Text style={styles.kpiTileValue}>{horasHoy.toFixed(1)} h</Text>
                        <Text style={styles.kpiTileLabel}>Horas hoy</Text>
                      </View>
                      <View style={styles.kpiTile}>
                        <Text style={styles.kpiTileValue}>{horasSemana.toFixed(1)} h</Text>
                        <Text style={styles.kpiTileLabel}>Horas semana</Text>
                      </View>
                      <View style={styles.kpiTile}>
                        <Text style={styles.kpiTileValue}>{horasDelMes.toFixed(1)} h</Text>
                        <Text style={styles.kpiTileLabel}>Horas mes</Text>
                      </View>
                      <View style={styles.kpiTile}>
                        <Text style={styles.kpiTileValue}>{tasaIncidentesMes.toFixed(1)}%</Text>
                        <Text style={styles.kpiTileLabel}>Tasa incidentes</Text>
                      </View>
                      <View style={styles.kpiTile}>
                        <Text style={styles.kpiTileValue}>{cumplimientoChecklist.toFixed(0)}%</Text>
                        <Text style={styles.kpiTileLabel}>Cumplimiento checklist</Text>
                      </View>
                      <View style={styles.kpiTile}>
                        <Text style={styles.kpiTileValue}>{puntualidadMisiones.toFixed(0)}%</Text>
                        <Text style={styles.kpiTileLabel}>Puntualidad misiones</Text>
                      </View>
                    </View>
                  </View>

                  {/* DATOS OPERACIONALES */}
                  <View style={styles.card}>
                    <Text style={styles.cardTitle}>Datos operacionales</Text>
                    <View style={styles.kvRow}>
                      <KVP
                        label="Certificado médico"
                        value={usuario?.fechaCertificado ? String(usuario.fechaCertificado).slice(0, 10) : "—"}
                        icon="calendar"
                        valueStyle={{ color: certStatus.color }}
                      />

                      <KVP label="CIPU" value={usuario?.cipu || "—"} icon="card-account-details-outline" />
                    </View>

                    <View style={{ marginTop: 10 }}>
                      <Text style={styles.kLabel}>Adiciones</Text>
                      {usuario?.adiciones?.length ? (
                        usuario.adiciones.map((a, idx) => (
                          <View key={idx} style={styles.bulletRow}>
                            <View style={styles.bullet} />
                            <Text style={styles.bulletText}>{a}</Text>
                          </View>
                        ))
                      ) : (
                        <Text style={styles.muted}>—</Text>
                      )}
                    </View>
                  </View>

                  <View style={styles.card}>
                    <Text style={styles.cardTitle}>Certificaciones para operación en campo</Text>
                    <Text style={[styles.muted, { marginBottom: 12 }]}>
                      Disponible para pilotos y jefes de pilotos. La vigencia operacional del CIPU depende del certificado médico.
                    </Text>

                    <View style={styles.fieldDocCard}>
                      <View style={styles.rowBetween}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.fieldDocTitle}>Certificado médico</Text>
                          <Text style={styles.fieldDocMeta}>
                            {usuario?.documentosCampo?.certificadoMedico?.name || "Sin archivo"}
                          </Text>
                        </View>
                        <View style={[styles.missionRelationBadge, certStatus.label === "Vigente" ? styles.missionApprovalApproved : styles.missionApprovalPending]}>
                          <Text style={styles.missionRelationText}>{certStatus.label}</Text>
                        </View>
                      </View>
                      <View style={[styles.row, { marginTop: 10 }]}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.kLabel}>Fecha de inicio</Text>
                          <Pressable
                            style={[styles.input, styles.datePressable]}
                            onPress={() => openMedicalDatePicker("start")}
                          >
                            <Text style={{ color: medicalCertificateStart ? "#1b2b3a" : "#8a96a3", flex: 1 }}>
                              {medicalCertificateStart || "Seleccionar fecha"}
                            </Text>
                            <Ionicons name="calendar-outline" size={18} color="#111918" />
                          </Pressable>
                          {Platform.OS === "ios" && showMedicalStartDate ? (
                            <DateTimePicker
                              value={dateFromYmd(medicalCertificateStart)}
                              mode="date"
                              display={Platform.OS === "ios" ? "compact" : "default"}
                              onChange={(event: DateTimePickerEvent, selected?: Date) => {
                                setShowMedicalStartDate(false);
                                if (event.type === "dismissed" || !selected) return;
                                setMedicalCertificateStart(formatDateOnly(selected));
                              }}
                            />
                          ) : null}
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.kLabel}>Fecha de vencimiento</Text>
                          <Pressable
                            style={[styles.input, styles.datePressable]}
                            onPress={() => openMedicalDatePicker("end")}
                          >
                            <Text style={{ color: medicalCertificateEnd ? "#1b2b3a" : "#8a96a3", flex: 1 }}>
                              {medicalCertificateEnd || "Seleccionar fecha"}
                            </Text>
                            <Ionicons name="calendar-outline" size={18} color="#111918" />
                          </Pressable>
                          {Platform.OS === "ios" && showMedicalEndDate ? (
                            <DateTimePicker
                              value={dateFromYmd(medicalCertificateEnd || medicalCertificateStart)}
                              minimumDate={medicalCertificateStart ? dateFromYmd(medicalCertificateStart) : undefined}
                              mode="date"
                              display={Platform.OS === "ios" ? "compact" : "default"}
                              onChange={(event: DateTimePickerEvent, selected?: Date) => {
                                setShowMedicalEndDate(false);
                                if (event.type === "dismissed" || !selected) return;
                                setMedicalCertificateEnd(formatDateOnly(selected));
                              }}
                            />
                          ) : null}
                        </View>
                      </View>
                      <View style={styles.fieldDocActions}>
                        <Pressable style={styles.btnPrimary} disabled={!!fieldDocumentBusy} onPress={() => uploadFieldDocument("certificadoMedico")}>
                          {fieldDocumentBusy === "certificadoMedico" ? <ActivityIndicator color="#fff" /> : <Ionicons name="cloud-upload-outline" size={16} color="#fff" />}
                          <Text style={styles.btnPrimaryText}>Cargar certificado</Text>
                        </Pressable>
                        {usuario?.documentosCampo?.certificadoMedico?.key ? (
                          <Pressable style={styles.btnOutline} onPress={() => openFieldDocument("certificadoMedico")}>
                            <Text style={styles.btnOutlineText}>Ver</Text>
                          </Pressable>
                        ) : null}
                      </View>
                    </View>

                    {([
                      { type: "cipu" as const, title: "CIPU", icon: "card-account-details-outline" as const },
                      { type: "arl" as const, title: "ARL", icon: "shield-account-outline" as const },
                    ]).map((item) => {
                      const document = usuario?.documentosCampo?.[item.type];
                      const cipuOperational =
                        item.type !== "cipu" ||
                        (certStatus.label !== "Vencido" && certStatus.label !== "—");
                      return (
                        <View key={item.type} style={styles.fieldDocCard}>
                          <View style={styles.rowBetween}>
                            <View style={styles.fieldDocHeading}>
                              <MaterialCommunityIcons name={item.icon} size={20} color="#111918" />
                              <View style={{ flex: 1 }}>
                                <Text style={styles.fieldDocTitle}>{item.title}</Text>
                                <Text style={styles.fieldDocMeta}>{document?.name || "Sin archivo"}</Text>
                              </View>
                            </View>
                            <View style={[styles.missionRelationBadge, document?.key && cipuOperational ? styles.missionApprovalApproved : styles.missionApprovalPending]}>
                              <Text style={styles.missionRelationText}>
                                {!document?.key ? "Pendiente" : cipuOperational ? "Disponible" : "Médico vencido"}
                              </Text>
                            </View>
                          </View>
                          {item.type === "cipu" && document?.key && !cipuOperational ? (
                            <Text style={styles.warningInline}>El CIPU no figura vigente para campo mientras el certificado médico esté vencido.</Text>
                          ) : null}
                          <View style={styles.fieldDocActions}>
                            <Pressable style={styles.btnPrimary} disabled={!!fieldDocumentBusy} onPress={() => uploadFieldDocument(item.type)}>
                              {fieldDocumentBusy === item.type ? <ActivityIndicator color="#fff" /> : <Ionicons name="cloud-upload-outline" size={16} color="#fff" />}
                              <Text style={styles.btnPrimaryText}>Cargar {item.title}</Text>
                            </Pressable>
                            {document?.key ? (
                              <Pressable style={styles.btnOutline} onPress={() => openFieldDocument(item.type)}>
                                <Text style={styles.btnOutlineText}>Ver</Text>
                              </Pressable>
                            ) : null}
                          </View>
                        </View>
                      );
                    })}
                  </View>

                  <View style={styles.card}>
                    <Text style={styles.cardTitle}>Perfil del piloto</Text>
                    <View style={styles.kvRow}>
                      <KVP label="Documento" value={usuario?.documento || "—"} icon="card-bulleted-outline" />
                      <KVP label="Certificado" value={certStatus.label} icon="medical-bag" valueStyle={{ color: certStatus.color }} />
                    </View>
                    <View style={styles.kvRow}>
                      <KVP label="Horas acumuladas" value={`${horasAcumuladas.toFixed(1)} h`} icon="clock-outline" />
                      <KVP label="Última misión" value={misiones[0]?.titulo || "—"} icon="map-marker-check-outline" />
                    </View>
                    <View style={{ marginTop: 10 }}>
                      <Text style={styles.kLabel}>Alertas de vencimiento</Text>
                      <Text style={styles.muted}>
                        {certStatus.label === "Vigente" ? "Sin alertas críticas de perfil." : "Tu certificado requiere revisión prioritaria."}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.card}>
                    <Text style={styles.cardTitle}>Resumen Documental</Text>
                    {legalSummary.map((item) => {
                      const pr = legalPriority(item.days);
                      return (
                        <View key={item.key} style={styles.legalRow}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.summaryLabel}>{item.title}</Text>
                            <Text style={styles.muted}>Vence: {item.date}</Text>
                          </View>
                          <View style={{ alignItems: "flex-end" }}>
                            <Text style={[styles.summaryValue, { color: pr.color }]}>{formatDaysStatus(item.days)}</Text>
                            <Text style={[styles.kLabel, { color: pr.color }]}>Prioridad {pr.label}</Text>
                          </View>
                        </View>
                      );
                    })}
                  </View>

                  <View style={styles.card}>
                    <View style={styles.rowBetween}>
                      <Text style={styles.cardTitle}>Sincronización</Text>
                      <View style={[styles.statusBadge, isOnline ? styles.statusBadgeInfo : styles.statusBadgeWarn]}>
                        <Text style={styles.statusBadgeText}>{isOnline ? "Online" : "Offline"}</Text>
                      </View>
                    </View>
                    <View style={styles.syncGrid}>
                      <View style={styles.syncCard}>
                        <Text style={styles.syncValue}>{syncSummary.vuelos}</Text>
                        <Text style={styles.syncLabel}>Vuelos pendientes</Text>
                      </View>
                      <View style={styles.syncCard}>
                        <Text style={styles.syncValue}>{syncSummary.logs}</Text>
                        <Text style={styles.syncLabel}>Logs pendientes</Text>
                      </View>
                      <View style={styles.syncCard}>
                        <Text style={styles.syncValue}>{syncSummary.reportes}</Text>
                        <Text style={styles.syncLabel}>Reportes sin enviar</Text>
                      </View>
                      <View style={styles.syncCard}>
                        <Text style={styles.syncValue}>{syncSummary.procedimientos + syncSummary.misiones}</Text>
                        <Text style={styles.syncLabel}>Otros pendientes</Text>
                      </View>
                    </View>
                  </View>

                    </>
                  )}
                </>
              )}

              {section === "chief-management" && isChiefPilotRole && (
                <ChiefManagementScreen
                  embedded
                  onNavigate={(nextSection, moduleKey) => {
                    if (nextSection === "equipos-uas") {
                      setEquiposViewMode(moduleKey === "hours" ? "hours" : "fleet");
                    }
                    goSection(nextSection as Section);
                  }}
                />
              )}

              {section === "ops-summary" && (
                <>
                    <View style={styles.card}>
                      <Text style={styles.cardTitle}>Resumen operativo</Text>
                      <View style={styles.kpiDeck}>
                        <View style={styles.kpiTile}>
                          <Text style={styles.kpiTileValue}>{misiones.filter((m) => sameDay(m.fechaOperacion)).length}</Text>
                          <Text style={styles.kpiTileLabel}>Misiones de hoy</Text>
                        </View>
                        <View style={styles.kpiTile}>
                          <Text style={styles.kpiTileValue}>{vuelosDelMes.length}</Text>
                          <Text style={styles.kpiTileLabel}>Vuelos del mes</Text>
                        </View>
                        
                        <View style={styles.kpiTile}>
                          <Text style={styles.kpiTileValue}>{horasAcumuladas.toFixed(1)} h</Text>
                          <Text style={styles.kpiTileLabel}>Horas acumuladas</Text>
                        </View>
                        <View style={styles.kpiTile}>
                          <Text style={styles.kpiTileValue}>{procedimientosPendientes}</Text>
                          <Text style={styles.kpiTileLabel}>Procedimientos pendientes</Text>
                        </View>
                        <View style={styles.kpiTile}>
                          <Text style={styles.kpiTileValue}>{alertas.length}</Text>
                          <Text style={styles.kpiTileLabel}>Alertas críticas</Text>
                        </View>
                        <View style={styles.kpiTile}>
                          <Text style={styles.kpiTileValue}>{logsPendientes}</Text>
                          <Text style={styles.kpiTileLabel}>Logs pendientes</Text>
                        </View>
                      </View>
                    </View>

                  <View style={styles.card}>
                    <Text style={styles.cardTitle}>KPIs de pilotaje</Text>
                    <View style={styles.kpiDeck}>
                      <View style={styles.kpiTile}>
                        <Text style={styles.kpiTileValue}>{horasHoy.toFixed(1)} h</Text>
                        <Text style={styles.kpiTileLabel}>Horas hoy</Text>
                      </View>
                      <View style={styles.kpiTile}>
                        <Text style={styles.kpiTileValue}>{horasSemana.toFixed(1)} h</Text>
                        <Text style={styles.kpiTileLabel}>Horas semana</Text>
                      </View>
                      <View style={styles.kpiTile}>
                        <Text style={styles.kpiTileValue}>{horasDelMes.toFixed(1)} h</Text>
                        <Text style={styles.kpiTileLabel}>Horas mes</Text>
                      </View>
                      <View style={styles.kpiTile}>
                        <Text style={styles.kpiTileValue}>{tasaIncidentesMes.toFixed(1)}%</Text>
                        <Text style={styles.kpiTileLabel}>Tasa incidentes</Text>
                      </View>
                      <View style={styles.kpiTile}>
                        <Text style={styles.kpiTileValue}>{cumplimientoChecklist.toFixed(0)}%</Text>
                        <Text style={styles.kpiTileLabel}>Cumplimiento checklist</Text>
                      </View>
                      <View style={styles.kpiTile}>
                        <Text style={styles.kpiTileValue}>{puntualidadMisiones.toFixed(0)}%</Text>
                        <Text style={styles.kpiTileLabel}>Puntualidad misiones</Text>
                      </View>
                    </View>
                  </View>
                </>
              )}

              {section === "equipos-uas" && (
                <>
                  <View style={styles.card}>
                    <View style={styles.rowBetween}>
                      <View style={{ flex: 1, paddingRight: 10 }}>
                        <Text style={styles.cardTitle}>
                          {equiposViewMode === "hours" ? "Control de horas UAS" : "Flota registrada"}
                        </Text>
                        <Text style={styles.muted}>
                          {equiposViewMode === "hours"
                            ? "Consulta las horas acumuladas y la proximidad del mantenimiento de cada aeronave."
                            : "Aquí ves los drones de la empresa a la que estás vinculado y que están disponibles para operación."}
                        </Text>
                      </View>
                      <View style={{ alignItems: "flex-end" }}>
                        {isChiefPilotRole && equiposViewMode === "fleet" ? (
                          <Pressable style={styles.btnPrimary} onPress={() => resetEquipoForm(null)}>
                            <Ionicons name="add" size={17} color="#fff" />
                            <Text style={styles.btnPrimaryText}>Nuevo UAS</Text>
                          </Pressable>
                        ) : null}
                        <Pressable style={[styles.btnOutline, { marginTop: isChiefPilotRole && equiposViewMode === "fleet" ? 8 : 0 }]} onPress={() => loadEquipos()}>
                          <Ionicons name="refresh" size={16} color="#111918" />
                          <Text style={styles.btnOutlineText}>Actualizar</Text>
                        </Pressable>
                      </View>
                    </View>

                    {loadingEquipos ? (
                      <View style={styles.equiposStateBox}>
                        <ActivityIndicator />
                        <Text style={styles.muted}>Cargando equipos UAS...</Text>
                      </View>
                    ) : equipos.length === 0 ? (
                      <View style={styles.equiposStateBox}>
                        <MaterialCommunityIcons name="drone" size={24} color="#8a96a3" />
                        <Text style={styles.muted}>
                          {equiposError || "No hay drones operativos registrados para esta empresa."}
                        </Text>
                      </View>
                    ) : (
                      <View style={styles.equiposDeck}>
                        {equipos.map((equipo) => (
                          <View key={equipo._id} style={styles.equipoCardUas}>
                            <View style={styles.equipoCardMedia}>
                              {equipo.fotoUrl ? (
                                <Image
                                  source={{ uri: equipo.fotoUrl }}
                                  style={styles.equipoCardImage}
                                />
                              ) : (
                                <View style={styles.equipoCardPlaceholder}>
                                  <MaterialCommunityIcons name="drone" size={34} color="#1b2b3a" />
                                </View>
                              )}
                            </View>

                            <View style={styles.equipoCardBody}>
                              <View style={styles.rowBetween}>
                                <View style={{ flex: 1, paddingRight: 10 }}>
                                  <Text style={styles.equipoCardTitle} numberOfLines={2}>
                                    {equipo.modelo || "Equipo UAS"}
                                  </Text>
                                  <Text style={styles.equipoCardTag}>
                                    {equipo.ruas || "Sin RUAS"}
                                  </Text>
                                </View>
                                {equiposViewMode === "fleet" ? (
                                  <View style={styles.equipoCardBadge}>
                                    <Text style={styles.equipoCardBadgeText}>
                                      {equipo.estado || "Operativo"}
                                    </Text>
                                  </View>
                                ) : null}
                              </View>

                              {equiposViewMode === "fleet" ? <View style={styles.equipoCardMetaGrid}>
                                <View style={styles.equipoCardMetaItem}>
                                  <Text style={styles.equipoCardMetaLabel}>Serie</Text>
                                  <Text style={styles.equipoCardMetaValue}>
                                    {equipo.serie || "Sin dato"}
                                  </Text>
                                </View>
                                <View style={styles.equipoCardMetaItem}>
                                  <Text style={styles.equipoCardMetaLabel}>Horas</Text>
                                  <Text style={styles.equipoCardMetaValue}>
                                    {Number.isFinite(Number(equipo.horasVuelo))
                                      ? `${Number(equipo.horasVuelo).toFixed(1)} h`
                                      : "Sin dato"}
                                  </Text>
                                </View>
                              </View> : null}
                              {equiposViewMode === "fleet" ? (
                                <View style={styles.uasOperationalDetails}>
                                  <View style={styles.rowBetween}>
                                    <View>
                                      <Text style={styles.equipoCardMetaLabel}>Póliza</Text>
                                      <Text style={styles.equipoCardMetaValue}>
                                        {equipo.polizaPdf?.key ? equipo.polizaPdf?.name || "Cargada" : "—"}
                                      </Text>
                                    </View>
                                    <View style={[
                                      styles.hoursStatusBadge,
                                      { backgroundColor: equipo.polizaPdf?.key ? "#dcfce7" : "#eef2f6" },
                                    ]}>
                                      <Text style={[
                                        styles.hoursStatusText,
                                        { color: equipo.polizaPdf?.key ? "#15803d" : "#334155" },
                                      ]}>
                                        {equipo.polizaPdf?.key ? "Con póliza" : "Sin póliza"}
                                      </Text>
                                    </View>
                                  </View>
                                  <Text style={styles.uasValidityText}>
                                    Vigencia: {equipo.polizaVigencia ? formatDateOnly(equipo.polizaVigencia) : "—"} · Vence: {equipo.polizaVence ? formatDateOnly(equipo.polizaVence) : "—"}
                                  </Text>

                                  <Pressable
                                    style={[styles.btnOutline, { alignSelf: "flex-start", marginTop: 9 }]}
                                    onPress={() => setExpandedEquipoIds((prev) => ({ ...prev, [equipo._id]: prev[equipo._id] === false }))}
                                  >
                                    <Ionicons name={expandedEquipoIds[equipo._id] === false ? "chevron-down" : "chevron-up"} size={17} color="#111918" />
                                    <Text style={styles.btnOutlineText}>{expandedEquipoIds[equipo._id] === false ? "Mostrar" : "Ocultar"}</Text>
                                  </Pressable>

                                  {expandedEquipoIds[equipo._id] !== false ? (
                                    <View style={styles.uasActionStack}>
                                      <Pressable style={styles.uasWideAction} onPress={() => openBatteryFormForEquipo(equipo)}>
                                        <Ionicons name="battery-charging-outline" size={17} color="#111918" />
                                        <Text style={styles.uasWideActionText}>Registrar Batería</Text>
                                      </Pressable>
                                      <Pressable style={styles.uasWideAction} onPress={() => openEquipoDocument(equipo, "poliza")}>
                                        <Ionicons name="download-outline" size={17} color="#111918" />
                                        <Text style={styles.uasWideActionText}>Descargar póliza</Text>
                                      </Pressable>
                                      <Pressable style={styles.uasWideAction} onPress={() => openEquipoDocument(equipo, "ruas")}>
                                        <Ionicons name="download-outline" size={17} color="#111918" />
                                        <Text style={styles.uasWideActionText}>Descargar RUAS</Text>
                                      </Pressable>
                                      <Pressable
                                        style={styles.uasWideAction}
                                        onPress={() => {
                                          const url = String(equipo.manualUsuarioLink || "").trim();
                                          if (!url) {
                                            Toast.show({ type: "info", text1: "Manual no disponible", text2: "Registra el enlace desde Editar UAS." });
                                            return;
                                          }
                                          Linking.openURL(url).catch(() => Toast.show({ type: "error", text1: "No se pudo abrir el manual" }));
                                        }}
                                      >
                                        <Ionicons name="link-outline" size={17} color="#111918" />
                                        <Text style={styles.uasWideActionText}>Abrir manual</Text>
                                      </Pressable>
                                    </View>
                                  ) : null}
                                </View>
                              ) : null}
                              {equiposViewMode === "hours" ? (() => {
                                const metrics = getMaintenanceMetrics(equipo);
                                const tone =
                                  metrics.estado === "VENCIDO"
                                    ? { bg: "#fee2e2", fg: "#b91c1c", label: "VENCIDO" }
                                    : metrics.estado === "PRONTO"
                                      ? { bg: "#ffedd5", fg: "#c2410c", label: "PRONTO" }
                                      : { bg: "#dcfce7", fg: "#15803d", label: "OK" };
                                const config = maintenanceConfigMap[equipo._id] || {
                                  intervaloHoras: String(equipo.mantIntervaloHoras ?? 250),
                                  umbralAviso: String(equipo.mantUmbralAviso ?? 25),
                                  ultimaMantHoras: String(equipo.mantUltimaHora ?? 0),
                                };
                                return (
                                  <View style={styles.hoursControlBlock}>
                                    <Text style={styles.hoursSeries}>Serie: {equipo.serie || "—"}</Text>
                                    <View style={[styles.rowBetween, { marginTop: 13 }]}>
                                      <Text style={styles.hoursCurrent}>Horas actuales: <Text style={styles.hoursStrong}>{metrics.actuales.toFixed(1)}</Text></Text>
                                      <View style={[styles.hoursStatusBadge, { backgroundColor: tone.bg }]}>
                                        <Text style={[styles.hoursStatusText, { color: tone.fg }]}>{tone.label}</Text>
                                      </View>
                                    </View>

                                    <View style={[styles.equipoCardMetaGrid, { marginTop: 14 }]}>
                                      <View style={styles.equipoCardMetaItem}>
                                        <Text style={styles.equipoCardMetaLabel}>Próximo mant.</Text>
                                        <Text style={styles.hoursMetricValue}>{metrics.proximo.toFixed(0)} h</Text>
                                      </View>
                                      <View style={styles.equipoCardMetaItem}>
                                        <Text style={styles.equipoCardMetaLabel}>Faltan</Text>
                                        <Text style={styles.hoursMetricValue}>{metrics.restantes.toFixed(1)} h</Text>
                                      </View>
                                    </View>

                                    <View style={styles.hoursInputsRow}>
                                      {([
                                        ["intervaloHoras", "Cambio cada (h)"],
                                        ["umbralAviso", "Avisar faltando (h)"],
                                      ] as const).map(([field, label], index) => (
                                        <View key={field} style={[styles.hoursInputColumn, index === 0 && { marginRight: 8 }]}>
                                          <Text style={styles.equipoCardMetaLabel}>{label}</Text>
                                          <TextInput
                                            value={config[field]}
                                            onChangeText={(value) => setMaintenanceConfigMap((prev) => ({
                                              ...prev,
                                              [equipo._id]: { ...config, [field]: value },
                                            }))}
                                            keyboardType="decimal-pad"
                                            style={[styles.input, { marginTop: 5 }]}
                                            placeholder="0"
                                            placeholderTextColor="#8c9aaa"
                                          />
                                        </View>
                                      ))}
                                    </View>

                                    <View style={{ marginTop: 9 }}>
                                      <Text style={styles.equipoCardMetaLabel}>Último mantenimiento (a las h)</Text>
                                      <TextInput
                                        value={config.ultimaMantHoras}
                                        onChangeText={(value) => setMaintenanceConfigMap((prev) => ({
                                          ...prev,
                                          [equipo._id]: { ...config, ultimaMantHoras: value },
                                        }))}
                                        keyboardType="decimal-pad"
                                        style={[styles.input, { marginTop: 5 }]}
                                        placeholder="0"
                                        placeholderTextColor="#8c9aaa"
                                      />
                                    </View>

                                    <View style={{ flexDirection: "row", marginTop: 12 }}>
                                      <Pressable
                                        style={[styles.btnOutline, { flex: 1, justifyContent: "center", marginRight: 8 }]}
                                        onPress={() => loadEquipos()}
                                      >
                                        <Ionicons name="flash-outline" size={17} color="#111918" />
                                        <Text style={styles.btnOutlineText}>Recalcular</Text>
                                      </Pressable>
                                      <Pressable
                                        style={[styles.btnOutline, { flex: 1, justifyContent: "center", opacity: savingMaintenanceId === equipo._id ? 0.65 : 1 }]}
                                        disabled={savingMaintenanceId === equipo._id}
                                        onPress={() => saveMaintenanceConfig(equipo)}
                                      >
                                        {savingMaintenanceId === equipo._id
                                          ? <ActivityIndicator color="#111918" />
                                          : <Ionicons name="save-outline" size={17} color="#111918" />}
                                        <Text style={styles.btnOutlineText}>Guardar</Text>
                                      </Pressable>
                                    </View>
                                  </View>
                                );
                              })() : null}
                              {isChiefPilotRole && equiposViewMode === "fleet" ? (
                                <View style={{ flexDirection: "row", marginTop: 12 }}>
                                  <Pressable
                                    style={[styles.btnOutline, { flex: 1, justifyContent: "center", marginRight: 8 }]}
                                    onPress={() => resetEquipoForm(equipo)}
                                  >
                                    <Ionicons name="create-outline" size={16} color="#111918" />
                                    <Text style={styles.btnOutlineText}>Editar</Text>
                                  </Pressable>
                                  <Pressable
                                    style={[styles.btnOutline, { flex: 1, justifyContent: "center", borderColor: "#fecaca" }]}
                                    onPress={() => deleteEquipo(equipo)}
                                  >
                                    <Ionicons name="trash-outline" size={17} color="#dc2626" />
                                    <Text style={[styles.btnOutlineText, { color: "#dc2626" }]}>Eliminar</Text>
                                  </Pressable>
                                </View>
                              ) : null}
                            </View>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                </>
              )}

              {section === "pilot-profile" && (
                <>
                  <View style={styles.card}>
                    <Text style={styles.cardTitle}>Documentos para operación en campo</Text>
                    <Text style={[styles.muted, { marginBottom: 12 }]}>
                      Carga y consulta aquí tus certificaciones. La vigencia del CIPU está vinculada al certificado médico.
                    </Text>

                    <View style={styles.fieldDocCard}>
                      <View style={styles.rowBetween}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.fieldDocTitle}>Certificado médico</Text>
                          <Text style={styles.fieldDocMeta}>
                            {usuario?.documentosCampo?.certificadoMedico?.name || "Sin archivo"}
                          </Text>
                        </View>
                        <View style={[styles.missionRelationBadge, certStatus.label === "Vigente" ? styles.missionApprovalApproved : styles.missionApprovalPending]}>
                          <Text style={styles.missionRelationText}>{certStatus.label}</Text>
                        </View>
                      </View>
                      <View style={[styles.row, { marginTop: 10 }]}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.kLabel}>Fecha de inicio</Text>
                          <Pressable
                            style={[styles.input, styles.datePressable]}
                            onPress={() => openMedicalDatePicker("start")}
                          >
                            <Text style={{ color: medicalCertificateStart ? "#1b2b3a" : "#8a96a3", flex: 1 }}>
                              {medicalCertificateStart || "Seleccionar fecha"}
                            </Text>
                            <Ionicons name="calendar-outline" size={18} color="#111918" />
                          </Pressable>
                          {Platform.OS === "ios" && showMedicalStartDate ? (
                            <DateTimePicker
                              value={dateFromYmd(medicalCertificateStart)}
                              mode="date"
                              display={Platform.OS === "ios" ? "compact" : "default"}
                              onChange={(event: DateTimePickerEvent, selected?: Date) => {
                                setShowMedicalStartDate(false);
                                if (event.type === "dismissed" || !selected) return;
                                setMedicalCertificateStart(formatDateOnly(selected));
                              }}
                            />
                          ) : null}
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.kLabel}>Fecha de vencimiento</Text>
                          <Pressable
                            style={[styles.input, styles.datePressable]}
                            onPress={() => openMedicalDatePicker("end")}
                          >
                            <Text style={{ color: medicalCertificateEnd ? "#1b2b3a" : "#8a96a3", flex: 1 }}>
                              {medicalCertificateEnd || "Seleccionar fecha"}
                            </Text>
                            <Ionicons name="calendar-outline" size={18} color="#111918" />
                          </Pressable>
                          {Platform.OS === "ios" && showMedicalEndDate ? (
                            <DateTimePicker
                              value={dateFromYmd(medicalCertificateEnd || medicalCertificateStart)}
                              minimumDate={medicalCertificateStart ? dateFromYmd(medicalCertificateStart) : undefined}
                              mode="date"
                              display={Platform.OS === "ios" ? "compact" : "default"}
                              onChange={(event: DateTimePickerEvent, selected?: Date) => {
                                setShowMedicalEndDate(false);
                                if (event.type === "dismissed" || !selected) return;
                                setMedicalCertificateEnd(formatDateOnly(selected));
                              }}
                            />
                          ) : null}
                        </View>
                      </View>
                      <View style={styles.fieldDocActions}>
                        <Pressable style={styles.btnPrimary} disabled={!!fieldDocumentBusy} onPress={() => uploadFieldDocument("certificadoMedico")}>
                          {fieldDocumentBusy === "certificadoMedico" ? <ActivityIndicator color="#fff" /> : <Ionicons name="cloud-upload-outline" size={16} color="#fff" />}
                          <Text style={styles.btnPrimaryText}>Cargar certificado</Text>
                        </Pressable>
                        {usuario?.documentosCampo?.certificadoMedico?.key ? (
                          <Pressable style={styles.btnOutline} onPress={() => openFieldDocument("certificadoMedico")}>
                            <Text style={styles.btnOutlineText}>Ver</Text>
                          </Pressable>
                        ) : null}
                      </View>
                    </View>

                    {([
                      { type: "cipu" as const, title: "CIPU", icon: "card-account-details-outline" as const },
                      { type: "arl" as const, title: "ARL", icon: "shield-account-outline" as const },
                    ]).map((item) => {
                      const document = usuario?.documentosCampo?.[item.type];
                      const cipuOperational =
                        item.type !== "cipu" ||
                        (certStatus.label !== "Vencido" && certStatus.label !== "—");
                      return (
                        <View key={item.type} style={styles.fieldDocCard}>
                          <View style={styles.rowBetween}>
                            <View style={styles.fieldDocHeading}>
                              <MaterialCommunityIcons name={item.icon} size={20} color="#111918" />
                              <View style={{ flex: 1 }}>
                                <Text style={styles.fieldDocTitle}>{item.title}</Text>
                                <Text style={styles.fieldDocMeta}>{document?.name || "Sin archivo"}</Text>
                              </View>
                            </View>
                            <View style={[styles.missionRelationBadge, document?.key && cipuOperational ? styles.missionApprovalApproved : styles.missionApprovalPending]}>
                              <Text style={styles.missionRelationText}>
                                {!document?.key ? "Pendiente" : cipuOperational ? "Disponible" : "Médico vencido"}
                              </Text>
                            </View>
                          </View>
                          {item.type === "cipu" && document?.key && !cipuOperational ? (
                            <Text style={styles.warningInline}>El CIPU no figura vigente para campo mientras el certificado médico esté vencido.</Text>
                          ) : null}
                          <View style={styles.fieldDocActions}>
                            <Pressable style={styles.btnPrimary} disabled={!!fieldDocumentBusy} onPress={() => uploadFieldDocument(item.type)}>
                              {fieldDocumentBusy === item.type ? <ActivityIndicator color="#fff" /> : <Ionicons name="cloud-upload-outline" size={16} color="#fff" />}
                              <Text style={styles.btnPrimaryText}>Cargar {item.title}</Text>
                            </Pressable>
                            {document?.key ? (
                              <Pressable style={styles.btnOutline} onPress={() => openFieldDocument(item.type)}>
                                <Text style={styles.btnOutlineText}>Ver</Text>
                              </Pressable>
                            ) : null}
                          </View>
                        </View>
                      );
                    })}
                  </View>

                  <View style={styles.card}>
                    <Text style={styles.cardTitle}>Carnet del piloto</Text>
                    <View style={styles.pilotIdCard}>
                      <View style={styles.pilotIdCornerTL} />
                      <View style={styles.pilotIdCornerTR} />
                      <View style={styles.pilotIdCornerBL} />
                      <View style={styles.pilotIdCornerBR} />
                      <LinearGradient
                        colors={["#111918", "#111918"]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.pilotIdHeader}
                      >
                        <View style={[styles.pilotIdWave, styles.pilotIdWaveOne]} />
                        <View style={[styles.pilotIdWave, styles.pilotIdWaveTwo]} />
                        <View style={[styles.pilotIdWave, styles.pilotIdWaveThree]} />
                        <View style={styles.pilotIdHeaderContent}>
                          <Image source={PILOT_CARD_HEADER_LOGO} style={styles.pilotIdHeaderLogo} resizeMode="contain" />
                        </View>
                      </LinearGradient>

                      <View style={styles.pilotIdAvatarRing}>
                        <View style={styles.pilotIdAvatar}>
                          {userAvatarUriWithVersion && !avatarLoadError ? (
                            <Image
                              source={{ uri: userAvatarUriWithVersion }}
                              style={styles.pilotIdAvatarImage}
                              onError={() => setAvatarLoadError(true)}
                            />
                          ) : (
                            <Text style={styles.pilotIdAvatarText}>{initials}</Text>
                          )}
                        </View>
                      </View>

                      <Text style={styles.pilotIdName} numberOfLines={2}>
                        {usuario?.nombre || "Piloto UAS"}
                      </Text>
                      <Text style={styles.pilotIdRole}>Piloto UAS</Text>

                      <View style={styles.pilotIdQrWrap}>
                        {usuario?.qrPublicUrl || usuario?.qrPublicToken ? (
                          <Image
                            source={{
                              uri: `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(
                                usuario?.qrPublicUrl || `${API_URL}/api/usuarios/public/${usuario?.qrPublicToken}`
                              )}`,
                            }}
                            style={styles.pilotIdQrImage}
                          />
                        ) : (
                          <MaterialCommunityIcons name="qrcode" size={68} color="#4b5563" />
                        )}
                        <Text style={styles.pilotIdQrText}>{usuario?.cipu || "—"}</Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.card}>
                    <Text style={styles.cardTitle}>Datos operacionales</Text>
                    <View style={styles.kvRow}>
                      <KVP
                        label="Certificado médico"
                        value={usuario?.fechaCertificado ? String(usuario.fechaCertificado).slice(0, 10) : "—"}
                        icon="calendar"
                        valueStyle={{ color: certStatus.color }}
                      />
                      <KVP label="CIPU" value={usuario?.cipu || "—"} icon="card-account-details-outline" />
                    </View>
                  </View>

                  <View style={styles.card}>
                    <Text style={styles.cardTitle}>Perfil del piloto</Text>
                    <View style={styles.kvRow}>
                      <KVP label="Documento" value={usuario?.documento || "—"} icon="card-bulleted-outline" />
                      <KVP label="Certificado" value={certStatus.label} icon="medical-bag" valueStyle={{ color: certStatus.color }} />
                    </View>
                    <View style={styles.kvRow}>
                      <KVP label="Horas acumuladas" value={`${horasAcumuladas.toFixed(1)} h`} icon="clock-outline" />
                      <KVP label="Última misión" value={misiones[0]?.titulo || "—"} icon="map-marker-check-outline" />
                    </View>
                  </View>

                  <View style={styles.card}>
                    <Text style={styles.cardTitle}>Resumen Documental</Text>
                    {legalSummary.map((item) => {
                      const pr = legalPriority(item.days);
                      return (
                        <View key={item.key} style={styles.legalRow}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.summaryLabel}>{item.title}</Text>
                            <Text style={styles.muted}>Vence: {item.date}</Text>
                          </View>
                          <View style={{ alignItems: "flex-end" }}>
                            <Text style={[styles.summaryValue, { color: pr.color }]}>{formatDaysStatus(item.days)}</Text>
                            <Text style={[styles.kLabel, { color: pr.color }]}>Prioridad {pr.label}</Text>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                </>
              )}

              {section === "dji-cloud" && (
                <>
                  <View style={styles.card}>
                    <View style={styles.rowBetween}>
                      <Text style={styles.cardTitle}>Sincronización DJI</Text>
                      <View style={[styles.statusBadge, styles.statusBadgeInfo]}>
                        <Text style={styles.statusBadgeText}>Cuenta DJI</Text>
                      </View>
                    </View>
                    <Text style={styles.muted}>
                      Ingresa las credenciales DJI del piloto para vincular la cuenta y después solicitar la sincronización desde la plataforma.
                    </Text>
                    {djiCloudLoading ? (
                      <View style={styles.loadingBox}>
                        <ActivityIndicator />
                        <Text style={styles.muted}>Cargando configuración DJI...</Text>
                      </View>
                    ) : null}
                  </View>

                    {djiIntegrationMode === "consumer_local" && (
                      <View style={styles.card}>
                        <View style={styles.rowBetween}>
                          <Text style={styles.cardTitle}>Cuenta DJI</Text>
                          <View
                            style={[
                              styles.statusBadge,
                              djiCloudStatus?.connected ? styles.statusBadgeSuccess : styles.statusBadgeWarn,
                            ]}
                          >
                            <Text style={styles.statusBadgeText}>
                              {djiCloudStatus?.connected ? "Cuenta vinculada" : "Sin vincular"}
                            </Text>
                          </View>
                        </View>

                        <View style={styles.djiRequirementBox}>
                          <Text style={[styles.kLabel, { marginTop: 0 }]}>DJI Username / Email</Text>
                          <TextInput
                            style={[styles.input, { marginTop: 8 }]}
                            value={djiCloudForm.accountIdentifier}
                            onChangeText={(value) => setDjiCloudForm((prev) => ({ ...prev, accountIdentifier: value }))}
                            placeholder="Usuario o correo usado en DJI"
                            placeholderTextColor="#8c9aaa"
                            autoCapitalize="none"
                          />

                          <Text style={[styles.kLabel, { marginTop: 12 }]}>DJI Password</Text>
                          <TextInput
                            style={[styles.input, { marginTop: 8 }]}
                            value={djiCloudForm.password}
                            onChangeText={(value) => setDjiCloudForm((prev) => ({ ...prev, password: value }))}
                            placeholder="Contraseña usada en DJI"
                            placeholderTextColor="#8c9aaa"
                            autoCapitalize="none"
                            secureTextEntry
                          />

                          <Text style={[styles.kLabel, { marginTop: 12 }]}>Confirm Password</Text>
                          <TextInput
                            style={[styles.input, { marginTop: 8 }]}
                            value={djiCloudForm.confirmPassword}
                            onChangeText={(value) => setDjiCloudForm((prev) => ({ ...prev, confirmPassword: value }))}
                            placeholder="Confirma la contraseña"
                            placeholderTextColor="#8c9aaa"
                            autoCapitalize="none"
                            secureTextEntry
                          />

                          <View style={{ flexDirection: "row", marginTop: 16 }}>
                            <Pressable
                              style={[styles.btnPrimary, { flex: 1, marginRight: 10, opacity: djiCloudSaving ? 0.7 : 1 }]}
                              onPress={submitDjiCloudConnection}
                              disabled={djiCloudSaving}
                            >
                              <MaterialCommunityIcons name="cloud-check-outline" size={18} color="#fff" />
                              <Text style={styles.btnPrimaryText}>{djiCloudSaving ? "Verificando..." : "Save / Verify"}</Text>
                            </Pressable>
                            <Pressable
                              style={[styles.btnPrimary, { flex: 1, opacity: djiCloudSaving || !djiCloudStatus?.connected ? 0.7 : 1 }]}
                              onPress={requestDjiCloudSync}
                              disabled={djiCloudSaving || !djiCloudStatus?.connected}
                            >
                              <Ionicons name="sync-outline" size={18} color="#fff" />
                              <Text style={styles.btnPrimaryText}>
                                {djiCloudSaving ? "Sincronizando..." : "Sincronizar cuenta DJI"}
                              </Text>
                            </Pressable>
                          </View>
                        </View>
                      </View>
                    )}

                  {false && djiIntegrationMode === "enterprise_cloud" && (
                    <>
                      <View style={styles.card}>
                        <View style={styles.rowBetween}>
                          <Text style={styles.cardTitle}>Vínculo cloud Enterprise</Text>
                          <View
                            style={[
                              styles.statusBadge,
                              djiCloudStatus?.connected
                                ? djiCloudStatus?.estado === "pendiente_sync"
                                  ? styles.statusBadgeWarn
                                  : styles.statusBadgeSuccess
                                : styles.statusBadgeWarn,
                            ]}
                          >
                            <Text style={styles.statusBadgeText}>
                              {djiCloudStatus?.connected
                                ? djiCloudStatus?.estado === "pendiente_sync"
                                  ? "Sync pendiente"
                                  : "Cuenta conectada"
                                : "Sin vincular"}
                            </Text>
                          </View>
                        </View>
                        <Text style={styles.muted}>
                          Este modo está pensado para flota Enterprise con DJI Pilot 2. Aquí registras la cuenta operativa y solicitas las sincronizaciones cloud.
                        </Text>
                        <View style={styles.kvRow}>
                          <KVP
                            label="Cuenta vinculada"
                            value={djiCloudStatus?.connected ? (djiCloudStatus?.accountDisplayName || djiCloudStatus?.accountIdentifier || "Conectada") : "No conectada"}
                            icon={djiCloudStatus?.connected ? "cloud-check-outline" : "cloud-off-outline"}
                          />
                          <KVP label="Origen principal" value={djiCloudStatus?.sourceApp === "DJI_PILOT_2" ? "DJI Pilot 2" : djiCloudSourceLabel} icon="account-sync-outline" />
                        </View>
                        <View style={styles.kvRow}>
                          <KVP
                            label="Última sincronización"
                            value={
                              djiCloudStatus?.ultimoSyncAt
                                ? formatDateOnly(djiCloudStatus.ultimoSyncAt)
                                : djiCloudStatus?.syncSolicitadoAt
                                ? "Solicitada"
                                : "Sin sincronizar"
                            }
                            icon="refresh"
                          />
                          <KVP
                            label="Vuelos detectados"
                            value={String(djiCloudStatus?.totalVuelosSincronizados || 0)}
                            icon="airplane-clock"
                          />
                        </View>
                        {!!djiCloudStatus?.notasIntegracion && <Text style={styles.muted}>{djiCloudStatus.notasIntegracion}</Text>}
                        {!!djiCloudStatus?.ultimoResumenSync && <Text style={styles.muted}>{djiCloudStatus.ultimoResumenSync}</Text>}
                        {!!djiCloudStatus?.ultimoError && (
                          <Text style={[styles.muted, { color: "#b91c1c" }]}>{djiCloudStatus.ultimoError}</Text>
                        )}
                        <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 14 }}>
                          <Pressable
                            style={[styles.btnPrimary, styles.mr10, { marginBottom: 10, opacity: djiCloudSaving ? 0.7 : 1 }]}
                            onPress={openDjiCloudModal}
                            disabled={djiCloudSaving}
                          >
                            <MaterialCommunityIcons name="cloud-check-outline" size={18} color="#fff" />
                            <Text style={styles.btnPrimaryText}>
                              {djiCloudStatus?.connected ? "Editar vínculo" : "Conectar cuenta DJI"}
                            </Text>
                          </Pressable>
                          <Pressable
                            style={[styles.btnOutline, styles.mr10, { marginBottom: 10, opacity: djiCloudSaving ? 0.7 : 1 }]}
                            onPress={requestDjiCloudSync}
                            disabled={djiCloudSaving}
                          >
                            <Ionicons name="sync-outline" size={16} color="#111918" />
                            <Text style={styles.btnOutlineText}>Solicitar sync</Text>
                          </Pressable>
                          {djiCloudStatus?.connected ? (
                            <Pressable
                              style={[styles.btnOutline, { marginBottom: 10, opacity: djiCloudSaving ? 0.7 : 1 }]}
                              onPress={disconnectDjiCloud}
                              disabled={djiCloudSaving}
                            >
                              <MaterialCommunityIcons name="link-off" size={16} color="#111918" />
                              <Text style={styles.btnOutlineText}>Desvincular</Text>
                            </Pressable>
                          ) : null}
                        </View>
                      </View>

                      <View style={styles.card}>
                        <Text style={styles.cardTitle}>Historial de sincronizaciones</Text>
                        {!djiCloudRuns.length ? (
                          <Text style={styles.muted}>Aún no hay ejecuciones registradas para DJI Cloud.</Text>
                        ) : (
                          djiCloudRuns.slice(0, 6).map((run) => (
                            <View key={run.id} style={styles.legalRow}>
                              <View style={{ flex: 1 }}>
                                <Text style={styles.summaryLabel}>{run.message || `Run ${run.estado}`}</Text>
                                <Text style={styles.muted}>
                                  {run.sourceApp.replaceAll("_", " ")} · detectados {run.flightsDetected} · creados {run.flightsCreated}
                                </Text>
                              </View>
                              <Text style={styles.kLabel}>{formatDateOnly(run.finishedAt || run.startedAt || run.requestedAt || "")}</Text>
                            </View>
                          ))
                        )}
                      </View>

                      <View style={styles.card}>
                        <Text style={styles.cardTitle}>Vuelos sincronizados desde cloud</Text>
                        {!djiCloudFlights.length ? (
                          <Text style={styles.muted}>Todavía no hay vuelos sincronizados desde DJI Cloud para este piloto.</Text>
                        ) : (
                          djiCloudFlights.slice(0, 6).map((flight) => (
                            <View key={flight.id} style={styles.legalRow}>
                              <View style={{ flex: 1 }}>
                                <Text style={styles.summaryLabel}>{flight.originalName || "Vuelo DJI Cloud"}</Text>
                                <Text style={styles.muted}>
                                  {flight.externalProvider || "DJI"} · {flight.summary?.durationSec ? `${Math.round((flight.summary.durationSec || 0) / 60)} min` : "duración sin dato"}
                                </Text>
                              </View>
                              <Text style={styles.kLabel}>{formatDateOnly(flight.deviceTime || flight.createdAt || "")}</Text>
                            </View>
                          ))
                        )}
                      </View>
                    </>
                  )}
                </>
              )}

              {section === "weather" && ( 
                <>
                  <View style={styles.card}>
                    <View style={styles.rowBetween}>
                      <Text style={styles.cardTitle}>Condiciones meteorológicas</Text>
                      <Pressable style={styles.btnOutline} onPress={loadGpsAndWeather}>
                        <Ionicons name="refresh" size={16} color="#111918" />
                        <Text style={styles.btnOutlineText}>Actualizar</Text>
                      </Pressable>
                    </View>

                    <View
                      style={[
                        styles.weatherStateCard,
                        weatherDetail.flightState === "APTAS"
                          ? styles.weatherStateGood
                          : weatherDetail.flightState === "MARGINALES"
                          ? styles.weatherStateWarn
                          : styles.weatherStateBad,
                      ]}
                    >
                      <View style={styles.rowBetween}>
                        <Text style={styles.weatherStateTitle}>Estado de vuelo</Text>
                        <Text style={styles.weatherStateValue}>
                          {weatherDetail.flightState === "APTAS"
                            ? "Aptas"
                            : weatherDetail.flightState === "MARGINALES"
                            ? "Marginales"
                            : "No recomendadas"}
                        </Text>
                      </View>
                      {!!weatherDetail.reasons?.length && (
                        <Text style={styles.weatherStateReason}>{weatherDetail.reasons.join(" · ")}</Text>
                      )}
                    </View>

                    <View style={styles.weatherDisclaimerCard}>
                      <View style={styles.row}>
                        <MaterialCommunityIcons name="alert-circle-outline" size={18} color="#8a5a00" />
                        <Text style={styles.weatherDisclaimerTitle}>Aviso técnico y de responsabilidad operacional</Text>
                      </View>
                      <Text style={styles.weatherDisclaimerText}>
                        La información meteorológica presentada en este módulo tiene carácter referencial e informativo y se
                        basa en fuentes externas de datos atmosféricos, por lo que puede presentar variaciones o desfases
                        frente a las condiciones reales en el área de operación.
                      </Text>
                      <Text style={styles.weatherDisclaimerText}>
                        La evaluación final de aptitud de vuelo y la decisión de ejecutar, posponer o cancelar la operación
                        UAS corresponde exclusivamente al piloto remoto y/o responsable operacional, conforme a la normativa
                        aeronáutica aplicable y al análisis de riesgo previo al vuelo.
                      </Text>
                      <Text style={styles.weatherDisclaimerText}>
                        AeroXpert no asume responsabilidad por incidentes, accidentes, pérdidas o daños derivados del uso o
                        interpretación de esta información. Se recomienda validar siempre las condiciones en campo y con
                        fuentes oficiales antes de iniciar la operación.
                      </Text>
                    </View>

                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      style={{ marginTop: 12 }}
                      contentContainerStyle={{ paddingRight: 6 }}
                    >
                      <View style={styles.wxTable}>
                        <View style={[styles.wxRow, styles.wxHeaderRow]}>
                          <Text style={[styles.wxCell, styles.wxHeaderCell]}>Viento</Text>
                          <Text style={[styles.wxCell, styles.wxHeaderCell]}>Dirección</Text>
                          <Text style={[styles.wxCell, styles.wxHeaderCell]}>Ráfagas</Text>
                          <Text style={[styles.wxCell, styles.wxHeaderCell]}>Temp</Text>
                          <Text style={[styles.wxCell, styles.wxHeaderCell]}>Humedad</Text>
                          <Text style={[styles.wxCell, styles.wxHeaderCell]}>Precip. prob</Text>
                          <Text style={[styles.wxCell, styles.wxHeaderCell]}>Lluvia</Text>
                          <Text style={[styles.wxCell, styles.wxHeaderCell]}>Nubosidad</Text>
                          <Text style={[styles.wxCell, styles.wxHeaderCell]}>Base nube</Text>
                          <Text style={[styles.wxCell, styles.wxHeaderCell]}>Visibilidad</Text>
                          <Text style={[styles.wxCell, styles.wxHeaderCell]}>Sat visibles</Text>
                          <Text style={[styles.wxCell, styles.wxHeaderCell]}>Kp</Text>
                          <Text style={[styles.wxCell, styles.wxHeaderCell]}>Est. satélites bloq.</Text>
                          <Text style={[styles.wxCell, styles.wxHeaderCell]}>Presión</Text>
                          <Text style={[styles.wxCell, styles.wxHeaderCell]}>Radiación</Text>
                          <Text style={[styles.wxCell, styles.wxHeaderCell]}>Estado</Text>
                          <Text style={[styles.wxCell, styles.wxHeaderCell]}>Bueno para volar</Text>
                        </View>

                        <View style={styles.wxRow}>
                          <Text style={styles.wxCell}>
                            {weatherDetail.windMs != null ? `${weatherDetail.windMs.toFixed(1)} m/s` : "—"}
                          </Text>
                          <Text style={styles.wxCell}>
                            {weatherDetail.windDirLabel || "—"} {weatherDetail.windDirDeg != null ? `(${Math.round(weatherDetail.windDirDeg)}°)` : ""}
                          </Text>
                          <Text style={styles.wxCell}>
                            {weatherDetail.windGustMs != null ? `${weatherDetail.windGustMs.toFixed(1)} m/s` : "—"}
                          </Text>
                          <Text style={styles.wxCell}>
                            {weatherDetail.tempC != null ? `${weatherDetail.tempC.toFixed(1)}°C` : "—"}
                          </Text>
                          <Text style={styles.wxCell}>
                            {weatherDetail.humidityPct != null ? `${Math.round(weatherDetail.humidityPct)}%` : "—"}
                          </Text>
                          <Text style={styles.wxCell}>
                            {weatherDetail.precipProbPct != null ? `${Math.round(weatherDetail.precipProbPct)}%` : "—"}
                          </Text>
                          <Text style={styles.wxCell}>
                            {weatherDetail.rainMm != null ? `${weatherDetail.rainMm.toFixed(1)} mm` : "—"}
                          </Text>
                          <Text style={styles.wxCell}>
                            {weatherDetail.cloudCoverPct != null ? `${Math.round(weatherDetail.cloudCoverPct)}%` : "—"}
                          </Text>
                          <Text style={styles.wxCell}>
                            {weatherDetail.cloudBaseM != null ? `${Math.round(weatherDetail.cloudBaseM)} m` : "—"}
                          </Text>
                          <Text style={styles.wxCell}>
                            {weatherDetail.visibilityM != null ? `${(weatherDetail.visibilityM / 1000).toFixed(1)} km` : "—"}
                          </Text>
                          <Text style={styles.wxCell}>
                            {weatherDetail.satVisibleEst != null ? `${weatherDetail.satVisibleEst}` : "—"}
                          </Text>
                          <Text style={styles.wxCell}>
                            {weatherDetail.kpIndex != null
                              ? weatherDetail.kpIndex.toLocaleString("es-CO", { minimumFractionDigits: 1, maximumFractionDigits: 1 })
                              : "—"}
                          </Text>
                          <Text style={styles.wxCell}>
                            {weatherDetail.satBlockedEstPct != null
                              ? `${weatherDetail.satBlockedEstPct.toLocaleString("es-CO", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
                              : "—"}
                          </Text>
                          <Text style={styles.wxCell}>
                            {weatherDetail.pressureHpa != null ? `${Math.round(weatherDetail.pressureHpa)} hPa` : "—"}
                          </Text>
                          <Text style={styles.wxCell}>
                            {weatherDetail.radiationWm2 != null ? `${Math.round(weatherDetail.radiationWm2)} W/m²` : "—"}
                          </Text>
                          <Text style={styles.wxCell}>
                            {weatherDetail.label || "—"}
                          </Text>
                          <View
                            style={[
                              styles.wxCell,
                              styles.wxGoodCell,
                              weatherDetail.flightState === "APTAS"
                                ? styles.wxGoodYes
                                : weatherDetail.flightState === "MARGINALES"
                                ? styles.wxGoodMaybe
                                : styles.wxGoodNo,
                            ]}
                          >
                            <Text style={styles.wxGoodText}>
                              {weatherDetail.flightState === "APTAS"
                                ? "Sí"
                                : weatherDetail.flightState === "MARGINALES"
                                ? "Marginal"
                                : "No"}
                            </Text>
                          </View>
                        </View>
                      </View>
                    </ScrollView>

                    {false && (<View style={[styles.compassCard, { display: "none" }]}>
                      <Text style={styles.cardTitle}>Brújula</Text>
                      <View style={styles.compassRow}>
                        <View style={styles.compassDial}>
                          <Text style={styles.compassNorth}>N</Text>
                          <View
                            style={[
                              styles.compassNeedleWrap,
                              { transform: [{ rotate: `${-Number(compass.headingDeg || 0)}deg` }] },
                            ]}
                          >
                            <MaterialCommunityIcons name="navigation" size={28} color="#111918" />
                          </View>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.weatherMetricLabel}>Rumbo actual</Text>
                          <Text style={styles.weatherMetricValue}>
                            {compass.headingDeg != null ? `${Math.round(compass.headingDeg)}°` : "—"}
                          </Text>
                          <Text style={styles.weatherMetricSub}>
                            {compass.supported ? `Dirección ${compass.headingLabel}` : compass.headingLabel}
                          </Text>
                          <Text style={styles.weatherMetricSub}>
                            Lat: {gpsCell.lat != null ? gpsCell.lat.toFixed(6) : "—"} · Lng:{" "}
                            {gpsCell.lon != null ? gpsCell.lon.toFixed(6) : "—"}
                          </Text>
                        </View>
                      </View>
                    </View>)}

                    {false && (<View style={styles.compassCard}>
                      <Text style={styles.cardTitle}>Brujula</Text>
                      <View style={styles.compassPhoneWrap}>
                        <View style={styles.compassPhoneMarker} />
                        <View style={styles.compassPhoneDial}>
                          {Array.from({ length: 72 }).map((_, i) => {
                            const deg = i * 5;
                            const major = deg % 30 === 0;
                            return (
                              <View
                                key={`tick-${i}`}
                                style={[
                                  styles.compassTick,
                                  major ? styles.compassTickMajor : null,
                                  { transform: [{ rotate: `${deg}deg` }] },
                                ]}
                              />
                            );
                          })}
                          {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((deg) => (
                            <Text
                              key={`deg-${deg}`}
                              style={[
                                styles.compassDegreeLabel,
                                { transform: [{ rotate: `${deg}deg` }, { translateY: -136 }, { rotate: `${-deg}deg` }] },
                              ]}
                            >
                              {deg}
                            </Text>
                          ))}
                          {[
                            { dir: "N", deg: 0 },
                            { dir: "E", deg: 90 },
                            { dir: "S", deg: 180 },
                            { dir: "O", deg: 270 },
                          ].map((item) => (
                            <Text
                              key={`dir-${item.dir}`}
                              style={[
                                styles.compassDirLabel,
                                { transform: [{ rotate: `${item.deg}deg` }, { translateY: -88 }, { rotate: `${-item.deg}deg` }] },
                              ]}
                            >
                              {item.dir}
                            </Text>
                          ))}
                          <View
                            style={[
                              styles.compassNeedleLive,
                              { transform: [{ rotate: `${-Number(compass.headingDeg || 0)}deg` }] },
                            ]}
                          >
                            <MaterialCommunityIcons name="navigation" size={28} color="#111918" />
                          </View>
                        </View>
                      </View>
                      <Text style={styles.compassReadout}>
                        {compass.headingDeg != null ? `${Math.round(compass.headingDeg)}\u00B0 ${compass.headingLabel}` : "—"}
                      </Text>
                      <Text style={styles.compassCoords}>
                        {toDms(gpsCell.lat, true)} · {toDms(gpsCell.lon, false)}
                      </Text>
                      <Text style={styles.compassSubText}>
                        {compass.supported ? "Brujula activa en tiempo real" : compass.headingLabel}
                      </Text>
                    </View>)}

                    <View style={styles.weatherGrid}>
                      <View style={styles.weatherMetric}>
                        <Text style={styles.weatherMetricLabel}>Viento</Text>
                        <Text style={styles.weatherMetricValue}>
                          {weatherDetail.windMs != null ? `${weatherDetail.windMs.toFixed(1)} m/s` : "—"}
                        </Text>
                        <Text style={styles.weatherMetricSub}>
                          Dir: {weatherDetail.windDirLabel || "—"} {weatherDetail.windDirDeg != null ? `(${Math.round(weatherDetail.windDirDeg)}°)` : ""}
                        </Text>
                      </View>
                      <View style={styles.weatherMetric}>
                        <Text style={styles.weatherMetricLabel}>Ráfagas</Text>
                        <Text style={styles.weatherMetricValue}>
                          {weatherDetail.windGustMs != null ? `${weatherDetail.windGustMs.toFixed(1)} m/s` : "—"}
                        </Text>
                        <Text style={styles.weatherMetricSub}>Cambios bruscos de viento</Text>
                      </View>
                      <View style={styles.weatherMetric}>
                        <Text style={styles.weatherMetricLabel}>Precipitación</Text>
                        <Text style={styles.weatherMetricValue}>
                          {weatherDetail.precipProbPct != null ? `${Math.round(weatherDetail.precipProbPct)}%` : "—"}
                        </Text>
                        <Text style={styles.weatherMetricSub}>
                          Lluvia: {weatherDetail.rainMm != null ? `${weatherDetail.rainMm.toFixed(1)} mm` : "—"}
                        </Text>
                      </View>
                      <View style={styles.weatherMetric}>
                        <Text style={styles.weatherMetricLabel}>Visibilidad</Text>
                        <Text style={styles.weatherMetricValue}>
                          {weatherDetail.visibilityM != null ? `${(weatherDetail.visibilityM / 1000).toFixed(1)} km` : "—"}
                        </Text>
                        <Text style={styles.weatherMetricSub}>Requerida para VLOS</Text>
                      </View>
                      <View style={styles.weatherMetric}>
                        <Text style={styles.weatherMetricLabel}>Nubosidad</Text>
                        <Text style={styles.weatherMetricValue}>
                          {weatherDetail.cloudCoverPct != null ? `${Math.round(weatherDetail.cloudCoverPct)}%` : "—"}
                        </Text>
                        <Text style={styles.weatherMetricSub}>
                          Base: {weatherDetail.cloudBaseM != null ? `${Math.round(weatherDetail.cloudBaseM)} m` : "—"}
                        </Text>
                      </View>
                      <View style={styles.weatherMetric}>
                        <Text style={styles.weatherMetricLabel}>Temperatura</Text>
                        <Text style={styles.weatherMetricValue}>
                          {weatherDetail.tempC != null ? `${weatherDetail.tempC.toFixed(1)}°C` : "—"}
                        </Text>
                        <Text style={styles.weatherMetricSub}>Estado: {weatherDetail.label || "Sin dato"}</Text>
                      </View>
                      <View style={styles.weatherMetric}>
                        <Text style={styles.weatherMetricLabel}>Humedad</Text>
                        <Text style={styles.weatherMetricValue}>
                          {weatherDetail.humidityPct != null ? `${Math.round(weatherDetail.humidityPct)}%` : "—"}
                        </Text>
                        <Text style={styles.weatherMetricSub}>Relativa</Text>
                      </View>
                      <View style={styles.weatherMetric}>
                        <Text style={styles.weatherMetricLabel}>Presión</Text>
                        <Text style={styles.weatherMetricValue}>
                          {weatherDetail.pressureHpa != null ? `${Math.round(weatherDetail.pressureHpa)} hPa` : "—"}
                        </Text>
                        <Text style={styles.weatherMetricSub}>Atmosférica</Text>
                      </View>
                      <View style={styles.weatherMetric}>
                        <Text style={styles.weatherMetricLabel}>Radiación solar</Text>
                        <Text style={styles.weatherMetricValue}>
                          {weatherDetail.radiationWm2 != null ? `${Math.round(weatherDetail.radiationWm2)} W/m²` : "—"}
                        </Text>
                        <Text style={styles.weatherMetricSub}>Útil para sensores/cámara</Text>
                      </View>
                    </View>

                    <Text style={styles.muted}>
                      Fuente: Open-Meteo · Observación: {formatWeatherObservation(weatherDetail.updatedAt)} · GPS de alta precisión
                    </Text>
                  </View>
                </>
              )}

              {/* NUEVO REPORTE */}
              {section === "new-report" && (
                <View style={styles.card}>
                  <View style={styles.rowBetween}>
                    <Text style={styles.cardTitle}>
                      {repClase === "VOLUNTARIO"
                        ? "Nuevo reporte voluntario"
                        : repClase === "MOR"
                        ? "Nuevo reporte MOR"
                        : "Nuevo reporte SMS"}
                    </Text>
                    <Pressable onPress={() => setRepFormOpen((s) => !s)} style={styles.btnOutline}>
                      <Ionicons name={repFormOpen ? "close" : "add"} size={16} color="#111918" />
                      <Text style={styles.btnOutlineText}>{repFormOpen ? "Cerrar" : "Nuevo"}</Text>
                    </Pressable>
                  </View>

                  

                  {repFormOpen ? (
                    <>
                      <View style={styles.infoBanner}>
                        <MaterialCommunityIcons name="content-save-outline" size={18} color="#111918" />
                        <Text style={styles.infoBannerText}>Borrador automático activo. Tus cambios se guardan localmente.</Text>
                      </View>

                      <Field label="Clase de reporte" icon="layers-outline">
                        <Text style={[styles.muted, { marginTop: 8 }]}>
                          {repClase === "MOR" ? "MOR" : repClase === "VOLUNTARIO" ? "VOLUNTARIO" : "SMS"}
                        </Text>
                      </Field>

                      {repClase !== "VOLUNTARIO" && (
                      <Field label={repClase === "MOR" ? "Tipo de Reporte (Taxonomía MOR) *" : "Tipo de Reporte (Taxonomía SPI) *"} icon="alert-circle-outline">
                          <Pressable
                            onPress={() => {
                              closeKeyboard();
                              setShowTipoReporteModal(true);
                            }}
                            style={({ pressed }) => [
                              styles.input,
                              styles.datePressable,
                              pressed && { opacity: 0.92 },
                            ]}
                          >
                            <Text style={{ color: repTipoCode ? "#1b2b3a" : "#8a96a3", flex: 1 }} numberOfLines={2}>
                              {repTipoCode ? `${repTipoCode} — ${repTipoLabel}` : "Selecciona el tipo de reporte"}
                            </Text>
                            <Ionicons name="chevron-down" size={18} color="#111918" />
                          </Pressable>
                        </Field>
                      )}

                      {repClase === "VOLUNTARIO" && (
                        <Field label="Tipo de situación *" icon="alert-circle-outline">
                          <TextInput
                            style={styles.input}
                            placeholder="Ej: Procedimiento inseguro, condición insegura..."
                            placeholderTextColor="#8a96a3"
                            value={repTipoSituacion}
                            onChangeText={setRepTipoSituacion}
                          />
                        </Field>
                      )}


                        <Modal
                        visible={showTipoReporteModal}
                        animationType="fade"
                        transparent
                        statusBarTranslucent
                        presentationStyle="overFullScreen"
                        onRequestClose={() => setShowTipoReporteModal(false)}
                      >
                        <View style={styles.modalOverlayCenter}>
                          <View style={[styles.modalCardPro, { maxHeight: "80%" }]}>
                            <View style={styles.modalHeader}>
                              <Text style={styles.modalTitle}>{repClase === "MOR" ? "Tipo de Reporte (MOR)" : "Tipo de Reporte (SPI)"}</Text>

                              <Pressable onPress={() => setShowTipoReporteModal(false)}>
                                <Ionicons name="close" size={22} color="#111918" />
                              </Pressable>
                            </View>

                            <Text style={styles.muted}>
                              Selecciona la taxonomía del evento para reportarlo correctamente.
                            </Text>

                            <ScrollView style={{ marginTop: 12 }} showsVerticalScrollIndicator={false}>
                              {MOR_TAXONOMY.map((opt) => {
                                const selected = repTipoCode === opt.code && repTipoLabel === opt.label;

                                return (
                                  <Pressable
                                    key={`${opt.code}-${opt.label}`}
                                    onPress={() => {
                                      setRepTipoCode(opt.code);
                                      setRepTipoLabel(opt.label);
                                      setShowTipoReporteModal(false);
                                    }}
                                    style={[styles.equipoItem, selected && styles.equipoItemActive]}
                                  >
                                    <Text style={styles.equipoTitle}>{opt.code}</Text>
                                    <Text style={styles.equipoMeta}>{opt.label}</Text>
                                  </Pressable>
                                );
                              })}
                              <View style={{ height: 10 }} />
                            </ScrollView>
                          </View>
                        </View>
                      </Modal>



                      {/* ✅ FECHA Y HORA CON CALENDARIO */}
                      <Field label="Fecha y Hora del Evento *" icon="calendar-clock">
                        <Pressable
                          onPress={() => {
                            const base = repDateObj ?? new Date();
                            setRepDateObj(base);
                            setShowRepDate(true); // primero fecha
                          }}
                          style={({ pressed }) => [styles.input, styles.datePressable, pressed && { opacity: 0.92 }]}
                        >
                          <Text style={{ color: repFechaHora ? "#1b2b3a" : "#8a96a3", flex: 1 }}>
                            {repFechaHora || "Selecciona fecha y hora"}
                          </Text>
                          <Ionicons name="calendar-outline" size={18} color="#111918" />
                        </Pressable>

                        {showRepDate && (
                          <DateTimePicker
                            value={repDateObj ?? new Date()}
                            mode="date"
                            display={Platform.OS === "ios" ? "spinner" : "default"}
                            onChange={(event: DateTimePickerEvent, selected?: Date) => {
                              if (Platform.OS === "android") {
                                setShowRepDate(false);
                                if (event.type === "dismissed") return;

                                const d = selected ?? new Date();
                                const prev = repDateObj ?? new Date();
                                const merged = new Date(d);
                                merged.setHours(prev.getHours(), prev.getMinutes(), 0, 0);
                                setRepDateObj(merged);
                                setShowRepTime(true); // luego hora
                              } else {
                                if (selected) setRepDateObj(selected);
                              }
                            }}
                          />
                        )}

                        {showRepTime && (
                          <DateTimePicker
                            value={repDateObj ?? new Date()}
                            mode="time"
                            is24Hour
                            display={Platform.OS === "ios" ? "spinner" : "default"}
                            onChange={(event: DateTimePickerEvent, selected?: Date) => {
                              if (Platform.OS === "android") {
                                setShowRepTime(false);
                                if (event.type === "dismissed") return;

                                const t = selected ?? new Date();
                                const base = repDateObj ?? new Date();
                                const merged = new Date(base);
                                merged.setHours(t.getHours(), t.getMinutes(), 0, 0);

                                setRepDateObj(merged);
                                setRepFechaHora(formatDateTime(merged));
                              } else {
                                if (selected) setRepDateObj(selected);
                              }
                            }}
                          />
                        )}

                        {/* iOS: confirmar/cancelar */}
                        {Platform.OS === "ios" && (showRepDate || showRepTime) && (
                          <View style={[styles.row, { marginTop: 10 }]}>
                            <Pressable
                              style={[styles.btnGhost, styles.mr10]}
                              onPress={() => {
                                setShowRepDate(false);
                                setShowRepTime(false);
                              }}
                            >
                              <Text style={styles.btnGhostText}>Cancelar</Text>
                            </Pressable>

                            <Pressable
                              style={styles.btnPrimary}
                              onPress={() => {
                                const d = repDateObj ?? new Date();
                                setRepFechaHora(formatDateTime(d));
                                setShowRepDate(false);
                                setShowRepTime(false);
                              }}
                            >
                              <Ionicons name="checkmark" size={16} color="white" />
                              <Text style={styles.btnPrimaryText}>Aceptar</Text>
                            </Pressable>
                          </View>
                        )}
                      </Field>

                      {repClase === "VOLUNTARIO" && (
                        <>
                          <Field label="Ubicación *" icon="map-marker-outline">
                            <TextInput
                              style={styles.input}
                              placeholder="Lugar del evento"
                              placeholderTextColor="#8a96a3"
                              value={repUbicacion}
                              onChangeText={setRepUbicacion}
                            />
                          </Field>

                          <Field label="¿Desea reportar de forma anónima?" icon="incognito">
                            <View style={[styles.row, { marginTop: 8, flexWrap: "wrap" }]}>
                              {[
                                { label: "Sí", value: true },
                                { label: "No", value: false },
                              ].map((opt) => (
                                <Pressable
                                  key={opt.label}
                                  style={[styles.chip, repEsAnonimo === opt.value && styles.chipActive, styles.mr10, { marginBottom: 8 }]}
                                  onPress={() => setRepEsAnonimo(opt.value)}
                                >
                                  <Text style={[styles.chipText, repEsAnonimo === opt.value && styles.chipTextActive]}>{opt.label}</Text>
                                </Pressable>
                              ))}
                            </View>
                          </Field>
                        </>
                      )}

                      {repClase === "SMS" && (
                      <Field label="Misión asociada *" icon="map-marker-path">
                              <Pressable
                                onPress={() => {
                                  closeKeyboard();
                                  setShowMisionSelectModal(true);
                                }}
                                style={({ pressed }) => [
                                  styles.input,
                                  styles.datePressable,
                                  pressed && { opacity: 0.92 },
                                ]}
                              >
                                <Text
                                  style={{
                                    color: repMisionId ? "#1b2b3a" : "#8a96a3",
                                    flex: 1,
                                  }}
                                  numberOfLines={2}
                                >
                                  {repMisionSelected
                                    ? `${repMisionSelected.titulo || "Misión"} · ${String(repMisionSelected.fechaOperacion).slice(0, 10)}`
                                    : "Selecciona una misión"}
                                </Text>

                                <Ionicons name="chevron-down" size={18} color="#111918" />
                              </Pressable>

                              <Text style={styles.helpText}>
                                Selecciona la misión donde ocurrió el evento (para análisis SPI).
                              </Text>
                            </Field>
                      )}

                      {repClase === "VOLUNTARIO" && (
                        <Field label="Adjuntar evidencia" icon="paperclip">
                          <View style={[styles.row, { marginTop: 8, gap: 10 }]}>
                            <Pressable style={styles.btnOutline} onPress={pickReportAttachments}>
                              <Ionicons name="attach-outline" size={16} color="#111918" />
                              <Text style={styles.btnOutlineText}>Agregar archivo</Text>
                            </Pressable>
                            <Text style={styles.muted}>{reportAttachments.length} adjunto(s)</Text>
                          </View>
                        </Field>
                      )}

                      {repClase === "MOR" && (
                        <>
                          <Field label="Fecha actualización del reporte" icon="calendar-edit">
                            <TextInput
                              style={styles.input}
                              placeholder="YYYY-MM-DD"
                              placeholderTextColor="#8a96a3"
                              value={morExtra.fechaActualizacion}
                              onChangeText={(v) => setMorField("fechaActualizacion", v)}
                            />
                          </Field>

                          <Field label="NIT del proveedor" icon="card-account-details-outline">
                            <TextInput
                              style={styles.input}
                              placeholder="NIT"
                              placeholderTextColor="#8a96a3"
                              value={morExtra.proveedorNit}
                              onChangeText={(v) => setMorField("proveedorNit", v)}
                            />
                          </Field>

                          <Field label="Nombre comercial proveedor" icon="domain">
                            <TextInput
                              style={styles.input}
                              placeholder="Nombre comercial"
                              placeholderTextColor="#8a96a3"
                              value={morExtra.proveedorNombre}
                              onChangeText={(v) => setMorField("proveedorNombre", v)}
                            />
                          </Field>

                          <Field label="Tipo proveedor" icon="briefcase-outline">
                            <View style={[styles.row, { marginTop: 8, flexWrap: "wrap" }]}>
                              {["Operador UAS", "Empresa de trabajos aéreos con UAS", "Centro de entrenamiento UAS", "Fabricante o integrador", "Otro"].map((v) => (
                                <Pressable key={v} style={[styles.chip, morExtra.tipoProveedor === v && styles.chipActive, styles.mr10, { marginBottom: 8 }]} onPress={() => setMorField("tipoProveedor", v)}>
                                  <Text style={[styles.chipText, morExtra.tipoProveedor === v && styles.chipTextActive]}>{v}</Text>
                                </Pressable>
                              ))}
                            </View>
                          </Field>

                          {morExtra.tipoProveedor === "Otro" && (
                            <Field label="Tipo proveedor (otro)" icon="pencil-outline">
                              <TextInput
                                style={styles.input}
                                placeholder="Especifica tipo proveedor"
                                placeholderTextColor="#8a96a3"
                                value={morExtra.tipoProveedorOtro}
                                onChangeText={(v) => setMorField("tipoProveedorOtro", v)}
                              />
                            </Field>
                          )}

                          <Field label="Modalidad operación" icon="drone">
                            <View style={[styles.row, { marginTop: 8, flexWrap: "wrap" }]}>
                              {["Comercial", "Recreativa", "Seguridad / vigilancia", "Fotogrametría", "Agricultura", "Inspección de infraestructura", "Otro"].map((v) => (
                                <Pressable key={v} style={[styles.chip, morExtra.modalidadOperacion === v && styles.chipActive, styles.mr10, { marginBottom: 8 }]} onPress={() => setMorField("modalidadOperacion", v)}>
                                  <Text style={[styles.chipText, morExtra.modalidadOperacion === v && styles.chipTextActive]}>{v}</Text>
                                </Pressable>
                              ))}
                            </View>
                          </Field>

                          <Field label="Hora local del evento" icon="clock-outline">
                            <TextInput
                              style={styles.input}
                              placeholder="HH:mm"
                              placeholderTextColor="#8a96a3"
                              value={morHoraLocal}
                              onChangeText={setMorHoraLocal}
                            />
                          </Field>

                          <Field label="Ciudad / Municipio" icon="map-marker-outline">
                            <TextInput
                              style={styles.input}
                              placeholder="Ciudad o municipio"
                              placeholderTextColor="#8a96a3"
                              value={morCiudad}
                              onChangeText={setMorCiudad}
                            />
                          </Field>

                          <Field label="Zona de operación" icon="map-outline">
                            <View style={[styles.row, { marginTop: 8, flexWrap: "wrap" }]}>
                              {["Zona urbana", "Zona rural"].map((v) => (
                                <Pressable key={v} style={[styles.chip, morExtra.zonaOperacion === v && styles.chipActive, styles.mr10, { marginBottom: 8 }]} onPress={() => setMorField("zonaOperacion", v)}>
                                  <Text style={[styles.chipText, morExtra.zonaOperacion === v && styles.chipTextActive]}>{v}</Text>
                                </Pressable>
                              ))}
                            </View>
                          </Field>

                          <Field label="Condición meteorológica" icon="weather-partly-cloudy">
                            <View style={[styles.row, { marginTop: 8, flexWrap: "wrap" }]}>
                              {["VFR", "IFR"].map((v) => (
                                <Pressable key={v} style={[styles.chip, morExtra.condicionMeteorologica === v && styles.chipActive, styles.mr10, { marginBottom: 8 }]} onPress={() => setMorField("condicionMeteorologica", v)}>
                                  <Text style={[styles.chipText, morExtra.condicionMeteorologica === v && styles.chipTextActive]}>{v}</Text>
                                </Pressable>
                              ))}
                            </View>
                          </Field>

                          <Field label="Latitud" icon="crosshairs-gps">
                            <TextInput style={styles.input} value={morExtra.latitud} onChangeText={(v) => setMorField("latitud", v)} placeholder="Ej: 4.7110" placeholderTextColor="#8a96a3" />
                          </Field>

                          <Field label="Longitud" icon="crosshairs-gps">
                            <TextInput style={styles.input} value={morExtra.longitud} onChangeText={(v) => setMorField("longitud", v)} placeholder="Ej: -74.0721" placeholderTextColor="#8a96a3" />
                          </Field>

                          <Field label="Altitud aproximada" icon="image-filter-hdr">
                            <TextInput style={styles.input} value={morExtra.altitudAprox} onChangeText={(v) => setMorField("altitudAprox", v)} placeholder="m" placeholderTextColor="#8a96a3" />
                          </Field>

                          <Field label="Aeródromo OACI" icon="airport">
                            <TextInput style={styles.input} value={morExtra.oaci} onChangeText={(v) => setMorField("oaci", v)} placeholder="SKBO" placeholderTextColor="#8a96a3" />
                          </Field>

                          <Field label="Aeródromo nombre" icon="office-building-marker-outline">
                            <TextInput style={styles.input} value={morExtra.aerodromoNombre} onChangeText={(v) => setMorField("aerodromoNombre", v)} placeholder="Nombre del aeródromo" placeholderTextColor="#8a96a3" />
                          </Field>

                          <Field label="Tipo de contacto visual" icon="eye-outline">
                            <View style={[styles.row, { marginTop: 8, flexWrap: "wrap" }]}>
                              {["VLOS", "EVLOS", "BVLOS"].map((v) => (
                                <Pressable key={v} style={[styles.chip, morExtra.tipoContactoVisual === v && styles.chipActive, styles.mr10, { marginBottom: 8 }]} onPress={() => setMorField("tipoContactoVisual", v)}>
                                  <Text style={[styles.chipText, morExtra.tipoContactoVisual === v && styles.chipTextActive]}>{v}</Text>
                                </Pressable>
                              ))}
                            </View>
                          </Field>

                          <Field label="Fase de operación" icon="timeline-clock-outline">
                            <View style={[styles.row, { marginTop: 8, flexWrap: "wrap" }]}>
                              {["Pre-vuelo", "Despegue", "Ascenso", "Misión / Operación", "Aproximación", "Aterrizaje", "Post vuelo"].map((v) => (
                                <Pressable key={v} style={[styles.chip, morExtra.faseOperacion === v && styles.chipActive, styles.mr10, { marginBottom: 8 }]} onPress={() => setMorField("faseOperacion", v)}>
                                  <Text style={[styles.chipText, morExtra.faseOperacion === v && styles.chipTextActive]}>{v}</Text>
                                </Pressable>
                              ))}
                            </View>
                          </Field>

                          <Field label="Aeronave 1 · Identificación / Serial" icon="identifier">
                            <TextInput style={styles.input} value={morExtra.aeronave1Identificacion} onChangeText={(v) => setMorField("aeronave1Identificacion", v)} placeholder="Serial aeronave 1" placeholderTextColor="#8a96a3" />
                          </Field>
                          <Field label="Aeronave 1 · Marca" icon="drone">
                            <TextInput style={styles.input} value={morExtra.aeronave1Marca} onChangeText={(v) => setMorField("aeronave1Marca", v)} placeholder="Marca aeronave 1" placeholderTextColor="#8a96a3" />
                          </Field>
                          <Field label="Aeronave 1 · Modelo" icon="drone">
                            <TextInput style={styles.input} value={morExtra.aeronave1Modelo} onChangeText={(v) => setMorField("aeronave1Modelo", v)} placeholder="Modelo aeronave 1" placeholderTextColor="#8a96a3" />
                          </Field>
                          <Field label="Aeronave 1 · MTOW" icon="weight-kilogram">
                            <TextInput style={styles.input} value={morExtra.aeronave1Mtow} onChangeText={(v) => setMorField("aeronave1Mtow", v)} placeholder="Peso máx despegue" placeholderTextColor="#8a96a3" />
                          </Field>
                          <Field label="Aeronave 1 · Tipo" icon="airplane-marker">
                            <View style={[styles.row, { marginTop: 8, flexWrap: "wrap" }]}>
                              {["Multirrotor", "Ala fija", "Híbrido VTOL", "Helicóptero"].map((v) => (
                                <Pressable key={v} style={[styles.chip, morExtra.aeronave1Tipo === v && styles.chipActive, styles.mr10, { marginBottom: 8 }]} onPress={() => setMorField("aeronave1Tipo", v)}>
                                  <Text style={[styles.chipText, morExtra.aeronave1Tipo === v && styles.chipTextActive]}>{v}</Text>
                                </Pressable>
                              ))}
                            </View>
                          </Field>

                          <Field label="Aeronave 2 · Identificación / Serial" icon="identifier">
                            <TextInput style={styles.input} value={morExtra.aeronave2Identificacion} onChangeText={(v) => setMorField("aeronave2Identificacion", v)} placeholder="Serial aeronave 2 (si aplica)" placeholderTextColor="#8a96a3" />
                          </Field>
                          <Field label="Aeronave 2 · Marca" icon="drone">
                            <TextInput style={styles.input} value={morExtra.aeronave2Marca} onChangeText={(v) => setMorField("aeronave2Marca", v)} placeholder="Marca aeronave 2" placeholderTextColor="#8a96a3" />
                          </Field>
                          <Field label="Aeronave 2 · Modelo" icon="drone">
                            <TextInput style={styles.input} value={morExtra.aeronave2Modelo} onChangeText={(v) => setMorField("aeronave2Modelo", v)} placeholder="Modelo aeronave 2" placeholderTextColor="#8a96a3" />
                          </Field>

                          <Field label="Piloto al mando · Nombre" icon="account-outline">
                            <TextInput style={styles.input} value={morExtra.pilotoNombre} onChangeText={(v) => setMorField("pilotoNombre", v)} placeholder="Nombre piloto al mando" placeholderTextColor="#8a96a3" />
                          </Field>
                          <Field label="Piloto al mando · Documento" icon="card-account-details-outline">
                            <TextInput style={styles.input} value={morExtra.pilotoDocumento} onChangeText={(v) => setMorField("pilotoDocumento", v)} placeholder="Documento piloto" placeholderTextColor="#8a96a3" />
                          </Field>
                          <Field label="Piloto al mando · Certificado idoneidad" icon="file-document-outline">
                            <TextInput style={styles.input} value={morExtra.pilotoCertificado} onChangeText={(v) => setMorField("pilotoCertificado", v)} placeholder="Certificado piloto" placeholderTextColor="#8a96a3" />
                          </Field>

                          <Field label="Piloto observador · Nombre" icon="account-eye-outline">
                            <TextInput style={styles.input} value={morExtra.observadorNombre} onChangeText={(v) => setMorField("observadorNombre", v)} placeholder="Nombre observador" placeholderTextColor="#8a96a3" />
                          </Field>
                          <Field label="Piloto observador · Documento" icon="card-account-details-outline">
                            <TextInput style={styles.input} value={morExtra.observadorDocumento} onChangeText={(v) => setMorField("observadorDocumento", v)} placeholder="Documento observador" placeholderTextColor="#8a96a3" />
                          </Field>
                          <Field label="Piloto observador · Certificado idoneidad" icon="file-document-outline">
                            <TextInput style={styles.input} value={morExtra.observadorCertificado} onChangeText={(v) => setMorField("observadorCertificado", v)} placeholder="Certificado observador" placeholderTextColor="#8a96a3" />
                          </Field>

                          <Field label="Detalle del evento obligatorio" icon="clipboard-text-outline">
                            <TextInput style={styles.input} value={morExtra.tipoDetalleEvento} onChangeText={(v) => setMorField("tipoDetalleEvento", v)} placeholder="Detalle adicional del evento" placeholderTextColor="#8a96a3" />
                          </Field>

                          <Field label="Evidencia" icon="paperclip">
                            <View style={[styles.row, { marginTop: 8, flexWrap: "wrap" }]}>
                              {[
                                ["evidenciaFotos", "Fotografías"],
                                ["evidenciaVideo", "Video"],
                                ["evidenciaLogVuelo", "Log de vuelo"],
                                ["evidenciaTelemetria", "Telemetría"],
                                ["evidenciaOtros", "Otros"],
                              ].map(([k, label]) => {
                                const checked = !!(morExtra as any)[k];
                                return (
                                  <Pressable key={k} style={[styles.chip, checked && styles.chipActive, styles.mr10, { marginBottom: 8 }]} onPress={() => setMorField(k, !checked)}>
                                    <Text style={[styles.chipText, checked && styles.chipTextActive]}>{label}</Text>
                                  </Pressable>
                                );
                              })}
                            </View>
                          </Field>

                          {morExtra.evidenciaOtros && (
                            <Field label="Evidencia otros (detalle)" icon="text-box-outline">
                              <TextInput style={styles.input} value={morExtra.evidenciaOtrosDetalle} onChangeText={(v) => setMorField("evidenciaOtrosDetalle", v)} placeholder="Detalle de otros soportes" placeholderTextColor="#8a96a3" />
                            </Field>
                          )}

                          <Field label="Causa posible 1" icon="help-circle-outline"><TextInput style={styles.input} value={morExtra.causa1} onChangeText={(v) => setMorField("causa1", v)} placeholderTextColor="#8a96a3" /></Field>
                          <Field label="Causa posible 2" icon="help-circle-outline"><TextInput style={styles.input} value={morExtra.causa2} onChangeText={(v) => setMorField("causa2", v)} placeholderTextColor="#8a96a3" /></Field>
                          <Field label="Causa posible 3" icon="help-circle-outline"><TextInput style={styles.input} value={morExtra.causa3} onChangeText={(v) => setMorField("causa3", v)} placeholderTextColor="#8a96a3" /></Field>
                          <Field label="Causa posible 4" icon="help-circle-outline"><TextInput style={styles.input} value={morExtra.causa4} onChangeText={(v) => setMorField("causa4", v)} placeholderTextColor="#8a96a3" /></Field>
                          <Field label="Causa posible 5" icon="help-circle-outline"><TextInput style={styles.input} value={morExtra.causa5} onChangeText={(v) => setMorField("causa5", v)} placeholderTextColor="#8a96a3" /></Field>
                        </>
                      )}




                      <Field label="Descripción Detallada *" icon="text-box-outline">
                        <TextInput
                          style={[styles.input, styles.textArea]}
                          placeholder="Describa el evento..."
                          placeholderTextColor="#8a96a3"
                          value={repDescripcion}
                          onChangeText={setRepDescripcion}
                          multiline
                        />
                        <View style={[styles.row, { marginTop: 8, flexWrap: "wrap", gap: 10 }]}>
                          <Pressable style={styles.btnOutline} onPress={() => startQuickDictation("report")}>
                            <Ionicons name="mic-outline" size={16} color="#111918" />
                            <Text style={styles.btnOutlineText}>Nota rápida por voz</Text>
                          </Pressable>
                          <Pressable style={styles.btnOutline} onPress={pickReportAttachments}>
                            <Ionicons name="attach-outline" size={16} color="#111918" />
                            <Text style={styles.btnOutlineText}>Adjuntos rápidos</Text>
                          </Pressable>
                        </View>
                      </Field>

                      {repClase === "MOR" && (
                        <>
                          <Field label="Narrativa MOR (secuencia y acciones)" icon="file-document-outline">
                            <TextInput
                              style={[styles.input, styles.textArea]}
                              placeholder="Narrativa detallada del evento MOR..."
                              placeholderTextColor="#8a96a3"
                              value={morNarrativa}
                              onChangeText={setMorNarrativa}
                              multiline
                            />
                          </Field>

                          <View style={styles.kvRow}>
                            <Field label="Riesgo MOR" icon="alert-decagram-outline">
                              <View style={[styles.row, { marginTop: 8, flexWrap: "wrap" }]}>
                                {["Aceptable", "Tolerable", "Inaceptable"].map((nivel) => (
                                  <Pressable
                                    key={nivel}
                                    style={[styles.chip, morRiesgo === nivel && styles.chipActive, styles.mr10, { marginBottom: 8 }]}
                                    onPress={() => setMorRiesgo(nivel)}
                                  >
                                    <Text style={[styles.chipText, morRiesgo === nivel && styles.chipTextActive]}>{nivel}</Text>
                                  </Pressable>
                                ))}
                              </View>
                            </Field>
                          </View>

                          <Field label="Nombre de quien reporta" icon="account-outline">
                            <TextInput
                              style={styles.input}
                              placeholder="Nombre del reportante"
                              placeholderTextColor="#8a96a3"
                              value={morReportaNombre}
                              onChangeText={setMorReportaNombre}
                            />
                          </Field>

                          <Field label="Correo de quien reporta" icon="email-outline">
                            <TextInput
                              style={styles.input}
                              placeholder="correo@dominio.com"
                              placeholderTextColor="#8a96a3"
                              value={morReportaCorreo}
                              onChangeText={setMorReportaCorreo}
                            />
                          </Field>

                          <Field label="Cargo de quien reporta" icon="badge-account-outline">
                            <TextInput
                              style={styles.input}
                              placeholder="Cargo"
                              placeholderTextColor="#8a96a3"
                              value={morExtra.reportaCargo}
                              onChangeText={(v) => setMorField("reportaCargo", v)}
                            />
                          </Field>

                          <Field label="Contacto de quien reporta" icon="phone-outline">
                            <TextInput
                              style={styles.input}
                              placeholder="Número de contacto"
                              placeholderTextColor="#8a96a3"
                              value={morExtra.reportaContacto}
                              onChangeText={(v) => setMorField("reportaContacto", v)}
                            />
                          </Field>

                          <Field label="Firma (declaración)" icon="draw-pen">
                            <TextInput
                              style={styles.input}
                              placeholder="Nombre/Firma"
                              placeholderTextColor="#8a96a3"
                              value={morExtra.firma}
                              onChangeText={(v) => setMorField("firma", v)}
                            />
                          </Field>

                          <Field label="Fecha firma" icon="calendar-check-outline">
                            <TextInput
                              style={styles.input}
                              placeholder="YYYY-MM-DD"
                              placeholderTextColor="#8a96a3"
                              value={morExtra.fechaFirma}
                              onChangeText={(v) => setMorField("fechaFirma", v)}
                            />
                          </Field>
                        </>
                      )}

                      <Field label="Gravedad Percibida *" icon="alert-outline">
                        <View style={[styles.row, { marginTop: 8, flexWrap: "wrap" }]}>
                          {["Baja", "Media", "Alta", "Crítica"].map((nivel) => (
                            <Pressable
                              key={nivel}
                              style={[styles.chip, repGravedad === nivel && styles.chipActive, styles.mr10, { marginBottom: 8 }]}
                              onPress={() => setRepGravedad(nivel)}
                            >
                              <Text style={[styles.chipText, repGravedad === nivel && styles.chipTextActive]}>{nivel}</Text>
                            </Pressable>
                          ))}
                        </View>
                      </Field>

                      {!!reportAttachments.length && (
                        <View style={styles.cardSoft}>
                          <Text style={styles.cardTitle}>Adjuntos rápidos</Text>
                          {reportAttachments.map((item) => (
                            <View key={item.id} style={styles.summaryRow}>
                              <Text style={styles.summaryLabel} numberOfLines={1}>{item.name}</Text>
                              <Pressable onPress={() => removeReportAttachment(item.id)}>
                                <Text style={styles.summaryAction}>Quitar</Text>
                              </Pressable>
                            </View>
                          ))}
                        </View>
                      )}

                      {!!similarReports.length && (
                        <View style={styles.cardSoft}>
                          <Text style={styles.cardTitle}>Eventos similares</Text>
                          {similarReports.map((item) => (
                            <View key={item._id} style={styles.summaryRow}>
                              <View style={{ flex: 1 }}>
                                <Text style={styles.summaryLabel}>{item.tipo}</Text>
                                <Text style={styles.muted}>{item.fecha}</Text>
                              </View>
                              <Text style={styles.summaryValue}>{item.estado}</Text>
                            </View>
                          ))}
                        </View>
                      )}

                      <View style={[styles.row, { marginTop: 10 }]}>
                        <Pressable style={[styles.btnPrimary, styles.mr10]} onPress={submitReporte}>
                          <Ionicons name="send" size={16} color="white" />
                          <Text style={styles.btnPrimaryText}>Enviar</Text>
                        </Pressable>

                        <Pressable style={styles.btnGhost} onPress={() => setRepFormOpen(false)}>
                          <Text style={styles.btnGhostText}>Cancelar</Text>
                        </Pressable>
                      </View>
                    </>
                  ) : (
                    <Text style={styles.muted}>Pulsa “Nuevo” para abrir el formulario.</Text>
                  )}
                </View>
              )}


              <Modal
                      visible={showMisionSelectModal}
                      animationType="fade"
                      transparent
                      statusBarTranslucent
                      presentationStyle="overFullScreen"
                      onRequestClose={() => setShowMisionSelectModal(false)}
                    >
                      <View style={styles.modalOverlayCenter}>
                        <View style={[styles.modalCardPro, { maxHeight: "80%" }]}>
                          <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Misión asociada</Text>

                            <Pressable onPress={() => setShowMisionSelectModal(false)}>
                              <Ionicons name="close" size={22} color="#111918" />
                            </Pressable>
                          </View>

                          {/* Sin misión */}
                          <Pressable
                            style={[styles.btnOutline, { marginTop: 12, justifyContent: "center" }]}
                            onPress={() => {
                              setRepMisionId("");
                              setShowMisionSelectModal(false);
                            }}
                          >
                          </Pressable>

                          <ScrollView style={{ marginTop: 12 }} showsVerticalScrollIndicator={false}>
                            {(misiones || [])
                              .filter((m) => m.estado !== "Cumplida")
                              .map((m) => {
                                const selected = repMisionId === m._id;

                                return (
                                  <Pressable
                                    key={m._id}
                                    onPress={() => {
                                      setRepMisionId(m._id);
                                      setShowMisionSelectModal(false);
                                    }}
                                    style={[styles.equipoItem, selected && styles.equipoItemActive]}
                                  >
                                    <Text style={styles.equipoTitle}>{m.titulo || "Misión"}</Text>
                                    <Text style={styles.equipoMeta}>
                                      {String(m.fechaOperacion).slice(0, 10)} · {m.estado}
                                    </Text>
                                    {!!m.ubicacionGeneral && (
                                      <Text style={styles.equipoMeta}>Ubicación: {m.ubicacionGeneral}</Text>
                                    )}
                                  </Pressable>
                                );
                              })}

                            <View style={{ height: 10 }} />
                          </ScrollView>
                        </View>
                      </View>
                    </Modal>


              {/* MIS REPORTES */}
              {section === "my-reports" && (
                <>
                  <View style={styles.rowBetween}>
                    <View />
                      <View style={[styles.row, { gap: 10, flexWrap: "wrap", marginBottom: 12 }]}>
                        <Pressable
                          style={styles.btnOutline}
                          onPress={() => {
                            setRepClase("SMS");
                            setRepFormOpen(true);
                            goSection("new-report");
                          }}
                        >
                          <Ionicons name="add" size={16} color="#111918" />
                          <Text style={styles.btnOutlineText}>Nuevo SMS</Text>
                        </Pressable>

                        <Pressable
                          style={styles.btnOutline}
                          onPress={() => {
                            setShowIncidentModal(true);
                          }}
                        >
                          <Ionicons name="alert-circle-outline" size={16} color="#111918" />
                          <Text style={styles.btnOutlineText}>Nuevo incidente</Text>
                        </Pressable>
                      </View>
                  </View>

                  {loadingReportes ? (
                    <View style={styles.loadingBox}>
                      <ActivityIndicator />
                      <Text style={styles.muted}>Cargando reportes...</Text>
                    </View>
                  ) : reportesVisibles.length === 0 ? (
                    <View style={styles.emptyCard}>
                      <MaterialCommunityIcons name="clipboard-text-outline" size={22} color="#6b7a8a" />
                      <Text style={styles.muted}>No hay reportes SMS.</Text>
                    </View>
                  ) : (
                    reportesPaginados.map((r) => (
                      <View key={r._id} style={styles.reportCard}>
                        <View style={styles.rowBetween}>
                          <View style={styles.row}>
                            <Text style={styles.reportId}>{r._id}</Text>
                            <View style={[styles.pill, reportStateStyle(r.estado), styles.ml8]}>
                              <Text style={styles.pillText}>{r.estado}</Text>
                            </View>
                          </View>

                          <Pressable
                            style={styles.btnMini}
                            onPress={() => {
                              setSelectedReporte(r);
                              setShowReportDetailModal(true);
                            }}
                          >
                            <Text style={styles.btnMiniText}>Ver</Text>
                          </Pressable>
                        </View>

                        <Text style={styles.reportMeta}>
                          {r.fecha} · {r.tipoLabel || r.tipoCode || r.tipo}
                        </Text>
                        <Text style={styles.reportDesc}>{r.descripcion}</Text>
                      </View>
                    ))
                  )}

                  {reportesVisibles.length > 0 && (
                    <View style={styles.paginationRow}>
                      <Pressable
                        style={[styles.btnMini, reportesPage <= 1 && styles.paginationBtnDisabled]}
                        disabled={reportesPage <= 1}
                        onPress={() => setReportesPage((prev) => Math.max(1, prev - 1))}
                      >
                        <Text style={styles.btnMiniText}>Anterior</Text>
                      </Pressable>

                      <Text style={styles.paginationText}>
                        Página {reportesPage} de {reportesPages}
                      </Text>

                      <Pressable
                        style={[styles.btnMini, reportesPage >= reportesPages && styles.paginationBtnDisabled]}
                        disabled={reportesPage >= reportesPages}
                        onPress={() => setReportesPage((prev) => Math.min(reportesPages, prev + 1))}
                      >
                        <Text style={styles.btnMiniText}>Siguiente</Text>
                      </Pressable>
                    </View>
                  )}
                </>
              )}

              {/* BITÁCORA */}
              {section === "flight-log" && (
                <>
                  <View style={styles.rowBetween}>
                    <Text style={styles.sectionTitle}>Registro Vuelos</Text>

                    <View style={styles.row}>
                      <Pressable style={[styles.btnOutline, styles.mr10]} onPress={() => setShowNewFlightModal(true)}>
                        <Ionicons name="add" size={16} color="#111918" />
                        <Text style={styles.btnOutlineText}>Nuevo</Text>
                      </Pressable>

                      <Pressable style={styles.btnOutline} onPress={generarCertificadoHorasUI}>
                        <Ionicons name="time-outline" size={16} color="#111918" />
                        <Text style={styles.btnOutlineText}>Total Horas</Text>
                      </Pressable>
                    </View>
                  </View>

                  <View style={styles.card}>
                    <Text style={styles.cardTitle}>Resumen de bitácora</Text>
                    <View style={styles.kpiDeck}>
                      <View style={styles.kpiTile}>
                        <Text style={styles.kpiTileValue}>{horasDelMes.toFixed(1)} h</Text>
                        <Text style={styles.kpiTileLabel}>Horas del mes</Text>
                      </View>
                      <View style={styles.kpiTile}>
                        <Text style={styles.kpiTileValue}>{syncSummary.vuelos}</Text>
                        <Text style={styles.kpiTileLabel}>Pendientes sync</Text>
                      </View>
                      <View style={styles.kpiTile}>
                        <Text style={styles.kpiTileValue}>{logsPendientes}</Text>
                        <Text style={styles.kpiTileLabel}>Logs por subir</Text>
                      </View>
                    </View>

                    {!!horasPorAeronave.length && (
                      <View style={{ marginTop: 8 }}>
                        <Text style={styles.kLabel}>Horas por aeronave</Text>
                        {horasPorAeronave.map((item) => (
                          <View key={item.uas} style={styles.summaryRow}>
                            <Text style={styles.summaryLabel}>{item.uas}</Text>
                            <Text style={styles.summaryValue}>{item.horas.toFixed(1)} h</Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>

                  <View style={[styles.card, { marginBottom: 12 }]}>
                    <View style={styles.rowBetween}>
                      <View style={{ flex: 1, paddingRight: 10 }}>
                        <Text style={styles.cardTitle}>Bitácora firmada</Text>
                        <Text style={styles.muted}>Solicita al jefe de pilotos la bitácora de vuelo en PDF con firma.</Text>
                      </View>
                      <Pressable
                        style={[styles.btnOutline, bitacoraSolicitando && { opacity: 0.6 }]}
                        disabled={bitacoraSolicitando}
                        onPress={solicitarBitacoraVuelo}
                      >
                        {bitacoraSolicitando ? (
                          <ActivityIndicator size="small" color="#111918" />
                        ) : (
                          <Ionicons name="document-text-outline" size={16} color="#111918" />
                        )}
                        <Text style={styles.btnOutlineText}>Solicitar</Text>
                      </Pressable>
                    </View>

                    {bitacoraSolicitudesLoading ? (
                      <View style={[styles.loadingBox, { paddingVertical: 12 }]}>
                        <ActivityIndicator />
                        <Text style={styles.muted}>Cargando solicitudes...</Text>
                      </View>
                    ) : bitacoraSolicitudes.length === 0 ? (
                      <Text style={[styles.muted, { marginTop: 10 }]}>Aún no tienes solicitudes de bitácora.</Text>
                    ) : (
                      <View style={{ marginTop: 10 }}>
                        {bitacoraSolicitudes.slice(0, 3).map((s: any) => {
                          const estado = String(s?.estado || "").toLowerCase();
                          const aprobada = estado === "aprobada";
                          return (
                            <View key={String(s?._id)} style={styles.summaryRow}>
                              <View style={{ flex: 1 }}>
                                <Text style={styles.summaryLabel}>{formatDateOnly(s?.fechaSolicitud || s?.createdAt)}</Text>
                                <Text style={styles.muted}>{bitacoraSolicitudEstadoLabel(s)}</Text>
                              </View>
                              {aprobada ? (
                                <Pressable style={styles.btnMini} onPress={() => descargarBitacoraFirmada(String(s?._id || ""))}>
                                  <Text style={styles.btnMiniText}>Descargar</Text>
                                </Pressable>
                              ) : (
                                <View style={[styles.statusBadge, styles.statusBadgeWarn]}>
                                  <Text style={styles.statusBadgeText}>Pendiente</Text>
                                </View>
                              )}
                            </View>
                          );
                        })}
                      </View>
                    )}
                  </View>

                  <View style={[styles.card, { marginBottom: 12 }]}>
                    <Text style={styles.cardTitle}>Filtros</Text>
                    <Field label="Fecha" icon="calendar-outline">
                      <Pressable
                        style={[styles.input, styles.datePressable]}
                        onPress={() => setShowFlightFilterDate(true)}
                      >
                        <Text style={[styles.inputText, !flightFilterDate && styles.placeholderText]}>
                          {flightFilterDate || "Seleccionar fecha"}
                        </Text>
                        <Ionicons name="calendar-outline" size={18} color="#4f5e6e" />
                      </Pressable>
                    </Field>
                    <Field label="Aeronave" icon="drone">
                      <Pressable
                        style={[styles.input, styles.datePressable]}
                        onPress={() => setShowFlightFilterUasModal(true)}
                      >
                        <Text style={[styles.inputText, !flightFilterUas && styles.placeholderText]}>
                          {flightFilterUas || "Todas las aeronaves"}
                        </Text>
                        <Ionicons name="chevron-down" size={18} color="#111918" />
                      </Pressable>
                    </Field>
                    <Field label="Misión" icon="map-marker-path">
                      <Pressable
                        style={[styles.input, styles.datePressable]}
                        onPress={() => setShowFlightFilterMissionModal(true)}
                      >
                        <Text style={[styles.inputText, !flightFilterMission && styles.placeholderText]}>
                          {selectedBitacoraMissionLabel || "Todas las misiones"}
                        </Text>
                        <Ionicons name="chevron-down" size={18} color="#111918" />
                      </Pressable>
                    </Field>
                    <View style={styles.row}>
                      <Pressable
                        style={[styles.btnOutline, { marginTop: 6 }]}
                        onPress={() => {
                          setFlightFilterDate("");
                          setFlightFilterUas("");
                          setFlightFilterMission("");
                        }}
                      >
                        <Ionicons name="close-circle-outline" size={16} color="#111918" />
                        <Text style={styles.btnOutlineText}>Limpiar filtros</Text>
                      </Pressable>
                    </View>
                  </View>

                  {showFlightFilterDate && (
                    <DateTimePicker
                      value={flightFilterDate ? new Date(`${flightFilterDate}T00:00:00`) : new Date()}
                      mode="date"
                      display={Platform.OS === "ios" ? "spinner" : "default"}
                      onChange={(event: DateTimePickerEvent, selected?: Date) => {
                        if (Platform.OS !== "ios") setShowFlightFilterDate(false);
                        if (event.type === "dismissed" || !selected) return;
                        setFlightFilterDate(formatDateOnly(selected.toISOString()));
                      }}
                    />
                  )}

                  <Modal
                    visible={showFlightFilterUasModal}
                    animationType="fade"
                    transparent
                    statusBarTranslucent
                    presentationStyle="overFullScreen"
                    onRequestClose={() => setShowFlightFilterUasModal(false)}
                  >
                    <View style={styles.modalOverlayCenter}>
                      <View style={styles.modalCardPro}>
                        <View style={styles.modalHeader}>
                          <Text style={styles.modalTitle}>Filtrar por aeronave</Text>
                          <Pressable onPress={() => setShowFlightFilterUasModal(false)}>
                            <Ionicons name="close" size={22} color="#111918" />
                          </Pressable>
                        </View>
                        <ScrollView style={{ marginTop: 12 }} showsVerticalScrollIndicator={false}>
                          <Pressable
                            style={styles.equipoItem}
                            onPress={() => {
                              setFlightFilterUas("");
                              setShowFlightFilterUasModal(false);
                            }}
                          >
                            <Text style={styles.equipoTitle}>Todas las aeronaves</Text>
                          </Pressable>
                          {bitacoraUasOptions.map((uas) => (
                            <Pressable
                              key={uas}
                              style={[styles.equipoItem, flightFilterUas === uas && styles.equipoItemActive]}
                              onPress={() => {
                                setFlightFilterUas(uas);
                                setShowFlightFilterUasModal(false);
                              }}
                            >
                              <Text style={styles.equipoTitle}>{uas}</Text>
                            </Pressable>
                          ))}
                        </ScrollView>
                      </View>
                    </View>
                  </Modal>

                  <Modal
                    visible={showFlightFilterMissionModal}
                    animationType="fade"
                    transparent
                    statusBarTranslucent
                    presentationStyle="overFullScreen"
                    onRequestClose={() => setShowFlightFilterMissionModal(false)}
                  >
                    <View style={styles.modalOverlayCenter}>
                      <View style={styles.modalCardPro}>
                        <View style={styles.modalHeader}>
                          <Text style={styles.modalTitle}>Filtrar por misión</Text>
                          <Pressable onPress={() => setShowFlightFilterMissionModal(false)}>
                            <Ionicons name="close" size={22} color="#111918" />
                          </Pressable>
                        </View>
                        <ScrollView style={{ marginTop: 12 }} showsVerticalScrollIndicator={false}>
                          <Pressable
                            style={styles.equipoItem}
                            onPress={() => {
                              setFlightFilterMission("");
                              setShowFlightFilterMissionModal(false);
                            }}
                          >
                            <Text style={styles.equipoTitle}>Todas las misiones</Text>
                          </Pressable>
                          {bitacoraMissionOptions.map((m: any) => (
                            <Pressable
                              key={String(m?._id)}
                              style={[
                                styles.equipoItem,
                                String(flightFilterMission) === String(m?._id) && styles.equipoItemActive,
                              ]}
                              onPress={() => {
                                setFlightFilterMission(String(m?._id || ""));
                                setShowFlightFilterMissionModal(false);
                              }}
                            >
                              <Text style={styles.equipoTitle}>{m?.titulo || "Misión"}</Text>
                              <Text style={styles.equipoMeta}>{m?.estado || "Sin estado"}</Text>
                            </Pressable>
                          ))}
                        </ScrollView>
                      </View>
                    </View>
                  </Modal>

                  {loadingVuelos ? (
                    <View style={styles.loadingBox}>
                      <ActivityIndicator />
                      <Text style={styles.muted}>Cargando vuelos...</Text>
                    </View>
                  ) : vuelosFiltrados.length === 0 ? (
                    <View style={styles.emptyCard}>
                      <MaterialCommunityIcons name="airplane-check" size={22} color="#6b7a8a" />
                      <Text style={styles.muted}>No hay vuelos para los filtros actuales.</Text>
                    </View>
                  ) : (
                    vuelosPaginados.map((v: any) => (
                      <View key={v._id} style={styles.flightCard}>
                        <View style={styles.flightHeader}>
                          <Text style={styles.flightTitle} numberOfLines={1}>{v.uas}</Text>
                          <View style={styles.flightBadges}>
                            <View style={[styles.statusBadge, v._local ? styles.statusBadgeWarn : styles.statusBadgeInfo]}>
                              <Text style={styles.statusBadgeText}>{v._local ? "Pendiente" : "Sincronizado"}</Text>
                            </View>
                            <View style={[styles.pill, { backgroundColor: "#e8f0ff", marginLeft: 8 }]}>
                              <Text style={[styles.pillText, { color: "#111918" }]}>{v.tipoOperacion}</Text>
                            </View>
                          </View>
                        </View>

                        <Text style={styles.flightMeta}>{v.fechaHora}</Text>
                        <Text style={styles.flightMeta}>Ubicación: {v.ubicacion}</Text>
                        <Text style={styles.flightMeta}>Propósito: {v.proposito}</Text>
                        {!!v.categoriaOperacion && <Text style={styles.flightMeta}>Categoría: {v.categoriaOperacion}</Text>}
                        <Text style={styles.flightMeta}>Inicio/Fin: {v.horaInicio || "—"} · {v.horaFin || "—"}</Text>

                        <View style={styles.flightBottom}>
                          <Text style={styles.flightDur}>{v.duracionMin} min</Text>
                          <Text style={styles.flightLog}>Log: {v.logUrl ? (String(v.logUrl).includes("PENDIENTE") ? "Pendiente" : "Disponible") : "—"}</Text>
                        </View>

                        {!!v.notas && <Text style={styles.flightNotes}>{v.notas}</Text>}

                        <View style={[styles.row, { marginTop: 10 }]}>
                          <Pressable
                            style={styles.btnMini}
                            onPress={() => {
                              setSelectedVuelo(v);
                              setShowFlightDetailModal(true);
                            }}
                          >
                            <Text style={styles.btnMiniText}>Ver detalle</Text>
                          </Pressable>
                        </View>
                      </View>
                    ))
                  )}

                  {vuelosFiltrados.length > 0 && (
                    <View style={styles.paginationRow}>
                      <Pressable
                        style={[styles.btnMini, bitacoraPage <= 1 && styles.paginationBtnDisabled]}
                        disabled={bitacoraPage <= 1}
                        onPress={() => setBitacoraPage((prev) => Math.max(1, prev - 1))}
                      >
                        <Text style={styles.btnMiniText}>Anterior</Text>
                      </Pressable>

                      <Text style={styles.paginationText}>
                        Página {bitacoraPage} de {bitacoraPages}
                      </Text>

                      <Pressable
                        style={[styles.btnMini, bitacoraPage >= bitacoraPages && styles.paginationBtnDisabled]}
                        disabled={bitacoraPage >= bitacoraPages}
                        onPress={() => setBitacoraPage((prev) => Math.min(bitacoraPages, prev + 1))}
                      >
                        <Text style={styles.btnMiniText}>Siguiente</Text>
                      </Pressable>
                    </View>
                  )}
                </>
              )}

              {/* MISIONES */}
{section === "missions" && (
  <>
    <View style={[styles.rowBetween, { marginBottom: 12, alignItems: "center" }]}>
      <View />
      {canPlanFlyNorthMission ? (
        <Pressable
          style={[styles.btnPrimary, { minWidth: 150, justifyContent: "center" }]}
          onPress={async () => {
            const inMemoryToken = String(ctxToken || token || "").trim();
            const activeToken = inMemoryToken || await getToken();
            if (!activeToken) {
              Toast.show({ type: "error", text1: "Sesión vencida", text2: "Inicia sesión nuevamente." });
              return;
            }
            setMissionPlannerToken(activeToken);
            setShowMissionPlanner(true);
          }}
        >
          <Ionicons name="add-circle-outline" size={17} color="#ffffff" />
          <Text style={styles.btnPrimaryText}>Nueva Operación</Text>
        </Pressable>
      ) : null}
    </View>

    {loadingMisiones ? (
      <View style={styles.loadingBox}>
        <ActivityIndicator />
        <Text style={styles.muted}>Cargando misiones...</Text>
      </View>
    ) : misiones.length === 0 ? (
      <View style={styles.emptyCard}>
        <MaterialCommunityIcons name="map-marker-off-outline" size={22} color="#6b7a8a" />
        <Text style={styles.muted}>No hay misiones.</Text>
      </View>
    ) : (
      <>
        <Text style={styles.subTitle}>Programadas</Text>
        {misionesProgramadasPaginadas.map((m) => {
    const instr = (m.instrucciones || "").trim();
    const prioridad = m.prioridad || "Media";
    const inicio = m.fechaOperacion ? `${formatDateOnly(m.fechaOperacion)} ${formatHourOnly(m.horaInicio)}` : null;
    const tiempoRestante = formatRemainingMinutes(diffMinutesFromNow(inicio));
    const evidenciaCount = Number((m as any)?.evidencias?.length || 0);
    const adjuntos = Array.isArray((m as any)?.adjuntos) ? (m as any).adjuntos : [];
    const autorizacion = (m as any)?.autorizacionVuelo || null;
    const sugerida = m.aeronaveSugerida || equipoSel?.ruas || equipos[0]?.ruas || "Pendiente asignación";
    const relationLabels = getMissionRelationLabels(m, usuario?._id);
    const operationReady =
      m.estadoAprobacion !== "pendiente" &&
      m.estadoAprobacion !== "devuelta" &&
      m.estadoAutorizacionVuelo !== "pendiente_gestion";
    const chiefObserverCanApprove =
      canApproveFlyNorthMission &&
      Boolean(m.relacionUsuario?.soyObservador) &&
      m.estadoAprobacion !== "aprobada" &&
      (m.estadoAutorizacionVuelo === "no_requiere" || Boolean(autorizacion?.key));

    const tieneMapa = !!(m as any)?.areaOperacion || !!m.kmlUrl || !!m.kmzUrl;

    return (
      <View key={m._id} style={styles.missionCard}>
        <View style={styles.rowBetween}>
          <Text style={styles.missionId}>{m._id}</Text>
          <View style={[styles.pill, prioridad === "Alta" ? styles.priorityHigh : prioridad === "Baja" ? styles.priorityLow : styles.priorityMedium]}>
            <Text style={[styles.pillText, { color: prioridadeColor(prioridad) }]}>{prioridad}</Text>
          </View>
        </View>

        {(relationLabels.length > 0 || m.esRepetitiva || m.estadoAprobacion === "pendiente" || m.estadoAprobacion === "aprobada") && (
          <View style={styles.missionRelationRow}>
            {m.esRepetitiva ? (
              <View style={[styles.missionRelationBadge, styles.missionRelationRecurring]}>
                <Text style={styles.missionRelationText}>Repetitiva diaria</Text>
              </View>
            ) : null}
            {m.estadoAprobacion === "pendiente" ? (
              <View style={[styles.missionRelationBadge, styles.missionApprovalPending]}>
                <Text style={styles.missionRelationText}>Pendiente de aprobación</Text>
              </View>
            ) : null}
            {m.estadoAprobacion === "aprobada" ? (
              <View style={[styles.missionRelationBadge, styles.missionApprovalApproved]}>
                <Text style={styles.missionRelationText}>Aprobada</Text>
              </View>
            ) : null}
            {relationLabels.map((relation) => (
              <View
                key={relation.key}
                style={[
                  styles.missionRelationBadge,
                  relation.tone === "created"
                    ? styles.missionRelationCreated
                    : relation.tone === "observer"
                      ? styles.missionRelationObserver
                      : styles.missionRelationAssigned,
                ]}
              >
                <Text style={styles.missionRelationText}>{relation.text}</Text>
              </View>
            ))}
          </View>
        )}

        {(m.estadoAutorizacionVuelo === "pendiente_gestion" || m.estadoAprobacion === "devuelta") && !autorizacion && (
          <Pressable
            style={[styles.btnOutline, { marginTop: 12, justifyContent: "center" }]}
            onPress={() => uploadAuthorizationAndSubmit(m)}
          >
            <Ionicons name="cloud-upload-outline" size={17} color="#111918" />
            <Text style={styles.btnOutlineText}>
              {canApproveFlyNorthMission ? "Cargar autorización para revisar" : "Subir autorización y enviar"}
            </Text>
          </Pressable>
        )}

        {canApproveFlyNorthMission && (m.estadoAprobacion === "pendiente" || chiefObserverCanApprove) && (
          <Pressable
            style={[styles.btnPrimary, { marginTop: 10, justifyContent: "center" }]}
            onPress={() => approveMissionAuthorization(m)}
          >
            <Ionicons name="shield-checkmark-outline" size={17} color="#ffffff" />
            <Text style={styles.btnPrimaryText}>Autorizar operación</Text>
          </Pressable>
        )}

        <Text style={styles.missionText}>
          <Text style={styles.bold}>Título:</Text> {m.titulo || "—"}
        </Text>

        <Text style={styles.missionText}>
          <Text style={styles.bold}>Piloto:</Text>{" "}
          {m.pilotosAsignados?.[0]?.nombre || "—"}
        </Text>

        {/* ✅ INSTRUCCIONES (lo correcto) */}
        <Text style={styles.missionText}>
          <Text style={styles.bold}>Instrucciones:</Text>{" "}
          {instr ? instr : "—"}
        </Text>

        <Text style={styles.missionText}>
          <Text style={styles.bold}>Fecha:</Text>{" "}
          {m.fechaOperacion ? String(m.fechaOperacion).slice(0, 10) : "—"}
        </Text>

        <Text style={styles.missionText}>
          <Text style={styles.bold}>Hora:</Text>{" "}
          {(m.horaInicio || "—")}{" "}
          {m.horaFin ? `→ ${m.horaFin}` : ""}
        </Text>

        <View style={styles.missionOpsGrid}>
          <View style={styles.missionOpsItem}>
            <Text style={styles.kLabel}>Hora estimada</Text>
            <Text style={styles.missionOpsValue}>{formatHourOnly(m.horaInicio)}</Text>
          </View>
          <View style={styles.missionOpsItem}>
            <Text style={styles.kLabel}>Tiempo restante</Text>
            <Text style={styles.missionOpsValue}>{tiempoRestante}</Text>
          </View>
          <View style={styles.missionOpsItem}>
            <Text style={styles.kLabel}>Aeronave sugerida</Text>
            <Text style={styles.missionOpsValue}>{sugerida}</Text>
          </View>
          <View style={styles.missionOpsItem}>
            <Text style={styles.kLabel}>Evidencias</Text>
            <Text style={styles.missionOpsValue}>{evidenciaCount > 0 ? `${evidenciaCount} cargadas` : "Pendientes"}</Text>
          </View>
        </View>

        {!!m.ubicacionGeneral && (
          <Text style={styles.missionText}>
            <Text style={styles.bold}>Ubicación:</Text> {m.ubicacionGeneral}
          </Text>
        )}

        {(autorizacion || adjuntos.length > 0) && (
          <View style={styles.missionFilesBox}>
            <Text style={styles.missionFilesTitle}>Adjuntos de misión</Text>

            {!!autorizacion && (
              <Pressable
                style={styles.missionFileRow}
                onPress={() => descargarArchivoMision(m._id, "autorizacionVuelo")}
              >
                <View style={styles.missionFileMeta}>
                  <Ionicons name="shield-checkmark-outline" size={16} color="#0d437c" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.missionFileName}>{autorizacion.name || "Autorización de vuelo"}</Text>
                    <Text style={styles.missionFileType}>Autorización {formatBytes(autorizacion.size)}</Text>
                  </View>
                </View>
                <Ionicons name="download-outline" size={18} color="#0d437c" />
              </Pressable>
            )}

            {adjuntos.map((file: any, idx: number) => (
              <Pressable
                key={`${m._id}-adj-${idx}`}
                style={styles.missionFileRow}
                onPress={() => descargarArchivoMision(m._id, "adjuntos", idx)}
              >
                <View style={styles.missionFileMeta}>
                  <Ionicons name="document-text-outline" size={16} color="#0d437c" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.missionFileName}>{file?.name || `Adjunto ${idx + 1}`}</Text>
                    <Text style={styles.missionFileType}>
                      {file?.mime || "Documento"} {formatBytes(file?.size)}
                    </Text>
                  </View>
                </View>
                <Ionicons name="download-outline" size={18} color="#0d437c" />
              </Pressable>
            ))}
          </View>
        )}

        <View style={[styles.row, { marginTop: 10, flexWrap: "wrap", gap: 10 }]}>
          {/* ✅ MAPA */}
          <Pressable
            style={[styles.btnMini, { minWidth: 110, opacity: tieneMapa ? 1 : 0.45 }]}
            onPress={() => {
              setMisionMapa(m);
              setShowMisionMapa(true);
            }}
            disabled={!tieneMapa}
          >
            <Text style={styles.btnMiniText}>{tieneMapa ? "Mapa" : "Sin mapa"}</Text>
          </Pressable>

          {/* ✅ Cumplida */}
          <Pressable
            style={[styles.btnPrimary, { flex: 1, minWidth: 140 }, !operationReady && styles.paginationBtnDisabled]}
            onPress={() => iniciarMision(m)}
            disabled={!operationReady}
          >
            <Ionicons name="play" size={16} color="white" />
            <Text style={styles.btnPrimaryText}>{operationReady ? "Iniciar misión" : "Esperando aprobación"}</Text>
          </Pressable>

          <Pressable
            style={[styles.btnOutline, { minWidth: 120, justifyContent: "center" }]}
            onPress={() => marcarMisionCumplida(m._id)}
          >
            <Text style={styles.btnOutlineText}>Marcar cumplida</Text>
          </Pressable>
        </View>
      </View>
    );
  })}

        {misionesProgramadas.length > 0 && (
          <View style={styles.paginationRow}>
            <Pressable
              style={[styles.btnMini, misionesProgramadasPage <= 1 && styles.paginationBtnDisabled]}
              disabled={misionesProgramadasPage <= 1}
              onPress={() => setMisionesProgramadasPage((prev) => Math.max(1, prev - 1))}
            >
              <Text style={styles.btnMiniText}>Anterior</Text>
            </Pressable>

            <Text style={styles.paginationText}>
              Página {misionesProgramadasPage} de {misionesProgramadasPages}
            </Text>

            <Pressable
              style={[styles.btnMini, misionesProgramadasPage >= misionesProgramadasPages && styles.paginationBtnDisabled]}
              disabled={misionesProgramadasPage >= misionesProgramadasPages}
              onPress={() => setMisionesProgramadasPage((prev) => Math.min(misionesProgramadasPages, prev + 1))}
            >
              <Text style={styles.btnMiniText}>Siguiente</Text>
            </Pressable>
          </View>
        )}



        <Text style={[styles.subTitle, { marginTop: 18 }]}>Cumplidas</Text>
        {misionesCumplidasPaginadas.map((m) => {
          const descripcion = (m.descripcion || m.instrucciones || m.titulo || "—").trim() || "—";
          const fechaCumplida = formatDateOnly((m as any).fechaOperacion || (m as any).fecha);
          const relationLabels = getMissionRelationLabels(m, usuario?._id);
          return (
            <View key={m._id} style={[styles.missionCard, { opacity: 0.95 }]}>
              <View style={styles.rowBetween}>
                <Text style={styles.missionId}>{m._id}</Text>
                <View style={[styles.pill, { backgroundColor: "#e7f7ec" }]}>
                  <Text style={[styles.pillText, { color: "#0a5a22" }]}>Cumplida</Text>
                </View>
              </View>

              {(relationLabels.length > 0 || m.esRepetitiva) && (
                <View style={styles.missionRelationRow}>
                  {m.esRepetitiva ? (
                    <View style={[styles.missionRelationBadge, styles.missionRelationRecurring]}>
                      <Text style={styles.missionRelationText}>Repetitiva diaria</Text>
                    </View>
                  ) : null}
                  {relationLabels.map((relation) => (
                    <View
                      key={relation.key}
                      style={[
                        styles.missionRelationBadge,
                        relation.tone === "created"
                          ? styles.missionRelationCreated
                          : relation.tone === "observer"
                            ? styles.missionRelationObserver
                            : styles.missionRelationAssigned,
                      ]}
                    >
                      <Text style={styles.missionRelationText}>{relation.text}</Text>
                    </View>
                  ))}
                </View>
              )}

              <Text style={styles.missionText}>
                <Text style={styles.bold}>Descripción:</Text> {descripcion}
              </Text>
              <Text style={styles.missionText}>
                <Text style={styles.bold}>Fecha:</Text> {fechaCumplida}
              </Text>

              {/* ✅ opcional: ver mapa también en cumplidas */}
              {(m as any)?.areaOperacion || m.kmlUrl || m.kmlUrl ? (
                <View style={[styles.row, { marginTop: 10 }]}>
                  <Pressable
                    style={[styles.btnMini, { minWidth: 110 }]}
                    onPress={() => {
                      console.log("ðŸ“Œ MISION ID:", m._id);
                      console.log("ðŸ“Œ areaOperacion:", JSON.stringify((m as any).areaOperacion, null, 2));
                      setMisionMapa(m);
                      setShowMisionMapa(true);
                    }}

                  >
                    <Text style={styles.btnMiniText}>Ver mapa</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          );
        })}

        {misionesCumplidas.length > 0 && (
          <View style={styles.paginationRow}>
            <Pressable
              style={[styles.btnMini, misionesCumplidasPage <= 1 && styles.paginationBtnDisabled]}
              disabled={misionesCumplidasPage <= 1}
              onPress={() => setMisionesCumplidasPage((prev) => Math.max(1, prev - 1))}
            >
              <Text style={styles.btnMiniText}>Anterior</Text>
            </Pressable>

            <Text style={styles.paginationText}>
              Página {misionesCumplidasPage} de {misionesCumplidasPages}
            </Text>

            <Pressable
              style={[styles.btnMini, misionesCumplidasPage >= misionesCumplidasPages && styles.paginationBtnDisabled]}
              disabled={misionesCumplidasPage >= misionesCumplidasPages}
              onPress={() => setMisionesCumplidasPage((prev) => Math.min(misionesCumplidasPages, prev + 1))}
            >
              <Text style={styles.btnMiniText}>Siguiente</Text>
            </Pressable>
          </View>
        )}
      </>
    )}
  </>
)}

{/* ✅ MODAL — MAPA MISIÓN */}
<Modal
  visible={showMisionMapa}
  animationType="fade"
  transparent
  statusBarTranslucent
  presentationStyle="overFullScreen"
  onRequestClose={closeMisionMapa}
>
  <View style={styles.modalOverlayCenter}>
    <View style={[styles.modalCard, { maxHeight: "90%" }]}>
      
      {/* HEADER */}
      <View style={styles.modalHeader}>
        <Text style={styles.modalTitle}>Mapa de la Misión</Text>

        <Pressable onPress={closeMisionMapa}>
          <Ionicons name="close" size={22} color="#111918" />
        </Pressable>
      </View>

              {/* BODY */}
                        {(() => {
  if (!misionMapa?.areaOperacion) {
    return <Text style={styles.muted}>Esta misión no tiene polígono cargado.</Text>;
  }

  const coords = toLatLngArray(misionMapa.areaOperacion);

  if (!coords.length) {
    return <Text style={styles.muted}>Esta misión no tiene coordenadas válidas.</Text>;
  }

  const polygonLatLng = coords.map((c) => [c.latitude, c.longitude]); // Leaflet usa [lat,lng]

  const html = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <style>
      html, body, #map { height: 100%; margin: 0; padding: 0; background: #fff; }
      .leaflet-control-attribution { display: none; }
    </style>
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  </head>
  <body>
    <div id="map"></div>
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <script>
      const polygon = ${JSON.stringify(polygonLatLng)};

      const map = L.map("map", { zoomControl: true });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19
      }).addTo(map);

      const poly = L.polygon(polygon, {
        color: "#111918",
        weight: 3,
        fillColor: "#111918",
        fillOpacity: 0.25
      }).addTo(map);

      map.fitBounds(poly.getBounds(), { padding: [20, 20] });
    </script>
  </body>
  </html>
  `;

  return (
    <View style={{ height: 360, marginTop: 12, borderRadius: 16, overflow: "hidden" }}>
      <WebView
        originWhitelist={["*"]}
        source={{ html }}
        javaScriptEnabled
        domStorageEnabled
      />
    </View>
  );
})()}


                  </View>
                </View>
              </Modal>


<Modal
  visible={showEvidenceModal}
  animationType="fade"
  transparent
  statusBarTranslucent
  presentationStyle="overFullScreen"
  onRequestClose={closeEvidenceModal}
>
  <View style={styles.modalOverlayCenter}>
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.modalWrap}>
      <View style={[styles.modalCard, { maxHeight: "90%" }]}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Evidencias de la misión</Text>
          <Pressable onPress={closeEvidenceModal}>
            <Ionicons name="close" size={22} color="#111918" />
          </Pressable>
        </View>

        <ScrollView style={{ marginTop: 12 }} keyboardShouldPersistTaps="handled">
          <Text style={styles.muted}>
            Para cerrar la misión debes subir evidencias o presionar “Saltar”. (Solo online)
          </Text>

          <Field label="Nota (opcional)" icon="note-text-outline">
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Describe brevemente..."
              placeholderTextColor="#8a96a3"
              value={evidenceNote}
              onChangeText={setEvidenceNote}
              multiline
            />
            <View style={[styles.row, { marginTop: 8, flexWrap: "wrap", gap: 10 }]}>
              <Pressable style={styles.btnOutline} onPress={() => startQuickDictation("evidence")}>
                <Ionicons name="mic-outline" size={16} color="#111918" />
                <Text style={styles.btnOutlineText}>Nota rápida por voz</Text>
              </Pressable>
            </View>
          </Field>

          <View style={[styles.row, { marginTop: 10, gap: 10, flexWrap: "wrap" }]}>
            <Pressable style={styles.btnOutline} onPress={pickEvidenceImages}>
              <Ionicons name="image-outline" size={16} color="#111918" />
              <Text style={styles.btnOutlineText}>Agregar fotos</Text>
            </Pressable>
            <Pressable style={styles.btnOutline} onPress={takeEvidencePhoto}>
              <Ionicons name="camera-outline" size={16} color="#111918" />
              <Text style={styles.btnOutlineText}>Tomar foto</Text>
            </Pressable>
          </View>

          <View style={[styles.cardSoft, { marginTop: 12 }]}>
            <Text style={styles.cardTitle}>Checklist visual de cierre</Text>
            {[
              { key: "area", label: "Área despejada y segura" },
              { key: "aeronave", label: "Aeronave inspeccionada" },
              { key: "equipo", label: "Equipo y soportes completos" },
            ].map((item) => (
              <Pressable
                key={item.key}
                style={styles.checkLine}
                onPress={() =>
                  setEvidenceChecklist((prev) => ({
                    ...prev,
                    [item.key]: !prev[item.key as keyof typeof prev],
                  }))
                }
              >
                <View style={[styles.checkbox, evidenceChecklist[item.key as keyof typeof evidenceChecklist] && styles.checkboxOn]}>
                  {evidenceChecklist[item.key as keyof typeof evidenceChecklist] ? (
                    <Ionicons name="checkmark" size={14} color="#fff" />
                  ) : null}
                </View>
                <Text style={[styles.checkLineText, { marginLeft: 10 }]}>{item.label}</Text>
              </Pressable>
            ))}
          </View>

          <View style={{ marginTop: 12 }}>
            {evidenceItems.length === 0 ? (
              <Text style={styles.muted}>No has agregado evidencias.</Text>
            ) : (
              evidenceItems.map((it) => (
                <View key={it.id} style={[styles.reportCard, { flexDirection: "row", alignItems: "center" }]}>
                  <Image source={{ uri: it.uri }} style={{ width: 56, height: 56, borderRadius: 10, marginRight: 10 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.userName} numberOfLines={1}>{it.name}</Text>
                    <Text style={styles.muted} numberOfLines={1}>{it.mime}</Text>
                  </View>
                  <Pressable style={styles.btnMini} onPress={() => removeEvidence(it.id)}>
                    <Text style={styles.btnMiniText}>Quitar</Text>
                  </Pressable>
                </View>
              ))
            )}
          </View>

          <View style={[styles.row, { marginTop: 12 }]}>
            <Pressable
                style={[styles.btnPrimary, { flex: 1, opacity: savingEvidence ? 0.7 : 1 }]}
                disabled={savingEvidence || evidenceItems.length === 0}  // ✅ opcional: obliga evidencias
                onPress={() => saveEvidenceAndFinishMission()}
              >
                {savingEvidence ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="checkmark" size={16} color="white" />
                    <Text style={styles.btnPrimaryText}>Guardar y cerrar</Text>
                  </>
                )}
              </Pressable>
          </View>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  </View>
</Modal>

<Modal
  visible={showFlightDetailModal}
  animationType="fade"
  transparent
  statusBarTranslucent
  presentationStyle="overFullScreen"
  onRequestClose={closeFlightDetail}
>
  <View style={styles.modalOverlayCenter}>
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={[styles.modalWrap, { justifyContent: "center", paddingTop: 32, paddingBottom: 32 }]}
    >
      <View style={[styles.modalCard, { maxHeight: "78%", marginBottom: 28 }]}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Detalle del vuelo</Text>
          <Pressable onPress={closeFlightDetail}>
            <Ionicons name="close" size={22} color="#111918" />
          </Pressable>
        </View>

        <ScrollView
          style={{ marginTop: 12 }}
          contentContainerStyle={{ paddingBottom: 28 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {selectedVuelo ? (
            <>
              <View style={styles.kvRow}>
                <KVP label="Aeronave" value={selectedVuelo.uas || "—"} icon="drone" />
                <KVP label="Duración" value={`${selectedVuelo.duracionMin || 0} min`} icon="timer-outline" />
              </View>
              <View style={styles.kvRow}>
                <KVP label="Fecha" value={selectedVuelo.fechaHora || "—"} icon="calendar-outline" />
                <KVP
                  label="Sincronización"
                  value={selectedVuelo._local ? "Pendiente" : "Sincronizado"}
                  icon={selectedVuelo._local ? "cloud-off-outline" : "cloud-check-outline"}
                />
              </View>
              <View style={[styles.cardSoft, { marginTop: 12 }]}>
                <Text style={styles.cardTitle}>Datos del vuelo</Text>
                <Text style={styles.detailLine}><Text style={styles.bold}>Ubicación:</Text> {selectedVuelo.ubicacion || "—"}</Text>
                <Text style={styles.detailLine}><Text style={styles.bold}>Propósito:</Text> {selectedVuelo.proposito || "—"}</Text>
                <Text style={styles.detailLine}><Text style={styles.bold}>Tipo operación:</Text> {selectedVuelo.tipoOperacion || "—"}</Text>
                <Text style={styles.detailLine}><Text style={styles.bold}>Categoría:</Text> {selectedVuelo.categoriaOperacion || "—"}</Text>
                <Text style={styles.detailLine}><Text style={styles.bold}>Hora inicio:</Text> {selectedVuelo.horaInicio || "—"}</Text>
                <Text style={styles.detailLine}><Text style={styles.bold}>Hora fin:</Text> {selectedVuelo.horaFin || "—"}</Text>
                <Text style={styles.detailLine}><Text style={styles.bold}>Notas:</Text> {selectedVuelo.notas || "—"}</Text>
                <Text style={styles.detailLine}><Text style={styles.bold}>Log adjunto:</Text> {selectedVuelo.logUrl ? "Sí" : "No"}</Text>
              </View>

              <View style={[styles.cardSoft, { marginTop: 12 }]}>
                <Text style={styles.cardTitle}>Piloto</Text>
                <Text style={styles.detailLine}><Text style={styles.bold}>Nombre:</Text> {selectedVuelo.nombrePiloto || "—"}</Text>
                <Text style={styles.detailLine}><Text style={styles.bold}>Identificación:</Text> {selectedVuelo.identificacionPiloto || "—"}</Text>
                <Text style={styles.detailLine}><Text style={styles.bold}>Licencia:</Text> {selectedVuelo.licenciaPiloto || "—"}</Text>
                <Text style={styles.detailLine}><Text style={styles.bold}>Empresa/operador:</Text> {selectedVueloDisplay?.empresaOperador || "—"}</Text>
              </View>

              <View style={[styles.cardSoft, { marginTop: 12 }]}>
                <Text style={styles.cardTitle}>Misión y entorno</Text>
                <Text style={styles.detailLine}><Text style={styles.bold}>Lugar:</Text> {selectedVueloDisplay?.lugarOperacion || "—"}</Text>
                <Text style={styles.detailLine}><Text style={styles.bold}>Municipio:</Text> {selectedVueloDisplay?.municipio || "—"}</Text>
                <Text style={styles.detailLine}><Text style={styles.bold}>Departamento:</Text> {selectedVueloDisplay?.departamento || "—"}</Text>
                <Text style={styles.detailLine}><Text style={styles.bold}>Coordenadas:</Text> {selectedVueloDisplay?.coordenadasOperacion || "—"}</Text>
                <Text style={styles.detailLine}><Text style={styles.bold}>Altitud máx.:</Text> {selectedVuelo.altitudMaxAlcanzada != null ? `${selectedVuelo.altitudMaxAlcanzada} m` : "—"}</Text>
                <Text style={styles.detailLine}><Text style={styles.bold}>Área operación:</Text> {selectedVueloDisplay?.areaOperacion || "—"}</Text>
                <Text style={styles.detailLine}><Text style={styles.bold}>Tipo misión:</Text> {selectedVueloDisplay?.tipoMision || "—"}</Text>
                <Text style={styles.detailLine}><Text style={styles.bold}>Clima:</Text> {selectedVueloDisplay?.condicionMeteorologica || "—"}</Text>
                <Text style={styles.detailLine}><Text style={styles.bold}>Viento:</Text> {selectedVueloDisplay?.velocidadViento || "—"}</Text>
                <Text style={styles.detailLine}><Text style={styles.bold}>Temperatura:</Text> {selectedVueloDisplay?.temperatura || "—"}</Text>
                <Text style={styles.detailLine}><Text style={styles.bold}>Visibilidad:</Text> {selectedVueloDisplay?.visibilidad || "—"}</Text>
              </View>

              <View style={[styles.cardSoft, { marginTop: 12 }]}>
                <Text style={styles.cardTitle}>Operación y seguridad</Text>
                <Text style={styles.detailLine}><Text style={styles.bold}>Despegues:</Text> {selectedVuelo.numeroDespegues ?? "—"}</Text>
                <Text style={styles.detailLine}><Text style={styles.bold}>Aterrizajes:</Text> {selectedVuelo.numeroAterrizajes ?? "—"}</Text>
                <Text style={styles.detailLine}><Text style={styles.bold}>Tiempo total:</Text> {selectedVuelo.tiempoTotalVueloMin ?? "—"} {selectedVuelo.tiempoTotalVueloMin != null ? "min" : ""}</Text>
                <Text style={styles.detailLine}><Text style={styles.bold}>Baterías:</Text> {selectedVuelo.bateriasUtilizadas || "—"}</Text>
                <Text style={styles.detailLine}><Text style={styles.bold}>Payload:</Text> {selectedVueloDisplay?.payload || "—"}</Text>
                <Text style={styles.detailLine}><Text style={styles.bold}>Checklist prevuelo:</Text> {selectedVueloDisplay?.checklistPrevueloRealizado == null ? "—" : selectedVueloDisplay.checklistPrevueloRealizado ? "Sí" : "No"}</Text>
                <Text style={styles.detailLine}><Text style={styles.bold}>Evaluación de riesgos:</Text> {selectedVueloDisplay?.evaluacionRiesgos || "—"}</Text>
                <Text style={styles.detailLine}><Text style={styles.bold}>Zona segura:</Text> {selectedVueloDisplay?.zonaSeguraEstablecida == null ? "—" : selectedVueloDisplay.zonaSeguraEstablecida ? "Sí" : "No"}</Text>
              </View>

              <View style={[styles.cardSoft, { marginTop: 12 }]}>
                <Text style={styles.cardTitle}>Incidentes y validación</Text>
                <Text style={styles.detailLine}><Text style={styles.bold}>Incidente:</Text> {selectedVueloDisplay?.huboIncidente == null ? "—" : selectedVueloDisplay.huboIncidente ? "Sí" : "No"}</Text>
                <Text style={styles.detailLine}><Text style={styles.bold}>Novedad:</Text> {selectedVueloDisplay?.descripcionNovedad || "—"}</Text>
                <Text style={styles.detailLine}><Text style={styles.bold}>Acciones:</Text> {selectedVueloDisplay?.accionesTomadas || "—"}</Text>
                <Text style={styles.detailLine}><Text style={styles.bold}>Piloto responsable:</Text> {selectedVueloDisplay?.nombrePilotoResponsable || "—"}</Text>
                <Text style={styles.detailLine}><Text style={styles.bold}>Firma piloto:</Text> {selectedVueloDisplay?.firmaPiloto || "—"}</Text>
                <Text style={styles.detailLine}><Text style={styles.bold}>Firma operador:</Text> {selectedVueloDisplay?.firmaOperador || "—"}</Text>
              </View>
            </>
          ) : (
            <Text style={styles.muted}>Sin selección.</Text>
          )}
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  </View>
</Modal>


              {/* PROCEDIMIENTOS */}
              {section === "procedures" && (
                <>
                  <Text style={styles.sectionTitle}>Procedimientos por misión</Text>

                  {loadingMisiones ? (
                    <View style={styles.loadingBox}>
                      <ActivityIndicator />
                      <Text style={styles.muted}>Cargando misiones...</Text>
                    </View>
                  ) : misiones
                      .filter((m) => m.estado !== "Cumplida")
                      .filter((m) => !guidedFlowMissionId || String(m._id) === String(guidedFlowMissionId)).length === 0 ? (
                    <View style={styles.emptyCard}>
                      <MaterialCommunityIcons name="clipboard-check-outline" size={22} color="#6b7a8a" />
                      <Text style={styles.muted}>No hay misiones pendientes para flujo operativo.</Text>
                    </View>
                  ) : (
                    misiones
                      .filter((m) => m.estado !== "Cumplida")
                      .filter((m) => !guidedFlowMissionId || String(m._id) === String(guidedFlowMissionId))
                      .map((m) => {
                        const proc = procStatusMap[m._id] || { preflight: false, autoeval: false, battery: false };
                        const procDone = [proc.preflight, proc.autoeval, proc.battery].filter(Boolean).length;
                        const opStatus = operationStatusMap[m._id] || { qrReads: 0, started: false, batteryChanges: 0, finalized: false, awaitingTakeoff: false };

                        return (
                          <View key={m._id} style={styles.missionCard}>
                            <View style={styles.rowBetween}>
                              <Text style={styles.missionId}>{m._id}</Text>
                              <View style={[styles.pill, { backgroundColor: "#e8f0ff" }]}>
                                <Text style={[styles.pillText, { color: "#111918" }]}>
                                  {procDone}/3
                                </Text>
                              </View>
                            </View>

                            <Text style={styles.missionText}>
                              <Text style={styles.bold}>Misión:</Text> {m.titulo || "—"}
                            </Text>
                            <Text style={styles.missionText}>
                              <Text style={styles.bold}>Fecha:</Text> {m.fechaOperacion ? String(m.fechaOperacion).slice(0, 10) : "—"}
                            </Text>

                            <View style={styles.timelineWrap}>
                              {[
                                { key: "preflight", label: "Checklist pre-vuelo", done: proc.preflight },
                                { key: "autoeval", label: "Autoevaluación", done: proc.autoeval },
                                { key: "battery", label: "Variables críticas", done: proc.battery },
                              ].map((step) => (
                                <View key={step.key} style={styles.timelineItem}>
                                  <View style={[styles.timelineDot, step.done && styles.timelineDotDone]} />
                                  <Text style={[styles.timelineText, step.done && styles.timelineTextDone]}>{step.label}</Text>
                                </View>
                              ))}
                            </View>

                            {procDone === 3 && (
                              <View style={styles.timelineWrap}>
                                <View style={styles.timelineHeader}>
                                  <Text style={styles.kLabel}>Operación</Text>
                                  <Text style={styles.kValue}>
                                    {opStatus.finalized ? "Finalizada" : opStatus.started ? "En curso" : "Lista para iniciar"}
                                  </Text>
                                </View>
                                <View style={styles.summaryRow}>
                                  <Text style={styles.summaryLabel}>Lecturas QR batería</Text>
                                  <Text style={styles.summaryValue}>{opStatus.qrReads}</Text>
                                </View>
                                <View style={styles.summaryRow}>
                                  <Text style={styles.summaryLabel}>Cambios de batería</Text>
                                  <Text style={styles.summaryValue}>{opStatus.batteryChanges}</Text>
                                </View>
                              </View>
                            )}

                            <View style={[styles.row, { marginTop: 10, flexWrap: "wrap", gap: 10 }]}>
                              <Pressable
                                style={[styles.btnPrimary, { flex: 1, minWidth: 170 }]}
                                onPress={() => continueMissionProcedureFlow(m)}
                              >
                                <Ionicons name="play" size={16} color="white" />
                                <Text style={styles.btnPrimaryText}>
                                  {procDone < 3 ? "Continuar checklists" : "Abrir flujo operación"}
                                </Text>
                              </Pressable>

                              {procDone === 3 && (
                                <Pressable
                                  style={[styles.btnMini, { minWidth: 150 }]}
                                  onPress={() => openOperationFlow(m)}
                                >
                                  <Text style={styles.btnMiniText}>Panel operación</Text>
                                </Pressable>
                              )}
                            </View>
                          </View>
                        );
                      })
                  )}

                </>
              )}

            </>
          )}
        </ScrollView>

{/* ✅ MODAL — SELECCIONAR MISIÓN PARA PROCEDIMIENTO */}
<Modal
  visible={showProcMissionModal}
  animationType="fade"
  transparent
  statusBarTranslucent
  presentationStyle="overFullScreen"
  onRequestClose={() => {
     stopAllVoice();
    setShowProcMissionModal(false);
    setPendingProc(null);
  }}
>
  <View style={styles.modalOverlayCenter}>
    <View style={[styles.modalCardPro, { maxHeight: "80%" }]}>
      <View style={styles.modalHeader}>
        <Text style={styles.modalTitle}>Asociar a misión</Text>

        <Pressable
          onPress={() => {
            stopAllVoice();
            setShowProcMissionModal(false);
            setPendingProc(null);
          }}
        >
          <Ionicons name="close" size={22} color="#111918" />
        </Pressable>
      </View>


      {/* ✅ Acción rápida: SIN MISIÓN */}
<Pressable
  style={[styles.btnOutline, { marginTop: 12, justifyContent: "center" }]}
  onPress={() => confirmProcMission(null)}
>
 
</Pressable>

<ScrollView style={{ marginTop: 12 }} showsVerticalScrollIndicator={false}>
  {loadingMisiones ? (
    <View style={{ paddingVertical: 18, alignItems: "center" }}>
      <ActivityIndicator />
      <Text style={styles.muted}>Cargando misiones...</Text>
    </View>
  ) : (
    (() => {
      // ✅ solo misiones NO cumplidas y NO completadas para el procedimiento seleccionado
const disponibles = (misiones || [])
  .filter((m) => m.estado !== "Cumplida")
  .filter((m) => {
    const st = procStatusMap[m._id];

    // si aún no hay data de status, mostrarla igual
    if (!st) return true;

    if (pendingProc === "preflight") return !st.preflight;
    if (pendingProc === "autoeval") return !st.autoeval;
    if (pendingProc === "battery") return !st.battery;

    return true;
  });

if (disponibles.length === 0) {
  return (
    <View style={{ paddingVertical: 18, alignItems: "center" }}>
      <Text style={styles.muted}>No tienes misiones disponibles.</Text>
    </View>
  );
}

return disponibles.map((m) => {
  const selected = procMission?._id === m._id;

  return (
    <Pressable
      key={m._id}
      onPress={() => confirmProcMission(m)}
      style={[styles.equipoItem, selected && styles.equipoItemActive]}
    >
      <Text style={styles.equipoTitle}>{m.titulo || "Misión"}</Text>

      <Text style={styles.equipoMeta}>
        {String(m.fechaOperacion).slice(0, 10)} · {m.estado}
      </Text>

      {!!m.ubicacionGeneral && (
        <Text style={styles.equipoMeta}>Ubicación: {m.ubicacionGeneral}</Text>
      )}
    </Pressable>
  );
});

    })()
  )}

  <View style={{ height: 10 }} />
</ScrollView>

    </View>
  </View>
</Modal>


<Modal
  visible={showOperationFlowModal}
  animationType="fade"
  transparent
  statusBarTranslucent
  presentationStyle="overFullScreen"
  onRequestClose={() => setShowOperationFlowModal(false)}
>
  <View style={styles.modalOverlayCenter}>
    <View style={[styles.modalCardPro, { maxHeight: "82%" }]}>
      <View style={styles.modalHeader}>
        <Text style={styles.modalTitle}>Flujo de operación</Text>
        <Pressable onPress={() => setShowOperationFlowModal(false)}>
          <Ionicons name="close" size={22} color="#111918" />
        </Pressable>
      </View>

      <Text style={styles.muted}>
        Misión: {operationMission?.titulo || "—"}
      </Text>

      <View style={styles.timelineWrap}>
        <View style={styles.timelineHeader}>
          <Text style={styles.kLabel}>Estado</Text>
          <Text style={styles.kValue}>
            {((operationMission?.estado === "Cumplida") || (operationMission?._id && operationStatusMap[operationMission._id]?.finalized))
              ? "Finalizada"
              : (operationMission?._id && operationStatusMap[operationMission._id]?.started)
              ? "En operación"
              : "Pendiente de iniciar"}
          </Text>
        </View>
      </View>

      <View style={{ marginTop: 12, gap: 10 }}>
        {!!activeFratRecord && (
          <View style={styles.fratSummaryCard}>
            <View style={styles.fratSummaryHeader}>
              <Text style={styles.fratSummaryTitle}>FRAT registrado</Text>
              <View style={[styles.fratSummaryPill, { backgroundColor: activeFratMeta?.pillBg || "#eef2ff" }]}>
                <Text style={[styles.fratSummaryPillText, { color: activeFratMeta?.pillText || "#1e3a8a" }]}>
                  {activeFratRecord.riskLevel} · {activeFratRecord.total}
                </Text>
              </View>
            </View>
            <Text style={styles.fratSummaryMeta}>
              Izquierda {activeFratRecord.leftTotal} · Derecha {activeFratRecord.rightTotal}
            </Text>
            {!!activeFratRecord.observation && (
              <Text style={styles.fratSummaryMeta}>Mitigación: {activeFratRecord.observation}</Text>
            )}
          </View>
        )}

        {!(operationMission?._id && operationStatusMap[operationMission._id]?.started) && (
          <Pressable style={[styles.btnPrimary, { flex: 0 }]} onPress={() => openFratForOperation(operationMission)}>
            <MaterialCommunityIcons name="shield-check-outline" size={16} color="white" />
            <Text style={styles.btnPrimaryText}>{activeFratRecord ? "Actualizar FRAT e iniciar" : "Evaluar riesgo e iniciar"}</Text>
          </Pressable>
        )}

        {(operationMission?._id && operationStatusMap[operationMission._id]?.awaitingTakeoff) ? (
          <Pressable style={styles.btnOutline} onPress={resumeOperationAfterBatteryChange}>
            <MaterialCommunityIcons name="airplane-takeoff" size={16} color="#111918" />
            <Text style={styles.btnOutlineText}>Despegar de nuevo</Text>
          </Pressable>
        ) : (
          <Pressable style={styles.btnOutline} onPress={registerBatteryChangeLanding}>
            <MaterialCommunityIcons name="airplane-landing" size={16} color="#111918" />
            <Text style={styles.btnOutlineText}>Aterrizar para cambio de batería</Text>
          </Pressable>
        )}

      </View>

      <View style={{ paddingTop: 12 }}>
        <Pressable style={[styles.btnPrimary, { flex: 0 }]} onPress={finalizeOperation}>
          <MaterialCommunityIcons name="flag-checkered" size={16} color="white" />
          <Text style={styles.btnPrimaryText}>Finalizar operación</Text>
        </Pressable>
      </View>
    </View>
  </View>
</Modal>

<Modal
  visible={showFratModal}
  animationType="fade"
  transparent
  statusBarTranslucent
  presentationStyle="overFullScreen"
  onRequestClose={closeFrat}
>
  <View style={styles.modalOverlayCenter}>
    <View style={[styles.modalCardPro, { maxHeight: "90%" }]}>
      <View style={styles.modalHeader}>
        <Text style={styles.modalTitle}>Evaluación FRAT</Text>
        <Pressable onPress={closeFrat}>
          <Ionicons name="close" size={22} color="#111918" />
        </Pressable>
      </View>

      <Text style={styles.muted}>
        Misión: {operationMission?.titulo || "—"}
      </Text>

      <View style={styles.fratScoreStrip}>
        <View style={styles.fratScoreCard}>
          <Text style={styles.fratScoreLabel}>Columna izquierda</Text>
          <Text style={styles.fratScoreValue}>{fratLeftTotal}</Text>
        </View>
        <View style={styles.fratScoreCard}>
          <Text style={styles.fratScoreLabel}>Columna derecha</Text>
          <Text style={styles.fratScoreValue}>{fratRightTotal}</Text>
        </View>
        <View style={[styles.fratScoreCard, { borderColor: fratRiskMeta.accent }]}>
          <Text style={styles.fratScoreLabel}>Total</Text>
          <Text style={[styles.fratScoreValue, { color: fratRiskMeta.accent }]}>{fratTotal}</Text>
        </View>
      </View>

      <View style={styles.fratGaugeCard}>
        <View style={styles.fratGaugeTrack}>
          <LinearGradient
            colors={["#1d4ed8", "#22c55e", "#facc15", "#f97316", "#dc2626"]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.fratGaugeGradient}
          />
          <View
            style={[
              styles.fratGaugeMarker,
              { left: `${Math.min((fratTotal / 30) * 100, 100)}%`, borderColor: fratRiskMeta.accent },
            ]}
          />
        </View>
        <View style={styles.fratGaugeScale}>
          <Text style={styles.fratGaugeScaleText}>0</Text>
          <Text style={styles.fratGaugeScaleText}>10</Text>
          <Text style={styles.fratGaugeScaleText}>20</Text>
          <Text style={styles.fratGaugeScaleText}>30</Text>
        </View>
        <View style={[styles.fratRiskPill, { backgroundColor: fratRiskMeta.pillBg }]}>
          <Text style={[styles.fratRiskPillText, { color: fratRiskMeta.pillText }]}>
            {fratRiskLevel}
          </Text>
        </View>
        <Text style={styles.fratHelperText}>{fratRiskMeta.helper}</Text>
      </View>

      <ScrollView
        style={{ marginTop: 12 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.fratSectionCard}>
          <Text style={styles.fratSectionTitle}>Estado del piloto</Text>
          {FRAT_LEFT_QUESTIONS.map((question) => (
            <View key={question.key} style={styles.fratQuestionBlock}>
              <Text style={styles.fratQuestionLabel}>{question.label}</Text>
              <View style={styles.fratOptionsWrap}>
                {question.options.map((option) => {
                  const active = fratAnswers[question.key] === option.value;
                  return (
                    <Pressable
                      key={option.value}
                      style={[
                        styles.fratOption,
                        active && { borderColor: fratRiskMeta.accent, backgroundColor: "#ffffff" },
                      ]}
                      onPress={() => setFratAnswers((prev) => ({ ...prev, [question.key]: option.value }))}
                    >
                      <Text style={[styles.fratOptionText, active && { color: "#111918", fontFamily: FONT.semi }]}>
                        {option.label}
                      </Text>
                      <Text style={[styles.fratOptionScore, active && { color: fratRiskMeta.accent }]}>+{option.score}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ))}
        </View>

        <View style={styles.fratSectionCard}>
          <Text style={styles.fratSectionTitle}>Condiciones y controles</Text>
          {FRAT_RIGHT_QUESTIONS.map((question) => (
            <View key={question.key} style={styles.fratQuestionBlock}>
              <Text style={styles.fratQuestionLabel}>{question.label}</Text>
              <View style={styles.fratOptionsWrap}>
                {question.options.map((option) => {
                  const active = fratAnswers[question.key] === option.value;
                  return (
                    <Pressable
                      key={option.value}
                      style={[
                        styles.fratOption,
                        active && { borderColor: fratRiskMeta.accent, backgroundColor: "#ffffff" },
                      ]}
                      onPress={() => setFratAnswers((prev) => ({ ...prev, [question.key]: option.value }))}
                    >
                      <Text style={[styles.fratOptionText, active && { color: "#111918", fontFamily: FONT.semi }]}>
                        {option.label}
                      </Text>
                      <Text style={[styles.fratOptionScore, active && { color: fratRiskMeta.accent }]}>+{option.score}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ))}
        </View>

        {(fratRiskLevel === "PREOCUPACION" || fratRiskLevel === "PELIGRO") && (
          <View style={styles.fratSectionCard}>
            <Text style={styles.fratSectionTitle}>Mitigación / observaciones</Text>
            <TextInput
              style={[styles.input, styles.fratObservationInput]}
              placeholder="Describe controles, mitigaciones o por qué no debe iniciar la operación."
              placeholderTextColor="#8a96a3"
              multiline
              value={fratObservation}
              onChangeText={setFratObservation}
            />
          </View>
        )}
      </ScrollView>

      <View style={{ marginTop: 12, gap: 10 }}>
        <Pressable style={styles.btnOutline} onPress={closeFrat}>
          <MaterialCommunityIcons name="close-circle-outline" size={16} color="#111918" />
          <Text style={styles.btnOutlineText}>Cancelar</Text>
        </Pressable>

        <Pressable
          style={[
            styles.btnPrimary,
            { flex: 0 },
            (!fratCompleted || fratRiskLevel === "PELIGRO" || (fratRiskLevel === "PREOCUPACION" && !fratObservation.trim())) &&
              styles.btnPrimaryDisabled,
          ]}
          disabled={!fratCompleted || fratRiskLevel === "PELIGRO" || (fratRiskLevel === "PREOCUPACION" && !fratObservation.trim())}
          onPress={startOperation}
        >
          <MaterialCommunityIcons name="play-circle-outline" size={16} color="white" />
          <Text style={styles.btnPrimaryText}>
            {fratRiskLevel === "PELIGRO" ? "Operación bloqueada" : "Guardar FRAT e iniciar"}
          </Text>
        </Pressable>
      </View>
    </View>
  </View>
</Modal>



        {/* ✅ MODAL 1 — DETALLE REPORTE (ARREGLADO) */}
  <Modal
    visible={showIncidentModal}
    animationType="fade"
    transparent
    statusBarTranslucent
    presentationStyle="overFullScreen"
    onRequestClose={closeIncidentModal}
  >
    <View style={styles.modalOverlayCenter}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.modalWrap}
      >
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Nuevo incidente</Text>
            <Pressable onPress={closeIncidentModal}>
              <Ionicons name="close" size={22} color="#111918" />
            </Pressable>
          </View>

          <ScrollView
            style={{ marginTop: 12 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Field label="Fecha y hora *" icon="calendar-clock">
              <TextInput
                style={styles.input}
                placeholder="YYYY-MM-DD HH:mm"
                placeholderTextColor="#8a96a3"
                value={incFecha}
                onChangeText={setIncFecha}
              />
            </Field>

            <Field label="Tipo *" icon="alert-circle-outline">
              <View style={[styles.row, { flexWrap: "wrap", marginTop: 6 }]}>
                {INCIDENT_TYPES.map((t) => {
                  const active = incTipo === t;
                  return (
                    <Pressable
                      key={t}
                      style={[styles.chip, active && styles.chipActive, styles.mr10, { marginBottom: 8 }]}
                      onPress={() => setIncTipo(t)}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>{t}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </Field>

            <Field label="Severidad *" icon="alert-decagram">
              <View style={[styles.row, { flexWrap: "wrap", marginTop: 6 }]}>
                {["Bajo", "Medio", "Alto", "Crítico"].map((nivel) => {
                  const active = incSeveridad === nivel;
                  return (
                    <Pressable
                      key={nivel}
                      style={[styles.chip, active && styles.chipActive, styles.mr10, { marginBottom: 8 }]}
                      onPress={() => setIncSeveridad(nivel)}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>{nivel}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </Field>

            <Field label="Ubicación *" icon="map-marker-outline">
              <TextInput
                style={styles.input}
                placeholder="Ej: Zona rural Facatativá"
                placeholderTextColor="#8a96a3"
                value={incUbicacion}
                onChangeText={setIncUbicacion}
              />
            </Field>

            <Field label="Título *" icon="card-text-outline">
              <TextInput
                style={styles.input}
                placeholder="Ej: Pérdida de enlace en misión BVLOS"
                placeholderTextColor="#8a96a3"
                value={incTitulo}
                onChangeText={setIncTitulo}
              />
            </Field>

            <Field label="Descripción *" icon="text-box-outline">
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Relate el hecho de forma clara…"
                placeholderTextColor="#8a96a3"
                value={incDescripcion}
                onChangeText={setIncDescripcion}
                multiline
              />
            </Field>

            <Field label="Causas probables (opcional)" icon="help-circle-outline">
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Causas probables…"
                placeholderTextColor="#8a96a3"
                value={incCausas}
                onChangeText={setIncCausas}
                multiline
              />
            </Field>

            <Field label="Acciones inmediatas (opcional)" icon="hand-extended-outline">
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Acciones inmediatas…"
                placeholderTextColor="#8a96a3"
                value={incAcciones}
                onChangeText={setIncAcciones}
                multiline
              />
            </Field>

            <Field label="Evidencias (opcional)" icon="paperclip">
              <View style={[styles.row, { marginTop: 8, gap: 10 }]}>
                <Pressable style={styles.btnOutline} onPress={pickIncidentAttachments}>
                  <Ionicons name="attach-outline" size={16} color="#111918" />
                  <Text style={styles.btnOutlineText}>Agregar archivo</Text>
                </Pressable>
                <Text style={styles.muted}>{incAttachments.length} adjunto(s)</Text>
              </View>

              {!!incAttachments.length && (
                <View style={[styles.cardSoft, { marginTop: 10 }]}>
                  {incAttachments.map((item, idx) => (
                    <View key={item.id} style={[styles.rowBetween, { marginBottom: 8 }]}>
                      <Text style={styles.muted}>{item.name}</Text>
                      <Pressable onPress={() => removeIncidentAttachment(idx)}>
                        <Text style={[styles.textLink, { color: "#b91c1c" }]}>Quitar</Text>
                      </Pressable>
                    </View>
                  ))}
                </View>
              )}
            </Field>

            <View style={[styles.row, { marginTop: 16, justifyContent: "space-between" }]}>
              <Pressable style={[styles.btnOutline, { flex: 1, marginRight: 10 }]} onPress={closeIncidentModal}>
                <Text style={styles.btnOutlineText}>Cancelar</Text>
              </Pressable>
              <Pressable
                style={[styles.btnPrimary, { flex: 1, opacity: incSaving ? 0.7 : 1 }]}
                disabled={incSaving}
                onPress={saveIncident}
              >
                <Ionicons name="save-outline" size={16} color="#fff" />
                <Text style={styles.btnPrimaryText}>{incSaving ? "Guardando..." : "Guardar"}</Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </View>
  </Modal>

  <Modal
    visible={showReportDetailModal}
  animationType="fade"
  transparent
  statusBarTranslucent
  presentationStyle="overFullScreen"
  onRequestClose={closeReportDetail}
>
  {/* ✅ Overlay centrado */}
  <View style={styles.modalOverlayCenter}>
    <KeyboardAvoidingView
  behavior={Platform.OS === "ios" ? "padding" : undefined}
  style={styles.modalWrap}
>

      {/* ✅ Card centrado */}
<View style={styles.modalCard}>
        
        {/* HEADER */}
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Detalle del Reporte</Text>

          <Pressable onPress={closeReportDetail}>
            <Ionicons name="close" size={22} color="#111918" />
          </Pressable>
        </View>

        {/* BODY */}
        <ScrollView
          style={{ marginTop: 12 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {selectedReporte ? (
            <>
              <Text style={styles.detailLine}>
                <Text style={styles.bold}>ID:</Text> {selectedReporte._id}
              </Text>

              <Text style={styles.detailLine}>
                <Text style={styles.bold}>Fecha:</Text> {selectedReporte.fecha}
              </Text>

              <Text style={styles.detailLine}>
                <Text style={styles.bold}>Tipo:</Text> {selectedReporte.tipo}
              </Text>

              <Text style={styles.detailLine}>
                <Text style={styles.bold}>Estado:</Text> {selectedReporte.estado}
              </Text>

              <Text style={[styles.detailLine, { marginTop: 10 }]}>
                <Text style={styles.bold}>Descripción:</Text>
              </Text>

              <Text style={styles.detailBody}>
                {selectedReporte.descripcion}
              </Text>
            </>
          ) : (
            <Text style={styles.muted}>Sin selección</Text>
          )}
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  </View>
</Modal>


    {/* ✅ MODAL — CHECKLIST 100% VOZ */}
<Modal
  visible={showChecklistModal}
  animationType="fade"
  transparent
  statusBarTranslucent
  presentationStyle="overFullScreen"
  onRequestClose={closeChecklist}
>
  <View style={styles.modalOverlayCenter}>
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.modalWrap}>
      <View style={[styles.modalCard, { maxWidth: 760, maxHeight: "90%" }]}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Checklist Pre-Vuelo</Text>
          <Pressable style={styles.iconBtn} onPress={closeChecklist}>
            <Ionicons name="close" size={22} color="#111918" />
          </Pressable>
        </View>

        <ScrollView style={{ marginTop: 12 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.cardSoft}>
            <Text style={styles.cardTitle}>Asistente por voz</Text>
            <Text style={styles.muted}>{voicePrompt || "Iniciando..."}</Text>

            {!!heard && (
              <Text style={[styles.muted, { marginTop: 10 }]}>
                🎧 Entendí: {heard}
              </Text>
            )}

            <Text style={[styles.muted, { marginTop: 10 }]}>
              Estado: {listening ? "Escuchando..." : voiceBusy ? "Hablando..." : "Procesando..."}
            </Text>
          </View>

          {/* (Opcional) deja el checklist visible como referencia, pero NO requiere tocarlo */}
          {/* ... tus cards del checklist pueden quedarse si quieres ... */}

          <View style={{ height: 12 }} />
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  </View>
</Modal>



{/* ✅ MODAL — AUTOEVALUACIÓN 100% VOZ */}
<Modal
  visible={showAutoevalModal}
  animationType="fade"
  transparent
  statusBarTranslucent
  presentationStyle="overFullScreen"
  onRequestClose={closeAutoeval}
>
  <View style={styles.modalOverlayCenter}>
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.modalWrap}>
      <View style={[styles.modalCard, { maxWidth: 760, maxHeight: "90%" }]}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Autoevaluación · Aptitud física</Text>
          <Pressable style={styles.iconBtn} onPress={closeAutoeval}>
            <Ionicons name="close" size={22} color="#111918" />
          </Pressable>
        </View>

        <ScrollView style={{ marginTop: 12 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.cardSoft}>
            <Text style={styles.cardTitle}>Asistente por voz</Text>
            <Text style={styles.muted}>{voicePrompt || "Iniciando..."}</Text>

            {!!heard && (
              <Text style={[styles.muted, { marginTop: 10 }]}>
                🎧 Entendí: {heard}
              </Text>
            )}

            <Text style={[styles.muted, { marginTop: 10 }]}>
              Estado: {listening ? "Escuchando..." : voiceBusy ? "Hablando..." : "Procesando..."}
            </Text>
          </View>

          {/* (Opcional) resumen visual de respuestas */}
          <View style={[styles.card, { marginTop: 12 }]}>
            <Text style={styles.cardTitle}>Resumen</Text>
            <Text style={styles.muted}>Alcohol: {autoeval.alcohol || "—"}</Text>
            <Text style={styles.muted}>Psicoactivas: {autoeval.psico || "—"}</Text>
            <Text style={styles.muted}>Medicamentos: {autoeval.meds || "—"}</Text>
            <Text style={styles.muted}>Informó al jefe: {autoeval.jefe || "—"}</Text>
            <Text style={styles.muted}>Lesiones: {autoeval.lesiones || "—"}</Text>
            {!!autoeval.lesionesDetalle && <Text style={styles.muted}>Detalle: {autoeval.lesionesDetalle}</Text>}
          </View>

          <View style={{ height: 12 }} />
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  </View>
</Modal>
{/* ✅ MODAL — BATERÍAS 100% VOZ */}
<Modal
  visible={showBatteryModal}
  animationType="fade"
  transparent
  statusBarTranslucent
  presentationStyle="overFullScreen"
  onRequestClose={closeBattery}
>
  <View style={styles.modalOverlayCenter}>
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.modalWrap}>
      <View style={[styles.modalCard, { maxWidth: 760, maxHeight: "90%" }]}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Variables críticas · Baterías + Postvuelo</Text>
          <Pressable style={styles.iconBtn} onPress={closeBattery}>
            <Ionicons name="close" size={22} color="#111918" />
          </Pressable>
        </View>

        <ScrollView style={{ marginTop: 12 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.cardSoft}>
            <Text style={styles.cardTitle}>Asistente por voz</Text>
            <Text style={styles.muted}>{voicePrompt || "Iniciando..."}</Text>

            {!!heard && (
              <Text style={[styles.muted, { marginTop: 10 }]}>
                🎧 Entendí: {heard}
              </Text>
            )}

            <Text style={[styles.muted, { marginTop: 10 }]}>
              Estado: {listening ? "Escuchando..." : voiceBusy ? "Hablando..." : "Procesando..."}
            </Text>
          </View>

          {/* (Opcional) resumen visual checkboxes */}
          <View style={[styles.card, { marginTop: 12 }]}>
            <Text style={styles.cardTitle}>Resumen</Text>
            <Text style={styles.muted}>GPS: {batteryChecks.c1 ? "Sí" : "No"}</Text>
            <Text style={styles.muted}>Batería: {batteryChecks.c2 ? "Sí" : "No"}</Text>
            <Text style={styles.muted}>Meteo: {batteryChecks.c3 ? "Sí" : "No"}</Text>
            <Text style={styles.muted}>Control/Navegación: {batteryChecks.c4 ? "Sí" : "No"}</Text>
            <Text style={[styles.muted, { marginTop: 10 }]}>Postvuelo</Text>
            <Text style={styles.muted}>Hélices: {batteryChecks.p1 ? "Sí" : "No"}</Text>
            <Text style={styles.muted}>Tren: {batteryChecks.p2 ? "Sí" : "No"}</Text>
          </View>

          <View style={{ height: 12 }} />
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  </View>
</Modal>




{/* ✅ MODAL 3 — NUEVO VUELO (ARREGLADO, tipo sheet) */}
<Modal
  visible={showNewFlightModal}
  animationType="slide"
  transparent
  statusBarTranslucent
  presentationStyle="overFullScreen"
  onRequestClose={closeNewFlight}
>
  {/* ✅ Tap fuera: cierra teclado (y opcionalmente podrías cerrar modal) */}
  <Pressable style={styles.sheetOverlay} onPress={closeKeyboard}>
    {/* ✅ Evita que tocar el card dispare el overlay */}
    <Pressable onPress={() => {}} style={{ flex: 1, width: "100%", justifyContent: "flex-end" }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.modalWrap}
      >

        <View style={styles.sheetCard}>
          {/* HEADER */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Registrar Nuevo Vuelo</Text>

            <Pressable onPress={closeNewFlight}>
              <Ionicons name="close" size={22} color="#111918" />
            </Pressable>
          </View>

          {/* BODY */}
          <ScrollView
            style={{ marginTop: 12 }}
            contentContainerStyle={{ paddingBottom: 28 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={[styles.cardSoft, { marginTop: 6 }]}>
              <Text style={styles.cardTitle}>Bitácora automática por logs</Text>
              <Text style={styles.muted}>
                Sube uno o varios logs y la app llenará internamente la bitácora con la información
                consolidada del vuelo.
              </Text>
              <Text style={[styles.muted, { marginTop: 6 }]}>
                No necesitas completar manualmente fecha, horas, coordenadas ni duración.
              </Text>
            </View>

          <Field label="Misión asociada" icon="map-marker-path">
            <Pressable
              onPress={() => {
                closeKeyboard();
                setShowFlightMissionModal(true);
              }}
              style={({ pressed }) => [
                styles.input,
                styles.datePressable,
                pressed && { opacity: 0.92 },
              ]}
            >
              <Text style={[styles.inputText, !selectedFlightMissionLabel && styles.placeholderText]} numberOfLines={1}>
                {selectedFlightMissionLabel || "Selecciona una misión"}
              </Text>
              <Ionicons name="chevron-down" size={18} color="#111918" />
            </Pressable>
            {!!selectedFlightMission && (
              <Text style={[styles.muted, { marginTop: 6 }]}>
                {selectedFlightMission.estado || "Sin estado"} · {String(selectedFlightMission.fechaOperacion || "").slice(0, 10)}
              </Text>
            )}
          </Field>

          <Field label="Archivos de log" icon="file-upload-outline">
            <Pressable
              onPress={async () => {
                closeKeyboard();
                try {
                  const picked = DJIFlightLogSync.isAvailable
                    ? await DJIFlightLogSync.pickLogs("DJI_PILOT_2")
                    : await DocumentPicker.getDocumentAsync({
                        type: "*/*",
                        copyToCacheDirectory: true,
                        multiple: true,
                      });

                  if (picked.canceled) return;

                  const selected = (picked.assets || [])
                    .map(toFlightLogPicked)
                    .filter((file) => !!file.uri);

                  if (!selected.length) {
                    Toast.show({
                      type: "error",
                      text1: "Archivo no válido",
                      text2: "No se pudo leer el archivo seleccionado. Intenta de nuevo.",
                    });
                    return;
                  }

                  setFlightLogFiles(selected);
                  setFlightLogResults([]);
                } catch (error: any) {
                  Toast.show({
                    type: "error",
                    text1: "No se pudo abrir el selector",
                    text2: error?.message || "Intenta nuevamente.",
                  });
                }
              }}
              style={({ pressed }) => [
                styles.input,
                styles.datePressable,
                pressed && { opacity: 0.92 },
              ]}
            >
              <Text style={{ color: flightLogFiles.length ? "#1b2b3a" : "#8a96a3", flex: 1 }} numberOfLines={1}>
                {flightLogFiles.length
                  ? `${flightLogFiles.length} archivo(s) seleccionado(s)`
                  : "Selecciona uno o varios archivos del log"}
              </Text>
              <Ionicons name="cloud-upload-outline" size={18} color="#111918" />
            </Pressable>

            {!!flightLogFiles.length && (
              <View style={{ marginTop: 8, gap: 6 }}>
                {flightLogFiles.map((file) => {
                  const tooLarge = file.size > MAX_FLIGHT_LOG_SIZE_BYTES;
                  return (
                    <View key={file.id} style={styles.logFileItem}>
                      <Text style={styles.logFileName} numberOfLines={1}>
                        {file.name}
                      </Text>
                      <Text style={styles.logFileMeta}>
                        {formatFlightLogSize(file.size)} · Extensión: {file.ext || "sin extensión"}
                      </Text>
                      {tooLarge ? (
                        <Text style={styles.logFileError}>Supera el tamaño máximo permitido de 50 MB.</Text>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            )}

            {!!flightLogResults.length && (
              <View style={{ marginTop: 8, gap: 6 }}>
                {flightLogResults.map((result) => (
                  <View key={result.id} style={styles.logResultItem}>
                    <Text style={styles.logFileName} numberOfLines={1}>
                      {result.name}
                    </Text>
                    <Text style={result.ok ? styles.logResultSuccess : styles.logResultError}>
                      {result.ok ? "Éxito" : "Fallo"}: {result.message}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </Field>

            <View style={[styles.row, { marginTop: 10 }]}>
              <Pressable
                style={[styles.btnPrimary, styles.mr10]}
                disabled={savingFlight}
                onPress={() => {
                  closeKeyboard();
                  submitVuelo();
                }}
              >
                {savingFlight ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <>
                    <Ionicons name="save" size={16} color="white" />
                    <Text style={styles.btnPrimaryText}>Guardar</Text>
                  </>
                )}
              </Pressable>

              <Pressable style={styles.btnGhost} onPress={closeNewFlight} disabled={savingFlight}>
                <Text style={styles.btnGhostText}>Cancelar</Text>
              </Pressable>
            </View>

            <View style={{ height: 10 }} />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Pressable>
  </Pressable>
</Modal>

<Modal
  visible={showFlightMissionModal}
  animationType="fade"
  transparent
  statusBarTranslucent
  presentationStyle="overFullScreen"
  onRequestClose={() => setShowFlightMissionModal(false)}
>
  <View style={styles.modalOverlayCenter}>
    <View style={[styles.modalCardPro, { maxHeight: "80%" }]}>
      <View style={styles.modalHeader}>
        <Text style={styles.modalTitle}>Asociar misión al vuelo</Text>
        <Pressable onPress={() => setShowFlightMissionModal(false)}>
          <Ionicons name="close" size={22} color="#111918" />
        </Pressable>
      </View>

      <ScrollView style={{ marginTop: 12 }} showsVerticalScrollIndicator={false}>
        <Pressable
          style={[styles.equipoItem, !flightMisionId && styles.equipoItemActive]}
          onPress={() => {
            setFlightMisionId("");
            setShowFlightMissionModal(false);
          }}
        >
          <Text style={styles.equipoTitle}>Sin misión</Text>
          <Text style={styles.equipoMeta}>Guardar el vuelo sin asociación.</Text>
        </Pressable>

        {(misiones || [])
          .filter((m) => String(m?.estado || "").toLowerCase() !== "cumplida")
          .sort((a, b) => {
            const da = new Date(a?.fechaOperacion || 0).getTime();
            const db = new Date(b?.fechaOperacion || 0).getTime();
            return db - da;
          })
          .map((m) => {
            const selected = String(flightMisionId) === String(m._id);
            return (
              <Pressable
                key={m._id}
                onPress={() => {
                  setFlightMisionId(String(m._id));
                  setShowFlightMissionModal(false);
                }}
                style={[styles.equipoItem, selected && styles.equipoItemActive]}
              >
                <Text style={styles.equipoTitle}>{m.titulo || "Misión"}</Text>
                <Text style={styles.equipoMeta}>
                  {String(m.fechaOperacion || "").slice(0, 10)} · {m.estado || "Sin estado"}
                </Text>
                {!!m.ubicacionGeneral && (
                  <Text style={styles.equipoMeta}>Ubicación: {m.ubicacionGeneral}</Text>
                )}
              </Pressable>
            );
          })}

        <View style={{ height: 10 }} />
      </ScrollView>
    </View>
  </View>
</Modal>

{/* ✅ MODAL 4 — AERONAVES REGISTRADAS (CENTRADO) */}
<Modal
  visible={showEquiposModal}
  animationType="fade"
  transparent
  statusBarTranslucent
  presentationStyle="overFullScreen"
  onRequestClose={closeEquipos}
>
  <View style={styles.modalOverlayCenter}>
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.modalWrap}
    >
      <View style={styles.modalCardPro}>
        {/* HEADER */}
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Aeronaves registradas</Text>

          <View style={{ flexDirection: "row", gap: 14 }}>
            <Pressable onPress={loadEquipos}>
              <Ionicons name="refresh" size={20} color="#111918" />
            </Pressable>

            <Pressable onPress={closeEquipos}>
              <Ionicons name="close" size={22} color="#111918" />
            </Pressable>
          </View>
        </View>

        {/* LIST */}
        <ScrollView
          style={{ marginTop: 12 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {loadingEquipos ? (
            <View style={{ paddingVertical: 18, alignItems: "center" }}>
              <ActivityIndicator />
              <Text style={styles.muted}>Cargando aeronaves...</Text>
            </View>
          ) : equipos.length === 0 ? (
            <View style={{ paddingVertical: 18, alignItems: "center" }}>
              <Text style={styles.muted}>
                {equiposError ? equiposError : "No hay aeronaves registradas"}
              </Text>
            </View>
          ) : (
            equipos.map((e) => {
              const selected = equipoSel?._id === e._id;

              return (
                <Pressable
                  key={e._id}
                  onPress={() => {
                    setEquipoSel(e);
                    setFlightUas(`${e.modelo} (${e.ruas})`);
                    setShowEquiposModal(false);
                  }}
                  style={[styles.equipoItem, selected && styles.equipoItemActive]}
                >
                  <Text style={styles.equipoTitle}>
                    {e.modelo} • {e.ruas}
                  </Text>

                  <Text style={styles.equipoMeta}>
                    Serie: {e.serie} · Estado: {e.estado || "—"}
                  </Text>
                </Pressable>
              );
            })
          )}
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  </View>
</Modal>

      <Modal
        visible={djiCloudModalOpen}
        transparent
        animationType="slide"
        onRequestClose={closeDjiCloudModal}
      >
        <Pressable style={styles.modalOverlay} onPress={closeDjiCloudModal}>
          <Pressable onPress={() => {}} style={[styles.modalCard, { maxWidth: 720, alignSelf: "center" }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Conectar cuenta DJI</Text>
              <Pressable onPress={closeDjiCloudModal}>
                <Ionicons name="close" size={22} color="#111918" />
              </Pressable>
            </View>

            <ScrollView style={{ marginTop: 14 }} keyboardShouldPersistTaps="handled">
              <Text style={styles.kLabel}>App DJI donde el piloto sincroniza sus vuelos</Text>
              <View style={styles.djiCloudChipRow}>
                {[
                  { key: "DJI_FLY", label: "DJI Fly" },
                  { key: "DJI_GO_4", label: "DJI GO 4" },
                  { key: "DJI_PILOT_2", label: "DJI Pilot 2" },
                ].map((item) => {
                  const active = flightLogSourceApp === item.key;
                  return (
                    <Pressable
                      key={item.key}
                      style={[styles.chip, active && styles.chipActive, styles.mr10, { marginBottom: 8 }]}
                      onPress={() => setFlightLogSourceApp(item.key as "DJI_FLY" | "DJI_GO_4" | "DJI_PILOT_2")}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>{item.label}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={[styles.kLabel, { marginTop: 10 }]}>
                {djiIntegrationMode === "enterprise_cloud" ? "Cuenta operativa DJI" : "DJI Username / Email"}
              </Text>
              <TextInput
                style={[styles.input, { marginTop: 8 }]}
                value={djiCloudForm.accountIdentifier}
                onChangeText={(value) => setDjiCloudForm((prev) => ({ ...prev, accountIdentifier: value }))}
                placeholder={
                  djiIntegrationMode === "enterprise_cloud"
                    ? "Correo o usuario DJI"
                    : "Usuario o correo usado en DJI Fly / DJI GO"
                }
                placeholderTextColor="#8c9aaa"
                autoCapitalize="none"
              />

              {djiIntegrationMode === "consumer_local" ? (
                <>
                  <Text style={[styles.kLabel, { marginTop: 12 }]}>DJI Password</Text>
                  <TextInput
                    style={[styles.input, { marginTop: 8 }]}
                    value={djiCloudForm.password}
                    onChangeText={(value) => setDjiCloudForm((prev) => ({ ...prev, password: value }))}
                    placeholder="Contraseña usada en DJI"
                    placeholderTextColor="#8c9aaa"
                    autoCapitalize="none"
                    secureTextEntry
                  />

                  <Text style={[styles.kLabel, { marginTop: 12 }]}>Confirm Password</Text>
                  <TextInput
                    style={[styles.input, { marginTop: 8 }]}
                    value={djiCloudForm.confirmPassword}
                    onChangeText={(value) => setDjiCloudForm((prev) => ({ ...prev, confirmPassword: value }))}
                    placeholder="Confirma la contraseña"
                    placeholderTextColor="#8c9aaa"
                    autoCapitalize="none"
                    secureTextEntry
                  />
                </>
              ) : (
                <>
                  <Text style={[styles.kLabel, { marginTop: 12 }]}>Nombre visible de la cuenta</Text>
                  <TextInput
                    style={[styles.input, { marginTop: 8 }]}
                    value={djiCloudForm.accountDisplayName}
                    onChangeText={(value) => setDjiCloudForm((prev) => ({ ...prev, accountDisplayName: value }))}
                    placeholder="Ej: Juan Bueno / Piloto Topografía"
                    placeholderTextColor="#8c9aaa"
                  />
                </>
              )}

              <Text style={styles.muted}>
                {djiIntegrationMode === "enterprise_cloud"
                  ? "Esta vinculación deja lista la base multiempresa para asociar la cuenta DJI del piloto y activar el proceso de sincronización automática desde la nube."
                  : "Este vínculo asistido deja lista la cuenta DJI del piloto para verificarla, usarla como referencia de consumo y luego consolidar los registros sincronizados/importados."}
              </Text>

              <View style={{ flexDirection: "row", marginTop: 18 }}>
                <Pressable style={[styles.btnOutline, { flex: 1, marginRight: 10, justifyContent: "center" }]} onPress={closeDjiCloudModal}>
                  <Text style={styles.btnOutlineText}>Cancelar</Text>
                </Pressable>
                <Pressable
                  style={[styles.btnPrimary, { flex: 1, opacity: djiCloudSaving ? 0.7 : 1 }]}
                  onPress={submitDjiCloudConnection}
                  disabled={djiCloudSaving}
                >
                  <MaterialCommunityIcons name="cloud-check-outline" size={18} color="#fff" />
                  <Text style={styles.btnPrimaryText}>
                    {djiCloudSaving
                      ? "Guardando..."
                      : djiIntegrationMode === "consumer_local"
                      ? "Save / Verify"
                      : "Guardar vínculo"}
                  </Text>
                </Pressable>
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={showBatteryForm}
        animationType="fade"
        transparent
        statusBarTranslucent
        presentationStyle="overFullScreen"
        onRequestClose={() => !savingBattery && setShowBatteryForm(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={closeKeyboard}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.equipoFormKeyboard}>
            <Pressable style={styles.equipoFormSheet} onPress={() => {}}>
              <View style={styles.modalHeader}>
                <View style={styles.equipoFormTitleRow}>
                  <View style={styles.equipoFormHeaderIcon}>
                    <Ionicons name="battery-charging-outline" size={22} color="#111918" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalTitle}>Registrar batería</Text>
                    <Text style={styles.notificationSubtitle}>Asociada al UAS seleccionado</Text>
                  </View>
                </View>
                <Pressable style={styles.notificationClose} onPress={() => !savingBattery && setShowBatteryForm(false)}>
                  <Ionicons name="close" size={22} color="#111918" />
                </Pressable>
              </View>
              <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 14, paddingBottom: 25 }}>
                {([
                  ["nombre", "Nombre", "Ej: Batería 01"],
                  ["marca", "Marca", "Ej: DJI"],
                  ["modelo", "Modelo", "Modelo de batería"],
                  ["serial", "Serial *", "Serial único"],
                  ["ciclos", "Ciclos actuales", "0"],
                  ["maxCiclos", "Máximo de ciclos", "200"],
                  ["notas", "Notas", "Observaciones"],
                ] as const).map(([field, label, placeholder]) => (
                  <View key={field} style={{ marginBottom: 11 }}>
                    <Text style={styles.kLabel}>{label}</Text>
                    <TextInput
                      style={[styles.input, { marginTop: 6 }]}
                      value={batteryForm[field]}
                      onChangeText={(value) => setBatteryForm((prev) => ({ ...prev, [field]: value }))}
                      placeholder={placeholder}
                      placeholderTextColor="#8c9aaa"
                      keyboardType={field === "ciclos" || field === "maxCiclos" ? "number-pad" : "default"}
                      multiline={field === "notas"}
                    />
                  </View>
                ))}
                <Text style={styles.kLabel}>Fecha de adquisición</Text>
                <Pressable
                  style={[styles.input, styles.datePressable, { marginTop: 6 }]}
                  onPress={() => DateTimePickerAndroid.open({
                    value: batteryForm.fechaAdquisicion ? dateFromYmd(batteryForm.fechaAdquisicion) : new Date(),
                    mode: "date",
                    onChange: (event, date) => {
                      if (event.type !== "dismissed" && date) {
                        setBatteryForm((prev) => ({ ...prev, fechaAdquisicion: formatDateOnly(date) }));
                      }
                    },
                  })}
                >
                  <Text style={{ color: batteryForm.fechaAdquisicion ? "#1b2b3a" : "#8c9aaa", flex: 1 }}>
                    {batteryForm.fechaAdquisicion || "Seleccionar fecha"}
                  </Text>
                  <Ionicons name="calendar-outline" size={18} color="#111918" />
                </Pressable>
                <View style={{ flexDirection: "row", marginTop: 18 }}>
                  <Pressable style={[styles.btnOutline, { flex: 1, justifyContent: "center", marginRight: 9 }]} onPress={() => setShowBatteryForm(false)}>
                    <Text style={styles.btnOutlineText}>Cancelar</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.btnPrimary, { flex: 1, justifyContent: "center", opacity: savingBattery ? 0.65 : 1 }]}
                    disabled={savingBattery}
                    onPress={saveBattery}
                  >
                    {savingBattery ? <ActivityIndicator color="#fff" /> : <Ionicons name="save-outline" size={18} color="#fff" />}
                    <Text style={styles.btnPrimaryText}>Guardar batería</Text>
                  </Pressable>
                </View>
              </ScrollView>
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>

      <Modal
        visible={showEquipoForm}
        animationType="fade"
        transparent
        statusBarTranslucent
        presentationStyle="overFullScreen"
        onRequestClose={() => !savingEquipo && setShowEquipoForm(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={closeKeyboard}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.equipoFormKeyboard}>
            <Pressable style={styles.equipoFormSheet} onPress={() => {}}>
                <View style={styles.modalHeader}>
                  <View style={styles.equipoFormTitleRow}>
                    <View style={styles.equipoFormHeaderIcon}>
                      <MaterialCommunityIcons name="drone" size={22} color="#111918" />
                    </View>
                    <View style={{ flex: 1 }}>
                    <Text style={styles.modalTitle}>{editingEquipoId ? "Editar UAS" : "Nuevo UAS"}</Text>
                    <Text style={styles.notificationSubtitle}>Información técnica y estado operacional</Text>
                    </View>
                  </View>
                  <Pressable style={styles.notificationClose} onPress={() => !savingEquipo && setShowEquipoForm(false)}>
                    <Ionicons name="close" size={22} color="#111918" />
                  </Pressable>
                </View>

                <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 14, paddingBottom: 26 }}>
                  {([
                    ["ruas", "Número RUAS *", "Ej: RUAS-001"],
                    ["serie", "Número de serie *", "Serial del fabricante"],
                    ["modelo", "Modelo *", "Ej: DJI Matrice 350 RTK"],
                    ["horasVuelo", "Horas de vuelo", "0"],
                    ["manualUsuarioLink", "Enlace manual de usuario", "https://..."],
                  ] as const).map(([field, label, placeholder]) => (
                    <View key={field} style={{ marginBottom: 12 }}>
                      <Text style={styles.kLabel}>{label}</Text>
                      <TextInput
                        style={[styles.input, { marginTop: 6 }]}
                        value={equipoForm[field]}
                        onChangeText={(value) => setEquipoForm((prev) => ({ ...prev, [field]: value }))}
                        placeholder={placeholder}
                        placeholderTextColor="#8c9aaa"
                        keyboardType={field === "horasVuelo" ? "decimal-pad" : "default"}
                        autoCapitalize={field === "manualUsuarioLink" ? "none" : "sentences"}
                      />
                    </View>
                  ))}

                  <Text style={styles.kLabel}>Estado operacional</Text>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 7, marginBottom: 12 }}>
                    {["Aeronavegable", "No Aeronavegable", "Fuera de servicio", "Arrendado", "Vendido"].map((estado) => (
                      <Pressable
                        key={estado}
                        style={[styles.chip, { marginRight: 7, marginBottom: 7 }, equipoForm.estado === estado && styles.chipActive]}
                        onPress={() => setEquipoForm((prev) => ({ ...prev, estado, arrendado: estado === "Arrendado" }))}
                      >
                        <Text style={[styles.chipText, equipoForm.estado === estado && styles.chipTextActive]}>{estado}</Text>
                      </Pressable>
                    ))}
                  </View>

                  {([
                    ["polizaVigencia", "Inicio de vigencia de póliza"],
                    ["polizaVence", "Vencimiento de póliza"],
                    ...(equipoForm.arrendado
                      ? [
                          ["fechaInicioArrendamiento", "Inicio del arrendamiento"],
                          ["fechaFinArrendamiento", "Fin del arrendamiento"],
                        ]
                      : []),
                  ] as Array<[keyof typeof equipoForm, string]>).map(([field, label]) => (
                    <View key={field} style={{ marginBottom: 12 }}>
                      <Text style={styles.kLabel}>{label}</Text>
                      <Pressable
                        style={[styles.input, { marginTop: 6, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }]}
                        onPress={() => openEquipoDatePicker(field as any)}
                      >
                        <Text style={{ color: equipoForm[field] ? "#1b2b3a" : "#8c9aaa", fontFamily: FONT.regular }}>
                          {String(equipoForm[field] || "Seleccionar fecha")}
                        </Text>
                        <Ionicons name="calendar-outline" size={19} color="#0b5d8b" />
                      </Pressable>
                    </View>
                  ))}

                  <Text style={[styles.kLabel, { marginTop: 3, marginBottom: 7 }]}>Archivos del UAS</Text>
                  {([
                    ["foto", "Fotografía", "image-outline"],
                    ["polizaPdf", "Póliza PDF", "shield-check-outline"],
                    ["ruasPdf", "Certificado RUAS PDF", "file-certificate-outline"],
                  ] as const).map(([field, label, icon]) => (
                    <Pressable
                      key={field}
                      style={[styles.btnOutline, { marginBottom: 8, justifyContent: "flex-start" }]}
                      onPress={() => pickEquipoFile(field)}
                    >
                      <MaterialCommunityIcons name={icon} size={18} color="#0b5d8b" />
                      <Text style={[styles.btnOutlineText, { flex: 1 }]} numberOfLines={1}>
                        {equipoFiles[field]?.name || label}
                      </Text>
                      <Ionicons name={equipoFiles[field] ? "checkmark-circle" : "attach-outline"} size={18} color={equipoFiles[field] ? "#16a34a" : "#708596"} />
                    </Pressable>
                  ))}

                  <View style={{ flexDirection: "row", marginTop: 8 }}>
                    <Pressable
                      style={[styles.btnOutline, { flex: 1, justifyContent: "center", marginRight: 9 }]}
                      disabled={savingEquipo}
                      onPress={() => setShowEquipoForm(false)}
                    >
                      <Text style={styles.btnOutlineText}>Cancelar</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.btnPrimary, { flex: 1, justifyContent: "center", opacity: savingEquipo ? 0.65 : 1 }]}
                      disabled={savingEquipo}
                      onPress={saveEquipo}
                    >
                      {savingEquipo ? <ActivityIndicator color="#fff" /> : <Ionicons name="save-outline" size={18} color="#fff" />}
                      <Text style={styles.btnPrimaryText}>{savingEquipo ? "Guardando..." : "Guardar UAS"}</Text>
                    </Pressable>
                  </View>
                </ScrollView>
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>

      <Modal
        visible={showMissionPlanner}
        animationType="fade"
        transparent
        statusBarTranslucent
        presentationStyle="overFullScreen"
        onRequestClose={closeMissionPlanner}
      >
        <View style={styles.sheetOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeKeyboard} />
          <View style={styles.missionPlannerSheetWrap}>
            <View style={styles.modalWrap}>
              <View style={styles.missionPlannerSheet}>
                <MissionPlannerScreen
                  token={missionPlannerToken || String(ctxToken || token || "")}
                  onClose={closeMissionPlanner}
                  onCreated={handleMissionPlannerCreated}
                />
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {!alfabotKbVisible && (
      <View style={[styles.bottomNavWrap, { bottom: Math.max(insets.bottom + 4, 10), paddingBottom: 9 }]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.bottomNav}
          contentContainerStyle={styles.bottomNavContent}
          keyboardShouldPersistTaps="always"
          scrollEventThrottle={16}
          onScroll={(event) => {
            const x = Number(event?.nativeEvent?.contentOffset?.x || 0);
            if (x > 6 && showNavScrollHint) {
              setShowNavScrollHint(false);
            } else if (x <= 2 && !showNavScrollHint && section === "dashboard") {
              setShowNavScrollHint(true);
            }
          }}
          onScrollBeginDrag={() => {
            if (showNavScrollHint) setShowNavScrollHint(false);
          }}
          onScrollEndDrag={(event) => {
            const x = Number(event?.nativeEvent?.contentOffset?.x || 0);
            if (x <= 2 && section === "dashboard") setShowNavScrollHint(true);
          }}
          onMomentumScrollEnd={(event) => {
            const x = Number(event?.nativeEvent?.contentOffset?.x || 0);
            if (x <= 2 && section === "dashboard") setShowNavScrollHint(true);
          }}
        >
          <NavItem icon="chart-bar" label="Inicio" active={section === "dashboard"} onPress={() => goSection("dashboard")} />
          {isChiefPilotRole ? (
            <NavItem
              icon="briefcase-outline"
              label="Gestión"
              active={section === "chief-management"}
              onPress={() => goSection("chief-management")}
            />
          ) : null}
          <NavItem icon="airplane" label="Bitácora" active={section === "flight-log"} onPress={() => goSection("flight-log")} />
          <NavItem icon="map-marker-path" label="Misiones" active={section === "missions"} onPress={() => goSection("missions")} dot={misionesPendientes > 0} />
          <NavItem
            icon="drone"
            label="Equipos UAS"
            active={section === "equipos-uas"}
            onPress={() => {
              setEquiposViewMode("fleet");
              goSection("equipos-uas");
            }}
          />
          <NavItem icon="file-document-outline" label="Proced." active={section === "procedures"} onPress={openProceduresAll} />
          <NavItem
            icon="clipboard-list-outline"
            label="Rep. SMS"
            active={section === "my-reports" || (section === "new-report" && repClase !== "VOLUNTARIO")}
            onPress={() => goSection("my-reports")}
          />
          <NavItem
            icon="file-document-outline"
            label="Reporte voluntario"
            active={section === "new-report" && repClase === "VOLUNTARIO"}
            onPress={() => {
              setRepClase("VOLUNTARIO");
              goSection("new-report");
            }}
          />
          <NavItem icon="weather-partly-cloudy" label="Clima" active={section === "weather"} onPress={() => goSection("weather")} />
          <NavItem icon="view-dashboard-outline" label="Resumen" active={section === "ops-summary"} onPress={() => goSection("ops-summary")} />
          <NavItem icon="account-circle-outline" label="Perfil" active={section === "pilot-profile"} onPress={() => goSection("pilot-profile")} />
        </ScrollView>
        {showNavScrollHint ? (
          <View pointerEvents="none" style={styles.navScrollHint}>
            <Text style={styles.navScrollHintText}>Desliza</Text>
            <Ionicons name="chevron-forward" size={14} color="#d7e4e8" />
          </View>
        ) : null}
      </View>
      )}

      <Animated.View
        style={[
          styles.panicFab,
          {
            transform: [{ translateX: panicFabPos.x }, { translateY: panicFabPos.y }],
            opacity: panicFabReady ? 1 : 0,
          },
        ]}
        {...panicPanResponder.panHandlers}
      >
        <Pressable onPress={triggerPanicAlert} disabled={panicSending} hitSlop={10}>
          <View style={[styles.panicFabInner, panicSending && styles.panicFabDisabled]}>
            <MaterialCommunityIcons name="alert" size={26} color="#ffffff" />
          </View>
        </Pressable>
      </Animated.View>

      <Pressable style={styles.alfabotFab} onPress={toggleAlfabot} hitSlop={10}>
        <Animated.View
          pointerEvents="none"
          style={[
            styles.alfabotFabWave,
            { transform: [{ scale: alfabotWaveScale1 }], opacity: alfabotWaveOpacity1 },
          ]}
        />
        <Animated.View
          pointerEvents="none"
          style={[
            styles.alfabotFabWave,
            { transform: [{ scale: alfabotWaveScale2 }], opacity: alfabotWaveOpacity2 },
          ]}
        />
        <Image source={ALFABOT_BOT_IMG} style={styles.alfabotFabImg} />
      </Pressable>

      <Modal
        visible={alfabotOpen}
        transparent
        animationType="fade"
        onRequestClose={closeAlfabot}
      >
        <View style={styles.alfabotModalWrap}>
          <Pressable style={styles.alfabotBackdrop} onPress={closeAlfabot} />
          <KeyboardAvoidingView
            style={[
              styles.alfabotCardWrap,
              { paddingBottom: alfabotKbVisible ? alfabotKbPad : alfabotBasePad },
            ]}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            keyboardVerticalOffset={Platform.OS === "ios" ? (alfabotKbVisible ? alfabotKbPad : alfabotBasePad) : 0}
          >
            <View style={[styles.alfabotCard, alfabotKbVisible && styles.alfabotCardKeyboard]}>
              <View style={styles.alfabotHeader}>
                <View style={styles.alfabotHeaderLeft}>
                  <Image source={ALFABOT_BOT_IMG} style={styles.alfabotAvatar} />
                  <View>
                    <Text style={styles.alfabotTitle}>AlfaBot</Text>
                    <Text style={styles.alfabotSubtitle}>Asistente operacional</Text>
                  </View>
                </View>
                <Pressable onPress={closeAlfabot} style={styles.alfabotClose}>
                  <Text style={styles.alfabotCloseText}>X</Text>
                </Pressable>
              </View>

              <ScrollView
                style={styles.alfabotBody}
                ref={(r) => (alfabotScrollRef.current = r)}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={styles.alfabotBodyContent}
                onContentSizeChange={() => alfabotScrollRef.current?.scrollToEnd({ animated: true })}
              >
                {alfabotMessages.map((m, i) => (
                  <View
                    key={`${m.at}_${i}`}
                    style={[styles.alfabotMsg, m.role === "user" && styles.alfabotMsgUser]}
                  >
                    <Text style={[styles.alfabotMsgText, m.role === "user" && styles.alfabotMsgTextUser]}>
                      {m.text}
                    </Text>
                  </View>
                ))}
                {alfabotLoading ? (
                  <View style={styles.alfabotMsg}>
                    <Text style={styles.alfabotMsgText}>Pensando respuesta...</Text>
                  </View>
                ) : null}
              </ScrollView>

              <View style={styles.alfabotForm}>
                <TextInput
                  style={styles.alfabotInput}
                  value={alfabotDraft}
                  onChangeText={setAlfabotDraft}
                  placeholder="Pregunta sobre gestion operacional o RAC 100"
                  placeholderTextColor="#8a96a3"
                  autoCorrect={false}
                  autoCapitalize="sentences"
                  returnKeyType="send"
                  blurOnSubmit={false}
                  onSubmitEditing={sendAlfabot}
                />
                <Pressable
                  style={[styles.alfabotSend, (alfabotLoading || !alfabotDraft.trim()) && styles.alfabotSendDisabled]}
                  onPress={sendAlfabot}
                  disabled={alfabotLoading || !alfabotDraft.trim()}
                >
                  <Text style={styles.alfabotSendText}>Enviar</Text>
                </Pressable>
              </View>
              <Text style={styles.alfabotNote}>Solo temas de operacion y RAC 100.</Text>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>


      </KeyboardAvoidingView>

      </View>
    </>
  );
}

/** ===================== SUBCOMPONENTES ===================== */
function NavItem({
  icon,
  label,
  active,
  onPress,
  dot,
}: {
  icon: any;
  label: string;
  active: boolean;
  onPress: () => void;
  dot?: boolean;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.navItem, active && styles.navItemActive]}>
      <View style={{ position: "relative" }}>
        <View style={[styles.navIconWrap, active && styles.navIconWrapActive]}>
          <MaterialCommunityIcons name={icon} size={20} color={active ? "#111918" : "#d7e4e8"} />
        </View>
        {dot ? <View style={styles.navDot} /> : null}
      </View>
      <Text style={[styles.navText, active && styles.navTextActive]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

function normalizeText(s: string) {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // quita tildes
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function detectYesNo(textRaw: string): "yes" | "no" | null {
  const t = normalizeText(textRaw);

  // “si”, “sí”, “claro”, “afirmativo”, “ok”, “vale”, “de acuerdo”
  if (
    t === "si" ||
    t.includes(" si ") ||
    t.startsWith("si ") ||
    t.endsWith(" si") ||
    t.includes("claro") ||
    t.includes("afirm") ||
    t.includes("ok") ||
    t.includes("vale") ||
    t.includes("de acuerdo")
  ) return "yes";

  // “no”, “negativo”, “para nada”
  if (
    t === "no" ||
    t.includes(" no ") ||
    t.startsWith("no ") ||
    t.endsWith(" no") ||
    t.includes("negativo") ||
    t.includes("para nada")
  ) return "no";

  return null;
}


function QuickCard({
  icon,
  title,
  subtitle,
  onPress,
  dot,
}: {
  icon: any;
  title: string;
  subtitle: string;
  onPress: () => void;
  dot?: boolean;
}) {
  return (
    <Pressable onPress={onPress} style={styles.quickCard} hitSlop={10}>
      <View style={styles.row}>
        <View style={styles.quickIcon}>
          <MaterialCommunityIcons name={icon} size={22} color="#111918" />
          {dot ? <View style={styles.navDot} /> : null}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.quickTitle} numberOfLines={2}>
            {title}
          </Text>
          <Text style={styles.quickSub} numberOfLines={2}>
            {subtitle}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

function Field({ label, icon, children }: { label: string; icon: any; children: React.ReactNode }) {
  return (
    <View style={{ marginTop: 10 }}>
      <View style={styles.row}>
        <MaterialCommunityIcons name={icon} size={16} color="#111918" />
        <Text style={[styles.kLabel, styles.ml8]}>{label}</Text>
      </View>
      <View style={{ marginTop: 6 }}>{children}</View>
    </View>
  );
}

function KVP({ label, value, icon, valueStyle }: { label: string; value: string; icon: any; valueStyle?: any }) {
  return (
    <View style={styles.kv}>
      <View style={styles.row}>
        <MaterialCommunityIcons name={icon} size={16} color="#111918" />
        <Text style={[styles.kLabel, styles.ml8]}>{label}</Text>
      </View>
      <Text style={[styles.kValue, valueStyle]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

type LatLng = { latitude: number; longitude: number };

function toLatLngArray(areaOperacion: any): LatLng[] {
  if (!areaOperacion) return [];

  // ✅ Si viene como Feature => usar geometry
  const geo = areaOperacion?.type === "Feature" ? areaOperacion.geometry : areaOperacion;

  // ✅ Polygon GeoJSON: { type:"Polygon", coordinates: [ [ [lng,lat], ... ] ] }
  if (geo?.type === "Polygon" && Array.isArray(geo?.coordinates)) {
    const ring = geo.coordinates?.[0] || [];
    return ring
      .filter((p: any) => Array.isArray(p) && p.length >= 2)
      .map((p: any) => ({ longitude: Number(p[0]), latitude: Number(p[1]) })) // GeoJSON = [lng,lat]
      .filter((c: any) => Number.isFinite(c.latitude) && Number.isFinite(c.longitude));
  }

  // ✅ MultiPolygon por si acaso
  if (geo?.type === "MultiPolygon" && Array.isArray(geo?.coordinates)) {
    const ring = geo.coordinates?.[0]?.[0] || [];
    return ring
      .filter((p: any) => Array.isArray(p) && p.length >= 2)
      .map((p: any) => ({ longitude: Number(p[0]), latitude: Number(p[1]) }))
      .filter((c: any) => Number.isFinite(c.latitude) && Number.isFinite(c.longitude));
  }

  // Caso B: array [{lat,lng}] o [{latitude,longitude}]
  if (Array.isArray(areaOperacion)) {
    return areaOperacion
      .map((p: any) => {
        const lat = p.latitude ?? p.lat;
        const lng = p.longitude ?? p.lng ?? p.lon;
        return { latitude: Number(lat), longitude: Number(lng) };
      })
      .filter((c: any) => Number.isFinite(c.latitude) && Number.isFinite(c.longitude));
  }

  // Caso C: { polygon: [...] }
  if (Array.isArray(areaOperacion?.polygon)) {
    return toLatLngArray(areaOperacion.polygon);
  }

  return [];
}



function regionFromCoords(coords: LatLng[]) {
  if (!coords.length) {
    // Bogotá fallback (ajusta si quieres)
    return { latitude: 4.711, longitude: -74.072, latitudeDelta: 0.15, longitudeDelta: 0.15 };
  }

  let minLat = coords[0].latitude, maxLat = coords[0].latitude;
  let minLng = coords[0].longitude, maxLng = coords[0].longitude;

  for (const c of coords) {
    minLat = Math.min(minLat, c.latitude);
    maxLat = Math.max(maxLat, c.latitude);
    minLng = Math.min(minLng, c.longitude);
    maxLng = Math.max(maxLng, c.longitude);
  }

  const latitude = (minLat + maxLat) / 2;
  const longitude = (minLng + maxLng) / 2;

  const latitudeDelta = Math.max(0.01, (maxLat - minLat) * 1.8);
  const longitudeDelta = Math.max(0.01, (maxLng - minLng) * 1.8);

  return { latitude, longitude, latitudeDelta, longitudeDelta };
}

function escapeHtml(text: string) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildDashboardMapHtml(params: {
  center: LatLng;
  markerLabel: string;
  weather?: {
    ok: boolean;
    label: string;
    tempC?: number | null;
    windMs?: number | null;
    precipProbPct?: number | null;
    flightState: WeatherFlightState;
  };
  centerTick?: number;
}) {
  const { center, markerLabel, weather, centerTick = 0 } = params;
  const safeMarkerLabel = escapeHtml(markerLabel);
  const safeWeatherLabel = escapeHtml(weather?.ok ? weather.label : "Actualizando clima");
  const temperatureLabel = weather?.tempC != null ? `${weather.tempC.toFixed(1)}°C` : "—";
  const windLabel = weather?.windMs != null ? `${weather.windMs.toFixed(1)} m/s` : "—";
  const rainLabel = weather?.precipProbPct != null ? `${Math.round(weather.precipProbPct)}%` : "—";
  const flightLabel =
    weather?.flightState === "APTAS"
      ? "Condiciones aptas"
      : weather?.flightState === "NO_RECOMENDADAS"
        ? "No recomendadas"
        : "Condiciones marginales";
  const flightColor =
    weather?.flightState === "APTAS"
      ? "#15803d"
      : weather?.flightState === "NO_RECOMENDADAS"
        ? "#b91c1c"
        : "#b45309";
  const safeFlightLabel = escapeHtml(flightLabel);

  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0" />
    <style>
      html, body, #map { height: 100%; margin: 0; padding: 0; background: #f4f6fa; }
      body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      .leaflet-control-attribution {
        padding: 2px 5px !important;
        border-radius: 7px 0 0 0;
        background: rgba(255,255,255,.78) !important;
        font-size: 8px !important;
      }
      .weather-tooltip {
        min-width: 188px;
        padding: 0 !important;
        overflow: hidden;
        border: 0 !important;
        border-radius: 16px !important;
        background: rgba(255,255,255,.97) !important;
        box-shadow: 0 12px 30px rgba(15,23,42,.24) !important;
      }
      .weather-tooltip:before { display: none !important; }
      .weather-card { padding: 11px 12px 10px; color: #102a43; }
      .weather-title { font-size: 13px; line-height: 17px; font-weight: 800; }
      .weather-state { margin-top: 2px; font-size: 10px; font-weight: 700; color: ${flightColor}; }
      .weather-grid { display: flex; gap: 12px; margin-top: 8px; }
      .weather-value { font-size: 12px; font-weight: 800; color: #111918; white-space: nowrap; }
      .weather-label { margin-top: 1px; font-size: 8px; font-weight: 700; color: #718096; text-transform: uppercase; }
    </style>
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  </head>
  <body>
    <div id="map"></div>
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <script>
      const center = ${JSON.stringify([center.latitude, center.longitude])};
      const centerTick = ${JSON.stringify(centerTick)};
      const map = L.map("map", { zoomControl: false, dragging: true, scrollWheelZoom: false });

      L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
        maxZoom: 20,
        attribution: "Tiles &copy; Esri"
      }).addTo(map);

      L.tileLayer("https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}", {
        maxZoom: 20,
        attribution: "Labels &copy; Esri"
      }).addTo(map);

      const liveIcon = L.divIcon({
        className: "",
        html: '<div style="width:20px;height:20px;border-radius:999px;background:#14b8ff;border:4px solid #fff;box-shadow:0 8px 18px rgba(20,184,255,.45)"></div>',
        iconSize: [20, 20],
        iconAnchor: [10, 10]
      });

      const marker = L.marker(center, { icon: liveIcon }).addTo(map);
      marker.bindPopup("${safeMarkerLabel}");
      marker.bindTooltip(
        '<div class="weather-card">' +
          '<div class="weather-title">${safeWeatherLabel}</div>' +
          '<div class="weather-state">${safeFlightLabel}</div>' +
          '<div class="weather-grid">' +
            '<div><div class="weather-value">${temperatureLabel}</div><div class="weather-label">Temperatura</div></div>' +
            '<div><div class="weather-value">${windLabel}</div><div class="weather-label">Viento</div></div>' +
            '<div><div class="weather-value">${rainLabel}</div><div class="weather-label">Lluvia</div></div>' +
          '</div>' +
        '</div>',
        { permanent: true, direction: "top", offset: [0, -16], className: "weather-tooltip", opacity: 1 }
      ).openTooltip();
      map.setView(center, 15);
      window.__mapCenterTick = centerTick;
    </script>
  </body>
  </html>
  `;
}

function toFeetLabel(meters?: number | null) {
  if (!Number.isFinite(Number(meters))) return "—";
  return `${Math.round(Number(meters) * 3.28084)} ft`;
}

function formatForecastHourLabel(iso?: string, index = 0) {
  if (!iso) return index === 0 ? "ahora" : `+${index} h`;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return index === 0 ? "ahora" : `+${index} h`;
  const hours = date.getHours();
  const mins = date.getMinutes();
  const suffix = hours >= 12 ? "pm" : "am";
  const hour12 = hours % 12 || 12;
  if (index === 0) return "ahora";
  return `${hour12}:${String(mins).padStart(2, "0")} ${suffix}`;
}


async function registerForPushAndSendToBackend(apiFetch: any) {
  if (!Device.isDevice) {
    console.log("⚠️ Push requiere dispositivo físico (no emulador).");
    return;
  }

  // Permisos
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    console.log("⚠️ Permiso de notificaciones denegado.");
    return;
  }

  // Android: canal (importante para que suene bien)
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      sound: "default",
    });
  }

  // Token Expo
  const token = (await Notifications.getExpoPushTokenAsync()).data;
  console.log("✅ Expo Push Token:", token);

  // Guardar en tu backend
  await apiFetch("/api/push/register", {
    method: "POST",
    body: JSON.stringify({ token }),
  });
}



/** ===================== ESTILOS / HELPERS ===================== */
function pillStyle(level?: AlertTipo) {
  switch (level) {
    case "warning":
      return { backgroundColor: "#fff0d9" };
    case "info":
      return { backgroundColor: "#e8f0ff" };
    case "error":
      return { backgroundColor: "#ffe3e3" };
    case "success":
      return { backgroundColor: "#e7f7ec" };
    default:
      return { backgroundColor: "#eef2f7" };
  }
}

function reportStateStyle(estado: Reporte["estado"]) {
  switch (estado) {
    case "Pendiente":
      return { backgroundColor: "#fff0d9" };
    case "En revisión":
      return { backgroundColor: "#e8f0ff" };
    case "Cerrado":
      return { backgroundColor: "#e7f7ec" };
  }
}

function prioridadeColor(prioridad?: string) {
  if (prioridad === "Alta") return "#991b1b";
  if (prioridad === "Baja") return "#0f766e";
  return "#8a5a00";
}

function formatBytes(size?: number) {
  const bytes = Number(size || 0);
  if (!bytes) return "";
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

function getCertStatus(fecha?: string | Date) {
  if (!fecha) return { color: "#9aa7b5", label: "—" };

  const hoy = new Date();
  const vencimiento = new Date(fecha);

  const diffMs = vencimiento.getTime() - hoy.getTime();
  const diffDias = diffMs / (1000 * 60 * 60 * 24);
  const diffMeses = diffDias / 30.44; // promedio real

  if (diffMeses < 0) {
    return { color: "#b91c1c", label: "Vencido" }; // rojo oscuro
  }

  if (diffMeses < 6) {
    return { color: "#dc2626", label: "Por vencer" }; // rojo
  }

  return { color: "#16a34a", label: "Vigente" }; // verde
}

const styles = StyleSheet.create({
  screenBroadcastCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#cfe1ec",
    borderRadius: 18,
    padding: 16,
    marginTop: 14,
    shadowColor: "#0b4164",
    shadowOpacity: 0.07,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },
  screenBroadcastIcon: {
    width: 50,
    height: 50,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0799c1",
  },
  screenBroadcastTitle: {
    fontFamily: "Nunito_800ExtraBold",
    color: "#062d50",
    fontSize: 17,
  },
  screenBroadcastText: {
    fontFamily: "Nunito_400Regular",
    color: "#687b8e",
    fontSize: 13,
    marginTop: 2,
  },
  missionPlannerSheetWrap: {
    flex: 1,
    width: "100%",
    justifyContent: "flex-end",
  },
  missionPlannerSheet: {
    flex: 1,
    maxHeight: "92%",
    width: "100%",
    maxWidth: 760,
    alignSelf: "center",
    overflow: "hidden",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: "#f6f7f8",
    shadowColor: "#020817",
    shadowOpacity: 0.28,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 14,
  },
  screen: { flex: 1, backgroundColor: "#ffffff" },

  row: { flexDirection: "row", alignItems: "center" },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  mr10: { marginRight: 10 },
  ml8: { marginLeft: 8 },

  /* ===== HERO ===== */
  hero: {
    paddingHorizontal: 16,
    paddingBottom: 20,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    shadowColor: "#0b2f57",
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  heroTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  heroRight: { flexDirection: "row", alignItems: "center" },
  heroIconBtn: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.16)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.24)",
    alignItems: "center",
    justifyContent: "center",
  },
  heroHello: {
    fontFamily: FONT.semi,
    fontSize: 20,
    color: "#ffffff",
  },
  heroSub: {
    fontFamily: FONT.regular,
    fontSize: 13,
    color: "rgba(255,255,255,0.85)",
    marginTop: 2,
  },

  bannerCard: {
    height: 132,
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    shadowColor: "#07213f",
    shadowOpacity: 0.22,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  bannerImg: { width: "100%", height: "100%" },
  flyNorthBannerCard: {
    backgroundColor: "#ffffff",
    borderColor: "rgba(255,255,255,0.45)",
  },
  flyNorthBannerImg: {
    width: "92%",
    height: "92%",
    alignSelf: "center",
  },
  bannerOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: 14,
    backgroundColor: "rgba(7,26,49,0.34)",
  },
  bannerTitle: { fontFamily: FONT.semi, fontSize: 14, color: "#fff" },
  bannerText: { marginTop: 4, fontFamily: FONT.regular, fontSize: 12, color: "rgba(255,255,255,0.92)" },

  /* ===== CONTENIDO ===== */
  content: { flex: 1, paddingHorizontal: 16, paddingTop: 14, marginTop: -20 },

  /* USER STRIP (card flotante) */
  userStrip: {
    backgroundColor: "white",
    borderRadius: 22,
    borderWidth: 0,
    paddingHorizontal: 14,
    paddingVertical: 13,
    marginBottom: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 5,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 18,
    backgroundColor: "#111918",
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  avatarImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  avatarText: { color: "white", fontFamily: FONT.semi, fontSize: 14, lineHeight: 18 },
  userName: { ...TEXT.h3, color: "#1b2b3a", fontFamily: FONT.semi },
  userMeta: { ...TEXT.small, color: "#6b7a8a", marginTop: 2, fontFamily: FONT.regular },

  pilotIdCard: {
    marginTop: 10,
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: "#f6f8fc",
    borderWidth: 1,
    borderColor: "#d8e7f7",
    alignItems: "center",
    paddingBottom: 14,
    position: "relative",
  },
  pilotIdCornerTL: {
    position: "absolute",
    left: 6,
    top: 6,
    width: 18,
    height: 18,
    borderLeftWidth: 4,
    borderTopWidth: 4,
    borderColor: "#ffffff",
    borderTopLeftRadius: 6,
    zIndex: 20,
  },
  pilotIdCornerTR: {
    position: "absolute",
    right: 6,
    top: 6,
    width: 18,
    height: 18,
    borderRightWidth: 4,
    borderTopWidth: 4,
    borderColor: "#ffffff",
    borderTopRightRadius: 6,
    zIndex: 20,
  },
  pilotIdCornerBL: {
    position: "absolute",
    left: 6,
    bottom: 6,
    width: 18,
    height: 18,
    borderLeftWidth: 4,
    borderBottomWidth: 4,
    borderColor: "#ffffff",
    borderBottomLeftRadius: 6,
    zIndex: 20,
  },
  pilotIdCornerBR: {
    position: "absolute",
    right: 6,
    bottom: 6,
    width: 18,
    height: 18,
    borderRightWidth: 4,
    borderBottomWidth: 4,
    borderColor: "#ffffff",
    borderBottomRightRadius: 6,
    zIndex: 20,
  },
  pilotIdHeader: {
    width: "100%",
    height: 154,
    paddingTop: 14,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
    borderBottomLeftRadius: 138,
    borderBottomRightRadius: 138,
  },
  pilotIdHeaderContent: {
    marginTop: -12,
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 4,
  },
  pilotIdHeaderLogo: {
    width: 138,
    height: 72,
  },
  pilotIdWave: {
    position: "absolute",
    borderColor: "rgba(255,255,255,0.18)",
    borderWidth: 1.4,
    borderRadius: 999,
    zIndex: 1,
  },
  pilotIdWaveOne: {
    width: 260,
    height: 180,
    left: -120,
    top: -30,
  },
  pilotIdWaveTwo: {
    width: 320,
    height: 220,
    left: -160,
    top: -54,
    borderColor: "rgba(255,255,255,0.14)",
  },
  pilotIdWaveThree: {
    width: 220,
    height: 140,
    right: -110,
    top: 8,
    borderColor: "rgba(255,255,255,0.12)",
  },
  pilotIdAvatarRing: {
    marginTop: -52,
    width: 106,
    height: 106,
    borderRadius: 53,
    backgroundColor: "#ffffff",
    borderWidth: 2,
    borderColor: "#111918",
    alignItems: "center",
    justifyContent: "center",
  },
  pilotIdAvatar: {
    width: 94,
    height: 94,
    borderRadius: 47,
    overflow: "hidden",
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  pilotIdAvatarImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  pilotIdAvatarText: {
    color: "#111918",
    fontFamily: FONT.semi,
    fontSize: 22,
  },
  pilotIdName: {
    marginTop: 10,
    color: "#1b2b3a",
    fontFamily: FONT.semi,
    fontSize: 18,
    lineHeight: 24,
    textAlign: "center",
    paddingHorizontal: 14,
  },
  pilotIdRole: {
    marginTop: 2,
    color: "#6b7a8a",
    fontFamily: FONT.regular,
    fontSize: 16,
    lineHeight: 22,
  },
  pilotIdQrWrap: {
    marginTop: 12,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e4edf8",
  },
  pilotIdQrImage: {
    width: 120,
    height: 120,
    borderRadius: 12,
  },
  pilotIdQrText: {
    marginTop: 4,
    color: "#64748b",
    fontFamily: FONT.semi,
    fontSize: 12,
  },

  /* NAV INFERIOR */
  bottomNavWrap: {
    position: "absolute",
    alignSelf: "center",
    left: 24,
    right: 24,
    bottom: 12,
    paddingHorizontal: 14,
    paddingTop: 12,
    backgroundColor: "#111918",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 999,
    shadowColor: "#000000",
    shadowOpacity: 0.26,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },
  bottomNav: {
    maxHeight: 76,
  },
  bottomNavContent: {
    alignItems: "center",
    paddingRight: 12,
    paddingLeft: 0,
  },
  navScrollHint: {
    position: "absolute",
    right: 8,
    top: 12,
    bottom: 12,
    width: 42,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(17,25,24,0.94)",
  },
  navScrollHintText: {
    ...TEXT.small,
    fontFamily: FONT.semi,
    color: "#d7e4e8",
    fontSize: 10,
    marginBottom: 0,
  },
  navItem: {
    width: 68,
    height: 58,
    paddingVertical: 0,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
    borderWidth: 0,
    backgroundColor: "transparent",
  },
  navItemActive: { backgroundColor: "transparent" },
  navIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
    overflow: "hidden",
  },
  navIconWrapActive: {
    backgroundColor: "#f4fbf7",
    borderRadius: 18,
  },
  navText: { ...TEXT.small, color: "#d7e4e8", marginTop: 4, fontFamily: FONT.regular, fontSize: 10, opacity: 1 },
  navTextActive: { color: "#ffffff", fontFamily: FONT.semi },
  navDot: {
    position: "absolute",
    top: 1,
    right: 1,
    width: 8,
    height: 8,
    borderRadius: 99,
    backgroundColor: "#ff4d4f",
    borderWidth: 1.5,
    borderColor: "#111918",
  },

  /* DASH CARD + CTA VERDE */
  statusCard: {
    backgroundColor: "white",
    borderRadius: 22,
    padding: 15,
    borderWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 5,
  },
  statusTitle: { fontFamily: FONT.semi, fontSize: 14, color: "#1b2b3a" },
  statusSub: { marginTop: 4, fontFamily: FONT.regular, fontSize: 12, color: "#6b7a8a" },

  ctaRow: { flexDirection: "row", alignItems: "center", marginTop: 14, marginBottom: 8 },
  ctaMain: {
    flex: 1,
    height: 56,
    borderRadius: 20,
    backgroundColor: "#111918",
    borderWidth: 0,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  ctaPanic: {
    backgroundColor: "#070b0d",
  },
  ctaMainDisabled: {
    opacity: 0.7,
  },
  ctaText: { fontFamily: FONT.semi, fontSize: 14, color: "#ffffff" },
  ctaSide: {
    width: 56,
    height: 56,
    borderRadius: 20,
    backgroundColor: "#111918",
    borderWidth: 0,
    marginLeft: 10,
    alignItems: "center",
    justifyContent: "center",
  },

  /* TITULOS */
  sectionTitle: { ...TEXT.h2, color: "#1b2b3a", marginBottom: 10, fontFamily: FONT.semi, marginTop: 12 },
  subTitle: { ...TEXT.h3, color: "#111918", marginBottom: 10, marginTop: 6, fontFamily: FONT.semi },
  infoBanner: {
    marginTop: 10,
    backgroundColor: "#f3f4f6",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 14,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  infoBannerText: { ...TEXT.small, color: "#111918", flex: 1, fontFamily: FONT.semi },

  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" },

  quickCard: {
    width: "48%",
    backgroundColor: "white",
    borderRadius: 22,
    padding: 14,
    borderWidth: 0,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 5,
  },
  quickIcon: {
    width: 36,
    height: 36,
    borderRadius: 14,
    backgroundColor: "#f3f4f6",
    borderWidth: 0,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  quickTitle: { ...TEXT.h3, color: "#1b2b3a", fontFamily: FONT.semi },
  quickSub: { ...TEXT.small, color: "#6b7a8a", marginTop: 4, fontFamily: FONT.regular },
  activeMissionStrip: {
    marginTop: 12,
    marginBottom: 12,
    backgroundColor: "#ffffff",
    borderRadius: 22,
    borderWidth: 0,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    shadowColor: "#000",
    shadowOpacity: 0.07,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  activeMissionTitle: { ...TEXT.h3, color: "#111918", fontFamily: FONT.semi },
  activeMissionSub: { ...TEXT.small, color: "#6b7a8a", fontFamily: FONT.regular, marginTop: 2 },
  airReadyMapCard: {
    backgroundColor: "#ffffff",
    borderRadius: 26,
    padding: 10,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 5,
  },
  airSearchBar: {
    minHeight: 58,
    borderRadius: 18,
    backgroundColor: "#ffffff",
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    marginBottom: 10,
  },
  airSearchTitle: {
    ...TEXT.h3,
    color: "#1b2b3a",
    fontFamily: FONT.semi,
  },
  airSearchCoords: {
    ...TEXT.small,
    color: "#64748b",
    fontFamily: FONT.regular,
    marginTop: 3,
  },
  airAvatarShell: {
    width: 42,
    height: 42,
    borderRadius: 16,
    backgroundColor: "#1d4ed8",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  airAvatarImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  airAvatarText: {
    color: "#ffffff",
    fontFamily: FONT.semi,
    fontSize: 13,
  },
  airMapShell: {
    height: 430,
    borderRadius: 22,
    overflow: "hidden",
    backgroundColor: "#eef2f7",
    position: "relative",
  },
  airMapFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  notificationBadge: {
    position: "absolute",
    top: -5,
    right: -5,
    minWidth: 19,
    height: 19,
    paddingHorizontal: 4,
    borderRadius: 10,
    backgroundColor: "#ef4444",
    borderWidth: 2,
    borderColor: "#070b0d",
    alignItems: "center",
    justifyContent: "center",
  },
  notificationBadgeText: {
    color: "#ffffff",
    fontSize: 9,
    lineHeight: 11,
    fontFamily: FONT.extra,
  },
  notificationOverlay: {
    flex: 1,
    backgroundColor: "rgba(3, 9, 14, 0.54)",
    justifyContent: "flex-start",
    paddingHorizontal: 14,
    paddingTop: 88,
  },
  notificationSheet: {
    alignSelf: "flex-end",
    width: "100%",
    maxWidth: 430,
    maxHeight: "72%",
    borderRadius: 22,
    backgroundColor: "#ffffff",
    padding: 16,
    shadowColor: "#000000",
    shadowOpacity: 0.2,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 9 },
    elevation: 10,
  },
  notificationSubtitle: {
    marginTop: 2,
    color: "#64748b",
    fontSize: 12,
    fontFamily: FONT.regular,
  },
  notificationClose: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
  },
  notificationRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#dbe4ec",
  },
  notificationIcon: {
    width: 39,
    height: 39,
    borderRadius: 13,
    marginRight: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  notificationIconDanger: { backgroundColor: "#dc2626" },
  notificationIconWarning: { backgroundColor: "#d97706" },
  notificationIconInfo: { backgroundColor: "#0b5d8b" },
  notificationTitle: {
    color: "#111918",
    fontSize: 14,
    fontFamily: FONT.semi,
  },
  notificationDetail: {
    marginTop: 3,
    color: "#64748b",
    fontSize: 12,
    lineHeight: 17,
    fontFamily: FONT.regular,
  },
  notificationEmpty: {
    alignItems: "center",
    paddingVertical: 32,
    paddingHorizontal: 18,
  },
  notificationEmptyTitle: {
    marginTop: 10,
    color: "#1f2937",
    fontSize: 15,
    fontFamily: FONT.semi,
  },
  notificationEmptyText: {
    marginTop: 4,
    color: "#7a8b9a",
    textAlign: "center",
    fontSize: 12,
    fontFamily: FONT.regular,
  },
  airMapTopLeft: {
    position: "absolute",
    left: 12,
    top: 12,
    borderRadius: 12,
    backgroundColor: "#0ea5e9",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  airMapTopRight: {
    position: "absolute",
    right: 12,
    top: 12,
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "#0ea5e9",
    alignItems: "center",
    justifyContent: "center",
  },
  airMapBadgeText: {
    ...TEXT.small,
    color: "#ffffff",
    fontFamily: FONT.semi,
  },
  airConditionsSheet: {
    backgroundColor: "#ffffff",
    borderRadius: 28,
    paddingTop: 10,
    paddingHorizontal: 14,
    paddingBottom: 16,
    marginTop: -8,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  airSheetHandle: {
    width: 44,
    height: 5,
    borderRadius: 999,
    backgroundColor: "#d1d5db",
    alignSelf: "center",
    marginBottom: 12,
  },
  airSectionEyebrow: {
    ...TEXT.small,
    color: "#475569",
    fontFamily: FONT.semi,
  },
  airConditionsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 10,
    marginBottom: 12,
  },
  airRoundIcon: {
    width: 34,
    height: 34,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
  },
  airRoundIconDisabled: {
    opacity: 0.35,
  },
  airConditionsDay: {
    fontFamily: FONT.semi,
    fontSize: 18,
    color: "#111918",
    textTransform: "lowercase",
  },
  airConditionsDate: {
    ...TEXT.small,
    color: "#64748b",
    fontFamily: FONT.regular,
    marginTop: 2,
    textTransform: "lowercase",
  },
  airConditionRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#edf2f7",
    borderRadius: 16,
    padding: 8,
    marginBottom: 10,
  },
  airConditionTimePill: {
    minWidth: 78,
    borderRadius: 12,
    backgroundColor: "#f97316",
    paddingHorizontal: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  airConditionTimePillGood: {
    backgroundColor: "#16a34a",
  },
  airConditionTimePillWarn: {
    backgroundColor: "#f97316",
  },
  airConditionTimePillBad: {
    backgroundColor: "#dc2626",
  },
  airConditionTimeText: {
    color: "#ffffff",
    fontFamily: FONT.semi,
    fontSize: 13,
  },
  airConditionMain: {
    ...TEXT.body,
    color: "#111918",
    fontFamily: FONT.semi,
  },
  airConditionSub: {
    ...TEXT.small,
    color: "#64748b",
    fontFamily: FONT.regular,
    marginTop: 4,
  },
  airReasonsText: {
    ...TEXT.small,
    color: "#6b7280",
    fontFamily: FONT.regular,
    marginTop: 12,
  },

  card: {
    backgroundColor: "white",
    borderRadius: 22,
    padding: 14,
    borderWidth: 0,
    marginTop: 12,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  cardSoft: {
    backgroundColor: "#f5f5f5",
    borderRadius: 20,
    padding: 12,
    borderWidth: 0,
  },
  cardTitle: { ...TEXT.h3, color: "#1b2b3a", fontFamily: FONT.semi },
  readinessCardReady: {
    borderColor: "#bfecd1",
    backgroundColor: "#f1fbf4",
  },
  readinessCardWarn: {
    borderColor: "#f2d1a2",
    backgroundColor: "#fff8ed",
  },
  readinessTitle: { marginTop: 4, ...TEXT.h3, fontFamily: FONT.semi },
  readinessGrid: {
    marginTop: 14,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  readinessItem: {
    width: "48%",
    backgroundColor: "rgba(255,255,255,0.88)",
    borderRadius: 16,
    padding: 11,
    borderWidth: 0,
  },
  readinessLabel: { ...TEXT.small, color: "#64748b", fontFamily: FONT.regular },
  readinessValue: { marginTop: 6, ...TEXT.body, fontFamily: FONT.semi },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  statusBadgeSuccess: { backgroundColor: "#dcfce7" },
  statusBadgeWarn: { backgroundColor: "#fef3c7" },
  statusBadgeInfo: { backgroundColor: "#e5e7eb" },
  statusBadgeText: { ...TEXT.small, color: "#1b2b3a", fontFamily: FONT.semi },
  kpiDeck: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginTop: 8,
  },
  kpiTile: {
    width: "48%",
    backgroundColor: "#f5f5f5",
    borderRadius: 18,
    padding: 12,
    borderWidth: 0,
    marginTop: 10,
  },
  kpiTileValue: { fontSize: 22, color: "#111918", fontFamily: FONT.extra },
  kpiTileLabel: { ...TEXT.small, color: "#6b7a8a", marginTop: 4, fontFamily: FONT.regular },
  syncGrid: {
    marginTop: 10,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 10,
  },
  syncCard: {
    width: "48%",
    backgroundColor: "#f5f5f5",
    borderRadius: 16,
    padding: 12,
    borderWidth: 0,
  },
  syncValue: { fontSize: 20, color: "#111918", fontFamily: FONT.extra },
  syncLabel: { ...TEXT.small, color: "#6b7a8a", marginTop: 4, fontFamily: FONT.regular },
  weatherStateCard: {
    marginTop: 12,
    borderRadius: 16,
    padding: 12,
  },
  weatherStateGood: { backgroundColor: "#e7f7ec" },
  weatherStateWarn: { backgroundColor: "#fff0d9" },
  weatherStateBad: { backgroundColor: "#ffe3e3" },
  weatherStateTitle: { ...TEXT.small, color: "#334155", fontFamily: FONT.semi },
  weatherStateValue: { ...TEXT.body, color: "#0f172a", fontFamily: FONT.extra },
  weatherStateReason: { marginTop: 8, ...TEXT.small, color: "#475569", fontFamily: FONT.regular },
  weatherDisclaimerCard: {
    marginTop: 10,
    borderRadius: 16,
    backgroundColor: "#fff8e6",
    borderWidth: 1,
    borderColor: "#f2d9a6",
    padding: 12,
  },
  weatherDisclaimerTitle: {
    marginLeft: 8,
    flex: 1,
    ...TEXT.small,
    color: "#7c4b00",
    fontFamily: FONT.semi,
  },
  weatherDisclaimerText: {
    marginTop: 8,
    ...TEXT.small,
    color: "#6b4e16",
    fontFamily: FONT.regular,
  },
  compassCard: {
    marginTop: 12,
    backgroundColor: "#0b0f16",
    borderRadius: 16,
    padding: 12,
  },
  compassPhoneWrap: {
    marginTop: 10,
    width: 280,
    height: 280,
    alignSelf: "center",
    borderRadius: 999,
    borderWidth: 2,
    borderColor: "#1f2937",
    backgroundColor: "#05070b",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  compassPhoneDial: {
    width: 250,
    height: 250,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  compassPhoneMarker: {
    position: "absolute",
    top: 8,
    width: 3,
    height: 44,
    borderRadius: 3,
    backgroundColor: "#ffffff",
    zIndex: 30,
  },
  compassTick: {
    position: "absolute",
    top: 8,
    width: 1.5,
    height: 10,
    borderRadius: 2,
    backgroundColor: "#d1d5db",
  },
  compassTickMajor: {
    height: 16,
    backgroundColor: "#ffffff",
  },
  compassDegreeLabel: {
    position: "absolute",
    top: "50%",
    left: "50%",
    marginLeft: -18,
    marginTop: -9,
    width: 36,
    textAlign: "center",
    color: "#e5e7eb",
    fontSize: 13,
    fontFamily: FONT.regular,
  },
  compassDirLabel: {
    position: "absolute",
    top: "50%",
    left: "50%",
    marginLeft: -12,
    marginTop: -10,
    width: 24,
    textAlign: "center",
    color: "#ffffff",
    fontSize: 18,
    fontFamily: FONT.semi,
  },
  compassNeedleLive: {
    position: "absolute",
    top: "50%",
    left: "50%",
    marginLeft: -14,
    marginTop: -92,
    width: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  compassReadout: {
    marginTop: 16,
    textAlign: "center",
    color: "#f8fafc",
    fontSize: 44,
    fontFamily: FONT.regular,
  },
  compassCoords: {
    marginTop: 6,
    textAlign: "center",
    color: "#cbd5e1",
    fontSize: 18,
    fontFamily: FONT.semi,
  },
  compassSubText: {
    marginTop: 8,
    textAlign: "center",
    color: "#94a3b8",
    fontSize: 14,
    fontFamily: FONT.regular,
  },
  compassRow: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  compassDial: {
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: "#f3f4f6",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  compassNorth: {
    position: "absolute",
    top: 6,
    fontSize: 11,
    color: "#111918",
    fontFamily: FONT.extra,
  },
  compassNeedleWrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  weatherGrid: {
    marginTop: 12,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 10,
  },
  weatherMetric: {
    width: "48%",
    backgroundColor: "#f5f5f5",
    borderRadius: 16,
    padding: 10,
  },
  weatherMetricLabel: { ...TEXT.small, color: "#64748b", fontFamily: FONT.semi },
  weatherMetricValue: { marginTop: 4, ...TEXT.body, color: "#111918", fontFamily: FONT.extra },
  weatherMetricSub: { marginTop: 4, ...TEXT.small, color: "#6b7a8a", fontFamily: FONT.regular },
  wxTable: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#ffffff",
    minWidth: 1620,
  },
  wxRow: {
    flexDirection: "row",
    alignItems: "stretch",
  },
  wxHeaderRow: {
    backgroundColor: "#f4f8ff",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  wxCell: {
    width: 98,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRightWidth: 1,
    borderRightColor: "#e5e7eb",
    textAlign: "center",
    color: "#1b2b3a",
    fontFamily: FONT.regular,
    fontSize: 12,
  },
  wxHeaderCell: {
    fontFamily: FONT.semi,
    color: "#111918",
  },
  wxGoodCell: {
    justifyContent: "center",
    alignItems: "center",
  },
  wxGoodYes: {
    backgroundColor: "#d9f7d9",
  },
  wxGoodMaybe: {
    backgroundColor: "#fff4ce",
  },
  wxGoodNo: {
    backgroundColor: "#ffe2e2",
  },
  wxGoodText: {
    color: "#111918",
    fontFamily: FONT.semi,
    fontSize: 12,
  },
  timelineWrap: {
    marginTop: 12,
    backgroundColor: "#f5f5f5",
    borderRadius: 18,
    padding: 12,
    borderWidth: 0,
  },
  timelineHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  timelineBar: {
    height: 8,
    borderRadius: 999,
    backgroundColor: "#e6edf5",
    overflow: "hidden",
    marginBottom: 10,
  },
  timelineBarFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: "#111918",
  },
  timelineItem: { flexDirection: "row", alignItems: "center", marginTop: 8 },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 999,
    backgroundColor: "#d1d9e6",
    marginRight: 10,
  },
  timelineDotDone: { backgroundColor: "#111918" },
  timelineText: { ...TEXT.small, color: "#6b7a8a", fontFamily: FONT.semi },
  timelineTextDone: { color: "#111918" },
  equiposStateBox: {
    paddingVertical: 24,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  equiposDeck: {
    marginTop: 16,
    gap: 14,
  },
  equipoCardUas: {
    backgroundColor: "#f8fafc",
    borderRadius: 22,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#e3ebf5",
  },
  equipoCardMedia: {
    height: 160,
    backgroundColor: "#eef3f9",
  },
  equipoCardImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  equipoCardPlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  equipoCardBody: {
    padding: 14,
  },
  equipoCardTitle: {
    ...TEXT.h3,
    color: "#1b2b3a",
    fontFamily: FONT.semi,
  },
  equipoCardTag: {
    marginTop: 6,
    ...TEXT.small,
    color: "#6b7a8a",
    fontFamily: FONT.semi,
  },
  equipoCardBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#e7f7ec",
  },
  equipoCardBadgeText: {
    ...TEXT.small,
    color: "#0f5132",
    fontFamily: FONT.semi,
  },
  equipoCardMetaGrid: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
  },
  equipoCardMetaItem: {
    flex: 1,
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: "#e9eef5",
  },
  equipoCardMetaLabel: {
    ...TEXT.small,
    color: "#6b7a8a",
    fontFamily: FONT.semi,
  },
  equipoCardMetaValue: {
    marginTop: 6,
    ...TEXT.body,
    color: "#111918",
    fontFamily: FONT.semi,
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginTop: 8,
  },
  summaryLabel: { ...TEXT.small, color: "#1b2b3a", flex: 1, fontFamily: FONT.semi },
  summaryValue: { ...TEXT.small, color: "#111918", fontFamily: FONT.semi },
  summaryAction: { ...TEXT.small, color: "#b91c1c", fontFamily: FONT.semi },
  legalRow: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#e6e9ef",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },

  kvRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 10 },
  kv: {
    width: "48%",
    backgroundColor: "#f5f5f5",
    borderRadius: 18,
    padding: 12,
    borderWidth: 0,
  },
  kLabel: { ...TEXT.small, color: "#546372", fontFamily: FONT.regular },
  kValue: { marginTop: 6, fontFamily: FONT.semi, color: "#1b2b3a", fontSize: 13, lineHeight: 18 },

  bulletRow: { flexDirection: "row", alignItems: "center", marginTop: 8 },
  bullet: { width: 6, height: 6, borderRadius: 99, backgroundColor: "#111918", marginRight: 8 },
  bulletText: { ...TEXT.body, color: "#1b2b3a" },

  alertCard: {
    backgroundColor: "white",
    borderRadius: 22,
    padding: 14,
    borderWidth: 0,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  alertDate: { ...TEXT.small, color: "#6b7a8a", fontFamily: FONT.regular },
  alertState: { ...TEXT.small, color: "#111918", fontFamily: FONT.semi },
  alertMsg: { marginTop: 10, ...TEXT.body, color: "#1b2b3a" },

  pill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  pillText: { ...TEXT.small, fontFamily: FONT.semi, color: "#1b2b3a" },

  input: {
    backgroundColor: "#f5f5f5",
    borderWidth: 0,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: "#1b2b3a",
    fontFamily: FONT.regular,
    fontSize: 13,
    lineHeight: 18,
  },
  inputText: {
    color: "#1b2b3a",
    fontFamily: FONT.regular,
    fontSize: 13,
    lineHeight: 18,
    flex: 1,
  },
  placeholderText: {
    color: "#8a96a3",
  },
  datePressable: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  textArea: { minHeight: 90, textAlignVertical: "top" },
  logFileItem: {
    borderWidth: 0,
    borderRadius: 16,
    padding: 10,
    backgroundColor: "#f5f5f5",
  },
  logFileName: {
    color: "#1b2b3a",
    fontFamily: FONT.semi,
    fontSize: 12,
  },
  logFileMeta: {
    color: "#607080",
    fontFamily: FONT.regular,
    fontSize: 12,
    marginTop: 2,
  },
  logFileError: {
    color: "#c62828",
    fontFamily: FONT.semi,
    fontSize: 12,
    marginTop: 4,
  },
  logResultItem: {
    borderWidth: 0,
    borderRadius: 16,
    padding: 10,
    backgroundColor: "#f5f5f5",
  },
  logResultSuccess: {
    color: "#1b7f3b",
    fontFamily: FONT.semi,
    fontSize: 12,
    marginTop: 2,
  },
  logResultError: {
    color: "#c62828",
    fontFamily: FONT.semi,
    fontSize: 12,
    marginTop: 2,
  },

  btnPrimary: {
    backgroundColor: "#111918",
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
  },
  btnPrimaryDisabled: {
    opacity: 0.48,
  },
  btnPrimaryText: { color: "white", fontFamily: FONT.semi, fontSize: 13, lineHeight: 18, marginLeft: 8 },

  btnOutline: {
    backgroundColor: "#f3f4f6",
    borderWidth: 0,
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  btnOutlineText: { color: "#111918", fontFamily: FONT.semi, fontSize: 13, lineHeight: 18, marginLeft: 8 },
  textLink: { color: "#111918", fontFamily: FONT.semi, fontSize: 12 },

  btnGhost: {
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: "transparent",
    borderWidth: 0,
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
  },
  btnGhostText: { color: "#1b2b3a", fontFamily: FONT.semi },

  btnMini: {
    backgroundColor: "#f3f4f6",
    borderWidth: 0,
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  btnMiniText: { color: "#111918", fontFamily: FONT.semi },
  djiActionsRow: {
    marginTop: 12,
    marginBottom: 4,
    flexDirection: "row",
    justifyContent: "flex-start",
  },
  djiStatusDetail: {
    marginTop: 6,
    ...TEXT.small,
    color: "#5b6474",
    fontFamily: FONT.regular,
  },

  reportCard: {
    backgroundColor: "white",
    borderRadius: 22,
    padding: 14,
    borderWidth: 0,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  reportId: { ...TEXT.body, fontFamily: FONT.semi, color: "#1b2b3a" },
  reportMeta: { marginTop: 8, ...TEXT.small, color: "#6b7a8a", fontFamily: FONT.regular },
  reportDesc: { marginTop: 8, ...TEXT.body, color: "#1b2b3a" },
  paginationRow: {
    marginTop: 4,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  paginationText: { ...TEXT.small, color: "#6b7a8a", fontFamily: FONT.semi },
  paginationBtnDisabled: { opacity: 0.45 },

  flightCard: {
    backgroundColor: "white",
    borderRadius: 22,
    padding: 14,
    borderWidth: 0,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  flightHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 8,
  },
  flightBadges: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    flexShrink: 1,
    flexWrap: "wrap",
  },
  flightTitle: { ...TEXT.h3, color: "#1b2b3a", fontFamily: FONT.semi },
  flightMeta: { marginTop: 6, ...TEXT.small, color: "#6b7a8a", fontFamily: FONT.regular },
  flightBottom: { flexDirection: "row", justifyContent: "space-between", marginTop: 10 },
  flightDur: { ...TEXT.body, fontFamily: FONT.semi, color: "#111918" },
  flightLog: { ...TEXT.small, color: "#6b7a8a", fontFamily: FONT.regular },
  flightNotes: { marginTop: 10, ...TEXT.body, color: "#1b2b3a" },

  missionCard: {
    backgroundColor: "white",
    borderRadius: 22,
    padding: 14,
    borderWidth: 0,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  missionId: { ...TEXT.body, fontFamily: FONT.semi, color: "#1b2b3a" },
  missionRelationRow: { marginTop: 10, flexDirection: "row", flexWrap: "wrap", gap: 7 },
  missionRelationBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  missionRelationCreated: { backgroundColor: "#e0f2fe" },
  missionRelationAssigned: { backgroundColor: "#dcfce7" },
  missionRelationObserver: { backgroundColor: "#fef3c7" },
  missionRelationRecurring: { backgroundColor: "#ede9fe" },
  missionApprovalPending: { backgroundColor: "#ffedd5" },
  missionApprovalApproved: { backgroundColor: "#d1fae5" },
  missionRelationText: { ...TEXT.small, color: "#1f3449", fontFamily: FONT.semi },
  fieldDocCard: { marginTop: 10, padding: 13, borderRadius: 16, backgroundColor: "#f8fafc", borderWidth: 1, borderColor: "#e2e8f0" },
  fieldDocHeading: { flex: 1, flexDirection: "row", alignItems: "center", gap: 9 },
  fieldDocTitle: { ...TEXT.body, color: "#1b2b3a", fontFamily: FONT.semi },
  fieldDocMeta: { marginTop: 3, ...TEXT.small, color: "#6b7a8a", fontFamily: FONT.regular },
  fieldDocActions: { marginTop: 11, flexDirection: "row", flexWrap: "wrap", gap: 8 },
  warningInline: { marginTop: 9, ...TEXT.small, color: "#9a5800", fontFamily: FONT.semi },
  missionText: { marginTop: 8, ...TEXT.body, color: "#1b2b3a" },
  bold: { fontFamily: FONT.semi },
  missionOpsGrid: {
    marginTop: 10,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  missionOpsItem: {
    width: "48%",
    backgroundColor: "#f5f5f5",
    borderRadius: 16,
    padding: 10,
    borderWidth: 0,
    marginTop: 8,
  },
  missionOpsValue: { marginTop: 4, ...TEXT.body, color: "#1b2b3a", fontFamily: FONT.semi },
  missionFilesBox: {
    marginTop: 12,
    backgroundColor: "#f5f5f5",
    borderRadius: 18,
    padding: 12,
  },
  missionFilesTitle: {
    ...TEXT.small,
    color: "#6b7a8a",
    fontFamily: FONT.semi,
    marginBottom: 8,
  },
  missionFileRow: {
    minHeight: 44,
    borderRadius: 14,
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
  },
  missionFileMeta: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  missionFileName: {
    ...TEXT.body,
    color: "#1b2b3a",
    fontFamily: FONT.semi,
  },
  missionFileType: {
    marginTop: 2,
    ...TEXT.small,
    color: "#6b7a8a",
    fontFamily: FONT.regular,
  },
  priorityHigh: { backgroundColor: "#fee2e2" },
  priorityMedium: { backgroundColor: "#fff0d9" },
  priorityLow: { backgroundColor: "#dcfce7" },

  muted: { ...TEXT.small, color: "#6b7a8a", marginTop: 8, fontFamily: FONT.regular },
  djiCloudChipRow: {
    marginTop: 12,
    flexDirection: "row",
    flexWrap: "wrap",
  },
  djiRequirementBox: {
    marginTop: 12,
    backgroundColor: "#f8fbfd",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },

  loadingBox: {
    backgroundColor: "white",
    borderRadius: 22,
    padding: 16,
    borderWidth: 0,
    alignItems: "center",
    marginTop: 12,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  emptyCard: {
    backgroundColor: "white",
    borderRadius: 22,
    padding: 16,
    borderWidth: 0,
    alignItems: "center",
    marginTop: 12,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "flex-end" },
  equipoFormKeyboard: {
    width: "100%",
    maxHeight: "94%",
  },
  equipoFormSheet: {
    width: "100%",
    maxHeight: "92%",
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
    shadowColor: "#000000",
    shadowOpacity: 0.16,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: -5 },
    elevation: 12,
  },
  equipoFormTitleRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingRight: 10,
  },
  equipoFormHeaderIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    marginRight: 11,
    backgroundColor: "#f1f3f4",
    alignItems: "center",
    justifyContent: "center",
  },
  hoursControlBlock: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#e4e9ed",
  },
  hoursCurrent: {
    color: "#1b2b3a",
    fontSize: 12,
    fontFamily: FONT.semi,
  },
  hoursSeries: {
    color: "#7a668e",
    fontSize: 11,
    fontFamily: FONT.regular,
  },
  hoursStrong: {
    color: "#111918",
    fontFamily: FONT.bold,
  },
  hoursMetricValue: {
    marginTop: 2,
    color: "#17213a",
    fontSize: 17,
    fontFamily: FONT.bold,
  },
  hoursInputsRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginTop: 11,
  },
  hoursInputColumn: {
    flex: 1,
  },
  uasOperationalDetails: {
    marginTop: 12,
    paddingTop: 11,
    borderTopWidth: 1,
    borderTopColor: "#e4e9ed",
  },
  uasValidityText: {
    marginTop: 8,
    color: "#7a668e",
    fontSize: 10.5,
    fontFamily: FONT.regular,
  },
  uasActionStack: {
    marginTop: 8,
  },
  uasWideAction: {
    minHeight: 38,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    marginBottom: 7,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#d7e2ed",
    backgroundColor: "#ffffff",
  },
  uasWideActionText: {
    marginLeft: 7,
    color: "#102a43",
    fontSize: 11,
    fontFamily: FONT.bold,
  },
  hoursStatusBadge: {
    maxWidth: "55%",
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
  },
  hoursStatusText: {
    fontSize: 9.5,
    fontFamily: FONT.bold,
  },
  hoursProgressTrack: {
    height: 7,
    marginTop: 11,
    borderRadius: 999,
    backgroundColor: "#e5e9ed",
    overflow: "hidden",
  },
  hoursProgressFill: {
    height: "100%",
    borderRadius: 999,
  },
  hoursProgressCaption: {
    marginTop: 4,
    color: "#718096",
    fontSize: 9.5,
    textAlign: "right",
    fontFamily: FONT.regular,
  },
modalCard: {
  backgroundColor: "white",
  borderRadius: 24,
  padding: 16,
  width: "100%",          // ✅ ocupa bien
  maxWidth: 500,
  maxHeight: "85%",       // ✅ evita corte
},
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderColor: "#e3ebf5",
  },
  modalTitle: { ...TEXT.h2, color: "#111918", fontFamily: FONT.semi },
  modalH: { marginTop: 12, ...TEXT.h3, color: "#1b2b3a", fontFamily: FONT.semi },

  detailLine: { marginTop: 8, ...TEXT.body, color: "#1b2b3a" },
  detailBody: { marginTop: 8, ...TEXT.body, color: "#1b2b3a" },

  chip: {
    backgroundColor: "#f3f4f6",
    borderWidth: 0,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
  },
  chipActive: { backgroundColor: "#f3f4f6", borderColor: "#e5e7eb" },
  chipText: { ...TEXT.small, color: "#667", fontFamily: FONT.semi },
  chipTextActive: { color: "#111918" },

  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 7,
    borderWidth: 0,
    backgroundColor: "white",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxOn: { backgroundColor: "#111918", borderColor: "#111918" },

  checkRow: {
    flexDirection: "row",
    backgroundColor: "#f5f5f5",
    borderWidth: 0,
    borderRadius: 18,
    padding: 12,
    marginTop: 10,
  },
  checkN: {
    width: 26,
    height: 26,
    borderRadius: 10,
    backgroundColor: "#f3f4f6",
    borderWidth: 0,
    textAlign: "center",
    textAlignVertical: "center",
    fontFamily: FONT.semi,
    color: "#111918",
    overflow: "hidden",
    marginRight: 10,
  },
  checkTitle: { ...TEXT.h3, color: "#1b2b3a", fontFamily: FONT.semi },
  checkDesc: { marginTop: 6, ...TEXT.small, color: "#6b7a8a", fontFamily: FONT.regular },

  checkLine: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    backgroundColor: "#f5f5f5",
    borderWidth: 0,
    borderRadius: 18,
    marginTop: 10,
  },
  checkLineText: { ...TEXT.body, color: "#1b2b3a", flex: 1 },

modalOverlayCenter: {
  flex: 1,
  backgroundColor: "rgba(0,0,0,0.45)",
  justifyContent: "center",
  alignItems: "center",
  paddingHorizontal: 16,  // ✅ evita que se pegue a los bordes
},



sheetOverlay: {
  flex: 1,
  backgroundColor: "rgba(0,0,0,0.35)",
  justifyContent: "flex-end",
  paddingTop: 96,
  paddingBottom: 18,
},

sheetCard: {
  backgroundColor: "white",
  borderTopLeftRadius: 24,
  borderTopRightRadius: 24,
  padding: 16,
  paddingBottom: 24,
  width: "100%",
  maxHeight: "76%",
},

equipoItem: {
  backgroundColor: "#f5f5f5",
  borderWidth: 0,
  borderRadius: 16,
  padding: 12,
  marginBottom: 10,
},

equipoItemActive: {
  backgroundColor: "#f3f4f6",
  borderColor: "#e5e7eb",
},

equipoTitle: { ...TEXT.h3, color: "#1b2b3a", fontFamily: FONT.semi },
equipoMeta: { marginTop: 6, ...TEXT.small, color: "#6b7a8a", fontFamily: FONT.regular },

modalCardPro: {
  width: "100%",          // ✅ ocupa todo el contenedor interno
  maxWidth: 520,          // ✅ nunca queda gigante en tablets
  maxHeight: "78%",       // ✅ no se corta

  backgroundColor: "white",
  borderRadius: 24,
  padding: 16,
  borderWidth: 0,

  shadowColor: "#000",
  shadowOpacity: 0.18,
  shadowRadius: 18,
  shadowOffset: { width: 0, height: 10 },
  elevation: 8,
},

fratSummaryCard: {
  borderRadius: 18,
  borderWidth: 1,
  borderColor: "#e5edf6",
  backgroundColor: "#f8fbff",
  padding: 12,
},
fratSummaryHeader: {
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
},
fratSummaryTitle: {
  color: "#1b2b3a",
  fontFamily: FONT.semi,
  fontSize: 14,
},
fratSummaryPill: {
  borderRadius: 999,
  paddingHorizontal: 10,
  paddingVertical: 6,
},
fratSummaryPillText: {
  fontFamily: FONT.bold,
  fontSize: 11,
},
fratSummaryMeta: {
  marginTop: 6,
  color: "#5f6f82",
  fontFamily: FONT.regular,
  fontSize: 12,
},
fratScoreStrip: {
  marginTop: 14,
  flexDirection: "row",
  gap: 10,
},
fratScoreCard: {
  flex: 1,
  borderRadius: 18,
  borderWidth: 1,
  borderColor: "#e5edf6",
  backgroundColor: "#f8fbff",
  paddingHorizontal: 12,
  paddingVertical: 12,
},
fratScoreLabel: {
  color: "#6b7a8a",
  fontFamily: FONT.semi,
  fontSize: 11,
  textTransform: "uppercase",
},
fratScoreValue: {
  marginTop: 8,
  color: "#1b2b3a",
  fontFamily: FONT.bold,
  fontSize: 24,
},
fratGaugeCard: {
  marginTop: 12,
  borderRadius: 20,
  borderWidth: 1,
  borderColor: "#e5edf6",
  backgroundColor: "#ffffff",
  padding: 14,
},
fratGaugeTrack: {
  height: 18,
  borderRadius: 999,
  overflow: "hidden",
  position: "relative",
  backgroundColor: "#eef2f7",
},
fratGaugeGradient: {
  width: "100%",
  height: "100%",
},
fratGaugeMarker: {
  position: "absolute",
  top: -4,
  marginLeft: -8,
  width: 16,
  height: 26,
  borderRadius: 10,
  borderWidth: 3,
  backgroundColor: "#ffffff",
},
fratGaugeScale: {
  marginTop: 8,
  flexDirection: "row",
  justifyContent: "space-between",
},
fratGaugeScaleText: {
  color: "#7b8894",
  fontFamily: FONT.semi,
  fontSize: 11,
},
fratRiskPill: {
  alignSelf: "flex-start",
  marginTop: 12,
  borderRadius: 999,
  paddingHorizontal: 12,
  paddingVertical: 7,
},
fratRiskPillText: {
  fontFamily: FONT.bold,
  fontSize: 12,
},
fratHelperText: {
  marginTop: 10,
  color: "#5f6f82",
  fontFamily: FONT.regular,
  fontSize: 12,
  lineHeight: 18,
},
fratSectionCard: {
  marginBottom: 12,
  borderRadius: 20,
  borderWidth: 1,
  borderColor: "#e5edf6",
  backgroundColor: "#f8fbff",
  padding: 14,
},
fratSectionTitle: {
  color: "#1b2b3a",
  fontFamily: FONT.bold,
  fontSize: 15,
  marginBottom: 10,
},
fratQuestionBlock: {
  marginBottom: 12,
},
fratQuestionLabel: {
  color: "#1b2b3a",
  fontFamily: FONT.semi,
  fontSize: 13,
  lineHeight: 18,
  marginBottom: 8,
},
fratOptionsWrap: {
  gap: 8,
},
fratOption: {
  borderRadius: 16,
  borderWidth: 1,
  borderColor: "#dde6f0",
  backgroundColor: "#fdfefe",
  paddingHorizontal: 12,
  paddingVertical: 11,
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
},
fratOptionText: {
  flex: 1,
  color: "#415163",
  fontFamily: FONT.regular,
  fontSize: 13,
  lineHeight: 18,
},
fratOptionScore: {
  color: "#7b8894",
  fontFamily: FONT.bold,
  fontSize: 12,
},
fratObservationInput: {
  minHeight: 96,
  textAlignVertical: "top",
  paddingTop: 12,
},

modalWrap: {
  flex: 1,
  width: "100%",
  justifyContent: "flex-end",
  alignItems: "stretch",
},

  iconBtn: {
  width: 40,
  height: 40,
  borderRadius: 12,
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: "#f3f4f6",
  borderWidth: 0,
},

taskCard: {
  borderRadius: 20,
  padding: 14,
  backgroundColor: "white",
  borderWidth: 0,
  marginBottom: 12,
  shadowColor: "#000",
  shadowOpacity: 0.08,
  shadowRadius: 14,
  shadowOffset: { width: 0, height: 8 },
  elevation: 4,
},

taskHead: {
  flexDirection: "row",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 10,
  marginBottom: 10,
},

taskNum: {
  minWidth: 34,
  height: 28,
  borderRadius: 10,
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: "#f3f4f6",
  borderWidth: 0,
  paddingHorizontal: 8,
  marginTop: 2,
},

taskNumText: {
  fontSize: 12,
  color: "#111918",
  fontFamily: FONT.semi,
},

taskTitle: {
  fontSize: 14,
  color: "#1b2b3a",
  fontFamily: FONT.semi, // ✅ sin “negrilla fea”
  lineHeight: 18,
},

taskText: {
  marginTop: 4,
  fontSize: 12,
  color: "#6b7a8a",
  fontFamily: FONT.regular,
  lineHeight: 16,
},

selectWrap: {
  borderWidth: 0,
  borderRadius: 14,
  overflow: "hidden",
  backgroundColor: "#f5f5f5",
},
picker: {
  height: 52,
  color: "#111827",
},
helpText: {
  marginTop: 8,
  color: "#64748b",
  fontSize: 12,
},


selectInput: {
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  paddingVertical: 0, // el picker controla alto
},

pickerInput: {
  flex: 1,
  height: 52,
  color: "#111827",
  backgroundColor: "transparent",
},

  alfabotFab: {
    position: "absolute",
    right: 20,
    bottom: 150,
    zIndex: 1200,
    width: 70,
    height: 70,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  panicFab: {
    position: "absolute",
    left: 0,
    top: 0,
    zIndex: 1201,
    width: 58,
    height: 58,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#7f1d1d",
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  panicFabInner: {
    width: 58,
    height: 58,
    borderRadius: 999,
    backgroundColor: "#dc2626",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.7)",
  },
  panicFabDisabled: {
    opacity: 0.7,
  },
  alfabotFabWave: {
    position: "absolute",
    inset: 8,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: "rgba(59,130,246,0.55)",
  },
  alfabotFabImg: {
    width: 54,
    height: 54,
    borderRadius: 999,
    resizeMode: "cover",
    shadowColor: "#1e40af",
    shadowOpacity: 0.28,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  alfabotModalWrap: {
    flex: 1,
  },
  alfabotBackdrop: {
    position: "absolute",
    inset: 0,
    backgroundColor: "rgba(2,8,23,0.35)",
  },
  alfabotCardWrap: {
    flex: 1,
    alignItems: "flex-end",
    justifyContent: "flex-end",
    padding: 12,
  },
  alfabotCard: {
    width: 360,
    maxWidth: "94%",
    height: 520,
    maxHeight: "85%",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 14,
    overflow: "hidden",
    shadowColor: "#020817",
    shadowOpacity: 0.2,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 10,
  },
  alfabotCardKeyboard: {
    height: 420,
    maxHeight: "62%",
  },
  alfabotHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  alfabotHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  alfabotAvatar: {
    width: 38,
    height: 38,
    borderRadius: 999,
    resizeMode: "cover",
  },
  alfabotTitle: {
    fontSize: 16,
    color: "#0f172a",
    fontFamily: FONT.semi,
  },
  alfabotSubtitle: {
    marginTop: 1,
    fontSize: 12,
    color: "#475569",
    fontFamily: FONT.regular,
  },
  alfabotClose: {
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  alfabotCloseText: {
    fontSize: 22,
    color: "#0f172a",
    fontFamily: FONT.regular,
    lineHeight: 22,
  },
  alfabotBody: {
    flex: 1,
    backgroundColor: "#f8fbff",
    padding: 12,
  },
  alfabotBodyContent: {
    paddingBottom: 16,
  },
  alfabotMsg: {
    alignSelf: "flex-start",
    maxWidth: "90%",
    paddingVertical: 9,
    paddingHorizontal: 11,
    borderRadius: 10,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    marginBottom: 8,
  },
  alfabotMsgUser: {
    alignSelf: "flex-end",
    backgroundColor: "#111918",
    borderColor: "#111918",
  },
  alfabotMsgText: {
    fontSize: 13,
    color: "#0f172a",
    fontFamily: FONT.regular,
  },
  alfabotMsgTextUser: {
    color: "#ffffff",
    fontFamily: FONT.regular,
  },
  alfabotForm: {
    flexDirection: "row",
    gap: 8,
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
  },
  alfabotInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
    fontSize: 13,
    color: "#1b2b3a",
    fontFamily: FONT.regular,
  },
  alfabotSend: {
    backgroundColor: "#111918",
    borderRadius: 10,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  alfabotSendDisabled: {
    opacity: 0.55,
  },
  alfabotSendText: {
    color: "#ffffff",
    fontFamily: FONT.semi,
    fontSize: 13,
  },
  alfabotNote: {
    paddingHorizontal: 12,
    paddingBottom: 10,
    color: "#64748b",
    fontSize: 11,
    fontFamily: FONT.regular,
  },


});
function normalizePath(path: string) {
  const p = path.startsWith("/") ? path : `/${path}`;
  return p.startsWith("/api/") ? p : `/api${p}`;
}

async function handleResponse<T>(res: Response): Promise<T> {
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  if (!res.ok) {
    const msg = data?.message || data?.error || `Error ${res.status}`;
    throw new Error(msg);
  }

  return data as T;
}

