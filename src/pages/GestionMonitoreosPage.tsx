import { useEffect, useMemo, useState } from "react";
import jsPDF from "jspdf";
import logoUrl from "../assets/logoagebresf.png";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../app/AuthProvider";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { isMonitoreoExpired, todayDateOnly } from "../lib/monitoreoVigencia";
import {
  createHeaderField,
  DEFAULT_HEADER_CONFIG,
  HEADER_FIELD_TYPE_OPTIONS,
  normalizeHeaderConfig,
  type HeaderFieldDef,
} from "../lib/dynamicHeader";

const GESTION_PUBLICA = "Pública";
const GESTION_PRIVADA = "Privada";
const GESTION_PUBLICA_DIRECTA = "Pública de gestión directa";
const GESTION_PUBLICA_PRIVADA = "Pública de gestión privada";
const GESTIONES = [GESTION_PUBLICA, GESTION_PRIVADA, GESTION_PUBLICA_DIRECTA, GESTION_PUBLICA_PRIVADA];
const MODALIDADES = ["EBR", "EBE", "EBA", "PRONOEI"];
const TIPOS = ["Focalizado", "No focalizado"];
const DUP_RULE_NONE = "none";
const DUP_RULE_LOCAL = "codigo_local";
const DUP_RULE_MODULAR = "codigo_modular";
const DUP_RULE_MARKER = "__restriccion_duplicado__";
const NIVELES_BY_MODALIDAD: Record<string, string[]> = {
  EBR: ["Inicial", "Primaria", "Secundaria"],
  EBE: ["Inicial", "Primaria", "Secundaria"],
  EBA: ["Inicial", "Intermedio", "Avanzado"],
  PRONOEI: ["Inicial"],
};
const ALL_NIVELES = Array.from(new Set(Object.values(NIVELES_BY_MODALIDAD).flat()));

const QUESTION_TYPES = [
  { value: "yes_no", label: "Sí / No" },
  { value: "yes_no_nivel", label: "Sí / No con niveles" },
  { value: "opciones", label: "Opciones" },
  { value: "texto", label: "Respuesta abierta" },
  { value: "numero", label: "Número" },
  { value: "archivo_pdf", label: "Archivo PDF" },
];

const DEFAULT_NIVEL_INFO = [
  { nivel: 1, descripcion: "Bajo" },
  { nivel: 2, descripcion: "Medio" },
  { nivel: 3, descripcion: "Alto" },
];

