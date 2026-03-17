export type HeaderFieldType = "text" | "number" | "select";

export type HeaderFieldDef = {
  id: string;
  key: string;
  label: string;
  type: HeaderFieldType;
  required: boolean;
  options: string[];
  placeholder?: string;
};

export const HEADER_FIELD_TYPE_OPTIONS: Array<{ value: HeaderFieldType; label: string }> = [
  { value: "text", label: "Texto" },
  { value: "number", label: "Numero" },
  { value: "select", label: "Lista" },
];

export const DEFAULT_HEADER_CONFIG = {
  institucion: true,
  codigo_modular: true,
  codigo_local: true,
  distrito: true,
  rei: true,
  monitor: true,
  monitor_doc_tipo: false,
  monitor_numero_doc: false,
  monitoreado: true,
  monitoreado_doc_tipo: false,
  monitoreado_numero_doc: false,
  monitoreado_cargo: false,
  monitoreado_telefono: false,
  monitoreado_correo: false,
  condicion: true,
  area: true,
  numero_visitas: false,
  fecha_aplicacion: false,
  hora_inicio: false,
  hora_fin: false,
  area_options: [] as string[],
  nivel_avance: false,
  nivel_avance_info: [] as Array<{ nivel: number; descripcion: string }>,
  field_order: [] as string[],
  custom_fields: [] as HeaderFieldDef[],
};

function slugifyHeaderKey(input: string) {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function fallbackId() {
  return `hf_${Math.random().toString(36).slice(2, 10)}`;
}

export function createHeaderField(seed?: Partial<HeaderFieldDef>): HeaderFieldDef {
  const label = String(seed?.label ?? "").trim();
  const keyBase = String(seed?.key ?? slugifyHeaderKey(label || "campo"));
  return {
    id: seed?.id || fallbackId(),
    key: keyBase || fallbackId(),
    label: label || "Nuevo campo",
    type: seed?.type === "number" || seed?.type === "select" ? seed.type : "text",
    required: !!seed?.required,
    options: Array.isArray(seed?.options)
      ? seed.options.map((v) => String(v).trim()).filter(Boolean)
      : [],
    placeholder: seed?.placeholder ? String(seed.placeholder) : "",
  };
}

export function normalizeHeaderFields(input: any): HeaderFieldDef[] {
  if (!Array.isArray(input)) return [];
  const usedKeys = new Set<string>();
  return input
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const field = createHeaderField(item);
      let nextKey = field.key || slugifyHeaderKey(field.label);
      if (!nextKey) nextKey = fallbackId();
      while (usedKeys.has(nextKey)) nextKey = `${nextKey}_x`;
      usedKeys.add(nextKey);
      return { ...field, key: nextKey };
    })
    .filter(Boolean) as HeaderFieldDef[];
}

export function normalizeHeaderConfig(input: any) {
  const raw = input && typeof input === "object" ? input : {};
  return {
    ...DEFAULT_HEADER_CONFIG,
    ...raw,
    area_options: Array.isArray(raw.area_options)
      ? raw.area_options.map((v: any) => String(v).trim()).filter(Boolean)
      : [],
    nivel_avance_info: Array.isArray(raw.nivel_avance_info) ? raw.nivel_avance_info : [],
    field_order: Array.isArray(raw.field_order)
      ? raw.field_order.map((v: any) => String(v).trim()).filter(Boolean)
      : [],
    custom_fields: normalizeHeaderFields(raw.custom_fields),
  };
}

export function normalizeCustomHeaderValues(
  defs: HeaderFieldDef[],
  input: any,
): Record<string, string> {
  const source = input && typeof input === "object" ? input : {};
  const next: Record<string, string> = {};
  defs.forEach((field) => {
    const raw = source[field.key];
    next[field.key] = raw == null ? "" : String(raw);
  });
  return next;
}
