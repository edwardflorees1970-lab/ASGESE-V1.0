import { supabase } from "./supabaseClient";
import { captureTelemetry } from "./telemetry";

export const EXPORT_NOTICE_VERSION = "AGEBRE-DATA-EXPORT-2026-08";

type ExportConsentInput = {
  exportKind: "view" | "csv" | "xlsx" | "pdf";
  resource: string;
  context?: Record<string, unknown>;
};

export async function recordDataHandlingConsent({
  exportKind,
  resource,
  context = {},
}: ExportConsentInput) {
  const { error } = await supabase.rpc("record_data_export_consent", {
    p_export_kind: exportKind,
    p_resource: resource,
    p_policy_version: EXPORT_NOTICE_VERSION,
    p_context: context,
  });

  if (!error) return;

  // Compatibilidad de despliegue: la confirmación visual no bloquea la
  // descarga si el frontend se publica antes que la migración. Mientras tanto,
  // queda una señal de observabilidad asociada al usuario autenticado.
  const pendingViewMigration = exportKind === "view" && /tipo de exportacion invalido/i.test(error.message);
  if (pendingViewMigration || /record_data_export_consent|schema cache|function/i.test(error.message)) {
    await captureTelemetry(
      "data_export_consent",
      `Consentimiento de exportación ${exportKind.toUpperCase()}`,
      "info",
      { source: resource, export_kind: exportKind, policy_version: EXPORT_NOTICE_VERSION, ...context },
    );
    return;
  }

  throw new Error(`No se pudo registrar la aceptación: ${error.message}`);
}

export const recordDataExportConsent = recordDataHandlingConsent;
