import { useEffect, useRef, useState } from "react";
import { Camera, RotateCcw, X } from "lucide-react";

interface LiveCameraCaptureProps {
  onCapture: (file: File) => void;
  onClose: () => void;
  onChooseFile: () => void;
}

function cameraError(error: unknown): string {
  if (error instanceof Error && error.name === "NotAllowedError") {
    return "Camera access was blocked. Allow camera access in your browser settings and try again.";
  }
  if (error instanceof Error && error.name === "NotFoundError") {
    return "No camera was found on this device. Choose a photo from your files instead.";
  }
  if (error instanceof Error && error.name === "NotReadableError") {
    return "The camera is being used by another app. Close it there and try again.";
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    return "Live camera access requires a secure connection (HTTPS) and a supported browser.";
  }
  return "We couldn't start the camera. Check the connection and permissions, then try again.";
}

export function LiveCameraCapture({ onCapture, onClose, onChooseFile }: LiveCameraCaptureProps) {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const requestId = useRef(0);
  const [error, setError] = useState("");
  const [starting, setStarting] = useState(true);
  const [capturing, setCapturing] = useState(false);

  async function startCamera() {
    const currentRequest = ++requestId.current;
    setStarting(true);
    setError("");
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("CAMERA_UNAVAILABLE");
      const activeStream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: "environment" } },
      });
      if (currentRequest !== requestId.current) {
        activeStream.getTracks().forEach((track) => track.stop());
        return;
      }
      stream.current = activeStream;
      if (video.current) video.current.srcObject = activeStream;
    } catch (cause) {
      if (currentRequest === requestId.current) setError(cameraError(cause));
    } finally {
      if (currentRequest === requestId.current) setStarting(false);
    }
  }

  useEffect(() => {
    void startCamera();
    return () => {
      requestId.current += 1;
      stream.current?.getTracks().forEach((track) => track.stop());
      stream.current = null;
    };
  }, []);

  function capturePhoto() {
    const element = video.current;
    if (!element || !element.videoWidth || !element.videoHeight) {
      setError("The live camera is not ready yet. Wait for the preview and try again.");
      return;
    }
    setCapturing(true);
    const canvas = document.createElement("canvas");
    const scale = Math.min(1, 2048 / Math.max(element.videoWidth, element.videoHeight));
    canvas.width = Math.round(element.videoWidth * scale);
    canvas.height = Math.round(element.videoHeight * scale);
    const context = canvas.getContext("2d");
    if (!context) {
      setCapturing(false);
      setError("We couldn't capture the camera image. Please try again.");
      return;
    }
    context.drawImage(element, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      setCapturing(false);
      if (!blob) {
        setError("We couldn't capture the camera image. Please try again.");
        return;
      }
      onCapture(new File([blob], `shamba-link-photo-${Date.now()}.jpg`, {
        type: "image/jpeg",
        lastModified: Date.now(),
      }));
      onClose();
    }, "image/jpeg", 0.86);
  }

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  return <div className="live-camera-backdrop" role="presentation" onMouseDown={(event) => {
    if (event.target === event.currentTarget) onClose();
  }}>
    <section className="live-camera-dialog" role="dialog" aria-modal="true" aria-labelledby="live-camera-title">
      <header className="live-camera-header">
        <div><span className="form-kicker">LIVE CAMERA</span><h2 id="live-camera-title">Take a farm photo</h2></div>
        <button type="button" className="icon-button" onClick={onClose} aria-label="Close camera"><X size={20} /></button>
      </header>
      <div className="live-camera-preview">
        <video ref={video} autoPlay playsInline muted aria-label="Live camera preview" />
        {(starting || error) && <div className="live-camera-message" role={error ? "alert" : "status"}>
          {error ? <><Camera size={24} /><p>{error}</p></> : <><span className="loader" /><p>Starting your camera…</p></>}
        </div>}
      </div>
      <div className="live-camera-actions">
        {error && <>
          <button type="button" className="button button-light" onClick={() => { onChooseFile(); onClose(); }}>Choose a photo instead</button>
          <button type="button" className="button button-light" onClick={() => void startCamera()} disabled={starting}><RotateCcw size={16} /> Try camera again</button>
        </>}
        <button type="button" className="button button-dark" onClick={capturePhoto} disabled={starting || Boolean(error) || capturing}>
          <Camera size={17} />{capturing ? "Capturing…" : "Capture photo"}
        </button>
      </div>
    </section>
  </div>;
}
