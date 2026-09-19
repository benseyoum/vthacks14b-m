"use client";

import { rankCandidates } from "@/lib/intent";
import type { SignalInterpretation } from "@/types/signalbridge";

type Props = {
  result: SignalInterpretation | null;
};

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-4 border-t border-line py-2.5 first:border-t-0 first:pt-0">
      <dt className="w-20 shrink-0 text-label text-text-soft">{label}</dt>
      <dd className="text-body font-medium">{value || "—"}</dd>
    </div>
  );
}

/**
 * The evidence behind the sentence, deliberately kept beside and below the
 * caption. It answers "why did it say that?" without ever competing with the
 * message itself.
 */
export default function IntentPanel({ result }: Props) {
  const ranked = result ? rankCandidates(result.objectCandidates) : [];

  return (
    <div className="rounded-card bg-surface-sunk/70 p-4 md:p-5">
      <p className="px-1 pb-3 text-label font-medium">Structured reading</p>

      <div className="rounded-well bg-surface p-5 shadow-card">
        {!result ? (
          <>
            <p className="text-headline">Nothing read yet.</p>

            <p className="mt-2 text-body text-text-soft">
              Press Capture gesture, or the space bar. Six frames are taken over
              three seconds.
            </p>
          </>
        ) : (
          <div className="rise">
            <dl>
              <Row label="Person" value={result.actor} />
              <Row label="Intent" value={result.intent} />
              <Row label="Action" value={result.action} />
              <Row label="Place" value={result.location} />
            </dl>

            {ranked.length > 0 && (
              <div className="mt-5 border-t border-line pt-4">
                <p className="text-label text-text-soft">
                  Objects, most likely first
                </p>

                <ol className="mt-3 space-y-2.5">
                  {ranked.map((candidate, index) => (
                    <li key={`${candidate.value}-${index}`}>
                      <div className="flex items-baseline gap-2.5">
                        <span className="font-mono text-label text-text-soft">
                          {String(index + 1).padStart(2, "0")}
                        </span>

                        <span className="text-body font-medium">
                          {candidate.value}
                        </span>
                      </div>

                      {/* Relative weight only. The model's own instructions
                          call confidence a ranking signal, not a statistic. */}
                      <div className="mt-1.5 ml-7 h-1.5 overflow-hidden rounded-full bg-surface-sunk">
                        <div
                          className="h-full rounded-full bg-accent"
                          style={{
                            width: `${Math.max(8, candidate.confidence * 100)}%`,
                            opacity: index === 0 ? 1 : 0.4,
                          }}
                        />
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {result.context.length > 0 && (
              <ul className="mt-5 space-y-1.5 border-t border-line pt-4">
                {result.context.map((note, index) => (
                  <li key={index} className="text-body text-text-soft">
                    {note}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
