"use client";

import { useEffect, useRef, useState } from "react";

import { cancelSpeech, primeVoices, speak } from "@/lib/speech";

/**
 * Speech state lifted out of the caption, because the caption sits on the video
 * and its controls sit below it — they need to share one source of truth.
 */
export function useSpeech(message: string) {
  const [speaking, setSpeaking] = useState(false);
  const [spokenWord, setSpokenWord] = useState(-1);

  const spokenFor = useRef("");

  useEffect(() => {
    primeVoices();
    return () => cancelSpeech();
  }, []);

  function read() {
    if (!message.trim()) return;

    setSpeaking(true);
    setSpokenWord(-1);

    speak(message, {
      onWord: setSpokenWord,
      onEnd: () => {
        setSpeaking(false);
        setSpokenWord(-1);
      },
    });
  }

  function stop() {
    cancelSpeech();
    setSpeaking(false);
    setSpokenWord(-1);
  }

  function reset() {
    spokenFor.current = "";
    stop();
  }

  // Speak automatically the first time a sentence resolves. The capture button
  // was the user gesture, so autoplay policy is already satisfied.
  useEffect(() => {
    if (!message.trim() || spokenFor.current === message) return;

    spokenFor.current = message;
    read();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [message]);

  return { speaking, spokenWord, read, stop, reset };
}
