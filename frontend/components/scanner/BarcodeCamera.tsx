"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { IScannerControls } from "@zxing/browser";
import { Camera, CameraOff, ImagePlus, LoaderCircle } from "lucide-react";
import { createBarcodeReader } from "@/lib/barcode-reader";

interface NativeDetector {
  detect(
    source: HTMLVideoElement,
  ): Promise<{ rawValue: string; format?: string }[]>;
}
interface NativeDetectorClass {
  new (options: { formats: string[] }): NativeDetector;
  getSupportedFormats(): Promise<string[]>;
}

function cameraError(error: unknown) {
  if (error instanceof DOMException) {
    if (["NotAllowedError", "SecurityError"].includes(error.name))
      return "Camera permission was denied. Allow camera access in your browser’s site settings, or upload a barcode photo.";
    if (error.name === "NotFoundError")
      return "No camera was found. Connect a camera, upload a barcode photo, or enter the digits below.";
    if (["NotReadableError", "AbortError"].includes(error.name))
      return "The camera could not start. Close other apps using it and try again, or upload a photo.";
  }
  return error instanceof Error
    ? error.message
    : "Could not open the camera. Try uploading a photo or entering the digits.";
}

export function BarcodeCamera({
  onDetected,
}: {
  onDetected: (value: string, format?: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionRef = useRef(0);
  const mounted = useRef(false);
  const callback = useRef(onDetected);
  callback.current = onDetected;
  const [phase, setPhase] = useState<"idle" | "starting" | "camera" | "image">(
    "idle",
  );
  const [engine, setEngine] = useState<"native" | "zxing" | null>(null);
  const [error, setError] = useState("");

  const release = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    controlsRef.current?.stop();
    controlsRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
    }
  }, []);
  const stop = useCallback(() => {
    sessionRef.current++;
    release();
    if (mounted.current) {
      setPhase("idle");
      setEngine(null);
    }
  }, [release]);
  useEffect(() => {
    mounted.current = true;
    const pause = () => {
      if (document.hidden) stop();
    };
    document.addEventListener("visibilitychange", pause);
    return () => {
      mounted.current = false;
      stop();
      document.removeEventListener("visibilitychange", pause);
    };
  }, [stop]);
  const isCurrent = (session: number) =>
    mounted.current && sessionRef.current === session;
  function finish(session: number, value: string, format?: string) {
    if (!isCurrent(session)) return;
    stop();
    setError("");
    callback.current(value, format);
  }

  async function start() {
    stop();
    const session = sessionRef.current;
    setPhase("starting");
    setError("");
    try {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia)
        throw new Error(
          "Camera access requires HTTPS or localhost. Upload a barcode photo or enter its digits instead.",
        );
      let detector: NativeDetector | null = null;
      try {
        const Api = (
          window as unknown as { BarcodeDetector?: NativeDetectorClass }
        ).BarcodeDetector;
        if (Api?.getSupportedFormats) {
          const supported = await Api.getSupportedFormats();
          const formats = [
            "ean_13",
            "ean_8",
            "upc_a",
            "upc_e",
            "qr_code",
            "data_matrix",
          ].filter((format) => supported.includes(format));
          // Use ZXing if the native implementation cannot decode retail codes.
          if (formats.includes("ean_13") && formats.includes("upc_a"))
            detector = new Api({ formats });
        }
      } catch {
        /* An unavailable native decoder should not block the camera. */
      }
      if (!isCurrent(session)) return;
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
      } catch (error) {
        if (
          !(error instanceof DOMException) ||
          error.name !== "OverconstrainedError" ||
          !isCurrent(session)
        )
          throw error;
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      }
      if (!isCurrent(session)) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) {
        stop();
        return;
      }
      video.srcObject = stream;
      await video.play();
      if (!isCurrent(session)) return;
      setPhase("camera");
      const useZXing = async () => {
        const { reader, decoded } = await createBarcodeReader();
        if (!isCurrent(session)) return;
        setEngine("zxing");
        const controls = await reader.decodeFromStream(
          stream,
          video,
          (result, _error, control) => {
            if (!isCurrent(session)) {
              control.stop();
              return;
            }
            if (result) {
              const code = decoded(result);
              control.stop();
              finish(session, code.value, code.format);
            }
          },
        );
        if (!isCurrent(session)) controls.stop();
        else controlsRef.current = controls;
      };
      if (!detector) {
        await useZXing();
        return;
      }
      setEngine("native");
      let failures = 0;
      const tick = async () => {
        if (!isCurrent(session)) return;
        try {
          if (video.readyState >= 2) {
            const result = await detector.detect(video);
            if (!isCurrent(session)) return;
            failures = 0;
            if (result[0]?.rawValue) {
              finish(session, result[0].rawValue, result[0].format);
              return;
            }
          }
        } catch {
          failures++;
          if (failures >= 3) {
            try {
              await useZXing();
            } catch (error) {
              if (isCurrent(session)) {
                stop();
                setError(cameraError(error));
              }
            }
            return;
          }
        }
        if (isCurrent(session))
          timerRef.current = setTimeout(() => void tick(), 180);
      };
      void tick();
    } catch (error) {
      if (isCurrent(session)) {
        stop();
        setError(cameraError(error));
      }
    }
  }

  async function scanImage(file?: File) {
    if (!file) return;
    stop();
    const session = sessionRef.current;
    setPhase("image");
    setError("");
    let imageUrl: string | null = null;
    try {
      if (!file.size || file.size > 10 * 1024 * 1024)
        throw new Error("Choose a barcode photo smaller than 10 MB.");
      if (!/^image\/(png|jpeg|webp)$/.test(file.type))
        throw new Error("Choose a PNG, JPEG, or WebP photo of the barcode.");
      imageUrl = URL.createObjectURL(file);
      const image = new Image();
      image.src = imageUrl;
      await image.decode();
      if (!isCurrent(session)) return;
      if (image.naturalWidth * image.naturalHeight > 32000000)
        throw new Error(
          "This image is too large. Crop the photo around the barcode and try again.",
        );
      const { reader, decoded } = await createBarcodeReader();
      if (!isCurrent(session)) return;
      const scale = Math.min(
        1,
        2000 / Math.max(image.naturalWidth, image.naturalHeight),
      );
      const width = Math.round(image.naturalWidth * scale),
        height = Math.round(image.naturalHeight * scale);
      const canvas = document.createElement("canvas");
      for (const angle of [0, 90, 180, 270]) {
        canvas.width = angle % 180 ? height : width;
        canvas.height = angle % 180 ? width : height;
        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (!context)
          throw new Error("Image decoding is unavailable in this browser.");
        context.fillStyle = "white";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.translate(canvas.width / 2, canvas.height / 2);
        context.rotate((angle * Math.PI) / 180);
        context.drawImage(image, -width / 2, -height / 2, width, height);
        try {
          const code = decoded(reader.decodeFromCanvas(canvas));
          finish(session, code.value, code.format);
          return;
        } catch {
          /* Try the next orientation before reporting no readable code. */
        }
      }
      throw new Error(
        "No readable product barcode was found. Crop closely around a sharp, well-lit barcode, or enter its digits below.",
      );
    } catch (error) {
      if (isCurrent(session)) {
        stop();
        setError(
          error instanceof DOMException
            ? "Could not read that image. Choose a PNG, JPEG, or WebP photo."
            : error instanceof Error
              ? error.message
              : "Could not read the barcode photo.",
        );
      }
    } finally {
      if (imageUrl) URL.revokeObjectURL(imageUrl);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const cameraVisible = phase === "camera" || phase === "starting";
  return (
    <>
      <div className={`viewfinder ${phase === "camera" ? "is-scanning" : ""}`}>
        <video
          ref={videoRef}
          muted
          playsInline
          autoPlay
          style={{ display: cameraVisible ? "block" : "none" }}
          aria-label="Barcode camera preview"
        />
        {!cameraVisible && <div className="mock-barcode" />}
        <div className="scan-reticle">
          <span />
          <span />
          <span />
          <span />
        </div>
        <div className="scan-line" />
        {phase === "image" && (
          <div className="scan-image-progress" role="status">
            <LoaderCircle size={24} className="spin" />
            Reading your barcode photo…
          </div>
        )}
        <small>
          {phase === "camera"
            ? "HOLD THE BARCODE STEADY INSIDE THE FRAME"
            : phase === "starting"
              ? "WAITING FOR CAMERA ACCESS…"
              : "SCAN A BARCODE OR UPLOAD A PHOTO"}
        </small>
      </div>
      <div className="scanner-buttons">
        <button
          type="button"
          className="button button-outline"
          disabled={phase === "image"}
          onClick={() => void (cameraVisible ? stop() : start())}
        >
          {cameraVisible ? <CameraOff size={16} /> : <Camera size={16} />}
          {phase === "starting"
            ? "Cancel camera"
            : phase === "camera"
              ? "Stop camera"
              : "Open camera"}
        </button>
        <button
          type="button"
          className="button button-outline"
          disabled={phase === "image"}
          onClick={() => fileRef.current?.click()}
        >
          <ImagePlus size={16} />
          {phase === "image" ? "Reading image…" : "Scan an image"}
        </button>
        <input
          ref={fileRef}
          className="sr-only"
          tabIndex={-1}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          aria-label="Upload a barcode photo"
          onChange={(event) => void scanImage(event.target.files?.[0])}
        />
      </div>
      {phase === "camera" && (
        <p className="scanner-engine" role="status">
          {engine === "native"
            ? "Native barcode reader"
            : "ZXing barcode reader"}{" "}
          · rear camera preferred · scanning on your device
        </p>
      )}
      {error && (
        <p className="form-error" role="alert" style={{ marginBottom: 20 }}>
          {error}
        </p>
      )}
    </>
  );
}
