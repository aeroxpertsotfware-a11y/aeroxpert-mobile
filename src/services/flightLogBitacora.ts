import { apiFetch } from "./api";

export type FlightLogBitacoraPrefillLog = {
  id: string;
  name: string;
  parseStatus: string;
  startTime: string | null;
  endTime: string | null;
  durationMin: number;
  maxAltitudeM: number | null;
  maxSatellites: number | null;
  missionId: string | null;
  missionTitle: string;
  coords: string;
};

export type FlightLogBitacoraPrefill = {
  source: "flight-logs";
  flightLogIds: string[];
  missionId: string | null;
  missionTitle: string;
  fechaHora: string | null;
  horaInicio: string;
  horaFin: string;
  duracionMin: number | null;
  tiempoTotalVueloMin: number | null;
  distanciaTotalM: number | null;
  velocidadPromedioMps: number | null;
  velocidadMaximaMps: number | null;
  fotografiasCapturadas: number;
  numeroDespegues: number | null;
  numeroAterrizajes: number | null;
  altitudMaxAlcanzada: number | null;
  temperatura: number | null;
  maxSatellites: number | null;
  coordenadasOperacion: string;
  ubicacion: string;
  lugarOperacion: string;
  uas: string;
  bateriasUtilizadas: string;
  bateriasDetalle: Array<{
    serial: string;
    duracionMin: number;
    logs: number;
    cicloReportado: number | null;
  }>;
  rutaConsolidada: Array<{
    lat: number;
    lon: number;
    alt: number | null;
    t: number | null;
    logId: string | null;
  }>;
  logsValidos: number;
  logsRechazados: number;
  notas: string;
};

export type FlightLogBitacoraPrefillResponse = {
  totalLogs: number;
  logs: FlightLogBitacoraPrefillLog[];
  prefill: FlightLogBitacoraPrefill | null;
};

export async function getFlightLogBitacoraPrefill(
  flightLogIds: string[]
): Promise<FlightLogBitacoraPrefillResponse> {
  return apiFetch("/api/flight-logs/prefill-bitacora", {
    method: "POST",
    body: JSON.stringify({ flightLogIds }),
  });
}
