import { useEffect, useState, type ChangeEvent, type ReactNode } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { SignaturePad } from "../components/SignaturePad";

type SolicitudInfo = {
  status: "pendiente" | "firmado" | "expirado" | "invalido";
  signer?: "docente" | "monitor";
  ficha_titulo?: string;
  institucion?: string;
  monitoreado?: string;
};

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-zinc-950 px-4 py-10 text-white">
      <div className="mx-auto w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="text-xs font-bold uppercase tracking-widest text-[var(--app-accent)]">ASGESE</div>
          <div className="text-sm text-white/50">Firma de conformidad</div>
        </div>
        {children}
      </div>
    </div>
  );
}

function InfoCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-center">
      <div className="text-base font-semibold">{title}</div>
      <p className="mt-2 text-sm text-white/60">{description}</p>
    </div>
  );
}

const SIGNER_LABEL: Record<string, string> = {
  docente: "Docente monitoreado",
  monitor: "Monitor",
};

// Las fotos de camara suelen pesar varios MB; se reducen en el dispositivo
// antes de subir para que funcione bien con la conectividad de campo.
function compressPhoto(file: File, maxDim = 900, quality = 0.7): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("No se pudo procesar la foto."));
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("No se pudo leer la foto."));
    };
    img.src = objectUrl;
  });
}

export function FirmaPublicaPage() {
  const { token } = useParams<{ token: string }>();
  const [info, setInfo] = useState<SolicitudInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [dni, setDni] = useState("");
  const [fotoDataUrl, setFotoDataUrl] = useState<string | null>(null);
  const [fotoError, setFotoError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!token) {
      setError("Enlace inválido.");
      setLoading(false);
      return;
    }
    (async () => {
      const { data, error: rpcError } = await supabase.rpc("firma_solicitud_info", { p_token: token });
      if (cancelled) return;
      if (rpcError) {
        setError("No se pudo verificar el enlace.");
      } else {
        setInfo(data as SolicitudInfo);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleFotoChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setFotoError(null);
    try {
      const compressed = await compressPhoto(file);
      setFotoDataUrl(compressed);
    } catch {
      setFotoError("No se pudo procesar la foto. Intente de nuevo.");
      setFotoDataUrl(null);
    }
  };

  const dniValido = /^\d{8}$/.test(dni);
  const canSave = Boolean(dataUrl && fotoDataUrl && dniValido) && !saving;

  const handleSave = async () => {
    if (!token || !canSave) return;
    setSaving(true);
    setSubmitError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("submit-firma-signature", {
        body: { token, signature_png_base64: dataUrl, foto_base64: fotoDataUrl, dni },
      });
      if (fnError) {
        // FunctionsHttpError no trae el JSON del body en `data`; hay que leerlo
        // de la Response cruda en `context` para mostrar el motivo real
        // (DNI no coincide, enlace vencido, etc.) en vez de un mensaje generico.
        let message = "No se pudo guardar la firma. Intente nuevamente.";
        const context = (fnError as { context?: Response }).context;
        if (context && typeof context.json === "function") {
          try {
            const body = await context.json();
            if (body?.error) message = body.error;
          } catch {
            // respuesta sin JSON valido, se deja el mensaje generico
          }
        }
        setSubmitError(message);
        return;
      }
      if (!(data as { ok?: boolean })?.ok) {
        setSubmitError((data as { error?: string })?.error ?? "No se pudo guardar la firma. Intente nuevamente.");
        return;
      }
      setSaved(true);
    } catch {
      setSubmitError("No se pudo guardar la firma. Verifique su conexión e intente nuevamente.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Shell>
        <InfoCard title="Cargando..." description="Verificando el enlace de firma." />
      </Shell>
    );
  }

  if (error || !info || info.status === "invalido") {
    return (
      <Shell>
        <InfoCard title="Enlace inválido" description="Este enlace de firma no existe o ya no es válido." />
      </Shell>
    );
  }

  if (info.status === "expirado") {
    return (
      <Shell>
        <InfoCard title="Enlace vencido" description="Este enlace de firma venció. Pida al monitor que genere uno nuevo desde Reportes y Resultados." />
      </Shell>
    );
  }

  if (info.status === "firmado" || saved) {
    return (
      <Shell>
        <InfoCard title="Firma registrada" description="Gracias, su firma ya fue registrada. Puede cerrar esta ventana." />
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <div className="text-sm text-white/50">Firma solicitada a</div>
        <div className="text-base font-semibold">{SIGNER_LABEL[info.signer ?? ""] ?? "Firmante"}</div>
        <div className="mt-3 space-y-1 text-sm text-white/70">
          {info.ficha_titulo && <div>Ficha: {info.ficha_titulo}</div>}
          {info.monitoreado && <div>Monitoreado: {info.monitoreado}</div>}
          {info.institucion && <div>Código IE: {info.institucion}</div>}
        </div>

        <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3">
          <label htmlFor="firma-dni" className="text-xs font-semibold uppercase tracking-wide text-white/50">
            Confirma tu DNI
          </label>
          <p className="mt-1 text-[11px] text-white/45">Para verificar que quien firma es realmente {SIGNER_LABEL[info.signer ?? ""]?.toLowerCase()}.</p>
          <input
            id="firma-dni"
            type="text"
            inputMode="numeric"
            maxLength={8}
            value={dni}
            onChange={(e) => setDni(e.target.value.replace(/\D/g, "").slice(0, 8))}
            placeholder="8 dígitos"
            className="mt-2 h-11 w-full rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-white outline-none focus:border-[var(--app-accent)]"
          />
        </div>

        <div className="mt-3 rounded-xl border border-white/10 bg-white/5 p-3">
          <label htmlFor="firma-foto" className="text-xs font-semibold uppercase tracking-wide text-white/50">Foto de verificación</label>
          <p className="mt-1 text-[11px] text-white/45">Tómate una foto ahora mismo, como evidencia de que estás presente firmando.</p>
          <input
            id="firma-foto"
            type="file"
            accept="image/*"
            capture="user"
            onChange={handleFotoChange}
            className="mt-2 block w-full text-xs text-white/70 file:mr-3 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-2 file:text-xs file:text-white"
          />
          {fotoError && <p className="mt-2 text-xs text-red-300">{fotoError}</p>}
          {fotoDataUrl && (
            <img src={fotoDataUrl} alt="Vista previa de la foto de verificación" className="mt-2 h-24 w-24 rounded-lg object-cover" />
          )}
        </div>

        <div className="mt-4">
          <SignaturePad onChange={setDataUrl} />
        </div>

        {submitError && (
          <div className="mt-3 rounded-xl border border-red-400/20 bg-red-500/10 px-3 py-2 text-xs text-red-200">
            {submitError}
          </div>
        )}

        <button
          type="button"
          onClick={handleSave}
          disabled={!canSave}
          className="executive-primary-action mt-4 w-full rounded-xl px-4 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? "Guardando..." : "Guardar firma"}
        </button>
      </div>
    </Shell>
  );
}
