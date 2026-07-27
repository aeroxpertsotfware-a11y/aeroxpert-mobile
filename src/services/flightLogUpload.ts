import { apiUploadForm } from "./api";

export type UploadableFlightLogFile = {
  id: string;
  uri: string;
  name: string;
  mimeType?: string;
  size: number;
  ext?: string;
};

export type FlightLogUploadResult = {
  id: string;
  name: string;
  ok: boolean;
  message: string;
  serverFlightLogId?: string;
  summary?: Record<string, any> | null;
  telemetry?: Record<string, any> | null;
};

export const MAX_FLIGHT_LOG_SIZE_BYTES = 50 * 1024 * 1024;

export async function uploadFlightLogsOnline(
  files: UploadableFlightLogFile[],
  missionId?: string
): Promise<FlightLogUploadResult[]> {
  const results: FlightLogUploadResult[] = [];

  for (const file of files) {
    if (file.size > MAX_FLIGHT_LOG_SIZE_BYTES) {
      results.push({
        id: file.id,
        name: file.name,
        ok: false,
        message: "Supera el tamano maximo de 50 MB.",
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
    form.append("ext", file.ext || "");
    form.append("size", String(file.size || 0));
    form.append("source", "mobile");
    form.append("deviceTime", new Date().toISOString());
    if (missionId) {
      form.append("missionId", missionId);
    }

    try {
      const response: any = await apiUploadForm("/api/flight-logs/upload", form, { timeoutMs: 30000 });
      results.push({
        id: file.id,
        name: file.name,
        ok: true,
        message: "Subido correctamente.",
        serverFlightLogId: response?.data?._id ? String(response.data._id) : undefined,
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
