import { useEffect, useState, type ReactNode } from "react";
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

export function FirmaPublicaPage() {
  const { token } = useParams<{ token: string }>();
  const [info, setInfo] = useState<SolicitudInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dataUrl, setDataUrl] = useState<string | null>(null);
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

  const handleSave = async () => {
    if (!token || !dataUrl) return;
    setSaving(true);
    setSubmitError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("submit-firma-signature", {
        body: { token, signature_png_base64: dataUrl },
      });
      if (fnError || !(data as { ok?: boolean })?.ok) {
        const message = (data as { error?: string })?.error ?? "No se pudo guardar la firma. Intente nuevamente.";
        setSubmitError(message);
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
          disabled={!dataUrl || saving}
          className="executive-primary-action mt-4 w-full rounded-xl px-4 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? "Guardando..." : "Guardar firma"}
        </button>
      </div>
    </Shell>
  );
}
