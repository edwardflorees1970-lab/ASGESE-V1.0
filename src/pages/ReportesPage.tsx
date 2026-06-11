import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import jsPDF from "jspdf";
import logoUrl from "../assets/ugel06_3.jpg";
import { useAuth } from "../app/AuthProvider";
import { supabase } from "../lib/supabaseClient";
import { canSeeAllRole, isAdminRole, roleLabel } from "../lib/roles";
import { useAppConfig } from "../app/AppConfigProvider";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { normalizeHeaderConfig, type HeaderFieldDef } from "../lib/dynamicHeader";
import {
  exportAnalyticsCsv,
  exportAnalyticsExcel,
  type AnalyticsColumn,
  type AnalyticsRow,
} from "../lib/analyticsExport";

type RunRow = {
  id: string;
  status: string;
  created_by: string;
  created_at: string;
  updated_at?: string | null;
  is_test?: boolean | null;
  template_id?: string;
  institucion_educativa: string | null;
  docente: string | null;
  header_json?: Record<string, any> | null;
  footer_json?: Record<string, any> | null;
};

type ProfileRow = {
  id: string;
  role: "admin" | "user" | string;
  nombres: string | null;
  apellido_paterno: string | null;
  apellido_materno: string | null;
  correo: string | null;
  email: string | null;
};

type FichaRow = {
  id: string;
  codigo: string;
  monitoreo_id: string;
  titulo?: string | null;
  form_template_id?: string | null;
};

type TemplateRow = {
  id: string;
  titulo: string;
  codigo: string;
};

type MonitoreoRow = {
  id: string;
  codigo: string;
  nombre: string;
  anio: number;
  is_active: boolean;
  descripcion?: string | null;
  fecha_fin?: string | null;
};

function cls(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function fmtDateShort(iso: string) {
  try {
    return new Intl.DateTimeFormat("es-PE", {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: "America/Lima",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function formatDateOnly(date?: string | null) {
  if (!date) return "Sin fecha fin";
  const [y, m, d] = date.split("-");
  if (!y || !m || !d) return date;
  return `${d}/${m}/${y}`;
}

function daysFromTodayLocal(date?: string | null) {
  if (!date) return null;
  const [y, m, d] = date.split("-").map(Number);
  if (!y || !m || !d) return null;
  const target = new Date(y, m - 1, d);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

function isMonitoreoExpiredLocal(date?: string | null) {
  const days = daysFromTodayLocal(date);
  return days !== null && days < 0;
}

function temporalLabel(date?: string | null) {
  const days = daysFromTodayLocal(date);
  if (days == null) return "Sin fecha de vencimiento";
  if (days < 0) return `Vencido hace ${Math.abs(days)} días`;
  if (days === 0) return "Vence hoy";
  return `Faltan ${days} días`;
}

function statusLabel(s: string) {
  if (s === "borrador") return "borrador";
  if (s === "draft") return "borrador";
  return s;
}

function IconEdit() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
      <path d="M3.5 13.5V16.5H6.5L15 8L12 5L3.5 13.5Z" />
      <path d="M11.5 5.5L14.5 8.5" />
    </svg>
  );
}

function IconTrash() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
      <path d="M4.5 6H15.5" />
      <path d="M7 6V4.5H13V6" />
      <path d="M6.5 6L7.2 15.5H12.8L13.5 6" />
    </svg>
  );
}

function IconPdf() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
      <path d="M6 2.5H11L15 6.5V17.5H6Z" />
      <path d="M11 2.5V6.5H15" />
      <path d="M7.5 13H12.5" />
      <path d="M7.5 10.5H11.5" />
    </svg>
  );
}

function IconEye() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
      <path d="M2.2 10C3.9 6.9 6.6 5.3 10 5.3C13.4 5.3 16.1 6.9 17.8 10C16.1 13.1 13.4 14.7 10 14.7C6.6 14.7 3.9 13.1 2.2 10Z" />
      <circle cx="10" cy="10" r="2.5" />
    </svg>
  );
}

function IconReport() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5" aria-hidden="true">
      <path d="M5 19V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2Z" />
      <path d="M14 3v5h5" />
      <path d="M8.5 16v-3M12 16V9.5M15.5 16v-5" />
    </svg>
  );
}

function IconCalendar() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4" aria-hidden="true">
      <path d="M7 3v4M17 3v4M4 9h16" />
      <rect x="4" y="5" width="16" height="16" rx="2.5" />
    </svg>
  );
}

function IconArrow() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="agebre-action-icon h-4 w-4" aria-hidden="true">
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </svg>
  );
}

function IconInfo() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 10.8v5" />
      <path d="M12 7.5h.01" />
    </svg>
  );
}

function IconSearch() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4" aria-hidden="true">
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4 4" />
    </svg>
  );
}

function IconClose() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className="h-4 w-4" aria-hidden="true">
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

function IconDownload() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4" aria-hidden="true">
      <path d="M12 3v12" />
      <path d="m7 10 5 5 5-5" />
      <path d="M5 20h14" />
    </svg>
  );
}

function IconFinalize() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
      <circle cx="10" cy="10" r="7" />
      <path d="M7 10.2L9.2 12.4L13.2 8.4" />
    </svg>
  );
}

function parseDateValue(value: unknown) {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseDateOnlyValue(value: unknown) {
  if (!value) return null;
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return parseDateValue(value);
  const [, year, month, day] = match;
  return new Date(Number(year), Number(month) - 1, Number(day), 12);
}

function jsonText(value: unknown) {
  if (value == null) return "";
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function answerPrimary(value: any) {
  if (!value || typeof value !== "object") return "";
  if (value.option != null && value.option !== "") return String(value.option);
  if (Array.isArray(value.options) && value.options.length) return value.options.join(" | ");
  if (value.yn != null && value.yn !== "") return String(value.yn);
  if (value.text != null && value.text !== "") return String(value.text);
  if (value.number != null && value.number !== "") return String(value.number);
  if (value.fileName != null && value.fileName !== "") return String(value.fileName);
  return "";
}

function IconDraft() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
      <path d="M4 10A6 6 0 1 0 6 5.5" />
      <path d="M4 4.5V7.5H7" />
    </svg>
  );
}

function ActionIconButton({
  title,
  onClick,
  children,
  danger = false,
  disabled = false,
}: {
  title: string;
  onClick: () => void;
  children: ReactNode;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      disabled={disabled}
      className={cls(
        "inline-flex h-9 w-9 items-center justify-center rounded-lg border text-white/85 transition",
        danger
          ? "border-red-500/30 bg-red-500/10 text-red-100 hover:bg-red-500/15"
          : "border-white/10 bg-white/5 hover:bg-white/10",
        disabled && "cursor-not-allowed opacity-50"
      )}
    >
      {children}
    </button>
  );
}

