"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import { pushSignalEnergy } from "@/lib/signal";

export type FrameMeta = {
  /** Seconds since the first frame. */
  t: number;
  /** Measured motion energy at that instant, 0..1. */
  motion: number;
};

type Props = {
  loading: boolean;
  onCapture: (frames: string[], meta: FrameMeta[]) => Promise<void>;
  /** The caption overlay, rendered in the scrim across the bottom of the feed. */
  children?: ReactNode;
};

const FRAME_COUNT = 6;
const FRAME_GAP = 650;
const COUNT_IN = 700;

const sleep = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

export default function CameraCapture({
  loading,
  onCapture,
  children,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const previousPixels = useRef<Uint8ClampedArray | null>(null);
  const runningRef = useRef(false);
  const latestEnergy = useRef(0);

  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [capturing, setCapturing] = useState(false);
  const [countIn, setCountIn] = useState(0);
  const [taken, setTaken] = useState(0);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let cancelled = false;

    async function startCamera() {
      try {
        const media = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });

        // The component can unmount while the permission prompt is open;
        // without this guard the camera light stays on with no way to stop it.
        if (cancelled) {
          media.getTracks().forEach((track) => track.stop());
          return;
        }

        stream = media;

        if (!videoRef.current) return;

        videoRef.current.srcObject = media;
        await videoRef.current.play();

        setReady(true);
      } catch {
        if (!cancelled) {
          setError("Allow camera access in Chrome, then refresh.");
        }
      }
    }

    startCamera();

    return () => {
      cancelled = true;
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  // Measure how much the picture is changing and feed the caption tick strip.
  useEffect(() => {
    if (!ready) return;

    const probe = document.createElement("canvas");
    probe.width = 64;
    probe.height = 36;

    const ctx = probe.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    const timer = window.setInterval(() => {
      const video = videoRef.current;
      if (!video || !video.videoWidth) return;

      ctx.drawImage(video, 0, 0, probe.width, probe.height);

      const { data } = ctx.getImageData(0, 0, probe.width, probe.height);
      const previous = previousPixels.current;

      if (previous) {
        let total = 0;

        // Every 4th pixel is plenty of resolution at this size.
        for (let i = 0; i < data.length; i += 16) {
          total += Math.abs(data[i] - previous[i]);
        }

        const energy = Math.min(1, total / (data.length / 16) / 28);
        latestEnergy.current = energy;
        pushSignalEnergy(energy);
      }

      previousPixels.current = new Uint8ClampedArray(data);
    }, 100);

    return () => {
      window.clearInterval(timer);
      previousPixels.current = null;
    };
  }, [ready]);

  function takeFrame() {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas || !video.videoWidth) {
      throw new Error("Camera is not ready.");
    }

    const targetWidth = 1024;
    const scale = targetWidth / video.videoWidth;

    canvas.width = targetWidth;
    canvas.height = Math.round(video.videoHeight * scale);

    const ctx = canvas.getContext("2d");

    if (!ctx) {
      throw new Error("Could not capture camera frame.");
    }

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    return canvas.toDataURL("image/jpeg", 0.82);
  }

  const captureSequence = useCallback(async () => {
    if (!ready || loading || runningRef.current) return;

    runningRef.current = true;
    setCapturing(true);
    setError("");
    setTaken(0);

    try {
      // A visible count-in rather than a silent delay: someone with slower
      // motor control needs to know exactly when to start.
      for (let n = 3; n >= 1; n--) {
        setCountIn(n);
        await sleep(COUNT_IN);
      }

      setCountIn(0);

      const frames: string[] = [];
      const meta: FrameMeta[] = [];
      const started = performance.now();

      for (let i = 0; i < FRAME_COUNT; i++) {
        frames.push(takeFrame());

        // Tell the model when each frame landed and how much was moving, so it
        // knows which frames actually carry the gesture.
        meta.push({
          t: Number(((performance.now() - started) / 1000).toFixed(2)),
          motion: Number(latestEnergy.current.toFixed(2)),
        });

        setTaken(i + 1);

        if (i < FRAME_COUNT - 1) await sleep(FRAME_GAP);
      }

      await onCapture(frames, meta);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Unable to capture interaction."
      );
    } finally {
      runningRef.current = false;
      setCapturing(false);
      setCountIn(0);
    }
  }, [ready, loading, onCapture]);

  // Space bar triggers capture, so the control does not have to be hit.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.code !== "Space") return;

      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|BUTTON|SELECT)$/.test(target.tagName)) {
        return;
      }

      event.preventDefault();
      captureSequence();
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [captureSequence]);

  const busy = loading || capturing;

  return (
    <div>
      {/* The viewport. The largest object on the page by a wide margin. */}
      <section className="on-panel relative overflow-hidden rounded-panel bg-panel shadow-panel">
        <div className="relative min-h-[28rem] md:min-h-[36rem]">
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="absolute inset-0 h-full w-full object-cover"
          />

          {!ready && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center">
              <p className="text-body font-medium text-white/75">
                {error ? "Camera not connected" : "Starting camera…"}
              </p>

              {error && (
                <p className="max-w-xs text-label text-white/40">{error}</p>
              )}
            </div>
          )}

          {/* Top chrome */}
          <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-4 p-5 md:p-6">
            <span className="flex items-center gap-2 rounded-full bg-black/35 px-3.5 py-1.5 text-label font-medium text-white backdrop-blur-md">
              <span
                aria-hidden
                className={ready ? "text-live" : "text-white/40"}
              >
                ●
              </span>
              {ready ? "Live" : "Offline"}
            </span>

            <span className="hidden rounded-full bg-black/35 px-3.5 py-1.5 font-mono text-label text-white/70 backdrop-blur-md sm:block">
              {FRAME_COUNT} frames · {FRAME_GAP} ms
            </span>
          </div>

          {countIn > 0 && (
            <div className="absolute inset-0 flex items-center justify-center bg-panel/60 backdrop-blur-sm">
              <span className="text-[7rem] font-semibold leading-none tabular-nums text-white">
                {countIn}
              </span>
            </div>
          )}

          {capturing && countIn === 0 && (
            <div className="absolute inset-x-0 top-20 flex justify-center">
              <span className="rounded-full bg-live px-4 py-1.5 text-label font-semibold text-white">
                Keep going
              </span>
            </div>
          )}

          {/* The caption, sitting on the feed the way captions sit on video. */}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-panel via-panel/75 to-transparent px-6 pb-12 pt-10 md:px-10">
            {children}
          </div>

          {/* Frame ticks — F1…F6 fill as each frame lands. */}
          <div
            className="absolute inset-x-0 bottom-0 flex items-center gap-1.5 px-6 pb-5 md:px-10"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={FRAME_COUNT}
            aria-valuenow={taken}
            aria-label="Frames captured"
          >
            {Array.from({ length: FRAME_COUNT }).map((_, index) => (
              <div key={index} className="flex flex-1 items-center gap-1.5">
                <span
                  className={`font-mono text-[0.625rem] ${
                    index < taken ? "text-white" : "text-white/30"
                  }`}
                >
                  F{index + 1}
                </span>

                <span
                  className={`h-px flex-1 transition-colors duration-200 ${
                    index < taken ? "bg-white" : "bg-white/15"
                  }`}
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      <canvas ref={canvasRef} className="hidden" />

      <button
        type="button"
        onClick={captureSequence}
        disabled={!ready || busy}
        className="mt-4 flex h-[4.5rem] w-full items-center gap-3.5 rounded-panel bg-accent px-7 text-left text-xl font-semibold text-white shadow-raised transition-all duration-200 hover:bg-accent-deep active:scale-[0.995] disabled:pointer-events-none disabled:bg-surface-sunk disabled:text-text-soft disabled:shadow-none"
      >
        <span
          aria-hidden
          className="grid h-7 w-7 place-items-center rounded-full border-2 border-current"
        >
          <span
            className={`h-3 w-3 rounded-full ${
              busy ? "bg-current" : "bg-transparent"
            }`}
          />
        </span>

        <span className="flex-1">
          {loading
            ? "Reading the interaction"
            : capturing
              ? "Capturing"
              : "Capture gesture"}
        </span>

        <span className="font-mono text-label font-normal opacity-70">
          Space
        </span>
      </button>
    </div>
  );
}
