export function normalizeRei(value: unknown): string | null {
  const text = String(value ?? "").trim().toLocaleUpperCase("es").replace(/\s+/g, " ");
  if (!text || text === "SIN REI") return "SIN REI";
  if (!/^(?:REI )?(?:0?[1-9]|1[0-9])$/.test(text)) return null;
  return text.replace(/\D/g, "").padStart(2, "0");
}
