export function normalizeInstitutionalCode(value: unknown): string {
  if (typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 99_999_999) {
    return String(value).padStart(8, "0");
  }
  return String(value ?? "").trim();
}

export function isPublicManagement(value: unknown) {
  return String(value ?? "").trim().toLocaleUpperCase("es").normalize("NFD").replace(/\p{Diacritic}/gu, "").includes("PUBLIC");
}
