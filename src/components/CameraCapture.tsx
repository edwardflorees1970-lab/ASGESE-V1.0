import { useEffect, useRef, useState } from "react";

const CAPTURE_MAX_DIM = 900;
const CAPTURE_QUALITY = 0.75;

const TIPS = [
  "Acércate un poco más a la cámara",
  "Evita usar lentes oscuros o gorros",
  "Rostro descubierto y bien iluminado",
];

// Camara en vivo (no selector de archivos): evita que se suba una foto vieja
// de la galeria como si fuera la evidencia del momento. La captura se
// dibuja tal cual llega del sensor (sin espejo), aunque la vista previa se
// muestra en espejo porque asi se ve natural para el usuario.
export function CameraCapture({
  onCapture,
  onCancel,
}: {
  onCapture: (dataUrl: string) => void;
  onCancel?: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 720 }, height: { ideal: 960 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        setReady(true);
      } catch {
        if (!cancelled) setError("No se pudo acceder a la cámara. Da permiso de cámara al navegador para poder firmar.");
      }
    })();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  const takePhoto = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const scale = Math.min(1, CAPTURE_MAX_DIM / Math.max(video.videoWidth, video.videoHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    setPreview(canvas.toDataURL("image/jpeg", CAPTURE_QUALITY));
    stopStream();
  };

  const retake = async () => {
    setPreview(null);
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 720 }, height: { ideal: 960 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
    } catch {
      setError("No se pudo acceder a la cámara. Da permiso de cámara al navegador para poder firmar.");
    }
  };

  const confirm = () => {
    if (preview) onCapture(preview);
  };

  if (error) {
    return (
      <div className="rounded-xl border border-red-400/20 bg-red-500/10 p-3 text-xs text-red-200">
        {error}
        {onCancel && (
          <button type="button" onClick={onCancel} className="mt-2 block rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white/70 hover:bg-white/5">
            Cancelar
          </button>
        )}
      </div>
    );
  }

  if (preview) {
    return (
      <div className="overflow-hidden rounded-xl border border-white/10 bg-black">
        <img src={preview} alt="Foto de verificación capturada" className="aspect-[3/4] w-full object-cover" />
        <div className="flex gap-2 p-2">
          <button type="button" onClick={retake} className="flex-1 rounded-lg border border-white/10 px-3 py-2 text-xs text-white/80 hover:bg-white/10">
            Repetir foto
          </button>
          <button type="button" onClick={confirm} className="executive-primary-action flex-1 rounded-lg px-3 py-2 text-xs font-semibold">
            Usar esta foto
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-xl border border-white/10 bg-black">
      <video ref={videoRef} playsInline muted className="aspect-[3/4] w-full scale-x-[-1] object-cover" />
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-between p-3">
        <div className="rounded-lg bg-black/50 px-3 py-1.5 text-center text-[11px] leading-tight text-white/90">
          {TIPS.map((tip) => (
            <div key={tip}>{tip}</div>
          ))}
        </div>
        <div className="mb-2 h-[62%] w-[52%] rounded-[50%] border-2 border-dashed border-white/70" />
      </div>
      {ready && (
        <button
          type="button"
          onClick={takePhoto}
          className="executive-primary-action absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full px-5 py-2.5 text-xs font-semibold shadow-lg"
        >
          Tomar foto
        </button>
      )}
      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center text-xs text-white/60">Activando cámara...</div>
      )}
    </div>
  );
}
