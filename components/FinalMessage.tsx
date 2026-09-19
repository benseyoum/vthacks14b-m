"use client";

import { useMemo } from "react";

import { toCaptionLines } from "@/lib/intent";

type Props = {
  message: string;
  /** Index of the word currently being spoken, or -1. */
  spokenWord: number;
};

/**
 * The caption itself: two balanced lines, words resolving in rather than typing
 * out, and the spoken word held at full strength while the rest recede.
 */
export default function FinalMessage({ message, spokenWord }: Props) {
  const lines = useMemo(() => toCaptionLines(message), [message]);

  // Flatten to a running index so highlighting can cross the line break.
  const rows = useMemo(() => {
    let index = 0;

    return lines.map((line) =>
      line.split(/\s+/).map((word) => ({ word, index: index++ }))
    );
  }, [lines]);

  return (
    <p className="text-overlay text-white">
      {rows.map((row, rowIndex) => (
        <span key={rowIndex} className="block">
          {row.map(({ word, index }) => (
            <span
              key={`${word}-${index}`}
              className="word transition-opacity duration-200"
              style={
                {
                  "--word-index": index,
                  opacity: spokenWord >= 0 && index !== spokenWord ? 0.4 : 1,
                } as React.CSSProperties
              }
            >
              {word}
              {index === row[row.length - 1].index ? "" : " "}
            </span>
          ))}
        </span>
      ))}
    </p>
  );
}
