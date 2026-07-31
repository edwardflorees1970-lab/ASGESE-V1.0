import { supabase } from "./supabaseClient";

const BUCKET = "monitoring-evidence";
const MAX_PDF_BYTES = 5 * 1024 * 1024;

export async function validatePdfEvidence(file: File) {
  if (file.type !== "application/pdf" || !file.name.toLowerCase().endsWith(".pdf")) {
    throw new Error("La evidencia debe ser un archivo PDF.");
  }
  if (file.size < 5 || file.size > MAX_PDF_BYTES) {
    throw new Error("El PDF debe pesar entre 1 byte y 5 MB.");
  }
  const signature = new TextDecoder("ascii").decode(await file.slice(0, 5).arrayBuffer());
  if (signature !== "%PDF-") throw new Error("El archivo no contiene una firma PDF valida.");
}

export async function uploadPdfEvidence(runId: string, questionId: string, file: File) {
  await validatePdfEvidence(file);
  const { data: userResult, error: userError } = await supabase.auth.getUser();
  if (userError || !userResult.user) throw new Error("Sesion invalida para subir evidencia.");
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  const sha256 = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  const objectPath = `${userResult.user.id}/${runId}/${questionId}.pdf`;
  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(objectPath, file, {
    contentType: "application/pdf",
    upsert: true,
    cacheControl: "3600",
  });
  if (uploadError) throw new Error(uploadError.message);
  const { error: metadataError } = await supabase.from("form_answer_evidence").upsert({
    run_id: runId,
    question_id: questionId,
    object_path: objectPath,
    original_name: file.name,
    mime_type: "application/pdf",
    size_bytes: file.size,
    sha256,
    uploaded_by: userResult.user.id,
  }, { onConflict: "run_id,question_id" });
  if (metadataError) {
    await supabase.storage.from(BUCKET).remove([objectPath]);
    throw new Error(metadataError.message);
  }
  return { objectPath, sha256 };
}

export async function createEvidenceSignedUrl(objectPath: string, expiresInSeconds = 300) {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(objectPath, expiresInSeconds);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}

