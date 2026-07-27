import { useEffect, useRef, useState } from "react";
import * as Speech from "expo-speech";
import Voice, { SpeechResultsEvent } from "@react-native-voice/voice";

export type Mode = "IDLE" | "SPEAKING" | "LISTENING";

function normalizeYN(raw: string): "yes" | "no" | null {
  const t = raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

  // sí
  if (
    ["si", "sí", "s", "claro", "afirmativo", "correcto", "vale", "ok", "okay", "de acuerdo"].includes(t)
  )
    return "yes";

  // no
  if (["no", "n", "negativo", "cancelar", "rechazo"].includes(t)) return "no";

  return null;
}

export function useVoiceFlow() {
  const [mode, setMode] = useState<Mode>("IDLE");
  const modeRef = useRef<Mode>("IDLE");
  const inTransitionRef = useRef(false);

  const [heard, setHeard] = useState("");
  const lastSpokenRef = useRef<string>("");

  const setModeSafe = (m: Mode) => {
    modeRef.current = m;
    setMode(m);
  };

  const stopAll = async () => {
    try {
      Speech.stop();
    } catch {}
    try {
      await Voice.stop();
    } catch {}
    try {
      await Voice.cancel();
    } catch {}
  };

  const speakOnce = (text: string, onDone?: () => void) => {
    // evita repetir la misma frase por eventos duplicados
    if (lastSpokenRef.current === text && modeRef.current === "SPEAKING") return;

    lastSpokenRef.current = text;
    setModeSafe("SPEAKING");

    try {
      Speech.stop();
    } catch {}

    Speech.speak(text, {
      language: "es-CO",
      rate: 0.95,
      onDone: () => onDone?.(),
      onStopped: () => {},
      onError: () => {},
    });
  };

  const startListeningSafe = async () => {
    if (inTransitionRef.current) return;
    if (modeRef.current === "LISTENING") return;

    inTransitionRef.current = true;
    try {
      setHeard("");
      try {
        await Voice.cancel();
      } catch {}
      try {
        await Voice.stop();
      } catch {}

      setModeSafe("LISTENING");
      await Voice.start("es-CO");
    } finally {
      inTransitionRef.current = false;
    }
  };

  const stopListeningSafe = async () => {
    if (inTransitionRef.current) return;

    inTransitionRef.current = true;
    try {
      try {
        await Voice.stop();
      } catch {}
      setModeSafe("IDLE");
    } finally {
      inTransitionRef.current = false;
    }
  };

  useEffect(() => {
    // listeners SOLO 1 VEZ
    Voice.onSpeechResults = (e: SpeechResultsEvent) => {
      const text = (e.value?.[0] ?? "").trim();
      if (!text) return;

      setHeard(text);

      // procesar solo si estamos escuchando
      if (modeRef.current !== "LISTENING") return;

      const yn = normalizeYN(text);
      if (!yn) return;

      // IMPORTANTÍSIMO: parar antes de hablar o cambiar estado
      stopListeningSafe().then(() => {
        // aquí se "emite" la respuesta (la conectas desde el componente)
        // ejemplo: onYesNoRef.current?.(yn === "yes")
      });
    };

    Voice.onSpeechError = () => {
      // NO reiniciar en bucle
      setModeSafe("IDLE");
    };

    return () => {
      try {
        Voice.destroy().then(Voice.removeAllListeners);
      } catch {}
    };
  }, []);

  return {
    mode,
    heard,
    speakOnce,
    startListeningSafe,
    stopListeningSafe,
    stopAll,
    setModeSafe,
    modeRef,
  };
}
