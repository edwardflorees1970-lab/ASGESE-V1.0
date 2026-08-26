import { useEffect, useMemo, useRef, useState } from "react";
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
import { publishMonitoreoSolicitud, publishTemplateVersion } from "../lib/monitoreoWorkflowApi";
import {
  DEFAULT_NIVEL_INFO,
  DUP_RULE_LOCAL,
  DUP_RULE_MARKER,
  DUP_RULE_MODULAR,
  DUP_RULE_NONE,
  FIXED_HEADER_FIELDS,
  GESTIONES,
  MODALIDADES,
  QUESTION_TYPES,
  TIPOS,
} from "./GestionMonitoreos/constants";
import {
  getNivelesByModalidades,
  normalizeExtraFields,
  normalizeGestionesForDb,
  statusLabel,
  statusTone,
  toGestionesUi,
  toggleGestion,
  toggleValue,
} from "./GestionMonitoreos/helpers";
import { ManagementIcon } from "./GestionMonitoreos/ManagementIcon";
import { StepNav, type StepNavItem } from "./GestionMonitoreos/StepNav";
import { PreviewModal } from "./GestionMonitoreos/PreviewModal";
import { exportPreviewPdf as exportPreviewPdfUtil } from "./GestionMonitoreos/exportPreviewPdf";
import type {
  DeleteFichaResumen,
  DeleteMonSummary,
  ExtraFieldCfg,
  GlobalTemplateOption,
  InstitucionLite,
  Question,
  Section,
  Solicitud,
  Template,
} from "./GestionMonitoreos/types";

