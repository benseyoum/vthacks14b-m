"use client";

import { useEffect, useRef } from "react";

import SignalTrace from "@/components/SignalTrace";

export type Utterance = {
  id: number;
  text: string;
  at: string;
};

type Props = {
  lines: Utterance[];
  speaking: boolean;
  canSpeak: boolean;
  speechEngine: "elevenlabs" | "browser";
  onRead: () => void;
  onStop: () => void;
  onClear: () => void;
};

/**
 * Everything said so far, oldest first — so a demo reads as a conversation
 * rather than a series of disconnected one-shot guesses.
 */
export default function Transcript({
  lines,
  speaking,
  canSpeak,
  speechEngine,
  onRead,
  onStop,
  onClear,
}: Props) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [lines.length]);

  return (
    <div className="rounded-card bg-surface p-4 shadow-card md:p-5">
      <div className="flex flex-wrap items-center gap-2.5 px-1">
        <button
          type="button"
          onClick={speaking ? onStop : onRead}
          disabled={!canSpeak}
          className="h-12 rounded-full bg-panel px-6 text-body font-semibold text-white transition-transform duration-200 hover:scale-[1.02] active:scale-[0.99] disabled:pointer-events-none disabled:bg-surface-sunk disabled:text-text-soft"
        >
          {speaking ? "Stop" : "Speak this aloud"}
        </button>

        <button
          type="button"
          onClick={onRead}
          disabled={!canSpeak || speaking}
          className="h-12 rounded-full bg-surface-sunk px-6 text-body font-semibold text-text transition-colors duration-200 hover:bg-line disabled:pointer-events-none disabled:text-text-soft"
        >
          Say it again
        </button>

        <button
          type="button"
          onClick={onClear}
          disabled={lines.length === 0}
          className="h-12 rounded-full px-4 text-body font-medium text-text-soft transition-colors duration-200 hover:text-text disabled:pointer-events-none disabled:opacity-40"
        >
          Clear
        </button>

        <span className="rounded-full bg-surface-sunk px-3 py-1.5 font-mono text-[0.65rem] uppercase tracking-[0.12em] text-text-soft">
          Voice · {speechEngine === "elevenlabs" ? "ElevenLabs" : "device fallback"}
        </span>

        <SignalTrace className="ml-auto hidden h-6 w-32 sm:block" dark />
      </div>

      <div className="mt-4 rounded-well bg-surface-sunk/60 p-4">
        <p className="text-label font-medium text-text-soft">Transcript</p>

        {lines.length === 0 ? (
          <p className="mt-2 text-body text-text-soft">
            Nothing spoken yet. Captured sentences collect here.
          </p>
        ) : (
          <ol className="mt-2 max-h-44 space-y-2 overflow-y-auto pr-1">
            {lines.map((line) => (
              <li key={line.id} className="flex gap-3">
                <span className="mt-0.5 shrink-0 font-mono text-label text-text-soft tabular-nums">
                  {line.at}
                </span>
                <span className="text-body font-medium">{line.text}</span>
              </li>
            ))}
            <div ref={endRef} />
          </ol>
        )}
      </div>
    </div>
  );
}
