/**
 * Browser speech synthesis.
 *
 * This is the half of SignalBridge that actually reaches the room: the
 * interpreted sentence is printed AND spoken, so the person gesturing does not
 * have to hand someone a screen to be understood.
 */

export type SpeechHandle = {
  cancel: () => void;
};

type SpeakOptions = {
  /** Fired with the index of the word currently being spoken. */
  onWord?: (index: number) => void;
  onEnd?: () => void;
};

const NOOP_HANDLE: SpeechHandle = { cancel: () => {} };

let cachedVoices: SpeechSynthesisVoice[] = [];

export function isSpeechSupported() {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

/**
 * Voices load asynchronously in Chrome. Call this early (on mount) so the first
 * spoken sentence does not fall back to the robotic default.
 */
export function primeVoices() {
  if (!isSpeechSupported()) return;

  const load = () => {
    cachedVoices = window.speechSynthesis.getVoices();
  };

  load();
  window.speechSynthesis.addEventListener("voiceschanged", load);
}

function pickVoice() {
  const voices = cachedVoices.length
    ? cachedVoices
    : isSpeechSupported()
      ? window.speechSynthesis.getVoices()
      : [];

  if (voices.length === 0) return null;

  const english = voices.filter((voice) => voice.lang.startsWith("en"));
  const pool = english.length > 0 ? english : voices;

  // Prefer the higher-quality synthesised voices where the platform has them.
  const preferred = pool.find((voice) =>
    /natural|neural|enhanced|premium|google/i.test(voice.name)
  );

  return preferred ?? pool.find((voice) => voice.localService) ?? pool[0];
}

/** Character offset of every word, so onboundary can be mapped to a word index. */
function wordStarts(text: string) {
  const starts: number[] = [];
  const pattern = /\S+/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    starts.push(match.index);
  }

  return starts;
}

export function speak(
  text: string,
  { onWord, onEnd }: SpeakOptions = {}
): SpeechHandle {
  if (!isSpeechSupported() || !text.trim()) {
    onEnd?.();
    return NOOP_HANDLE;
  }

  const synth = window.speechSynthesis;

  // Never stack utterances — a second reading over the first is unusable.
  synth.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  const voice = pickVoice();

  if (voice) utterance.voice = voice;

  // Slightly under natural pace: this sentence is being read by a stranger.
  utterance.rate = 0.95;
  utterance.pitch = 1;

  const starts = wordStarts(text);

  utterance.onboundary = (event) => {
    if (event.name && event.name !== "word") return;

    let index = 0;

    for (let i = 0; i < starts.length; i++) {
      if (starts[i] <= event.charIndex) index = i;
    }

    onWord?.(index);
  };

  utterance.onend = () => onEnd?.();
  utterance.onerror = () => onEnd?.();

  synth.speak(utterance);

  return {
    cancel: () => synth.cancel(),
  };
}

export function cancelSpeech() {
  if (!isSpeechSupported()) return;
  window.speechSynthesis.cancel();
}

/**
 * Fire-and-forget reading, kept for callers that only need the sentence spoken
 * and do not track word boundaries.
 */
export function speakMessage(message: string) {
  speak(message);
}
