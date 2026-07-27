import React, { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { DJITelemetry, DJITelemetryPayload, DJIStatusPayload } from "../native/djiTelemetry";

export function DJITelemetryExample() {
  const [telemetry, setTelemetry] = useState<DJITelemetryPayload | null>(null);
  const [status, setStatus] = useState<DJIStatusPayload | null>(null);

  useEffect(() => {
    const telemetrySub = DJITelemetry.onTelemetry(setTelemetry);
    const statusSub = DJITelemetry.onStatus(setStatus);

    DJITelemetry.start().catch((error) => {
      setStatus({ status: "start_failed", message: String(error?.message || error) });
    });

    return () => {
      telemetrySub.remove();
      statusSub.remove();
      DJITelemetry.stop().catch(() => undefined);
    };
  }, []);

  return (
    <View>
      <Text>DJI status: {status?.status || "sin estado"}</Text>
      <Text>GPS: {telemetry?.lat ?? "--"}, {telemetry?.lng ?? "--"}</Text>
      <Text>Altitud: {telemetry?.altitude ?? "--"} m</Text>
      <Text>Bateria: {telemetry?.batteryPercent ?? "--"}%</Text>
      <Text>Velocidad: {telemetry?.speed ?? "--"} m/s</Text>
    </View>
  );
}
