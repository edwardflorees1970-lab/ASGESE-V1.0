import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import jsPDF from "jspdf";
import logoUrl from "../assets/logoagebresf.png";
import { useAuth } from "../app/AuthProvider";
import { supabase } from "../lib/supabaseClient";
import { canSeeAllRole, isAdminRole, roleLabel } from "../lib/roles";
import { useAppConfig } from "../app/AppConfigProvider";
import { ConfirmDialog } from "../components/ConfirmDialog";

type RunRow = {
  id: string;
  status: string;
  created_by: string;
  created_at: string;
  template_id?: string;
  institucion_educativa: string | null;
  docente: string | null;
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

function monthOptions() {
  return [
    { value: "ALL", label: "Todo el año" },
    { value: "1", label: "Enero" },
    { value: "2", label: "Febrero" },
    { value: "3", label: "Marzo" },
    { value: "4", label: "Abril" },
    { value: "5", label: "Mayo" },
    { value: "6", label: "Junio" },
    { value: "7", label: "Julio" },
    { value: "8", label: "Agosto" },
    { value: "9", label: "Septiembre" },
    { value: "10", label: "Octubre" },
    { value: "11", label: "Noviembre" },
    { value: "12", label: "Diciembre" },
  ];
}

function statusLabel(s: string) {
  if (s === "borrador") return "borrador";
  if (s === "draft") return "draft";
  return s;
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

function downloadCsv(filename: string, rows: string[][]) {
  const esc = (v: string) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = rows.map((r) => r.map(esc).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

export function ReportesPage() {
  const nav = useNavigate();
  const { user, profile } = useAuth();
  const { isTestMode } = useAppConfig();
  const role = profile?.role;
  const isAdmin = isAdminRole(role);
  const canSeeAll = canSeeAllRole(role);

  const now = new Date();
  const [year, setYear] = useState(String(now.getFullYear()));
  const [month, setMonth] = useState("ALL");
  const [monitoreo, setMonitoreo] = useState("ALL");
  const [status, setStatus] = useState("ALL");
  const [roleFilter, setRoleFilter] = useState("ALL");

  const [years, setYears] = useState<string[]>([]);
  const [monitoreos, setMonitoreos] = useState<MonitoreoRow[]>([]);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: "ok" | "err"; msg: string } | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [confirmDeleteRun, setConfirmDeleteRun] = useState<RunRow | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

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
      const { data } = await supabase
        .from("monitoreo_catalog")
        .select("id, codigo, nombre, anio, is_active")
        .eq("anio", Number(year))
        .eq("is_active", true)
        .order("nombre", { ascending: true });
      if (!alive) return;
      setMonitoreos((data ?? []) as MonitoreoRow[]);
      if (monitoreo !== "ALL" && !(data ?? []).some((m: any) => m.codigo === monitoreo)) {
        setMonitoreo("ALL");
      }
    })();
    return () => {
      alive = false;
    };
  }, [year]);

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

        const y = Number(year);
        const m = month === "ALL" ? null : Number(month);
        const start = m ? new Date(y, m - 1, 1) : new Date(y, 0, 1);
        const end = m ? new Date(y, m, 1) : new Date(y + 1, 0, 1);

        let templateIdsByMon: string[] | null = null;
        if (monitoreo !== "ALL") {
          const mon = monitoreos.find((x) => x.codigo === monitoreo);
          if (mon?.id) {
            const { data: fichasData, error: fichasErr } = await supabase
              .from("ficha_catalog")
              .select("id, codigo, monitoreo_id, form_template_id")
              .eq("monitoreo_id", mon.id);
            if (fichasErr) throw new Error(fichasErr.message);
            templateIdsByMon = (fichasData ?? [])
              .map((f: any) => f.form_template_id)
              .filter(Boolean);
          } else {
            templateIdsByMon = [];
          }
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
          .select("id, status, created_by, created_at, template_id, header_json, footer_json")
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
          template_id: r.template_id,
          institucion_educativa: r.header_json?.institucion ?? null,
          docente: r.header_json?.monitoreado ?? null,
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
  }, [year, month, monitoreo, status, roleFilter, monitoreos, user?.id, canSeeAll, isTestMode]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const canEditOrDelete = (run: RunRow) => {
    if (isAdmin) return true;
    return run.created_by === user?.id;
  };

  const canChangeStatus = (run: RunRow) => {
    if (isAdmin) return true;
    return run.created_by === user?.id;
  };

  const exportRunPdf = async (run?: RunRow) => {
    if (!run?.template_id) {
      setToast({ type: "err", msg: "No se pudo resolver la ficha." });
      return;
    }
    try {
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

      const headerCfg = tpl.header_config ?? {};
      const footerCfg = tpl.footer_config ?? {};
      const defaultHeader = {
        institucion: true,
        codigo_modular: true,
        codigo_local: true,
        distrito: true,
        rei: true,
        monitor: true,
        monitoreado: true,
        condicion: true,
        area: true,
        nivel_avance: false,
        nivel_avance_info: [],
      };
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
      const effectiveHeader = { ...defaultHeader, ...(headerCfg || {}) };
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
        monitoreado:
          headerRaw.monitoreado ??
          headerRaw.docente ??
          headerRaw.docente_nombre ??
          "",
        condicion: headerRaw.condicion ?? headerRaw.condicion_docente ?? "",
        area: headerRaw.area ?? headerRaw.area_monitoreo ?? "",
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
      doc.text(tpl.titulo, M + 26, y);
      y += 6;
      if (tpl.subtitulo) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(11);
        doc.text(tpl.subtitulo, M + 26, y);
        y += 6;
      }
      doc.setDrawColor(220);
      doc.line(M, y, pageW - M, y);
      y += 10;

      const headerPairs: Array<[string, string]> = [];
      if (effectiveHeader.institucion) headerPairs.push(["Institución educativa", header.institucion ?? ""]);
      if (effectiveHeader.codigo_modular) headerPairs.push(["Código modular", header.codigo_modular ?? ""]);
      if (effectiveHeader.codigo_local) headerPairs.push(["Código local", header.codigo_local ?? ""]);
      if (effectiveHeader.distrito) headerPairs.push(["Distrito / Lugar", header.distrito ?? ""]);
      if (effectiveHeader.rei) headerPairs.push(["REI", header.rei ?? ""]);
      if (effectiveHeader.monitor) headerPairs.push(["Monitor", header.monitor ?? ""]);
      if (effectiveHeader.monitoreado) headerPairs.push(["Monitoreado", header.monitoreado ?? ""]);
      if (effectiveHeader.condicion) headerPairs.push(["Condición", header.condicion ?? ""]);
      if (effectiveHeader.area) headerPairs.push(["Área", header.area ?? ""]);
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
        drawSectionHeader("Niveles de respuesta (Sí)");
        drawKeyValueGrid(nivelPairs);
      }

      (secRows ?? []).forEach((s: any) => {
        drawSectionHeader(s.titulo);
        (qRows ?? []).filter((q: any) => q.section_id === s.id).forEach((q: any) => {
          const title = `${q.orden_in_section ?? q.orden}. ${q.texto}`;
          const lines = doc.splitTextToSize(title, contentW);
          ensureSpace(lines.length * lineH + 6);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(10);
          doc.text(lines, M, y);
          y += lines.length * lineH;
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
            if (p.option) parts.push(`Opción: ${p.option}`);
            if (p.options?.length) parts.push(`Opciones: ${p.options.join(", ")}`);
            if (!p.option && !p.options?.length) parts.push("Opciones: -");
          }
          if (q.tipo === "texto") parts.push(`Respuesta: ${p.text ?? "-"}`);
          if (q.tipo === "numero") parts.push(`Respuesta: ${p.number ?? "-"}`);
          if (q.tipo === "archivo_pdf") parts.push(`Archivo: ${p.fileName ?? "-"}`);
          parts.push(`Observación: ${p.obs ?? "-"}`);

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
      if (effectiveFooter.observacion) footerPairs.push(["Observación general", footer.observacion ?? ""]);
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

      doc.save(`ficha_${tpl.codigo || "ficha"}.pdf`);
    } catch (e: any) {
      setToast({ type: "err", msg: e?.message || "No se pudo exportar PDF." });
    }
  };

  const exportExcel = () => {
    const rows: string[][] = [
      [
        "Monitoreo",
        "Ficha",
        "Fecha",
        "Estado",
        "Creador",
        "Rol creador",
        "Monitoreado",
        "Institucion",
      ],
    ];

    runs.forEach((r) => {
      const dynFicha = r.template_id ? fichasByTemplate[r.template_id] : null;
      const mon = dynFicha ? monById[dynFicha.monitoreo_id] : null;
      const fichaCodigo = r.template_id ? templates[r.template_id]?.codigo || "" : "";
      const creator = profiles[r.created_by];
      const creatorName =
        [creator?.apellido_paterno, creator?.apellido_materno, creator?.nombres]
          .filter(Boolean)
          .join(" ")
          .trim() ||
        creator?.correo ||
        creator?.email ||
        "Usuario";
      rows.push([
        mon?.nombre || "",
        fichaCodigo,
        fmtDateShort(r.created_at),
        statusLabel(r.status),
        creatorName,
        roleLabel(creator?.role),
        r.docente || "",
        r.institucion_educativa || "",
      ]);
    });

    const stamp = new Date().toISOString().slice(0, 10);
    downloadCsv(`reporte_monitoreo_${stamp}.csv`, rows);
  };

  const handleEdit = (run: RunRow) => {
    const dynFicha = run.template_id ? fichasByTemplate[run.template_id] : null;
    const mon = dynFicha ? monById[dynFicha.monitoreo_id] : null;
    if (!dynFicha || !mon) {
      setToast({ type: "err", msg: "No se pudo resolver la ficha." });
      return;
    }
    nav(`/app/monitoreo/${mon.codigo}/ficha/${dynFicha.codigo}?runId=${run.id}&returnTo=reportes`);
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
        <div className="flex gap-2">
          <button
            type="button"
            onClick={exportExcel}
            disabled={loading || runs.length === 0}
            className={cls(
              "rounded-xl border px-4 py-2 text-sm",
              loading || runs.length === 0
                ? "border-white/10 text-white/30"
                : "border-white/10 bg-white/10 text-white/90 hover:bg-white/15"
            )}
          >
            Exportar Excel (CSV)
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
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
            <div className="mb-2 text-xs font-medium text-white/70">Mes</div>
            <select
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-white/10"
            >
              {monthOptions().map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <div className="mb-2 text-xs font-medium text-white/70">Monitoreo</div>
            <select
              value={monitoreo}
              onChange={(e) => setMonitoreo(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-white/10"
            >
              <option value="ALL">Todos</option>
              {monitoreos.map((m) => (
                <option key={m.codigo} value={m.codigo}>
                  {m.nombre}
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
              <option value="draft">draft</option>
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
                <option value="user">Usuario</option>
              </select>
            </label>
          )}

          <div className="flex items-end">
            <div className="text-xs text-white/50">{loading ? "Cargando..." : "Listo"}</div>
          </div>
        </div>
      </div>

      {err && (
        <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-100">
          {err}
        </div>
      )}

      {/* Lista mobile */}
      <div className="mt-5 space-y-3 md:hidden">
        {loading ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-6 text-sm text-white/60">
            Cargando...
          </div>
        ) : runs.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-6 text-sm text-white/60">
            Sin registros.
          </div>
        ) : (
          runs.map((r) => {
            const ficha = r.template_id ? fichasByTemplate[r.template_id] : null;
            const mon = ficha ? monById[ficha.monitoreo_id] : null;
            const fichaCodigo = r.template_id ? templates[r.template_id]?.codigo || "-" : "-";
            const creator = profiles[r.created_by];
            const statusText = statusLabel(r.status);
            const creatorName =
              [creator?.apellido_paterno, creator?.apellido_materno, creator?.nombres]
                .filter(Boolean)
                .join(" ")
                .trim() ||
              creator?.correo ||
              creator?.email ||
              "Usuario";

            const monitoreado = r.docente?.trim() || "-";
            const institucion = r.institucion_educativa?.trim() || "-";

            return (
              <div key={r.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 text-sm font-semibold">
                    {mon?.nombre || "Monitoreo"} / {fichaCodigo}
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
                {canSeeAll && (
                  <div className="mt-1 text-xs text-white/60">
                    <div>Por: {creatorName}</div>
                    <div className="text-white/50">Monitoreado: {monitoreado}</div>
                    <div className="text-white/50">Institucion: {institucion}</div>
                  </div>
                )}

                <div className="mt-3 flex flex-wrap gap-2">
                  {canEditOrDelete(r) && (
                    <button
                      className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs"
                      onClick={() => handleEdit(r)}
                      disabled={!canEditOrDelete(r)}
                    >
                      Editar
                    </button>
                  )}
                  <button
                    className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs"
                    onClick={() => exportRunPdf(r)}
                  >
                    PDF
                  </button>
                  {canChangeStatus(r) && (
                    <button
                      className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs"
                      onClick={() =>
                        updateStatus(r, r.status === "final" ? "draft" : "final")
                      }
                      disabled={!canChangeStatus(r)}
                    >
                      {r.status === "final" ? "Reabrir" : "Finalizar"}
                    </button>
                  )}
                  {canEditOrDelete(r) && (
                    <button
                      className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-100"
                      onClick={() => {
                        setConfirmDeleteRun(r);
                        setConfirmDeleteOpen(true);
                      }}
                      disabled={!canEditOrDelete(r)}
                    >
                      Eliminar
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Tabla desktop */}
      <div className="mt-5 hidden overflow-hidden rounded-2xl border border-white/10 bg-white/5 md:block">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <div className="text-sm text-white/70">
            Total: <span className="text-white">{runs.length}</span>
          </div>
        </div>
        <div className="w-full overflow-x-auto">
          <table className="min-w-[980px] w-full">
            <thead className="bg-black/20">
              <tr className="text-left text-xs text-white/60">
                <th className="px-4 py-3">Monitoreo</th>
                <th className="px-4 py-3">Ficha</th>
                <th className="px-4 py-3">Fecha</th>
                {canSeeAll && <th className="px-4 py-3 w-64">Creador</th>}
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="px-4 py-6 text-sm text-white/60" colSpan={canSeeAll ? 6 : 5}>
                    Cargando...
                  </td>
                </tr>
              ) : runs.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-sm text-white/60" colSpan={canSeeAll ? 6 : 5}>
                    Sin registros.
                  </td>
                </tr>
              ) : (
                runs.map((r) => {
                  const ficha = r.template_id ? fichasByTemplate[r.template_id] : null;
                  const mon = ficha ? monById[ficha.monitoreo_id] : null;
                  const fichaCodigo = r.template_id ? templates[r.template_id]?.codigo || "-" : "-";
                  const creator = profiles[r.created_by];
                  const statusText = statusLabel(r.status);
                  const creatorName =
                    [creator?.apellido_paterno, creator?.apellido_materno, creator?.nombres]
                      .filter(Boolean)
                      .join(" ")
                      .trim() ||
                    creator?.correo ||
                    creator?.email ||
                    "Usuario";
                  const monitoreado = r.docente?.trim() || "-";
                  const institucion = r.institucion_educativa?.trim() || "-";

                  return (
                    <tr key={r.id} className="border-t border-white/10 text-sm">
                      <td className="px-4 py-3">{mon?.nombre || "-"}</td>
                      <td className="px-4 py-3">{fichaCodigo}</td>
                      <td className="px-4 py-3 text-white/70">{fmtDateShort(r.created_at)}</td>
                      {canSeeAll && (
                        <td className="px-4 py-3 text-white/70 w-64">
                          <div className="font-medium text-white/80">{creatorName}</div>
                          <div className="text-xs text-white/50 leading-4">
                            Monitoreado: {monitoreado}
                          </div>
                          <div className="text-xs text-white/50 leading-4">
                            Institucion: {institucion}
                          </div>
                        </td>
                      )}
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
                          {canEditOrDelete(r) && (
                            <button
                              className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs"
                              onClick={() => handleEdit(r)}
                              disabled={!canEditOrDelete(r)}
                            >
                              Editar
                            </button>
                          )}
                          <button
                            className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs"
                            onClick={() => exportRunPdf(r)}
                          >
                            PDF
                          </button>
                          {canChangeStatus(r) && (
                            <button
                              className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs"
                              onClick={() =>
                                updateStatus(
                                  r,
                                  r.status === "final" ? "draft" : "final"
                                )
                              }
                              disabled={!canChangeStatus(r)}
                            >
                              {r.status === "final" ? "Reabrir" : "Finalizar"}
                            </button>
                          )}
                          {canEditOrDelete(r) && (
                            <button
                              className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-100"
                              onClick={() => {
                                setConfirmDeleteRun(r);
                                setConfirmDeleteOpen(true);
                              }}
                              disabled={!canEditOrDelete(r)}
                            >
                              Eliminar
                            </button>
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
      </div>

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
    </div>
  );
}
