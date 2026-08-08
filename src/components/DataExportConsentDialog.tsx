import { useEffect, useState } from "react";
import { ConfirmDialog } from "./ConfirmDialog";
import { EXPORT_NOTICE_VERSION, recordDataExportConsent } from "../lib/exportConsent";

type DataExportConsentDialogProps = {
  open: boolean;
  exportKind: "csv" | "xlsx" | "pdf";
  exportLabel: string;
  exportedBy: string;
  context?: Record<string, unknown>;
  onClose: () => void;
  onAccepted: () => Promise<void> | void;
};

export function DataExportConsentDialog({
  open,
  exportKind,
  exportLabel,
  exportedBy,
  context,
  onClose,
  onAccepted,
}: DataExportConsentDialogProps) {
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setAccepted(false);
    setError(null);
  }, [open, exportKind, exportLabel]);

  const confirm = async () => {
    if (!accepted || busy) return;
    setBusy(true);
    setError(null);
    try {
      await recordDataExportConsent({ exportKind, resource: "reportes_resultados", context });
      await onAccepted();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo autorizar la exportación.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <ConfirmDialog
      open={open}
      title="Uso responsable de la información"
      confirmText="Aceptar y exportar"
      cancelText="Cancelar"
      busy={busy}
      confirmDisabled={!accepted}
      onClose={() => !busy && onClose()}
      onConfirm={() => void confirm()}
      description={(
        <div className="export-consent-content">
          <div className="export-consent-summary">
            <span className="export-consent-shield" aria-hidden="true">✓</span>
            <div>
              <strong>{exportLabel}</strong>
              <span>Solicitado por {exportedBy}</span>
            </div>
          </div>
          <p>
            La información exportada es de uso institucional y puede contener datos reservados. Debe almacenarse,
            compartirse y eliminarse de forma segura, únicamente para fines autorizados por la UGEL 06.
          </p>
          <label className="export-consent-check">
            <input
              type="checkbox"
              checked={accepted}
              onChange={(event) => setAccepted(event.target.checked)}
            />
            <span>Declaro que protegeré la información y asumo responsabilidad por su uso después de descargarla.</span>
          </label>
          <div className="export-consent-policy">Aviso {EXPORT_NOTICE_VERSION}</div>
          {error && <div className="export-consent-error" role="alert">{error}</div>}
        </div>
      )}
    />
  );
}
