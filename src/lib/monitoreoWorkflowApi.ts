import { supabase } from "./supabaseClient";
import { isMissingRpc } from "./rpcErrors";

export async function publishMonitoreoSolicitud(solicitudId: string): Promise<string> {
  const { data, error } = await supabase.rpc("publish_monitoreo_solicitud_atomic", {
    p_solicitud_id: solicitudId,
  });
  if (error) {
    if (isMissingRpc(error)) throw new Error("Falta aplicar la migracion 2026-07-31_professional_hardening.sql.");
    throw new Error(error.message);
  }
  return String(data);
}

export async function publishTemplateVersion(templateId: string): Promise<number> {
  const { data, error } = await supabase.rpc("publish_form_template_version", {
    p_template_id: templateId,
  });
  if (error) {
    if (isMissingRpc(error)) throw new Error("Falta aplicar la migracion 2026-07-31_professional_hardening.sql.");
    throw new Error(error.message);
  }
  const row = Array.isArray(data) ? data[0] : data;
  const version = Number((row as { version?: number } | null)?.version);
  if (!Number.isFinite(version)) throw new Error("No se pudo confirmar la version publicada.");
  return version;
}

