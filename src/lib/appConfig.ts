import { supabase } from "./supabaseClient";

function parseMode(value: unknown): boolean {
  const raw = String(value ?? "").toLowerCase();
  return raw === "true" || raw === "1" || raw === "si" || raw === "sí";
}

export async function getIsTestMode(): Promise<boolean> {
  const { data, error } = await supabase
    .from("app_config")
    .select("value")
    .eq("key", "modo_test")
    .maybeSingle();

  if (error) {
    console.warn("app_config: no se pudo leer modo_test:", error.message);
    return false;
  }

  return parseMode((data as any)?.value);
}
