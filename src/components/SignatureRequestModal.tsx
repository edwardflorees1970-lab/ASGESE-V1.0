import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import QRCode from "qrcode";
import { supabase } from "../lib/supabaseClient";

type Signer = "docente" | "monitor";

type RunLike = { id: string };

type SignerState = {
  loading: boolean;
  signed: boolean;
  link: string | null;
  qrDataUrl: string | null;
  error: string | null;
};

const SIGNER_LABEL: Record<Signer, string> = {
  docente: "Docente monitoreado",
  monitor: "Monitor",
};

function emptySignerState(): SignerState {
  return { loading: false, signed: false, link: null, qrDataUrl: null, error: null };
}

export function SignatureRequestModal({ run, onClose }: { run: RunLike | null; onClose: () => void }) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [checking, setChecking] = useState(false);
  const [signers, setSigners] = useState<Record<Signer, SignerState>>({
    docente: emptySignerState(),
    monitor: emptySignerState(),
  });

  useEffect(() => {
    if (!run) return;
    let cancelled = false;
    (async () => {
      setChecking(true);
      setSigners({ docente: emptySignerState(), monitor: emptySignerState() });
      const { data } = await supabase
        .from("form_run")
        .select("docente_firma_path, monitor_firma_path")
        .eq("id", run.id)
        .maybeSingle();
      if (cancelled) return;
      setSigners((prev) => ({
        docente: { ...prev.docente, signed: Boolean(data?.docente_firma_path) },
        monitor: { ...prev.monitor, signed: Boolean(data?.monitor_firma_path) },
      }));
      setChecking(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [run]);

  useEffect(() => {
    if (!run) return;
    closeRef.current?.focus();
  }, [run]);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") onClose();
  };

  const generateLink = async (signer: Signer) => {
    if (!run) return;
    setSigners((prev) => ({ ...prev, [signer]: { ...prev[signer], loading: true, error: null } }));
    const { data, error } = await supabase.rpc("create_firma_solicitud", {
      p_run_id: run.id,
      p_signer: signer,
    });
    if (error || !data) {
      setSigners((prev) => ({
        ...prev,
        [signer]: { ...prev[signer], loading: false, error: "No se pudo generar el enlace." },
      }));
      return;
    }
    const link = `${window.location.origin}/firmar/${data}`;
    const qrDataUrl = await QRCode.toDataURL(link, { margin: 1, width: 220 }).catch(() => null);
    setSigners((prev) => ({
      ...prev,
      [signer]: { ...prev[signer], loading: false, link, qrDataUrl },
    }));
  };

  const copyLink = async (link: string) => {
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      // clipboard API unavailable, ignore
    }
  };

  if (!run) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div className="agebre-dialog-overlay absolute inset-0" onClick={onClose} aria-hidden="true" />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          onKeyDown={handleKeyDown}
          className="agebre-dialog max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto"
        >
          <div className="flex items-center justify-between border-b border-[var(--app-border)] px-5 py-4">
            <div>
              <div id={titleId} className="text-sm font-semibold">Firmas del registro</div>
              <p className="mt-1 text-xs text-[var(--app-muted)]">Genere un enlace/QR para que el docente o el monitor firmen desde su celular, sin iniciar sesión.</p>
            </div>
            <button ref={closeRef} type="button" onClick={onClose} className="rounded-lg border border-white/10 px-2 py-1 text-xs text-white/60 hover:bg-white/5">
              Cerrar
            </button>
          </div>

          <div className="space-y-3 px-5 py-4">
            {(["docente", "monitor"] as Signer[]).map((signer) => {
              const state = signers[signer];
              return (
                <div key={signer} className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-semibold text-white">{SIGNER_LABEL[signer]}</div>
                    {state.signed && (
                      <span className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-xs text-emerald-100">Firmado</span>
                    )}
                  </div>

                  {!state.signed && !state.link && (
                    <button
                      type="button"
                      onClick={() => generateLink(signer)}
                      disabled={checking || state.loading}
                      className="executive-primary-action mt-3 w-full rounded-lg px-3 py-2 text-xs font-semibold disabled:opacity-50"
                    >
                      {state.loading ? "Generando..." : "Generar enlace"}
                    </button>
                  )}

                  {state.error && <p className="mt-2 text-xs text-red-300">{state.error}</p>}

                  {!state.signed && state.link && (
                    <div className="mt-3 flex flex-col items-center gap-3 sm:flex-row sm:items-start">
                      {state.qrDataUrl && (
                        <img src={state.qrDataUrl} alt={`Código QR para firma de ${SIGNER_LABEL[signer]}`} className="h-28 w-28 rounded-lg bg-white p-1" />
                      )}
                      <div className="min-w-0 flex-1 space-y-2">
                        <p className="text-xs text-white/50">Escanee el QR o comparta el enlace. Vence en 14 días.</p>
                        <div className="flex items-center gap-2">
                          <input
                            readOnly
                            value={state.link}
                            className="dashboard-control h-9 flex-1 truncate rounded-lg border px-2 text-xs"
                            onFocus={(event) => event.currentTarget.select()}
                          />
                          <button
                            type="button"
                            onClick={() => copyLink(state.link!)}
                            className="rounded-lg border border-white/10 px-2 py-1.5 text-xs text-white/70 hover:bg-white/5"
                          >
                            Copiar
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
