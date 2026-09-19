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

export function useSpeech(message: string) {
  const [speaking, setSpeaking] = useState(false);
  const [spokenWord, setSpokenWord] = useState(-1);
  const [speechEngine, setSpeechEngine] = useState<"elevenlabs" | "browser">(
    "browser"
  );

  const spokenFor = useRef("");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timersRef = useRef<number[]>([]);

  useEffect(() => {
    primeVoices();
    return () => {
      timersRef.current.forEach((timer) => window.clearTimeout(timer));
      timersRef.current = [];
      audioRef.current?.pause();
      audioRef.current = null;
      cancelSpeech();
    };
  }, []);

  function clearTimers() {
    timersRef.current.forEach((timer) => window.clearTimeout(timer));
    timersRef.current = [];
  }

  function finish() {
    clearTimers();
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

  async function read() {
    if (!message.trim()) return;

    stop();
    setSpeaking(true);
    setSpokenWord(-1);

    try {
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

      const audio = new Audio(`data:audio/mpeg;base64,${data.audioBase64}`);
      audioRef.current = audio;
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

      audio.onended = finish;
      audio.onerror = () => {
        finish();
        readWithBrowser();
      };

      await audio.play();
    } catch {
      finish();
      readWithBrowser();
    }
  }

  function stop() {
    clearTimers();
    audioRef.current?.pause();
    audioRef.current = null;
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
    read,
    stop,
    reset,
  };
}
