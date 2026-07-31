import { supabase } from "./supabaseClient";
import { isMissingRpc } from "./rpcErrors";

export type AtomicAnswer = { question_id: string; value_json: unknown };

type SaveInput = {
  runId: string | null;
  templateId: string;
  status: "borrador" | "draft" | "final";
  isTest: boolean;
  header: Record<string, unknown>;
  footer: Record<string, unknown>;
  answers: AtomicAnswer[];
  duplicateField?: "codigo_local" | "codigo_modular" | null;
};

export async function saveFormRunAtomic(input: SaveInput): Promise<string> {
  const { data, error } = await supabase.rpc("save_form_run_atomic", {
    p_run_id: input.runId,
    p_template_id: input.templateId,
    p_status: input.status,
    p_is_test: input.isTest,
    p_header: input.header,
    p_footer: input.footer,
    p_answers: input.answers,
    p_duplicate_field: input.duplicateField ?? null,
  });
  if (error) {
    if (isMissingRpc(error)) throw new Error("Falta aplicar la migracion 2026-07-31_professional_hardening.sql.");
    throw new Error(error.message);
  }
  if (!data) throw new Error("La operacion atomica no devolvio el identificador del registro.");
  return String(data);
}

export async function deleteFormRunAtomic(runId: string): Promise<void> {
  const { data, error } = await supabase.rpc("delete_form_run_atomic", { p_run_id: runId });
  if (error) {
    if (isMissingRpc(error)) throw new Error("Falta aplicar la migracion 2026-07-31_professional_hardening.sql.");
    throw new Error(error.message);
  }
  if (!data) throw new Error("No se encontro el registro o no pudo eliminarse.");
}

