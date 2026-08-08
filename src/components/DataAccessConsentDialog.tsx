import { useEffect, useState } from "react";
import { ConfirmDialog } from "./ConfirmDialog";
import { EXPORT_NOTICE_VERSION, recordDataHandlingConsent } from "../lib/exportConsent";

type DataAccessConsentDialogProps = {
  open: boolean;
  userName: string;
  onLeave: () => void;
  onAccepted: () => void;
};

export function DataAccessConsentDialog({
  open,
  userName,
  onLeave,
  onAccepted,
}: DataAccessConsentDialogProps) {
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setAccepted(false);
    setError(null);
  }, [open]);

  const confirm = async () => {
    if (!accepted || busy) return;
    setBusy(true);
    setError(null);
    try {
      await recordDataHandlingConsent({
        exportKind: "view",
        resource: "reportes_analiticos",
        context: { access_scope: "view_and_download", route: "/app/reportes-analiticos" },
      });
      onAccepted();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo registrar la aceptación.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <ConfirmDialog
      open={open}
      title="Compromiso de confidencialidad"
      confirmText="Acepto e ingresar"
      cancelText="Salir del módulo"
      busy={busy}
      confirmDisabled={!accepted}
      onClose={() => !busy && onLeave()}
      onConfirm={() => void confirm()}
      description={(
        <div className="export-consent-content data-access-consent">
          <div className="export-consent-summary">
            <span className="data-access-consent-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M12 3 5 6v5c0 4.6 2.8 8 7 10 4.2-2 7-5.4 7-10V6l-7-3Z" />
                <path d="m9 12 2 2 4-4" />
              </svg>
            </span>
            <div>
              <strong>Acceso a información analítica institucional</strong>
              <span>Usuario responsable: {userName}</span>
            </div>
          </div>

          <p>
            Este módulo presenta información consolidada de monitoreos, instituciones, usuarios y resultados.
            Su visualización y descarga están restringidas a fines institucionales autorizados.
          </p>

          <div className="data-access-rules" aria-label="Obligaciones de seguridad">
            <div><span aria-hidden="true">01</span><p>No divulgar capturas, archivos ni resultados a personas no autorizadas.</p></div>
            <div><span aria-hidden="true">02</span><p>Custodiar las exportaciones en dispositivos y medios institucionales seguros.</p></div>
            <div><span aria-hidden="true">03</span><p>Reportar inmediatamente cualquier pérdida, envío incorrecto o acceso indebido.</p></div>
          </div>

          <label className="export-consent-check">
            <input
              type="checkbox"
              checked={accepted}
              onChange={(event) => setAccepted(event.target.checked)}
            />
            <span>
              He leído estas condiciones y asumo responsabilidad por la información que visualice o descargue.
            </span>
          </label>
          <div className="export-consent-policy">Aviso {EXPORT_NOTICE_VERSION} · La aceptación quedará registrada</div>
          {error && <div className="export-consent-error" role="alert">{error}</div>}
        </div>
      )}
    />
  );
}
