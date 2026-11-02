"use client";
import { useEffect, useRef, useState } from "react";
import { Camera, CameraOff } from "lucide-react";

interface BarcodeResult {
  rawValue: string;
}
interface Detector {
  detect: (source: HTMLVideoElement) => Promise<BarcodeResult[]>;
}
type DetectorClass = new (options: { formats: string[] }) => Detector;

export function BarcodeCamera({
  onDetected,
}: {
  onDetected: (value: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameRef = useRef<number | null>(null);
  const scanning = useRef(false);
  const mounted = useRef(true);
  const [active, setActive] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");
  function stop() {
    scanning.current = false;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    if (videoRef.current) videoRef.current.srcObject = null;
    if (mounted.current) setActive(false);
  }
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      stop();
    };
  }, []);
  async function start() {
    setError("");
    setStarting(true);
    try {
      const DetectorApi = (
        window as unknown as { BarcodeDetector?: DetectorClass }
      ).BarcodeDetector;
      if (!DetectorApi)
        throw new Error(
          "Camera decoding isn’t supported in this browser yet. Use manual entry or the sample scan below.",
        );
      if (!navigator.mediaDevices?.getUserMedia)
        throw new Error(
          "Camera access needs a supported browser on localhost or HTTPS.",
        );
      const detector = new DetectorApi({
        formats: ["ean_13", "ean_8", "upc_a", "upc_e", "qr_code"],
      });
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      if (!mounted.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      if (!videoRef.current) {
        stop();
        return;
      }
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      if (!mounted.current) {
        stop();
        return;
      }
      scanning.current = true;
      setActive(true);
      let last = 0;
      const tick = async (time: number) => {
        if (!scanning.current || !videoRef.current) return;
        if (time - last > 180 && videoRef.current.readyState >= 2) {
          last = time;
          try {
            const codes = await detector.detect(videoRef.current);
            if (!scanning.current) return;
            if (codes[0]?.rawValue) {
              stop();
              onDetected(codes[0].rawValue);
              return;
            }
          } catch {
            /* Ignore frames that cannot be decoded. */
          }
        }
        if (scanning.current) frameRef.current = requestAnimationFrame(tick);
      };
      frameRef.current = requestAnimationFrame(tick);
    } catch (error) {
      stop();
      if (mounted.current)
        setError(
          error instanceof Error
            ? error.message
            : "Could not open your camera. Try manual entry.",
        );
    } finally {
      if (mounted.current) setStarting(false);
    }
  }
  return (
    <>
      <div className="viewfinder">
        <video
          ref={videoRef}
          muted
          playsInline
          style={{ display: active ? "block" : "none" }}
          aria-label="Barcode camera preview"
        />
        {!active && <div className="mock-barcode" />}
        <div className="scan-reticle">
          <span />
          <span />
          <span />
          <span />
        </div>
        <div className="scan-line" />
        <small>
          {active
            ? "POSITION A BARCODE INSIDE THE FRAME"
            : "A CLEARER PICTURE STARTS HERE"}
        </small>
      </div>
      <div className="scanner-buttons">
        <button
          className="button button-outline"
          disabled={starting}
          onClick={() => void (active ? stop() : start())}
        >
          {active ? <CameraOff size={16} /> : <Camera size={16} />}
          {starting
            ? "Opening camera…"
            : active
              ? "Stop camera"
              : "Open camera"}
        </button>
      </div>
      {error && (
        <p className="form-error" role="alert" style={{ marginBottom: 20 }}>
          {error}
        </p>
      )}
    </>
  );
}
