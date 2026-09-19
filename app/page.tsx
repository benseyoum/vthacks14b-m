"use client";

import { useEffect, useRef, useState } from "react";

import CameraCapture, { type FrameMeta } from "@/components/CameraCapture";
import CaptionOverlay from "@/components/CaptionOverlay";
import IntentPanel from "@/components/IntentPanel";
import Transcript, { type Utterance } from "@/components/Transcript";

import { DEMO_AMBIGUOUS, DEMO_CLEAR } from "@/lib/demo";
import { resolveWithChoice } from "@/lib/intent";
import { useSpeech } from "@/lib/useSpeech";
import type { SignalInterpretation } from "@/types/signalbridge";

const NAV = [
  { label: "Speak", href: "#speak" },
  { label: "How it reads", href: "#reads" },
  { label: "Honesty", href: "#honesty" },
  { label: "Access", href: "#access" },
];

const STEPS = [
  {
    title: "See",
    body: "Six frames over three and a half seconds — a sequence, not a snapshot. Each one carries its timestamp and how much was moving.",
  },
  {
    title: "Infer",
    body: "Objects are ranked, not scored. Only meaning the frames actually support gets through; the rest is left open on purpose.",
  },
  {
    title: "Confirm",
    body: "If two readings are both plausible, it asks one question instead of guessing. Then it says the sentence out loud.",
  },
];

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SignalInterpretation | null>(null);
  const [error, setError] = useState("");
  const [transcript, setTranscript] = useState<Utterance[]>([]);

  const message =
    result && !result.needsClarification ? result.finalMessage : "";

  const { speaking, spokenWord, read, stop, reset } = useSpeech(message);

  const logged = useRef("");

  // Every resolved sentence joins the transcript, so a demo reads as one
  // conversation rather than a series of disconnected guesses.
  useEffect(() => {
    if (!message.trim() || logged.current === message) return;

    logged.current = message;

    setTranscript((previous) => [
      ...previous,
      {
        id: Date.now(),
        text: message,
        at: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      },
    ]);
  }, [message]);

  async function interpret(frames: string[], meta: FrameMeta[]) {
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const response = await fetch("/api/interpret", {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          frames,
          meta,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Interpretation failed.");
      }

      setResult(data.interpretation);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  function preview(next: SignalInterpretation) {
    setError("");
    setLoading(false);
    reset();
    logged.current = "";
    setResult(next);
  }

  function clearAll() {
    reset();
    logged.current = "";
    setResult(null);
    setError("");
    setTranscript([]);
  }

  const showingAmbiguous = result?.needsClarification === true;
  const showingClear = Boolean(result && !result.needsClarification);

  return (
    <div className="mx-auto w-full max-w-[72rem] px-4 pb-24 md:px-8">
      <header className="sticky top-0 z-50 -mx-4 mb-6 flex items-center justify-between gap-4 bg-ground/80 px-4 py-3 backdrop-blur-xl md:-mx-8 md:px-8">
        <p className="flex items-center gap-2 text-[0.9375rem] font-semibold tracking-tight">
          <span aria-hidden className="font-mono text-accent">
            ıllı
          </span>
          SignalBridge
        </p>

        <nav className="hidden rounded-full bg-surface p-1 shadow-card sm:flex">
          {NAV.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="rounded-full px-4 py-1.5 text-label font-medium text-text-soft transition-colors duration-200 hover:bg-surface-sunk hover:text-text"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <span className="flex items-center gap-2 rounded-full bg-surface px-3.5 py-1.5 text-label font-medium shadow-card">
          <span aria-hidden className={speaking ? "text-live" : "text-accent"}>
            ●
          </span>
          {speaking ? "Speaking" : "Ready"}
        </span>
      </header>

      <p
        id="speak"
        className="mx-auto max-w-2xl scroll-mt-24 pb-6 text-center text-body text-text-soft"
      >
        Gesture to the camera. SignalBridge reads the interaction, turns it into
        a sentence you can check, and speaks it into the room.
      </p>

      {/* The viewport is the page. Only the caption sits on the feed. */}
      <CameraCapture loading={loading} onCapture={interpret}>
        <CaptionOverlay
          loading={loading}
          error={error}
          result={result}
          spokenWord={spokenWord}
          onChoose={(option) =>
            setResult((current) =>
              current ? resolveWithChoice(current, option) : current
            )
          }
        />
      </CameraCapture>

      <div className="mt-4">
        <Transcript
          lines={transcript}
          speaking={speaking}
          canSpeak={Boolean(message)}
          onRead={read}
          onStop={stop}
          onClear={clearAll}
        />
      </div>

      <section className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.25fr]">
        {/* Recorded readings — both outcomes, with no camera and no network. */}
        <div className="rounded-card bg-surface p-4 shadow-card md:p-5">
          <p className="px-1 pb-3 text-label font-medium">Recorded readings</p>

          <div
            role="group"
            aria-label="Preview a recorded reading"
            className="flex gap-1 rounded-full bg-surface-sunk/70 p-1"
          >
            <button
              type="button"
              onClick={() => preview(DEMO_CLEAR)}
              className={`h-11 flex-1 rounded-full text-label font-semibold transition-colors duration-200 ${
                showingClear
                  ? "bg-surface text-text shadow-card"
                  : "text-text-soft hover:text-text"
              }`}
            >
              Reads clearly
            </button>

            <button
              type="button"
              onClick={() => preview(DEMO_AMBIGUOUS)}
              className={`h-11 flex-1 rounded-full text-label font-semibold transition-colors duration-200 ${
                showingAmbiguous
                  ? "bg-surface text-text shadow-card"
                  : "text-text-soft hover:text-text"
              }`}
            >
              Ambiguous
            </button>
          </div>

          <p className="mt-3 px-1 text-label text-text-soft">
            Shows both outcomes with no camera and no network.
          </p>
        </div>

        <IntentPanel result={result} />
      </section>

      <section id="reads" className="mt-24 scroll-mt-24">
        <h2 className="text-label font-medium text-text-soft">
          How it reads you
        </h2>

        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {STEPS.map((step, index) => (
            <div
              key={step.title}
              className="reveal rounded-card bg-surface p-6 shadow-card"
            >
              <p className="font-mono text-label text-accent">
                {String(index + 1).padStart(3, "0")}
              </p>

              <h3 className="mt-2 text-headline">{step.title}</h3>

              <p className="mt-2 text-body text-text-soft">{step.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="honesty" className="reveal mt-24 scroll-mt-24">
        <h2 className="text-label font-medium text-text-soft">
          When it is not sure, it asks
        </h2>

        <div className="mt-4 rounded-card bg-surface p-8 shadow-card md:p-12">
          <p className="max-w-3xl text-headline">
            A pointed finger can mean the cup, the window behind the cup, or the
            person standing next to it.
          </p>

          <p className="mt-4 max-w-2xl text-body text-text-soft">
            Most systems pick the likeliest option and present it as certainty.
            Putting words in the mouth of someone who cannot correct you is the
            worst failure this product could have. So when the reading is
            genuinely ambiguous, SignalBridge stops and asks a single question —
            and the answer resolves instantly, with no second round trip.
          </p>
        </div>
      </section>

      <section id="access" className="reveal mt-24 scroll-mt-24">
        <h2 className="text-label font-medium text-text-soft">
          Who this is for
        </h2>

        <div className="mt-4 rounded-card bg-surface p-8 shadow-card md:p-12">
          <p className="max-w-3xl text-headline">
            Aphasia. ALS. Autism. Post-stroke recovery. Intubation. Any morning
            the words are simply gone.
          </p>

          <p className="mt-4 max-w-2xl text-body text-text-soft">
            SignalBridge reads gestures and context. It does not diagnose, it
            does not infer anything about who you are, and it does not claim to
            translate sign language. It reports what it can see, and asks about
            what it cannot.
          </p>
        </div>
      </section>

      <footer className="mt-20 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-6 text-label text-text-soft">
        <p>SignalBridge · VTHacks 14</p>
        <p>Camera frames are sent for interpretation and never stored.</p>
      </footer>
    </div>
  );
}
