"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  loading: boolean;
  onCapture: (frames: string[]) => Promise<void>;
};

type FacingMode = "user" | "environment";

const sleep = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

export default function CameraCapture({
  loading,
  onCapture,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [capturing, setCapturing] = useState(false);
  const [facingMode, setFacingMode] = useState<FacingMode>("user");

  useEffect(() => {
    let cancelled = false;

    async function startCamera() {
      setReady(false);
      setError("");

      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: facingMode },
          },
          audio: false,
        });

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;

        if (!videoRef.current) return;

        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setReady(true);
      } catch {
        setError(
          "Camera permission failed or this camera is unavailable. Allow camera access and try again."
        );
      }
    }

    startCamera();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, [facingMode]);

  function flipCamera() {
    if (capturing || loading) return;

    setFacingMode((current) =>
      current === "user" ? "environment" : "user"
    );
  }

  function takeFrame() {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas || !video.videoWidth) {
      throw new Error("Camera is not ready.");
    }

    const targetWidth = 640;
    const scale = targetWidth / video.videoWidth;

    canvas.width = targetWidth;
    canvas.height = Math.round(video.videoHeight * scale);

    const ctx = canvas.getContext("2d");

    if (!ctx) {
      throw new Error("Could not capture camera frame.");
    }

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    return canvas.toDataURL("image/jpeg", 0.68);
  }

  async function captureSequence() {
    if (!ready || loading || capturing) return;

    setCapturing(true);
    setError("");

    try {
      const frames: string[] = [];

      // Gives the communicator a beat to begin, then samples the full gesture.
      await sleep(500);

      for (let i = 0; i < 6; i++) {
        frames.push(takeFrame());

        if (i < 5) {
          await sleep(500);
        }
      }

      await onCapture(frames);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Unable to capture interaction."
      );
    } finally {
      setCapturing(false);
    }
  }

  return (
    <div>
      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-black">
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className={`aspect-video w-full object-cover ${
            facingMode === "user" ? "scale-x-[-1]" : ""
          }`}
        />

        {!ready && !error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black text-zinc-400">
            Starting camera...
          </div>
        )}

        <div className="absolute left-4 top-4 rounded-full bg-black/60 px-4 py-2 text-sm backdrop-blur">
          <span className="mr-2 text-red-400">●</span>
          Live
        </div>

        <button
          type="button"
          onClick={flipCamera}
          disabled={!ready || loading || capturing}
          className="absolute right-4 top-4 rounded-full border border-white/15 bg-black/60 px-4 py-2 text-sm font-medium text-white backdrop-blur transition hover:bg-black/80 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Flip camera"
        >
          ↻ {facingMode === "user" ? "Rear camera" : "Front camera"}
        </button>

        {capturing && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/35">
            <div className="rounded-full bg-black/70 px-5 py-3 text-sm font-medium backdrop-blur">
              Keep communicating...
            </div>
          </div>
        )}
      </div>

      <canvas ref={canvasRef} className="hidden" />

      {error && (
        <div className="mt-4 rounded-2xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-200">
          {error}
        </div>
      )}

      <button
        onClick={captureSequence}
        disabled={!ready || loading || capturing}
        className="mt-5 w-full rounded-2xl bg-white px-6 py-4 text-lg font-semibold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {loading
          ? "Understanding..."
          : capturing
            ? "Capturing signal..."
            : "Interpret my signal"}
      </button>

      <p className="mt-3 text-center text-xs text-zinc-500">
        Perform the full gesture after pressing the button.
      </p>
    </div>
  );
}
