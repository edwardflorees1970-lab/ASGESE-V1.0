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

// Detecta columnas nombradas "Grupo - Metrica" (ej. "Inicial - Total") y las
// agrupa para un encabezado de 2 filas. Columnas sueltas (sin " - ") se
// devuelven como su propio grupo con `group: null`, para poder mezclarse
// con columnas agrupadas sin romper todo el encabezado (ej. una columna
// "TOTAL" al inicio, seguida de columnas agrupadas por nivel). Si NINGUNA
// columna usa el formato, devuelve null (encabezado plano de una fila).
export function groupMatrixCols(cols: string[]): { group: string | null; cols: string[] }[] | null {
  if (!cols.length) return null;
  const parsed = cols.map((c) => {
    const idx = c.indexOf(" - ");
    if (idx < 0) return { group: null as string | null, label: c };
    const group = c.slice(0, idx).trim();
    const label = c.slice(idx + 3).trim();
    return group && label ? { group, label } : { group: null as string | null, label: c };
  });
  if (parsed.every((p) => p.group === null)) return null;
  const groups: { group: string | null; cols: string[] }[] = [];
  for (const p of parsed) {
    const last = groups[groups.length - 1];
    if (last && last.group !== null && last.group === p.group) last.cols.push(p.label);
    else groups.push({ group: p.group, cols: [p.label] });
  }
  return groups;
}

// Numeral romano para el titulo de seccion, offset +3 porque Datos
// generales, Datos del informante y la tabla de asistencia (I, II, III)
// vienen del encabezado fijo, no son "secciones" del constructor -- la
// primera seccion real siempre arranca en IV.
const ROMAN_MAP: Array<[number, string]> = [
  [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"],
  [100, "C"], [90, "XC"], [50, "L"], [40, "XL"],
  [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
];
export function sectionRomanNumeral(sectionIndex0: number): string {
  let n = sectionIndex0 + 1 + 3;
  let out = "";
  for (const [value, symbol] of ROMAN_MAP) {
    while (n >= value) {
      out += symbol;
      n -= value;
    }
  }
  return out;
}

function isTotalLabel(label: string) {
  return /^(sub)?total$/i.test(label.trim());
}

// Recalcula las celdas "Total"/"Subtotal" de una fila de tabla_matriz como
// la suma de sus columnas hermanas (dentro del mismo grupo, o -si es una
// columna suelta llamada Total- la suma de los subtotales de cada grupo).
// Devuelve la fila recalculada y el set de indices (posicion plana en
// `cols`) que son de solo lectura porque se auto-calculan.
export function computeMatrixAutoTotals(
  groups: { group: string | null; cols: string[] }[] | null,
  values: any[]
): { next: any[]; totalFlatIndices: Set<number> } {
  const totalFlatIndices = new Set<number>();
  if (!groups) return { next: values, totalFlatIndices };
  const next = [...values];
  const groupStart: number[] = [];
  let idx = 0;
  groups.forEach((g) => {
    groupStart.push(idx);
    idx += g.cols.length;
  });
  const sumFilled = (indices: number[], source: any[]) => {
    let sum = 0;
    let any = false;
    indices.forEach((i) => {
      const raw = source[i];
      if (raw !== undefined && raw !== null && String(raw).trim() !== "") {
        sum += Number(raw) || 0;
        any = true;
      }
    });
    return { sum, any };
  };
  const groupTotalFlat: number[] = [];
  groups.forEach((g, gi) => {
    if (g.group === null) return;
    const totalLocal = g.cols.findIndex(isTotalLabel);
    if (totalLocal < 0) return;
    const totalFlat = groupStart[gi] + totalLocal;
    const siblingIndices = g.cols.map((_l, li) => groupStart[gi] + li).filter((i) => i !== totalFlat);
    const { sum, any } = sumFilled(siblingIndices, values);
    if (any) next[totalFlat] = String(sum);
    totalFlatIndices.add(totalFlat);
    groupTotalFlat.push(totalFlat);
  });
  groups.forEach((g, gi) => {
    if (g.group !== null || g.cols.length !== 1 || !isTotalLabel(g.cols[0])) return;
    const flat = groupStart[gi];
    const addends = groupTotalFlat.length
      ? groupTotalFlat
      : values.map((_v, i) => i).filter((i) => i !== flat);
    const { sum, any } = sumFilled(addends, next);
    if (any) next[flat] = String(sum);
    totalFlatIndices.add(flat);
  });
  return { next, totalFlatIndices };
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