export function GestionMonitoreosPage() {
  const { profile, user } = useAuth();
  const role = profile?.role ?? "user";
  const canCreate = role === "director_iiee"
    ? false
    : role !== "user" || !!profile?.can_create_monitoreo;
  const canApproveLv1 = role === "jefe_area" || role === "director" || role === "admin";
  const canReject = role === "jefe_area" || role === "admin";
  const isAdmin = role === "admin";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [publishingVersion, setPublishingVersion] = useState(false);
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
  const [solPageSize, setSolPageSize] = useState(5);

  const [templates, setTemplates] = useState<Template[]>([]);
  const [templateTitle, setTemplateTitle] = useState("");
  const [templateCode, setTemplateCode] = useState("");
  const [templateSubtitle, setTemplateSubtitle] = useState("");
  const [reuseSourceTemplateId, setReuseSourceTemplateId] = useState("");
  const [reuseTemplateSearch, setReuseTemplateSearch] = useState("");
  const [allTemplates, setAllTemplates] = useState<GlobalTemplateOption[]>([]);
  const [reuseTemplateTitle, setReuseTemplateTitle] = useState("");
  const [reuseTemplateCode, setReuseTemplateCode] = useState("");
  const [reuseTemplateSubtitle, setReuseTemplateSubtitle] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [templateHeader, setTemplateHeader] = useState<any>({});
  const [templateFooter, setTemplateFooter] = useState<any>({});
  const [templateHeaderAreas, setTemplateHeaderAreas] = useState("");
  const [templateHeaderNiveles, setTemplateHeaderNiveles] = useState("");
  const [templateCustomFieldLabel, setTemplateCustomFieldLabel] = useState("");
  const [templateCustomFieldType, setTemplateCustomFieldType] = useState<HeaderFieldDef["type"]>("text");
  const [templateCustomFieldOptions, setTemplateCustomFieldOptions] = useState("");
  const [templateCustomFieldRequired, setTemplateCustomFieldRequired] = useState(false);
  const [editingTemplateFieldId, setEditingTemplateFieldId] = useState<string | null>(null);
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
  const [activeStep, setActiveStep] = useState<
    "datos" | "aprobacion" | "fichas" | "encabezado" | "preguntas" | "preview"
  >("datos");
  const skipNextStepResetRef = useRef(false);
  const questionFormRef = useRef<HTMLDivElement | null>(null);
  const [solicitudDetailModal, setSolicitudDetailModal] = useState<Solicitud | null>(null);
  const [templateEnabledMap, setTemplateEnabledMap] = useState<Record<string, boolean>>({});
  const [templateToggleBusyId, setTemplateToggleBusyId] = useState<string | null>(null);

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
  const canOwnerOrAdmin = useMemo(() => {
    if (!selected) return false;
    if (isAdmin) return true;
    return selected.created_by === user?.id;
  }, [selected, isAdmin, user?.id]);
  const canManageInactiveTemplates = useMemo(() => {
    if (!selected) return false;
    if (!canOwnerOrAdmin) return false;
    return selected.status === "inactive" || (selected.status === "approved" && selectedExpired);
  }, [selected, canOwnerOrAdmin, selectedExpired]);
  const canEditTemplates = canEditSolicitud || canManageInactiveTemplates;
  const reuseTemplateResults = useMemo(() => {
    const term = reuseTemplateSearch.trim().toLowerCase();
    const rows = !term
      ? allTemplates
      : allTemplates.filter((t) => {
          const title = String(t.titulo || "").toLowerCase();
          const code = String(t.codigo || "").toLowerCase();
          const mon = String(t.monitoreo_nombre || "").toLowerCase();
          return title.includes(term) || code.includes(term) || mon.includes(term);
        });
    return rows.slice(0, 7);
  }, [allTemplates, reuseTemplateSearch]);

  const stepItems: StepNavItem[] = useMemo(() => {
    const statusFor = (id: typeof activeStep, done: boolean): StepNavItem["status"] =>
      id === activeStep ? "active" : done ? "done" : "pending";
    return [
      { id: "datos", label: "Datos y alcance", status: statusFor("datos", true) },
      {
        id: "aprobacion",
        label: "Aprobación",
        status: statusFor("aprobacion", selected?.status === "approved"),
      },
      {
        id: "fichas",
        label: "Fichas",
        status: statusFor("fichas", templates.length > 0),
      },
      {
        id: "encabezado",
        label: "Encabezado y cierre",
        status: statusFor("encabezado", !!selectedTemplateId),
      },
      {
        id: "preguntas",
        label: "Secciones y preguntas",
        status: statusFor(
          "preguntas",
          !!selectedTemplateId && sections.length > 0 && questions.length > 0
        ),
      },
      { id: "preview", label: "Revisar y publicar", status: statusFor("preview", false) },
    ];
  }, [activeStep, selected, templates, selectedTemplateId, sections, questions]);

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
    const rows = (data as Template[]) ?? [];
    setTemplates(rows);
    if (rows.length > 0) setSelectedTemplateId(rows[0].id);
    await loadTemplateEnabledMap(solicitudId, rows);
  };

  const getLinkedMonitoreo = async (solicitudId: string) => {
    const { data, error } = await supabase
      .from("monitoreo_catalog")
      .select("id")
      .eq("solicitud_id", solicitudId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return (data as { id: string } | null) ?? null;
  };

  const loadTemplateEnabledMap = async (solicitudId: string, tplRows: Template[]) => {
    if (!tplRows.length) {
      setTemplateEnabledMap({});
      return;
    }
    const linked = await getLinkedMonitoreo(solicitudId);
    if (!linked?.id) {
      const fallback: Record<string, boolean> = {};
      tplRows.forEach((t) => (fallback[t.id] = true));
      setTemplateEnabledMap(fallback);
      return;
    }
    const templateIds = tplRows.map((t) => t.id);
    const { data, error } = await supabase
      .from("ficha_catalog")
      .select("form_template_id, is_active")
      .eq("monitoreo_id", linked.id)
      .in("form_template_id", templateIds);
    if (error) throw new Error(error.message);
    const map: Record<string, boolean> = {};
    tplRows.forEach((t) => (map[t.id] = true));
    (data ?? []).forEach((r: any) => {
      if (r.form_template_id) map[r.form_template_id] = r.is_active !== false;
    });
    setTemplateEnabledMap(map);
  };

  const loadGlobalTemplates = async () => {
    let { data: tData, error: tErr } = await supabase
      .from("form_template")
      .select("id, solicitud_id, titulo, codigo, subtitulo, header_config, footer_config, orden, created_at, updated_at")
      .order("updated_at", { ascending: false });
    if (tErr) {
      const fallback = await supabase
        .from("form_template")
        .select("id, solicitud_id, titulo, codigo, subtitulo, header_config, footer_config, orden");
      tData = fallback.data as any;
      tErr = fallback.error;
    }
    if (tErr) {
      setToast({ type: "err", msg: tErr.message });
      setAllTemplates([]);
      return;
    }
    const base = (tData ?? []) as Array<Template & { created_at?: string | null; updated_at?: string | null }>;
    const templateIds = base.map((t) => t.id);
    if (!templateIds.length) {
      setAllTemplates([]);
      return;
    }

    const { data: fichaRows, error: fichaErr } = await supabase
      .from("ficha_catalog")
      .select("form_template_id, monitoreo_id, titulo")
      .in("form_template_id", templateIds);
    if (fichaErr) {
      setToast({ type: "err", msg: fichaErr.message });
      setAllTemplates([]);
      return;
    }

    const templateToMon = new Map<string, { monitoreo_id: string; ficha_titulo?: string | null }>();
    const monIds = new Set<string>();
    (fichaRows ?? []).forEach((row: any) => {
      if (!row?.form_template_id || !row?.monitoreo_id) return;
      if (!templateToMon.has(row.form_template_id)) {
        templateToMon.set(row.form_template_id, {
          monitoreo_id: row.monitoreo_id,
          ficha_titulo: row.titulo ?? null,
        });
      }
      monIds.add(row.monitoreo_id);
    });

    const monMap = new Map<string, { nombre: string; codigo: string }>();
    if (monIds.size > 0) {
      const { data: monRows, error: monErr } = await supabase
        .from("monitoreo_catalog")
        .select("id, nombre, codigo")
        .in("id", Array.from(monIds));
      if (monErr) {
        setToast({ type: "err", msg: monErr.message });
      } else {
        (monRows ?? []).forEach((m: any) => {
          monMap.set(m.id, { nombre: m.nombre ?? "Monitoreo", codigo: m.codigo ?? "-" });
        });
      }
    }

    const result: GlobalTemplateOption[] = base.map((t) => {
      const link = templateToMon.get(t.id);
      const mon = link ? monMap.get(link.monitoreo_id) : null;
      return {
        ...t,
        monitoreo_nombre: mon?.nombre ?? "Sin monitoreo",
        monitoreo_codigo: mon?.codigo ?? "-",
        metadata: t.subtitulo?.trim() || link?.ficha_titulo?.trim() || "",
      };
    });
    setAllTemplates(result);
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
    loadGlobalTemplates();
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    loadTemplates(selectedId);
  }, [selectedId]);

  useEffect(() => {
    if (!selectedId) return;
    if (skipNextStepResetRef.current) {
      skipNextStepResetRef.current = false;
      return;
    }
    setActiveStep("datos");
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
    if (!selected || !canOwnerOrAdmin) return;
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
      const { error: monSyncErr } = await supabase
        .from("monitoreo_catalog")
        .update({
          nombre: editNombre,
          descripcion: editDetalle,
          fecha_inicio: editFechaInicio,
          fecha_fin: editFechaFin,
          updated_at: new Date().toISOString(),
        })
        .eq("solicitud_id", selected.id);
      if (monSyncErr) {
        setError(monSyncErr.message);
        setSaving(false);
        return;
      }
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
      setToast({ type: "err", msg: error.message });
      return;
    }

    const solicitudId = (data as any)?.id as string;
    let secondaryError = false;

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
      if (rows.length) {
        const { error: filtroErr } = await supabase.from("monitoreo_solicitud_filtro").insert(rows);
        if (filtroErr) {
          secondaryError = true;
          setToast({ type: "err", msg: `Solicitud creada, pero fallaron los filtros: ${filtroErr.message}` });
        }
      }
    }

    if (ieSelected.length) {
      const { error: ieErr } = await supabase
        .from("monitoreo_solicitud_ie")
        .insert(ieSelected.map((ie) => ({ solicitud_id: solicitudId, institucion_id: ie.id })));
      if (ieErr) {
        secondaryError = true;
        setToast({ type: "err", msg: `Solicitud creada, pero fallaron las instituciones: ${ieErr.message}` });
      }
    }

    if (!secondaryError) setToast({ type: "ok", msg: "Solicitud creada." });
    resetForm();
    await loadSolicitudes();
    skipNextStepResetRef.current = true;
    setSelectedId(solicitudId);
    setActiveStep("aprobacion");
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
    try {
      await publishMonitoreoSolicitud(solicitudId);
      setToast({ type: "ok", msg: "Solicitud publicada de forma transaccional." });
    } catch (publishError) {
      setError(publishError instanceof Error ? publishError.message : "No se pudo publicar la solicitud.");
      return;
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
    const nextTitle = templateTitle.trim();
    const { data: insertedTemplate, error: tplErr } = await supabase
      .from("form_template")
      .insert({
        solicitud_id: selectedId,
        titulo: nextTitle,
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
      })
      .select("id")
      .single();
    if (tplErr) {
      setToast({ type: "err", msg: tplErr.message });
      return;
    }
    setTemplateTitle("");
    setTemplateCode("");
    setTemplateSubtitle("");
    if (selectedId) {
      try {
        const linked = await getLinkedMonitoreo(selectedId);
        if (linked?.id && insertedTemplate?.id) {
          await supabase.from("ficha_catalog").insert({
            monitoreo_id: linked.id,
            codigo: code,
            titulo: nextTitle,
            version: 1,
            orden: templates.length + 1,
            is_active: true,
            form_template_id: insertedTemplate.id,
          });
        }
      } catch {
        // no-op: keeps existing flow if linked monitoreo does not exist yet
      }
    }
    loadTemplates(selectedId);
    setActiveStep("encabezado");
  };

  const toggleTemplateEnabled = async (templateId: string, enabled: boolean) => {
    if (!selectedId || !canManageInactiveTemplates) return;
    setTemplateToggleBusyId(templateId);
    try {
      const linked = await getLinkedMonitoreo(selectedId);
      if (!linked?.id) {
        setToast({ type: "err", msg: "Este monitoreo aún no está publicado." });
        return;
      }
      const { error } = await supabase
        .from("ficha_catalog")
        .update({ is_active: enabled, updated_at: new Date().toISOString() })
        .eq("monitoreo_id", linked.id)
        .eq("form_template_id", templateId);
      if (error) throw new Error(error.message);
      setTemplateEnabledMap((prev) => ({ ...prev, [templateId]: enabled }));
      setToast({ type: "ok", msg: enabled ? "Ficha habilitada." : "Ficha inhabilitada." });
    } catch (e: any) {
      setToast({ type: "err", msg: e?.message || "No se pudo actualizar estado de ficha." });
    } finally {
      setTemplateToggleBusyId(null);
    }
  };

  const reuseTemplate = async () => {
    if (!selectedId) return;
    if (!reuseSourceTemplateId) {
      setToast({ type: "err", msg: "Selecciona una ficha origen para reutilizar." });
      return;
    }
    const newTitle = reuseTemplateTitle.trim();
    if (!newTitle) {
      setToast({ type: "err", msg: "El nuevo título de ficha es obligatorio." });
      return;
    }
    const source = allTemplates.find((t) => t.id === reuseSourceTemplateId);
    if (!source) {
      setToast({ type: "err", msg: "No se encontró la ficha origen seleccionada." });
      return;
    }

    const existsTitle = templates.some(
      (t) => t.id !== source.id && t.titulo.trim().toLowerCase() === newTitle.toLowerCase()
    );
    if (existsTitle) {
      setToast({ type: "err", msg: "Ya existe una ficha con ese título en este monitoreo." });
      return;
    }

    const newCode = (reuseTemplateCode.trim() || `F${templates.length + 1}`).toUpperCase();
    const existsCode = templates.some(
      (t) => t.id !== source.id && String(t.codigo || "").trim().toUpperCase() === newCode
    );
    if (existsCode) {
      setToast({ type: "err", msg: "Ya existe una ficha con ese código en este monitoreo." });
      return;
    }

    setSavingConfig(true);
    try {
      const cloneJson = <T,>(value: T): T => JSON.parse(JSON.stringify(value ?? null));

      const { data: secData, error: secErr } = await supabase
        .from("form_section")
        .select("id, titulo, orden")
        .eq("template_id", source.id)
        .order("orden", { ascending: true });
      if (secErr) throw new Error(secErr.message);

      const { data: qData, error: qErr } = await supabase
        .from("form_question")
        .select("id, section_id, tipo, texto, orden, orden_in_section, required, config_json")
        .eq("template_id", source.id)
        .order("orden", { ascending: true });
      if (qErr) throw new Error(qErr.message);

      const { data: newTemplate, error: insTplErr } = await supabase
        .from("form_template")
        .insert({
          solicitud_id: selectedId,
          titulo: newTitle,
          codigo: newCode,
          subtitulo: reuseTemplateSubtitle.trim() || source.subtitulo || null,
          header_config: cloneJson(source.header_config ?? DEFAULT_HEADER_CONFIG),
          footer_config: cloneJson(source.footer_config ?? {}),
          orden: templates.length + 1,
        })
        .select("id")
        .single();
      if (insTplErr) throw new Error(insTplErr.message);

      const sectionIdMap = new Map<string, string>();
      const sections = (secData ?? []) as Array<{ id: string; titulo: string; orden: number }>;
      for (const section of sections) {
        const { data: newSec, error: insSecErr } = await supabase
          .from("form_section")
          .insert({
            template_id: newTemplate.id,
            titulo: section.titulo,
            orden: section.orden,
          })
          .select("id")
          .single();
        if (insSecErr) throw new Error(insSecErr.message);
        sectionIdMap.set(section.id, newSec.id);
      }

      const questions = (qData ?? []) as Array<{
        id: string;
        section_id: string | null;
        tipo: string;
        texto: string;
        orden: number;
        orden_in_section: number | null;
        required: boolean;
        config_json: any;
      }>;
      if (questions.length) {
        const rows = questions.map((q) => ({
          template_id: newTemplate.id,
          section_id: q.section_id ? sectionIdMap.get(q.section_id) ?? null : null,
          tipo: q.tipo,
          texto: q.texto,
          orden: q.orden,
          orden_in_section: q.orden_in_section,
          required: q.required,
          config_json: cloneJson(q.config_json ?? {}),
        }));
        const { error: insQErr } = await supabase.from("form_question").insert(rows);
        if (insQErr) throw new Error(insQErr.message);
      }

      const linked = await getLinkedMonitoreo(selectedId);
      if (linked?.id) {
        const { error: fichaErr } = await supabase.from("ficha_catalog").insert({
          monitoreo_id: linked.id,
          codigo: newCode,
          titulo: newTitle,
          version: 1,
          orden: templates.length + 1,
          is_active: true,
          form_template_id: newTemplate.id,
        });
        if (fichaErr) throw new Error(fichaErr.message);
      }

      setReuseTemplateTitle("");
      setReuseTemplateCode("");
      setReuseTemplateSubtitle("");
      setReuseSourceTemplateId("");
      setReuseTemplateSearch("");
      await loadTemplates(selectedId);
      await loadGlobalTemplates();
      setSelectedTemplateId(newTemplate.id);
      setToast({ type: "ok", msg: "Ficha reutilizada correctamente como nueva copia." });
    } catch (e: any) {
      setToast({ type: "err", msg: e?.message || "No se pudo reutilizar la ficha." });
    } finally {
      setSavingConfig(false);
    }
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

  const publishSelectedTemplateVersion = async () => {
    if (!selectedTemplateId) return;
    setPublishingVersion(true);
    try {
      const version = await publishTemplateVersion(selectedTemplateId);
      setToast({ type: "ok", msg: `Version ${version} publicada e inmutable.` });
    } catch (publishError) {
      setToast({ type: "err", msg: publishError instanceof Error ? publishError.message : "No se pudo publicar la version." });
    } finally {
      setPublishingVersion(false);
    }
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
    if (!selectedTemplateId) {
      setToast({ type: "err", msg: "Selecciona una plantilla antes de agregar preguntas." });
      return;
    }
    if (!selectedSectionId) {
      setToast({ type: "err", msg: "Crea o selecciona una sección antes de agregar preguntas." });
      return;
    }
    if (!qTexto.trim()) {
      setToast({ type: "err", msg: "Escribe el texto de la pregunta." });
      return;
    }
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
      const { error } = await supabase
        .from("form_question")
        .update({
          tipo: qTipo,
          texto: qTexto.trim(),
          required: qRequired,
          config_json: Object.keys(config).length ? config : null,
        })
        .eq("id", editingQuestionId);
      if (error) {
        setToast({ type: "err", msg: error.message });
        return;
      }
    } else {
      const countInSection = questions.filter((x) => x.section_id === selectedSectionId).length;
      const { error } = await supabase.from("form_question").insert({
        template_id: selectedTemplateId,
        section_id: selectedSectionId,
        tipo: qTipo,
        texto: qTexto.trim(),
        orden: questions.length + 1,
        orden_in_section: countInSection + 1,
        required: qRequired,
        config_json: Object.keys(config).length ? config : null,
      });
      if (error) {
        setToast({ type: "err", msg: error.message });
        return;
      }
    }
    setToast({ type: "ok", msg: editingQuestionId ? "Pregunta actualizada." : "Pregunta guardada." });
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
    requestAnimationFrame(() => questionFormRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }));
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
    await exportPreviewPdfUtil({
      selectedTemplate,
      templateHeader,
      templateFooter,
      previewData,
      sections,
      questions,
    });
  };


  return (
    <div className="management-page space-y-5">
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
      <header className="management-hero rounded-2xl border p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="management-hero-icon shrink-0"><ManagementIcon type="manage" /></div>
            <div className="min-w-0">
              <div className="management-eyebrow">Control operativo</div>
              <h1 className="text-2xl font-bold tracking-tight sm:text-[1.7rem]">Crear Monitoreo</h1>
              <p className="mt-1 text-sm text-[var(--app-muted)]">
                Crea solicitudes, configura fichas y gestiona su publicación.
              </p>
            </div>
          </div>
          <div className="management-kpis grid grid-cols-3 gap-2">
            <div className="management-kpi"><span>Total</span><strong>{items.length}</strong></div>
            <div className="management-kpi is-pending"><span>Pendientes</span><strong>{items.filter((item) => item.status === "pending" || item.status === "approved_lv1").length}</strong></div>
            <div className="management-kpi is-approved"><span>Aprobados</span><strong>{items.filter((item) => item.status === "approved").length}</strong></div>
          </div>
        </div>
      </header>

      {!canCreate && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
          Tu cuenta no está habilitada para crear monitoreos. Comunícate con el administrador.
        </div>
      )}

      <div className="management-workspace grid gap-5 xl:grid-cols-[minmax(21rem_.85fr)_minmax(0_1.4fr)]">
        <section className="management-panel management-request-panel rounded-2xl border p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="management-section-icon"><ManagementIcon type="requests" /></div>
              <div><div className="management-eyebrow">Bandeja</div><h2 className="text-lg font-bold">Solicitudes</h2></div>
            </div>
            <button
              type="button"
              onClick={loadSolicitudes}
              className="management-refresh-button inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold"
            >
              <ManagementIcon type="refresh" />
              Refrescar
            </button>
          </div>

          {loading && <div className="mt-4 text-sm text-white/60">Cargando...</div>}
          {error && <div className="mt-4 text-sm text-red-100">{error}</div>}

          <div className="management-filter-bar mt-4 grid gap-3 rounded-xl border p-3 sm:grid-cols-[minmax(0_1fr)_minmax(9rem_.55fr)_5rem]">
            <label className="management-field-label text-xs">
              Buscar
              <input
                className="management-control mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                placeholder="Nombre o código SOL-XXXXXXX"
                value={solSearch}
                onChange={(e) => {
                  setSolSearch(e.target.value);
                  setSolPage(1);
                }}
              />
            </label>
            <label className="management-field-label text-xs">
              Estado
              <select
                className="management-control mt-1 w-full rounded-lg border px-3 py-2 text-sm"
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
            <label className="management-field-label text-xs">
              Ver
              <select
                className="management-control mt-1 w-full rounded-lg border px-2 py-2 text-sm"
                value={solPageSize}
                onChange={(e) => {
                  setSolPageSize(Number(e.target.value));
                  setSolPage(1);
                }}
              >
                {[5, 10, 15].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="management-result-count mt-3 inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold">{filteredSolicitudes.length} resultados</div>

          <div className="mt-4 space-y-2.5">
            {pageSolicitudes.map((s) => (
              <div
                key={s.id}
                onClick={() => setSelectedId(s.id)}
                onKeyDown={(e) => {
                  if (e.key !== "Enter" && e.key !== " ") return;
                  e.preventDefault();
                  setSelectedId(s.id);
                }}
                role="button"
                tabIndex={0}
                className={`management-request-card w-full min-h-[126px] rounded-xl border px-3.5 py-3 text-left ${selectedId === s.id ? "is-selected" : ""}`}
              >
                <div className="flex h-full flex-col">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div
                        className="line-clamp-2 text-[13px] font-semibold sm:text-sm"
                        style={{
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                        }}
                      >
                        {s.nombre}
                      </div>
                      {s.cdd && (
                        <span className="management-cdd-badge mt-1 inline-block rounded-full border px-2 py-0.5 text-[10px] font-semibold sm:text-[11px]">
                          CdD
                        </span>
                      )}
                    </div>
                    <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] sm:text-[11px] ${statusTone(s.status)}`}>
                      {statusLabel(s.status)}
                    </span>
                  </div>
                  <div className="management-request-date mt-1.5 text-[11px] sm:text-xs">
                    {s.fecha_inicio} → {s.fecha_fin}
                    {s.status === "approved" && isMonitoreoExpired(s.fecha_fin) ? " • Vencido" : ""}
                  </div>
                  <div className="mt-1.5 flex items-center justify-between gap-2">
                    <div className="management-request-code text-[11px] sm:text-xs">Código: SOL-{s.id.slice(0, 8).toUpperCase()}</div>
                    {((s.nombre || "").length > 80 || (s.detalle || "").length > 140) && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setSolicitudDetailModal(s);
                        }}
                        className="management-inline-button shrink-0 rounded-md border px-2 py-1 text-[10px] font-semibold sm:text-[11px]"
                      >
                        Ver más
                      </button>
                    )}
                  </div>
                  {s.motivo_rechazo && (
                    <div
                      className="mt-1 text-[11px] text-red-100 sm:text-xs"
                      style={{
                        display: "-webkit-box",
                        WebkitLineClamp: 1,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                      }}
                    >
                      Rechazo: {s.motivo_rechazo}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {!pageSolicitudes.length && (
              <div className="management-empty rounded-xl border px-4 py-4 text-center text-xs">
                Sin resultados.
              </div>
            )}
          </div>

          {solicitudDetailModal && (
            <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-4">
              <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-zinc-950 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs text-white/50">Solicitud</div>
                    <div className="text-lg font-semibold text-white">{solicitudDetailModal.nombre}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSolicitudDetailModal(null)}
                    className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/80 hover:bg-white/10"
                  >
                    Cerrar
                  </button>
                </div>
                <div className="mt-3 grid gap-2 text-xs text-white/65 md:grid-cols-2">
                  <div>Estado: {statusLabel(solicitudDetailModal.status)}</div>
                  <div>Código: SOL-{solicitudDetailModal.id.slice(0, 8).toUpperCase()}</div>
                  <div>Inicio: {solicitudDetailModal.fecha_inicio}</div>
                  <div>Fin: {solicitudDetailModal.fecha_fin}</div>
                  <div className="md:col-span-2">Creado: {solicitudDetailModal.created_at}</div>
                </div>
                <div className="mt-3 max-h-[50vh] overflow-y-auto rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-white/85 whitespace-pre-wrap">
                  {solicitudDetailModal.detalle?.trim() || "Sin descripción."}
                </div>
                {solicitudDetailModal.motivo_rechazo && (
                  <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-100">
                    Rechazo: {solicitudDetailModal.motivo_rechazo}
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="management-pagination mt-4 flex flex-wrap items-center justify-between gap-2 border-t pt-3 text-xs">
            <div>
              Página {solPage} de {solTotalPages}
            </div>
            <div className="flex gap-2">
              <button
                className="management-pagination-button rounded-lg border px-3 py-1.5 font-semibold"
                onClick={() => setSolPage((p) => Math.max(1, p - 1))}
                disabled={solPage <= 1}
              >
                Anterior
              </button>
              <button
                className="management-pagination-button rounded-lg border px-3 py-1.5 font-semibold"
                onClick={() => setSolPage((p) => Math.min(solTotalPages, p + 1))}
                disabled={solPage >= solTotalPages}
              >
                Siguiente
              </button>
            </div>
          </div>
        </section>

        <section className="space-y-6">
          <div className="management-panel management-create-panel rounded-2xl border p-4 sm:p-5">
            <div className="flex items-center gap-2.5">
              <div className="management-section-icon"><ManagementIcon type="create" /></div>
              <div><div className="management-eyebrow">Configuración</div><h2 className="text-lg font-bold">Nueva solicitud</h2></div>
            </div>
            <div className="mt-4 grid gap-3">
              <input
                className="management-control rounded-lg border px-3 py-2.5 text-sm"
                placeholder="Nombre del monitoreo"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                disabled={!canCreate || saving}
              />
              <textarea
                className="management-control min-h-[86px] rounded-lg border px-3 py-2.5 text-sm"
                placeholder="Detalle del monitoreo"
                value={detalle}
                onChange={(e) => setDetalle(e.target.value)}
                disabled={!canCreate || saving}
              />
              <div className="grid gap-3 md:grid-cols-2">
                <input
                  type="date"
                  className="management-control rounded-lg border px-3 py-2.5 text-sm"
                  value={fechaInicio}
                  onChange={(e) => setFechaInicio(e.target.value)}
                  disabled={!canCreate || saving}
                />
                <input
                  type="date"
                  className="management-control rounded-lg border px-3 py-2.5 text-sm"
                  value={fechaFin}
                  onChange={(e) => setFechaFin(e.target.value)}
                  disabled={!canCreate || saving}
                />
              </div>
              <label className="management-check-row flex items-center gap-2 rounded-lg border px-3 py-2.5 text-xs font-semibold">
                <input
                  type="checkbox"
                  checked={isCdd}
                  onChange={(e) => setIsCdd(e.target.checked)}
                  disabled={!canCreate || saving}
                />
                Compromiso de Desempeño (CdD)
              </label>

              <div className="management-subpanel rounded-xl border p-3.5">
                <div className="management-subpanel-title text-xs font-bold">Filtros de alcance</div>
                <div className="mt-1 text-[11px] text-[var(--app-muted)]">
                  ¿A qué tipo de instituciones aplica este monitoreo? (opcional: deja vacío para aplicar a todas)
                </div>
                <div className="management-filter-groups mt-3 grid grid-cols-2 gap-4 2xl:grid-cols-4">
                  <div>
                    <div className="management-group-title text-xs">Gestión</div>
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
                    <div className="management-group-title text-xs">Modalidad</div>
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
                    <div className="management-group-title text-xs">Tipo</div>
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
                    <div className="management-group-title text-xs">Nivel</div>
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
                  <div className="management-group-title text-xs">Restricción de guardado por código</div>
                  <select
                    className="management-control mt-1 w-full rounded-lg border px-3 py-2 text-sm md:max-w-md"
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

              <div className="management-subpanel rounded-xl border p-3.5">
                <div className="management-subpanel-title text-xs font-bold">Instituciones (selección manual)</div>
                <input
                  className="management-control mt-2 w-full rounded-lg border px-3 py-2 text-sm"
                  placeholder="Buscar por nombre o código modular"
                  value={ieQuery}
                  onChange={(e) => setIeQuery(e.target.value)}
                  disabled={!canCreate}
                />
                {ieResults.length > 0 && (
                  <div className="management-ie-results mt-2 max-h-40 overflow-y-auto rounded-lg border">
                    {ieResults.map((ie) => (
                      <button
                        key={ie.id}
                        type="button"
                        onClick={() => {
                          if (!ieSelected.find((x) => x.id === ie.id)) {
                            setIeSelected((v) => [...v, ie]);
                          }
                        }}
                        className="management-ie-option w-full px-3 py-2 text-left text-xs"
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
                className="executive-primary-action rounded-lg border px-4 py-2.5 text-sm font-bold disabled:opacity-50"
              >
                {saving ? "Guardando..." : "Crear solicitud"}
              </button>
            </div>
          </div>

          {selected && (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex flex-col gap-4 md:flex-row">
                <div className="md:w-[220px] md:shrink-0">
                  <StepNav
                    steps={stepItems}
                    current={activeStep}
                    onSelect={(id) => setActiveStep(id as typeof activeStep)}
                  />
                </div>
                <div className="min-w-0 flex-1 space-y-4">
              {activeStep === "aprobacion" && (
                <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold">{selected.nombre}</div>
                  <div className="text-xs text-white/60">
                    {statusLabel(selected.status)}
                    {selectedExpired ? " • Vencido" : ""}
                  </div>
                </div>
                <div className="flex flex-wrap items-start gap-3">
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
                  </div>
                  {(canReject && selected.status === "pending") ||
                  (isAdmin && (selected.status === "approved" || selected.status === "inactive")) ||
                  (isAdmin && (selected.status === "pending" || selected.status === "rejected")) ? (
                    <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-2">
                      <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-red-200/80">
                        Zona de riesgo
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {canReject && selected.status === "pending" && (
                          <button
                            type="button"
                            onClick={() => rejectSolicitud(selected.id)}
                            className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs text-red-100"
                          >
                            Rechazar
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
                  ) : null}
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
                </>
              )}

              {activeStep === "datos" && (
                <>
              {canOwnerOrAdmin && (
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
                  <div className="mt-1 text-[11px] text-white/45">
                    ¿A qué tipo de instituciones aplica este monitoreo?
                  </div>
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
                </>
              )}

              <div className="mt-4 grid gap-4">
                {activeStep === "fichas" && (
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
                {canManageInactiveTemplates && templates.length > 0 && (
                  <div className="mt-2 grid gap-2">
                    {templates.map((t) => (
                      <label
                        key={`toggle-${t.id}`}
                        className="flex items-center justify-between rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-white/75"
                      >
                        <span className="truncate pr-3">{t.titulo}</span>
                        <span className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={templateEnabledMap[t.id] !== false}
                            disabled={templateToggleBusyId === t.id}
                            onChange={(e) => {
                              e.stopPropagation();
                              void toggleTemplateEnabled(t.id, e.target.checked);
                            }}
                          />
                          {templateEnabledMap[t.id] !== false ? "Habilitada" : "Inhabilitada"}
                        </span>
                      </label>
                    ))}
                  </div>
                )}

                {canEditTemplates && (
                  <div className="mt-3 space-y-3">
                    <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-[1fr_140px_140px_120px]">
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

                    <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                      <div className="text-xs font-semibold text-white/80">Crear desde template existente</div>
                      <div className="mt-2 space-y-2">
                        <input
                          className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm"
                          placeholder="Buscar por ficha/template o monitoreo origen"
                          value={reuseTemplateSearch}
                          onChange={(e) => setReuseTemplateSearch(e.target.value)}
                        />
                        <div className="grid gap-2 md:grid-cols-2">
                          {reuseTemplateResults.map((t) => {
                            const active = reuseSourceTemplateId === t.id;
                            const dateText = (() => {
                              const source = t.updated_at || t.created_at || "";
                              if (!source) return "Sin fecha";
                              try {
                                return new Intl.DateTimeFormat("es-PE", {
                                  dateStyle: "short",
                                  timeStyle: "short",
                                  timeZone: "America/Lima",
                                }).format(new Date(source));
                              } catch {
                                return source;
                              }
                            })();
                            return (
                              <button
                                key={t.id}
                                type="button"
                                onClick={() => setReuseSourceTemplateId(t.id)}
                                className={`h-24 rounded-lg border px-3 py-2 text-left ${
                                  active
                                    ? "border-[var(--app-accent)] bg-white/10"
                                    : "border-white/10 bg-black/30 hover:bg-white/5"
                                }`}
                              >
                                <div className="truncate text-xs font-semibold text-white/90">
                                  {t.titulo} ({t.codigo})
                                </div>
                                <div className="truncate text-[11px] text-white/65">
                                  {t.monitoreo_nombre} ({t.monitoreo_codigo})
                                </div>
                                <div className="truncate text-[11px] text-white/55">
                                  {t.metadata || "Sin metadata"}
                                </div>
                                <div className="mt-1 text-[10px] text-white/45">{dateText}</div>
                              </button>
                            );
                          })}
                          {!reuseTemplateResults.length && (
                            <div className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs text-white/60 md:col-span-2">
                              No hay templates que coincidan con la búsqueda.
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="mt-2 grid gap-2 md:grid-cols-2 lg:grid-cols-[1fr_140px_140px_120px]">
                        <input
                          className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm"
                          placeholder="Nuevo título"
                          value={reuseTemplateTitle}
                          onChange={(e) => setReuseTemplateTitle(e.target.value)}
                        />
                        <input
                          className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm"
                          placeholder="Nuevo código"
                          value={reuseTemplateCode}
                          onChange={(e) => setReuseTemplateCode(e.target.value)}
                        />
                        <input
                          className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm"
                          placeholder="Subtítulo"
                          value={reuseTemplateSubtitle}
                          onChange={(e) => setReuseTemplateSubtitle(e.target.value)}
                        />
                        <button
                          type="button"
                          onClick={reuseTemplate}
                          disabled={savingConfig || !allTemplates.length}
                          className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/80 disabled:opacity-50"
                        >
                          Reutilizar
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
                )}

                {activeStep === "encabezado" && (
                <>
                {!selectedTemplateId && (
                  <div className="rounded-xl border border-dashed border-white/15 bg-white/5 p-4 text-center">
                    <div className="text-sm font-semibold">Primero elige o crea una ficha</div>
                    <p className="mt-1 text-xs text-white/60">
                      El encabezado y cierre se configuran dentro de una ficha.
                    </p>
                    <button
                      type="button"
                      onClick={() => setActiveStep("fichas")}
                      className="mt-3 rounded-lg border border-[var(--app-accent)] bg-white/5 px-3 py-1.5 text-xs font-semibold text-[var(--app-accent)]"
                    >
                      Ir a Fichas
                    </button>
                  </div>
                )}
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
                      {canEditTemplates && (
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
                          <button
                            type="button"
                            disabled={publishingVersion}
                            onClick={publishSelectedTemplateVersion}
                            className="rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-xs text-emerald-100 disabled:opacity-50"
                          >
                            {publishingVersion ? "Publicando..." : "Publicar version"}
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
                              className={`grid gap-2 rounded-lg border p-3 md:grid-cols-2 xl:grid-cols-[minmax(0,1.5fr)_130px_minmax(0,1fr)_110px_auto] ${editingTemplateFieldId === field.id ? "border-sky-400/40 bg-sky-500/10" : "border-white/10 bg-white/5"}`}
                            >
                              <input
                                className="min-w-0 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm"
                                value={field.label}
                                onChange={(e) => patchTemplateCustomField(field.id, { label: e.target.value })}
                              />
                              <select
                                className="min-w-0 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm"
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
                                className="min-w-0 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm"
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
                              <div className="flex flex-wrap gap-2 xl:flex-nowrap">
                                <button
                                  type="button"
                                  onClick={() => setEditingTemplateFieldId((prev) => (prev === field.id ? null : field.id))}
                                  className={`rounded-lg border px-2 py-2 text-xs ${editingTemplateFieldId === field.id ? "border-sky-400/40 bg-sky-500/15 text-sky-100" : "border-white/10 bg-white/5 text-white/80"}`}
                                  title="Editar campo"
                                >
                                  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
                                    <path d="M3.5 13.5V16.5H6.5L15 8L12 5L3.5 13.5Z" />
                                    <path d="M11.5 5.5L14.5 8.5" />
                                  </svg>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => moveTemplateCustomField(field.id, -1)}
                                  className="rounded-lg border border-white/10 bg-white/5 px-2 py-2 text-xs text-white/80"
                                  title="Subir"
                                >
                                  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
                                    <path d="M10 15V5" />
                                    <path d="M6.5 8.5L10 5L13.5 8.5" />
                                  </svg>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => moveTemplateCustomField(field.id, 1)}
                                  className="rounded-lg border border-white/10 bg-white/5 px-2 py-2 text-xs text-white/80"
                                  title="Bajar"
                                >
                                  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
                                    <path d="M10 5V15" />
                                    <path d="M6.5 11.5L10 15L13.5 11.5" />
                                  </svg>
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
                  </div>
                )}
                </>
                )}

                {activeStep === "preguntas" && (
                <>
                {!selectedTemplateId && (
                  <div className="rounded-xl border border-dashed border-white/15 bg-white/5 p-4 text-center">
                    <div className="text-sm font-semibold">Primero elige o crea una ficha</div>
                    <p className="mt-1 text-xs text-white/60">
                      Las secciones y preguntas se configuran dentro de una ficha.
                    </p>
                    <button
                      type="button"
                      onClick={() => setActiveStep("fichas")}
                      className="mt-3 rounded-lg border border-[var(--app-accent)] bg-white/5 px-3 py-1.5 text-xs font-semibold text-[var(--app-accent)]"
                    >
                      Ir a Fichas
                    </button>
                  </div>
                )}
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
                            {canEditTemplates && (
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
                      {canEditTemplates && (
                        <div id="add-section-row" className="mt-3 flex flex-wrap gap-2">
                          <input
                            id="add-section-input"
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
                          {canEditTemplates && (
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

                    {canEditTemplates && (
                      <div className="mt-3 space-y-2">
                        {sections.length === 0 ? (
                          <div className="rounded-xl border border-dashed border-white/15 bg-white/5 p-4 text-center">
                            <div className="text-sm font-semibold">Primero crea una sección</div>
                            <p className="mt-1 text-xs text-white/60">
                              Las preguntas se organizan dentro de secciones. Crea al menos una para poder
                              agregar preguntas.
                            </p>
                            <button
                              type="button"
                              onClick={() => {
                                document.getElementById("add-section-input")?.focus();
                                document
                                  .getElementById("add-section-row")
                                  ?.scrollIntoView({ behavior: "smooth", block: "center" });
                              }}
                              className="mt-3 rounded-lg border border-[var(--app-accent)] bg-white/5 px-3 py-1.5 text-xs font-semibold text-[var(--app-accent)]"
                            >
                              Crear mi primera sección
                            </button>
                          </div>
                        ) : (
                        <>
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              resetQuestionForm();
                              setShowQuestionForm(true);
                              requestAnimationFrame(() => questionFormRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }));
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
                        <div
                          ref={questionFormRef}
                          className="mt-3 space-y-2 rounded-xl border-2 border-[var(--app-accent)] bg-[color-mix(in_srgb,var(--app-accent)_8%,transparent)] p-3 shadow-[0_0_0_4px_color-mix(in_srgb,var(--app-accent)_12%,transparent)]"
                        >
                        <div className="flex items-center gap-2 text-sm font-semibold text-[var(--app-accent)]">
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--app-accent)] text-[11px] text-white">
                            {editingQuestionId ? "✎" : "+"}
                          </span>
                          {editingQuestionId ? "Editando pregunta" : "Nueva pregunta"}
                        </div>
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
                        </>
                        )}
                      </div>
                    )}
                  </div>
                )}
                </>
                )}
              </div>

              {activeStep === "preview" && (
                <div className="space-y-3 rounded-xl border border-white/10 bg-white/5 p-4">
                  <div>
                    <div className="text-sm font-semibold">Revisar y publicar</div>
                    <p className="mt-1 text-xs text-white/60">
                      Revisa cómo se verá la ficha antes de publicarla. Puedes volver a cualquier paso
                      anterior para hacer ajustes.
                    </p>
                  </div>
                  {!selectedTemplateId ? (
                    <div className="rounded-lg border border-dashed border-white/15 bg-black/20 p-3 text-xs text-white/60">
                      Selecciona una ficha en el paso "Fichas" para ver su vista previa.
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
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
                      {canEditTemplates && (
                        <button
                          type="button"
                          disabled={publishingVersion}
                          onClick={publishSelectedTemplateVersion}
                          className="rounded-lg border border-[var(--app-accent)] bg-[color-mix(in_srgb,var(--app-accent)_14%,transparent)] px-3 py-2 text-xs font-semibold text-[var(--app-accent)] disabled:opacity-50"
                        >
                          {publishingVersion ? "Publicando..." : "Publicar versión de la ficha"}
                        </button>
                      )}
                      {isAdmin && selected.status === "approved_lv1" && (
                        <button
                          type="button"
                          onClick={() => approveFinal(selected.id)}
                          className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-100"
                        >
                          Aprobar final y publicar solicitud
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
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
      <PreviewModal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        selectedTemplate={selectedTemplate}
        templateHeader={templateHeader}
        templateFooter={templateFooter}
        previewData={previewData}
        savePreview={savePreview}
        sections={sections}
        questions={questions}
        onExportPdf={exportPreviewPdf}
      />
    </div>
  );
}
