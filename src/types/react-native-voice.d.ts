declare module "@react-native-voice/voice" {
  export type SpeechResultsEvent = { value?: string[] };

  const Voice: {
    onSpeechResults?: (event: SpeechResultsEvent) => void;
    onSpeechError?: (event: unknown) => void;
    start(locale: string): Promise<void>;
    stop(): Promise<void>;
    cancel(): Promise<void>;
    destroy(): Promise<void>;
    removeAllListeners(): void;
  };

  export default Voice;
}
