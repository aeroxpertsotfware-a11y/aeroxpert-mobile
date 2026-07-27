// src/screens/PilotsScreen.tsx
import React from "react";
import PilotPanel from "./PilotPanel";

type Props = {
  token: string;
  onLogout: () => void;
};

export default function PilotsScreen({ token, onLogout }: Props) {
  // Aquí luego conectamos el token al backend dentro de PilotPanel
  return <PilotPanel onLogout={onLogout} initialUser={null} />;
}
