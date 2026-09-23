"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import jsQR from "jsqr";

type Props = {
  onDetect: (raw: string) => void;
  disabled?: boolean;
};

/**
 * In-browser QR camera for Field PWA.
 * Prefers rear camera on phones; falls back to user-facing (Mac laptop).
 */
export function FieldQrCamera({ onDetect, disabled }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const firedRef = useRef(false);
  const [active, setActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stop = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = 0;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setActive(false);
  }, []);

  const scanLoop = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) {
      rafRef.current = requestAnimationFrame(scanLoop);
      return;
    }

    const w = video.videoWidth;
    const h = video.videoHeight;
    if (w && h) {
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (ctx) {
        ctx.drawImage(video, 0, 0, w, h);
        const image = ctx.getImageData(0, 0, w, h);
        const code = jsQR(image.data, w, h, { inversionAttempts: "dontInvert" });
        if (code?.data && !firedRef.current) {
          firedRef.current = true;
          stop();
          onDetect(code.data);
          return;
        }
      }
    }
    rafRef.current = requestAnimationFrame(scanLoop);
  }, [onDetect, stop]);

  async function start() {
    setError(null);
    firedRef.current = false;
    stop();

    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Camera API not available in this browser.");
      return;
    }

    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: "environment" } },
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: "user" },
        });
      }

      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      await video.play();
      setActive(true);
      rafRef.current = requestAnimationFrame(scanLoop);
    } catch (e) {
      const name = e instanceof DOMException ? e.name : "";
      if (name === "NotAllowedError") {
        setError(
          "Camera permission blocked. Allow camera for localhost in the browser address bar, and in macOS System Settings → Privacy & Security → Camera.",
        );
      } else if (name === "NotFoundError") {
        setError("No camera found on this Mac.");
      } else {
        setError(e instanceof Error ? e.message : "Could not open camera");
      }
    }
  }

  useEffect(() => () => stop(), [stop]);

  useEffect(() => {
    if (disabled && active) stop();
  }, [disabled, active, stop]);

  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden rounded-lg border border-[var(--border)] bg-black">
        <video
          ref={videoRef}
          className="aspect-[3/4] w-full object-cover"
          playsInline
          muted
          autoPlay
        />
        <canvas ref={canvasRef} className="hidden" />
        {!active ? (
          <div className="absolute inset-0 flex items-center justify-center bg-[var(--surface)] p-4 text-center text-sm text-[var(--muted)]">
            Camera preview appears here after you tap Start camera
          </div>
        ) : null}
      </div>

      <div className="flex gap-2">
        {!active ? (
          <button
            type="button"
            disabled={disabled}
            onClick={() => void start()}
            className="min-h-12 flex-1 rounded-lg bg-[var(--accent)] text-sm font-semibold text-white disabled:opacity-50"
          >
            Start camera
          </button>
        ) : (
          <button
            type="button"
            onClick={stop}
            className="min-h-12 flex-1 rounded-lg border border-[var(--border)] bg-white text-sm"
          >
            Stop camera
          </button>
        )}
      </div>

      {error ? <p className="text-sm text-[var(--risk)]">{error}</p> : null}
      <p className="text-xs text-[var(--muted)]">
        On a Mac laptop this uses the built-in webcam. Point it at the board QR printout, or paste
        the token below.
      </p>
    </div>
  );
}
