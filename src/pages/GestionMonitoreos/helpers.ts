import {
  GESTION_PUBLICA,
  GESTION_PRIVADA,
  GESTION_PUBLICA_DIRECTA,
  GESTION_PUBLICA_PRIVADA,
  NIVELES_BY_MODALIDAD,
  ALL_NIVELES,
} from "./constants";
import type { ExtraFieldCfg } from "./types";

export function normalizeTime24(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

export function normalizeExtraFields(input: any): ExtraFieldCfg[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((item) => {
      if (typeof item === "string") {
        const label = item.trim();
        return label ? ({ label, mode: "registro", default_value: "" } as ExtraFieldCfg) : null;
      }
      if (!item || typeof item !== "object") return null;
      const label = String(item.label ?? "").trim();
      if (!label) return null;
      const mode = item.mode === "elaboracion" ? "elaboracion" : "registro";
      return {
        label,
        mode,
        default_value: item.default_value ?? "",
      } as ExtraFieldCfg;
    })
    .filter(Boolean) as ExtraFieldCfg[];
}

export function groupMatrixCols(cols: string[]): { group: string; cols: string[] }[] | null {
  if (!cols.length) return null;
  const parsed = cols.map((c) => {
    const idx = c.indexOf(" - ");
    if (idx < 0) return null;
    return { group: c.slice(0, idx).trim(), label: c.slice(idx + 3).trim() };
  });
  if (parsed.some((p) => !p || !p.group || !p.label)) return null;
  const groups: { group: string; cols: string[] }[] = [];
  for (const p of parsed as { group: string; label: string }[]) {
    const last = groups[groups.length - 1];
    if (last && last.group === p.group) last.cols.push(p.label);
    else groups.push({ group: p.group, cols: [p.label] });
  }
  return groups;
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export function toDataUrl(img: HTMLImageElement): string {
  const canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  ctx.drawImage(img, 0, 0);
  return canvas.toDataURL("image/png");
}

export function getTimeParts(value: string) {
  const raw = String(value || "");
  const [hourRaw = "", minuteRaw = ""] = raw.split(":");
  const hour = /^\d{1,2}$/.test(hourRaw) ? hourRaw.padStart(2, "0").slice(0, 2) : "";
  const minute = /^\d{1,2}$/.test(minuteRaw) ? minuteRaw.padStart(2, "0").slice(0, 2) : "";
  return { hour, minute };
}

export function statusLabel(status: string) {
  if (status === "pending") return "Pendiente";
  if (status === "approved_lv1") return "Aprobado por jefe";
  if (status === "approved") return "Aprobado";
  if (status === "rejected") return "Rechazado";
  if (status === "inactive") return "Inactivo";
  return status;
}

export function statusTone(status: string) {
  if (status === "approved") return "management-badge is-approved";
  if (status === "approved_lv1") return "management-badge is-review";
  if (status === "rejected") return "management-badge is-rejected";
  if (status === "inactive") return "management-badge is-inactive";
  return "management-badge is-pending";
}

export function normalizeGestionesForDb(values: string[]) {
  const set = new Set(values);
  const out = new Set<string>();
  if (
    set.has(GESTION_PUBLICA) ||
    set.has(GESTION_PUBLICA_DIRECTA) ||
    set.has(GESTION_PUBLICA_PRIVADA)
  ) {
    out.add(GESTION_PUBLICA_DIRECTA);
    out.add(GESTION_PUBLICA_PRIVADA);
  }
  if (set.has(GESTION_PRIVADA)) out.add(GESTION_PRIVADA);
  return Array.from(out);
}

export function toGestionesUi(values: string[]) {
  const set = new Set(values);
  const out = new Set<string>();
  if (set.has(GESTION_PUBLICA_DIRECTA) || set.has(GESTION_PUBLICA_PRIVADA)) {
    out.add(GESTION_PUBLICA);
  }
  if (set.has(GESTION_PUBLICA_DIRECTA)) out.add(GESTION_PUBLICA_DIRECTA);
  if (set.has(GESTION_PUBLICA_PRIVADA)) out.add(GESTION_PUBLICA_PRIVADA);
  if (set.has(GESTION_PRIVADA)) out.add(GESTION_PRIVADA);
  return Array.from(out);
}

export function getNivelesByModalidades(mods: string[]) {
  if (!mods.length) return ALL_NIVELES;
  const set = new Set<string>();
  mods.forEach((m) => (NIVELES_BY_MODALIDAD[m] ?? []).forEach((n) => set.add(n)));
  return Array.from(set);
}

export const toggleValue = (arr: string[], value: string) =>
  arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];

export function toggleGestion(arr: string[], value: string) {
  const set = new Set(arr);
  if (value === GESTION_PUBLICA) {
    if (set.has(GESTION_PUBLICA)) {
      set.delete(GESTION_PUBLICA);
      set.delete(GESTION_PUBLICA_DIRECTA);
      set.delete(GESTION_PUBLICA_PRIVADA);
    } else {
      set.add(GESTION_PUBLICA);
      set.add(GESTION_PUBLICA_DIRECTA);
      set.add(GESTION_PUBLICA_PRIVADA);
    }
    return Array.from(set);
  }
  if (value === GESTION_PUBLICA_DIRECTA || value === GESTION_PUBLICA_PRIVADA) {
    if (set.has(value)) set.delete(value);
    else set.add(value);
    if (set.has(GESTION_PUBLICA_DIRECTA) && set.has(GESTION_PUBLICA_PRIVADA)) {
      set.add(GESTION_PUBLICA);
    } else {
      set.delete(GESTION_PUBLICA);
    }
    return Array.from(set);
  }
  if (set.has(value)) set.delete(value);
  else set.add(value);
  return Array.from(set);
}
