"use client";

import { useEffect, useRef, useState } from "react";
import { BrowserQRCodeReader } from "@zxing/browser";
import type { IScannerControls } from "@zxing/browser";

type ScannerStatus = "starting" | "scanning" | "stopped" | "denied" | "no-camera" | "error";

/**
 * Keyed and remounted by the parent on "restart" instead of resetting state
 * imperatively inside the effect — avoids setState-in-effect entirely, since
 * a remount's own initial `useState("starting")` already is the reset.
 */
function ScannerCore({ onScan, onRestart }: { onScan: (text: string) => void; onRestart: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const [status, setStatus] = useState<ScannerStatus>("starting");

  useEffect(() => {
    let cancelled = false;

    async function start() {
      const reader = new BrowserQRCodeReader(undefined, {
        delayBetweenScanAttempts: 300,
        delayBetweenScanSuccess: 1000,
      });

      try {
        const controls = await reader.decodeFromConstraints(
          { video: { facingMode: { ideal: "environment" } } },
          videoRef.current ?? undefined,
          (result) => {
            // ZXing calls this on every frame, mostly with a "not found"
            // error — that's normal, not a failure. Only act on an actual
            // decoded result, and stop scanning immediately so the same
            // code isn't fired repeatedly while it's still in frame.
            if (result && !cancelled) {
              controlsRef.current?.stop();
              setStatus("stopped");
              onScan(result.getText());
            }
          }
        );
        if (cancelled) {
          controls.stop();
          return;
        }
        controlsRef.current = controls;
        setStatus("scanning");
      } catch (err) {
        if (cancelled) return;
        const name = err instanceof Error ? err.name : "";
        if (name === "NotAllowedError" || name === "SecurityError") {
          setStatus("denied");
        } else if (name === "NotFoundError" || name === "OverconstrainedError") {
          setStatus("no-camera");
        } else {
          setStatus("error");
        }
      }
    }

    start();

    return () => {
      cancelled = true;
      controlsRef.current?.stop();
      controlsRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onScan is stable (useCallback at the call site); re-running this on every render would restart the camera
  }, []);

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative aspect-square w-full max-w-sm overflow-hidden rounded-2xl bg-black">
        <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
        {status === "scanning" && (
          <div className="pointer-events-none absolute inset-8 rounded-xl border-2 border-white/80" />
        )}
        {status !== "scanning" && status !== "stopped" && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70 px-6 text-center text-sm text-white">
            {status === "starting" && "Starting camera…"}
            {status === "denied" && "Camera access is required to scan loyalty cards. Allow camera access and try again."}
            {status === "no-camera" && "No camera was found on this device."}
            {status === "error" && "Couldn't start the camera. Try again or use search instead."}
          </div>
        )}
      </div>

      {(status === "denied" || status === "no-camera" || status === "error" || status === "stopped") && (
        <button
          type="button"
          onClick={onRestart}
          className="rounded-full border border-foreground/15 px-4 py-2 text-sm font-medium hover:bg-foreground/5"
        >
          {status === "stopped" ? "Scan another" : "Restart camera"}
        </button>
      )}
    </div>
  );
}

export function QrScanner({ onScan }: { onScan: (text: string) => void }) {
  const [restartKey, setRestartKey] = useState(0);
  return <ScannerCore key={restartKey} onScan={onScan} onRestart={() => setRestartKey((k) => k + 1)} />;
}
