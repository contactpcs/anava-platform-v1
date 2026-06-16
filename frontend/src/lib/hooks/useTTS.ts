import { useState, useEffect, useCallback } from "react";

export interface UseTTSOptions {
  rate?: number;
  pitch?: number;
  volume?: number;
}

export function useTTS(options: UseTTSOptions = {}) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const { rate = 1, pitch = 1, volume = 1 } = options;

  useEffect(() => {
    setIsSupported(() => {
      const synth = window.speechSynthesis;
      return !!synth || !!(window as any).webkitSpeechSynthesis;
    });
  }, []);

  const speak = useCallback(
    (text: string) => {
      if (!isSupported) {
        console.warn("Text-to-speech is not supported in this browser");
        return;
      }

      // Cancel any ongoing speech
      const synth = window.speechSynthesis || (window as any).webkitSpeechSynthesis;
      synth.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = rate;
      utterance.pitch = pitch;
      utterance.volume = volume;

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);

      synth.speak(utterance);
    },
    [isSupported, rate, pitch, volume]
  );

  const stop = useCallback(() => {
    const synth = window.speechSynthesis || (window as any).webkitSpeechSynthesis;
    synth.cancel();
    setIsSpeaking(false);
  }, []);

  return {
    speak,
    stop,
    isSpeaking,
    isSupported,
  };
}
