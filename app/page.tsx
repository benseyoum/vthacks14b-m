"use client";

import { useState } from "react";

import CameraCapture from "@/components/CameraCapture";
import { speakMessage } from "@/lib/speech";

import type {
  ClarificationOption,
  SignalInterpretation,
} from "@/types/signalbridge";

function Field({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
        {label}
      </p>

      <p className="mt-2 text-lg">
        {value || (
          <span className="text-zinc-600">Not relevant</span>
        )}
      </p>
    </div>
  );
}

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] =
    useState<SignalInterpretation | null>(null);
  const [error, setError] = useState("");

  async function interpret(frames: string[]) {
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const response = await fetch("/api/interpret", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ frames }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Interpretation failed."
        );
      }

      const interpretation =
        data.interpretation as SignalInterpretation;

      setResult(interpretation);

      if (
        !interpretation.needsClarification &&
        interpretation.finalMessage
      ) {
        speakMessage(interpretation.finalMessage);
      }
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Something went wrong."
      );
    } finally {
      setLoading(false);
    }
  }

  function resolveClarification(option: ClarificationOption) {
    if (!result) return;

    const resolved: SignalInterpretation = {
      ...result,
      needsClarification: false,
      ambiguousField: "",
      clarificationQuestion: "",
      clarificationOptions: [],
      finalMessage: option.finalMessage,
    };

    setResult(resolved);
    speakMessage(option.finalMessage);
  }

  return (
    <main className="min-h-screen bg-[#08090c] text-white">
      <div className="mx-auto max-w-7xl px-5 py-8 md:px-8 md:py-12">
        <header className="mb-10 border-b border-white/10 pb-8">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold uppercase tracking-[0.28em] text-cyan-400">
              SignalBridge
            </div>

            <div className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-sm text-emerald-300">
              ● Ready
            </div>
          </div>

          <h1 className="mt-6 max-w-4xl text-5xl font-semibold tracking-tight md:text-7xl">
            Turn intent into words.
          </h1>

          <p className="mt-5 max-w-2xl text-lg leading-8 text-zinc-400">
            When you know what you want to say,
            but you can&apos;t get the words out.
          </p>
        </header>

        <div className="grid gap-8 lg:grid-cols-[1.08fr_.92fr]">
          <section>
            <CameraCapture
              loading={loading}
              onCapture={interpret}
            />
          </section>

          <section className="min-h-[520px] rounded-3xl border border-white/10 bg-[#101116] p-6 md:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.23em] text-zinc-500">
              What I understand
            </p>

            <h2 className="mt-2 text-2xl font-semibold">
              Intent interpretation
            </h2>

            {!result && !loading && !error && (
              <div className="mt-8 flex min-h-[390px] items-center justify-center rounded-2xl border border-dashed border-white/10 p-8 text-center leading-7 text-zinc-500">
                <p>
                  Communicate using gestures,
                  objects, and context.
                  <br />
                  <br />
                  SignalBridge will build the
                  meaning here.
                </p>
              </div>
            )}

            {loading && (
              <div className="flex min-h-[390px] items-center justify-center text-center">
                <div>
                  <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-zinc-700 border-t-cyan-400" />

                  <p className="mt-5 text-lg font-medium">
                    Understanding the message...
                  </p>

                  <p className="mt-2 text-sm text-zinc-500">
                    Reading the gesture as one sequence.
                  </p>
                </div>
              </div>
            )}

            {error && (
              <div className="mt-8 rounded-2xl border border-red-400/20 bg-red-400/10 p-5 text-red-200">
                {error}
              </div>
            )}

            {result && (
              <div className="mt-7 space-y-5">
                <div className="grid grid-cols-2 gap-3">
                  <Field
                    label="Person"
                    value={result.actor}
                  />

                  <Field
                    label="Intent"
                    value={result.intent}
                  />

                  <Field
                    label="Action"
                    value={result.action}
                  />

                  <Field
                    label="Location"
                    value={result.location}
                  />
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
                    Referenced objects
                  </p>

                  <div className="mt-3 space-y-3">
                    {result.objectCandidates.length === 0 && (
                      <p className="text-zinc-600">
                        No referenced object identified
                      </p>
                    )}

                    {result.objectCandidates.map(
                      (candidate, index) => (
                        <div
                          key={`${candidate.value}-${index}`}
                          className="flex items-center justify-between"
                        >
                          <span>{candidate.value}</span>

                          <span className="text-sm text-zinc-500">
                            {Math.round(
                              candidate.confidence * 100
                            )}
                            %
                          </span>
                        </div>
                      )
                    )}
                  </div>
                </div>

                {result.needsClarification ? (
                  <div className="rounded-2xl border border-amber-300/20 bg-amber-300/10 p-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">
                      Clarification needed
                    </p>

                    <p className="mt-3 text-xl font-medium">
                      {result.clarificationQuestion}
                    </p>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {result.clarificationOptions.map(
                        (option) => (
                          <button
                            key={`${option.label}-${option.finalMessage}`}
                            type="button"
                            onClick={() =>
                              resolveClarification(option)
                            }
                            className="rounded-xl border border-amber-200/25 bg-black/20 px-4 py-2 text-left transition hover:border-amber-200/50 hover:bg-amber-200/10 focus:outline-none focus:ring-2 focus:ring-amber-300/60"
                          >
                            {option.label}
                          </button>
                        )
                      )}
                    </div>
                  </div>
                ) : result.finalMessage ? (
                  <div className="rounded-2xl border border-cyan-300/20 bg-cyan-300/10 p-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">
                      Message
                    </p>

                    <p className="mt-3 text-2xl font-semibold leading-snug">
                      “{result.finalMessage}”
                    </p>

                    <button
                      type="button"
                      onClick={() =>
                        speakMessage(result.finalMessage)
                      }
                      className="mt-4 rounded-xl border border-cyan-200/20 bg-black/20 px-4 py-2 text-sm font-medium text-cyan-100 transition hover:bg-cyan-200/10"
                    >
                      Speak again
                    </button>
                  </div>
                ) : null}

                {result.context.length > 0 && (
                  <p className="text-sm leading-6 text-zinc-500">
                    {result.context.join(" • ")}
                  </p>
                )}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
