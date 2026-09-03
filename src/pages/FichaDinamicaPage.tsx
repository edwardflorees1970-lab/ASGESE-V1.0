import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../app/AuthProvider";
import { useAppConfig } from "../app/AppConfigProvider";
import { isMonitoreoExpired } from "../lib/monitoreoVigencia";
import { groupMatrixCols, computeMatrixAutoTotals } from "./GestionMonitoreos/helpers";
import {
  DEFAULT_HEADER_CONFIG,
  normalizeCustomHeaderValues,
  normalizeHeaderConfig,
  type HeaderFieldDef,
} from "../lib/dynamicHeader";
import { deleteFormRunAtomic, saveFormRunAtomic } from "../lib/formRunApi";
import { uploadPdfEvidence, validatePdfEvidence } from "../lib/evidenceStorage";

type Template = {
  id: string;
  titulo: string;
  codigo: string;
  subtitulo: string | null;
  header_config: any;
  footer_config: any;
};

type Section = {
  id: string;
  template_id: string;
  titulo: string;
  orden: number;
};

type Question = {
  id: string;
  template_id: string;
  section_id: string | null;
  tipo: string;
  texto: string;
  subtitulo?: string | null;
  orden: number;
  orden_in_section: number | null;
  required: boolean;
  config_json: any;
};

type InstitucionLite = {
  id: string;
  nombre: string;
  codigo_modular: string;
  codigo_local: string | null;
  rei: string | null;
  nivel?: { nombre: string } | { nombre: string }[] | null;
  distrito?: { nombre: string } | { nombre: string }[] | null;
};

type HeaderState = {
  institucion: string;
  codigo_modular: string;
  codigo_local: string;
  distrito: string;
  rei: string;
  monitor: string;
  monitor_doc_tipo: "DNI" | "CE";
  monitor_numero_doc: string;
  monitoreado: string;
  monitoreado_doc_tipo: "DNI" | "CE";
  monitoreado_numero_doc: string;
  monitoreado_cargo: string;
  monitoreado_telefono: string;
  monitoreado_correo: string;
  condicion: string;
  area: string;
  numero_visitas: string;
  fecha_aplicacion: string;
  hora_inicio: string;
  hora_fin: string;
  custom_values: Record<string, string>;
};

type FooterState = {
  observacion: string;
  compromiso: string;
  lugar: string;
  fecha: string;
  docente_nombre: string;
  docente_doc_tipo: "DNI" | "CE";
  docente_dni: string;
  monitor_nombre: string;
  monitor_doc_tipo: "DNI" | "CE";
  monitor_dni: string;
};

type ToastState = {
  type: "ok" | "err";
  msg: string;
};

type NivelInfo = {
  nivel: number;
  descripcion: string;
};

type ExtraFieldCfg = {
  label: string;
  mode: "registro" | "elaboracion";
  default_value?: string | null;
};

type LocalDraftSnapshot = {
  runId: string | null;
  runStatus: string | null;
  header: HeaderState;
  footer: FooterState;
  answers: Record<string, any>;
  updatedAt: string;
};

const DUP_RULE_NONE = "none";
const DUP_RULE_LOCAL = "codigo_local";
const DUP_RULE_MODULAR = "codigo_modular";
const DUP_RULE_MARKER = "__restriccion_duplicado__";

function SectionsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.5 6h11M8.5 12h11M8.5 18h11" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 6h.01M4.5 12h.01M4.5 18h.01" />
    </svg>
  );
}

type SolicitudFilters = {
  gestiones: string[];
  modalidades: string[];
  niveles: string[];
};

function normalizeFilterText(value: string | null | undefined) {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}

function sameCatalogFilter(catalogName: string | null | undefined, filterValue: string) {
  const catalog = normalizeFilterText(catalogName);
  const filter = normalizeFilterText(filterValue);
  if (!catalog || !filter) return false;
  if (catalog === filter || catalog.includes(filter) || filter.includes(catalog)) return true;
  if (filter === "PRONOEI") {
    return catalog.includes("PRONOEI") || catalog.includes("NO ESCOLARIZADO");
  }
  return false;
}

function normalizeInstitucionRow(row: any): InstitucionLite {
  return {
    ...row,
    nivel: Array.isArray(row?.nivel) ? row.nivel[0] ?? null : row?.nivel ?? null,
    distrito: Array.isArray(row?.distrito) ? row.distrito[0] ?? null : row?.distrito ?? null,
  } as InstitucionLite;
}

const FIXED_HEADER_KEYS = [
  "institucion",
  "codigo_modular",
  "codigo_local",
  "distrito",
  "rei",
  "monitor",
  "monitor_doc_tipo",
  "monitor_numero_doc",
  "monitoreado",
  "monitoreado_doc_tipo",
  "monitoreado_numero_doc",
  "monitoreado_cargo",
  "monitoreado_telefono",
  "monitoreado_correo",
  "condicion",
  "area",
  "numero_visitas",
  "fecha_aplicacion",
  "hora_inicio",
  "hora_fin",
  "nivel_avance",
];

type Tone = "red" | "amber" | "green";

function levelTone(nivel: number): Tone {
  if (nivel === 1) return "red";
  if (nivel === 2) return "amber";
  return "green";
}

function toneClasses(tone: Tone) {
  switch (tone) {
    case "red":
      return "border-rose-500/40 bg-rose-500/10 text-rose-100";
    case "amber":
      return "border-amber-400/40 bg-amber-400/10 text-amber-100";
    default:
      return "border-emerald-500/40 bg-emerald-500/10 text-emerald-100";
  }
}

function toUpper(value: string) {
  return value.toUpperCase();
}

function onlyDigits(value: string, max: number) {
  return value.replace(/\D/g, "").slice(0, max);
}

function normalizeTime24(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

function cleanStoredTime(value: string) {
  const raw = String(value || "").trim();
  const match = raw.match(/^(\d{2}):(\d{2})(?::\d{2})?$/);
  if (!match) return normalizeTime24(raw);
  return `${match[1]}:${match[2]}`;
}

function isValidTime24(value: string) {
  if (!/^\d{2}:\d{2}$/.test(value)) return false;
  const [hh, mm] = value.split(":").map(Number);
  return hh >= 0 && hh <= 23 && mm >= 0 && mm <= 59;
}

function fieldKey(label: string) {
  return label.toLowerCase().trim().replace(/\s+/g, "_");
}

function isDateWithinRange(date: string, min?: string, max?: string) {
  if (!date) return true;
  if (min && date < min) return false;
  if (max && date > max) return false;
  return true;
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
      return {
        label,
        mode: item.mode === "elaboracion" ? "elaboracion" : "registro",
        default_value: item.default_value ?? "",
      } as ExtraFieldCfg;
    })
    .filter(Boolean) as ExtraFieldCfg[];
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
  className = "",
  ariaLabel = "Hora",
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  ariaLabel?: string;
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
    <div className={`relative ${className}`.trim()}>
      <div className="relative">
        <input
          aria-label={ariaLabel}
          type="text"
          inputMode="numeric"
          maxLength={5}
          placeholder="HH:mm"
          className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 pr-11 text-sm text-white"
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

