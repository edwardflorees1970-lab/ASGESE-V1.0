import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import jsPDF from "jspdf";
import logoUrl from "../assets/logoagebresf.png";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../app/AuthProvider";
import { useAppConfig } from "../app/AppConfigProvider";
import { isMonitoreoExpired } from "../lib/monitoreoVigencia";
import {
  DEFAULT_HEADER_CONFIG,
  normalizeCustomHeaderValues,
  normalizeHeaderConfig,
  type HeaderFieldDef,
} from "../lib/dynamicHeader";

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
  className = "",
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
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
  const nav = useNavigate();
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
  const [runId, setRunId] = useState<string | null>(null);
  const [runStatus, setRunStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showUp, setShowUp] = useState(false);
  const [showDown, setShowDown] = useState(true);
  const [toast, setToast] = useState<ToastState | null>(null);
  const monitorReadOnly = profile?.role === "user";

  const [ieQuery, setIeQuery] = useState("");
  const [ieOpen, setIeOpen] = useState(false);
  const [ieOptions, setIeOptions] = useState<InstitucionLite[]>([]);
  const [iePool, setIePool] = useState<InstitucionLite[]>([]);
  const [ieLoading, setIeLoading] = useState(false);
  const [solicitudId, setSolicitudId] = useState<string | null>(null);
  const [monitoreoFechaInicio, setMonitoreoFechaInicio] = useState<string>("");
  const [monitoreoFechaFin, setMonitoreoFechaFin] = useState<string>("");
  const [monitorIdentity, setMonitorIdentity] = useState<{
    name: string;
    docTipo: "DNI" | "CE";
    docNumero: string;
  }>({ name: "", docTipo: "DNI", docNumero: "" });
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
  const sessionDraftKey = useMemo(
    () => `ficha-dyn:${user?.id || "anon"}:${midParam || monitoreoCodigo || "-"}:${fichaCodigo || "-"}:${isTestMode ? "test" : "prod"}`,
    [user?.id, midParam, monitoreoCodigo, fichaCodigo, isTestMode]
  );

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
  const effectiveHeaderCfg = normalizeHeaderConfig(
    headerCfg && Object.keys(headerCfg).length ? headerCfg : DEFAULT_HEADER_CONFIG
  );
  const effectiveFooterCfg = footerCfg && Object.keys(footerCfg).length ? footerCfg : defaultFooter;
  const customHeaderFields = useMemo(
    () => (effectiveHeaderCfg?.custom_fields ?? []) as HeaderFieldDef[],
    [effectiveHeaderCfg]
  );
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
    if (returnTo === "reportes") {
      nav("/app/reportes");
      return;
    }
    if (monitoreoCodigo) {
      nav(`/app/monitoreo/${monitoreoCodigo}`);
      return;
    }
    nav("/app/monitoreo");
  };

  const resetFormState = () => {
    sessionStorage.removeItem(sessionDraftKey);
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
          .select("id, template_id, section_id, tipo, texto, orden, orden_in_section, required, config_json")
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
        if (!alive) return;
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [fichaCodigo, midParam, monitoreoCodigo]);

  useEffect(() => {
    if (!template?.id || !user?.id) return;
    let alive = true;
    (async () => {
      const localDraftRaw = sessionStorage.getItem(sessionDraftKey);
      if (localDraftRaw) {
        try {
          const localDraft = JSON.parse(localDraftRaw);
          if (alive) {
            setRunId(localDraft.runId ?? null);
            setRunStatus(localDraft.runStatus ?? null);
            setHeader((s) => ({ ...s, ...(localDraft.header ?? {}) }));
            setFooter((s) => ({ ...s, ...(localDraft.footer ?? {}) }));
            setAnswers(localDraft.answers ?? {});
          }
        } catch {
          sessionStorage.removeItem(sessionDraftKey);
        }
      }
      if (!runIdParam) {
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
          if (!localDraftRaw) resetFormState();
          return;
        }
        setRunId(draft.id);
        setRunStatus(draft.status);
        setHeader((s) => {
          const next = { ...s, ...(draft.header_json ?? {}) };
          return {
            ...next,
            monitor: next.monitor || effectiveProfileMonitorName || "",
            monitor_doc_tipo: (next.monitor_doc_tipo || effectiveProfileMonitorDocTipo || "DNI") as "DNI" | "CE",
            monitor_numero_doc: next.monitor_numero_doc || effectiveProfileMonitorDocNumero || "",
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
        return;
      }
      const { data } = await supabase
        .from("form_run")
        .select("id, status, header_json, footer_json")
        .eq("id", runIdParam)
        .eq("template_id", template.id)
        .eq("is_test", isTestMode)
        .maybeSingle();
      if (!data || !alive) return;
      setRunId(data.id);
      setRunStatus(data.status);
      setHeader((s) => {
        const next = { ...s, ...(data.header_json ?? {}) };
        return {
          ...next,
          monitor: next.monitor || effectiveProfileMonitorName || "",
          monitor_doc_tipo: (next.monitor_doc_tipo || effectiveProfileMonitorDocTipo || "DNI") as "DNI" | "CE",
          monitor_numero_doc: next.monitor_numero_doc || effectiveProfileMonitorDocNumero || "",
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
    })();
    return () => {
      alive = false;
    };
  }, [template?.id, user?.id, isTestMode, runIdParam, sessionDraftKey]);

  useEffect(() => {
    if (!template?.id) return;
    sessionStorage.setItem(
      sessionDraftKey,
      JSON.stringify({
        runId,
        runStatus,
        header,
        footer,
        answers,
      })
    );
  }, [template?.id, sessionDraftKey, runId, runStatus, header, footer, answers]);

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
    if (!profile) return;
    setHeader((s) => ({
      ...s,
      monitor: effectiveProfileMonitorName || s.monitor,
      monitor_doc_tipo: effectiveProfileMonitorDocTipo || s.monitor_doc_tipo,
      monitor_numero_doc: effectiveProfileMonitorDocNumero || s.monitor_numero_doc,
    }));
  }, [effectiveProfileMonitorName, effectiveProfileMonitorDocTipo, effectiveProfileMonitorDocNumero, profile]);

  useEffect(() => {
    if (!monitorReadOnly) return;
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
    monitorReadOnly,
    effectiveProfileMonitorName,
    effectiveProfileMonitorDocTipo,
    effectiveProfileMonitorDocNumero,
    header.monitor,
    header.monitor_doc_tipo,
    header.monitor_numero_doc,
  ]);

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
      const list = (data ?? []).map((r: any) => r.institucion_educativa) as InstitucionLite[];
      setIePool(list);
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
    let targetId = runStatus === "borrador" || runStatus === "draft" ? runId : null;
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
      if (!targetId) {
        const { data: draftPub } = await supabase
          .from("form_run")
          .select("id")
          .eq("template_id", template.id)
          .eq("created_by", user.id)
          .eq("status", "draft")
          .eq("is_test", isTestMode)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        targetId = draftPub?.id ?? null;
      }
    }
    if (!targetId) {
      resetFormState();
      showToast("No hay borrador para limpiar.", "err");
      return;
    }
    const { error: ansErr } = await supabase.from("form_answer").delete().eq("run_id", targetId);
    if (ansErr) {
      showToast(ansErr.message);
      return;
    }
    const { data: deleted, error } = await supabase
      .from("form_run")
      .delete()
      .eq("id", targetId)
      .select("id");
    if (error) {
      showToast(error.message);
      return;
    }
    if (!deleted || deleted.length === 0) {
      showToast("No se pudo eliminar (posible RLS o permisos).");
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
    if (effectiveFooterCfg.docente_dni && footer.docente_dni) {
      const req = footer.docente_doc_tipo === "CE" ? 9 : 8;
      if (!/^\d+$/.test(footer.docente_dni)) return "Documento del monitoreado: solo numeros.";
      if (footer.docente_dni.length !== req) {
        return `Documento del monitoreado incompleto: ${footer.docente_doc_tipo} requiere ${req} digitos.`;
      }
    }
    if (effectiveFooterCfg.monitor_dni && footer.monitor_dni) {
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
      monitor: effectiveProfileMonitorName || header.monitor,
      monitor_doc_tipo: effectiveProfileMonitorDocTipo || header.monitor_doc_tipo,
      monitor_numero_doc: effectiveProfileMonitorDocNumero || header.monitor_numero_doc,
      custom_values: normalizeCustomHeaderValues(customHeaderFields, header.custom_values),
    };
    const payload = {
      template_id: template.id,
      created_by: user.id,
      status,
      is_test: isTestMode,
      header_json: headerPayload,
      footer_json: footer,
    };
    let currentRunId = status === "draft" ? null : runId;
    if (status === "draft" && !currentRunId) {
      const { data: draftRow } = await supabase
        .from("form_run")
        .select("id")
        .eq("template_id", template.id)
        .eq("created_by", user.id)
        .eq("status", "borrador")
        .eq("is_test", isTestMode)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (draftRow?.id) {
        currentRunId = draftRow.id;
      }
    }
    if (!currentRunId) {
      const { data, error } = await supabase.from("form_run").insert(payload).select("id").single();
      if (error) {
        setError(error.message);
        setSaving(false);
        return;
      }
      currentRunId = data.id;
      if (status === "borrador") setRunId(data.id);
    } else {
      const { error } = await supabase.from("form_run").update(payload).eq("id", currentRunId);
      if (error) {
        setError(error.message);
        setSaving(false);
        return;
      }
    }

    const rows = questions.map((q) => ({
      run_id: currentRunId,
      question_id: q.id,
      value_json: answers[q.id] ?? {},
    }));
    if (rows.length) {
      const { error } = await supabase
        .from("form_answer")
        .upsert(rows, { onConflict: "run_id,question_id" });
      if (error) {
        setError(error.message);
        showToast(error.message, "err");
        setSaving(false);
        return;
      }
    }
    setSaving(false);
    showToast(status === "draft" ? "Ficha guardada en BD." : "Borrador guardado.", "ok");
    if (status === "draft") {
      resetFormState();
    } else {
      setRunStatus(status);
    }
  };

  const exportPdf = async () => {
    if (!template) return;
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

    try {
      const img = await loadImage(logoUrl);
      const imgW = 22;
      const imgH = (img.height / img.width) * imgW;
      const dataUrl = toDataUrl(img);
      if (dataUrl) doc.addImage(dataUrl, "PNG", M, y - 8, imgW, imgH);
    } catch {
      // ignore
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text(template.titulo, M + 26, y);
    y += 6;

    if (template.subtitulo) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      doc.text(template.subtitulo, M + 26, y);
      y += 6;
    }

    doc.setDrawColor(220);
    doc.line(M, y, pageW - M, y);
    y += 10;

    const headerPairs: Array<[string, string]> = [];
    if (effectiveHeaderCfg?.institucion) headerPairs.push(["Institución educativa", header.institucion ?? ""]);
    if (effectiveHeaderCfg?.codigo_modular) headerPairs.push(["Código modular", header.codigo_modular ?? ""]);
    if (effectiveHeaderCfg?.codigo_local) headerPairs.push(["Código local", header.codigo_local ?? ""]);
    if (effectiveHeaderCfg?.distrito) headerPairs.push(["Distrito / Lugar", header.distrito ?? ""]);
    if (effectiveHeaderCfg?.rei) headerPairs.push(["REI", header.rei ?? ""]);
    if (effectiveHeaderCfg?.monitor) headerPairs.push(["Monitor", header.monitor ?? ""]);
    if (effectiveHeaderCfg?.monitor_doc_tipo) headerPairs.push(["Tipo doc. monitor", header.monitor_doc_tipo ?? ""]);
    if (effectiveHeaderCfg?.monitor_numero_doc)
      headerPairs.push(["Numero doc. monitor", header.monitor_numero_doc ?? ""]);
    if (effectiveHeaderCfg?.monitoreado) headerPairs.push(["Monitoreado", header.monitoreado ?? ""]);
    if (effectiveHeaderCfg?.monitoreado_doc_tipo)
      headerPairs.push(["Tipo doc. monitoreado", header.monitoreado_doc_tipo ?? ""]);
    if (effectiveHeaderCfg?.monitoreado_numero_doc)
      headerPairs.push(["Numero doc. monitoreado", header.monitoreado_numero_doc ?? ""]);
    if (effectiveHeaderCfg?.monitoreado_cargo)
      headerPairs.push(["Cargo monitoreado", header.monitoreado_cargo ?? ""]);
    if (effectiveHeaderCfg?.monitoreado_telefono)
      headerPairs.push(["Telefono monitoreado", header.monitoreado_telefono ?? ""]);
    if (effectiveHeaderCfg?.monitoreado_correo)
      headerPairs.push(["Correo monitoreado", header.monitoreado_correo ?? ""]);
    if (effectiveHeaderCfg?.condicion)
      headerPairs.push(["Condición del monitoreado", header.condicion ?? ""]);
    if (effectiveHeaderCfg?.area) headerPairs.push(["Área", header.area ?? ""]);
    if (effectiveHeaderCfg?.numero_visitas)
      headerPairs.push(["Numero de visitas a la IE", header.numero_visitas ?? ""]);
    if (effectiveHeaderCfg?.fecha_aplicacion)
      headerPairs.push(["Fecha de aplicacion", header.fecha_aplicacion ?? ""]);
    if (effectiveHeaderCfg?.hora_inicio) headerPairs.push(["Hora de inicio", header.hora_inicio ?? ""]);
    if (effectiveHeaderCfg?.hora_fin) headerPairs.push(["Hora de fin", header.hora_fin ?? ""]);
    customHeaderFields.forEach((field) => {
      headerPairs.push([field.label, header.custom_values?.[field.key] ?? ""]);
    });

    if (headerPairs.length) {
      drawSectionHeader("Encabezado");
      drawKeyValueGrid(headerPairs);
    }

    if (effectiveHeaderCfg?.nivel_avance && nivelInfoDisplay.length) {
      const nivelPairs: Array<[string, string]> = nivelInfoDisplay.map((x) => [
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

        const p = answers[q.id] ?? {};
        const parts: string[] = [];
        if (q.tipo === "yes_no") parts.push(`Respuesta: ${p.yn ?? "-"}`);
        if (q.tipo === "yes_no_nivel") {
          const levelLabels = q.config_json?.levelLabels ?? [];
          let nivelLabel = "-";
          if (p.nivel) {
            if (typeof p.nivel === "number") {
              nivelLabel = levelLabels[p.nivel - 1] ?? String(p.nivel);
            } else {
              nivelLabel = String(p.nivel);
            }
          }
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
        parts.push(`Observación: ${p.obs ?? "-"}`);
        const extraFields = normalizeExtraFields(q.config_json?.extra_fields);
        extraFields.forEach((field) => {
          const key = fieldKey(field.label);
          const val =
            field.mode === "elaboracion"
              ? field.default_value ?? ""
              : p?.extra?.[key] ??
                (key === "evidencia" ? p.evidencia : key === "recomendacion" ? p.recomendacion : "");
          parts.push(`${field.label}: ${val ?? "-"}`);
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
    if (effectiveFooterCfg?.observacion) footerPairs.push(["Observación general", footer.observacion ?? ""]);
    if (effectiveFooterCfg?.compromiso) footerPairs.push(["Compromiso", footer.compromiso ?? ""]);
    if (effectiveFooterCfg?.lugar) footerPairs.push(["Lugar", footer.lugar ?? ""]);
    if (effectiveFooterCfg?.fecha) footerPairs.push(["Fecha", footer.fecha ?? ""]);
    if (effectiveFooterCfg?.docente_nombre) footerPairs.push(["Monitoreado", footer.docente_nombre ?? ""]);
    if (effectiveFooterCfg?.docente_dni) {
      footerPairs.push([
        `${footer.docente_doc_tipo || "DNI"} Monitoreado`,
        footer.docente_dni ?? "",
      ]);
    }
    if (effectiveFooterCfg?.monitor_nombre) footerPairs.push(["Monitor", footer.monitor_nombre ?? ""]);
    if (effectiveFooterCfg?.monitor_dni) {
      footerPairs.push([
        `${footer.monitor_doc_tipo || "DNI"} Monitor`,
        footer.monitor_dni ?? "",
      ]);
    }

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

    doc.save(`ficha_${template.codigo}.pdf`);
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
    <div className="space-y-5 text-white">
      {toast && (
        <div
          className={`fixed left-3 right-3 top-4 z-50 rounded-xl px-4 py-3 text-sm shadow-lg sm:left-auto sm:right-6 sm:top-6 ${
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
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-sm text-white/60">Ficha din?mica</div>
            <div className="mt-1 text-2xl font-semibold">{template.titulo}</div>
            {template.subtitulo ? (
              <div className="text-sm text-white/70">{template.subtitulo}</div>
            ) : null}
          </div>
          <button
            type="button"
            onClick={handleBack}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/80 hover:bg-white/10"
          >
            Volver
          </button>
        </div>
      </div>

      <div className="sticky top-20 z-30 flex flex-wrap gap-2 rounded-2xl border border-white/10 bg-zinc-950/80 p-2 backdrop-blur">
        {sections.map((s) => (
          <button
            key={s.id}
            type="button"
            className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/80 hover:bg-white/10"
            onClick={() => {
              const el = document.getElementById(`section-${s.id}`);
              if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
          >
            {s.titulo}
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <div className="text-sm font-semibold">Encabezado</div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {effectiveHeaderCfg?.institucion && (
            <label className="text-sm">
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
                <div className="mt-2 max-h-56 overflow-auto rounded-lg border border-white/10 bg-black/70">
                  {ieLoading ? (
                    <div className="p-3 text-xs text-white/60">Buscando...</div>
                  ) : (
                    ieOptions.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        className="flex w-full flex-col gap-0.5 border-b border-white/5 px-3 py-2 text-left text-xs text-white/80 hover:bg-white/5"
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
                        <span className="text-sm text-white">{opt.nombre}</span>
                        <span className="text-[11px] text-white/60">
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
            <label className="text-sm">
              <span className="text-white/70">Código modular</span>
              <input
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
                value={header.codigo_modular}
                onChange={(e) => setHeader((s) => ({ ...s, codigo_modular: toUpper(e.target.value) }))}
              />
            </label>
          )}
          {effectiveHeaderCfg?.codigo_local && (
            <label className="text-sm">
              <span className="text-white/70">Código local</span>
              <input
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
                value={header.codigo_local}
                onChange={(e) => setHeader((s) => ({ ...s, codigo_local: toUpper(e.target.value) }))}
              />
            </label>
          )}
          {effectiveHeaderCfg?.distrito && (
            <label className="text-sm">
              <span className="text-white/70">Distrito / Lugar</span>
              <input
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
                value={header.distrito}
                onChange={(e) => setHeader((s) => ({ ...s, distrito: toUpper(e.target.value) }))}
              />
            </label>
          )}
          {effectiveHeaderCfg?.rei && (
            <label className="text-sm">
              <span className="text-white/70">REI</span>
              <input
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
                value={header.rei}
                onChange={(e) => setHeader((s) => ({ ...s, rei: toUpper(e.target.value) }))}
              />
            </label>
          )}
          {effectiveHeaderCfg?.monitor && (
            <label className="text-sm">
              <span className="text-white/70">Monitor</span>
              <input
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
                value={monitorReadOnly ? effectiveProfileMonitorName || header.monitor : header.monitor}
                readOnly={monitorReadOnly}
                onChange={(e) => setHeader((s) => ({ ...s, monitor: toUpper(e.target.value) }))}
              />
            </label>
          )}
          {effectiveHeaderCfg?.monitor_doc_tipo && (
            <label className="text-sm">
              <span className="text-white/70">Tipo de documento del monitor</span>
              <input
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
                value={effectiveProfileMonitorDocTipo || header.monitor_doc_tipo}
                readOnly
              />
            </label>
          )}
          {effectiveHeaderCfg?.monitor_numero_doc && (
            <label className="text-sm">
              <span className="text-white/70">Numero de documento del monitor</span>
              <input
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
                value={effectiveProfileMonitorDocNumero || header.monitor_numero_doc}
                readOnly
              />
            </label>
          )}
          {effectiveHeaderCfg?.monitoreado && (
            <label className="text-sm">
              <span className="text-white/70">Monitoreado</span>
              <input
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
                value={header.monitoreado}
                onChange={(e) => setHeader((s) => ({ ...s, monitoreado: toUpper(e.target.value) }))}
              />
            </label>
          )}
          {effectiveHeaderCfg?.monitoreado_doc_tipo && (
            <label className="text-sm">
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
            <label className="text-sm">
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
            <label className="text-sm">
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
            <label className="text-sm">
              <span className="text-white/70">Telefono del monitoreado</span>
              <input
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
                value={header.monitoreado_telefono}
                onChange={(e) => setHeader((s) => ({ ...s, monitoreado_telefono: onlyDigits(e.target.value, 15) }))}
              />
            </label>
          )}
          {effectiveHeaderCfg?.monitoreado_correo && (
            <label className="text-sm">
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
            <label className="text-sm">
              <span className="text-white/70">Condición del monitoreado (designado o encargado)</span>
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
            <label className="text-sm">
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
            <label className="text-sm">
              <span className="text-white/70">Numero de visitas a la IE</span>
              <input
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
                value={header.numero_visitas}
                onChange={(e) => setHeader((s) => ({ ...s, numero_visitas: onlyDigits(e.target.value, 3) }))}
              />
            </label>
          )}
          {effectiveHeaderCfg?.fecha_aplicacion && (
            <label className="text-sm">
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
            <label className="text-sm">
              <span className="text-white/70">Hora de inicio</span>
              <TimeField
                className="mt-1"
                value={header.hora_inicio}
                onChange={(value) => setHeader((s) => ({ ...s, hora_inicio: value }))}
              />
            </label>
          )}
          {effectiveHeaderCfg?.hora_fin && (
            <label className="text-sm">
              <span className="text-white/70">Hora de fin</span>
              <TimeField
                className="mt-1"
                value={header.hora_fin}
                onChange={(value) => setHeader((s) => ({ ...s, hora_fin: value }))}
              />
            </label>
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
                  placeholder={field.placeholder || field.label}
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
        <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
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
        <div key={s.id} id={`section-${s.id}`} className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="text-sm font-semibold">{s.titulo}</div>
          <div className="mt-4 space-y-5">
            {questions
              .filter((q) => q.section_id === s.id)
              .map((q) => {
                const value = answers[q.id] ?? {};
                const extraFields = normalizeExtraFields(q.config_json?.extra_fields);
                return (
                  <div key={q.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
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
                            type="file"
                            accept="application/pdf"
                            onChange={(e) =>
                              setAnswers((s) => ({
                                ...s,
                                [q.id]: { ...value, fileName: e.target.files?.[0]?.name ?? "" },
                              }))
                            }
                          />
                          {value.fileName ? (
                            <div className="mt-1 text-xs text-white/60">Archivo: {value.fileName}</div>
                          ) : null}
                        </div>
                      )}

                      <textarea
                        className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white"
                        rows={2}
                        placeholder="Observaciones"
                        value={value.obs ?? ""}
                        onChange={(e) =>
                          setAnswers((s) => ({ ...s, [q.id]: { ...value, obs: e.target.value } }))
                        }
                      />
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
                              placeholder={field.label}
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
                );
              })}
          </div>
        </div>
      ))}

      <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
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

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => saveRun("borrador")}
          disabled={saving}
          className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100 hover:bg-amber-500/20 disabled:opacity-60"
        >
          Guardar borrador
        </button>
        <button
          type="button"
          onClick={() => saveRun("draft")}
          disabled={saving}
          className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100 hover:bg-emerald-500/20 disabled:opacity-60"
        >
          Guardar en BD
        </button>
        <button
          type="button"
          onClick={clearDraft}
          disabled={saving}
          className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/80 hover:bg-white/10 disabled:opacity-60"
        >
          Limpiar ficha
        </button>
        <button
          type="button"
          onClick={exportPdf}
          className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/80 hover:bg-white/10"
        >
          Exportar PDF
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
