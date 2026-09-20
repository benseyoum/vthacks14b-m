"use client";

import { useEffect, useRef, useState } from "react";

import { cancelSpeech, primeVoices, speak } from "@/lib/speech";

type Alignment = {
  characters: string[];
  character_start_times_seconds: number[];
  character_end_times_seconds: number[];
};

type SpeechApiResponse = {
  audioBase64?: string;
  alignment?: Alignment | null;
  engine?: string;
};

function wordIndexForCharacter(text: string, characterIndex: number) {
  const prefix = text.slice(0, Math.max(0, characterIndex));
  const words = prefix.trim().split(/\s+/).filter(Boolean);
  return Math.max(0, words.length - 1);
}

function base64ToArrayBuffer(base64: string) {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes.buffer;
}

export function useSpeech(message: string) {
  const [speaking, setSpeaking] = useState(false);
  const [spokenWord, setSpokenWord] = useState(-1);
  const [speechEngine, setSpeechEngine] = useState<"elevenlabs" | "browser">(
    "browser"
  );

  const spokenFor = useRef("");
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const timersRef = useRef<number[]>([]);

  useEffect(() => {
    primeVoices();

    return () => {
      timersRef.current.forEach((timer) => window.clearTimeout(timer));
      timersRef.current = [];

      try {
        sourceRef.current?.stop();
      } catch {
        // Source may already have ended.
      }

      sourceRef.current = null;
      void audioContextRef.current?.close();
      audioContextRef.current = null;
      cancelSpeech();
    };
  }, []);

  function clearTimers() {
    timersRef.current.forEach((timer) => window.clearTimeout(timer));
    timersRef.current = [];
  }

  function finish() {
    clearTimers();
    sourceRef.current = null;
    setSpeaking(false);
    setSpokenWord(-1);
  }

  function readWithBrowser() {
    setSpeechEngine("browser");
    setSpeaking(true);
    setSpokenWord(-1);

    speak(message, {
      onWord: setSpokenWord,
      onEnd: finish,
    });
  }

  async function getAudioContext() {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
    }

    if (audioContextRef.current.state === "suspended") {
      await audioContextRef.current.resume();
    }

    return audioContextRef.current;
  }

  // Call this directly from the user's Capture/Say button gesture. Chrome can
  // otherwise leave Web Audio suspended by the time Gemini and ElevenLabs have
  // finished their async requests. Once this shared context is unlocked here,
  // the later automatic ElevenLabs playback can use it normally.
  async function prime() {
    try {
      const audioContext = await getAudioContext();
      const buffer = audioContext.createBuffer(1, 1, audioContext.sampleRate);
      const source = audioContext.createBufferSource();
      source.buffer = buffer;
      source.connect(audioContext.destination);
      source.start(0);
    } catch (error) {
      console.warn("Could not prime browser audio.", error);
    }
  }

  async function read() {
    if (!message.trim()) return;

    stop();
    setSpeaking(true);
    setSpokenWord(-1);

    try {
      // If read() comes from the Say button, this resumes Web Audio while the
      // user gesture is still active. Automatic playback uses the same context
      // previously unlocked by prime() when Capture was pressed.
      const audioContext = await getAudioContext();

      const response = await fetch("/api/speech", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text: message }),
      });

      if (!response.ok) {
        throw new Error("ElevenLabs unavailable");
      }

      const data = (await response.json()) as SpeechApiResponse;

      if (!data.audioBase64) {
        throw new Error("ElevenLabs returned no audio");
      }

      const audioBuffer = await audioContext.decodeAudioData(
        base64ToArrayBuffer(data.audioBase64)
      );
      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContext.destination);
      sourceRef.current = source;
      setSpeechEngine("elevenlabs");

      if (data.alignment) {
        const { characters, character_start_times_seconds } = data.alignment;

        characters.forEach((character, index) => {
          if (!character.trim()) return;

          const previous = index > 0 ? characters[index - 1] : " ";
          const startsWord = index === 0 || /\s/.test(previous);
          if (!startsWord) return;

          const timer = window.setTimeout(() => {
            setSpokenWord(wordIndexForCharacter(message, index));
          }, Math.round(character_start_times_seconds[index] * 1000));

          timersRef.current.push(timer);
        });
      }

      source.onended = finish;
      source.start(0);
    } catch (error) {
      console.warn("ElevenLabs browser playback failed; using device voice.", error);
      finish();
      readWithBrowser();
    }
  }

  function stop() {
    clearTimers();

    if (sourceRef.current) {
      sourceRef.current.onended = null;

      try {
        sourceRef.current.stop();
      } catch {
        // Source may already have ended.
      }

      sourceRef.current.disconnect();
      sourceRef.current = null;
    }

    cancelSpeech();
    setSpeaking(false);
    setSpokenWord(-1);
  }

  function reset() {
    spokenFor.current = "";
    stop();
  }

  useEffect(() => {
    if (!message.trim() || spokenFor.current === message) return;

    spokenFor.current = message;
    read();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [message]);

  return {
    speaking,
    spokenWord,
    speechEngine,
    prime,
    read,
    stop,
    reset,
  };
}
