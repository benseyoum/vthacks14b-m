"use client";

import { useEffect, useRef } from "react";

import { SIGNAL_SIZE, readSignal, signalIsLive } from "@/lib/signal";

/**
 * The tick strip inside the caption panel.
 *
 * While the camera runs it draws real motion energy measured from the video.
 * Otherwise it settles to a quiet floor. Either way it reports something true —
 * it is instrumentation, not an ambient loop.
 */
export default function SignalTrace({
  className = "",
  dark = false,
}: {
  className?: string;
  /** Draw in ink rather than white, for use on a light surface. */
  dark?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    const samples = new Float32Array(SIGNAL_SIZE);

    let raf = 0;
    let frame = 0;
    let width = 0;
    let height = 0;

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);

      width = canvas!.clientWidth;
      height = canvas!.clientHeight;

      canvas!.width = Math.round(width * dpr);
      canvas!.height = Math.round(height * dpr);

      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function draw() {
      ctx!.clearRect(0, 0, width, height);

      readSignal(samples);

      const live = signalIsLive();
      const mid = height / 2;

      const gap = 4;
      const count = Math.max(1, Math.floor(width / gap));

      for (let i = 0; i < count; i++) {
        const x = i * gap + 1;
        const sampleIndex = Math.floor((i / count) * SIGNAL_SIZE);

        // At rest: a low, slowly drifting floor rather than a dead flat line.
        const idle =
          0.06 + Math.abs(Math.sin(i * 0.5 + frame * 0.01)) * 0.05;

        const amplitude = live ? Math.max(0.05, samples[sampleIndex]) : idle;
        const half = amplitude * (mid - 1);

        ctx!.strokeStyle = live ? "#ff453a" : dark ? "#1d1d1f" : "#ffffff";
        ctx!.globalAlpha = live ? 0.75 : 0.32;
        ctx!.lineWidth = 1.5;

        ctx!.beginPath();
        ctx!.moveTo(x, mid - half);
        ctx!.lineTo(x, mid + half);
        ctx!.stroke();
      }

      ctx!.globalAlpha = 1;
      frame += 1;

      raf = requestAnimationFrame(draw);
    }

    resize();
    window.addEventListener("resize", resize);

    if (reduced) {
      // Static, evenly spaced ticks: honest, and completely still.
      const gap = 4;
      const count = Math.max(1, Math.floor(width / gap));

      ctx.strokeStyle = dark ? "#1d1d1f" : "#ffffff";
      ctx.globalAlpha = 0.32;
      ctx.lineWidth = 1.5;

      for (let i = 0; i < count; i++) {
        const x = i * gap + 1;
        ctx.beginPath();
        ctx.moveTo(x, height / 2 - 2);
        ctx.lineTo(x, height / 2 + 2);
        ctx.stroke();
      }
    } else {
      raf = requestAnimationFrame(draw);
    }

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [dark]);

  return <canvas ref={canvasRef} aria-hidden className={className} />;
}