function getCreatorName(creator?: ProfileRow) {
  return (
    [creator?.apellido_paterno, creator?.apellido_materno, creator?.nombres]
      .filter(Boolean)
      .join(" ")
      .trim() ||
    creator?.correo ||
    creator?.email ||
    "Usuario"
  );
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

function RunSummary({
  monitoreado,
  institucion,
}: {
  monitoreado: string;
  institucion: string;
}) {
  return (
    <div className="text-xs text-white/50 leading-4">
      <div>Monitoreado: {monitoreado}</div>
      <div>Institucion: {institucion}</div>
    </div>
  );
}

export function ReportesPage() {
  const nav = useNavigate();
  const { user, profile } = useAuth();
  const { isTestMode } = useAppConfig();
  const role = profile?.role;
  const isAdmin = isAdminRole(role);
  const canSeeAll = canSeeAllRole(role);
  const isResponsableCdd = role === "responsable_cdd";

  const now = new Date();
  const [year, setYear] = useState(String(now.getFullYear()));
  const [selectedFicha, setSelectedFicha] = useState("ALL");
  const [selectedMonitoreo, setSelectedMonitoreo] = useState("");
  const [status, setStatus] = useState("ALL");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [monitorQuery, setMonitorQuery] = useState("");
  const [colegioQuery, setColegioQuery] = useState("");
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [monitoreoSearch, setMonitoreoSearch] = useState("");
  const [monitoreoPageSize, setMonitoreoPageSize] = useState(10);
  const [monitoreoPage, setMonitoreoPage] = useState(1);

  const [years, setYears] = useState<string[]>([]);
  const [monitoreos, setMonitoreos] = useState<MonitoreoRow[]>([]);
  const [monitoreoFichas, setMonitoreoFichas] = useState<FichaRow[]>([]);

  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<"csv" | "xlsx" | null>(null);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: "ok" | "err"; msg: string } | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [confirmDeleteRun, setConfirmDeleteRun] = useState<RunRow | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null);
  const [previewPdfTitle, setPreviewPdfTitle] = useState("");
  const [reportMonitoreoModal, setReportMonitoreoModal] = useState<MonitoreoRow | null>(null);

  const [runs, setRuns] = useState<RunRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProfileRow>>({});
  const [fichasByTemplate, setFichasByTemplate] = useState<Record<string, FichaRow>>({});
  const [templates, setTemplates] = useState<Record<string, TemplateRow>>({});
  const [monById, setMonById] = useState<Record<string, MonitoreoRow>>({});

  // Años disponibles
  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase
        .from("monitoreo_catalog")
        .select("anio")
        .order("anio", { ascending: false });
      if (!alive) return;
      const uniq = Array.from(new Set((data ?? []).map((x: any) => String(x.anio))));
      setYears(uniq);
      if (uniq.length && !uniq.includes(year)) setYear(uniq[0]);
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Monitoreos por año
  useEffect(() => {
    let alive = true;
    (async () => {
      let query = supabase
        .from("monitoreo_catalog")
        .select("id, codigo, nombre, anio, is_active, solicitud_id, descripcion, fecha_fin")
        .eq("anio", Number(year))
        .eq("is_active", true)
        .order("nombre", { ascending: true });

      if (isResponsableCdd && user?.id) {
        const [{ data: asigData }, { data: solData }] = await Promise.all([
          supabase
            .from("monitoreo_asignacion")
            .select("monitoreo_id")
            .eq("user_id", user.id),
          supabase
            .from("monitoreo_solicitud")
            .select("id")
            .eq("cdd", true),
        ]);

        const assignedIds = Array.from(new Set((asigData ?? []).map((r: any) => r.monitoreo_id).filter(Boolean)));
        const cddSolicitudIds = Array.from(new Set((solData ?? []).map((r: any) => r.id).filter(Boolean)));
        if (!assignedIds.length || !cddSolicitudIds.length) {
          if (!alive) return;
          setMonitoreos([]);
          if (selectedMonitoreo) setSelectedMonitoreo("");
          return;
        }
        query = query.in("id", assignedIds).in("solicitud_id", cddSolicitudIds);
      }

      const { data } = await query;
      if (!alive) return;
      setMonitoreos((data ?? []) as MonitoreoRow[]);
      if (selectedMonitoreo && !(data ?? []).some((m: any) => m.codigo === selectedMonitoreo)) {
        setSelectedMonitoreo("");
      }
    })();
    return () => {
      alive = false;
    };
  }, [year, selectedMonitoreo, isResponsableCdd, user?.id]);

  // Carga principal
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setErr(null);

        if (!user?.id) {
          setRuns([]);
          setProfiles({});
          setFichasByTemplate({});
          setMonById({});
          setLoading(false);
          return;
        }
        if (!selectedMonitoreo) {
          setRuns([]);
          setProfiles({});
          setFichasByTemplate({});
          setTemplates({});
          setMonById({});
          setLoading(false);
          return;
        }

        const y = Number(year);
        const start = new Date(y, 0, 1);
        const end = new Date(y + 1, 0, 1);

        let templateIdsByMon: string[] | null = null;
        const mon = monitoreos.find((x) => x.codigo === selectedMonitoreo);
        if (mon?.id) {
          const { data: fichasData, error: fichasErr } = await supabase
            .from("ficha_catalog")
            .select("id, codigo, monitoreo_id, form_template_id")
            .eq("monitoreo_id", mon.id);
          if (fichasErr) throw new Error(fichasErr.message);
          const fichasRows = ((fichasData ?? []) as FichaRow[]).filter((f) =>
            selectedFicha === "ALL" ? true : f.form_template_id === selectedFicha
          );
          templateIdsByMon = fichasRows
            .map((f: any) => f.form_template_id)
            .filter(Boolean);
        } else {
          templateIdsByMon = [];
        }

        let roleUserIds: string[] | null = null;
        if (canSeeAll && roleFilter !== "ALL") {
          const { data: roleUsers, error: roleErr } = await supabase
            .from("profiles")
            .select("id, role")
            .eq("role", roleFilter);
          if (roleErr) throw new Error(roleErr.message);
          roleUserIds = (roleUsers ?? []).map((u: any) => u.id);
        }

        let formQuery = supabase
          .from("form_run")
          .select("id, status, created_by, created_at, updated_at, is_test, template_id, header_json, footer_json")
          .gte("created_at", start.toISOString())
          .lt("created_at", end.toISOString())
          .order("created_at", { ascending: false })
          .eq("is_test", isTestMode);

        if (!canSeeAll) {
          formQuery = formQuery.eq("created_by", user.id);
        } else if (roleUserIds) {
          if (!roleUserIds.length) {
            if (!alive) return;
            setRuns([]);
            setProfiles({});
            setFichasByTemplate({});
            setTemplates({});
            setMonById({});
            setLoading(false);
            return;
          }
          formQuery = formQuery.in("created_by", roleUserIds);
        }

        if (status === "ALL") {
          formQuery = formQuery.neq("status", "borrador");
        } else {
          formQuery = formQuery.eq("status", status);
        }

        if (templateIdsByMon) {
          if (!templateIdsByMon.length) {
            if (!alive) return;
            setRuns([]);
            setProfiles({});
            setFichasByTemplate({});
            setTemplates({});
            setMonById({});
            setLoading(false);
            return;
          }
          formQuery = formQuery.in("template_id", templateIdsByMon);
        }

        const { data: formData, error: formErr } = await formQuery;
        if (formErr) throw new Error(formErr.message);
        const dynRuns: RunRow[] = (formData ?? []).map((r: any) => ({
          id: r.id,
          status: r.status,
          created_by: r.created_by,
          created_at: r.created_at,
          updated_at: r.updated_at,
          is_test: r.is_test,
          template_id: r.template_id,
          institucion_educativa: r.header_json?.institucion ?? null,
          docente: r.header_json?.monitoreado ?? null,
          header_json: r.header_json ?? {},
          footer_json: r.footer_json ?? {},
        }));

        const runRows = [...dynRuns].sort((a, b) =>
          String(b.created_at).localeCompare(String(a.created_at))
        );
        if (!alive) return;
        setRuns(runRows);

        const templateIdSet = Array.from(new Set(dynRuns.map((r) => r.template_id).filter(Boolean) as string[]));
        if (templateIdSet.length) {
          const { data: tData, error: tErr } = await supabase
            .from("form_template")
            .select("id, titulo, codigo")
            .in("id", templateIdSet);
          if (tErr) throw new Error(tErr.message);
          const tMap: Record<string, TemplateRow> = {};
          (tData ?? []).forEach((t: any) => (tMap[t.id] = t));
          setTemplates(tMap);

          const { data: fTplData, error: fTplErr } = await supabase
            .from("ficha_catalog")
            .select("id, codigo, monitoreo_id, form_template_id")
            .in("form_template_id", templateIdSet);
          if (fTplErr) throw new Error(fTplErr.message);
          const fByTpl: Record<string, FichaRow> = {};
          (fTplData ?? []).forEach((f: any) => {
            if (f.form_template_id) fByTpl[f.form_template_id] = f;
          });
          setFichasByTemplate((prev) => ({ ...prev, ...fByTpl }));

          const monIdSet = Array.from(
            new Set((fTplData ?? []).map((f: any) => f.monitoreo_id))
          );
          if (monIdSet.length) {
            const { data: mData, error: mErr } = await supabase
              .from("monitoreo_catalog")
              .select("id, codigo, nombre, anio, is_active")
              .in("id", monIdSet);
            if (mErr) throw new Error(mErr.message);
            const mMap: Record<string, MonitoreoRow> = {};
            (mData ?? []).forEach((m: any) => (mMap[m.id] = m));
            setMonById((prev) => ({ ...prev, ...mMap }));
          }
        } else {
          setTemplates({});
        }

        const userIds = Array.from(new Set(runRows.map((r) => r.created_by)));
        if (userIds.length) {
          const { data: pData, error: pErr } = await supabase
            .from("profiles")
            .select("id, role, nombres, apellido_paterno, apellido_materno, correo, email")
            .in("id", userIds);
          if (pErr) throw new Error(pErr.message);
          const pMap: Record<string, ProfileRow> = {};
          (pData ?? []).forEach((p: any) => (pMap[p.id] = p));
          setProfiles(pMap);
        } else {
          setProfiles({});
        }
      } catch (e: any) {
        if (!alive) return;
        setErr(e?.message || "No se pudo cargar reportes.");
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [year, selectedFicha, selectedMonitoreo, status, roleFilter, monitoreos, user?.id, canSeeAll, isTestMode]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    return () => {
      if (previewPdfUrl) URL.revokeObjectURL(previewPdfUrl);
    };
  }, [previewPdfUrl]);

  const visibleRuns = useMemo(() => {
    const monitorTerm = monitorQuery.trim().toLowerCase();
    const colegioTerm = colegioQuery.trim().toLowerCase();
    return runs.filter((r) => {
      const creatorName = getCreatorName(profiles[r.created_by]).toLowerCase();
      const ieName = (r.institucion_educativa || "").toLowerCase();
      if (monitorTerm && !creatorName.includes(monitorTerm)) return false;
      if (colegioTerm && !ieName.includes(colegioTerm)) return false;
      return true;
    });
  }, [runs, profiles, monitorQuery, colegioQuery]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(visibleRuns.length / pageSize)),
    [visibleRuns.length, pageSize]
  );

  const pagedRuns = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return visibleRuns.slice(start, start + pageSize);
  }, [visibleRuns, currentPage, pageSize]);

  const pageStart = visibleRuns.length ? (currentPage - 1) * pageSize + 1 : 0;
  const pageEnd = Math.min(currentPage * pageSize, visibleRuns.length);

  useEffect(() => {
    setCurrentPage(1);
  }, [year, selectedFicha, selectedMonitoreo, status, roleFilter, monitorQuery, colegioQuery]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const selectedMonitoreoRow = useMemo(
    () => monitoreos.find((m) => m.codigo === selectedMonitoreo) ?? null,
    [monitoreos, selectedMonitoreo]
  );

  const filteredMonitoreos = useMemo(() => {
    const term = monitoreoSearch.trim().toLowerCase();
    if (!term) return monitoreos;
    return monitoreos.filter((m) => m.nombre.toLowerCase().includes(term));
  }, [monitoreos, monitoreoSearch]);

  const monitoreoTotalPages = Math.max(1, Math.ceil(filteredMonitoreos.length / monitoreoPageSize));
  const monitoreoPageSafe = Math.min(monitoreoPage, monitoreoTotalPages);
  const monitoreoStart = filteredMonitoreos.length ? (monitoreoPageSafe - 1) * monitoreoPageSize + 1 : 0;
  const monitoreoEnd = Math.min(monitoreoPageSafe * monitoreoPageSize, filteredMonitoreos.length);
  const pagedMonitoreos = useMemo(() => {
    const start = (monitoreoPageSafe - 1) * monitoreoPageSize;
    return filteredMonitoreos.slice(start, start + monitoreoPageSize);
  }, [filteredMonitoreos, monitoreoPageSafe, monitoreoPageSize]);

  useEffect(() => {
    setMonitoreoPage(1);
  }, [monitoreoSearch, monitoreoPageSize, year, monitoreos.length]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setSelectedFicha("ALL");
      setMonitoreoFichas([]);
      if (!selectedMonitoreoRow?.id) return;
      const { data, error } = await supabase
        .from("ficha_catalog")
        .select("id, codigo, monitoreo_id, form_template_id, titulo")
        .eq("monitoreo_id", selectedMonitoreoRow.id)
        .order("codigo", { ascending: true });
      if (!alive || error) return;
      setMonitoreoFichas(((data ?? []) as any[]).filter((f) => f.form_template_id) as FichaRow[]);
    })();
    return () => {
      alive = false;
    };
  }, [selectedMonitoreoRow?.id]);

  const enterReportes = (codigo: string) => {
    setSelectedMonitoreo(codigo);
    setCurrentPage(1);
  };

  const canEditOrDelete = (run: RunRow) => {
    if (isAdmin) return true;
    return run.created_by === user?.id;
  };

  const canChangeStatus = (run: RunRow) => {
    if (isAdmin) return true;
    return run.created_by === user?.id;
  };

  const buildRunPdf = async (run?: RunRow) => {
    if (!run?.template_id) {
      setToast({ type: "err", msg: "No se pudo resolver la ficha." });
      return null;
    }
    try {
      const fieldKey = (label: string) => label.toLowerCase().trim().replace(/\s+/g, "_");
      const normalizeExtraFields = (input: any) => {
        if (!Array.isArray(input)) return [] as Array<{ label: string; mode: "registro" | "elaboracion"; default_value?: string | null }>;
        return input
          .map((item: any) => {
            if (typeof item === "string") {
              const label = item.trim();
              return label ? { label, mode: "registro" as const, default_value: "" } : null;
            }
            if (!item || typeof item !== "object") return null;
            const label = String(item.label ?? "").trim();
            if (!label) return null;
            return {
              label,
              mode: item.mode === "elaboracion" ? "elaboracion" : "registro",
              default_value: item.default_value ?? "",
            };
          })
          .filter(Boolean) as Array<{ label: string; mode: "registro" | "elaboracion"; default_value?: string | null }>;
      };
      const [{ data: tpl }, { data: secRows }, { data: qRows }, { data: runRow }, { data: ansRows }] =
        await Promise.all([
          supabase
            .from("form_template")
            .select("id, titulo, codigo, subtitulo, header_config, footer_config")
            .eq("id", run.template_id)
            .maybeSingle(),
          supabase
            .from("form_section")
            .select("id, template_id, titulo, orden")
            .eq("template_id", run.template_id)
            .order("orden", { ascending: true }),
          supabase
            .from("form_question")
            .select("id, template_id, section_id, tipo, texto, orden, orden_in_section, config_json")
            .eq("template_id", run.template_id)
            .order("orden", { ascending: true }),
          supabase
            .from("form_run")
            .select("id, header_json, footer_json")
            .eq("id", run.id)
            .maybeSingle(),
          supabase
            .from("form_answer")
            .select("question_id, value_json")
            .eq("run_id", run.id),
        ]);

      if (!tpl || !runRow) {
        setToast({ type: "err", msg: "No se pudo cargar datos de la ficha." });
        return;
      }

      const answersMap: Record<string, any> = {};
      (ansRows ?? []).forEach((a: any) => {
        answersMap[a.question_id] = a.value_json;
      });

      const headerCfg = normalizeHeaderConfig(tpl.header_config ?? {});
      const footerCfg = tpl.footer_config ?? {};
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
      const effectiveHeader = headerCfg;
      const effectiveFooter = { ...defaultFooter, ...(footerCfg || {}) };
      const headerRaw = runRow.header_json ?? {};
      const footerRaw = runRow.footer_json ?? {};
      const header = {
        institucion:
          headerRaw.institucion ??
          headerRaw.institucion_educativa ??
          headerRaw.ie ??
          "",
        codigo_modular: headerRaw.codigo_modular ?? headerRaw.cod_modular ?? "",
        codigo_local: headerRaw.codigo_local ?? headerRaw.cod_local ?? "",
        distrito: headerRaw.distrito ?? headerRaw.lugar ?? headerRaw.lugar_ie ?? "",
        rei: headerRaw.rei ?? "",
        monitor:
          headerRaw.monitor ??
          headerRaw.monitor_nombre ??
          headerRaw.director_monitor ??
          "",
        monitor_doc_tipo: headerRaw.monitor_doc_tipo ?? "",
        monitor_numero_doc: headerRaw.monitor_numero_doc ?? "",
        monitoreado:
          headerRaw.monitoreado ??
          headerRaw.docente ??
          headerRaw.docente_nombre ??
          "",
        monitoreado_doc_tipo: headerRaw.monitoreado_doc_tipo ?? "",
        monitoreado_numero_doc: headerRaw.monitoreado_numero_doc ?? "",
        monitoreado_cargo: headerRaw.monitoreado_cargo ?? "",
        monitoreado_telefono: headerRaw.monitoreado_telefono ?? "",
        monitoreado_correo: headerRaw.monitoreado_correo ?? "",
        condicion: headerRaw.condicion ?? headerRaw.condicion_docente ?? "",
        area: headerRaw.area ?? headerRaw.area_monitoreo ?? "",
        numero_visitas: headerRaw.numero_visitas ?? "",
        fecha_aplicacion: headerRaw.fecha_aplicacion ?? "",
        hora_inicio: headerRaw.hora_inicio ?? "",
        hora_fin: headerRaw.hora_fin ?? "",
        custom_values:
          headerRaw.custom_values && typeof headerRaw.custom_values === "object" ? headerRaw.custom_values : {},
      };
      const footer = {
        observacion:
          footerRaw.observacion ??
          footerRaw.observacion_general ??
          footerRaw.obs ??
          "",
        compromiso: footerRaw.compromiso ?? "",
        lugar: footerRaw.lugar ?? footerRaw.lugar_ie ?? "",
        fecha: footerRaw.fecha ?? "",
        docente_nombre:
          footerRaw.docente_nombre ??
          footerRaw.monitoreado ??
          footerRaw.docente ??
          "",
        docente_dni: footerRaw.docente_dni ?? "",
        monitor_nombre:
          footerRaw.monitor_nombre ??
          footerRaw.monitor ??
          "",
        monitor_dni: footerRaw.monitor_dni ?? "",
      };

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
        const rows = Math.ceil(pairs.length / cols);
        doc.setDrawColor(200);
        for (let r = 0; r < rows; r += 1) {
          const rowPairs = Array.from({ length: cols }, (_, c) => pairs[r * cols + c]).filter(Boolean) as Array<
            [string, string]
          >;
          const valueLineCount = Math.max(
            1,
            ...rowPairs.map((pair) => splitSafe(pair[1] || "-", colW - 4).length)
          );
          const rowH = Math.max(10, 5 + valueLineCount * 4);
          ensureSpace(rowH + 1);
          for (let c = 0; c < cols; c += 1) {
            const idx = r * cols + c;
            const x = M + c * colW;
            const yCell = y;
            doc.rect(x, yCell, colW, rowH);
            const pair = pairs[idx];
            if (!pair) continue;
            doc.setFontSize(8);
            doc.setTextColor(90);
            doc.text(pair[0], x + 2, yCell + 3.5);
            doc.setFontSize(9);
            doc.setTextColor(20);
            const valueLines = splitSafe(pair[1] || "-", colW - 4);
            doc.text(valueLines, x + 2, yCell + 7);
          }
          y += rowH;
        }
        doc.setTextColor(20);
        y += 4;
        doc.setFontSize(10);
      };
      const splitSafe = (text: string, maxW: number) => {
        const raw = String(text ?? "-");
        const out: string[] = [];
        let line = "";
        const pushLine = () => {
          if (line) out.push(line);
          line = "";
        };
        const parts = raw.split(/(\s+)/);
        for (const part of parts) {
          if (!part) continue;
          const trial = `${line}${part}`;
          if (doc.getTextWidth(trial) <= maxW) {
            line = trial;
            continue;
          }
          if (doc.getTextWidth(part) > maxW) {
            pushLine();
            let chunk = "";
            for (const ch of part) {
              const next = chunk + ch;
              if (doc.getTextWidth(next) <= maxW) {
                chunk = next;
              } else {
                if (chunk) out.push(chunk);
                chunk = ch;
              }
            }
            line = chunk;
          } else {
            pushLine();
            line = part;
          }
        }
        pushLine();
        return out.length ? out : ["-"];
      };
      const drawWrappedLines = (lines: string[], x: number, lh: number) => {
        lines.forEach((ln) => {
          ensureSpace(lh + 1);
          doc.text(ln, x, y);
          y += lh;
        });
      };

      const bannerY = y - 8;
      let bannerH = 10;
      try {
        const img = await loadImage(logoUrl);
        const dataUrl = toDataUrl(img);
        if (dataUrl) {
          const ratio = img.width > 0 && img.height > 0 ? img.width / img.height : 1;
          const maxW = contentW;
          const maxH = 10;
          const scaledW = Math.min(maxW, maxH * ratio);
          const scaledH = scaledW / Math.max(ratio, 0.0001);
          const drawX = M + (contentW - scaledW) / 2;
          bannerH = scaledH;
          doc.addImage(dataUrl, "PNG", drawX, bannerY, scaledW, scaledH);
          doc.setDrawColor(192, 203, 220);
          doc.rect(drawX, bannerY, scaledW, scaledH, "S");
        }
      } catch {
        // ignore
      }
      y = bannerY + bannerH + 10;
      doc.setFillColor(242, 246, 252);
      doc.setDrawColor(192, 203, 220);
      doc.rect(M, y - 10, contentW, 22, "FD");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      const titleMaxW = contentW - 6;
      const titleLines = splitSafe(tpl.titulo || "", titleMaxW);
      doc.text(titleLines, M + 3, y);
      y += Math.max(6, titleLines.length * 5);
      if (tpl.subtitulo) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(11);
        const subLines = splitSafe(tpl.subtitulo, titleMaxW);
        doc.text(subLines, M + 3, y);
        y += Math.max(6, subLines.length * 4.5);
      }
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(70);
      doc.text(`Run: ${run.id}  |  Estado: ${run.status}  |  Fecha: ${fmtDateShort(run.created_at)}`, M + 3, y);
      doc.setTextColor(20);
      y += 4;
      doc.setDrawColor(220);
      doc.line(M, y, pageW - M, y);
      y += 10;

      const headerPairs: Array<[string, string]> = [];
      if (effectiveHeader.institucion) headerPairs.push(["Institucion educativa", header.institucion ?? ""]);
      if (effectiveHeader.codigo_modular) headerPairs.push(["Codigo modular", header.codigo_modular ?? ""]);
      if (effectiveHeader.codigo_local) headerPairs.push(["Codigo local", header.codigo_local ?? ""]);
      if (effectiveHeader.distrito) headerPairs.push(["Distrito / Lugar", header.distrito ?? ""]);
      if (effectiveHeader.rei) headerPairs.push(["REI", header.rei ?? ""]);
      if (effectiveHeader.monitor) headerPairs.push(["Monitor", header.monitor ?? ""]);
      if (effectiveHeader.monitor_doc_tipo) headerPairs.push(["Tipo doc. monitor", header.monitor_doc_tipo ?? ""]);
      if (effectiveHeader.monitor_numero_doc) headerPairs.push(["Numero doc. monitor", header.monitor_numero_doc ?? ""]);
      if (effectiveHeader.monitoreado) headerPairs.push(["Monitoreado", header.monitoreado ?? ""]);
      if (effectiveHeader.monitoreado_doc_tipo) headerPairs.push(["Tipo doc. monitoreado", header.monitoreado_doc_tipo ?? ""]);
      if (effectiveHeader.monitoreado_numero_doc) headerPairs.push(["Numero doc. monitoreado", header.monitoreado_numero_doc ?? ""]);
      if (effectiveHeader.monitoreado_cargo) headerPairs.push(["Cargo monitoreado", header.monitoreado_cargo ?? ""]);
      if (effectiveHeader.monitoreado_telefono) headerPairs.push(["Telefono monitoreado", header.monitoreado_telefono ?? ""]);
      if (effectiveHeader.monitoreado_correo) headerPairs.push(["Correo monitoreado", header.monitoreado_correo ?? ""]);
      if (effectiveHeader.condicion)
        headerPairs.push(["Condicion del monitoreado", header.condicion ?? ""]);
      if (effectiveHeader.area) headerPairs.push(["Area", header.area ?? ""]);
      if (effectiveHeader.numero_visitas) headerPairs.push(["Numero de visitas a la IE", header.numero_visitas ?? ""]);
      if (effectiveHeader.fecha_aplicacion) headerPairs.push(["Fecha de aplicacion", header.fecha_aplicacion ?? ""]);
      if (effectiveHeader.hora_inicio) headerPairs.push(["Hora de inicio", header.hora_inicio ?? ""]);
      if (effectiveHeader.hora_fin) headerPairs.push(["Hora de fin", header.hora_fin ?? ""]);
      (effectiveHeader.custom_fields ?? []).forEach((field: HeaderFieldDef) => {
        headerPairs.push([field.label, header.custom_values?.[field.key] ?? ""]);
      });
      if (headerPairs.length) {
        drawSectionHeader("Encabezado");
        drawKeyValueGrid(headerPairs);
      }

      if (effectiveHeader.nivel_avance) {
        const info = Array.isArray(effectiveHeader?.nivel_avance_info) && effectiveHeader.nivel_avance_info.length
          ? effectiveHeader.nivel_avance_info
          : [
              { nivel: 1, descripcion: "Bajo" },
              { nivel: 2, descripcion: "Medio" },
              { nivel: 3, descripcion: "Alto" },
            ];
        const nivelPairs: Array<[string, string]> = info.map((x: any) => [
          `Nivel ${x.nivel}`,
          x.descripcion ?? "",
        ]);
        drawSectionHeader("Niveles de respuesta (Si)");
        drawKeyValueGrid(nivelPairs);
      }

      (secRows ?? []).forEach((s: any) => {
        drawSectionHeader(s.titulo);
        (qRows ?? []).filter((q: any) => q.section_id === s.id).forEach((q: any) => {
          // Use stricter inner bounds for question text to avoid any right-edge clipping in long lines.
          const qInnerLeft = 8;
          const qInnerRight = 10;
          const qX = M + qInnerLeft;
          const qContentW = pageW - qX - (M + qInnerRight);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(10);
          const title = `${q.orden_in_section ?? q.orden}. ${q.texto}`;
          // Measure with the same font/size used for rendering; otherwise long bold lines can overflow.
          const lines = splitSafe(title, qContentW - 1);
          drawWrappedLines(lines, qX, lineH);
          doc.setFont("helvetica", "normal");
          doc.setFontSize(9);

          const p = answersMap[q.id] ?? {};
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
            if (p.option) parts.push(`Opcion: ${p.option}`);
            if (p.options?.length) parts.push(`Opciones: ${p.options.join(", ")}`);
            if (!p.option && !p.options?.length) parts.push("Opciones: -");
          }
          if (q.tipo === "texto") parts.push(`Respuesta: ${p.text ?? "-"}`);
          if (q.tipo === "numero") parts.push(`Respuesta: ${p.number ?? "-"}`);
          if (q.tipo === "archivo_pdf") parts.push(`Archivo: ${p.fileName ?? "-"}`);
          if (q.config_json?.include_obs !== false) parts.push(`Observacion: ${p.obs ?? "-"}`);
          const extraFields = normalizeExtraFields(q.config_json?.extra_fields);
          extraFields.forEach((f) => {
            const val =
              f.mode === "elaboracion"
                ? f.default_value ?? ""
                : p?.extra?.[fieldKey(f.label)] ?? p?.extra?.[f.label] ?? "-";
            parts.push(`${f.label}: ${val || "-"}`);
          });

          if (parts.length) {
            const detail = parts.join(" | ");
            const detailLines = splitSafe(detail, qContentW - 1);
            drawWrappedLines(detailLines, qX, smallLineH);
          }

          y += 4;
          doc.setDrawColor(235);
          doc.line(M, y, pageW - M, y);
          y += 3;
        });
      });

      const footerPairs: Array<[string, string]> = [];
      if (effectiveFooter.observacion) footerPairs.push(["Observacion general", footer.observacion ?? ""]);
      if (effectiveFooter.compromiso) footerPairs.push(["Compromiso", footer.compromiso ?? ""]);
      if (effectiveFooter.lugar) footerPairs.push(["Lugar", footer.lugar ?? ""]);
      if (effectiveFooter.fecha) footerPairs.push(["Fecha", footer.fecha ?? ""]);
      if (effectiveFooter.docente_nombre) footerPairs.push(["Monitoreado", footer.docente_nombre ?? ""]);
      if (effectiveFooter.docente_dni) footerPairs.push(["DNI Monitoreado", footer.docente_dni ?? ""]);
      if (effectiveFooter.monitor_nombre) footerPairs.push(["Monitor", footer.monitor_nombre ?? ""]);
      if (effectiveFooter.monitor_dni) footerPairs.push(["DNI Monitor", footer.monitor_dni ?? ""]);
      if (footerPairs.length) {
        drawSectionHeader("Cierre");
        drawKeyValueGrid(footerPairs);
      }

      if (effectiveFooter.firmas) {
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
        if (footer.docente_nombre) {
          doc.text(String(footer.docente_nombre), M, y + 20);
        }
        if (footer.docente_dni) {
          doc.text(`DNI: ${footer.docente_dni}`, M, y + 24);
        }
        if (footer.monitor_nombre) {
          doc.text(String(footer.monitor_nombre), pageW - M - 70, y + 20);
        }
        if (footer.monitor_dni) {
          doc.text(`DNI: ${footer.monitor_dni}`, pageW - M - 70, y + 24);
        }
      }

      const totalPages = doc.getNumberOfPages();
      for (let pno = 1; pno <= totalPages; pno += 1) {
        doc.setPage(pno);
        doc.setDrawColor(220);
        doc.line(M, pageH - 11, pageW - M, pageH - 11);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(90);
        doc.text("UGEL 06 - Sistema de Monitoreo", M, pageH - 7);
        doc.text(`Pag ${pno}/${totalPages}`, pageW - M - 18, pageH - 7);
        doc.setTextColor(20);
      }

      return { doc, tpl };
    } catch (e: any) {
      setToast({ type: "err", msg: e?.message || "No se pudo exportar PDF." });
      return null;
    }
  };

  const exportRunPdf = async (run?: RunRow) => {
    const built = await buildRunPdf(run);
    if (!built) return;
    built.doc.save(`ficha_${built.tpl.codigo || "ficha"}.pdf`);
  };

  const previewRunPdf = async (run?: RunRow) => {
    const built = await buildRunPdf(run);
    if (!built) return;
    const blob = built.doc.output("blob");
    const nextUrl = URL.createObjectURL(blob);
    setPreviewPdfUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return nextUrl;
    });
    setPreviewPdfTitle(built.tpl.titulo || built.tpl.codigo || "Vista previa");
  };

  const fetchExportRows = async (
    table: string,
    select: string,
    inColumn: string,
    values: string[]
  ) => {
    const result: any[] = [];
    const chunkSize = 100;
    const pageSize = 1000;
    for (let chunkStart = 0; chunkStart < values.length; chunkStart += chunkSize) {
      const chunk = values.slice(chunkStart, chunkStart + chunkSize);
      for (let pageStart = 0; ; pageStart += pageSize) {
        const { data, error } = await (supabase
          .from(table)
          .select(select)
          .in(inColumn, chunk)
          .range(pageStart, pageStart + pageSize - 1) as any);
        if (error) throw new Error(error.message);
        const page = data ?? [];
        result.push(...page);
        if (page.length < pageSize) break;
      }
    }
    return result;
  };

  const buildAnalyticsExport = async () => {
    const runIds = visibleRuns.map((run) => run.id);
    const templateIds = Array.from(
      new Set(visibleRuns.map((run) => run.template_id).filter(Boolean) as string[])
    );
    if (!runIds.length) return { columns: [] as AnalyticsColumn[], rows: [] as AnalyticsRow[] };

    setExportProgress(15);
    const [answers, questions, sections] = await Promise.all([
      fetchExportRows(
        "form_answer",
        "id, run_id, question_id, value_json, created_at, updated_at",
        "run_id",
        runIds
      ),
      templateIds.length
        ? fetchExportRows(
            "form_question",
            "id, template_id, section_id, tipo, texto, orden, orden_in_section, required, config_json",
            "template_id",
            templateIds
          )
        : Promise.resolve([]),
      templateIds.length
        ? fetchExportRows(
            "form_section",
            "id, template_id, titulo, orden",
            "template_id",
            templateIds
          )
        : Promise.resolve([]),
    ]);

    setExportProgress(55);
    const questionsById = new Map(questions.map((question: any) => [question.id, question]));
    const sectionsById = new Map(sections.map((section: any) => [section.id, section]));
    const answersByRun = new Map<string, any[]>();
    answers.forEach((answer: any) => {
      const current = answersByRun.get(answer.run_id) ?? [];
      current.push(answer);
      answersByRun.set(answer.run_id, current);
    });

    const columns: AnalyticsColumn[] = [
      { key: "run_id", header: "run_id", width: 38 },
      { key: "answer_id", header: "answer_id", width: 38 },
      { key: "monitoreo_id", header: "monitoreo_id", width: 38 },
      { key: "monitoreo_codigo", header: "monitoreo_codigo" },
      { key: "monitoreo_nombre", header: "monitoreo_nombre", width: 34 },
      { key: "monitoreo_anio", header: "monitoreo_anio", kind: "number" },
      { key: "ficha_id", header: "ficha_id", width: 38 },
      { key: "ficha_codigo", header: "ficha_codigo" },
      { key: "ficha_titulo", header: "ficha_titulo", width: 38 },
      { key: "template_id", header: "template_id", width: 38 },
      { key: "template_codigo", header: "template_codigo" },
      { key: "template_titulo", header: "template_titulo", width: 38 },
      { key: "run_status", header: "run_status" },
      { key: "is_test", header: "is_test", kind: "number" },
      { key: "run_created_at", header: "run_created_at", kind: "datetime", width: 21 },
      { key: "run_updated_at", header: "run_updated_at", kind: "datetime", width: 21 },
      { key: "creator_id", header: "creator_id", width: 38 },
      { key: "creator_name", header: "creator_name", width: 28 },
      { key: "creator_role", header: "creator_role" },
      { key: "creator_email", header: "creator_email", width: 28 },
      { key: "institucion_educativa", header: "institucion_educativa", width: 34 },
      { key: "codigo_modular", header: "codigo_modular" },
      { key: "codigo_local", header: "codigo_local" },
      { key: "distrito", header: "distrito" },
      { key: "rei", header: "rei" },
      { key: "monitor", header: "monitor", width: 28 },
      { key: "monitor_doc_tipo", header: "monitor_doc_tipo" },
      { key: "monitor_numero_doc", header: "monitor_numero_doc" },
      { key: "monitoreado", header: "monitoreado", width: 28 },
      { key: "monitoreado_doc_tipo", header: "monitoreado_doc_tipo" },
      { key: "monitoreado_numero_doc", header: "monitoreado_numero_doc" },
      { key: "monitoreado_cargo", header: "monitoreado_cargo" },
      { key: "monitoreado_telefono", header: "monitoreado_telefono" },
      { key: "monitoreado_correo", header: "monitoreado_correo", width: 28 },
      { key: "condicion", header: "condicion" },
      { key: "area", header: "area" },
      { key: "numero_visitas", header: "numero_visitas" },
      { key: "fecha_aplicacion", header: "fecha_aplicacion", kind: "date" },
      { key: "hora_inicio", header: "hora_inicio" },
      { key: "hora_fin", header: "hora_fin" },
      { key: "section_id", header: "section_id", width: 38 },
      { key: "seccion_orden", header: "seccion_orden", kind: "number" },
      { key: "seccion_titulo", header: "seccion_titulo", width: 32 },
      { key: "question_id", header: "question_id", width: 38 },
      { key: "orden_item", header: "orden_item", kind: "number" },
      { key: "orden_in_section", header: "orden_in_section", kind: "number" },
      { key: "pregunta_tipo", header: "pregunta_tipo" },
      { key: "pregunta", header: "pregunta", width: 45 },
      { key: "required", header: "required", kind: "boolean" },
      { key: "respuesta_principal", header: "respuesta_principal", width: 26 },
      { key: "respuesta_si_no", header: "respuesta_si_no" },
      { key: "respuesta_nivel", header: "respuesta_nivel" },
      { key: "respuesta_numero", header: "respuesta_numero", kind: "number" },
      { key: "respuesta_texto", header: "respuesta_texto", width: 36 },
      { key: "respuesta_opcion", header: "respuesta_opcion", width: 26 },
      { key: "respuesta_opciones", header: "respuesta_opciones", width: 34 },
      { key: "observacion", header: "observacion", width: 40 },
      { key: "archivo_nombre", header: "archivo_nombre" },
      { key: "answer_created_at", header: "answer_created_at", kind: "datetime", width: 21 },
      { key: "answer_updated_at", header: "answer_updated_at", kind: "datetime", width: 21 },
      { key: "header_json", header: "header_json", width: 45 },
      { key: "footer_json", header: "footer_json", width: 45 },
      { key: "question_config_json", header: "question_config_json", width: 45 },
      { key: "value_json", header: "value_json", width: 45 },
    ];

    const rows: AnalyticsRow[] = [];
    visibleRuns.forEach((run) => {
      const ficha = run.template_id ? fichasByTemplate[run.template_id] : null;
      const mon = ficha ? monById[ficha.monitoreo_id] : null;
      const template = run.template_id ? templates[run.template_id] : null;
      const creator = profiles[run.created_by];
      const header = run.header_json ?? {};
      const runAnswers = answersByRun.get(run.id) ?? [null];

      runAnswers.forEach((answer: any) => {
        const question = answer ? questionsById.get(answer.question_id) : null;
        const section = question?.section_id ? sectionsById.get(question.section_id) : null;
        const value = answer?.value_json ?? {};
        const numericAnswer =
          value?.number === "" || value?.number == null || Number.isNaN(Number(value.number))
            ? null
            : Number(value.number);

        rows.push({
          run_id: run.id,
          answer_id: answer?.id ?? null,
          monitoreo_id: mon?.id ?? ficha?.monitoreo_id ?? null,
          monitoreo_codigo: mon?.codigo ?? selectedMonitoreo,
          monitoreo_nombre: mon?.nombre ?? selectedMonitoreoRow?.nombre ?? "",
          monitoreo_anio: mon?.anio ?? Number(year),
          ficha_id: ficha?.id ?? null,
          ficha_codigo: ficha?.codigo ?? "",
          ficha_titulo: template?.titulo ?? ficha?.titulo ?? "",
          template_id: run.template_id ?? null,
          template_codigo: template?.codigo ?? "",
          template_titulo: template?.titulo ?? "",
          run_status: run.status,
          is_test: run.is_test ? 1 : 0,
          run_created_at: parseDateValue(run.created_at),
          run_updated_at: parseDateValue(run.updated_at),
          creator_id: run.created_by,
          creator_name: getCreatorName(creator),
          creator_role: roleLabel(creator?.role),
          creator_email: creator?.correo ?? creator?.email ?? "",
          institucion_educativa:
            header.institucion ?? header.institucion_educativa ?? header.ie ?? run.institucion_educativa ?? "",
          codigo_modular: header.codigo_modular ?? header.cod_modular ?? "",
          codigo_local: header.codigo_local ?? header.cod_local ?? "",
          distrito: header.distrito ?? header.lugar ?? header.lugar_ie ?? "",
          rei: header.rei ?? "",
          monitor: header.monitor ?? header.monitor_nombre ?? header.director_monitor ?? "",
          monitor_doc_tipo: header.monitor_doc_tipo ?? "",
          monitor_numero_doc: header.monitor_numero_doc ?? "",
          monitoreado:
            header.monitoreado ?? header.docente ?? header.docente_nombre ?? run.docente ?? "",
          monitoreado_doc_tipo: header.monitoreado_doc_tipo ?? "",
          monitoreado_numero_doc: header.monitoreado_numero_doc ?? "",
          monitoreado_cargo: header.monitoreado_cargo ?? "",
          monitoreado_telefono: header.monitoreado_telefono ?? "",
          monitoreado_correo: header.monitoreado_correo ?? "",
          condicion: header.condicion ?? header.condicion_docente ?? "",
          area: header.area ?? header.area_monitoreo ?? "",
          numero_visitas: header.numero_visitas ?? "",
          fecha_aplicacion: parseDateOnlyValue(header.fecha_aplicacion),
          hora_inicio: header.hora_inicio ?? "",
          hora_fin: header.hora_fin ?? "",
          section_id: section?.id ?? question?.section_id ?? null,
          seccion_orden: section?.orden ?? null,
          seccion_titulo: section?.titulo ?? "",
          question_id: question?.id ?? answer?.question_id ?? null,
          orden_item: question?.orden ?? null,
          orden_in_section: question?.orden_in_section ?? null,
          pregunta_tipo: question?.tipo ?? "",
          pregunta: question?.texto ?? "",
          required: question?.required ?? false,
          respuesta_principal: answerPrimary(value),
          respuesta_si_no: value?.yn ?? "",
          respuesta_nivel: value?.nivel ?? "",
          respuesta_numero: numericAnswer,
          respuesta_texto: value?.text ?? "",
          respuesta_opcion: value?.option ?? "",
          respuesta_opciones: Array.isArray(value?.options) ? value.options.join(" | ") : "",
          observacion: value?.obs ?? "",
          archivo_nombre: value?.fileName ?? "",
          answer_created_at: parseDateValue(answer?.created_at),
          answer_updated_at: parseDateValue(answer?.updated_at),
          header_json: jsonText(run.header_json),
          footer_json: jsonText(run.footer_json),
          question_config_json: jsonText(question?.config_json),
          value_json: jsonText(value),
        });
      });
    });

    setExportProgress(80);
    return { columns, rows };
  };

  const exportReport = async (format: "csv" | "xlsx") => {
    if (exporting || !visibleRuns.length) return;
    setExportMenuOpen(false);
    setExporting(format);
    setExportProgress(5);
    try {
      const { columns, rows } = await buildAnalyticsExport();
      const stamp = new Date().toISOString().slice(0, 10);
      const monCode = selectedMonitoreo || "monitoreo";
      const baseName = `reporte_analitico_${monCode}_${stamp}`;
      setExportProgress(90);
      if (format === "csv") {
        exportAnalyticsCsv(`${baseName}.csv`, columns, rows);
      } else {
        await exportAnalyticsExcel(`${baseName}.xlsx`, "Respuestas", columns, rows);
      }
      setExportProgress(100);
      setToast({
        type: "ok",
        msg: `${rows.length} fila(s) exportadas correctamente en ${format.toUpperCase()}.`,
      });
    } catch (e: any) {
      setToast({ type: "err", msg: e?.message || "No se pudo generar el archivo." });
    } finally {
      window.setTimeout(() => {
        setExporting(null);
        setExportProgress(0);
      }, 400);
    }
  };

  const handleEdit = (run: RunRow) => {
    const dynFicha = run.template_id ? fichasByTemplate[run.template_id] : null;
    const mon = dynFicha ? monById[dynFicha.monitoreo_id] : null;
    if (!dynFicha || !mon) {
      setToast({ type: "err", msg: "No se pudo resolver la ficha." });
      return;
    }
    nav(
      `/app/monitoreo/${mon.codigo}/ficha/${dynFicha.codigo}?runId=${run.id}&mid=${encodeURIComponent(
        dynFicha.monitoreo_id
      )}&returnTo=reportes`
    );
  };

  const updateStatus = async (run: RunRow, next: "draft" | "final") => {
    if (!canChangeStatus(run)) return;
    const { error } = await supabase.from("form_run").update({ status: next }).eq("id", run.id);
    if (error) {
      setToast({ type: "err", msg: error.message });
      return;
    }
    setToast({ type: "ok", msg: `Estado actualizado a ${next}.` });
    setRuns((prev) => prev.map((r) => (r.id === run.id ? { ...r, status: next } : r)));
  };

  const deleteRun = async () => {
    if (!confirmDeleteRun || !canEditOrDelete(confirmDeleteRun)) return;
    setDeleteBusy(true);
    const run = confirmDeleteRun;
    const { error: ansErr } = await supabase
      .from("form_answer")
      .delete()
      .eq("run_id", run.id);
    if (ansErr) {
      setToast({ type: "err", msg: ansErr.message });
      setDeleteBusy(false);
      return;
    }
    const { data: deleted, error } = await supabase
      .from("form_run")
      .delete()
      .eq("id", run.id)
      .select("id");
    if (error) {
      setToast({ type: "err", msg: error.message });
      setDeleteBusy(false);
      return;
    }
    if (!deleted || deleted.length === 0) {
      setToast({
        type: "err",
        msg: "No se pudo eliminar (posible RLS o permisos).",
      });
      setDeleteBusy(false);
      return;
    }
    setToast({ type: "ok", msg: "Registro eliminado." });
    setRuns((prev) => prev.filter((r) => r.id !== run.id));
    setDeleteBusy(false);
    setConfirmDeleteOpen(false);
    setConfirmDeleteRun(null);
  };

  return (
    <div className="text-white">
      {toast && (
        <div className="fixed right-4 top-4 z-50">
          <div
            className={cls(
              "rounded-xl border px-4 py-3 text-sm shadow-xl backdrop-blur",
              toast.type === "ok"
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
                : "border-red-500/30 bg-red-500/10 text-red-100"
            )}
          >
            {toast.msg}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight md:text-2xl">Reportes</h1>
          <p className="mt-1 text-sm text-white/60">
            {canSeeAll
              ? "Todos los registros con filtros avanzados."
              : "Tus registros con filtros por fecha y monitoreo."}
          </p>
        </div>
        <div className="relative flex gap-2">
          <button
            type="button"
            onClick={() => setExportMenuOpen((open) => !open)}
            disabled={loading || exporting !== null || visibleRuns.length === 0}
            className={cls(
              "inline-flex min-w-44 items-center justify-center gap-2 rounded-xl border px-4 py-2 text-sm transition",
              loading || exporting !== null || visibleRuns.length === 0
                ? "border-white/10 text-white/30"
                : "border-white/10 bg-white/10 text-white/90 hover:bg-white/15"
            )}
          >
            <IconDownload />
            {exporting ? "Generando archivo..." : "Exportar datos"}
          </button>
          {exportMenuOpen && !exporting && (
            <div className="absolute right-0 top-full z-30 mt-2 w-56 overflow-hidden rounded-xl border border-white/10 bg-[#122031] p-1.5 shadow-2xl">
              <button
                type="button"
                onClick={() => void exportReport("csv")}
                className="flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition hover:bg-white/10"
              >
                <span className="mt-0.5 text-emerald-300"><IconDownload /></span>
                <span>
                  <span className="block text-sm font-medium text-white">Exportar CSV</span>
                  <span className="block text-xs text-white/50">UTF-8 con BOM para Excel y BI</span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => void exportReport("xlsx")}
                className="flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition hover:bg-white/10"
              >
                <span className="mt-0.5 text-sky-300"><IconReport /></span>
                <span>
                  <span className="block text-sm font-medium text-white">Exportar Excel (.xlsx)</span>
                  <span className="block text-xs text-white/50">Tipos, filtros y encabezado congelado</span>
                </span>
              </button>
            </div>
          )}
        </div>
      </div>

      {exporting && (
        <div className="mt-3 rounded-xl border border-sky-400/20 bg-sky-400/5 px-4 py-3">
          <div className="flex items-center justify-between gap-3 text-xs text-sky-100">
            <span>Generando archivo analítico...</span>
            <span>{exportProgress}%</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-sky-400 transition-[width] duration-300"
              style={{ width: `${exportProgress}%` }}
            />
          </div>
        </div>
      )}

      {!selectedMonitoreo && (
        <div className="mt-5">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-black/20 text-white/80">
                <IconReport />
              </div>
              <div>
                <div className="text-sm font-semibold">Selecciona un monitoreo</div>
                <div className="mt-1 text-xs text-white/60">
                  Primero elige el monitoreo y luego verás sus reportes y resultados.
                </div>
              </div>
              </div>
              <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto">
                <div className="relative min-w-0 flex-1 lg:w-72">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/45">
                    <IconSearch />
                  </span>
                  <input
                    value={monitoreoSearch}
                    onChange={(e) => setMonitoreoSearch(e.target.value)}
                    placeholder="Buscar monitoreo..."
                    className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 pl-9 pr-3 text-sm outline-none placeholder:text-white/35 focus:ring-2 focus:ring-white/10"
                  />
                </div>
                <label className="flex items-center gap-2 text-xs text-white/60">
                  Mostrar:
                  <select
                    value={String(monitoreoPageSize)}
                    onChange={(e) => setMonitoreoPageSize(Number(e.target.value))}
                    className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none focus:ring-2 focus:ring-white/10"
                  >
                    <option value="10">10</option>
                    <option value="20">20</option>
                    <option value="50">50</option>
                  </select>
                </label>
              </div>
            </div>
          </div>

          <div className="mt-4 grid auto-rows-[260px] grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {monitoreos.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/60 sm:col-span-2 xl:col-span-3">
                No hay monitoreos disponibles para el año seleccionado.
              </div>
            ) : filteredMonitoreos.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/60 sm:col-span-2 xl:col-span-3">
                No se encontraron monitoreos.
              </div>
            ) : (
              pagedMonitoreos.map((m) => {
                const expired = isMonitoreoExpiredLocal(m.fecha_fin);
                const locked = !m.is_active;
                const disabled = locked;
                return (
                  <div
                    key={m.codigo}
                    className={cls(
                      "agebre-uniform-card flex h-[260px] w-full min-w-0 flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-5 text-left shadow-lg shadow-black/10",
                      disabled ? "is-disabled opacity-80" : "hover:bg-white/10"
                    )}
                  >
                    <div className="mb-4 flex h-10 shrink-0 items-start justify-between gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-black/20 text-white/75">
                        <IconReport />
                      </div>
                      {locked ? (
                        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium leading-none text-amber-100">
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-300" />
                          Bloqueado
                        </span>
                      ) : expired ? (
                        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-red-500/30 bg-red-500/10 px-2.5 py-1 text-[11px] font-medium leading-none text-red-100">
                          <span className="h-1.5 w-1.5 rounded-full bg-red-300" />
                          Vencido
                        </span>
                      ) : (
                        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium leading-none text-emerald-100">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
                          Disponible
                        </span>
                      )}
                    </div>

                    <h2 className="agebre-card-title h-12 shrink-0 text-base font-bold leading-[1.35] tracking-tight text-white">
                      {m.nombre}
                    </h2>

                    <div className="flex flex-1 flex-col pt-4">
                      <div className="flex h-5 shrink-0 items-center gap-2 text-xs text-white/60">
                        <IconCalendar />
                        <span className="truncate">Vence: {formatDateOnly(m.fecha_fin)}</span>
                      </div>
                    </div>

                    <div className="mt-auto grid shrink-0 gap-3">
                      <button
                        type="button"
                        onClick={() => setReportMonitoreoModal(m)}
                        className="inline-flex h-8 w-full items-center justify-center gap-2 rounded-lg border border-white/15 bg-white/10 px-3 text-xs font-medium text-white/80 transition hover:border-white/25 hover:bg-white/15"
                      >
                        <IconEye />
                        Ver más
                      </button>
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => enterReportes(m.codigo)}
                        className={cls(
                          "inline-flex h-9 w-full items-center justify-center gap-2 rounded-xl border px-3 text-xs font-semibold transition",
                          disabled
                            ? "cursor-not-allowed border-white/10 bg-black/20 text-white/45"
                            : "border-white/10 bg-white text-zinc-950 hover:bg-white/90"
                        )}
                      >
                        Ingresar a reportes
                        <IconArrow />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
          {filteredMonitoreos.length > 0 && (
            <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-white/60 sm:flex-row sm:items-center sm:justify-between">
              <div>
                Mostrando {monitoreoStart}-{monitoreoEnd} de {filteredMonitoreos.length} monitoreos
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={monitoreoPageSafe <= 1}
                  onClick={() => setMonitoreoPage((p) => Math.max(1, p - 1))}
                  className={cls(
                    "rounded-xl border px-3 py-2 text-xs transition",
                    monitoreoPageSafe <= 1
                      ? "border-white/10 text-white/30"
                      : "border-white/10 bg-white/10 text-white/85 hover:bg-white/15"
                  )}
                >
                  Anterior
                </button>
                <span className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-white/75">
                  {monitoreoPageSafe} / {monitoreoTotalPages}
                </span>
                <button
                  type="button"
                  disabled={monitoreoPageSafe >= monitoreoTotalPages}
                  onClick={() => setMonitoreoPage((p) => Math.min(monitoreoTotalPages, p + 1))}
                  className={cls(
                    "rounded-xl border px-3 py-2 text-xs transition",
                    monitoreoPageSafe >= monitoreoTotalPages
                      ? "border-white/10 text-white/30"
                      : "border-white/10 bg-white/10 text-white/85 hover:bg-white/15"
                  )}
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {reportMonitoreoModal && (
        <div className="agebre-modal-overlay fixed inset-0 z-[120] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="agebre-modal-content w-full max-w-3xl overflow-hidden rounded-3xl border border-white/10 bg-zinc-950 shadow-2xl shadow-black/40">
            <div className="border-b border-white/10 bg-white/[0.03] p-4 sm:p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-black/25 text-white/80">
                    <IconReport />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-medium uppercase tracking-[0.18em] text-white/45">Reportes</div>
                    <h2 className="agebre-modal-title mt-1 max-h-[78px] text-lg font-bold leading-[1.3] text-white sm:text-xl">
                      {reportMonitoreoModal.nombre}
                    </h2>
                  </div>
                </div>
                <button
                  type="button"
                  title="Cerrar"
                  aria-label="Cerrar"
                  onClick={() => setReportMonitoreoModal(null)}
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/70 transition hover:border-white/20 hover:bg-white/10 hover:text-white"
                >
                  <IconClose />
                </button>
              </div>
            </div>

            <div className="space-y-4 p-4 sm:p-5">
              <div className="flex flex-wrap items-center gap-2">
                {!reportMonitoreoModal.is_active ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-100">
                    <span className="h-2 w-2 rounded-full bg-amber-300" />
                    Bloqueado
                  </span>
                ) : isMonitoreoExpiredLocal(reportMonitoreoModal.fecha_fin) ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-100">
                    <span className="h-2 w-2 rounded-full bg-red-300" />
                    Vencido
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-100">
                    <span className="h-2 w-2 rounded-full bg-emerald-300" />
                    Disponible
                  </span>
                )}
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/65">
                  <IconCalendar />
                  <span>Vence: {formatDateOnly(reportMonitoreoModal.fecha_fin)}</span>
                </div>
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/65">
                  {temporalLabel(reportMonitoreoModal.fecha_fin)}
                </div>
              </div>

              {!reportMonitoreoModal.is_active && (
                <div className="rounded-2xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                  Este monitoreo está bloqueado para reportes.
                </div>
              )}

              <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-white/45">
                  <IconInfo />
                  Detalle
                </div>
                <div className="max-h-[34vh] overflow-y-auto whitespace-pre-wrap pr-1 text-sm leading-6 text-white/75">
                  {reportMonitoreoModal.descripcion || `Monitoreo ${reportMonitoreoModal.codigo} - Año ${reportMonitoreoModal.anio}.`}
                </div>
              </section>

              <div className="flex flex-col gap-2 border-t border-white/10 pt-4 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setReportMonitoreoModal(null)}
                  className="inline-flex h-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 text-sm font-medium text-white/75 transition hover:border-white/20 hover:bg-white/10 hover:text-white"
                >
                  Cerrar
                </button>
                <button
                  type="button"
                  disabled={!reportMonitoreoModal.is_active}
                  onClick={() => {
                    if (!reportMonitoreoModal.is_active) return;
                    enterReportes(reportMonitoreoModal.codigo);
                    setReportMonitoreoModal(null);
                  }}
                  className={cls(
                    "inline-flex h-10 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-semibold transition",
                    reportMonitoreoModal.is_active
                      ? "border-white/10 bg-white text-zinc-950 hover:bg-white/90"
                      : "cursor-not-allowed border-white/10 bg-white/5 text-white/40"
                  )}
                >
                  Ingresar a reportes
                  <IconArrow />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedMonitoreo && (
        <div className="mt-5 flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
          <div className="text-sm">
            Monitoreo actual: <span className="font-semibold">{selectedMonitoreoRow?.nombre || selectedMonitoreo}</span>
          </div>
          <button
            type="button"
            onClick={() => setSelectedMonitoreo("")}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/80 hover:bg-white/10"
          >
            Cambiar monitoreo
          </button>
        </div>
      )}

      {/* Filtros */}
      {selectedMonitoreo && <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-8">
          <label className="block">
            <div className="mb-2 text-xs font-medium text-white/70">Año</div>
            <select
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-white/10"
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
              {!years.length && <option value={year}>{year}</option>}
            </select>
          </label>

          <label className="block">
            <div className="mb-2 text-xs font-medium text-white/70">Ficha</div>
            <select
              value={selectedFicha}
              onChange={(e) => setSelectedFicha(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-white/10"
            >
              <option value="ALL">Seleccionar ficha...</option>
              {monitoreoFichas.map((f) => (
                <option key={f.id} value={f.form_template_id ?? ""}>
                  {f.titulo || f.codigo}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <div className="mb-2 text-xs font-medium text-white/70">Estado</div>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-white/10"
            >
              <option value="ALL">Todos</option>
              <option value="draft">borrador</option>
              <option value="final">final</option>
            </select>
          </label>

          {canSeeAll && (
            <label className="block">
              <div className="mb-2 text-xs font-medium text-white/70">Rol creador</div>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-white/10"
              >
                <option value="ALL">Todos</option>
                <option value="admin">Administrador</option>
                <option value="jefe_area">Jefe de área</option>
                <option value="director">Director(a)</option>
                <option value="responsable_cdd">Responsable CdD</option>
                <option value="user">Usuario</option>
              </select>
            </label>
          )}

          <label className="block">
            <div className="mb-2 text-xs font-medium text-white/70">Buscar monitor</div>
            <input
              value={monitorQuery}
              onChange={(e) => setMonitorQuery(e.target.value)}
              placeholder="Nombre del monitor"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-white/10"
            />
          </label>

          <label className="block">
            <div className="mb-2 text-xs font-medium text-white/70">Buscar colegio</div>
            <input
              value={colegioQuery}
              onChange={(e) => setColegioQuery(e.target.value)}
              placeholder="Nombre de la IE"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-white/10"
            />
          </label>

          <div className="flex items-end">
            <div className="text-xs text-white/50">
              {loading ? "Cargando..." : `${visibleRuns.length} resultado(s)`}
            </div>
          </div>

          <label className="block">
            <div className="mb-2 text-xs font-medium text-white/70">Mostrar</div>
            <select
              value={String(pageSize)}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-white/10"
            >
              <option value="10">10</option>
              <option value="20">20</option>
              <option value="50">50</option>
            </select>
          </label>
        </div>
      </div>}

      {selectedMonitoreo && err && (
        <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-100">
          {err}
        </div>
      )}

      {/* Lista mobile */}
      {selectedMonitoreo && <div className="mt-5 space-y-3 md:hidden">
        {loading ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-6 text-sm text-white/60">
            Cargando...
          </div>
        ) : visibleRuns.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-6 text-sm text-white/60">
            Sin registros.
          </div>
        ) : (
          pagedRuns.map((r) => {
            const ficha = r.template_id ? fichasByTemplate[r.template_id] : null;
            const mon = ficha ? monById[ficha.monitoreo_id] : null;
            const fichaCodigo = r.template_id ? templates[r.template_id]?.codigo || "-" : "-";
            const creator = profiles[r.created_by];
            const statusText = statusLabel(r.status);
            const creatorName = getCreatorName(creator);

            const monitoreado = r.docente?.trim() || "-";
            const institucion = r.institucion_educativa?.trim() || "-";

            return (
              <div key={r.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{mon?.nombre || "Monitoreo"}</div>
                    <div className="text-xs text-white/60">Ficha: {fichaCodigo}</div>
                  </div>
                  <div
                    className={cls(
                      "rounded-lg border px-2 py-1 text-xs",
                      statusText === "final"
                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-100 badge-green"
                        : "border-white/10 bg-white/5 badge-muted"
                    )}
                  >
                    {statusText}
                  </div>
                </div>
                <div className="mt-1 truncate text-xs text-white/50">{fmtDateShort(r.created_at)}</div>
                <div className="mt-2 text-xs text-white/60">
                  {canSeeAll && <div>Por: {creatorName}</div>}
                  <RunSummary monitoreado={monitoreado} institucion={institucion} />
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <ActionIconButton title="Vista previa" onClick={() => previewRunPdf(r)}>
                    <IconEye />
                  </ActionIconButton>
                  {canEditOrDelete(r) && (
                    <ActionIconButton title="Editar" onClick={() => handleEdit(r)} disabled={!canEditOrDelete(r)}>
                      <IconEdit />
                    </ActionIconButton>
                  )}
                  <ActionIconButton title="Exportar PDF" onClick={() => exportRunPdf(r)}>
                    <IconPdf />
                  </ActionIconButton>
                  {canChangeStatus(r) && (
                    <ActionIconButton
                      title={r.status === "final" ? "Pasar a borrador" : "Finalizar"}
                      onClick={() => updateStatus(r, r.status === "final" ? "draft" : "final")}
                      disabled={!canChangeStatus(r)}
                    >
                      {r.status === "final" ? <IconDraft /> : <IconFinalize />}
                    </ActionIconButton>
                  )}
                  {canEditOrDelete(r) && (
                    <ActionIconButton
                      title="Eliminar"
                      onClick={() => {
                        setConfirmDeleteRun(r);
                        setConfirmDeleteOpen(true);
                      }}
                      disabled={!canEditOrDelete(r)}
                      danger
                    >
                      <IconTrash />
                    </ActionIconButton>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>}

      {selectedMonitoreo && !loading && visibleRuns.length > 0 && (
        <div className="mt-3 flex flex-col gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70 md:hidden">
          <div>
            Mostrando {pageStart}-{pageEnd} de {visibleRuns.length}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className={cls(
                "rounded-lg border px-2 py-1",
                currentPage <= 1 ? "border-white/10 text-white/30" : "border-white/10 bg-white/10 text-white/90 hover:bg-white/15"
              )}
            >
              Anterior
            </button>
            <span>
              Pagina {currentPage} de {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className={cls(
                "rounded-lg border px-2 py-1",
                currentPage >= totalPages
                  ? "border-white/10 text-white/30"
                  : "border-white/10 bg-white/10 text-white/90 hover:bg-white/15"
              )}
            >
              Siguiente
            </button>
          </div>
        </div>
      )}

      {/* Tabla desktop */}
      {selectedMonitoreo && <div className="mt-5 hidden overflow-hidden rounded-2xl border border-white/10 bg-white/5 md:block">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <div className="text-sm text-white/70">
            Total: <span className="text-white">{visibleRuns.length}</span>
          </div>
          {!loading && visibleRuns.length > 0 && (
            <div className="flex items-center gap-2 text-xs text-white/70">
              <span>
                Mostrando {pageStart}-{pageEnd}
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className={cls(
                  "rounded-lg border px-2 py-1",
                  currentPage <= 1 ? "border-white/10 text-white/30" : "border-white/10 bg-white/10 text-white/90 hover:bg-white/15"
                )}
              >
                Anterior
              </button>
              <span>
                Pagina {currentPage} de {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className={cls(
                  "rounded-lg border px-2 py-1",
                  currentPage >= totalPages
                    ? "border-white/10 text-white/30"
                    : "border-white/10 bg-white/10 text-white/90 hover:bg-white/15"
                )}
              >
                Siguiente
              </button>
            </div>
          )}
        </div>
        <div className="w-full overflow-x-auto">
          <table className="min-w-[820px] w-full">
            <thead className="bg-black/20">
              <tr className="text-left text-xs text-white/60">
                <th className="px-4 py-3">Monitoreo / Ficha</th>
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3 w-80">{canSeeAll ? "Creador / Resumen" : "Resumen"}</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="px-4 py-6 text-sm text-white/60" colSpan={5}>
                    Cargando...
                  </td>
                </tr>
              ) : visibleRuns.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-sm text-white/60" colSpan={5}>
                    Sin registros.
                  </td>
                </tr>
              ) : (
                pagedRuns.map((r) => {
                  const ficha = r.template_id ? fichasByTemplate[r.template_id] : null;
                  const mon = ficha ? monById[ficha.monitoreo_id] : null;
                  const fichaCodigo = r.template_id ? templates[r.template_id]?.codigo || "-" : "-";
                  const creator = profiles[r.created_by];
                  const statusText = statusLabel(r.status);
                  const creatorName = getCreatorName(creator);
                  const monitoreado = r.docente?.trim() || "-";
                  const institucion = r.institucion_educativa?.trim() || "-";

                  return (
                    <tr key={r.id} className="border-t border-white/10 text-sm">
                      <td className="px-4 py-3">
                        <div className="font-medium text-white/90">{mon?.nombre || "-"}</div>
                        <div className="text-xs text-white/60">Ficha: {fichaCodigo}</div>
                      </td>
                      <td className="px-4 py-3 text-white/70">{fmtDateShort(r.created_at)}</td>
                      <td className="px-4 py-3 align-top">
                        {canSeeAll && <div className="mb-1 text-xs text-white/70">Por: {creatorName}</div>}
                        <RunSummary monitoreado={monitoreado} institucion={institucion} />
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cls(
                            "rounded-lg border px-2 py-1 text-xs",
                            statusText === "final"
                              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-100 badge-green"
                              : "border-white/10 bg-white/5 badge-muted"
                          )}
                        >
                          {statusText}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <ActionIconButton title="Vista previa" onClick={() => previewRunPdf(r)}>
                            <IconEye />
                          </ActionIconButton>
                          {canEditOrDelete(r) && (
                            <ActionIconButton title="Editar" onClick={() => handleEdit(r)} disabled={!canEditOrDelete(r)}>
                              <IconEdit />
                            </ActionIconButton>
                          )}
                          <ActionIconButton title="Exportar PDF" onClick={() => exportRunPdf(r)}>
                            <IconPdf />
                          </ActionIconButton>
                          {canChangeStatus(r) && (
                            <ActionIconButton
                              title={r.status === "final" ? "Pasar a borrador" : "Finalizar"}
                              onClick={() =>
                                updateStatus(
                                  r,
                                  r.status === "final" ? "draft" : "final"
                                )
                              }
                              disabled={!canChangeStatus(r)}
                            >
                              {r.status === "final" ? <IconDraft /> : <IconFinalize />}
                            </ActionIconButton>
                          )}
                          {canEditOrDelete(r) && (
                            <ActionIconButton
                              title="Eliminar"
                              onClick={() => {
                                setConfirmDeleteRun(r);
                                setConfirmDeleteOpen(true);
                              }}
                              disabled={!canEditOrDelete(r)}
                              danger
                            >
                              <IconTrash />
                            </ActionIconButton>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>}

      <ConfirmDialog
        open={confirmDeleteOpen}
        title="Eliminar registro"
        description="¿Seguro que deseas eliminar este registro? Esta acción no se puede deshacer."
        confirmText="Eliminar"
        cancelText="Cancelar"
        variant="danger"
        busy={deleteBusy}
        onClose={() => !deleteBusy && setConfirmDeleteOpen(false)}
        onConfirm={deleteRun}
      />
      {previewPdfUrl && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-4">
          <div className="flex h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-slate-950 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-white">Vista previa</div>
                <div className="truncate text-xs text-white/60">{previewPdfTitle}</div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/80"
                  onClick={() => window.open(previewPdfUrl, "_blank", "noopener,noreferrer")}
                >
                  Abrir aparte
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/80"
                  onClick={() => {
                    URL.revokeObjectURL(previewPdfUrl);
                    setPreviewPdfUrl(null);
                    setPreviewPdfTitle("");
                  }}
                >
                  Cerrar
                </button>
              </div>
            </div>
            <iframe title="Vista previa PDF" src={previewPdfUrl} className="min-h-0 flex-1 bg-white" />
          </div>
        </div>
      )}
    </div>
  );
}