export function FichaDinamicaPage() {
  const { monitoreoCodigo, fichaCodigo } = useParams();
  const [searchParams] = useSearchParams();
  const runIdParam = searchParams.get("runId");
  const returnTo = searchParams.get("returnTo");
  const midParam = searchParams.get("mid");
  const { user, profile, refreshProfile } = useAuth();
  const { isTestMode } = useAppConfig();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [template, setTemplate] = useState<Template | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [headerCfg, setHeaderCfg] = useState<any>({});
  const [footerCfg, setFooterCfg] = useState<any>({});
  const [header, setHeader] = useState<HeaderState>({
    institucion: "",
    codigo_modular: "",
    codigo_local: "",
    distrito: "",
    rei: "",
    monitor: "",
    monitor_doc_tipo: "DNI",
    monitor_numero_doc: "",
    monitoreado: "",
    monitoreado_doc_tipo: "DNI",
    monitoreado_numero_doc: "",
    monitoreado_cargo: "",
    monitoreado_telefono: "",
    monitoreado_correo: "",
    condicion: "",
    area: "",
    numero_visitas: "",
    fecha_aplicacion: "",
    hora_inicio: "",
    hora_fin: "",
    custom_values: {},
  });
  const [footer, setFooter] = useState<FooterState>({
    observacion: "",
    compromiso: "",
    lugar: "",
    fecha: "",
    docente_nombre: "",
    docente_doc_tipo: "DNI",
    docente_dni: "",
    monitor_nombre: "",
    monitor_doc_tipo: "DNI",
    monitor_dni: "",
  });
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [pendingEvidenceFiles, setPendingEvidenceFiles] = useState<Record<string, File>>({});
  const [runId, setRunId] = useState<string | null>(null);
  const [runStatus, setRunStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showUp, setShowUp] = useState(false);
  const [showDown, setShowDown] = useState(true);
  const [sectionNavOpen, setSectionNavOpen] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const monitorReadOnly = profile?.role === "user" || profile?.role === "responsable_cdd";

  const [ieQuery, setIeQuery] = useState("");
  const [ieOpen, setIeOpen] = useState(false);
  const [ieOptions, setIeOptions] = useState<InstitucionLite[]>([]);
  const [iePool, setIePool] = useState<InstitucionLite[]>([]);
  const [ieLoading, setIeLoading] = useState(false);
  const [runHydrating, setRunHydrating] = useState(false);
  const [solicitudId, setSolicitudId] = useState<string | null>(null);
  const [duplicateRule, setDuplicateRule] = useState<string>(DUP_RULE_NONE);
  const [monitoreoFechaInicio, setMonitoreoFechaInicio] = useState<string>("");
  const [monitoreoFechaFin, setMonitoreoFechaFin] = useState<string>("");
  const [monitorIdentity, setMonitorIdentity] = useState<{
    name: string;
    docTipo: "DNI" | "CE";
    docNumero: string;
  }>({ name: "", docTipo: "DNI", docNumero: "" });

  useEffect(() => {
    if (!sectionNavOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSectionNavOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [sectionNavOpen]);
  const profileMonitorName = [profile?.apellido_paterno, profile?.apellido_materno, profile?.nombres]
    .filter(Boolean)
    .join(" ")
    .trim();
  const profileMonitorDocTipo =
    profile?.tipo_documento === "CE" || profile?.tipo_documento === "DNI"
      ? profile.tipo_documento
      : null;
  const profileMonitorDocNumero = profile?.numero_documento?.trim() || "";
  const effectiveProfileMonitorName = profileMonitorName || monitorIdentity.name;
  const effectiveProfileMonitorDocTipo = profileMonitorDocTipo || monitorIdentity.docTipo;
  const effectiveProfileMonitorDocNumero = profileMonitorDocNumero || monitorIdentity.docNumero;
  const localDraftKey = useMemo(
    () =>
      `ficha-dyn-local:${user?.id || "anon"}:${midParam || monitoreoCodigo || "-"}:${fichaCodigo || "-"}:${
        runIdParam || "new"
      }:${isTestMode ? "test" : "prod"}`,
    [user?.id, midParam, monitoreoCodigo, fichaCodigo, runIdParam, isTestMode]
  );
  const [localDraftPromptOpen, setLocalDraftPromptOpen] = useState(false);
  const [localDraftPending, setLocalDraftPending] = useState<LocalDraftSnapshot | null>(null);
  const shouldAutoFillMonitor = monitorReadOnly && !runIdParam && !runId;
  const isEditMode = Boolean(runIdParam);

  const defaultFooter = {
    observacion: true,
    compromiso: true,
    lugar: true,
    fecha: true,
    docente_nombre: true,
    docente_dni: true,
    monitor_nombre: true,
    monitor_dni: true,
  };
  const effectiveHeaderCfg = useMemo(
    () =>
      normalizeHeaderConfig(
        headerCfg && Object.keys(headerCfg).length ? headerCfg : DEFAULT_HEADER_CONFIG
      ),
    [headerCfg]
  );
  const effectiveFooterCfg = useMemo(
    () => (footerCfg && Object.keys(footerCfg).length ? footerCfg : defaultFooter),
    [footerCfg]
  );
  const customHeaderFields = useMemo(
    () => (effectiveHeaderCfg?.custom_fields ?? []) as HeaderFieldDef[],
    [effectiveHeaderCfg]
  );
  const fixedFieldOrderIndex = useMemo(() => {
    const order = Array.isArray(effectiveHeaderCfg?.field_order) ? effectiveHeaderCfg.field_order : [];
    const index = new Map<string, number>();
    FIXED_HEADER_KEYS.forEach((k, i) => index.set(k, i));
    let cursor = FIXED_HEADER_KEYS.length;
    order.forEach((key: string) => {
      if (!index.has(key)) return;
      index.set(key, cursor);
      cursor += 1;
    });
    return index;
  }, [effectiveHeaderCfg]);
  const fieldOrderStyle = (key: string) => ({ order: fixedFieldOrderIndex.get(key) ?? 0 });
  const nivelInfo: NivelInfo[] = Array.isArray(effectiveHeaderCfg?.nivel_avance_info)
    ? effectiveHeaderCfg.nivel_avance_info
    : [];
  const nivelInfoDisplay =
    effectiveHeaderCfg?.nivel_avance && nivelInfo.length === 0
      ? [
          { nivel: 1, descripcion: "Bajo" },
          { nivel: 2, descripcion: "Medio" },
          { nivel: 3, descripcion: "Alto" },
        ]
      : nivelInfo;

  const areaOptions = useMemo(
    () =>
      (effectiveHeaderCfg?.area_options ?? []).map((v: string) => v.trim()).filter(Boolean),
    [effectiveHeaderCfg]
  );

  const handleBack = () => {
    const go = (path: string) => {
      window.location.assign(path);
    };
    if (returnTo === "reportes") {
      go("/app/reportes");
      return;
    }
    if (monitoreoCodigo) {
      go(`/app/monitoreo/${monitoreoCodigo}`);
      return;
    }
    go("/app/monitoreo");
  };

  const clearLocalDraft = () => {
    localStorage.removeItem(localDraftKey);
    setLocalDraftPending(null);
    setLocalDraftPromptOpen(false);
  };

  const applyLocalDraft = (snapshot: LocalDraftSnapshot) => {
    setRunId(snapshot.runId ?? null);
    setRunStatus(snapshot.runStatus ?? null);
    setHeader((s) => {
      const next = { ...s, ...(snapshot.header ?? {}) };
      return {
        ...next,
        hora_inicio: cleanStoredTime(next.hora_inicio || ""),
        hora_fin: cleanStoredTime(next.hora_fin || ""),
        custom_values: normalizeCustomHeaderValues(customHeaderFields, next.custom_values),
      };
    });
    setFooter((s) => ({ ...s, ...(snapshot.footer ?? {}) }));
    setAnswers(snapshot.answers ?? {});
  };

  const resetFormState = () => {
    clearLocalDraft();
    setRunId(null);
    setRunStatus(null);
    setHeader({
      institucion: "",
      codigo_modular: "",
      codigo_local: "",
      distrito: "",
      rei: "",
      monitor: "",
      monitor_doc_tipo: "DNI",
      monitor_numero_doc: "",
      monitoreado: "",
      monitoreado_doc_tipo: "DNI",
      monitoreado_numero_doc: "",
      monitoreado_cargo: "",
      monitoreado_telefono: "",
      monitoreado_correo: "",
      condicion: "",
      area: "",
      numero_visitas: "",
      fecha_aplicacion: "",
      hora_inicio: "",
      hora_fin: "",
      custom_values: normalizeCustomHeaderValues(customHeaderFields, {}),
    });
    setFooter({
      observacion: "",
      compromiso: "",
      lugar: "",
      fecha: "",
      docente_nombre: "",
      docente_doc_tipo: "DNI",
      docente_dni: "",
      monitor_nombre: "",
      monitor_doc_tipo: "DNI",
      monitor_dni: "",
    });
    setAnswers({});
    setPendingEvidenceFiles({});
    setIeQuery("");
    setIeOptions([]);
    setIeOpen(false);
  };

  useEffect(() => {
    if (!monitoreoCodigo || !fichaCodigo) return;
    let alive = true;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        if (runIdParam) {
          const { data: runRef, error: runRefErr } = await supabase
            .from("form_run")
            .select("id, template_id")
            .eq("id", runIdParam)
            .maybeSingle();
          if (runRefErr) throw new Error(runRefErr.message);
          if (!runRef?.template_id) throw new Error("No se encontró la ficha registrada para editar.");

          const { data: tpl, error: tplErr } = await supabase
            .from("form_template")
            .select("id, titulo, codigo, subtitulo, header_config, footer_config")
            .eq("id", runRef.template_id)
            .maybeSingle();
          if (tplErr) throw new Error(tplErr.message);
          if (!tpl) throw new Error("Plantilla no encontrada para el registro.");

          const { data: secRows, error: secErr } = await supabase
            .from("form_section")
            .select("id, template_id, titulo, orden")
            .eq("template_id", tpl.id)
            .order("orden", { ascending: true });
          if (secErr) throw new Error(secErr.message);

          const { data: qRows, error: qErr } = await supabase
            .from("form_question")
            .select("id, template_id, section_id, tipo, texto, subtitulo, orden, orden_in_section, required, config_json")
            .eq("template_id", tpl.id)
            .order("orden", { ascending: true });
          if (qErr) throw new Error(qErr.message);

          const { data: fichaRef } = await supabase
            .from("ficha_catalog")
            .select("monitoreo_id")
            .eq("form_template_id", tpl.id)
            .order("version", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (fichaRef?.monitoreo_id) {
            const { data: monRef } = await supabase
              .from("monitoreo_catalog")
              .select("solicitud_id, fecha_inicio, fecha_fin")
              .eq("id", fichaRef.monitoreo_id)
              .maybeSingle();
            setMonitoreoFechaInicio((monRef as any)?.fecha_inicio ?? "");
            setMonitoreoFechaFin((monRef as any)?.fecha_fin ?? "");
            setSolicitudId((monRef as any)?.solicitud_id ?? null);
          }

          if (!alive) return;
          setTemplate(tpl as Template);
          setHeaderCfg(normalizeHeaderConfig(tpl.header_config ?? DEFAULT_HEADER_CONFIG));
          setFooterCfg(tpl.footer_config ?? defaultFooter);
          setSections((secRows as Section[]) ?? []);
          setQuestions((qRows as Question[]) ?? []);
          return;
        }

        const monQuery = supabase
          .from("monitoreo_catalog")
          .select("id, codigo, is_active, solicitud_id, fecha_inicio, fecha_fin")
          .eq("is_active", true)
          .eq("codigo", monitoreoCodigo);
        const { data: mon } = midParam
          ? await monQuery.eq("id", midParam).maybeSingle()
          : await monQuery.order("anio", { ascending: false }).limit(1).maybeSingle();
        if (!mon?.id) {
          throw new Error(
            `Monitoreo no encontrado para codigo=${(monitoreoCodigo || "").toUpperCase()} mid=${midParam || "-"}`
          );
        }
        if (isMonitoreoExpired((mon as any).fecha_fin)) {
          throw new Error("Monitoreo vencido. Solicita ampliacion al administrador.");
        }
        setMonitoreoFechaInicio((mon as any).fecha_inicio ?? "");
        setMonitoreoFechaFin((mon as any).fecha_fin ?? "");
        setSolicitudId((mon as any).solicitud_id ?? null);

        const { data: ficha, error: fichaErr } = await supabase
          .from("ficha_catalog")
          .select("id, codigo, titulo, form_template_id")
          .eq("monitoreo_id", mon.id)
          .eq("codigo", (fichaCodigo || "").toUpperCase())
          .eq("is_active", true)
          .not("form_template_id", "is", null)
          .order("version", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (fichaErr) throw new Error(fichaErr.message);
        if (!ficha?.form_template_id) {
          throw new Error(
            `No existe ficha dinamica activa para codigo=${(fichaCodigo || "").toUpperCase()} en monitoreo=${mon.id}`
          );
        }

        const { data: tpl, error: tplErr } = await supabase
          .from("form_template")
          .select("id, titulo, codigo, subtitulo, header_config, footer_config")
          .eq("id", ficha.form_template_id)
          .maybeSingle();
        if (tplErr) throw new Error(tplErr.message);
        if (!tpl) throw new Error("Plantilla no encontrada.");

        const { data: secRows, error: secErr } = await supabase
          .from("form_section")
          .select("id, template_id, titulo, orden")
          .eq("template_id", tpl.id)
          .order("orden", { ascending: true });
        if (secErr) throw new Error(secErr.message);

        const { data: qRows, error: qErr } = await supabase
          .from("form_question")
          .select("id, template_id, section_id, tipo, texto, subtitulo, orden, orden_in_section, required, config_json")
          .eq("template_id", tpl.id)
          .order("orden", { ascending: true });
        if (qErr) throw new Error(qErr.message);

        if (!alive) return;
        setTemplate(tpl as Template);
        setHeaderCfg(normalizeHeaderConfig(tpl.header_config ?? DEFAULT_HEADER_CONFIG));
        setFooterCfg(tpl.footer_config ?? defaultFooter);
        setSections((secRows as Section[]) ?? []);
        setQuestions((qRows as Question[]) ?? []);
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message || "No se pudo cargar la ficha.");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [fichaCodigo, midParam, monitoreoCodigo, runIdParam, isTestMode]);

  useEffect(() => {
    if (!template?.id || !user?.id) return;
    let alive = true;
    (async () => {
      setRunHydrating(true);
      if (!runIdParam) {
        let parsedLocalDraft: LocalDraftSnapshot | null = null;
        const localDraftRaw = localStorage.getItem(localDraftKey);
        if (localDraftRaw) {
          try {
            const localDraft = JSON.parse(localDraftRaw) as LocalDraftSnapshot;
            if (localDraft && typeof localDraft === "object" && localDraft.updatedAt) {
              parsedLocalDraft = localDraft;
            } else {
              localStorage.removeItem(localDraftKey);
            }
          } catch {
            localStorage.removeItem(localDraftKey);
          }
        }
        const { data: draft } = await supabase
          .from("form_run")
          .select("id, status, header_json, footer_json")
          .eq("template_id", template.id)
          .eq("created_by", user.id)
          .eq("status", "borrador")
          .eq("is_test", isTestMode)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (!draft || !alive) {
          if (!parsedLocalDraft) resetFormState();
          if (parsedLocalDraft) {
            setLocalDraftPending(parsedLocalDraft);
            setLocalDraftPromptOpen(true);
          }
          return;
        }
        setRunId(draft.id);
        setRunStatus(draft.status);
        setHeader((s) => {
          const next = { ...s, ...(draft.header_json ?? {}) };
          return {
            ...next,
            monitor:
              next.monitor || (shouldAutoFillMonitor ? effectiveProfileMonitorName || "" : ""),
            monitor_doc_tipo: (next.monitor_doc_tipo ||
              (shouldAutoFillMonitor ? effectiveProfileMonitorDocTipo : null) ||
              "DNI") as "DNI" | "CE",
            monitor_numero_doc:
              next.monitor_numero_doc ||
              (shouldAutoFillMonitor ? effectiveProfileMonitorDocNumero || "" : ""),
            hora_inicio: cleanStoredTime(next.hora_inicio || ""),
            hora_fin: cleanStoredTime(next.hora_fin || ""),
            custom_values: normalizeCustomHeaderValues(customHeaderFields, next.custom_values),
          };
        });
        setFooter((s) => ({ ...s, ...(draft.footer_json ?? {}) }));
        const { data: ansRows } = await supabase
          .from("form_answer")
          .select("question_id, value_json")
          .eq("run_id", draft.id);
        if (!alive) return;
        const next: Record<string, any> = {};
        (ansRows ?? []).forEach((r: any) => {
          next[r.question_id] = r.value_json;
        });
        setAnswers(next);
        if (parsedLocalDraft) {
          setLocalDraftPending(parsedLocalDraft);
          setLocalDraftPromptOpen(true);
        }
        return;
      }
      let parsedLocalDraft: LocalDraftSnapshot | null = null;
      const localDraftRaw = localStorage.getItem(localDraftKey);
      if (localDraftRaw) {
        try {
          const localDraft = JSON.parse(localDraftRaw) as LocalDraftSnapshot;
          if (localDraft && typeof localDraft === "object" && localDraft.updatedAt) {
            parsedLocalDraft = localDraft;
          } else {
            localStorage.removeItem(localDraftKey);
          }
        } catch {
          localStorage.removeItem(localDraftKey);
        }
      }
      const { data } = await supabase
        .from("form_run")
        .select("id, status, header_json, footer_json")
        .eq("id", runIdParam)
        .maybeSingle();
      if (!alive) return;
      if (!data) {
        setError("No se encontró el registro a editar para esta ficha/modo.");
        return;
      }
      setRunId(data.id);
      setRunStatus(data.status);
      setHeader((s) => {
        const next = { ...s, ...(data.header_json ?? {}) };
        return {
          ...next,
          monitor:
            next.monitor || (shouldAutoFillMonitor ? effectiveProfileMonitorName || "" : ""),
          monitor_doc_tipo: (next.monitor_doc_tipo ||
            (shouldAutoFillMonitor ? effectiveProfileMonitorDocTipo : null) ||
            "DNI") as "DNI" | "CE",
          monitor_numero_doc:
            next.monitor_numero_doc ||
            (shouldAutoFillMonitor ? effectiveProfileMonitorDocNumero || "" : ""),
          hora_inicio: cleanStoredTime(next.hora_inicio || ""),
          hora_fin: cleanStoredTime(next.hora_fin || ""),
          custom_values: normalizeCustomHeaderValues(customHeaderFields, next.custom_values),
        };
      });
      setFooter((s) => ({ ...s, ...(data.footer_json ?? {}) }));
      const { data: ansRows } = await supabase
        .from("form_answer")
        .select("question_id, value_json")
        .eq("run_id", data.id);
      if (!alive) return;
      const next: Record<string, any> = {};
      (ansRows ?? []).forEach((r: any) => {
        next[r.question_id] = r.value_json;
      });
      setAnswers(next);
      if (parsedLocalDraft) {
        setLocalDraftPending(parsedLocalDraft);
        setLocalDraftPromptOpen(true);
      }
    })().finally(() => {
      if (alive) setRunHydrating(false);
    });
    return () => {
      alive = false;
    };
  }, [
    template?.id,
    user?.id,
    isTestMode,
    runIdParam,
    localDraftKey,
  ]);

  useEffect(() => {
    if (!template?.id) return;
    if (runHydrating) return;
    if (localDraftPromptOpen) return;
    const snapshot: LocalDraftSnapshot = {
      runId,
      runStatus,
      header,
      footer,
      answers,
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(localDraftKey, JSON.stringify(snapshot));
  }, [template?.id, localDraftKey, runId, runStatus, header, footer, answers, runHydrating, localDraftPromptOpen]);

  useEffect(() => {
    if (!localDraftPromptOpen || !localDraftPending) return;
    const timeText = (() => {
      try {
        return new Intl.DateTimeFormat("es-PE", {
          dateStyle: "short",
          timeStyle: "short",
          timeZone: "America/Lima",
        }).format(new Date(localDraftPending.updatedAt));
      } catch {
        return localDraftPending.updatedAt;
      }
    })();
    showToast(`Tienes un borrador local (${timeText}).`, "ok");
  }, [localDraftPromptOpen, localDraftPending]);

  const recoverLocalDraft = () => {
    if (!localDraftPending) return;
    applyLocalDraft(localDraftPending);
    setLocalDraftPromptOpen(false);
    setLocalDraftPending(null);
    showToast("Borrador local recuperado.", "ok");
  };

  const discardLocalDraft = () => {
    clearLocalDraft();
    showToast("Se descartó el borrador local.", "ok");
  };

  useEffect(() => {
    if (!profileMonitorName && !profileMonitorDocNumero && !profileMonitorDocTipo) return;
    setMonitorIdentity((prev) => ({
      name: profileMonitorName || prev.name,
      docTipo: (profileMonitorDocTipo || prev.docTipo) as "DNI" | "CE",
      docNumero: profileMonitorDocNumero || prev.docNumero,
    }));
  }, [profileMonitorName, profileMonitorDocTipo, profileMonitorDocNumero]);

  useEffect(() => {
    setHeader((s) => ({
      ...s,
      custom_values: normalizeCustomHeaderValues(customHeaderFields, s.custom_values),
    }));
  }, [customHeaderFields]);

  useEffect(() => {
    // Trigger an explicit profile refresh when entering the form so monitor identity is painted immediately.
    if (!user?.id || profile) return;
    refreshProfile().catch(() => undefined);
  }, [user?.id, profile, refreshProfile]);

  useEffect(() => {
    if (!shouldAutoFillMonitor) return;
    if (!effectiveProfileMonitorName && !effectiveProfileMonitorDocTipo && !effectiveProfileMonitorDocNumero) return;
    if (
      header.monitor === effectiveProfileMonitorName &&
      header.monitor_doc_tipo === (effectiveProfileMonitorDocTipo || header.monitor_doc_tipo) &&
      header.monitor_numero_doc === (effectiveProfileMonitorDocNumero || header.monitor_numero_doc)
    ) {
      return;
    }
    setHeader((s) => ({
      ...s,
      monitor: effectiveProfileMonitorName || s.monitor,
      monitor_doc_tipo: effectiveProfileMonitorDocTipo || s.monitor_doc_tipo,
      monitor_numero_doc: effectiveProfileMonitorDocNumero || s.monitor_numero_doc,
    }));
  }, [
    shouldAutoFillMonitor,
    effectiveProfileMonitorName,
    effectiveProfileMonitorDocTipo,
    effectiveProfileMonitorDocNumero,
    header.monitor,
    header.monitor_doc_tipo,
    header.monitor_numero_doc,
  ]);

  useEffect(() => {
    if (!solicitudId) {
      setDuplicateRule(DUP_RULE_NONE);
      return;
    }
    let alive = true;
    (async () => {
      const { data } = await supabase
        .from("monitoreo_solicitud_filtro")
        .select("tipo, modalidad")
        .eq("solicitud_id", solicitudId)
        .eq("tipo", DUP_RULE_MARKER)
        .limit(1)
        .maybeSingle();
      if (!alive) return;
      const mode = (data as any)?.modalidad;
      setDuplicateRule(
        mode === DUP_RULE_LOCAL || mode === DUP_RULE_MODULAR ? mode : DUP_RULE_NONE
      );
    })();
    return () => {
      alive = false;
    };
  }, [solicitudId]);

  useEffect(() => {
    if (!solicitudId) {
      setIePool([]);
      setIeOptions([]);
      return;
    }
    let alive = true;
    (async () => {
      setIeLoading(true);
      const { data } = await supabase
        .from("monitoreo_solicitud_ie")
        .select(
          "institucion_id, institucion_educativa!inner(id, nombre, codigo_modular, codigo_local, rei, nivel:cat_nivel(nombre), distrito:cat_distrito(nombre))"
        )
        .eq("solicitud_id", solicitudId)
        .limit(10000);
      if (!alive) return;
      const focalizadas = (data ?? [])
        .map((r: any) => r.institucion_educativa)
        .filter(Boolean)
        .map(normalizeInstitucionRow);
      if (focalizadas.length > 0) {
        setIePool(focalizadas);
        setIeLoading(false);
        return;
      }

      const { data: filtroRows } = await supabase
        .from("monitoreo_solicitud_filtro")
        .select("gestion, modalidad, tipo, nivel")
        .eq("solicitud_id", solicitudId);
      if (!alive) return;

      const realFiltroRows = (filtroRows ?? []).filter((r: any) => r.tipo !== DUP_RULE_MARKER);
      const filters: SolicitudFilters = {
        gestiones: Array.from(new Set(realFiltroRows.map((r: any) => r.gestion).filter(Boolean))) as string[],
        modalidades: Array.from(new Set(realFiltroRows.map((r: any) => r.modalidad).filter(Boolean))) as string[],
        niveles: Array.from(new Set(realFiltroRows.map((r: any) => r.nivel).filter(Boolean))) as string[],
      };

      if (!filters.gestiones.length && !filters.modalidades.length && !filters.niveles.length) {
        setIePool([]);
        setIeLoading(false);
        return;
      }

      const [{ data: modalidadCatalog }, { data: nivelCatalog }] = await Promise.all([
        supabase.from("cat_modalidad").select("id, nombre"),
        supabase.from("cat_nivel").select("id, nombre"),
      ]);
      if (!alive) return;

      const modalidadIds = ((modalidadCatalog ?? []) as Array<{ id: string; nombre: string | null }>)
        .filter((m) => filters.modalidades.some((f) => sameCatalogFilter(m.nombre, f)))
        .map((m) => m.id);
      const nivelIds = ((nivelCatalog ?? []) as Array<{ id: string; nombre: string | null }>)
        .filter((n) => filters.niveles.some((f) => sameCatalogFilter(n.nombre, f)))
        .map((n) => n.id);

      let ieQuery = supabase
        .from("institucion_educativa")
        .select("id, nombre, codigo_modular, codigo_local, rei, nivel:cat_nivel(nombre), distrito:cat_distrito(nombre)")
        .order("nombre", { ascending: true })
        .limit(10000);

      if (filters.modalidades.length) {
        if (!modalidadIds.length) {
          setIePool([]);
          setIeLoading(false);
          return;
        }
        ieQuery = ieQuery.in("modalidad_id", modalidadIds);
      }
      if (filters.niveles.length) {
        if (!nivelIds.length) {
          setIePool([]);
          setIeLoading(false);
          return;
        }
        ieQuery = ieQuery.in("nivel_id", nivelIds);
      }
      if (filters.gestiones.length) {
        ieQuery = ieQuery.in("gestion", filters.gestiones);
      }

      const { data: filteredIe, error: filteredErr } = await ieQuery;
      if (!alive) return;
      if (filteredErr) {
        setIePool([]);
        setIeLoading(false);
        return;
      }
      setIePool(((filteredIe ?? []) as any[]).map(normalizeInstitucionRow));
      setIeLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [solicitudId]);

  useEffect(() => {
    const term = ieQuery.trim().toLowerCase();
    if (term.length < 2) {
      setIeOptions([]);
      return;
    }
    setIeLoading(true);
    const handle = setTimeout(() => {
      const next = iePool
        .filter((ie) => {
          const name = (ie.nombre || "").toLowerCase();
          const mod = (ie.codigo_modular || "").toLowerCase();
          const loc = (ie.codigo_local || "").toLowerCase();
          return name.includes(term) || mod.includes(term) || loc.includes(term);
        })
        .slice(0, 20);
      setIeOptions(next);
      setIeLoading(false);
    }, 120);
    return () => clearTimeout(handle);
  }, [ieQuery, iePool]);

  useEffect(() => {
    const onScroll = () => {
      const yPos = window.scrollY;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setShowUp(yPos > 200);
      setShowDown(yPos < max - 200);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const showToast = (msg: string, type: "ok" | "err" = "err") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const clearDraft = async () => {
    if (!template?.id || !user?.id) return;
    if (runStatus && runStatus !== "borrador") {
      showToast("Solo se puede limpiar fichas en borrador.", "err");
      return;
    }
    let targetId = runStatus === "borrador" ? runId : null;
    if (!targetId) {
      const { data: draft } = await supabase
        .from("form_run")
        .select("id")
        .eq("template_id", template.id)
        .eq("created_by", user.id)
        .eq("status", "borrador")
        .eq("is_test", isTestMode)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      targetId = draft?.id ?? null;
    }
    if (!targetId) {
      resetFormState();
      showToast("No hay borrador para limpiar.", "err");
      return;
    }
    try {
      await deleteFormRunAtomic(targetId);
    } catch (deleteError) {
      showToast(deleteError instanceof Error ? deleteError.message : "No se pudo eliminar el borrador.");
      return;
    }
    resetFormState();
      showToast("Borrador eliminado.", "ok");
  };

  const validate = () => {
    const monitorNameVal = effectiveProfileMonitorName || header.monitor;
    const monitorDocTipoVal = effectiveProfileMonitorDocTipo || header.monitor_doc_tipo;
    const monitorDocNumVal = effectiveProfileMonitorDocNumero || header.monitor_numero_doc;
    if (effectiveHeaderCfg.institucion && !header.institucion.trim()) return "Falta Institución Educativa.";
    if (effectiveHeaderCfg.codigo_modular && !header.codigo_modular.trim()) return "Falta Código Modular.";
    if (effectiveHeaderCfg.codigo_local && !header.codigo_local.trim()) return "Falta Código Local.";
    if (effectiveHeaderCfg.distrito && !header.distrito.trim()) return "Falta Distrito/Lugar.";
    if (effectiveHeaderCfg.monitor && !monitorNameVal.trim()) return "Falta nombre del monitor.";
    if (effectiveHeaderCfg.monitoreado && !header.monitoreado.trim()) return "Falta nombre del monitoreado.";
    if (effectiveHeaderCfg.condicion && !header.condicion.trim())
      return "Falta condición del monitoreado.";
    if (effectiveHeaderCfg.area && !header.area.trim()) return "Falta área.";
    if (effectiveHeaderCfg.monitor_doc_tipo && !monitorDocTipoVal) return "Falta tipo documento del monitor.";
    if (effectiveHeaderCfg.monitor_numero_doc && !monitorDocNumVal.trim())
      return "Falta numero de documento del monitor.";
    if (effectiveHeaderCfg.monitoreado_doc_tipo && !header.monitoreado_doc_tipo)
      return "Falta tipo documento del monitoreado.";
    if (effectiveHeaderCfg.monitoreado_numero_doc && !header.monitoreado_numero_doc.trim())
      return "Falta numero de documento del monitoreado.";
    if (effectiveHeaderCfg.monitoreado_cargo && !header.monitoreado_cargo.trim())
      return "Falta cargo del monitoreado.";
    if (effectiveHeaderCfg.monitoreado_telefono && !header.monitoreado_telefono.trim())
      return "Falta telefono del monitoreado.";
    if (effectiveHeaderCfg.monitoreado_correo && !header.monitoreado_correo.trim())
      return "Falta correo del monitoreado.";
    if (effectiveHeaderCfg.numero_visitas && !header.numero_visitas.trim()) return "Falta numero de visitas a la IE.";
    if (effectiveHeaderCfg.fecha_aplicacion && !header.fecha_aplicacion) return "Falta fecha de aplicacion.";
    if (
      effectiveHeaderCfg.fecha_aplicacion &&
      header.fecha_aplicacion &&
      !isDateWithinRange(header.fecha_aplicacion, monitoreoFechaInicio, monitoreoFechaFin)
    ) {
      return "La fecha de aplicacion debe estar dentro del rango del monitoreo.";
    }
    if (effectiveHeaderCfg.hora_inicio && !header.hora_inicio) return "Falta hora de inicio.";
    if (effectiveHeaderCfg.hora_fin && !header.hora_fin) return "Falta hora de fin.";
    if (effectiveHeaderCfg.hora_inicio && header.hora_inicio && !isValidTime24(header.hora_inicio)) {
      return "Hora de inicio invalida. Usa formato 24 horas HH:mm.";
    }
    if (effectiveHeaderCfg.hora_fin && header.hora_fin && !isValidTime24(header.hora_fin)) {
      return "Hora de fin invalida. Usa formato 24 horas HH:mm.";
    }
    for (const field of customHeaderFields) {
      const value = (header.custom_values?.[field.key] ?? "").trim();
      if (field.required && !value) return `Falta ${field.label}.`;
    }

    if (effectiveHeaderCfg.monitor_numero_doc && monitorDocNumVal) {
      const req = monitorDocTipoVal === "CE" ? 9 : 8;
      if (!/^\d+$/.test(monitorDocNumVal)) return "Documento del monitor: solo numeros.";
      if (monitorDocNumVal.length !== req) {
        return `Documento del monitor incompleto: ${monitorDocTipoVal} requiere ${req} digitos.`;
      }
    }
    if (effectiveHeaderCfg.monitoreado_numero_doc && header.monitoreado_numero_doc) {
      const req = header.monitoreado_doc_tipo === "CE" ? 9 : 8;
      if (!/^\d+$/.test(header.monitoreado_numero_doc)) return "Documento del monitoreado: solo numeros.";
      if (header.monitoreado_numero_doc.length !== req) {
        return `Documento del monitoreado incompleto: ${header.monitoreado_doc_tipo} requiere ${req} digitos.`;
      }
    }
    if (effectiveHeaderCfg.monitoreado_telefono && header.monitoreado_telefono) {
      if (!/^\d+$/.test(header.monitoreado_telefono)) return "Telefono del monitoreado: solo numeros.";
    }
    if (effectiveHeaderCfg.monitoreado_correo && header.monitoreado_correo) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(header.monitoreado_correo.trim())) {
        return "Correo del monitoreado invalido.";
      }
    }

    for (const q of questions) {
      if (!q.required) continue;
      const v = answers[q.id] ?? {};
      if (q.tipo === "yes_no") {
        if (v.yn !== "SI" && v.yn !== "NO") return `Falta marcar Sí/No en: ${q.texto}`;
      }
      if (q.tipo === "yes_no_nivel") {
        if (v.yn !== "SI" && v.yn !== "NO") return `Falta marcar Sí/No en: ${q.texto}`;
        if (v.yn === "SI" && !v.nivel) return `Falta nivel en: ${q.texto}`;
      }
      if (q.tipo === "opciones") {
        if (q.config_json?.multi) {
          if (!v.options || v.options.length === 0) return `Falta seleccionar opciones en: ${q.texto}`;
        } else if (!v.option) {
          return `Falta seleccionar opción en: ${q.texto}`;
        }
      }
      if (q.tipo === "texto" && (!v.text || !String(v.text).trim())) return `Falta respuesta en: ${q.texto}`;
      if (q.tipo === "numero" && (!v.number || !String(v.number).trim())) return `Falta número en: ${q.texto}`;
      if (q.tipo === "archivo_pdf" && (!v.fileName || !String(v.fileName).trim()))
        return `Falta adjunto en: ${q.texto}`;
      if (q.tipo === "tabla_matriz") {
        const rows: string[] = q.config_json?.rows ?? [];
        const cols: string[] = q.config_json?.cols ?? [];
        const isEmptyCell = (cell: any) => cell === undefined || cell === null || String(cell).trim() === "";
        const groups = groupMatrixCols(cols);
        let partialMsg: string | null = null;
        for (let i = 0; i < rows.length; i += 1) {
          const rowLabel = rows[i];
          const rowValues = cols.map((_c, j) => v.matrix?.[i]?.[j] ?? "");
          const { totalFlatIndices } = computeMatrixAutoTotals(groups, rowValues);
          if (!groups) {
            const cells = cols.map((_c, j) => rowValues[j]);
            const filled = cells.filter((c) => !isEmptyCell(c)).length;
            if (filled > 0 && filled < cells.length) {
              partialMsg = `Completa toda la fila "${rowLabel}" en: ${q.texto} (o déjala vacía si no aplica)`;
              break;
            }
            continue;
          }
          let flat = 0;
          for (const g of groups) {
            const groupIndices = g.cols.map((_c, li) => flat + li).filter((idx) => !totalFlatIndices.has(idx));
            flat += g.cols.length;
            if (g.group === null || !groupIndices.length) continue;
            const filled = groupIndices.filter((idx) => !isEmptyCell(rowValues[idx])).length;
            if (filled > 0 && filled < groupIndices.length) {
              partialMsg = `Completa "${g.group}" en la fila "${rowLabel}" (${q.texto}) o déjalo vacío si no aplica`;
              break;
            }
          }
          if (partialMsg) break;
        }
        if (partialMsg) return partialMsg;
      }
    }

    if (effectiveFooterCfg.lugar && !footer.lugar.trim()) return "Falta Lugar.";
    if (effectiveFooterCfg.fecha && !footer.fecha) return "Falta Fecha.";
    if (
      effectiveFooterCfg.fecha &&
      footer.fecha &&
      !isDateWithinRange(footer.fecha, monitoreoFechaInicio, monitoreoFechaFin)
    ) {
      return "La fecha del cierre debe estar dentro del rango del monitoreo.";
    }
    if (effectiveFooterCfg.docente_dni) {
      if (!footer.docente_dni) return "Falta el DNI del monitoreado (necesario para la firma digital).";
      const req = footer.docente_doc_tipo === "CE" ? 9 : 8;
      if (!/^\d+$/.test(footer.docente_dni)) return "Documento del monitoreado: solo numeros.";
      if (footer.docente_dni.length !== req) {
        return `Documento del monitoreado incompleto: ${footer.docente_doc_tipo} requiere ${req} digitos.`;
      }
    }
    if (effectiveFooterCfg.monitor_dni) {
      if (!footer.monitor_dni) return "Falta el DNI del monitor (necesario para la firma digital).";
      const req = footer.monitor_doc_tipo === "CE" ? 9 : 8;
      if (!/^\d+$/.test(footer.monitor_dni)) return "Documento del monitor: solo numeros.";
      if (footer.monitor_dni.length !== req) {
        return `Documento del monitor incompleto: ${footer.monitor_doc_tipo} requiere ${req} digitos.`;
      }
    }
    return null;
  };

  const saveRun = async (status: "borrador" | "draft") => {
    if (!template?.id || !user?.id) {
      showToast("Sesion invalida. Vuelve a iniciar sesion.", "err");
      return;
    }
    if (status !== "borrador") {
      const msg = validate();
      if (msg) {
        setError(msg);
        showToast(msg, "err");
        return;
      }
    }
    setSaving(true);
    setError(null);
    const headerPayload = {
      ...header,
      monitor: shouldAutoFillMonitor ? effectiveProfileMonitorName || header.monitor : header.monitor,
      monitor_doc_tipo: shouldAutoFillMonitor
        ? effectiveProfileMonitorDocTipo || header.monitor_doc_tipo
        : header.monitor_doc_tipo,
      monitor_numero_doc: shouldAutoFillMonitor
        ? effectiveProfileMonitorDocNumero || header.monitor_numero_doc
        : header.monitor_numero_doc,
      custom_values: normalizeCustomHeaderValues(customHeaderFields, header.custom_values),
    };
    let currentRunId: string;
    try {
      currentRunId = await saveFormRunAtomic({
        runId,
        templateId: template.id,
        status,
        isTest: isTestMode,
        header: headerPayload,
        footer,
        answers: questions.map((question) => ({
          question_id: question.id,
          value_json: answers[question.id] ?? {},
        })),
        duplicateField: status === "draft" && duplicateRule !== DUP_RULE_NONE
          ? duplicateRule === DUP_RULE_LOCAL ? "codigo_local" : "codigo_modular"
          : null,
      });
      if (status === "borrador") setRunId(currentRunId);
      for (const [questionId, file] of Object.entries(pendingEvidenceFiles)) {
        await uploadPdfEvidence(currentRunId, questionId, file);
      }
      setPendingEvidenceFiles({});
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : "No se pudo guardar la ficha.";
      setError(message);
      showToast(message, "err");
      setSaving(false);
      return;
    }
    setSaving(false);
    if (status === "draft" && isEditMode) {
      clearLocalDraft();
      showToast("Cambios realizados.", "ok");
      setTimeout(() => {
        window.location.assign("/app/reportes");
      }, 700);
      return;
    }
    clearLocalDraft();
    showToast(status === "draft" ? "Ficha guardada en BD." : "Borrador guardado.", "ok");
    if (status === "draft") {
      resetFormState();
    } else {
      setRunStatus(status);
    }
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-white/70">
        Cargando ficha...
      </div>
    );
  }

  if (!template) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-white/70">
        Ficha dinámica no disponible.
      </div>
    );
  }

  return (
    <div className="dynamic-form-page monitoring-page space-y-4 text-white">
      {toast && (
        <div
          className={`fixed left-1/2 top-1/2 z-50 w-[min(calc(100vw-2rem),32rem)] -translate-x-1/2 -translate-y-1/2 rounded-2xl px-4 py-4 text-center text-sm shadow-2xl backdrop-blur ${
            toast.type === "ok"
              ? "border border-emerald-500/40 bg-emerald-500/20 text-emerald-100"
              : "border border-red-500/40 bg-red-500/20 text-red-100"
          }`}
        >
          {toast.msg}
        </div>
      )}
      {error && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-100">
          {error}
        </div>
      )}
      {localDraftPromptOpen && localDraftPending && (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4">
          <div className="text-sm font-semibold text-amber-100">Borrador local detectado</div>
          <div className="mt-1 text-xs text-amber-50/90">
            Tienes un borrador guardado en este navegador. ¿Deseas recuperarlo?
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={recoverLocalDraft}
              className="rounded-lg border border-emerald-500/40 bg-emerald-500/20 px-3 py-1.5 text-xs text-emerald-100"
            >
              Recuperar borrador
            </button>
            <button
              type="button"
              onClick={discardLocalDraft}
              className="rounded-lg border border-white/15 bg-white/10 px-3 py-1.5 text-xs text-white/85"
            >
              Descartar
            </button>
          </div>
        </div>
      )}
      <div className="dynamic-form-hero rounded-2xl border p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="monitoring-accent-text text-[11px] font-bold uppercase tracking-[0.16em]">Ficha dinámica</div>
            <div className="mt-1 text-xl font-bold tracking-tight text-[var(--app-text)] sm:text-2xl">{template.titulo}</div>
            {template.subtitulo ? (
              <div className="text-sm text-white/70">{template.subtitulo}</div>
            ) : null}
          </div>
          <button
            type="button"
            onClick={handleBack}
            className="monitoring-secondary-action rounded-lg border px-3 py-1.5 text-xs font-semibold"
          >
            Volver
          </button>
        </div>
      </div>

      <div className={`dynamic-section-dock ${sectionNavOpen ? "is-open" : ""}`}>
        <button
          type="button"
          className="dynamic-section-toggle"
          aria-expanded={sectionNavOpen}
          aria-controls="dynamic-section-menu"
          aria-label={sectionNavOpen ? "Ocultar secciones" : "Mostrar secciones"}
          onClick={() => setSectionNavOpen((current) => !current)}
        >
          <SectionsIcon />
          <span className="dynamic-section-toggle-label">Secciones</span>
        </button>
        <nav id="dynamic-section-menu" className="dynamic-section-menu" aria-label={"Navegaci\u00f3n de secciones"}>
          <div className="dynamic-section-menu-header">
            <span>Ir a una secci&oacute;n</span>
            <button
              type="button"
              className="dynamic-section-menu-close"
              aria-label={"Cerrar navegaci\u00f3n de secciones"}
              onClick={() => setSectionNavOpen(false)}
            >
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                <path strokeLinecap="round" d="m5 5 10 10M15 5 5 15" />
              </svg>
            </button>
          </div>
          <div className="dynamic-section-menu-list">
            {sections.map((s, index) => (
              <button
                key={s.id}
                type="button"
                className="dynamic-section-link"
                onClick={() => {
                  const el = document.getElementById(`section-${s.id}`);
                  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
                  setSectionNavOpen(false);
                }}
              >
                <span className="dynamic-section-number">{index + 1}</span>
                <span>{s.titulo}</span>
              </button>
            ))}
          </div>
        </nav>
      </div>

      <div className="dynamic-form-panel rounded-2xl border p-4 sm:p-5">
        <div className="text-sm font-semibold">Encabezado</div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {effectiveHeaderCfg?.institucion && (
            <label className="text-sm md:col-span-2" style={fieldOrderStyle("institucion")}>
              <span className="text-white/70">Institución Educativa</span>
              <input
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
                value={header.institucion}
                onChange={(e) => {
                  const value = toUpper(e.target.value);
                  setHeader((s) => ({ ...s, institucion: value }));
                  setIeQuery(value);
                  setIeOpen(true);
                }}
                placeholder="Buscar institución educativa..."
              />
              {ieOpen && (ieOptions.length > 0 || ieLoading) && (
                <div className="dynamic-ie-options mt-2 max-h-56 overflow-auto rounded-xl border">
                  {ieLoading ? (
                    <div className="dynamic-ie-loading p-3 text-xs">Buscando...</div>
                  ) : (
                    ieOptions.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        className="dynamic-ie-option flex w-full flex-col gap-0.5 border-b px-3 py-2.5 text-left text-xs"
                        onClick={() => {
                          const distritoNombre = Array.isArray(opt.distrito)
                            ? opt.distrito[0]?.nombre ?? ""
                            : opt.distrito?.nombre ?? "";
                          setHeader((s) => ({
                            ...s,
                            institucion: opt.nombre ?? "",
                            codigo_modular: opt.codigo_modular ?? "",
                            codigo_local: opt.codigo_local ?? "",
                            rei: opt.rei ?? "",
                            distrito: distritoNombre || s.distrito,
                          }));
                          setIeQuery(opt.nombre ?? "");
                          setIeOpen(false);
                        }}
                      >
                        <span className="dynamic-ie-option-name text-sm font-semibold">{opt.nombre}</span>
                        <span className="dynamic-ie-option-meta text-[11px]">
                          {opt.codigo_modular} • {opt.codigo_local || "-"}
                          {Array.isArray(opt.nivel)
                            ? opt.nivel[0]?.nombre
                              ? ` • ${opt.nivel[0].nombre}`
                              : ""
                            : opt.nivel?.nombre
                            ? ` • ${opt.nivel.nombre}`
                            : ""}
                          {Array.isArray(opt.distrito)
                            ? opt.distrito[0]?.nombre
                              ? ` • ${opt.distrito[0].nombre}`
                              : ""
                            : opt.distrito?.nombre
                            ? ` • ${opt.distrito.nombre}`
                            : ""}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </label>
          )}
          {effectiveHeaderCfg?.codigo_modular && (
            <label className="text-sm" style={fieldOrderStyle("codigo_modular")}>
              <span className="text-white/70">Código modular</span>
              <input
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
                value={header.codigo_modular}
                readOnly
              />
            </label>
          )}
          {effectiveHeaderCfg?.codigo_local && (
            <label className="text-sm" style={fieldOrderStyle("codigo_local")}>
              <span className="text-white/70">Código local</span>
              <input
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
                value={header.codigo_local}
                readOnly
              />
            </label>
          )}
          {effectiveHeaderCfg?.distrito && (
            <label className="text-sm" style={fieldOrderStyle("distrito")}>
              <span className="text-white/70">Distrito / Lugar</span>
              <input
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
                value={header.distrito}
                readOnly
              />
            </label>
          )}
          {effectiveHeaderCfg?.rei && (
            <label className="text-sm" style={fieldOrderStyle("rei")}>
              <span className="text-white/70">REI</span>
              <input
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
                value={header.rei}
                onChange={(e) => setHeader((s) => ({ ...s, rei: toUpper(e.target.value) }))}
              />
            </label>
          )}
          {effectiveHeaderCfg?.monitor && (
            <label className="text-sm" style={fieldOrderStyle("monitor")}>
              <span className="text-white/70">Monitor</span>
              <input
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
                value={shouldAutoFillMonitor ? effectiveProfileMonitorName || header.monitor : header.monitor}
                readOnly={monitorReadOnly}
                onChange={(e) => setHeader((s) => ({ ...s, monitor: toUpper(e.target.value) }))}
              />
            </label>
          )}
          {effectiveHeaderCfg?.monitor_doc_tipo && (
            <label className="text-sm" style={fieldOrderStyle("monitor_doc_tipo")}>
              <span className="text-white/70">Tipo de documento del monitor</span>
              <input
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
                value={shouldAutoFillMonitor ? effectiveProfileMonitorDocTipo || header.monitor_doc_tipo : header.monitor_doc_tipo}
                readOnly
              />
            </label>
          )}
          {effectiveHeaderCfg?.monitor_numero_doc && (
            <label className="text-sm" style={fieldOrderStyle("monitor_numero_doc")}>
              <span className="text-white/70">Numero de documento del monitor</span>
              <input
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
                value={shouldAutoFillMonitor ? effectiveProfileMonitorDocNumero || header.monitor_numero_doc : header.monitor_numero_doc}
                readOnly
              />
            </label>
          )}
          {effectiveHeaderCfg?.monitoreado && (
            <label className="text-sm" style={fieldOrderStyle("monitoreado")}>
              <span className="text-white/70">Monitoreado</span>
              <input
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
                value={header.monitoreado}
                onChange={(e) => setHeader((s) => ({ ...s, monitoreado: toUpper(e.target.value) }))}
              />
            </label>
          )}
          {effectiveHeaderCfg?.monitoreado_doc_tipo && (
            <label className="text-sm" style={fieldOrderStyle("monitoreado_doc_tipo")}>
              <span className="text-white/70">Tipo de documento del monitoreado</span>
              <select
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
                value={header.monitoreado_doc_tipo}
                onChange={(e) =>
                  setHeader((s) => ({
                    ...s,
                    monitoreado_doc_tipo: (e.target.value as "DNI" | "CE") || "DNI",
                    monitoreado_numero_doc: "",
                  }))
                }
              >
                <option value="DNI">DNI</option>
                <option value="CE">CE</option>
              </select>
            </label>
          )}
          {effectiveHeaderCfg?.monitoreado_numero_doc && (
            <label className="text-sm" style={fieldOrderStyle("monitoreado_numero_doc")}>
              <span className="text-white/70">Numero de documento del monitoreado</span>
              <input
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
                maxLength={header.monitoreado_doc_tipo === "CE" ? 9 : 8}
                value={header.monitoreado_numero_doc}
                onChange={(e) =>
                  setHeader((s) => ({
                    ...s,
                    monitoreado_numero_doc: onlyDigits(e.target.value, s.monitoreado_doc_tipo === "CE" ? 9 : 8),
                  }))
                }
              />
            </label>
          )}
          {effectiveHeaderCfg?.monitoreado_cargo && (
            <label className="text-sm" style={fieldOrderStyle("monitoreado_cargo")}>
              <span className="text-white/70">Cargo del monitoreado</span>
              <select
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
                value={header.monitoreado_cargo}
                onChange={(e) => setHeader((s) => ({ ...s, monitoreado_cargo: e.target.value }))}
              >
                <option value="">Seleccione</option>
                <option value="DIRECTOR">Director</option>
                <option value="SUBDIRECTOR">Sub director</option>
                <option value="DOCENTE">Docente</option>
                <option value="OTROS">Otros</option>
              </select>
            </label>
          )}
          {effectiveHeaderCfg?.monitoreado_telefono && (
            <label className="text-sm" style={fieldOrderStyle("monitoreado_telefono")}>
              <span className="text-white/70">Telefono del monitoreado</span>
              <input
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
                value={header.monitoreado_telefono}
                onChange={(e) => setHeader((s) => ({ ...s, monitoreado_telefono: onlyDigits(e.target.value, 15) }))}
              />
            </label>
          )}
          {effectiveHeaderCfg?.monitoreado_correo && (
            <label className="text-sm" style={fieldOrderStyle("monitoreado_correo")}>
              <span className="text-white/70">Correo del monitoreado</span>
              <input
                type="email"
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
                value={header.monitoreado_correo}
                onChange={(e) => setHeader((s) => ({ ...s, monitoreado_correo: e.target.value.trim() }))}
              />
            </label>
          )}
          {effectiveHeaderCfg?.condicion && (
            <label className="text-sm" style={fieldOrderStyle("condicion")}>
              <span className="text-white/70">Condición de monitoreado</span>
              <select
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
                value={header.condicion}
                onChange={(e) => setHeader((s) => ({ ...s, condicion: e.target.value }))}
              >
                <option value="">Seleccionar</option>
                <option value="DESIGNADO">Designado</option>
                <option value="ENCARGADO">Encargado</option>
              </select>
            </label>
          )}
          {effectiveHeaderCfg?.area && (
            <label className="text-sm" style={fieldOrderStyle("area")}>
              <span className="text-white/70">Área que monitorea</span>
              {areaOptions.length ? (
                <select
                  className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
                  value={header.area}
                  onChange={(e) => setHeader((s) => ({ ...s, area: e.target.value }))}
                >
                  <option value="">Seleccione</option>
                  {areaOptions.map((opt: string) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
                  value={header.area}
                  onChange={(e) => setHeader((s) => ({ ...s, area: toUpper(e.target.value) }))}
                />
              )}
            </label>
          )}
          {effectiveHeaderCfg?.numero_visitas && (
            <label className="text-sm" style={fieldOrderStyle("numero_visitas")}>
              <span className="text-white/70">Numero de visitas a la IE</span>
              <input
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
                value={header.numero_visitas}
                onChange={(e) => setHeader((s) => ({ ...s, numero_visitas: onlyDigits(e.target.value, 3) }))}
              />
            </label>
          )}
          {effectiveHeaderCfg?.fecha_aplicacion && (
            <label className="text-sm" style={fieldOrderStyle("fecha_aplicacion")}>
              <span className="text-white/70">Fecha de aplicacion</span>
              <input
                type="date"
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
                value={header.fecha_aplicacion}
                min={monitoreoFechaInicio || undefined}
                max={monitoreoFechaFin || undefined}
                onChange={(e) => setHeader((s) => ({ ...s, fecha_aplicacion: e.target.value }))}
              />
            </label>
          )}
          {effectiveHeaderCfg?.hora_inicio && (
            <div className="text-sm" style={fieldOrderStyle("hora_inicio")}>
              <span className="text-white/70">Hora de inicio</span>
              <TimeField
                ariaLabel="Hora de inicio"
                className="mt-1"
                value={header.hora_inicio}
                onChange={(value) => setHeader((s) => ({ ...s, hora_inicio: value }))}
              />
            </div>
          )}
          {effectiveHeaderCfg?.hora_fin && (
            <div className="text-sm" style={fieldOrderStyle("hora_fin")}>
              <span className="text-white/70">Hora de fin</span>
              <TimeField
                ariaLabel="Hora de fin"
                className="mt-1"
                value={header.hora_fin}
                onChange={(value) => setHeader((s) => ({ ...s, hora_fin: value }))}
              />
            </div>
          )}
          {customHeaderFields.map((field) => (
            <label
              key={field.id}
              className={`text-sm ${field.type === "select" && field.options.length > 4 ? "md:col-span-2" : ""}`}
            >
              <span className="text-white/70">
                {field.label}
                {field.required ? " *" : ""}
              </span>
              {field.type === "select" ? (
                <select
                  className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
                  value={header.custom_values?.[field.key] ?? ""}
                  onChange={(e) =>
                    setHeader((s) => ({
                      ...s,
                      custom_values: {
                        ...s.custom_values,
                        [field.key]: e.target.value,
                      },
                    }))
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
                  className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
                  inputMode={field.type === "number" ? "numeric" : undefined}
                  value={header.custom_values?.[field.key] ?? ""}
                  onChange={(e) =>
                    setHeader((s) => ({
                      ...s,
                      custom_values: {
                        ...s.custom_values,
                        [field.key]:
                          field.type === "number" ? e.target.value.replace(/[^\d]/g, "") : e.target.value,
                      },
                    }))
                  }
                />
              )}
            </label>
          ))}
        </div>
      </div>

      {effectiveHeaderCfg?.nivel_avance && nivelInfoDisplay.length ? (
        <div className="dynamic-form-panel mt-4 rounded-2xl border p-4">
          <div className="text-sm font-semibold">Niveles de respuesta (Sí)</div>
          <div className="mt-3 grid gap-2 md:grid-cols-3">
            {nivelInfoDisplay.map((x, idx) => (
              <div
                key={`${x.nivel}-${idx}`}
                className={`rounded-xl border p-3 ${toneClasses(levelTone(x.nivel))}`}
              >
                <div className="text-xs text-white/60">Nivel</div>
                <div className="mt-1 text-lg font-semibold">{x.nivel}</div>
                <div className="mt-2 text-xs text-white/80">{x.descripcion}</div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {sections.map((s) => (
        <div key={s.id} id={`section-${s.id}`} className="dynamic-form-panel dynamic-section-panel scroll-mt-36 rounded-2xl border p-4 sm:p-5">
          <div className="text-sm font-semibold">{s.titulo}</div>
          <div className="mt-4 space-y-5">
            {(() => {
              const seenSubtitulos = new Set<string>();
              return questions
              .filter((q) => q.section_id === s.id)
              .map((q) => {
                const showSubtitulo = !!q.subtitulo && !seenSubtitulos.has(q.subtitulo);
                if (q.subtitulo) seenSubtitulos.add(q.subtitulo);
                const value = answers[q.id] ?? {};
                const extraFields = normalizeExtraFields(q.config_json?.extra_fields);
                return (
                  <div key={q.id}>
                  {showSubtitulo && (
                    <div className="mb-2 mt-1 text-xs font-bold uppercase tracking-wide text-white/60">
                      {q.subtitulo}
                    </div>
                  )}
                  <div className="dynamic-question-card rounded-xl border p-4">
                    <div className="text-sm font-semibold">
                      {q.orden_in_section ?? q.orden}. {q.texto}
                    </div>
                    <div className="mt-3 space-y-3 text-sm text-white/80">
                      {q.tipo === "yes_no" && (
                        <div className="flex gap-4">
                          <label className="flex items-center gap-2">
                            <input
                              type="radio"
                              checked={value.yn === "SI"}
                              onChange={() =>
                                setAnswers((s) => ({ ...s, [q.id]: { ...value, yn: "SI" } }))
                              }
                            />
                            Sí
                          </label>
                          <label className="flex items-center gap-2">
                            <input
                              type="radio"
                              checked={value.yn === "NO"}
                              onChange={() =>
                                setAnswers((s) => ({ ...s, [q.id]: { ...value, yn: "NO", nivel: undefined } }))
                              }
                            />
                            No
                          </label>
                        </div>
                      )}

                      {q.tipo === "yes_no_nivel" && (
                        <>
                          <div className="flex gap-4">
                            <label className="flex items-center gap-2">
                              <input
                                type="radio"
                                name={`yn-${q.id}`}
                                checked={value.yn === "SI"}
                                onChange={() =>
                                  setAnswers((s) => ({ ...s, [q.id]: { ...value, yn: "SI" } }))
                                }
                              />
                              Sí
                            </label>
                            <label className="flex items-center gap-2">
                              <input
                                type="radio"
                                name={`yn-${q.id}`}
                                checked={value.yn === "NO"}
                                onChange={() =>
                                  setAnswers((s) => ({ ...s, [q.id]: { ...value, yn: "NO", nivel: undefined } }))
                                }
                              />
                              No
                            </label>
                          </div>
                          {value.yn === "SI" ? (
                            <div className="flex flex-wrap gap-2">
                              {(q.config_json?.levelLabels?.length ? q.config_json.levelLabels : ["Bajo", "Medio", "Alto"]).map(
                                (opt: string) => (
                                  <label
                                    key={opt}
                                    className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs"
                                  >
                                    <input
                                      type="radio"
                                      name={`nivel-${q.id}`}
                                      checked={value.nivel === opt}
                                      onChange={() =>
                                        setAnswers((s) => ({ ...s, [q.id]: { ...value, nivel: opt } }))
                                      }
                                    />
                                    {opt}
                                  </label>
                                )
                              )}
                            </div>
                          ) : null}
                        </>
                      )}

                      {q.tipo === "opciones" && (
                        <div className="flex flex-col gap-2">
                          {(q.config_json?.options ?? []).map((opt: string) => (
                            <label key={opt} className="flex items-center gap-2">
                              <input
                                type={q.config_json?.multi ? "checkbox" : "radio"}
                                checked={
                                  q.config_json?.multi
                                    ? (value.options ?? []).includes(opt)
                                    : value.option === opt
                                }
                                onChange={(e) => {
                                  if (q.config_json?.multi) {
                                    const current = new Set(value.options ?? []);
                                    if (e.target.checked) current.add(opt);
                                    else current.delete(opt);
                                    setAnswers((s) => ({
                                      ...s,
                                      [q.id]: { ...value, options: Array.from(current) },
                                    }));
                                  } else {
                                    setAnswers((s) => ({ ...s, [q.id]: { ...value, option: opt } }));
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
                          className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white"
                          rows={3}
                          value={value.text ?? ""}
                          onChange={(e) =>
                            setAnswers((s) => ({ ...s, [q.id]: { ...value, text: e.target.value } }))
                          }
                        />
                      )}

                      {q.tipo === "numero" && (
                        <input
                          className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white"
                          value={value.number ?? ""}
                          onChange={(e) =>
                            setAnswers((s) => ({ ...s, [q.id]: { ...value, number: e.target.value } }))
                          }
                        />
                      )}

                      {q.tipo === "archivo_pdf" && (
                        <div>
                          <input
                            aria-label={`Evidencia PDF: ${q.texto}`}
                            type="file"
                            accept="application/pdf"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              try {
                                await validatePdfEvidence(file);
                              } catch (fileError) {
                                e.target.value = "";
                                showToast(fileError instanceof Error ? fileError.message : "PDF no valido.", "err");
                                return;
                              }
                              setPendingEvidenceFiles((current) => ({ ...current, [q.id]: file }));
                              setAnswers((s) => ({
                                ...s,
                                [q.id]: { ...value, fileName: file.name },
                              }));
                            }}
                          />
                          {value.fileName ? (
                            <div className="mt-1 text-xs text-white/60">Archivo: {value.fileName}</div>
                          ) : null}
                        </div>
                      )}

                      {q.tipo === "tabla_matriz" && (
                        <div className="overflow-x-auto">
                          <table
                            className="border-collapse text-xs"
                            style={{ minWidth: 140 + (q.config_json?.cols ?? []).length * 76 }}
                          >
                            <thead>
                              {(() => {
                                const cols: string[] = q.config_json?.cols ?? [];
                                const groups = groupMatrixCols(cols);
                                if (!groups) {
                                  return (
                                    <tr>
                                      <th className="min-w-[140px] border border-white/10 bg-white/5 px-2 py-1 text-left"></th>
                                      {cols.map((col) => (
                                        <th key={col} className="min-w-[76px] border border-white/10 bg-white/5 px-2 py-1 text-center">
                                          {col}
                                        </th>
                                      ))}
                                    </tr>
                                  );
                                }
                                return (
                                  <>
                                    <tr>
                                      <th className="min-w-[140px] border border-white/10 bg-white/5 px-2 py-1 text-left" rowSpan={2}></th>
                                      {groups.map((g) => (
                                        <th
                                          key={g.group}
                                          colSpan={g.cols.length}
                                          className="border border-white/10 bg-white/5 px-2 py-1 text-center"
                                        >
                                          {g.group}
                                        </th>
                                      ))}
                                    </tr>
                                    <tr>
                                      {groups.flatMap((g) =>
                                        g.cols.map((label) => (
                                          <th
                                            key={`${g.group}-${label}`}
                                            className="min-w-[76px] border border-white/10 bg-white/5 px-2 py-1 text-center"
                                          >
                                            {label}
                                          </th>
                                        ))
                                      )}
                                    </tr>
                                  </>
                                );
                              })()}
                            </thead>
                            <tbody>
                              {(() => {
                                const rows: string[] = q.config_json?.rows ?? [];
                                const cols: string[] = q.config_json?.cols ?? [];
                                const groups = groupMatrixCols(cols);
                                return rows.map((row, i) => {
                                  const rowValues = cols.map((_c, j) => value.matrix?.[i]?.[j] ?? "");
                                  const { next: rowComputed, totalFlatIndices } = computeMatrixAutoTotals(groups, rowValues);
                                  return (
                                    <tr key={row}>
                                      <td className="min-w-[140px] border border-white/10 px-2 py-1 text-white/80">{row}</td>
                                      {cols.map((col, j) => {
                                        const isTotal = totalFlatIndices.has(j);
                                        return (
                                          <td key={col} className="min-w-[76px] border border-white/10 p-1">
                                            <input
                                              type="number"
                                              step={q.config_json?.decimals ? 1 / 10 ** q.config_json.decimals : 1}
                                              readOnly={isTotal}
                                              tabIndex={isTotal ? -1 : undefined}
                                              title={isTotal ? "Se calcula automáticamente" : undefined}
                                              className={`w-full min-w-[64px] rounded-md border px-2 py-1 text-center text-sm ${
                                                isTotal
                                                  ? "border-white/5 bg-white/10 text-white/70"
                                                  : "border-white/10 bg-black/20 text-white"
                                              }`}
                                              value={isTotal ? rowComputed[j] ?? "" : value.matrix?.[i]?.[j] ?? ""}
                                              onChange={(e) => {
                                                if (isTotal) return;
                                                const rowsCount = rows.length;
                                                const colsCount = cols.length;
                                                const next: string[][] = Array.from({ length: rowsCount }, (_, ri) =>
                                                  Array.from({ length: colsCount }, (_, ci) => value.matrix?.[ri]?.[ci] ?? "")
                                                );
                                                next[i][j] = e.target.value;
                                                next[i] = computeMatrixAutoTotals(groups, next[i]).next;
                                                setAnswers((s) => ({ ...s, [q.id]: { ...value, matrix: next } }));
                                              }}
                                            />
                                          </td>
                                        );
                                      })}
                                    </tr>
                                  );
                                });
                              })()}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {q.config_json?.include_obs !== false && (
                        <textarea
                          className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white"
                          rows={2}
                          placeholder="Observaciones"
                          value={value.obs ?? ""}
                          onChange={(e) =>
                            setAnswers((s) => ({ ...s, [q.id]: { ...value, obs: e.target.value } }))
                          }
                        />
                      )}
                      {extraFields.map((field) => {
                        const key = fieldKey(field.label);
                        const current =
                          value?.extra?.[key] ??
                          (key === "evidencia" ? value.evidencia : key === "recomendacion" ? value.recomendacion : "");
                        if (field.mode === "elaboracion") {
                          return (
                            <div key={`${q.id}-extra-${key}`} className="space-y-1">
                              <div className="text-xs text-white/60">{field.label}</div>
                              <textarea
                                className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white"
                                rows={2}
                                value={field.default_value ?? ""}
                                readOnly
                              />
                            </div>
                          );
                        }
                        return (
                          <div key={`${q.id}-extra-${key}`} className="space-y-1">
                            <div className="text-xs text-white/60">{field.label}</div>
                            <textarea
                              className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white"
                              rows={2}
                              value={current ?? ""}
                              onChange={(e) =>
                                setAnswers((s) => ({
                                  ...s,
                                  [q.id]: {
                                    ...value,
                                    extra: { ...(value.extra ?? {}), [key]: e.target.value },
                                  },
                                }))
                              }
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  </div>
                );
              });
            })()}
          </div>
        </div>
      ))}

      <div className="dynamic-form-panel rounded-2xl border p-4 sm:p-5">
        <div className="text-sm font-semibold">Cierre</div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {effectiveFooterCfg?.observacion && (
            <label className="text-sm md:col-span-2">
              <span className="text-white/70">Observación general</span>
              <textarea
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
                rows={3}
                value={footer.observacion}
                onChange={(e) => setFooter((s) => ({ ...s, observacion: e.target.value }))}
              />
            </label>
          )}
          {effectiveFooterCfg?.compromiso && (
            <label className="text-sm md:col-span-2">
              <span className="text-white/70">Compromiso</span>
              <textarea
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
                rows={3}
                value={footer.compromiso}
                onChange={(e) => setFooter((s) => ({ ...s, compromiso: e.target.value }))}
              />
            </label>
          )}
          {effectiveFooterCfg?.lugar && (
            <label className="text-sm">
              <span className="text-white/70">Lugar</span>
              <input
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
                value={footer.lugar}
                onChange={(e) => setFooter((s) => ({ ...s, lugar: toUpper(e.target.value) }))}
              />
            </label>
          )}
          {effectiveFooterCfg?.fecha && (
            <label className="text-sm">
              <span className="text-white/70">Fecha</span>
              <input
                type="date"
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
                value={footer.fecha}
                min={monitoreoFechaInicio || undefined}
                max={monitoreoFechaFin || undefined}
                onChange={(e) => setFooter((s) => ({ ...s, fecha: e.target.value }))}
              />
            </label>
          )}
          {effectiveFooterCfg?.docente_nombre && (
            <label className="text-sm">
              <span className="text-white/70">Monitoreado</span>
              <input
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
                value={footer.docente_nombre}
                onChange={(e) => setFooter((s) => ({ ...s, docente_nombre: toUpper(e.target.value) }))}
              />
            </label>
          )}
          {effectiveFooterCfg?.docente_dni && (
            <label className="text-sm">
              <span className="text-white/70">Documento Monitoreado (DNI o CE)</span>
              <div className="mt-1 grid grid-cols-1 gap-2 sm:grid-cols-[100px_1fr]">
                <select
                  className="rounded-lg border border-white/10 bg-black/30 px-2 py-2 text-sm text-white"
                  value={footer.docente_doc_tipo}
                  onChange={(e) =>
                    setFooter((s) => ({
                      ...s,
                      docente_doc_tipo: (e.target.value as "DNI" | "CE") || "DNI",
                      docente_dni: "",
                    }))
                  }
                >
                  <option value="DNI">DNI</option>
                  <option value="CE">CE</option>
                </select>
                <input
                  className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={footer.docente_doc_tipo === "CE" ? 9 : 8}
                  placeholder={footer.docente_doc_tipo === "CE" ? "9 digitos" : "8 digitos"}
                  value={footer.docente_dni}
                  onChange={(e) =>
                    setFooter((s) => ({
                      ...s,
                      docente_dni: onlyDigits(e.target.value, s.docente_doc_tipo === "CE" ? 9 : 8),
                    }))
                  }
                />
              </div>
            </label>
          )}
          {effectiveFooterCfg?.monitor_nombre && (
            <label className="text-sm">
              <span className="text-white/70">Monitor</span>
              <input
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
                value={footer.monitor_nombre}
                onChange={(e) => setFooter((s) => ({ ...s, monitor_nombre: toUpper(e.target.value) }))}
              />
            </label>
          )}
          {effectiveFooterCfg?.monitor_dni && (
            <label className="text-sm">
              <span className="text-white/70">Documento Monitor (DNI o CE)</span>
              <div className="mt-1 grid grid-cols-1 gap-2 sm:grid-cols-[100px_1fr]">
                <select
                  className="rounded-lg border border-white/10 bg-black/30 px-2 py-2 text-sm text-white"
                  value={footer.monitor_doc_tipo}
                  onChange={(e) =>
                    setFooter((s) => ({
                      ...s,
                      monitor_doc_tipo: (e.target.value as "DNI" | "CE") || "DNI",
                      monitor_dni: "",
                    }))
                  }
                >
                  <option value="DNI">DNI</option>
                  <option value="CE">CE</option>
                </select>
                <input
                  className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={footer.monitor_doc_tipo === "CE" ? 9 : 8}
                  placeholder={footer.monitor_doc_tipo === "CE" ? "9 digitos" : "8 digitos"}
                  value={footer.monitor_dni}
                  onChange={(e) =>
                    setFooter((s) => ({
                      ...s,
                      monitor_dni: onlyDigits(e.target.value, s.monitor_doc_tipo === "CE" ? 9 : 8),
                    }))
                  }
                />
              </div>
            </label>
          )}
        </div>
      </div>

      <div className="dynamic-form-actions sticky bottom-3 z-20 flex flex-wrap gap-2 rounded-xl border p-2.5 backdrop-blur">
        {!isEditMode && (
          <button
            type="button"
            onClick={() => saveRun("borrador")}
            disabled={saving}
            className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100 hover:bg-amber-500/20 disabled:opacity-60"
          >
            Guardar borrador
          </button>
        )}
        <button
          type="button"
          onClick={() => saveRun("draft")}
          disabled={saving}
          className="executive-primary-action rounded-lg border px-3 py-2 text-xs font-semibold disabled:opacity-60"
        >
          {isEditMode ? "Enviar" : "Guardar en BD"}
        </button>
        <button
          type="button"
          onClick={clearDraft}
          disabled={saving}
          className="monitoring-secondary-action rounded-lg border px-3 py-2 text-xs font-semibold disabled:opacity-60"
        >
          Limpiar ficha
        </button>
      </div>

      {showUp && (
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="fixed bottom-20 right-5 rounded-full border border-white/10 bg-white/10 px-3 py-2 text-xs text-white/80"
        >
          ↑ Arriba
        </button>
      )}
      {showDown && (
        <button
          type="button"
          onClick={() => window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" })}
          className="fixed bottom-8 right-5 rounded-full border border-white/10 bg-white/10 px-3 py-2 text-xs text-white/80"
        >
          ↓ Abajo
        </button>
      )}
    </div>
  );
}
