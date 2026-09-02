export const GESTION_PUBLICA = "Pública";
export const GESTION_PRIVADA = "Privada";
export const GESTION_PUBLICA_DIRECTA = "Pública de gestión directa";
export const GESTION_PUBLICA_PRIVADA = "Pública de gestión privada";
export const GESTIONES = [GESTION_PUBLICA, GESTION_PRIVADA, GESTION_PUBLICA_DIRECTA, GESTION_PUBLICA_PRIVADA];
export const MODALIDADES = ["EBR", "EBE", "EBA", "PRONOEI"];
export const TIPOS = ["Focalizado", "No focalizado"];
export const DUP_RULE_NONE = "none";
export const DUP_RULE_LOCAL = "codigo_local";
export const DUP_RULE_MODULAR = "codigo_modular";
export const DUP_RULE_MARKER = "__restriccion_duplicado__";
export const NIVELES_BY_MODALIDAD: Record<string, string[]> = {
  EBR: ["Inicial", "Primaria", "Secundaria"],
  EBE: ["Inicial", "Primaria", "Secundaria"],
  EBA: ["Inicial", "Intermedio", "Avanzado"],
  PRONOEI: ["Inicial"],
};
export const ALL_NIVELES = Array.from(new Set(Object.values(NIVELES_BY_MODALIDAD).flat()));

export const QUESTION_TYPES = [
  { value: "yes_no", label: "Sí / No" },
  { value: "yes_no_nivel", label: "Sí / No con niveles" },
  { value: "opciones", label: "Opciones" },
  { value: "texto", label: "Respuesta abierta" },
  { value: "numero", label: "Número" },
  { value: "archivo_pdf", label: "Archivo PDF" },
  { value: "tabla_matriz", label: "Tabla / Matriz numérica" },
];

export const DEFAULT_NIVEL_INFO = [
  { nivel: 1, descripcion: "Bajo" },
  { nivel: 2, descripcion: "Medio" },
  { nivel: 3, descripcion: "Alto" },
];

export const FIXED_HEADER_FIELDS: Array<{ key: string; label: string }> = [
  { key: "institucion", label: "Institución educativa" },
  { key: "codigo_modular", label: "Código modular" },
  { key: "codigo_local", label: "Código local" },
  { key: "distrito", label: "Distrito / lugar" },
  { key: "rei", label: "REI" },
  { key: "monitor", label: "Monitor" },
  { key: "monitor_doc_tipo", label: "Tipo doc. monitor" },
  { key: "monitor_numero_doc", label: "Numero doc. monitor" },
  { key: "monitoreado", label: "Monitoreado" },
  { key: "monitoreado_doc_tipo", label: "Tipo doc. monitoreado" },
  { key: "monitoreado_numero_doc", label: "Numero doc. monitoreado" },
  { key: "monitoreado_cargo", label: "Cargo monitoreado" },
  { key: "monitoreado_telefono", label: "Telefono monitoreado" },
  { key: "monitoreado_correo", label: "Correo monitoreado" },
  { key: "condicion", label: "Condición de monitoreado" },
  { key: "area", label: "Área que monitorea" },
  { key: "numero_visitas", label: "Numero de visitas a la IE" },
  { key: "fecha_aplicacion", label: "Fecha de aplicacion" },
  { key: "hora_inicio", label: "Hora de inicio" },
  { key: "hora_fin", label: "Hora de fin" },
  { key: "nivel_avance", label: "Nivel de avance (Sí)" },
];