const FIXED_HEADER_FIELDS: Array<{ key: string; label: string }> = [
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

type Solicitud = {
  id: string;
  created_by: string;
  nombre: string;
  detalle: string | null;
  fecha_inicio: string;
  fecha_fin: string;
  cdd?: boolean | null;
  status: string;
  motivo_rechazo: string | null;
  approved_lv1_by: string | null;
  approved_by: string | null;
  created_at: string;
};

type Template = {
  id: string;
  solicitud_id: string;
  titulo: string;
  codigo: string;
  subtitulo?: string | null;
  header_config?: any;
  footer_config?: any;
  orden: number;
};

type Question = {
  id: string;
  template_id: string;
  section_id?: string | null;
  tipo: string;
  texto: string;
  orden: number;
  orden_in_section?: number | null;
  required: boolean;
  config_json: any;
};

type Section = {
  id: string;
  template_id: string;
  titulo: string;
  orden: number;
};

type InstitucionLite = {
  id: string;
  nombre: string;
  codigo_modular: string;
  codigo_local: string | null;
};

type DeleteFichaResumen = {
  titulo: string;
  registros: number;
};

type DeleteMonSummary = {
  monitoreoNombre: string;
  monitoreoCodigo: string;
  fichas: DeleteFichaResumen[];
  totalRegistros: number;
  totalAsignacionesMonitor: number;
  totalAsignacionesIe: number;
};

type ExtraFieldCfg = {
  label: string;
  mode: "registro" | "elaboracion";
  default_value?: string | null;
};

function normalizeTime24(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

function normalizeExtraFields(input: any): ExtraFieldCfg[] {
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


function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function toDataUrl(img: HTMLImageElement): string {
  const canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  ctx.drawImage(img, 0, 0);
  return canvas.toDataURL("image/png");
}

function getTimeParts(value: string) {
  const raw = String(value || "");
  const [hourRaw = "", minuteRaw = ""] = raw.split(":");
  const hour = /^\d{1,2}$/.test(hourRaw) ? hourRaw.padStart(2, "0").slice(0, 2) : "";
  const minute = /^\d{1,2}$/.test(minuteRaw) ? minuteRaw.padStart(2, "0").slice(0, 2) : "";
  return { hour, minute };
}

function TimeField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const { hour, minute } = getTimeParts(value);

  const updatePart = (nextHour: string, nextMinute: string) => {
    if (!nextHour && !nextMinute) {
      onChange("");
      return;
    }
    if (nextHour && nextMinute) {
      onChange(`${nextHour}:${nextMinute}`);
      return;
    }
    if (nextHour && !nextMinute) {
      onChange(nextHour);
      return;
    }
    onChange(`${nextHour || "00"}:${nextMinute}`);
  };

  return (
    <div className="relative">
      <div className="relative">
        <input
          type="text"
          inputMode="numeric"
          maxLength={5}
          placeholder="HH:mm"
          className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 pr-11 text-sm"
          value={value}
          onChange={(e) => onChange(normalizeTime24(e.target.value))}
        />
        <button
          type="button"
          aria-label="Seleccionar hora"
          className="absolute inset-y-1 right-1 rounded-md border border-white/10 bg-white/5 px-2 text-sm text-white/80 hover:bg-white/10"
          onClick={() => setOpen((s) => !s)}
        >
          24h
        </button>
      </div>
      {open ? (
        <div className="absolute left-0 right-0 z-20 mt-2 rounded-xl border border-white/10 bg-slate-950 p-3 shadow-2xl">
          <div className="mb-2 flex items-center justify-between text-xs text-white/60">
            <span>Seleccione hora</span>
            <button
              type="button"
              className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-white/80 hover:bg-white/10"
              onClick={() => setOpen(false)}
            >
              Cerrar
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="mb-2 text-xs text-white/60">Hora</div>
              <div className="max-h-40 overflow-y-auto rounded-lg border border-white/10 bg-black/20 p-1">
                {Array.from({ length: 24 }, (_, idx) => String(idx).padStart(2, "0")).map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    className={`mb-1 w-full rounded-md px-3 py-2 text-sm ${
                      hour === opt ? "bg-cyan-500/20 text-cyan-100" : "bg-white/5 text-white/80 hover:bg-white/10"
                    }`}
                    onClick={() => updatePart(opt, minute)}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="mb-2 text-xs text-white/60">Minuto</div>
              <div className="max-h-40 overflow-y-auto rounded-lg border border-white/10 bg-black/20 p-1">
                {Array.from({ length: 60 }, (_, idx) => String(idx).padStart(2, "0")).map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    className={`mb-1 w-full rounded-md px-3 py-2 text-sm ${
                      minute === opt ? "bg-cyan-500/20 text-cyan-100" : "bg-white/5 text-white/80 hover:bg-white/10"
                    }`}
                    onClick={() => updatePart(hour, opt)}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function statusLabel(status: string) {
  if (status === "pending") return "Pendiente";
  if (status === "approved_lv1") return "Aprobado por jefe";
  if (status === "approved") return "Aprobado";
  if (status === "rejected") return "Rechazado";
  if (status === "inactive") return "Inactivo";
  return status;
}

function statusTone(status: string) {
  if (status === "approved") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-100";
  if (status === "approved_lv1") return "border-amber-500/30 bg-amber-500/10 text-amber-100";
  if (status === "rejected") return "border-red-500/30 bg-red-500/10 text-red-100";
  if (status === "inactive") return "border-zinc-400/30 bg-zinc-400/10 text-white/70";
  return "border-white/10 bg-white/5 text-white/80";
}

function normalizeGestionesForDb(values: string[]) {
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

function toGestionesUi(values: string[]) {
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

function getNivelesByModalidades(mods: string[]) {
  if (!mods.length) return ALL_NIVELES;
  const set = new Set<string>();
  mods.forEach((m) => (NIVELES_BY_MODALIDAD[m] ?? []).forEach((n) => set.add(n)));
  return Array.from(set);
}

export function GestionMonitoreosPage() {
  const { profile, user } = useAuth();
  const role = profile?.role ?? "user";
  const canCreate = role !== "user" || !!profile?.can_create_monitoreo;
  const canApproveLv1 = role === "jefe_area" || role === "director" || role === "admin";
  const canReject = role === "jefe_area" || role === "admin";
  const isAdmin = role === "admin";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: "ok" | "err"; msg: string } | null>(null);
  const [deleteMonOpen, setDeleteMonOpen] = useState(false);
  const [deleteMonBusy, setDeleteMonBusy] = useState(false);
  const [rebuildIeBusy, setRebuildIeBusy] = useState(false);
  const [rebuildIeOpen, setRebuildIeOpen] = useState(false);
  const [extendBusy, setExtendBusy] = useState(false);
  const [extendFechaFin, setExtendFechaFin] = useState("");
  const [deleteSummary, setDeleteSummary] = useState<DeleteMonSummary | null>(null);
  const [deleteSummaryBusy, setDeleteSummaryBusy] = useState(false);

  const [items, setItems] = useState<Solicitud[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [nombre, setNombre] = useState("");
  const [detalle, setDetalle] = useState("");
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [isCdd, setIsCdd] = useState(false);
  const [editNombre, setEditNombre] = useState("");
  const [editDetalle, setEditDetalle] = useState("");
  const [editFechaInicio, setEditFechaInicio] = useState("");
  const [editFechaFin, setEditFechaFin] = useState("");
  const [editCdd, setEditCdd] = useState(false);
  const [editGestiones, setEditGestiones] = useState<string[]>([]);
  const [editModalidades, setEditModalidades] = useState<string[]>([]);
  const [editTipos, setEditTipos] = useState<string[]>([]);
  const [editNiveles, setEditNiveles] = useState<string[]>([]);
  const [editDupRule, setEditDupRule] = useState<string>(DUP_RULE_NONE);

  const [gestiones, setGestiones] = useState<string[]>([]);
  const [modalidades, setModalidades] = useState<string[]>([]);
  const [tipos, setTipos] = useState<string[]>([]);
  const [niveles, setNiveles] = useState<string[]>([]);
  const [dupRule, setDupRule] = useState<string>(DUP_RULE_NONE);

  const [ieQuery, setIeQuery] = useState("");
  const [ieResults, setIeResults] = useState<InstitucionLite[]>([]);
  const [ieSelected, setIeSelected] = useState<InstitucionLite[]>([]);
  const [solSearch, setSolSearch] = useState("");
  const [solStatusFilter, setSolStatusFilter] = useState("ALL");
  const [solPage, setSolPage] = useState(1);
  const [solPageSize, setSolPageSize] = useState(10);

  const [templates, setTemplates] = useState<Template[]>([]);
  const [templateTitle, setTemplateTitle] = useState("");
  const [templateCode, setTemplateCode] = useState("");
  const [templateSubtitle, setTemplateSubtitle] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [templateHeader, setTemplateHeader] = useState<any>({});
  const [templateFooter, setTemplateFooter] = useState<any>({});
  const [templateHeaderAreas, setTemplateHeaderAreas] = useState("");
  const [templateHeaderNiveles, setTemplateHeaderNiveles] = useState("");
  const [templateCustomFieldLabel, setTemplateCustomFieldLabel] = useState("");
  const [templateCustomFieldType, setTemplateCustomFieldType] = useState<HeaderFieldDef["type"]>("text");
  const [templateCustomFieldOptions, setTemplateCustomFieldOptions] = useState("");
  const [templateCustomFieldRequired, setTemplateCustomFieldRequired] = useState(false);
  const [editTemplateTitle, setEditTemplateTitle] = useState("");
  const [editTemplateCode, setEditTemplateCode] = useState("");
  const [editTemplateSubtitle, setEditTemplateSubtitle] = useState("");

  const [sections, setSections] = useState<Section[]>([]);
  const [sectionTitle, setSectionTitle] = useState("");
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);

  const [questions, setQuestions] = useState<Question[]>([]);
  const [qTexto, setQTexto] = useState("");
  const [qTipo, setQTipo] = useState("yes_no");
  const [qRequired, setQRequired] = useState(true);
  const [qNiveles, setQNiveles] = useState(3);
  const [qOpciones, setQOpciones] = useState("");
  const [qMulti, setQMulti] = useState(false);
  const [qIncludeObs, setQIncludeObs] = useState(true);
  const [qNivelLabels, setQNivelLabels] = useState<string[]>(["Bajo", "Medio", "Alto"]);
  const [qExtraFields, setQExtraFields] = useState<ExtraFieldCfg[]>([]);
  const [qExtraFieldInput, setQExtraFieldInput] = useState("");
  const [qExtraFieldMode, setQExtraFieldMode] = useState<"registro" | "elaboracion">("registro");
  const [qExtraFieldDefault, setQExtraFieldDefault] = useState("");
  const [showQuestionForm, setShowQuestionForm] = useState(false);
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState<Record<string, any>>({});
  const [showTemplateDetail, setShowTemplateDetail] = useState(true);

  const selected = useMemo(() => items.find((s) => s.id === selectedId) ?? null, [items, selectedId]);
  const selectedExpired = useMemo(
    () => !!selected && selected.status === "approved" && isMonitoreoExpired(selected.fecha_fin),
    [selected]
  );
  const selectedTemplate = useMemo(
    () => templates.find((t) => t.id === selectedTemplateId) ?? null,
    [templates, selectedTemplateId]
  );
  const availableNiveles = useMemo(() => getNivelesByModalidades(modalidades), [modalidades]);
  const editAvailableNiveles = useMemo(
    () => getNivelesByModalidades(editModalidades),
    [editModalidades]
  );
  const filteredSolicitudes = useMemo(() => {
    const term = solSearch.trim().toLowerCase();
    return items.filter((s) => {
      if (solStatusFilter !== "ALL" && s.status !== solStatusFilter) return false;
      if (!term) return true;
      const code = `sol-${s.id.slice(0, 8)}`.toLowerCase();
      const name = (s.nombre || "").toLowerCase();
      return name.includes(term) || code.includes(term);
    });
  }, [items, solSearch, solStatusFilter]);
  const orderedFixedHeaderFields = useMemo(() => {
    const order = Array.isArray(templateHeader?.field_order) ? templateHeader.field_order : [];
    const orderIndex = new Map<string, number>();
    order.forEach((key: string, idx: number) => orderIndex.set(key, idx));
    return [...FIXED_HEADER_FIELDS].sort((a, b) => {
      const ai = orderIndex.has(a.key) ? (orderIndex.get(a.key) as number) : Number.MAX_SAFE_INTEGER;
      const bi = orderIndex.has(b.key) ? (orderIndex.get(b.key) as number) : Number.MAX_SAFE_INTEGER;
      if (ai !== bi) return ai - bi;
      return FIXED_HEADER_FIELDS.findIndex((x) => x.key === a.key) - FIXED_HEADER_FIELDS.findIndex((x) => x.key === b.key);
    });
  }, [templateHeader]);
  const solTotalPages = Math.max(1, Math.ceil(filteredSolicitudes.length / solPageSize));
  const pageSolicitudes = filteredSolicitudes.slice(
    (solPage - 1) * solPageSize,
    solPage * solPageSize
  );
  const canEditSolicitud = useMemo(() => {
    if (!selected) return false;
    if (isAdmin) return true;
    if (selected.created_by === user?.id) return selected.status === "pending" && canCreate;
    return false;
  }, [selected, isAdmin, user?.id, canCreate]);

  const loadSolicitudes = async () => {
    setLoading(true);
  const { data, error } = await supabase
      .from("monitoreo_solicitud")
      .select("id, created_by, nombre, detalle, fecha_inicio, fecha_fin, cdd, status, motivo_rechazo, approved_lv1_by, approved_by, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      setError(error.message);
      setItems([]);
    } else {
      setError(null);
      setItems((data as Solicitud[]) ?? []);
    }
    setLoading(false);
  };

  const loadTemplates = async (solicitudId: string) => {
    const { data } = await supabase
      .from("form_template")
      .select("id, solicitud_id, titulo, codigo, subtitulo, header_config, footer_config, orden")
      .eq("solicitud_id", solicitudId)
      .order("orden", { ascending: true });
    setTemplates((data as Template[]) ?? []);
    if (data && data.length > 0) setSelectedTemplateId((data as Template[])[0].id);
  };

  const loadSections = async (templateId: string) => {
    const { data } = await supabase
      .from("form_section")
      .select("id, template_id, titulo, orden")
      .eq("template_id", templateId)
      .order("orden", { ascending: true });
    const rows = (data as Section[]) ?? [];
    setSections(rows);
    if (rows.length > 0) setSelectedSectionId(rows[0].id);
  };

  const loadQuestions = async (templateId: string) => {
    const { data } = await supabase
      .from("form_question")
      .select("id, template_id, section_id, tipo, texto, orden, orden_in_section, required, config_json")
      .eq("template_id", templateId)
      .order("section_id", { ascending: true })
      .order("orden_in_section", { ascending: true });
    setQuestions((data as Question[]) ?? []);
  };

  useEffect(() => {
    loadSolicitudes();
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    loadTemplates(selectedId);
  }, [selectedId]);

  useEffect(() => {
    if (!selected) return;
    setEditNombre(selected.nombre);
    setEditDetalle(selected.detalle ?? "");
    setEditFechaInicio(selected.fecha_inicio);
    setEditFechaFin(selected.fecha_fin);
    setExtendFechaFin(selected.fecha_fin);
    setEditCdd(!!selected.cdd);
    (async () => {
      const { data } = await supabase
        .from("monitoreo_solicitud_filtro")
        .select("gestion, modalidad, tipo, nivel")
        .eq("solicitud_id", selected.id);
      const rows = (data ?? []) as Array<{
        gestion?: string | null;
        modalidad?: string | null;
        tipo?: string | null;
        nivel?: string | null;
      }>;
      setEditGestiones(
        toGestionesUi(Array.from(new Set(rows.map((r) => r.gestion).filter(Boolean))) as string[])
      );
      const modalidadesRaw = Array.from(new Set(rows.map((r) => r.modalidad).filter(Boolean))) as string[];
      setEditModalidades(modalidadesRaw.filter((m) => MODALIDADES.includes(m)));
      const tiposRaw = Array.from(new Set(rows.map((r) => r.tipo).filter(Boolean))) as string[];
      setEditTipos(tiposRaw.filter((t) => TIPOS.includes(t)));
      setEditNiveles(Array.from(new Set(rows.map((r) => r.nivel).filter(Boolean))) as string[]);
      const dupMeta = rows.find((r) => r.tipo === DUP_RULE_MARKER);
      const dupVal = dupMeta?.modalidad ?? DUP_RULE_NONE;
      setEditDupRule(
        dupVal === DUP_RULE_LOCAL || dupVal === DUP_RULE_MODULAR ? dupVal : DUP_RULE_NONE
      );
    })();
  }, [selected]);

  useEffect(() => {
    setNiveles((v) => v.filter((n) => availableNiveles.includes(n)));
  }, [availableNiveles]);

  useEffect(() => {
    setEditNiveles((v) => v.filter((n) => editAvailableNiveles.includes(n)));
  }, [editAvailableNiveles]);

  useEffect(() => {
    if (!selectedTemplateId) return;
    loadQuestions(selectedTemplateId);
    loadSections(selectedTemplateId);
  }, [selectedTemplateId]);

  useEffect(() => {
    if (!selectedTemplate) return;
    const defaultFooter = {
      observacion: true,
      compromiso: true,
      lugar: true,
      fecha: true,
      docente_nombre: true,
      docente_dni: true,
      monitor_nombre: true,
      monitor_dni: true,
      firmas: true,
    };
    const header = normalizeHeaderConfig(selectedTemplate.header_config ?? DEFAULT_HEADER_CONFIG);
    const footer = selectedTemplate.footer_config ?? defaultFooter;
    setTemplateHeader(header);
    setTemplateFooter(footer);
    setTemplateHeaderAreas((header.area_options ?? []).join("\n"));
    setTemplateHeaderNiveles(
      (header.nivel_avance_info ?? [])
        .map((x: any) => `${x.nivel} | ${x.descripcion ?? ""}`.trim())
        .join("\n")
    );
    setEditTemplateTitle(selectedTemplate.titulo);
    setEditTemplateCode(selectedTemplate.codigo);
    setEditTemplateSubtitle(selectedTemplate.subtitulo ?? "");
    setShowTemplateDetail(true);
  }, [selectedTemplate]);

  useEffect(() => {
    if (!ieQuery.trim()) {
      setIeResults([]);
      return;
    }
    const handle = setTimeout(async () => {
      const q = ieQuery.trim();
      const { data } = await supabase
        .from("institucion_educativa")
        .select("id, nombre, codigo_modular, codigo_local")
        .or(`nombre.ilike.%${q}%,codigo_modular.ilike.%${q}%`)
        .limit(20);
      setIeResults((data as InstitucionLite[]) ?? []);
    }, 300);
    return () => clearTimeout(handle);
  }, [ieQuery]);

  const resetForm = () => {
    setNombre("");
    setDetalle("");
    setFechaInicio("");
    setFechaFin("");
    setIsCdd(false);
    setGestiones([]);
    setModalidades([]);
    setTipos([]);
    setNiveles([]);
    setDupRule(DUP_RULE_NONE);
    setIeSelected([]);
  };

  const updateSolicitud = async () => {
    if (!selected || !isAdmin) return;
    setSaving(true);
    setError(null);
    const { error } = await supabase
      .from("monitoreo_solicitud")
      .update({
        nombre: editNombre,
        detalle: editDetalle,
        fecha_inicio: editFechaInicio,
        fecha_fin: editFechaFin,
        cdd: editCdd,
      })
      .eq("id", selected.id);
    if (error) {
      setError(error.message);
    } else {
      const { error: delErr } = await supabase
        .from("monitoreo_solicitud_filtro")
        .delete()
        .eq("solicitud_id", selected.id);
      if (delErr) {
        setError(delErr.message);
        setSaving(false);
        return;
      }
      const rows: any[] = [];
      normalizeGestionesForDb(editGestiones).forEach((g) =>
        rows.push({ solicitud_id: selected.id, gestion: g })
      );
      editModalidades.forEach((m) => rows.push({ solicitud_id: selected.id, modalidad: m }));
      editTipos.forEach((t) => rows.push({ solicitud_id: selected.id, tipo: t }));
      editNiveles.forEach((n) => rows.push({ solicitud_id: selected.id, nivel: n }));
      if (editDupRule !== DUP_RULE_NONE) {
        rows.push({
          solicitud_id: selected.id,
          tipo: DUP_RULE_MARKER,
          modalidad: editDupRule,
        });
      }
      if (rows.length) {
        const { error: insErr } = await supabase.from("monitoreo_solicitud_filtro").insert(rows);
        if (insErr) {
          setError(insErr.message);
          setSaving(false);
          return;
        }
      }
      await loadSolicitudes();
      setToast({ type: "ok", msg: "Solicitud actualizada." });
    }
    setSaving(false);
  };

  const toggleValue = (arr: string[], value: string) =>
    arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];

  const toggleGestion = (arr: string[], value: string) => {
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
  };

  const submitSolicitud = async () => {
    if (!canCreate) return;
    if (!user?.id) {
      setError("No hay sesión activa. Vuelve a iniciar sesión.");
      return;
    }
    setSaving(true);
    setError(null);

    const { data, error } = await supabase
      .from("monitoreo_solicitud")
      .insert({
        created_by: user.id,
        nombre,
        detalle,
        fecha_inicio: fechaInicio,
        fecha_fin: fechaFin,
        cdd: isCdd,
        status: "pending",
      })
      .select("id")
      .maybeSingle();

    if (error) {
      setSaving(false);
      setError(error.message);
      return;
    }

    const solicitudId = (data as any)?.id as string;

    if (gestiones.length || modalidades.length || tipos.length || niveles.length) {
      const rows: any[] = [];
      normalizeGestionesForDb(gestiones).forEach((g) =>
        rows.push({ solicitud_id: solicitudId, gestion: g })
      );
      modalidades.forEach((m) => rows.push({ solicitud_id: solicitudId, modalidad: m }));
      tipos.forEach((t) => rows.push({ solicitud_id: solicitudId, tipo: t }));
      niveles.forEach((n) => rows.push({ solicitud_id: solicitudId, nivel: n }));
      if (dupRule !== DUP_RULE_NONE) {
        rows.push({
          solicitud_id: solicitudId,
          tipo: DUP_RULE_MARKER,
          modalidad: dupRule,
        });
      }
      if (rows.length) await supabase.from("monitoreo_solicitud_filtro").insert(rows);
    }

    if (ieSelected.length) {
      await supabase
        .from("monitoreo_solicitud_ie")
        .insert(ieSelected.map((ie) => ({ solicitud_id: solicitudId, institucion_id: ie.id })));
    }

    resetForm();
    await loadSolicitudes();
    setSelectedId(solicitudId);
    setSaving(false);
  };

  const approveLv1 = async (solicitudId: string) => {
    await supabase
      .from("monitoreo_solicitud")
      .update({
        status: "approved_lv1",
        approved_lv1_by: user?.id ?? null,
        approved_lv1_at: new Date().toISOString(),
      })
      .eq("id", solicitudId);
    loadSolicitudes();
  };

  const approveFinal = async (solicitudId: string) => {
    await supabase
      .from("monitoreo_solicitud")
      .update({
        status: "approved",
        approved_by: user?.id ?? null,
        approved_at: new Date().toISOString(),
      })
      .eq("id", solicitudId);

    try {
      const { data: sol } = await supabase
        .from("monitoreo_solicitud")
        .select("id, nombre, detalle, fecha_inicio, fecha_fin")
        .eq("id", solicitudId)
        .maybeSingle();
      if (sol) {
        const anio = sol.fecha_inicio ? new Date(sol.fecha_inicio).getFullYear() : new Date().getFullYear();
        const codigo = `SOL-${solicitudId.slice(0, 8).toUpperCase()}`;
        const { data: mon } = await supabase
          .from("monitoreo_catalog")
          .select("id, solicitud_id")
          .eq("codigo", codigo)
          .maybeSingle();
        let monitoreoId = mon?.id as string | undefined;
        if (!monitoreoId) {
          const { data: inserted, error: insErr } = await supabase
            .from("monitoreo_catalog")
            .insert({
              anio,
              codigo,
              nombre: sol.nombre,
              descripcion: sol.detalle ?? null,
              is_active: true,
              fecha_inicio: sol.fecha_inicio,
              fecha_fin: sol.fecha_fin,
              solicitud_id: solicitudId,
            })
            .select("id")
            .single();
          if (insErr) throw new Error(insErr.message);
          monitoreoId = inserted.id;
        } else if (!mon?.solicitud_id) {
          await supabase
            .from("monitoreo_catalog")
            .update({ solicitud_id: solicitudId })
            .eq("id", monitoreoId);
        }

        const { data: tpls, error: tplErr } = await supabase
          .from("form_template")
          .select("id, titulo, codigo, orden")
          .eq("solicitud_id", solicitudId)
          .order("orden", { ascending: true });
        if (tplErr) throw new Error(tplErr.message);
        const rows =
          (tpls ?? []).map((t: any) => ({
            monitoreo_id: monitoreoId,
            codigo: t.codigo,
            titulo: t.titulo,
            version: 1,
            orden: t.orden ?? 1,
            is_active: true,
            form_template_id: t.id,
          })) || [];
        if (rows.length) {
          await supabase.from("ficha_catalog").insert(rows);
        }

        // Poblar IE por filtros si no hay focalizadas guardadas
        const { count: ieCount } = await supabase
          .from("monitoreo_solicitud_ie")
          .select("id", { count: "exact", head: true })
          .eq("solicitud_id", solicitudId);
        if (!ieCount || ieCount === 0) {
          const { error: popErr } = await supabase.rpc("populate_solicitud_ie", {
            p_solicitud_id: solicitudId,
          });
          if (popErr) throw new Error(popErr.message);
        }
      }
    } catch (e: any) {
      setError(e?.message || "No se pudo publicar la solicitud.");
    }

    if (selectedTemplateId) {
      localStorage.removeItem(`preview:${solicitudId}:${selectedTemplateId}`);
    }
    loadSolicitudes();
  };

  const rejectSolicitud = async (solicitudId: string) => {
    const reason = window.prompt("Motivo de rechazo:")?.trim();
    if (!reason) return;
    await supabase
      .from("monitoreo_solicitud")
      .update({ status: "rejected", motivo_rechazo: reason })
      .eq("id", solicitudId);
    loadSolicitudes();
  };

  const inactivateMonitoreo = async (solicitudId: string) => {
    const { data: mon, error: monErr } = await supabase
      .from("monitoreo_catalog")
      .select("id")
      .eq("solicitud_id", solicitudId)
      .maybeSingle();
    if (monErr) {
      setError(monErr.message);
      return;
    }
    if (mon?.id) {
      const { error: updErr } = await supabase
        .from("monitoreo_catalog")
        .update({ is_active: false })
        .eq("id", mon.id);
      if (updErr) {
        setError(updErr.message);
        return;
      }
    }
    await supabase
      .from("monitoreo_solicitud")
      .update({ status: "inactive", inactive_at: new Date().toISOString() })
      .eq("id", solicitudId);
    loadSolicitudes();
  };

  const reactivateMonitoreo = async (solicitudId: string) => {
    const { error: solErr } = await supabase
      .from("monitoreo_solicitud")
      .update({ status: "approved", inactive_at: null, updated_at: new Date().toISOString() })
      .eq("id", solicitudId);
    if (solErr) {
      setToast({ type: "err", msg: solErr.message });
      return;
    }
    const { error: monErr } = await supabase
      .from("monitoreo_catalog")
      .update({ is_active: true, updated_at: new Date().toISOString() })
      .eq("solicitud_id", solicitudId);
    if (monErr) {
      setToast({ type: "err", msg: monErr.message });
      return;
    }
    setToast({ type: "ok", msg: "Monitoreo reactivado." });
    await loadSolicitudes();
  };

  const extendMonitoreo = async (solicitudId: string) => {
    if (!extendFechaFin) {
      setToast({ type: "err", msg: "Selecciona una nueva fecha fin." });
      return;
    }
    if (extendFechaFin <= todayDateOnly()) {
      setToast({ type: "err", msg: "La ampliacion debe ser mayor a la fecha actual." });
      return;
    }
    setExtendBusy(true);
    const { error: solErr } = await supabase
      .from("monitoreo_solicitud")
      .update({ fecha_fin: extendFechaFin, updated_at: new Date().toISOString() })
      .eq("id", solicitudId);
    if (solErr) {
      setToast({ type: "err", msg: solErr.message });
      setExtendBusy(false);
      return;
    }
    const { error: monErr } = await supabase
      .from("monitoreo_catalog")
      .update({ fecha_fin: extendFechaFin, is_active: true, updated_at: new Date().toISOString() })
      .eq("solicitud_id", solicitudId);
    if (monErr) {
      setToast({ type: "err", msg: monErr.message });
      setExtendBusy(false);
      return;
    }
    setToast({ type: "ok", msg: "Monitoreo ampliado correctamente." });
    await loadSolicitudes();
    setExtendBusy(false);
  };

  const deleteMonitoreoFull = async (solicitudId: string) => {
    setDeleteMonBusy(true);
    setError(null);
    let solicitudDeleted = false;
    const { data: mon, error: monErr } = await supabase
      .from("monitoreo_catalog")
      .select("id,nombre,codigo")
      .eq("solicitud_id", solicitudId)
      .maybeSingle();
    if (monErr) {
      setError(monErr.message);
      setDeleteMonBusy(false);
      return;
    }
    if (!mon?.id) {
      const delErr = await deleteSolicitudCascade(solicitudId);
      if (delErr) {
        setError(delErr.message);
      } else {
        setToast({ type: "ok", msg: "Se eliminó la solicitud que había quedado suelta." });
        removeSolicitudFromState(solicitudId);
        await loadSolicitudes();
        setDeleteMonOpen(false);
      }
      setDeleteMonBusy(false);
      return;
    }
    const { error } = await supabase.rpc("delete_monitoreo_full", {
      p_monitoreo_id: mon.id,
    });
    if (error) {
      const shouldFallback =
        error.message.includes("Could not find the function public.delete_monitoreo_full") ||
        error.message.includes("violates foreign key constraint");

      if (shouldFallback) {
        const { data: tpls, error: tplErr } = await supabase
          .from("form_template")
          .select("id")
          .eq("solicitud_id", solicitudId);
        if (tplErr) {
          setError(tplErr.message);
          setDeleteMonBusy(false);
          return;
        }

        const templateIds = (tpls ?? []).map((row) => row.id as string);

        const runIds: string[] = [];
        const questionIds: string[] = [];
        if (templateIds.length > 0) {
          const [{ data: runs, error: runErr }, { data: questions, error: qErr }] = await Promise.all([
            supabase.from("form_run").select("id").in("template_id", templateIds),
            supabase.from("form_question").select("id").in("template_id", templateIds),
          ]);
          if (runErr) {
            setError(runErr.message);
            setDeleteMonBusy(false);
            return;
          }
          if (qErr) {
            setError(qErr.message);
            setDeleteMonBusy(false);
            return;
          }
          runIds.push(...(runs ?? []).map((row) => row.id as string));
          questionIds.push(...(questions ?? []).map((row) => row.id as string));
        }

        const deleteIfAny = async (
          table: string,
          column: string,
          values: string[],
        ) => {
          if (values.length === 0) return null;
          const { error: delErr } = await supabase.from(table).delete().in(column, values);
          return delErr;
        };

        const steps: Array<() => Promise<{ message: string } | null>> = [
          async () => {
            const delErr = await deleteIfAny("form_answer", "run_id", runIds);
            return delErr ? { message: delErr.message } : null;
          },
          async () => {
            const delErr = await deleteIfAny("form_answer", "question_id", questionIds);
            return delErr ? { message: delErr.message } : null;
          },
          async () => {
            const delErr = await deleteIfAny("form_run", "id", runIds);
            return delErr ? { message: delErr.message } : null;
          },
          async () => {
            const delErr = await deleteIfAny("form_question", "id", questionIds);
            return delErr ? { message: delErr.message } : null;
          },
          async () => {
            const delErr = await deleteIfAny("form_section", "template_id", templateIds);
            return delErr ? { message: delErr.message } : null;
          },
          async () => {
            const { error: delErr } = await supabase
              .from("ficha_catalog")
              .delete()
              .eq("monitoreo_id", mon.id);
            return delErr ? { message: delErr.message } : null;
          },
          async () => {
            const delErr = await deleteIfAny("form_template", "id", templateIds);
            return delErr ? { message: delErr.message } : null;
          },
          async () => {
            const { error: delErr } = await supabase
              .from("monitoreo_ie_validacion")
              .delete()
              .eq("monitoreo_id", mon.id);
            return delErr ? { message: delErr.message } : null;
          },
          async () => {
            const { error: delErr } = await supabase
              .from("monitoreo_ie_avance")
              .delete()
              .eq("monitoreo_id", mon.id);
            return delErr ? { message: delErr.message } : null;
          },
          async () => {
            const { error: delErr } = await supabase
              .from("monitoreo_ie_asignacion")
              .delete()
              .eq("monitoreo_id", mon.id);
            return delErr ? { message: delErr.message } : null;
          },
          async () => {
            const { error: delErr } = await supabase
              .from("monitoreo_asignacion")
              .delete()
              .eq("monitoreo_id", mon.id);
            return delErr ? { message: delErr.message } : null;
          },
          async () => {
            const { error: delErr } = await supabase
              .from("monitoreo_actividad_extra")
              .delete()
              .eq("monitoreo_id", mon.id);
            return delErr ? { message: delErr.message } : null;
          },
          async () => {
            const { error: delErr } = await supabase
              .from("monitoreo_actividad")
              .delete()
              .eq("monitoreo_id", mon.id);
            return delErr ? { message: delErr.message } : null;
          },
          async () => {
            const { error: updErr } = await supabase
              .from("monitoreo_catalog")
              .update({ solicitud_id: null })
              .eq("id", mon.id);
            return updErr ? { message: updErr.message } : null;
          },
          async () => {
            const { error: delErr } = await supabase.from("monitoreo_catalog").delete().eq("id", mon.id);
            return delErr ? { message: delErr.message } : null;
          },
          async () => {
            const { error: delErr } = await supabase
              .from("monitoreo_solicitud_ie")
              .delete()
              .eq("solicitud_id", solicitudId);
            return delErr ? { message: delErr.message } : null;
          },
          async () => {
            const { error: delErr } = await supabase
              .from("monitoreo_solicitud_filtro")
              .delete()
              .eq("solicitud_id", solicitudId);
            return delErr ? { message: delErr.message } : null;
          },
          async () => {
            const { error: delErr } = await supabase
              .from("monitoreo_solicitud")
              .delete()
              .eq("id", solicitudId);
            return delErr ? { message: delErr.message } : null;
          },
        ];

        for (const step of steps) {
          const stepError = await step();
          if (stepError) {
            setError(stepError.message);
            setDeleteMonBusy(false);
            return;
          }
        }
        solicitudDeleted = true;
      } else {
        setError(error.message);
        setDeleteMonBusy(false);
        return;
      }
    }
    if (!solicitudDeleted) {
      const delErr = await deleteSolicitudCascade(solicitudId);
      if (delErr) {
        setError(delErr.message);
        setDeleteMonBusy(false);
        return;
      }
    }
    setToast({
      type: "ok",
      msg: `Monitoreo ${mon.codigo} eliminado con toda su información relacionada.`,
    });
    removeSolicitudFromState(solicitudId);
    await loadSolicitudes();
    setDeleteMonBusy(false);
    setDeleteMonOpen(false);
  };

  const openDeleteMonitoreoDialog = async (solicitudId: string) => {
    setDeleteMonOpen(true);
    setDeleteSummary(null);
    setDeleteSummaryBusy(true);

    try {
      const { data: mon, error: monErr } = await supabase
        .from("monitoreo_catalog")
        .select("id, nombre, codigo")
        .eq("solicitud_id", solicitudId)
        .maybeSingle();
      if (monErr || !mon?.id) {
        setDeleteSummaryBusy(false);
        return;
      }

      const { data: tpls } = await supabase
        .from("form_template")
        .select("id, titulo")
        .eq("solicitud_id", solicitudId)
        .order("orden", { ascending: true });
      const tplRows = (tpls ?? []) as Array<{ id: string; titulo: string }>;
      const templateIds = tplRows.map((t) => t.id);

      let fichaResumen: DeleteFichaResumen[] = tplRows.map((t) => ({ titulo: t.titulo, registros: 0 }));
      let totalRegistros = 0;
      if (templateIds.length) {
        const { data: runs } = await supabase
          .from("form_run")
          .select("template_id")
          .in("template_id", templateIds);
        const runRows = (runs ?? []) as Array<{ template_id: string }>;
        totalRegistros = runRows.length;
        const byTemplate: Record<string, number> = {};
        runRows.forEach((r) => {
          byTemplate[r.template_id] = (byTemplate[r.template_id] ?? 0) + 1;
        });
        fichaResumen = tplRows.map((t) => ({
          titulo: t.titulo,
          registros: byTemplate[t.id] ?? 0,
        }));
      }

      const [{ count: asigMonCount }, { count: asigIeCount }] = await Promise.all([
        supabase
          .from("monitoreo_asignacion")
          .select("id", { count: "exact", head: true })
          .eq("monitoreo_id", mon.id),
        supabase
          .from("monitoreo_ie_asignacion")
          .select("id", { count: "exact", head: true })
          .eq("monitoreo_id", mon.id),
      ]);

      setDeleteSummary({
        monitoreoNombre: mon.nombre,
        monitoreoCodigo: mon.codigo,
        fichas: fichaResumen,
        totalRegistros,
        totalAsignacionesMonitor: asigMonCount ?? 0,
        totalAsignacionesIe: asigIeCount ?? 0,
      });
    } finally {
      setDeleteSummaryBusy(false);
    }
  };

  const rebuildIeFromFilters = async (solicitudId: string) => {
    setRebuildIeBusy(true);
    const { error: delErr } = await supabase
      .from("monitoreo_solicitud_ie")
      .delete()
      .eq("solicitud_id", solicitudId);
    if (delErr) {
      setToast({ type: "err", msg: delErr.message });
      setRebuildIeBusy(false);
      return;
    }
    const { error: popErr } = await supabase.rpc("populate_solicitud_ie", {
      p_solicitud_id: solicitudId,
    });
    if (popErr) {
      setToast({ type: "err", msg: popErr.message });
      setRebuildIeBusy(false);
      return;
    }
    setToast({ type: "ok", msg: "IE regeneradas por filtros." });
    setRebuildIeBusy(false);
    setRebuildIeOpen(false);
  };

  const deleteSolicitudCascade = async (solicitudId: string) => {
    const { data: tpls, error: tplErr } = await supabase
      .from("form_template")
      .select("id")
      .eq("solicitud_id", solicitudId);
    if (tplErr) return tplErr;

    const templateIds = (tpls ?? []).map((row) => row.id as string);
    if (templateIds.length > 0) {
      const [{ data: runs, error: runErr }, { data: questions, error: qErr }] = await Promise.all([
        supabase.from("form_run").select("id").in("template_id", templateIds),
        supabase.from("form_question").select("id").in("template_id", templateIds),
      ]);
      if (runErr) return runErr;
      if (qErr) return qErr;

      const runIds = (runs ?? []).map((row) => row.id as string);
      const questionIds = (questions ?? []).map((row) => row.id as string);

      if (runIds.length > 0) {
        const { error: delAnsRunErr } = await supabase.from("form_answer").delete().in("run_id", runIds);
        if (delAnsRunErr) return delAnsRunErr;
      }
      if (questionIds.length > 0) {
        const { error: delAnsQuestionErr } = await supabase
          .from("form_answer")
          .delete()
          .in("question_id", questionIds);
        if (delAnsQuestionErr) return delAnsQuestionErr;
      }
      const { error: delRunErr } = await supabase.from("form_run").delete().in("template_id", templateIds);
      if (delRunErr) return delRunErr;

      const { error: delFichaErr } = await supabase
        .from("ficha_catalog")
        .delete()
        .in("form_template_id", templateIds);
      if (delFichaErr) return delFichaErr;

      const { error: delQuestionErr } = await supabase
        .from("form_question")
        .delete()
        .in("template_id", templateIds);
      if (delQuestionErr) return delQuestionErr;

      const { error: delSectionErr } = await supabase
        .from("form_section")
        .delete()
        .in("template_id", templateIds);
      if (delSectionErr) return delSectionErr;

      const { error: delTemplateErr } = await supabase.from("form_template").delete().in("id", templateIds);
      if (delTemplateErr) return delTemplateErr;
    }

    const { error: delIeErr } = await supabase
      .from("monitoreo_solicitud_ie")
      .delete()
      .eq("solicitud_id", solicitudId);
    if (delIeErr) return delIeErr;

    const { error: delFiltroErr } = await supabase
      .from("monitoreo_solicitud_filtro")
      .delete()
      .eq("solicitud_id", solicitudId);
    if (delFiltroErr) return delFiltroErr;

    const { error: delSolErr } = await supabase
      .from("monitoreo_solicitud")
      .delete()
      .eq("id", solicitudId);
    if (delSolErr) return delSolErr;

    const { data: stillExists, error: verifyErr } = await supabase
      .from("monitoreo_solicitud")
      .select("id")
      .eq("id", solicitudId)
      .maybeSingle();
    if (verifyErr) return verifyErr;
    if (stillExists?.id) {
      return {
        message:
          "La solicitud sigue existiendo en la base de datos. El front ya intentó borrarla, pero Supabase la bloqueó o no aplicó el DELETE. Revisa la policy DELETE de monitoreo_solicitud.",
      };
    }

    return null;
  };

  const removeSolicitudFromState = (solicitudId: string) => {
    setItems((prev) => prev.filter((item) => item.id !== solicitudId));
    if (selectedId === solicitudId) setSelectedId(null);
  };

  const deleteSolicitud = async (solicitudId: string) => {
    if (!window.confirm("¿Eliminar la solicitud?")) return;
    const { data: linkedMonitoreo, error: monErr } = await supabase
      .from("monitoreo_catalog")
      .select("id,nombre,codigo")
      .eq("solicitud_id", solicitudId)
      .maybeSingle();
    if (monErr) {
      setToast({ type: "err", msg: monErr.message });
      return;
    }
    if (linkedMonitoreo) {
      setToast({
        type: "err",
        msg: `La solicitud ya tiene un monitoreo publicado (${linkedMonitoreo.codigo} - ${linkedMonitoreo.nombre}). Elimínalo con "Eliminar monitoreo".`,
      });
      return;
    }

    const error = await deleteSolicitudCascade(solicitudId);
    if (error) {
      setToast({ type: "err", msg: error.message });
      return;
    }
    setToast({ type: "ok", msg: "Solicitud eliminada." });
    removeSolicitudFromState(solicitudId);
    await loadSolicitudes();
  };

  const addTemplate = async () => {
    if (!selectedId || !templateTitle.trim()) return;
    const code = templateCode.trim() || `F${templates.length + 1}`;
    await supabase.from("form_template").insert({
      solicitud_id: selectedId,
      titulo: templateTitle.trim(),
      codigo: code,
      subtitulo: templateSubtitle.trim() || null,
      header_config: DEFAULT_HEADER_CONFIG,
      footer_config: {
        observacion: true,
        compromiso: true,
        lugar: true,
        fecha: true,
        docente_nombre: true,
        docente_dni: true,
        monitor_nombre: true,
        monitor_dni: true,
        firmas: true,
      },
      orden: templates.length + 1,
    });
    setTemplateTitle("");
    setTemplateCode("");
    setTemplateSubtitle("");
    loadTemplates(selectedId);
  };

  const buildHeaderConfig = () => {
    let nivelInfo = (templateHeaderNiveles ?? "")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [left, ...rest] = line.split("|").map((v) => v.trim());
        const num = Number(left.replace(/[^\d]/g, ""));
        const desc = rest.join(" | ").trim() || left.replace(/[0-9.-]/g, "").trim();
        return Number.isFinite(num)
          ? { nivel: num, descripcion: desc || `Nivel ${num}` }
          : { nivel: 0, descripcion: line };
      })
      .filter((x) => x.descripcion);
    if (templateHeader.nivel_avance && nivelInfo.length === 0) {
      nivelInfo = DEFAULT_NIVEL_INFO;
    }
    return normalizeHeaderConfig({
      ...templateHeader,
      area_options: templateHeaderAreas
        .split("\n")
        .map((v) => v.trim())
        .filter(Boolean),
      nivel_avance_info: nivelInfo,
      custom_fields: templateHeader.custom_fields ?? [],
    });
  };

  const addTemplateCustomField = () => {
    const label = templateCustomFieldLabel.trim();
    if (!label) {
      setToast({ type: "err", msg: "Ingresa el nombre del campo de encabezado." });
      return;
    }
    const field = createHeaderField({
      label,
      type: templateCustomFieldType,
      required: templateCustomFieldRequired,
      options:
        templateCustomFieldType === "select"
          ? templateCustomFieldOptions
              .split("\n")
              .map((v) => v.trim())
              .filter(Boolean)
          : [],
    });
    setTemplateHeader((prev: any) =>
      normalizeHeaderConfig({
        ...prev,
        custom_fields: [...(prev?.custom_fields ?? []), field],
      })
    );
    setTemplateCustomFieldLabel("");
    setTemplateCustomFieldType("text");
    setTemplateCustomFieldOptions("");
    setTemplateCustomFieldRequired(false);
  };

  const patchTemplateCustomField = (fieldId: string, patch: Partial<HeaderFieldDef>) => {
    setTemplateHeader((prev: any) =>
      normalizeHeaderConfig({
        ...prev,
        custom_fields: (prev?.custom_fields ?? []).map((field: HeaderFieldDef) =>
          field.id === fieldId ? { ...field, ...patch } : field
        ),
      })
    );
  };

  const removeTemplateCustomField = (fieldId: string) => {
    setTemplateHeader((prev: any) =>
      normalizeHeaderConfig({
        ...prev,
        custom_fields: (prev?.custom_fields ?? []).filter((field: HeaderFieldDef) => field.id !== fieldId),
      })
    );
  };

  const moveTemplateCustomField = (fieldId: string, direction: -1 | 1) => {
    setTemplateHeader((prev: any) => {
      const list = [...(prev?.custom_fields ?? [])];
      const index = list.findIndex((field: HeaderFieldDef) => field.id === fieldId);
      if (index < 0) return prev;
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= list.length) return prev;
      const temp = list[index];
      list[index] = list[nextIndex];
      list[nextIndex] = temp;
      return normalizeHeaderConfig({
        ...prev,
        custom_fields: list,
      });
    });
  };

  const moveFixedHeaderField = (fieldKey: string, direction: -1 | 1) => {
    setTemplateHeader((prev: any) => {
      const current = [...orderedFixedHeaderFields.map((f) => f.key)];
      const idx = current.findIndex((k) => k === fieldKey);
      if (idx < 0) return prev;
      const nextIdx = idx + direction;
      if (nextIdx < 0 || nextIdx >= current.length) return prev;
      const tmp = current[idx];
      current[idx] = current[nextIdx];
      current[nextIdx] = tmp;
      return normalizeHeaderConfig({
        ...prev,
        field_order: current,
      });
    });
  };

  const saveTemplateConfig = async () => {
    if (!selectedTemplateId) {
      setToast({ type: "err", msg: "Selecciona una ficha para guardar." });
      return;
    }
    setSavingConfig(true);
    setError(null);
    const nextHeader = buildHeaderConfig();
    const { error: updErr } = await supabase
      .from("form_template")
      .update({ header_config: nextHeader, footer_config: templateFooter })
      .eq("id", selectedTemplateId);
    if (updErr) {
      setError(updErr.message);
      setToast({ type: "err", msg: updErr.message });
      setSavingConfig(false);
      return;
    }
    await loadTemplates(selectedId ?? "");
    setToast({ type: "ok", msg: "Configuración guardada." });
    setSavingConfig(false);
  };

  const addSection = async () => {
    if (!selectedTemplateId || !sectionTitle.trim()) return;
    await supabase.from("form_section").insert({
      template_id: selectedTemplateId,
      titulo: sectionTitle.trim(),
      orden: sections.length + 1,
    });
    setSectionTitle("");
    loadSections(selectedTemplateId);
  };

  const renameSection = async (sectionId: string) => {
    const current = sections.find((s) => s.id === sectionId);
    const next = window.prompt("Nuevo título de sección:", current?.titulo ?? "")?.trim();
    if (!next) return;
    await supabase.from("form_section").update({ titulo: next }).eq("id", sectionId);
    loadSections(selectedTemplateId ?? "");
  };

  const updateTemplateMeta = async () => {
    if (!selectedTemplateId) {
      setToast({ type: "err", msg: "Selecciona una ficha para guardar." });
      return;
    }
    setSavingConfig(true);
    setError(null);
    const nextHeader = buildHeaderConfig();
    const { error: updErr } = await supabase
      .from("form_template")
      .update({
        titulo: editTemplateTitle.trim() || "Ficha",
        codigo: editTemplateCode.trim() || "F",
        subtitulo: editTemplateSubtitle.trim() || null,
        header_config: nextHeader,
        footer_config: templateFooter,
      })
      .eq("id", selectedTemplateId);
    if (updErr) {
      setError(updErr.message);
      setToast({ type: "err", msg: updErr.message });
      setSavingConfig(false);
      return;
    }
    await loadTemplates(selectedId ?? "");
    setToast({ type: "ok", msg: "Ficha guardada." });
    setSavingConfig(false);
  };

  const moveSection = async (sectionId: string, dir: -1 | 1) => {
    const idx = sections.findIndex((s) => s.id === sectionId);
    const target = sections[idx + dir];
    if (idx < 0 || !target) return;
    const current = sections[idx];
    await supabase.from("form_section").update({ orden: target.orden }).eq("id", current.id);
    await supabase.from("form_section").update({ orden: current.orden }).eq("id", target.id);
    loadSections(selectedTemplateId ?? "");
  };

  const moveQuestion = async (q: Question, dir: -1 | 1) => {
    if (!q.section_id) return;
    const list = questions.filter((x) => x.section_id === q.section_id);
    const idx = list.findIndex((x) => x.id === q.id);
    const target = list[idx + dir];
    if (!target) return;
    await supabase
      .from("form_question")
      .update({ orden_in_section: target.orden_in_section })
      .eq("id", q.id);
    await supabase
      .from("form_question")
      .update({ orden_in_section: q.orden_in_section })
      .eq("id", target.id);
    loadQuestions(selectedTemplateId ?? "");
  };

  const resetQuestionForm = () => {
    setQTexto("");
    setQOpciones("");
    setQTipo("yes_no");
    setQRequired(true);
    setQNiveles(3);
    setQNivelLabels(["Bajo", "Medio", "Alto"]);
    setQExtraFields([]);
    setQExtraFieldInput("");
    setQExtraFieldMode("registro");
    setQExtraFieldDefault("");
    setQMulti(false);
    setQIncludeObs(true);
    setEditingQuestionId(null);
  };

  const saveQuestion = async (keepEditing = false) => {
    if (!selectedTemplateId || !qTexto.trim() || !selectedSectionId) return;
    const config: any = {};
    if (qTipo === "yes_no_nivel") {
      config.levels = qNiveles;
      config.levelLabels = qNivelLabels.slice(0, qNiveles);
    }
    if (qTipo === "opciones") {
      config.options = qOpciones
        .split("\n")
        .map((v) => v.trim())
        .filter(Boolean);
      config.multi = qMulti;
    }
    if (qTipo === "archivo_pdf") config.maxSizeMB = 5;
    config.include_obs = qIncludeObs;
    if (qExtraFields.length) config.extra_fields = qExtraFields;

    if (editingQuestionId) {
      await supabase
        .from("form_question")
        .update({
          tipo: qTipo,
          texto: qTexto.trim(),
          required: qRequired,
          config_json: Object.keys(config).length ? config : null,
        })
        .eq("id", editingQuestionId);
    } else {
      const countInSection = questions.filter((x) => x.section_id === selectedSectionId).length;
      await supabase.from("form_question").insert({
        template_id: selectedTemplateId,
        section_id: selectedSectionId,
        tipo: qTipo,
        texto: qTexto.trim(),
        orden: questions.length + 1,
        orden_in_section: countInSection + 1,
        required: qRequired,
        config_json: Object.keys(config).length ? config : null,
      });
    }
    if (keepEditing) {
      setQTexto("");
      setQOpciones("");
    } else {
      resetQuestionForm();
      setShowQuestionForm(false);
    }
    loadQuestions(selectedTemplateId);
  };

  const startEditQuestion = (q: Question) => {
    setEditingQuestionId(q.id);
    setQTexto(q.texto);
    setQTipo(q.tipo);
    setQRequired(!!q.required);
    setSelectedSectionId(q.section_id ?? selectedSectionId);
    if (q.tipo === "yes_no_nivel") {
      setQNiveles(q.config_json?.levels ?? 3);
      setQNivelLabels(q.config_json?.levelLabels ?? ["Bajo", "Medio", "Alto"]);
    } else {
      setQNiveles(3);
      setQNivelLabels(["Bajo", "Medio", "Alto"]);
    }
    if (q.tipo === "opciones") {
      setQOpciones((q.config_json?.options ?? []).join("\n"));
      setQMulti(!!q.config_json?.multi);
    } else {
      setQOpciones("");
      setQMulti(false);
    }
    setQIncludeObs(q.config_json?.include_obs !== false);
    setQExtraFields(normalizeExtraFields(q.config_json?.extra_fields));
    setQExtraFieldInput("");
    setQExtraFieldMode("registro");
    setQExtraFieldDefault("");
    setShowQuestionForm(true);
  };

  const deleteQuestion = async (id: string) => {
    if (!selectedTemplateId) return;
    if (!window.confirm("¿Eliminar esta pregunta?")) return;
    await supabase.from("form_question").delete().eq("id", id);
    if (editingQuestionId === id) {
      resetQuestionForm();
      setShowQuestionForm(false);
    }
    loadQuestions(selectedTemplateId);
  };

  const loadPreview = () => {
    if (!selectedId || !selectedTemplateId) return;
    const raw = localStorage.getItem(`preview:${selectedId}:${selectedTemplateId}`);
    if (!raw) {
      setPreviewData({});
      return;
    }
    try {
      setPreviewData(JSON.parse(raw));
    } catch {
      setPreviewData({});
    }
  };

  const savePreview = (next: Record<string, any>) => {
    setPreviewData(next);
    if (!selectedId || !selectedTemplateId) return;
    localStorage.setItem(`preview:${selectedId}:${selectedTemplateId}`, JSON.stringify(next));
  };

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  
  const exportPreviewPdf = async () => {
    if (!selectedTemplate) return;
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const M = 14;
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    let y = 18;
    const contentW = pageW - M * 2;
    const lineH = 5;
    const smallLineH = 4.2;

    const ensureSpace = (need: number) => {
      if (y + need > pageH - 14) {
        doc.addPage();
        y = 18;
      }
    };

    const drawSectionHeader = (title: string) => {
      ensureSpace(10);
      doc.setFillColor(230, 236, 243);
      doc.setDrawColor(160, 170, 185);
      doc.rect(M, y - 2.5, contentW, 8, "FD");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text(title, M + 2, y + 2.5);
      y += 10;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
    };

    const drawKeyValueGrid = (pairs: Array<[string, string]>) => {
      if (!pairs.length) return;
      const cols = 2;
      const colW = contentW / cols;
      const rowH = 8;
      const rows = Math.ceil(pairs.length / cols);
      ensureSpace(rows * rowH + 4);
      doc.setDrawColor(200);
      for (let r = 0; r < rows; r += 1) {
        for (let c = 0; c < cols; c += 1) {
          const idx = r * cols + c;
          const x = M + c * colW;
          const yCell = y + r * rowH;
          doc.rect(x, yCell, colW, rowH);
          const pair = pairs[idx];
          if (pair) {
            doc.setFontSize(8);
            doc.setTextColor(90);
            doc.text(pair[0], x + 2, yCell + 3.5);
            doc.setFontSize(9);
            doc.setTextColor(20);
            const valueLines = doc.splitTextToSize(pair[1] || "-", colW - 4);
            doc.text(valueLines, x + 2, yCell + 7);
          }
        }
      }
      doc.setTextColor(20);
      y += rows * rowH + 4;
      doc.setFontSize(10);
    };

    // Logo
    try {
      const img = await loadImage(logoUrl);
      const imgW = 22;
      const imgH = (img.height / img.width) * imgW;
      const dataUrl = toDataUrl(img);
      if (dataUrl) doc.addImage(dataUrl, "PNG", M, y - 8, imgW, imgH);
    } catch {
      // no-op
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text(selectedTemplate.titulo, M + 26, y);
    y += 6;

    if (selectedTemplate.subtitulo) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      doc.text(selectedTemplate.subtitulo, M + 26, y);
      y += 6;
    }

    doc.setDrawColor(220);
    doc.line(M, y, pageW - M, y);
    y += 10;

    const header = previewData.__header ?? {};
    const footer = previewData.__footer ?? {};
    const headerPairs: Array<[string, string]> = [];
    if (templateHeader.institucion) headerPairs.push(["Institución educativa", header.institucion ?? ""]);
    if (templateHeader.codigo_modular) headerPairs.push(["Código modular", header.codigo_modular ?? ""]);
    if (templateHeader.codigo_local) headerPairs.push(["Código local", header.codigo_local ?? ""]);
    if (templateHeader.distrito) headerPairs.push(["Distrito / Lugar", header.distrito ?? ""]);
    if (templateHeader.rei) headerPairs.push(["REI", header.rei ?? ""]);
    if (templateHeader.monitor) headerPairs.push(["Monitor", header.monitor ?? ""]);
    if (templateHeader.monitor_doc_tipo) headerPairs.push(["Tipo doc. monitor", header.monitor_doc_tipo ?? ""]);
    if (templateHeader.monitor_numero_doc)
      headerPairs.push(["Numero doc. monitor", header.monitor_numero_doc ?? ""]);
    if (templateHeader.monitoreado) headerPairs.push(["Monitoreado", header.monitoreado ?? ""]);
    if (templateHeader.monitoreado_doc_tipo)
      headerPairs.push(["Tipo doc. monitoreado", header.monitoreado_doc_tipo ?? ""]);
    if (templateHeader.monitoreado_numero_doc)
      headerPairs.push(["Numero doc. monitoreado", header.monitoreado_numero_doc ?? ""]);
    if (templateHeader.monitoreado_cargo) headerPairs.push(["Cargo monitoreado", header.monitoreado_cargo ?? ""]);
    if (templateHeader.monitoreado_telefono)
      headerPairs.push(["Telefono monitoreado", header.monitoreado_telefono ?? ""]);
    if (templateHeader.monitoreado_correo)
      headerPairs.push(["Correo monitoreado", header.monitoreado_correo ?? ""]);
    if (templateHeader.condicion) headerPairs.push(["Condición de monitoreado", header.condicion ?? ""]);
    if (templateHeader.area) headerPairs.push(["Área", header.area ?? ""]);
    if (templateHeader.numero_visitas)
      headerPairs.push(["Numero de visitas a la IE", header.numero_visitas ?? ""]);
    if (templateHeader.fecha_aplicacion)
      headerPairs.push(["Fecha de aplicacion", header.fecha_aplicacion ?? ""]);
    if (templateHeader.hora_inicio) headerPairs.push(["Hora de inicio", header.hora_inicio ?? ""]);
    if (templateHeader.hora_fin) headerPairs.push(["Hora de fin", header.hora_fin ?? ""]);
    (templateHeader.custom_fields ?? []).forEach((field: HeaderFieldDef) => {
      headerPairs.push([field.label, header.custom_values?.[field.key] ?? ""]);
    });

    if (headerPairs.length) {
      drawSectionHeader("Encabezado");
      drawKeyValueGrid(headerPairs);
    }

    if (templateHeader.nivel_avance) {
      const source = (templateHeader.nivel_avance_info ?? []).length
        ? templateHeader.nivel_avance_info
        : DEFAULT_NIVEL_INFO;
      const nivelPairs: Array<[string, string]> = source.map((x: any) => [
        `Nivel ${x.nivel}`,
        x.descripcion ?? "",
      ]);
      drawSectionHeader("Niveles de respuesta (Sí)");
      drawKeyValueGrid(nivelPairs);
    }

    sections.forEach((s) => {
      drawSectionHeader(s.titulo);

      questions.filter((q) => q.section_id === s.id).forEach((q) => {
        const title = `${q.orden_in_section ?? q.orden}. ${q.texto}`;
        const lines = doc.splitTextToSize(title, contentW);
        ensureSpace(lines.length * lineH + 6);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.text(lines, M, y);
        y += lines.length * lineH;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);

        const p = previewData[q.id] ?? {};
        const parts: string[] = [];
        if (q.tipo === "yes_no") parts.push(`Respuesta: ${p.yn ?? "-"}`);
        if (q.tipo === "yes_no_nivel") {
          const levelLabels = q.config_json?.levelLabels ?? [];
          const nivelLabel = p.nivel
            ? levelLabels.find((l: any) => l.value === p.nivel)?.label ?? p.nivel
            : "-";
          parts.push(`Respuesta: ${p.yn ?? "-"}`);
          parts.push(`Nivel: ${nivelLabel}`);
        }
        if (q.tipo === "opciones") {
          if (p.option) parts.push(`Opción: ${p.option}`);
          if (p.options?.length) parts.push(`Opciones: ${p.options.join(", ")}`);
          if (!p.option && !p.options?.length) parts.push("Opciones: -");
        }
        if (q.tipo === "texto") parts.push(`Respuesta: ${p.text ?? "-"}`);
        if (q.tipo === "numero") parts.push(`Respuesta: ${p.number ?? "-"}`);
        if (q.tipo === "archivo_pdf") parts.push(`Archivo: ${p.fileName ?? "-"}`);
        if (q.config_json?.include_obs !== false) parts.push(`Observación: ${p.obs ?? "-"}`);
        const extraFields = normalizeExtraFields(q.config_json?.extra_fields);
        extraFields.forEach((f) => {
          const val = f.mode === "elaboracion" ? f.default_value ?? "" : p?.extra?.[f.label] ?? "-";
          parts.push(`${f.label}: ${val || "-"}`);
        });

        if (parts.length) {
          const detail = parts.join(" | ");
          const detailLines = doc.splitTextToSize(detail, contentW);
          doc.text(detailLines, M, y);
          y += detailLines.length * smallLineH;
        }

        y += 4;
        doc.setDrawColor(235);
        doc.line(M, y, pageW - M, y);
        y += 3;
      });
    });

    const footerPairs: Array<[string, string]> = [];
    if (templateFooter.observacion) footerPairs.push(["Observación general", footer.observacion ?? ""]);
    if (templateFooter.compromiso) footerPairs.push(["Compromiso", footer.compromiso ?? ""]);
    if (templateFooter.lugar) footerPairs.push(["Lugar", footer.lugar ?? ""]);
    if (templateFooter.fecha) footerPairs.push(["Fecha", footer.fecha ?? ""]);
    if (templateFooter.docente_nombre) footerPairs.push(["Monitoreado", footer.docente_nombre ?? ""]);
    if (templateFooter.docente_dni) footerPairs.push(["DNI Monitoreado", footer.docente_dni ?? ""]);
    if (templateFooter.monitor_nombre) footerPairs.push(["Monitor", footer.monitor_nombre ?? ""]);
    if (templateFooter.monitor_dni) footerPairs.push(["DNI Monitor", footer.monitor_dni ?? ""]);

    if (footerPairs.length) {
      drawSectionHeader("Cierre");
      drawKeyValueGrid(footerPairs);
    }

    if (y + 22 > pageH - 14) {
      doc.addPage();
      y = 18;
    }
    doc.setDrawColor(120);
    doc.line(M, y + 12, M + 70, y + 12);
    doc.line(pageW - M - 70, y + 12, pageW - M, y + 12);
    doc.setFontSize(8);
    doc.text("Firma docente monitoreado", M, y + 16);
    doc.text("Firma monitor", pageW - M - 70, y + 16);

    doc.save(`preview_${selectedTemplate.codigo || "ficha"}.pdf`);
  };

  return (
    <div className="space-y-6">
      {toast && (
        <div className="fixed right-4 top-4 z-50">
          <div
            className={`rounded-xl border px-4 py-3 text-sm shadow-xl backdrop-blur ${
              toast.type === "ok"
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
                : "border-red-500/30 bg-red-500/10 text-red-100"
            }`}
          >
            {toast.msg}
          </div>
        </div>
      )}
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Gestión de Monitoreos</h1>
          <p className="text-sm text-white/60">
            Crea solicitudes y define fichas. El admin aprueba y publica en Monitoreo.
          </p>
        </div>
      </header>

      {!canCreate && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
          Tu cuenta no está habilitada para crear monitoreos. Comunícate con el administrador.
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.1fr_1.4fr]">
        <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Solicitudes</h2>
            <button
              type="button"
              onClick={loadSolicitudes}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/80"
            >
              Refrescar
            </button>
          </div>

          {loading && <div className="mt-4 text-sm text-white/60">Cargando...</div>}
          {error && <div className="mt-4 text-sm text-red-100">{error}</div>}

          <div className="mt-4 flex flex-wrap items-end gap-3">
            <label className="text-xs text-white/60">
              Buscar
              <input
                className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm"
                placeholder="Nombre o código SOL-XXXXXXX"
                value={solSearch}
                onChange={(e) => {
                  setSolSearch(e.target.value);
                  setSolPage(1);
                }}
              />
            </label>
            <label className="text-xs text-white/60">
              Estado
              <select
                className="mt-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm"
                value={solStatusFilter}
                onChange={(e) => {
                  setSolStatusFilter(e.target.value);
                  setSolPage(1);
                }}
              >
                <option value="ALL">Todos</option>
                <option value="pending">Pendiente</option>
                <option value="approved_lv1">Aprobado por jefe</option>
                <option value="approved">Aprobado</option>
                <option value="rejected">Rechazado</option>
                <option value="inactive">Inactivo</option>
              </select>
            </label>
            <label className="text-xs text-white/60">
              Ver
              <select
                className="mt-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm"
                value={solPageSize}
                onChange={(e) => {
                  setSolPageSize(Number(e.target.value));
                  setSolPage(1);
                }}
              >
                {[10, 20, 50].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <div className="text-xs text-white/50">{filteredSolicitudes.length} resultados</div>
          </div>

          <div className="mt-4 space-y-3">
            {pageSolicitudes.map((s) => (
              <button
                key={s.id}
                onClick={() => setSelectedId(s.id)}
                className={`w-full rounded-xl border px-4 py-3 text-left transition ${
                  selectedId === s.id ? "border-[var(--app-accent)] bg-white/10" : "border-white/10 bg-white/5"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold">
                    {s.nombre}
                    {s.cdd && (
                      <span className="ml-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 text-[11px] text-blue-100">
                        CdD
                      </span>
                    )}
                  </div>
                  <span className={`rounded-full border px-2 py-0.5 text-[11px] ${statusTone(s.status)}`}>
                    {statusLabel(s.status)}
                  </span>
                </div>
                <div className="mt-1 text-xs text-white/60">
                  {s.fecha_inicio} → {s.fecha_fin}
                  {s.status === "approved" && isMonitoreoExpired(s.fecha_fin) ? " • Vencido" : ""}
                </div>
                <div className="mt-1 text-xs text-white/50">
                  Código: SOL-{s.id.slice(0, 8).toUpperCase()}
                </div>
                {s.motivo_rechazo && (
                  <div className="mt-2 text-xs text-red-100">Rechazo: {s.motivo_rechazo}</div>
                )}
              </button>
            ))}
            {!pageSolicitudes.length && (
              <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-white/50">
                Sin resultados.
              </div>
            )}
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-white/60">
            <div>
              Página {solPage} de {solTotalPages}
            </div>
            <div className="flex gap-2">
              <button
                className="rounded-lg border border-white/10 bg-white/5 px-2 py-1"
                onClick={() => setSolPage((p) => Math.max(1, p - 1))}
                disabled={solPage <= 1}
              >
                Anterior
              </button>
              <button
                className="rounded-lg border border-white/10 bg-white/5 px-2 py-1"
                onClick={() => setSolPage((p) => Math.min(solTotalPages, p + 1))}
                disabled={solPage >= solTotalPages}
              >
                Siguiente
              </button>
            </div>
          </div>
        </section>

        <section className="space-y-6">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <h2 className="text-lg font-semibold">Nueva solicitud</h2>
            <div className="mt-4 grid gap-3">
              <input
                className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm"
                placeholder="Nombre del monitoreo"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                disabled={!canCreate || saving}
              />
              <textarea
                className="min-h-[80px] rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm"
                placeholder="Detalle del monitoreo"
                value={detalle}
                onChange={(e) => setDetalle(e.target.value)}
                disabled={!canCreate || saving}
              />
              <div className="grid gap-3 md:grid-cols-2">
                <input
                  type="date"
                  className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm"
                  value={fechaInicio}
                  onChange={(e) => setFechaInicio(e.target.value)}
                  disabled={!canCreate || saving}
                />
                <input
                  type="date"
                  className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm"
                  value={fechaFin}
                  onChange={(e) => setFechaFin(e.target.value)}
                  disabled={!canCreate || saving}
                />
              </div>
              <label className="flex items-center gap-2 text-xs text-white/70">
                <input
                  type="checkbox"
                  checked={isCdd}
                  onChange={(e) => setIsCdd(e.target.checked)}
                  disabled={!canCreate || saving}
                />
                Compromiso de Desempeño (CdD)
              </label>

              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="text-xs text-white/60">Filtros</div>
                <div className="mt-2 grid gap-3 md:grid-cols-4">
                  <div>
                    <div className="text-xs text-white/60">Gestión</div>
                    {GESTIONES.map((g) => (
                      <label key={g} className="mt-1 flex items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          checked={gestiones.includes(g)}
                          onChange={() => setGestiones((v) => toggleGestion(v, g))}
                          disabled={!canCreate}
                        />
                        {g}
                      </label>
                    ))}
                  </div>
                  <div>
                    <div className="text-xs text-white/60">Modalidad</div>
                    {MODALIDADES.map((m) => (
                      <label key={m} className="mt-1 flex items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          checked={modalidades.includes(m)}
                          onChange={() => setModalidades((v) => toggleValue(v, m))}
                          disabled={!canCreate}
                        />
                        {m}
                      </label>
                    ))}
                  </div>
                  <div>
                    <div className="text-xs text-white/60">Tipo</div>
                    {TIPOS.map((t) => (
                      <label key={t} className="mt-1 flex items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          checked={tipos.includes(t)}
                          onChange={() => setTipos((v) => toggleValue(v, t))}
                          disabled={!canCreate}
                        />
                        {t}
                      </label>
                    ))}
                  </div>
                  <div>
                    <div className="text-xs text-white/60">Nivel</div>
                    {availableNiveles.map((n) => (
                      <label key={n} className="mt-1 flex items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          checked={niveles.includes(n)}
                          onChange={() => setNiveles((v) => toggleValue(v, n))}
                          disabled={!canCreate}
                        />
                        {n}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="mt-3">
                  <div className="text-xs text-white/60">Restricción de guardado por código</div>
                  <select
                    className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm md:max-w-md"
                    value={dupRule}
                    onChange={(e) => setDupRule(e.target.value)}
                    disabled={!canCreate}
                  >
                    <option value={DUP_RULE_NONE}>Sin restricción</option>
                    <option value={DUP_RULE_LOCAL}>No repetir por código local</option>
                    <option value={DUP_RULE_MODULAR}>No repetir por código modular</option>
                  </select>
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="text-xs text-white/60">Instituciones (selección manual)</div>
                <input
                  className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm"
                  placeholder="Buscar por nombre o código modular"
                  value={ieQuery}
                  onChange={(e) => setIeQuery(e.target.value)}
                  disabled={!canCreate}
                />
                {ieResults.length > 0 && (
                  <div className="mt-2 max-h-40 overflow-y-auto rounded-lg border border-white/10 bg-black/40">
                    {ieResults.map((ie) => (
                      <button
                        key={ie.id}
                        type="button"
                        onClick={() => {
                          if (!ieSelected.find((x) => x.id === ie.id)) {
                            setIeSelected((v) => [...v, ie]);
                          }
                        }}
                        className="w-full px-3 py-2 text-left text-xs hover:bg-white/5"
                      >
                        {ie.nombre} · {ie.codigo_modular}
                      </button>
                    ))}
                  </div>
                )}
                {ieSelected.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {ieSelected.map((ie) => (
                      <span
                        key={ie.id}
                        className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-2 py-0.5 text-[11px]"
                      >
                        {ie.nombre}
                        <button
                          type="button"
                          onClick={() => setIeSelected((v) => v.filter((x) => x.id !== ie.id))}
                          className="text-white/60"
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={submitSolicitud}
                disabled={!canCreate || saving || !nombre.trim() || !fechaInicio || !fechaFin}
                className="rounded-lg bg-[var(--app-accent)] px-4 py-2 text-sm font-medium text-[var(--app-on-accent)] disabled:opacity-50"
              >
                {saving ? "Guardando..." : "Crear solicitud"}
              </button>
            </div>
          </div>

          {selected && (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold">{selected.nombre}</div>
                  <div className="text-xs text-white/60">
                    {statusLabel(selected.status)}
                    {selectedExpired ? " • Vencido" : ""}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {canApproveLv1 && selected.status === "pending" && (
                    <button
                      type="button"
                      onClick={() => approveLv1(selected.id)}
                      className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-100"
                    >
                      Aprobar nivel 1
                    </button>
                  )}
                  {isAdmin && selected.status === "approved_lv1" && (
                    <button
                      type="button"
                      onClick={() => approveFinal(selected.id)}
                      className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-100"
                    >
                      Aprobar final
                    </button>
                  )}
                  {canReject && selected.status === "pending" && (
                    <button
                      type="button"
                      onClick={() => rejectSolicitud(selected.id)}
                      className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs text-red-100"
                    >
                      Rechazar
                    </button>
                  )}
                  {isAdmin && selected.status === "approved" && (
                    <button
                      type="button"
                      onClick={() => inactivateMonitoreo(selected.id)}
                      className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/80"
                    >
                      Inactivar monitoreo
                    </button>
                  )}
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => setRebuildIeOpen(true)}
                      disabled={rebuildIeBusy}
                      className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/80"
                    >
                      {rebuildIeBusy ? "Reaplicando..." : "Reaplicar filtros IE"}
                    </button>
                  )}
                  {isAdmin && selected.status === "inactive" && (
                    <button
                      type="button"
                      onClick={() => reactivateMonitoreo(selected.id)}
                      className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-100"
                    >
                      Reactivar monitoreo
                    </button>
                  )}
                  {isAdmin && (selected.status === "approved" || selected.status === "inactive") && (
                    <button
                      type="button"
                      onClick={() => openDeleteMonitoreoDialog(selected.id)}
                      className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs text-red-100"
                    >
                      Eliminar monitoreo
                    </button>
                  )}
                  {isAdmin && (selected.status === "pending" || selected.status === "rejected") && (
                    <button
                      type="button"
                      onClick={() => deleteSolicitud(selected.id)}
                      className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs text-red-100"
                    >
                      Eliminar
                    </button>
                  )}
                </div>
              </div>
              {isAdmin && selected.status === "approved" && selectedExpired && (
                <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
                  <div className="text-xs text-amber-100">
                    Monitoreo vencido. Para habilitarlo, define una nueva fecha de vencimiento (Ampliacion).
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <input
                      type="date"
                      value={extendFechaFin}
                      onChange={(e) => setExtendFechaFin(e.target.value)}
                      className="rounded-lg border border-white/10 bg-black/30 px-3 py-1.5 text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => extendMonitoreo(selected.id)}
                      disabled={extendBusy}
                      className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-100 disabled:opacity-50"
                    >
                      {extendBusy ? "Guardando..." : "Aplicar ampliacion"}
                    </button>
                  </div>
                </div>
              )}

              {isAdmin && (
                <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3">
                  <div className="text-sm font-semibold">Editar solicitud</div>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <input
                      className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm"
                      placeholder="Nombre del monitoreo"
                      value={editNombre}
                      onChange={(e) => setEditNombre(e.target.value)}
                    />
                    <input
                      type="date"
                      className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm"
                      value={editFechaInicio}
                      onChange={(e) => setEditFechaInicio(e.target.value)}
                    />
                    <input
                      type="date"
                      className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm"
                      value={editFechaFin}
                      onChange={(e) => setEditFechaFin(e.target.value)}
                    />
                    <label className="flex items-center gap-2 text-xs text-white/70">
                      <input
                        type="checkbox"
                        checked={editCdd}
                        onChange={(e) => setEditCdd(e.target.checked)}
                      />
                      Compromiso de Desempeño (CdD)
                    </label>
                  <textarea
                    className="min-h-[70px] rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm md:col-span-2"
                    placeholder="Detalle del monitoreo"
                    value={editDetalle}
                    onChange={(e) => setEditDetalle(e.target.value)}
                  />
                </div>
                <div className="mt-3 rounded-xl border border-white/10 bg-white/5 p-3">
                  <div className="text-xs text-white/60">Filtros</div>
                  <div className="mt-2 grid gap-3 md:grid-cols-4">
                    <div>
                      <div className="text-xs text-white/60">Gestión</div>
                    {GESTIONES.map((g) => (
                        <label key={g} className="mt-1 flex items-center gap-2 text-xs">
                          <input
                            type="checkbox"
                            checked={editGestiones.includes(g)}
                            onChange={() => setEditGestiones((v) => toggleGestion(v, g))}
                          />
                          {g}
                        </label>
                      ))}
                    </div>
                    <div>
                      <div className="text-xs text-white/60">Modalidad</div>
                      {MODALIDADES.map((m) => (
                        <label key={m} className="mt-1 flex items-center gap-2 text-xs">
                          <input
                            type="checkbox"
                            checked={editModalidades.includes(m)}
                            onChange={() => setEditModalidades((v) => toggleValue(v, m))}
                          />
                          {m}
                        </label>
                      ))}
                    </div>
                    <div>
                      <div className="text-xs text-white/60">Tipo</div>
                      {TIPOS.map((t) => (
                        <label key={t} className="mt-1 flex items-center gap-2 text-xs">
                          <input
                            type="checkbox"
                            checked={editTipos.includes(t)}
                            onChange={() => setEditTipos((v) => toggleValue(v, t))}
                          />
                          {t}
                        </label>
                      ))}
                    </div>
                    <div>
                      <div className="text-xs text-white/60">Nivel</div>
                    {editAvailableNiveles.map((n) => (
                        <label key={n} className="mt-1 flex items-center gap-2 text-xs">
                          <input
                            type="checkbox"
                            checked={editNiveles.includes(n)}
                            onChange={() => setEditNiveles((v) => toggleValue(v, n))}
                          />
                          {n}
                        </label>
                    ))}
                    </div>
                  </div>
                  <div className="mt-3">
                    <div className="text-xs text-white/60">Restricción de guardado por código</div>
                    <select
                      className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm md:max-w-md"
                      value={editDupRule}
                      onChange={(e) => setEditDupRule(e.target.value)}
                    >
                      <option value={DUP_RULE_NONE}>Sin restricción</option>
                      <option value={DUP_RULE_LOCAL}>No repetir por código local</option>
                      <option value={DUP_RULE_MODULAR}>No repetir por código modular</option>
                    </select>
                  </div>
                </div>
                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    onClick={updateSolicitud}
                      className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/80"
                    >
                      Guardar cambios
                    </button>
                  </div>
                </div>
              )}

              <div className="mt-4 grid gap-4">
                <div>
                  <div className="text-sm font-semibold">Fichas</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {templates.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => { setSelectedTemplateId(t.id); setShowTemplateDetail(true); }}
                      className={`rounded-full border px-3 py-1 text-xs ${
                        selectedTemplateId === t.id
                          ? "border-[var(--app-accent)] bg-white/10"
                          : "border-white/10 bg-white/5"
                      }`}
                    >
                      {t.titulo}
                      {t.subtitulo ? ` · ${t.subtitulo}` : ""}
                    </button>
                  ))}
                </div>

                {canEditSolicitud && (
                  <div className="mt-3 grid gap-2 md:grid-cols-2 lg:grid-cols-[1fr_140px_140px_120px]">
                    <input
                      className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm"
                      placeholder="Título de ficha"
                      value={templateTitle}
                      onChange={(e) => setTemplateTitle(e.target.value)}
                    />
                    <input
                      className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm"
                      placeholder="Código"
                      value={templateCode}
                      onChange={(e) => setTemplateCode(e.target.value)}
                    />
                    <input
                      className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm"
                      placeholder="Subtítulo"
                      value={templateSubtitle}
                      onChange={(e) => setTemplateSubtitle(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={addTemplate}
                      className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/80"
                    >
                      Agregar ficha
                    </button>
                  </div>
                )}
              </div>

                {selectedTemplateId && !showTemplateDetail && (
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-semibold">Ficha seleccionada</div>
                      <button
                        type="button"
                        onClick={() => setShowTemplateDetail(true)}
                        className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/80"
                      >
                        Abrir ficha
                      </button>
                    </div>
                  </div>
                )}
                
                {selectedTemplateId && showTemplateDetail && (
                  <div>
                    <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3">
                      {canEditSolicitud && (
                        <div className="mb-3 grid gap-2 md:grid-cols-2 lg:grid-cols-[1fr_140px_140px_120px]">
                          <input
                            className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm"
                            placeholder="Título de ficha"
                            value={editTemplateTitle}
                            onChange={(e) => setEditTemplateTitle(e.target.value)}
                          />
                          <input
                            className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm"
                            placeholder="Código"
                            value={editTemplateCode}
                            onChange={(e) => setEditTemplateCode(e.target.value)}
                          />
                          <input
                            className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm"
                            placeholder="Subtítulo"
                            value={editTemplateSubtitle}
                            onChange={(e) => setEditTemplateSubtitle(e.target.value)}
                          />
                          <button
                            type="button"
                            onClick={updateTemplateMeta}
                            className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/80"
                          >
                            Guardar ficha
                          </button>
                        </div>
                      )}
                      <div className="text-sm font-semibold">Encabezado / Cierre</div>
                      <div className="mt-3 space-y-2">
                        {orderedFixedHeaderFields.map((field) => (
                          <div
                            key={field.key}
                            className="grid items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-3 py-2 md:grid-cols-[1fr_auto]"
                          >
                            <label className="flex items-center gap-2 text-xs text-white/70">
                              <input
                                type="checkbox"
                                checked={!!templateHeader[field.key]}
                                onChange={(e) =>
                                  setTemplateHeader((s: any) =>
                                    normalizeHeaderConfig({ ...s, [field.key]: e.target.checked })
                                  )
                                }
                              />
                              {field.label}
                            </label>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => moveFixedHeaderField(field.key, -1)}
                                className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[11px]"
                                title="Subir"
                              >
                                ↑
                              </button>
                              <button
                                type="button"
                                onClick={() => moveFixedHeaderField(field.key, 1)}
                                className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[11px]"
                                title="Bajar"
                              >
                                ↓
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                      {templateHeader.area && (
                        <div className="mt-3">
                          <div className="text-xs text-white/60">Opciones de área (una por línea)</div>
                          <textarea
                            className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm"
                            value={templateHeaderAreas}
                            onChange={(e) => setTemplateHeaderAreas(e.target.value)}
                          />
                        </div>
                      )}
                      {templateHeader.nivel_avance && (
                        <div className="mt-3">
                          <div className="text-xs text-white/60">
                            Niveles de avance (una por línea). Formato: 1 | Descripción
                          </div>
                          <textarea
                            className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm"
                            value={templateHeaderNiveles}
                            onChange={(e) => setTemplateHeaderNiveles(e.target.value)}
                          />
                        </div>
                      )}
                      <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3">
                        <div className="text-sm font-semibold">Campos dinámicos del encabezado</div>
                        <div className="mt-1 text-xs text-white/60">
                          Úsalos para director, docente, matrícula u otros datos nuevos sin tocar código.
                        </div>
                        <div className="mt-3 grid gap-2 md:grid-cols-[1.5fr_140px_1fr_120px_auto]">
                          <input
                            className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm"
                            placeholder="Nombre del campo"
                            value={templateCustomFieldLabel}
                            onChange={(e) => setTemplateCustomFieldLabel(e.target.value)}
                          />
                          <select
                            className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm"
                            value={templateCustomFieldType}
                            onChange={(e) => setTemplateCustomFieldType(e.target.value as HeaderFieldDef["type"])}
                          >
                            {HEADER_FIELD_TYPE_OPTIONS.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                          <input
                            className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm"
                            placeholder="Opciones (si es lista)"
                            value={templateCustomFieldOptions}
                            onChange={(e) => setTemplateCustomFieldOptions(e.target.value)}
                            disabled={templateCustomFieldType !== "select"}
                          />
                          <label className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-white/70">
                            <input
                              type="checkbox"
                              checked={templateCustomFieldRequired}
                              onChange={(e) => setTemplateCustomFieldRequired(e.target.checked)}
                            />
                            Obligatorio
                          </label>
                          <button
                            type="button"
                            onClick={addTemplateCustomField}
                            className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/80"
                          >
                            Agregar
                          </button>
                        </div>
                        {templateCustomFieldType === "select" && (
                          <textarea
                            className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm"
                            placeholder="Una opción por línea"
                            value={templateCustomFieldOptions}
                            onChange={(e) => setTemplateCustomFieldOptions(e.target.value)}
                          />
                        )}
                        <div className="mt-3 space-y-2">
                          {(templateHeader.custom_fields ?? []).map((field: HeaderFieldDef) => (
                            <div
                              key={field.id}
                              className="grid gap-2 rounded-lg border border-white/10 bg-white/5 p-3 md:grid-cols-[1.5fr_130px_1fr_110px_auto]"
                            >
                              <input
                                className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm"
                                value={field.label}
                                onChange={(e) => patchTemplateCustomField(field.id, { label: e.target.value })}
                              />
                              <select
                                className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm"
                                value={field.type}
                                onChange={(e) =>
                                  patchTemplateCustomField(field.id, {
                                    type: e.target.value as HeaderFieldDef["type"],
                                    options:
                                      e.target.value === "select"
                                        ? field.options
                                        : [],
                                  })
                                }
                              >
                                {HEADER_FIELD_TYPE_OPTIONS.map((opt) => (
                                  <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </option>
                                ))}
                              </select>
                              <input
                                className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm"
                                placeholder={field.type === "select" ? "op1 | op2 | op3" : "Opcional"}
                                value={field.type === "select" ? field.options.join(" | ") : field.placeholder ?? ""}
                                onChange={(e) =>
                                  patchTemplateCustomField(
                                    field.id,
                                    field.type === "select"
                                      ? {
                                          options: e.target.value
                                            .split("|")
                                            .map((v) => v.trim())
                                            .filter(Boolean),
                                        }
                                      : { placeholder: e.target.value }
                                  )
                                }
                              />
                              <label className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-white/70">
                                <input
                                  type="checkbox"
                                  checked={field.required}
                                  onChange={(e) =>
                                    patchTemplateCustomField(field.id, { required: e.target.checked })
                                  }
                                />
                                Obligatorio
                              </label>
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => moveTemplateCustomField(field.id, -1)}
                                  className="rounded-lg border border-white/10 bg-white/5 px-2 py-2 text-xs text-white/80"
                                  title="Subir"
                                >
                                  ↑
                                </button>
                                <button
                                  type="button"
                                  onClick={() => moveTemplateCustomField(field.id, 1)}
                                  className="rounded-lg border border-white/10 bg-white/5 px-2 py-2 text-xs text-white/80"
                                  title="Bajar"
                                >
                                  ↓
                                </button>
                                <button
                                  type="button"
                                  onClick={() => removeTemplateCustomField(field.id)}
                                  className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-100"
                                >
                                  Quitar
                                </button>
                              </div>
                            </div>
                          ))}
                          {!(templateHeader.custom_fields ?? []).length && (
                            <div className="rounded-lg border border-dashed border-white/10 bg-black/20 px-3 py-3 text-xs text-white/50">
                              Sin campos dinámicos todavía.
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="mt-4 grid gap-3 md:grid-cols-2">
                        {[
                          ["observacion", "Observación general"],
                          ["compromiso", "Compromiso general"],
                          ["lugar", "Lugar"],
                          ["fecha", "Fecha"],
                          ["docente_nombre", "Nombre monitoreado"],
                          ["docente_dni", "DNI monitoreado"],
                          ["monitor_nombre", "Nombre monitor"],
                          ["monitor_dni", "DNI monitor"],
                          ["firmas", "Firmas"],
                        ].map(([key, label]) => (
                          <label key={key} className="flex items-center gap-2 text-xs text-white/70">
                            <input
                              type="checkbox"
                              checked={!!templateFooter[key]}
                              onChange={(e) =>
                                setTemplateFooter((s: any) => ({ ...s, [key]: e.target.checked }))
                              }
                            />
                            {label}
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3">
                      <div className="text-sm font-semibold">Secciones</div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {sections.map((s) => (
                          <div key={s.id} className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setSelectedSectionId(s.id)}
                              className={`rounded-full border px-3 py-1 text-xs ${
                                selectedSectionId === s.id
                                  ? "border-[var(--app-accent)] bg-white/10"
                                  : "border-white/10 bg-white/5"
                              }`}
                            >
                              {s.titulo}
                            </button>
                            {canEditSolicitud && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => renameSection(s.id)}
                                  className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[11px]"
                                >
                                  Editar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => moveSection(s.id, -1)}
                                  className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[11px]"
                                >
                                  ↑
                                </button>
                                <button
                                  type="button"
                                  onClick={() => moveSection(s.id, 1)}
                                  className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[11px]"
                                >
                                  ↓
                                </button>
                              </>
                            )}
                          </div>
                        ))}
                      </div>
                      {canEditSolicitud && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          <input
                            className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm"
                            placeholder="Nombre de sección"
                            value={sectionTitle}
                            onChange={(e) => setSectionTitle(e.target.value)}
                          />
                          <button
                            type="button"
                            onClick={addSection}
                            className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/80"
                          >
                            Agregar sección
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="text-sm font-semibold">Preguntas</div>
                      <button
                        type="button"
                        onClick={() => setShowTemplateDetail(false)}
                        className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-white/80"
                      >
                        Cerrar ficha
                      </button>
                    </div>
                    <div className="mt-2 space-y-2">
                      {sections.map((s) => (
                        <div key={s.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
                          <div className="text-sm font-semibold">{s.titulo}</div>
                          <div className="mt-2 space-y-2">
                            {questions
                              .filter((q) => q.section_id === s.id)
                              .map((q) => (
                        <div
                          key={q.id}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs"
                        >
                          <div>
                            {(q.orden_in_section ?? q.orden)}. {q.texto} ({q.tipo})
                            {q.tipo === "yes_no_nivel" && q.config_json?.levelLabels?.length ? (
                              <div className="mt-1 text-[11px] text-white/60">
                                Niveles: {q.config_json.levelLabels.join(" · ")}
                              </div>
                            ) : null}
                          </div>
                          {canEditSolicitud && (
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => startEditQuestion(q)}
                                className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-white/80"
                              >
                                Editar
                              </button>
                              <button
                                type="button"
                                onClick={() => moveQuestion(q, -1)}
                                className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[11px]"
                              >
                                ↑
                              </button>
                              <button
                                type="button"
                                onClick={() => moveQuestion(q, 1)}
                                className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[11px]"
                              >
                                ↓
                              </button>
                              <button
                                type="button"
                                onClick={() => deleteQuestion(q.id)}
                                className="rounded-lg border border-red-500/30 bg-red-500/10 px-2 py-1 text-[11px] text-red-100"
                              >
                                Eliminar
                              </button>
                            </div>
                          )}
                        </div>
                              ))}
                            {questions.filter((q) => q.section_id === s.id).length === 0 && (
                              <div className="text-xs text-white/50">Sin preguntas</div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {canEditSolicitud && (
                      <div className="mt-3 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              resetQuestionForm();
                              setShowQuestionForm(true);
                            }}
                            className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/80"
                          >
                            Agregar pregunta
                          </button>
                          <button
                            type="button"
                            onClick={saveTemplateConfig}
                            disabled={savingConfig}
                            className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/80"
                          >
                            {savingConfig ? "Guardando..." : "Guardar configuración"}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              loadPreview();
                              setPreviewOpen(true);
                            }}
                            className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/80"
                          >
                            Vista previa
                          </button>
                        </div>

                        {showQuestionForm && (
                        <div className="mt-3 space-y-2 rounded-xl border border-white/10 bg-white/5 p-3">
                        <div className="grid gap-2 md:grid-cols-2">
                          <select
                            className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm"
                            value={selectedSectionId ?? ""}
                            onChange={(e) => setSelectedSectionId(e.target.value)}
                          >
                            <option value="">Selecciona sección</option>
                            {sections.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.titulo}
                              </option>
                            ))}
                          </select>
                          <div className="text-xs text-white/50">
                            La pregunta se guardará en esa sección.
                          </div>
                        </div>
                        <textarea
                          className="min-h-[60px] w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm"
                          placeholder="Texto de la pregunta"
                          value={qTexto}
                          onChange={(e) => setQTexto(e.target.value)}
                        />
                        <div className="grid gap-2 md:grid-cols-3">
                          <select
                            className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm"
                            value={qTipo}
                            onChange={(e) => setQTipo(e.target.value)}
                          >
                            {QUESTION_TYPES.map((t) => (
                              <option key={t.value} value={t.value}>
                                {t.label}
                              </option>
                            ))}
                          </select>
                          <label className="flex items-center gap-2 text-xs">
                            <input type="checkbox" checked={qRequired} onChange={(e) => setQRequired(e.target.checked)} />
                            Obligatoria
                          </label>
                          {qTipo === "yes_no_nivel" && (
                            <select
                              className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm"
                              value={qNiveles}
                              onChange={(e) => setQNiveles(Number(e.target.value))}
                            >
                              <option value={3}>3 niveles</option>
                              <option value={5}>5 niveles</option>
                            </select>
                          )}
                        </div>
                        {qTipo === "yes_no_nivel" && (
                          <div className="grid gap-2 md:grid-cols-3">
                            {Array.from({ length: qNiveles }, (_, i) => (
                              <input
                                key={i}
                                className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm"
                                placeholder={`Nivel ${i + 1}`}
                                value={qNivelLabels[i] ?? ""}
                                onChange={(e) => {
                                  const next = [...qNivelLabels];
                                  next[i] = e.target.value;
                                  setQNivelLabels(next);
                                }}
                              />
                            ))}
                          </div>
                        )}
                        {qTipo === "opciones" && (
                          <div className="space-y-2">
                            <textarea
                              className="min-h-[70px] w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm"
                              placeholder="Opciones (una por línea)"
                              value={qOpciones}
                              onChange={(e) => setQOpciones(e.target.value)}
                            />
                            <label className="flex items-center gap-2 text-xs">
                              <input type="checkbox" checked={qMulti} onChange={(e) => setQMulti(e.target.checked)} />
                              Selección múltiple
                            </label>
                          </div>
                        )}
                        <label className="flex items-center gap-2 text-xs">
                          <input
                            type="checkbox"
                            checked={qIncludeObs}
                            onChange={(e) => setQIncludeObs(e.target.checked)}
                          />
                          Incluir campo Observaciones
                        </label>
                        <div className="rounded-lg border border-white/10 bg-black/20 p-3">
                          <div className="text-xs text-white/60">
                            Campos adicionales por pregunta
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                setQExtraFields((v) =>
                                  v.some((f) => f.label === "Evidencia")
                                    ? v
                                    : [...v, { label: "Evidencia", mode: "registro", default_value: "" }]
                                )
                              }
                              className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[11px]"
                            >
                              + Evidencia
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setQExtraFields((v) =>
                                  v.some((f) => f.label === "Recomendación")
                                    ? v
                                    : [...v, { label: "Recomendación", mode: "registro", default_value: "" }]
                                )
                              }
                              className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[11px]"
                            >
                              + Recomendación
                            </button>
                          </div>
                          <div className="mt-2 flex gap-2">
                            <input
                              className="flex-1 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm"
                              placeholder="Nuevo campo (ej. Requisito)"
                              value={qExtraFieldInput}
                              onChange={(e) => setQExtraFieldInput(e.target.value)}
                            />
                            <select
                              className="rounded-lg border border-white/10 bg-black/30 px-2 py-2 text-xs"
                              value={qExtraFieldMode}
                              onChange={(e) =>
                                setQExtraFieldMode((e.target.value as "registro" | "elaboracion") || "registro")
                              }
                            >
                              <option value="registro">Se llena al registrar</option>
                              <option value="elaboracion">Se define en elaboración</option>
                            </select>
                            {qExtraFieldMode === "elaboracion" && (
                              <input
                                className="min-w-[180px] rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm"
                                placeholder="Valor en elaboración"
                                value={qExtraFieldDefault}
                                onChange={(e) => setQExtraFieldDefault(e.target.value)}
                              />
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                const next = qExtraFieldInput.trim();
                                if (!next) return;
                                setQExtraFields((v) =>
                                  v.some((f) => f.label === next)
                                    ? v
                                    : [
                                        ...v,
                                        {
                                          label: next,
                                          mode: qExtraFieldMode,
                                          default_value: qExtraFieldMode === "elaboracion" ? qExtraFieldDefault : "",
                                        },
                                      ]
                                );
                                setQExtraFieldInput("");
                                setQExtraFieldDefault("");
                              }}
                              className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/80"
                            >
                              Agregar
                            </button>
                          </div>
                          {qExtraFields.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-2">
                              {qExtraFields.map((x) => (
                                <span
                                  key={x.label}
                                  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[11px]"
                                >
                                  {x.label}
                                  <select
                                    value={x.mode}
                                    onChange={(e) =>
                                      setQExtraFields((prev) =>
                                        prev.map((it) =>
                                          it.label === x.label
                                            ? {
                                                ...it,
                                                mode:
                                                  (e.target.value as "registro" | "elaboracion") || "registro",
                                              }
                                            : it
                                        )
                                      )
                                    }
                                    className="rounded border border-white/10 bg-black/30 px-1 py-0.5 text-[10px]"
                                  >
                                    <option value="registro">Registro</option>
                                    <option value="elaboracion">Elaboración</option>
                                  </select>
                                  {x.mode === "elaboracion" && (
                                    <input
                                      className="w-28 rounded border border-white/10 bg-black/30 px-1 py-0.5 text-[10px]"
                                      value={x.default_value ?? ""}
                                      placeholder="Valor"
                                      onChange={(e) =>
                                        setQExtraFields((prev) =>
                                          prev.map((it) =>
                                            it.label === x.label
                                              ? { ...it, default_value: e.target.value }
                                              : it
                                          )
                                        )
                                      }
                                    />
                                  )}
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setQExtraFields((v) => v.filter((it) => it.label !== x.label))
                                    }
                                    className="text-white/70"
                                  >
                                    ✕
                                  </button>
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => saveQuestion(false)}
                            className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/80"
                          >
                            {editingQuestionId ? "Guardar cambios" : "Guardar pregunta"}
                          </button>
                          <button
                            type="button"
                            onClick={() => saveQuestion(true)}
                            className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/80"
                          >
                            Guardar y agregar otra
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              resetQuestionForm();
                              setShowQuestionForm(false);
                            }}
                            className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/80"
                          >
                            Cancelar
                          </button>
                        </div>
                        </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          <ConfirmDialog
            open={rebuildIeOpen}
            title="Reaplicar filtros"
            description="¿Seguro que deseas regenerar las IE según filtros? Se perderán las IE focalizadas actuales."
            confirmText="Reaplicar"
            cancelText="Cancelar"
            variant="default"
            busy={rebuildIeBusy}
            onClose={() => !rebuildIeBusy && setRebuildIeOpen(false)}
            onConfirm={() => selected && rebuildIeFromFilters(selected.id)}
          />

          <ConfirmDialog
            open={deleteMonOpen}
            title="Eliminar monitoreo"
            description={
              deleteSummaryBusy ? (
                "Calculando resumen de eliminación..."
              ) : deleteSummary ? (
                <div className="space-y-2">
                  <div>
                    Estas a punto de eliminar <b>{deleteSummary.monitoreoNombre}</b> (
                    {deleteSummary.monitoreoCodigo}).
                  </div>
                  <div>Fichas: {deleteSummary.fichas.length}</div>
                  <div>Registros totales de fichas: {deleteSummary.totalRegistros}</div>
                  <div>Asignaciones de monitores: {deleteSummary.totalAsignacionesMonitor}</div>
                  <div>IE asignadas: {deleteSummary.totalAsignacionesIe}</div>
                  <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-2 py-1 text-[11px] text-red-100">
                    Esta acción eliminará toda la data relacionada y no se puede deshacer.
                  </div>
                  <div className="max-h-28 overflow-auto rounded border border-white/10 bg-black/20 p-2 text-[11px]">
                    {deleteSummary.fichas.map((f) => (
                      <div key={f.titulo} className="flex items-center justify-between gap-2">
                        <span className="truncate">{f.titulo}</span>
                        <span>{f.registros} registros</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                "No se pudo calcular el resumen. Si continúas, se intentará eliminar todo el monitoreo."
              )
            }
            confirmText="Eliminar"
            cancelText="Cancelar"
            variant="danger"
            busy={deleteMonBusy || deleteSummaryBusy}
            onClose={() => !(deleteMonBusy || deleteSummaryBusy) && setDeleteMonOpen(false)}
            onConfirm={() => selected && deleteMonitoreoFull(selected.id)}
          />
        </section>
      </div>
      {previewOpen && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/70"
            onClick={() => setPreviewOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute inset-0 flex items-start justify-center p-4 md:items-center">
            <div className="w-full max-w-3xl max-h-[90vh] overflow-hidden rounded-2xl border border-white/10 bg-zinc-950 shadow-2xl">
              <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
                <div className="text-sm font-semibold">Vista previa de ficha</div>
                <button
                  onClick={() => setPreviewOpen(false)}
                  className="rounded-lg px-2 py-1 text-xs text-white/70 hover:bg-white/5"
                >
                  Cerrar
                </button>
              </div>
              <div className="max-h-[calc(90vh-72px)] overflow-y-auto px-6 py-5">
                <div className="space-y-4">
                  {selectedTemplate && (
                    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                      <div className="text-lg font-semibold">{selectedTemplate.titulo}</div>
                      {selectedTemplate.subtitulo && (
                        <div className="text-sm text-white/60">{selectedTemplate.subtitulo}</div>
                      )}
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => savePreview({ ...previewData })}
                          className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100"
                        >
                          Guardar borrador
                        </button>
                        <button
                          type="button"
                          onClick={() => savePreview({ ...previewData })}
                          className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100"
                        >
                          Guardar en BD
                        </button>
                        <button
                          type="button"
                          onClick={exportPreviewPdf}
                          className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/80"
                        >
                          Exportar PDF
                        </button>
                      </div>
                      <div className="mt-2 text-[11px] text-white/50">
                        Vista previa: el guardado es local para pruebas.
                      </div>
                    </div>
                  )}
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <div className="text-sm font-semibold">Encabezado</div>
                    <div className="mt-2 grid gap-3 md:grid-cols-2 text-xs text-white/70">
                      {templateHeader.institucion && (
                        <label className="block">
                          <div className="mb-1 text-[11px] text-white/60">Institución educativa</div>
                          <input
                            className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm"
                            value={previewData.__header?.institucion ?? ""}
                            onChange={(e) =>
                              savePreview({
                                ...previewData,
                                __header: { ...previewData.__header, institucion: e.target.value },
                              })
                            }
                          />
                        </label>
                      )}
                      {templateHeader.codigo_modular && (
                        <label className="block">
                          <div className="mb-1 text-[11px] text-white/60">Código modular</div>
                          <input
                            className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm"
                            value={previewData.__header?.codigo_modular ?? ""}
                            onChange={(e) =>
                              savePreview({
                                ...previewData,
                                __header: { ...previewData.__header, codigo_modular: e.target.value },
                              })
                            }
                          />
                        </label>
                      )}
                      {templateHeader.codigo_local && (
                        <label className="block">
                          <div className="mb-1 text-[11px] text-white/60">Código local</div>
                          <input
                            className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm"
                            value={previewData.__header?.codigo_local ?? ""}
                            onChange={(e) =>
                              savePreview({
                                ...previewData,
                                __header: { ...previewData.__header, codigo_local: e.target.value },
                              })
                            }
                          />
                        </label>
                      )}
                      {templateHeader.distrito && (
                        <label className="block">
                          <div className="mb-1 text-[11px] text-white/60">Distrito / lugar</div>
                          <input
                            className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm"
                            value={previewData.__header?.distrito ?? ""}
                            onChange={(e) =>
                              savePreview({
                                ...previewData,
                                __header: { ...previewData.__header, distrito: e.target.value },
                              })
                            }
                          />
                        </label>
                      )}
                      {templateHeader.rei && (
                        <label className="block">
                          <div className="mb-1 text-[11px] text-white/60">REI</div>
                          <input
                            className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm"
                            value={previewData.__header?.rei ?? ""}
                            onChange={(e) =>
                              savePreview({
                                ...previewData,
                                __header: { ...previewData.__header, rei: e.target.value },
                              })
                            }
                          />
                        </label>
                      )}
                      {templateHeader.monitor && (
                        <label className="block">
                          <div className="mb-1 text-[11px] text-white/60">Monitor</div>
                          <input
                            className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm"
                            value={previewData.__header?.monitor ?? ""}
                            onChange={(e) =>
                              savePreview({
                                ...previewData,
                                __header: { ...previewData.__header, monitor: e.target.value },
                              })
                            }
                          />
                        </label>
                      )}
                      {templateHeader.monitor_doc_tipo && (
                        <label className="block">
                          <div className="mb-1 text-[11px] text-white/60">Tipo doc. monitor</div>
                          <input
                            className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm"
                            value={previewData.__header?.monitor_doc_tipo ?? ""}
                            onChange={(e) =>
                              savePreview({
                                ...previewData,
                                __header: { ...previewData.__header, monitor_doc_tipo: e.target.value },
                              })
                            }
                          />
                        </label>
                      )}
                      {templateHeader.monitor_numero_doc && (
                        <label className="block">
                          <div className="mb-1 text-[11px] text-white/60">Numero doc. monitor</div>
                          <input
                            className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm"
                            value={previewData.__header?.monitor_numero_doc ?? ""}
                            onChange={(e) =>
                              savePreview({
                                ...previewData,
                                __header: { ...previewData.__header, monitor_numero_doc: e.target.value },
                              })
                            }
                          />
                        </label>
                      )}
                      {templateHeader.monitoreado && (
                        <label className="block">
                          <div className="mb-1 text-[11px] text-white/60">Monitoreado</div>
                          <input
                            className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm"
                            value={previewData.__header?.monitoreado ?? ""}
                            onChange={(e) =>
                              savePreview({
                                ...previewData,
                                __header: { ...previewData.__header, monitoreado: e.target.value },
                              })
                            }
                          />
                        </label>
                      )}
                      {templateHeader.monitoreado_doc_tipo && (
                        <label className="block">
                          <div className="mb-1 text-[11px] text-white/60">Tipo doc. monitoreado</div>
                          <input
                            className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm"
                            value={previewData.__header?.monitoreado_doc_tipo ?? ""}
                            onChange={(e) =>
                              savePreview({
                                ...previewData,
                                __header: { ...previewData.__header, monitoreado_doc_tipo: e.target.value },
                              })
                            }
                          />
                        </label>
                      )}
                      {templateHeader.monitoreado_numero_doc && (
                        <label className="block">
                          <div className="mb-1 text-[11px] text-white/60">Numero doc. monitoreado</div>
                          <input
                            className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm"
                            value={previewData.__header?.monitoreado_numero_doc ?? ""}
                            onChange={(e) =>
                              savePreview({
                                ...previewData,
                                __header: { ...previewData.__header, monitoreado_numero_doc: e.target.value },
                              })
                            }
                          />
                        </label>
                      )}
                      {templateHeader.monitoreado_cargo && (
                        <label className="block">
                          <div className="mb-1 text-[11px] text-white/60">Cargo monitoreado</div>
                          <input
                            className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm"
                            value={previewData.__header?.monitoreado_cargo ?? ""}
                            onChange={(e) =>
                              savePreview({
                                ...previewData,
                                __header: { ...previewData.__header, monitoreado_cargo: e.target.value },
                              })
                            }
                          />
                        </label>
                      )}
                      {templateHeader.monitoreado_telefono && (
                        <label className="block">
                          <div className="mb-1 text-[11px] text-white/60">Telefono monitoreado</div>
                          <input
                            className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm"
                            value={previewData.__header?.monitoreado_telefono ?? ""}
                            onChange={(e) =>
                              savePreview({
                                ...previewData,
                                __header: { ...previewData.__header, monitoreado_telefono: e.target.value },
                              })
                            }
                          />
                        </label>
                      )}
                      {templateHeader.monitoreado_correo && (
                        <label className="block">
                          <div className="mb-1 text-[11px] text-white/60">Correo monitoreado</div>
                          <input
                            className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm"
                            value={previewData.__header?.monitoreado_correo ?? ""}
                            onChange={(e) =>
                              savePreview({
                                ...previewData,
                                __header: { ...previewData.__header, monitoreado_correo: e.target.value },
                              })
                            }
                          />
                        </label>
                      )}
                      {templateHeader.condicion && (
                        <label className="block">
                          <div className="mb-1 text-[11px] text-white/60">Condición de monitoreado</div>
                          <select
                            className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm"
                            value={previewData.__header?.condicion ?? ""}
                            onChange={(e) =>
                              savePreview({
                                ...previewData,
                                __header: { ...previewData.__header, condicion: e.target.value },
                              })
                            }
                          >
                            <option value="">Seleccionar</option>
                            <option value="DESIGNADO">Designado</option>
                            <option value="ENCARGADO">Encargado</option>
                          </select>
                        </label>
                      )}
                      {templateHeader.area && (
                        <label className="block md:col-span-2">
                          <div className="mb-1 text-[11px] text-white/60">Área que monitorea</div>
                          {templateHeader.area_options?.length ? (
                            <select
                              className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm"
                              value={previewData.__header?.area ?? ""}
                              onChange={(e) =>
                                savePreview({
                                  ...previewData,
                                  __header: { ...previewData.__header, area: e.target.value },
                                })
                              }
                            >
                              {templateHeader.area_options.map((o: string) => (
                                <option key={o} value={o}>
                                  {o}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <input
                              className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm"
                              value={previewData.__header?.area ?? ""}
                              onChange={(e) =>
                                savePreview({
                                  ...previewData,
                                  __header: { ...previewData.__header, area: e.target.value },
                                })
                              }
                            />
                          )}
                        </label>
                      )}
                      {templateHeader.numero_visitas && (
                        <label className="block">
                          <div className="mb-1 text-[11px] text-white/60">Numero de visitas a la IE</div>
                          <input
                            className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm"
                            value={previewData.__header?.numero_visitas ?? ""}
                            onChange={(e) =>
                              savePreview({
                                ...previewData,
                                __header: { ...previewData.__header, numero_visitas: e.target.value },
                              })
                            }
                          />
                        </label>
                      )}
                      {templateHeader.fecha_aplicacion && (
                        <label className="block">
                          <div className="mb-1 text-[11px] text-white/60">Fecha de aplicacion</div>
                          <input
                            type="date"
                            className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm"
                            value={previewData.__header?.fecha_aplicacion ?? ""}
                            onChange={(e) =>
                              savePreview({
                                ...previewData,
                                __header: { ...previewData.__header, fecha_aplicacion: e.target.value },
                              })
                            }
                          />
                        </label>
                      )}
                      {templateHeader.hora_inicio && (
                        <label className="block">
                          <div className="mb-1 text-[11px] text-white/60">Hora de inicio</div>
                          <TimeField
                            value={previewData.__header?.hora_inicio ?? ""}
                            onChange={(value) =>
                              savePreview({
                                ...previewData,
                                __header: { ...previewData.__header, hora_inicio: value },
                              })
                            }
                          />
                        </label>
                      )}
                      {templateHeader.hora_fin && (
                        <label className="block">
                          <div className="mb-1 text-[11px] text-white/60">Hora de fin</div>
                          <TimeField
                            value={previewData.__header?.hora_fin ?? ""}
                            onChange={(value) =>
                              savePreview({
                                ...previewData,
                                __header: { ...previewData.__header, hora_fin: value },
                              })
                            }
                          />
                        </label>
                      )}
                      {(templateHeader.custom_fields ?? []).map((field: HeaderFieldDef) => (
                        <label
                          key={field.id}
                          className={`block ${field.type === "select" && field.options.length > 4 ? "md:col-span-2" : ""}`}
                        >
                          <div className="mb-1 text-[11px] text-white/60">
                            {field.label}
                            {field.required ? " *" : ""}
                          </div>
                          {field.type === "select" ? (
                            <select
                              className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm"
                              value={previewData.__header?.custom_values?.[field.key] ?? ""}
                              onChange={(e) =>
                                savePreview({
                                  ...previewData,
                                  __header: {
                                    ...previewData.__header,
                                    custom_values: {
                                      ...(previewData.__header?.custom_values ?? {}),
                                      [field.key]: e.target.value,
                                    },
                                  },
                                })
                              }
                            >
                              <option value="">Seleccionar</option>
                              {field.options.map((opt) => (
                                <option key={opt} value={opt}>
                                  {opt}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <input
                              type={field.type === "number" ? "number" : "text"}
                              inputMode={field.type === "number" ? "numeric" : undefined}
                              className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm"
                              value={previewData.__header?.custom_values?.[field.key] ?? ""}
                              placeholder={field.placeholder || field.label}
                              onChange={(e) =>
                                savePreview({
                                  ...previewData,
                                  __header: {
                                    ...previewData.__header,
                                    custom_values: {
                                      ...(previewData.__header?.custom_values ?? {}),
                                      [field.key]:
                                        field.type === "number" ? e.target.value.replace(/[^\d]/g, "") : e.target.value,
                                    },
                                  },
                                })
                              }
                            />
                          )}
                        </label>
                      ))}
                    </div>
                  </div>
                  {templateHeader.nivel_avance ? (
                    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                      <div className="text-sm font-semibold">Niveles de respuesta (Sí)</div>
                      <div className="mt-2 grid gap-2 md:grid-cols-3 text-xs text-white/70">
                        {((templateHeader.nivel_avance_info ?? []).length
                          ? templateHeader.nivel_avance_info
                          : DEFAULT_NIVEL_INFO
                        ).map((x: any, idx: number) => (
                          <div
                            key={`${x.nivel}-${idx}`}
                            className="rounded-lg border border-white/10 bg-black/30 p-2"
                          >
                            <div className="text-[11px] text-white/60">Nivel {x.nivel}</div>
                            <div className="text-xs text-white/80">{x.descripcion}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {sections.map((s) => (
                    <div key={s.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
                      <div className="text-sm font-semibold">{s.titulo}</div>
                      <div className="mt-3 space-y-3">
                        {questions.filter((q) => q.section_id === s.id).map((q) => (
                    <div key={q.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
                      <div className="text-sm font-semibold">{q.orden_in_section ?? q.orden}. {q.texto}</div>
                      <div className="mt-2">
                        {q.tipo === "yes_no" && (
                          <div className="flex gap-3 text-xs text-white/70">
                            <label className="flex items-center gap-2">
                              <input
                                type="radio"
                                name={`yn-${q.id}`}
                                checked={previewData[q.id]?.yn === "SI"}
                                onChange={() => savePreview({ ...previewData, [q.id]: { ...previewData[q.id], yn: "SI" } })}
                              />
                              Sí
                            </label>
                            <label className="flex items-center gap-2">
                              <input
                                type="radio"
                                name={`yn-${q.id}`}
                                checked={previewData[q.id]?.yn === "NO"}
                                onChange={() => savePreview({ ...previewData, [q.id]: { ...previewData[q.id], yn: "NO", nivel: undefined } })}
                              />
                              No
                            </label>
                          </div>
                        )}
                        {q.tipo === "yes_no_nivel" && (
                          <div className="space-y-2 text-xs text-white/70">
                            <div className="flex gap-3">
                              <label className="flex items-center gap-2">
                                <input
                                  type="radio"
                                  name={`ynn-${q.id}`}
                                  checked={previewData[q.id]?.yn === "SI"}
                                  onChange={() => savePreview({ ...previewData, [q.id]: { ...previewData[q.id], yn: "SI" } })}
                                />
                                Sí
                              </label>
                              <label className="flex items-center gap-2">
                                <input
                                  type="radio"
                                  name={`ynn-${q.id}`}
                                  checked={previewData[q.id]?.yn === "NO"}
                                  onChange={() => savePreview({ ...previewData, [q.id]: { ...previewData[q.id], yn: "NO", nivel: undefined } })}
                                />
                                No
                              </label>
                            </div>
                            {previewData[q.id]?.yn === "SI" ? (
                              <div className="flex flex-wrap gap-2">
                                {(q.config_json?.levelLabels?.length
                                  ? q.config_json.levelLabels
                                  : Array.from({ length: q.config_json?.levels ?? 3 }, (_, i) => `Nivel ${i + 1}`)
                                ).map((l: string, i: number) => (
                                  <label
                                    key={`${q.id}-lvl-${i}`}
                                    className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px]"
                                  >
                                    <input
                                      type="radio"
                                      name={`nivel-${q.id}`}
                                      checked={previewData[q.id]?.nivel === l}
                                      onChange={() =>
                                        savePreview({
                                          ...previewData,
                                          [q.id]: { ...previewData[q.id], nivel: l },
                                        })
                                      }
                                    />
                                    {l}
                                  </label>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        )}
                        {q.tipo === "opciones" && (
                          <div className="mt-2 grid gap-2 text-xs text-white/70">
                            {(q.config_json?.options ?? []).map((opt: string, i: number) => (
                              <label key={`${q.id}-opt-${i}`} className="flex items-center gap-2">
                                <input
                                  type={q.config_json?.multi ? "checkbox" : "radio"}
                                  name={`opt-${q.id}`}
                                  checked={
                                    q.config_json?.multi
                                      ? (previewData[q.id]?.options ?? []).includes(opt)
                                      : previewData[q.id]?.option === opt
                                  }
                                  onChange={(e) => {
                                    if (q.config_json?.multi) {
                                      const current = new Set(previewData[q.id]?.options ?? []);
                                      if (e.target.checked) current.add(opt);
                                      else current.delete(opt);
                                      savePreview({
                                        ...previewData,
                                        [q.id]: { ...previewData[q.id], options: Array.from(current) },
                                      });
                                    } else {
                                      savePreview({
                                        ...previewData,
                                        [q.id]: { ...previewData[q.id], option: opt },
                                      });
                                    }
                                  }}
                                />
                                {opt}
                              </label>
                            ))}
                          </div>
                        )}
                        {q.tipo === "texto" && (
                          <textarea
                            className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm"
                            placeholder="Respuesta..."
                            value={previewData[q.id]?.text ?? ""}
                            onChange={(e) =>
                              savePreview({
                                ...previewData,
                                [q.id]: { ...previewData[q.id], text: e.target.value },
                              })
                            }
                          />
                        )}
                        {q.tipo === "numero" && (
                          <input
                            type="number"
                            className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm"
                            value={previewData[q.id]?.number ?? ""}
                            onChange={(e) =>
                              savePreview({
                                ...previewData,
                                [q.id]: { ...previewData[q.id], number: e.target.value },
                              })
                            }
                          />
                        )}
                        {q.tipo === "archivo_pdf" && (
                          <div className="mt-2 space-y-2 text-xs text-white/70">
                            <input
                              type="file"
                              accept="application/pdf"
                              className="block w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm"
                              onChange={(e) =>
                                savePreview({
                                  ...previewData,
                                  [q.id]: { ...previewData[q.id], fileName: e.target.files?.[0]?.name ?? "" },
                                })
                              }
                            />
                            {previewData[q.id]?.fileName ? (
                              <div className="text-[11px] text-white/60">
                                Archivo: {previewData[q.id].fileName}
                              </div>
                            ) : null}
                          </div>
                        )}
                        {q.config_json?.include_obs !== false && (
                          <div className="mt-3">
                            <div className="text-[11px] text-white/60">Observaciones</div>
                            <textarea
                              className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm"
                              placeholder="Observaciones..."
                              value={previewData[q.id]?.obs ?? ""}
                              onChange={(e) =>
                                savePreview({
                                  ...previewData,
                                  [q.id]: { ...previewData[q.id], obs: e.target.value },
                                })
                              }
                            />
                          </div>
                        )}
                        {normalizeExtraFields(q.config_json?.extra_fields).map((field) => (
                              <div className="mt-3" key={`${q.id}-${field.label}`}>
                                <div className="text-[11px] text-white/60">{field.label}</div>
                                {field.mode === "elaboracion" ? (
                                  <input
                                    className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm"
                                    value={field.default_value ?? ""}
                                    readOnly
                                  />
                                ) : (
                                  <textarea
                                    className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm"
                                    placeholder={`${field.label}...`}
                                    value={previewData[q.id]?.extra?.[field.label] ?? ""}
                                    onChange={(e) =>
                                      savePreview({
                                        ...previewData,
                                        [q.id]: {
                                          ...previewData[q.id],
                                          extra: {
                                            ...(previewData[q.id]?.extra ?? {}),
                                            [field.label]: e.target.value,
                                          },
                                        },
                                      })
                                    }
                                  />
                                )}
                              </div>
                            ))}
                      </div>
                    </div>
                        ))}
                      </div>
                    </div>
                  ))}
                  {sections.length === 0 && (
                    <div className="text-sm text-white/60">No hay secciones definidas.</div>
                  )}
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <div className="text-sm font-semibold">Cierre</div>
                    <div className="mt-2 grid gap-3 md:grid-cols-2 text-xs text-white/70">
                      {templateFooter.observacion && (
                        <label className="block md:col-span-2">
                          <div className="mb-1 text-[11px] text-white/60">Observación general</div>
                          <textarea
                            className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm"
                            value={previewData.__footer?.observacion ?? ""}
                            onChange={(e) =>
                              savePreview({
                                ...previewData,
                                __footer: { ...previewData.__footer, observacion: e.target.value },
                              })
                            }
                          />
                        </label>
                      )}
                      {templateFooter.compromiso && (
                        <label className="block md:col-span-2">
                          <div className="mb-1 text-[11px] text-white/60">Compromiso general</div>
                          <textarea
                            className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm"
                            value={previewData.__footer?.compromiso ?? ""}
                            onChange={(e) =>
                              savePreview({
                                ...previewData,
                                __footer: { ...previewData.__footer, compromiso: e.target.value },
                              })
                            }
                          />
                        </label>
                      )}
                      {templateFooter.lugar && (
                        <label className="block">
                          <div className="mb-1 text-[11px] text-white/60">Lugar</div>
                          <input
                            className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm"
                            value={previewData.__footer?.lugar ?? ""}
                            onChange={(e) =>
                              savePreview({
                                ...previewData,
                                __footer: { ...previewData.__footer, lugar: e.target.value },
                              })
                            }
                          />
                        </label>
                      )}
                      {templateFooter.fecha && (
                        <label className="block">
                          <div className="mb-1 text-[11px] text-white/60">Fecha</div>
                          <input
                            type="date"
                            className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm"
                            value={previewData.__footer?.fecha ?? ""}
                            onChange={(e) =>
                              savePreview({
                                ...previewData,
                                __footer: { ...previewData.__footer, fecha: e.target.value },
                              })
                            }
                          />
                        </label>
                      )}
                      {templateFooter.docente_nombre && (
                        <label className="block">
                          <div className="mb-1 text-[11px] text-white/60">Nombre monitoreado</div>
                          <input
                            className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm"
                            value={previewData.__footer?.docente_nombre ?? ""}
                            onChange={(e) =>
                              savePreview({
                                ...previewData,
                                __footer: { ...previewData.__footer, docente_nombre: e.target.value },
                              })
                            }
                          />
                        </label>
                      )}
                      {templateFooter.docente_dni && (
                        <label className="block">
                          <div className="mb-1 text-[11px] text-white/60">DNI monitoreado</div>
                          <input
                            className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm"
                            value={previewData.__footer?.docente_dni ?? ""}
                            onChange={(e) =>
                              savePreview({
                                ...previewData,
                                __footer: { ...previewData.__footer, docente_dni: e.target.value },
                              })
                            }
                          />
                        </label>
                      )}
                      {templateFooter.monitor_nombre && (
                        <label className="block">
                          <div className="mb-1 text-[11px] text-white/60">Nombre monitor</div>
                          <input
                            className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm"
                            value={previewData.__footer?.monitor_nombre ?? ""}
                            onChange={(e) =>
                              savePreview({
                                ...previewData,
                                __footer: { ...previewData.__footer, monitor_nombre: e.target.value },
                              })
                            }
                          />
                        </label>
                      )}
                      {templateFooter.monitor_dni && (
                        <label className="block">
                          <div className="mb-1 text-[11px] text-white/60">DNI monitor</div>
                          <input
                            className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm"
                            value={previewData.__footer?.monitor_dni ?? ""}
                            onChange={(e) =>
                              savePreview({
                                ...previewData,
                                __footer: { ...previewData.__footer, monitor_dni: e.target.value },
                              })
                            }
                          />
                        </label>
                      )}
                      {templateFooter.firmas && (
                        <div className="md:col-span-2 mt-2 grid gap-4 md:grid-cols-2">
                          <div className="border-t border-white/30 pt-2 text-center text-[11px] text-white/60">
                            Firma monitoreado
                          </div>
                          <div className="border-t border-white/30 pt-2 text-center text-[11px] text-white/60">
                            Firma monitor
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  {questions.length === 0 && (
                    <div className="text-sm text-white/60">Aún no hay preguntas para previsualizar.</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
