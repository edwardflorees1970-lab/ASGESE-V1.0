import { useEffect, useState, type ReactNode } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { SignaturePad } from "../components/SignaturePad";
import { CameraCapture } from "../components/CameraCapture";

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

const DEVICE_ID_KEY = "asgese_firma_device_id";

// Id aleatorio por navegador (no por red): docente y monitor suelen firmar
// desde la misma IE/WiFi, asi que la IP no sirve para detectar "firmo por
// los dos". Si el MISMO celular abre ambos enlaces, este id sí coincide.
function getDeviceId() {
  try {
    let id = localStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
  } catch {
    return null;
  }
}

export function FirmaPublicaPage() {
  const { token } = useParams<{ token: string }>();
  const [info, setInfo] = useState<SolicitudInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [dni, setDni] = useState("");
  const [fotoDataUrl, setFotoDataUrl] = useState<string | null>(null);
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

  const dniValido = /^\d{8}$/.test(dni);
  const canSave = Boolean(dataUrl && fotoDataUrl && dniValido) && !saving;

  const handleSave = async () => {
    if (!token || !canSave) return;
    setSaving(true);
    setSubmitError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("submit-firma-signature", {
        body: { token, signature_png_base64: dataUrl, foto_base64: fotoDataUrl, dni, device_id: getDeviceId() },
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
          <div className="text-xs font-semibold uppercase tracking-wide text-white/50">Foto de verificación</div>
          <p className="mt-1 text-[11px] text-white/45">Tómate una foto en vivo ahora mismo, como evidencia de que estás presente firmando.</p>
          <div className="mt-2">
            {fotoDataUrl ? (
              <div className="flex items-center gap-3">
                <img src={fotoDataUrl} alt="Foto de verificación" className="h-20 w-20 rounded-lg object-cover" />
                <button
                  type="button"
                  onClick={() => setFotoDataUrl(null)}
                  className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white/70 hover:bg-white/5"
                >
                  Repetir foto
                </button>
              </div>
            ) : (
              <CameraCapture onCapture={setFotoDataUrl} />
            )}
          </div>
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
