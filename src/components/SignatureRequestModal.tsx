import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import QRCode from "qrcode";
import { supabase } from "../lib/supabaseClient";

type Signer = "docente" | "monitor";

type RunLike = { id: string };

type Evidence = {
  status: string;
  signedAt: string | null;
  fotoPath: string | null;
  signerIp: string | null;
  signerUserAgent: string | null;
  deviceId: string | null;
};

type SignerState = {
  loading: boolean;
  evidence: Evidence | null;
  link: string | null;
  qrDataUrl: string | null;
  error: string | null;
};

const SIGNER_LABEL: Record<Signer, string> = {
  docente: "Docente monitoreado",
  monitor: "Monitor",
};

function emptySignerState(): SignerState {
  return { loading: false, evidence: null, link: null, qrDataUrl: null, error: null };
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
      const { data } = await supabase.rpc("list_firma_solicitudes", { p_run_id: run.id });
      if (cancelled) return;
      const rows = (data ?? []) as Array<{
        signer: Signer;
        status: string;
        signed_at: string | null;
        foto_path: string | null;
        signer_ip: string | null;
        signer_user_agent: string | null;
        device_id: string | null;
      }>;
      const latestBySigner: Partial<Record<Signer, (typeof rows)[number]>> = {};
      for (const row of rows) {
        if (row.status !== "firmado") continue;
        const current = latestBySigner[row.signer];
        if (!current || (row.signed_at ?? "") > (current.signed_at ?? "")) {
          latestBySigner[row.signer] = row;
        }
      }
      setSigners((prev) => {
        const next = { ...prev };
        (["docente", "monitor"] as Signer[]).forEach((signer) => {
          const row = latestBySigner[signer];
          next[signer] = {
            ...next[signer],
            evidence: row
              ? {
                  status: row.status,
                  signedAt: row.signed_at,
                  fotoPath: row.foto_path,
                  signerIp: row.signer_ip,
                  signerUserAgent: row.signer_user_agent,
                  deviceId: row.device_id,
                }
              : null,
          };
        });
        return next;
      });
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

  const verFoto = async (fotoPath: string) => {
    const { data } = await supabase.storage.from("monitoreo-firmas").createSignedUrl(fotoPath, 300);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  // Se compara por device_id (aleatorio, guardado en localStorage del
  // navegador que firma), no por IP: docente y monitor firman normalmente
  // desde la misma IE/WiFi, asi que la IP coincide siempre y no sirve como
  // señal de fraude. El device_id sí distingue "mismo celular" de "misma red".
  const crossDeviceWarning = useMemo(() => {
    const d = signers.docente.evidence;
    const m = signers.monitor.evidence;
    if (!d || !m) return false;
    return Boolean(d.deviceId) && d.deviceId === m.deviceId;
  }, [signers]);

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
            {crossDeviceWarning && (
              <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
                ⚠ Ambas firmas se hicieron desde el mismo celular. Revise las fotos de verificación antes de dar por válido el registro.
              </div>
            )}

            {(["docente", "monitor"] as Signer[]).map((signer) => {
              const state = signers[signer];
              const signed = Boolean(state.evidence);
              return (
                <div key={signer} className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-semibold text-white">{SIGNER_LABEL[signer]}</div>
                    {signed && (
                      <span className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-xs text-emerald-100">Firmado</span>
                    )}
                  </div>

                  {signed && state.evidence?.fotoPath && (
                    <button
                      type="button"
                      onClick={() => verFoto(state.evidence!.fotoPath!)}
                      className="mt-2 rounded-lg border border-white/10 px-2 py-1.5 text-xs text-white/70 hover:bg-white/5"
                    >
                      Ver foto de verificación
                    </button>
                  )}

                  {!signed && !state.link && (
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

                  {!signed && state.link && (
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
