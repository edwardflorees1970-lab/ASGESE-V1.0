import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../app/AuthProvider";
import { useAppConfig } from "../app/AppConfigProvider";
import { canSeeAllRole } from "../lib/roles";
import { supabase } from "../lib/supabaseClient";

type MonitoreoCdD = {
  id: string;
  codigo: string;
  nombre: string;
  fecha_inicio: string;
  fecha_fin: string;
};

type FichaLite = {
  id: string;
  monitoreo_id: string;
  codigo: string;
  titulo: string;
  form_template_id: string | null;
};

type RunLite = {
  id: string;
  template_id: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  status: string;
  header_json: Record<string, any> | null;
};

type AnswerLite = {
  run_id: string;
  question_id: string;
  value_json: Record<string, any> | null;
};

type CdDRecord = {
  runId: string;
  monitoreoId: string;
  monitoreoCodigo: string;
  monitoreoNombre: string;
  responsableNombre: string;
  fichaCodigo: string;
  fichaTitulo: string;
  compromiso: string;
  institucion: string;
  monitorArea: string;
  meta: number | null;
  avance: number | null;
  avancePct: number | null;
  updatedAt: string;
  createdAt: string;
};

type Toast = { type: "err" | "ok" | "info"; msg: string };

const MONTHS = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];

function cls(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function normalizeText(input: string) {
  return String(input || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function extractAnswerText(value: Record<string, any> | null | undefined) {
  if (!value || typeof value !== "object") return "";
  const raw = [
    value.text,
    value.number,
    value.option,
    Array.isArray(value.options) ? value.options.join(", ") : null,
    value.yn,
    value.nivel,
  ].find((item) => item !== null && item !== undefined && String(item).trim() !== "");
  return raw == null ? "" : String(raw).trim();
}

function parseMetric(value: Record<string, any> | null | undefined) {
  const raw = extractAnswerText(value);
  if (!raw) return null;
  const match = raw.match(/-?\d+(?:[.,]\d+)?/);
  if (!match) return null;
  const n = Number(match[0].replace(/,/g, "."));
  return Number.isFinite(n) ? n : null;
}

function shortDate(iso: string) {
  try {
    const parsed = parseDateOnly(iso);
    return new Intl.DateTimeFormat("es-PE", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
      timeZone: "America/Lima",
    }).format(parsed);
  } catch {
    return iso;
  }
}

function calcAvancePct(meta: number | null | undefined, avance: number | null | undefined) {
  if (avance == null || !Number.isFinite(Number(avance))) return null;
  const m = Number(meta ?? 0);
  // Sin meta definida no hay porcentaje que calcular -- devolver el conteo
  // crudo (p.ej. "8 instituciones visitadas") como si fuera "8%" contamina
  // cualquier promedio/ranking que mezcle este registro con otros que si
  // tienen meta real, y puede disparar alertas falsas de "va en X%".
  if (!Number.isFinite(m) || m <= 0) return null;
  const a = Number(avance);
  return (a / m) * 100;
}

function pct(value: number | null | undefined) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

function avg(values: number[]) {
  if (!values.length) return 0;
  return values.reduce((acc, x) => acc + x, 0) / values.length;
}

function progressTone(value: number) {
  if (value >= 85) return "good";
  if (value >= 60) return "warn";
  return "bad";
}

function monthIndex(date: string) {
  const d = parseDateOnly(date);
  return Number.isNaN(d.getTime()) ? 0 : d.getMonth();
}

function dayProgress(start: string, end: string) {
  const now = new Date();
  const s = parseDateOnly(start);
  const e = parseDateOnly(end);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return 0;
  const total = e.getTime() - s.getTime();
  if (total <= 0) return now >= e ? 100 : 0;
  const done = now.getTime() - s.getTime();
  return Math.max(0, Math.min(100, (done / total) * 100));
}

function daysToEnd(end: string) {
  const e = parseDateOnly(end);
  const now = new Date();
  if (Number.isNaN(e.getTime())) return null;
  return Math.ceil((e.getTime() - now.getTime()) / 86400000);
}

function parseDateOnly(value: string) {
  const m = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) {
    const y = Number(m[1]);
    const mo = Number(m[2]) - 1;
    const d = Number(m[3]);
    return new Date(y, mo, d);
  }
  return new Date(value);
}

export function IndicadoresCdDPage() {
  const { user, profile } = useAuth();
  const { isTestMode } = useAppConfig();
  const isGlobalViewer = canSeeAllRole(profile?.role);
  const canAccess = isGlobalViewer || profile?.role === "responsable_cdd";
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<Toast | null>(null);
  const [selectedMonitoreo, setSelectedMonitoreo] = useState("ALL");
  const [selectedPeriod, setSelectedPeriod] = useState("ALL");
  const [selectedArea, setSelectedArea] = useState("ALL");
  const [monitoreos, setMonitoreos] = useState<MonitoreoCdD[]>([]);
  const [records, setRecords] = useState<CdDRecord[]>([]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 3000);
    return () => window.clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!user?.id) return;
      if (!canAccess) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const { data: monRows, error: monErr } = await supabase
          .from("monitoreo_catalog")
          .select("id, codigo, nombre, fecha_inicio, fecha_fin, solicitud_id, is_active")
          .eq("is_active", true);
        if (monErr) throw new Error(monErr.message);
        if (!(monRows ?? []).length) {
          if (!alive) return;
          setMonitoreos([]);
          setRecords([]);
          setToast({ type: "info", msg: "No hay monitoreos activos." });
          return;
        }

        const { data: fichaRows, error: fichaErr } = await supabase
          .from("ficha_catalog")
          .select("id, monitoreo_id, codigo, titulo, form_template_id, is_active")
          .in("monitoreo_id", (monRows ?? []).map((m: any) => m.id))
          .eq("is_active", true);
        if (fichaErr) throw new Error(fichaErr.message);

        const fichas = (fichaRows ?? []).filter((f: any) => !!f.form_template_id) as FichaLite[];
        const templateIds = Array.from(new Set(fichas.map((f) => f.form_template_id).filter(Boolean))) as string[];
        if (!templateIds.length) {
          if (!alive) return;
          setMonitoreos([]);
          setRecords([]);
          setToast({ type: "info", msg: "No hay fichas dinamicas activas para monitoreos CdD." });
          return;
        }

        const { data: questionRows, error: questionErr } = await supabase
          .from("form_question")
          .select("id, template_id, texto")
          .in("template_id", templateIds);
        if (questionErr) throw new Error(questionErr.message);

        const metaQuestionIds = new Set(
          (questionRows ?? [])
            .filter((q: any) => {
              const t = normalizeText(q.texto);
              return t.includes("meta");
            })
            .map((q: any) => q.id)
        );
        const avanceQuestionIds = new Set(
          (questionRows ?? [])
            .filter((q: any) => {
              const t = normalizeText(q.texto);
              return t.includes("avance");
            })
            .map((q: any) => q.id)
        );

        const templateWithMeta = new Set((questionRows ?? []).filter((q: any) => metaQuestionIds.has(q.id)).map((q: any) => q.template_id));
        const templateWithAvance = new Set((questionRows ?? []).filter((q: any) => avanceQuestionIds.has(q.id)).map((q: any) => q.template_id));
        const templateIdsCdD = new Set(Array.from(templateWithMeta).filter((tid) => templateWithAvance.has(tid)));
        if (!metaQuestionIds.size || !avanceQuestionIds.size || !templateIdsCdD.size) {
          if (!alive) return;
          setMonitoreos([]);
          setRecords([]);
          setToast({ type: "info", msg: "No se encontraron preguntas estándar de meta y avance CdD." });
          return;
        }

        const monitoreoIdsByTemplate = new Set(
          fichas.filter((f) => f.form_template_id && templateIdsCdD.has(f.form_template_id)).map((f) => f.monitoreo_id)
        );
        const solicitudIds = Array.from(new Set((monRows ?? []).map((r: any) => r.solicitud_id).filter(Boolean)));
        let cddSolicitudSet = new Set<string>();
        if (solicitudIds.length) {
          const { data: solRows, error: solErr } = await supabase
            .from("monitoreo_solicitud")
            .select("id, cdd")
            .in("id", solicitudIds);
          if (!solErr) {
            cddSolicitudSet = new Set((solRows ?? []).filter((r: any) => !!r.cdd).map((r: any) => r.id));
          }
        }
        const cddMonitoreos = (monRows ?? [])
          .filter((m: any) => {
            const bySolicitud = !!m.solicitud_id && cddSolicitudSet.has(m.solicitud_id);
            const byTemplate = monitoreoIdsByTemplate.has(m.id);
            return bySolicitud || byTemplate;
          })
          .map((m: any) => ({
            id: m.id,
            codigo: m.codigo,
            nombre: m.nombre,
            fecha_inicio: m.fecha_inicio,
            fecha_fin: m.fecha_fin,
          })) as MonitoreoCdD[];
        if (!cddMonitoreos.length) {
          if (!alive) return;
          setMonitoreos([]);
          setRecords([]);
          setToast({ type: "info", msg: "No hay monitoreos CdD disponibles." });
          return;
        }

        const cddMonitoreoIdSet = new Set(cddMonitoreos.map((m) => m.id));
        const cddTemplateIdList = Array.from(
          new Set(
            fichas
              .filter((f) => f.form_template_id && templateIdsCdD.has(f.form_template_id) && cddMonitoreoIdSet.has(f.monitoreo_id))
              .map((f) => f.form_template_id as string)
          )
        );
        if (!cddTemplateIdList.length) {
          if (!alive) return;
          setMonitoreos(cddMonitoreos.sort((a, b) => a.nombre.localeCompare(b.nombre)));
          setRecords([]);
          return;
        }
        const runQuery = supabase
          .from("form_run")
          .select("id, template_id, created_by, created_at, updated_at, status, is_test, header_json")
          .in("template_id", cddTemplateIdList)
          .neq("status", "borrador")
          .eq("is_test", isTestMode);
        const { data: runRows, error: runErr } = await runQuery;
        if (runErr) throw new Error(runErr.message);

        const runs = (runRows ?? []) as RunLite[];
        const runIds = runs.map((r) => r.id);
        if (!runIds.length) {
          if (!alive) return;
          setMonitoreos(cddMonitoreos.sort((a, b) => a.nombre.localeCompare(b.nombre)));
          setRecords([]);
          return;
        }

        const relevantQuestionIds = Array.from(new Set([...metaQuestionIds, ...avanceQuestionIds]));
        const { data: answerRows, error: answerErr } = await supabase
          .from("form_answer")
          .select("run_id, question_id, value_json")
          .in("run_id", runIds)
          .in("question_id", relevantQuestionIds);
        if (answerErr) throw new Error(answerErr.message);

        const fichaByTemplate = new Map<string, FichaLite>();
        fichas.forEach((f) => {
          if (f.form_template_id) fichaByTemplate.set(f.form_template_id, f);
        });
        const monitoreoById = new Map<string, MonitoreoCdD>(cddMonitoreos.map((m) => [m.id, m]));
        const creatorIds = Array.from(new Set(runs.map((r) => r.created_by).filter(Boolean)));
        const { data: creatorRows, error: creatorErr } = creatorIds.length
          ? await supabase.from("profiles").select("id, area, apellido_paterno, apellido_materno, nombres").in("id", creatorIds)
          : { data: [], error: null };
        if (creatorErr) throw new Error(creatorErr.message);
        const creatorById = new Map<
          string,
          {
            area: string;
            nombre: string;
          }
        >(
          (creatorRows ?? []).map((r: any) => {
            const nombre = [r?.apellido_paterno, r?.apellido_materno, r?.nombres].filter(Boolean).join(" ").trim() || "Sin nombre";
            return [
              r.id,
              {
                area: String(r.area || "").trim() || "-",
                nombre,
              },
            ];
          })
        );
        const answersByRun = new Map<string, AnswerLite[]>();
        (answerRows ?? []).forEach((ans: any) => {
          const list = answersByRun.get(ans.run_id) ?? [];
          list.push(ans);
          answersByRun.set(ans.run_id, list);
        });

        const nextRecords: CdDRecord[] = runs
          .map((run) => {
            const ficha = fichaByTemplate.get(run.template_id);
            if (!ficha) return null;
            const monitoreo = monitoreoById.get(ficha.monitoreo_id);
            if (!monitoreo) return null;
            const answers = answersByRun.get(run.id) ?? [];
            const metaAnswer = answers.find((a) => metaQuestionIds.has(a.question_id));
            const avanceAnswer = answers.find((a) => avanceQuestionIds.has(a.question_id));
            const metaValue = parseMetric(metaAnswer?.value_json);
            const avanceValue = parseMetric(avanceAnswer?.value_json);
            const header = run.header_json ?? {};
            const compromiso = String(
              header.monitoreado || header.institucion || header.institucion_educativa || ficha.titulo || `CdD ${run.id.slice(0, 6)}`
            ).trim();
            return {
              runId: run.id,
              monitoreoId: monitoreo.id,
              monitoreoCodigo: monitoreo.codigo,
              monitoreoNombre: monitoreo.nombre,
              responsableNombre: creatorById.get(run.created_by)?.nombre || "Sin nombre",
              fichaCodigo: ficha.codigo,
              fichaTitulo: ficha.titulo,
              compromiso,
              institucion: String(header.institucion || header.institucion_educativa || "-").trim() || "-",
              monitorArea: creatorById.get(run.created_by)?.area || "-",
              meta: metaValue,
              avance: avanceValue,
              avancePct: calcAvancePct(metaValue, avanceValue),
              updatedAt: run.updated_at,
              createdAt: run.created_at,
            } as CdDRecord;
          })
          .filter(Boolean) as CdDRecord[];

        if (!alive) return;
        setMonitoreos(cddMonitoreos.sort((a, b) => a.nombre.localeCompare(b.nombre)));
        setRecords(nextRecords);
      } catch (e: any) {
        if (!alive) return;
        setToast({ type: "err", msg: e?.message || "No se pudo cargar indicadores CdD." });
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [canAccess, isGlobalViewer, isTestMode, user?.id]);

  const areaOptions = useMemo(
    () => Array.from(new Set(records.map((r) => (r.monitorArea || "").trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [records]
  );

  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      if (selectedMonitoreo !== "ALL" && r.monitoreoId !== selectedMonitoreo) return false;
      if (selectedArea !== "ALL" && (r.monitorArea || "-") !== selectedArea) return false;
      if (selectedPeriod === "ALL") return true;
      const month = parseDateOnly(r.createdAt).getMonth() + 1;
      if (selectedPeriod.startsWith("M")) return month === Number(selectedPeriod.slice(1));
      if (selectedPeriod.startsWith("Q")) return Math.ceil(month / 3) === Number(selectedPeriod.slice(1));
      return true;
    });
  }, [records, selectedArea, selectedMonitoreo, selectedPeriod]);

  const recordsWithAvance = useMemo(() => filteredRecords.filter((r) => r.avancePct !== null), [filteredRecords]);
  const bestRecord = useMemo(() => [...recordsWithAvance].sort((a, b) => (b.avancePct ?? 0) - (a.avancePct ?? 0))[0] ?? null, [recordsWithAvance]);
  const worstRecord = useMemo(() => [...recordsWithAvance].sort((a, b) => (a.avancePct ?? 0) - (b.avancePct ?? 0))[0] ?? null, [recordsWithAvance]);
  const avgAvance = useMemo(() => avg(recordsWithAvance.map((r) => Number(r.avancePct ?? 0))), [recordsWithAvance]);
  const avgMeta = useMemo(() => avg(filteredRecords.filter((r) => r.meta !== null).map((r) => Number(r.meta ?? 0))), [filteredRecords]);

  const groupedByCompromiso = useMemo(() => filteredRecords.slice().sort((a, b) => (b.avancePct ?? 0) - (a.avancePct ?? 0)).slice(0, 8), [filteredRecords]);

  const updatesList = useMemo(() => {
    const map = new Map<string, { name: string; avance: number; fecha: string; area: string; total: number; count: number }>();
    filteredRecords.forEach((r) => {
      const key = r.responsableNombre;
      const current = map.get(key);
      if (!current) {
        map.set(key, {
          name: r.responsableNombre,
          avance: Number(r.avancePct ?? 0),
          fecha: r.updatedAt,
          area: r.monitorArea || "-",
          total: Number(r.avancePct ?? 0),
          count: 1,
        });
      } else {
        const newer = new Date(r.updatedAt).getTime() > new Date(current.fecha).getTime();
        current.total += Number(r.avancePct ?? 0);
        current.count += 1;
        current.avance = current.total / current.count;
        if (newer) {
          current.fecha = r.updatedAt;
          current.area = r.monitorArea || current.area;
        }
      }
    });
    return Array.from(map.values())
      .map(({ total, count, ...rest }) => ({ ...rest, avance: count ? total / count : 0 }))
      .sort((a, b) => b.avance - a.avance)
      .slice(0, 6);
  }, [filteredRecords]);

  const cronograma = useMemo(() => {
    return monitoreos
      .filter((m) => selectedMonitoreo === "ALL" || m.id === selectedMonitoreo)
      .map((m) => {
        const valores = records
          .filter((r) => r.monitoreoId === m.id && r.avancePct !== null)
          .map((r) => Number(r.avancePct ?? 0));
        return {
          ...m,
          startMonth: monthIndex(m.fecha_inicio),
          endMonth: monthIndex(m.fecha_fin),
          dateProgress: dayProgress(m.fecha_inicio, m.fecha_fin),
          // null cuando ningun compromiso de este monitoreo tiene meta
          // definida -- no confundir "sin datos de meta" con "0% de avance".
          avancePromedio: valores.length ? avg(valores) : null,
        };
      });
  }, [monitoreos, records, selectedMonitoreo]);

  const alerts = useMemo(() => {
    const items: Array<{ tone: "bad" | "warn" | "good" | "info"; title: string; detail: string }> = [];
    const expired = cronograma.filter(
      (m) => (daysToEnd(m.fecha_fin) ?? 1) < 0 && m.avancePromedio !== null && m.avancePromedio < 100
    );
    expired.forEach((m) => {
      items.push({
        tone: "bad",
        title: `${m.codigo} vencido`,
        detail: `${m.nombre} cerro el ${shortDate(m.fecha_fin)} | va en ${(m.avancePromedio ?? 0).toFixed(1)}%.`,
      });
    });
    filteredRecords
      .filter((r) => r.meta !== null && r.avance !== null && (r.avancePct ?? 0) < 100)
      .slice(0, 2)
      .forEach((r) => {
        items.push({
          tone: "warn",
          title: `${r.compromiso} bajo meta`,
          detail: `${r.monitoreoNombre}: avance ${r.avance} de meta ${r.meta} (${pct(r.avancePct).toFixed(1)}%).`,
        });
      });
    filteredRecords
      .filter((r) => r.meta !== null && r.avance !== null && (r.avancePct ?? 0) >= 100)
      .slice(0, 1)
      .forEach((r) => {
        items.push({
          tone: "good",
          title: `${r.compromiso} cumplido`,
          detail: `${r.monitoreoNombre}: meta ${r.meta} alcanzada con ${r.avance} (${pct(r.avancePct).toFixed(1)}%).`,
        });
      });
    cronograma
      .filter((m) => {
        const d = daysToEnd(m.fecha_fin);
        return d !== null && d >= 0 && d <= 7;
      })
      .slice(0, 1)
      .forEach((m) => {
        items.push({
          tone: "info",
          title: `${m.codigo} por cerrar`,
          detail: `${m.nombre} finaliza el ${shortDate(m.fecha_fin)}.`,
        });
      });
    return items.slice(0, 4);
  }, [cronograma, filteredRecords]);

  if (!canAccess) {
    return (
      <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-sm text-red-100">
        No tienes acceso al modulo Indicadores CdD.
      </div>
    );
  }

  return (
    <div className="space-y-6 text-white">
      {toast && (
        <div
          className={cls(
            "fixed left-1/2 top-6 z-50 w-[min(calc(100vw-2rem),28rem)] -translate-x-1/2 rounded-2xl border px-4 py-3 text-sm shadow-2xl backdrop-blur",
            toast.type === "err"
              ? "border-red-500/40 bg-red-500/20 text-red-100"
              : toast.type === "ok"
              ? "border-emerald-500/40 bg-emerald-500/20 text-emerald-100"
              : "border-white/15 bg-zinc-900/80 text-white/90"
          )}
        >
          {toast.msg}
        </div>
      )}

      <section className="rounded-[28px] border border-[var(--app-border)] bg-[var(--app-surface)] p-5 shadow-[var(--dashboard-shadow)] md:p-7">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-[0.25em] text-slate-500">Compromiso de Desempeño</div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <h1 className="font-headline text-3xl font-extrabold tracking-tight text-slate-100">Indicadores CdD</h1>
              <span className="rounded-full border border-cyan-400/40 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.16em] text-cyan-200">
                Solo CdD
              </span>
            </div>
            <p className="mt-2 max-w-3xl text-sm text-slate-400">
              Panel estadístico de monitoreos CdD asignados a {profile?.nombres || "tu cuenta"}. Usa la meta y el avance registrados en las fichas estándar para construir indicadores y cronograma.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <label className="block">
              <div className="mb-2 px-1 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">CdD</div>
              <select
                value={selectedMonitoreo}
                onChange={(e) => setSelectedMonitoreo(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-[var(--dashboard-control)] px-3 py-2.5 text-sm text-white outline-none focus:border-sky-400/40"
              >
                <option value="ALL">Todos</option>
                {monitoreos.map((m) => (
                  <option key={m.id} value={m.id}>{m.nombre} | CdD</option>
                ))}
              </select>
            </label>
            <label className="block">
              <div className="mb-2 px-1 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Mes o trimestre</div>
              <select
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-[var(--dashboard-control)] px-3 py-2.5 text-sm text-white outline-none focus:border-sky-400/40"
              >
                <option value="ALL">Todos</option>
                <option value="Q1">Trimestre 1</option>
                <option value="Q2">Trimestre 2</option>
                <option value="Q3">Trimestre 3</option>
                <option value="Q4">Trimestre 4</option>
                <option value="M1">Enero</option>
                <option value="M2">Febrero</option>
                <option value="M3">Marzo</option>
                <option value="M4">Abril</option>
                <option value="M5">Mayo</option>
                <option value="M6">Junio</option>
                <option value="M7">Julio</option>
                <option value="M8">Agosto</option>
                <option value="M9">Septiembre</option>
                <option value="M10">Octubre</option>
                <option value="M11">Noviembre</option>
                <option value="M12">Diciembre</option>
              </select>
            </label>
            <label className="block">
              <div className="mb-2 px-1 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Area</div>
              <select
                value={selectedArea}
                onChange={(e) => setSelectedArea(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-[var(--dashboard-control)] px-3 py-2.5 text-sm text-white outline-none focus:border-sky-400/40"
              >
                <option value="ALL">Todas</option>
                {areaOptions.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </label>
          </div>
        </div>
      </section>

      {loading ? (
        <div className="rounded-[28px] border border-white/10 bg-[var(--app-surface)] p-8 text-sm text-slate-400">Cargando indicadores CdD...</div>
      ) : (
        <>
          {filteredRecords.length === 0 && (
            <div className="rounded-[24px] border border-amber-400/30 bg-amber-500/10 p-4 text-sm text-amber-100">
              Aún no hay registros para los filtros elegidos. Se muestra la plantilla del tablero sin datos.
            </div>
          )}
          <section className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              tone="good"
              label="Mejor avance"
              value={`${pct(bestRecord?.avancePct).toFixed(1)}%`}
              subtitle={bestRecord ? bestRecord.monitoreoNombre : "-"}
              detail={bestRecord ? `${bestRecord.monitorArea} | Meta: ${bestRecord.meta ?? "-"}` : "Sin datos"}
            />
            <KpiCard
              tone="bad"
              label="Peor avance"
              value={`${pct(worstRecord?.avancePct).toFixed(1)}%`}
              subtitle={worstRecord ? worstRecord.monitoreoNombre : "-"}
              detail={worstRecord ? `${worstRecord.monitorArea} | Meta: ${worstRecord.meta ?? "-"}` : "Sin datos"}
            />
            <KpiCard
              tone="info"
              label="Promedio avance"
              value={`${pct(avgAvance).toFixed(1)}%`}
              subtitle={`${recordsWithAvance.length} compromiso(s) con avance`}
              detail={`Meta promedio ${pct(avgMeta).toFixed(1)}%`}
            />
            <KpiCard
              tone="neutral"
              label="Compromisos CdD"
              value={String(filteredRecords.length)}
              subtitle={`${monitoreos.length} monitoreo(s) CdD asignados`}
              detail={`Modo ${isTestMode ? "TEST" : "PROD"}`}
            />
          </section>

          <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
            <div className="xl:col-span-2 rounded-[24px] border border-white/10 bg-[var(--app-surface)] p-5 md:p-6">
              <div className="mb-6 flex items-center justify-between gap-4">
                <div>
                  <h2 className="font-headline text-lg font-bold text-slate-100">Meta vs avance por compromiso</h2>
                  <p className="mt-1 text-xs text-slate-500">Se consideran las respuestas numéricas de Meta del CdD y Avance del CdD.</p>
                </div>
                <div className="flex gap-4 text-[11px] text-slate-500">
                  <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-sky-900" />Meta</span>
                  <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-sky-300" />Avance</span>
                </div>
              </div>
              <div className="overflow-x-auto pb-2">
                <div className="flex min-w-[620px] items-end gap-5 px-3 pt-6">
                  {groupedByCompromiso.length ? (
                    groupedByCompromiso.map((row) => (
                      <div key={row.runId} className="flex w-16 flex-col items-center gap-3">
                        <div className="relative flex h-64 items-end gap-2">
                          <div
                            className="w-5 rounded-t-md bg-sky-950/90"
                            style={{ height: `${row.meta != null && row.meta > 0 ? 100 : 0}%` }}
                            title={`Meta (valor): ${row.meta ?? "-"} | Referencia: 100%`}
                          />
                          <div
                            className="w-5 rounded-t-md bg-sky-300"
                            style={{ height: `${pct(row.avancePct)}%` }}
                            title={`Avance (valor): ${row.avance ?? "-"} | Avance: ${pct(row.avancePct).toFixed(1)}%`}
                          />
                        </div>
                        <div className="w-20 text-center text-[9px] text-slate-500 md:text-[10px]">
                          <div>Avance: {pct(row.avancePct).toFixed(1)}%</div>
                        </div>
                        <div className="w-20 text-center">
                          <div className="truncate text-[11px] font-bold text-slate-300">{row.monitoreoNombre}</div>
                          <div className="truncate text-[10px] text-slate-500">{row.monitorArea || "-"}</div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="w-full py-16 text-center text-xs text-slate-500">
                      Sin datos para graficar meta vs avance.
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="rounded-[24px] border border-white/10 bg-[var(--app-surface)] p-5 md:p-6">
              <h2 className="font-headline text-lg font-bold text-slate-100">Avance por Responsable CdD</h2>
              <p className="mt-1 text-xs text-slate-500">Promedio de avance por responsable y fecha corta de actualización.</p>
              <div className="mt-6 space-y-5">
                {updatesList.length ? (
                  updatesList.map((item) => {
                    const tone = progressTone(item.avance);
                    return (
                      <div key={`${item.name}-${item.fecha}`} className="space-y-2">
                        <div className="flex items-center justify-between gap-3 text-xs">
                          <div className="min-w-0">
                          <div className="truncate font-semibold text-slate-200">{item.name}</div>
                            <div className="truncate text-[10px] uppercase tracking-[0.14em] text-slate-500">{item.area || "-"}</div>
                            <div className="truncate text-[10px] uppercase tracking-[0.14em] text-slate-500">Fecha actualización: {shortDate(item.fecha)}</div>
                          </div>
                          <div className={cls("font-bold", tone === "good" ? "text-emerald-300" : tone === "warn" ? "text-amber-300" : "text-rose-300")}>{pct(item.avance).toFixed(1)}%</div>
                        </div>
                        <div className="h-2.5 rounded-full bg-[var(--app-surface-3)]">
                          <div className={cls("h-full rounded-full", tone === "good" ? "bg-emerald-400" : tone === "warn" ? "bg-amber-400" : "bg-rose-400")} style={{ width: `${pct(item.avance)}%` }} />
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="py-12 text-center text-xs text-slate-500">Sin actualizaciones todavía.</div>
                )}
              </div>
            </div>
          </section>

          <section className="rounded-[24px] border border-white/10 bg-[var(--app-surface)] p-5 md:p-6">
            <div className="mb-6 flex items-center justify-between gap-4">
              <div>
                <h2 className="font-headline text-lg font-bold text-slate-100">Cronograma de ejecución</h2>
                <p className="mt-1 text-xs text-slate-500">Rango del monitoreo CdD y progreso temporal contra fecha de cierre.</p>
              </div>
              <div className="text-xs text-slate-500">Hoy: {shortDate(new Date().toISOString())}</div>
            </div>
            <div className="overflow-x-auto pb-2">
              <div className="min-w-[700px]">
                <div className="mb-4 grid grid-cols-[220px_minmax(0,1fr)] items-center gap-4 border-b border-white/10 pb-2">
                  <div />
                  <div className="grid grid-cols-12 gap-2">
                    {MONTHS.map((month) => (
                      <div key={month} className="text-center text-[10px] font-bold tracking-[0.16em] text-slate-500">{month}</div>
                    ))}
                  </div>
                </div>
                <div className="space-y-4">
                  {cronograma.length ? (
                    cronograma.map((row) => {
                      const left = `${(row.startMonth / 12) * 100}%`;
                      const width = `${Math.max(8, ((row.endMonth - row.startMonth + 1) / 12) * 100)}%`;
                      const fill = `${Math.max(4, (Math.min(row.dateProgress, 100) / 100) * Math.max(((row.endMonth - row.startMonth + 1) / 12) * 100, 8))}%`;
                      const dte = daysToEnd(row.fecha_fin);
                      return (
                        <div key={row.id} className="grid grid-cols-[220px_minmax(0,1fr)] items-center gap-4">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-slate-200">{row.nombre}</div>
                          <div className="mt-1 text-[11px] uppercase tracking-[0.14em] text-slate-500">
                            {row.codigo} | cierre {shortDate(row.fecha_fin)}
                            {dte !== null ? ` | ${dte} dia(s)` : ""}
                          </div>
                        </div>
                          <div>
                            <div
                              className="relative h-5 rounded-full bg-[var(--app-surface-3)]"
                              title={`Rango: ${shortDate(row.fecha_inicio)} - ${shortDate(row.fecha_fin)} | Progreso temporal: ${pct(row.dateProgress).toFixed(1)}%`}
                            >
                              <div className="absolute inset-y-0 rounded-full bg-sky-950/60" style={{ left, width }} />
                              <div className="absolute inset-y-0 rounded-full bg-sky-300/90" style={{ left, width: fill }} />
                            </div>
                            <div className="mt-1 text-[10px] text-slate-500">
                              Rango: {shortDate(row.fecha_inicio)} - {shortDate(row.fecha_fin)} | Progreso: {pct(row.dateProgress).toFixed(1)}%
                            </div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="py-10 text-center text-xs text-slate-500">Sin monitoreos CdD disponibles para el cronograma.</div>
                  )}
                </div>
              </div>
            </div>
          </section>

          <section>
            <div className="mb-4 flex items-center gap-2">
              <span className="rounded-full bg-rose-500/15 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-rose-200">Alertas</span>
              <h2 className="font-headline text-lg font-bold text-slate-100">Alertas e hitos críticos</h2>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              {alerts.length ? (
                alerts.map((item, idx) => (
                  <div
                    key={`${item.title}-${idx}`}
                    className={cls(
                      "rounded-[20px] border-l-4 bg-[var(--app-surface)] p-4 transition hover:bg-[var(--app-surface-2)]",
                      item.tone === "bad"
                        ? "border-rose-400"
                        : item.tone === "warn"
                        ? "border-amber-400"
                        : item.tone === "good"
                        ? "border-emerald-400"
                        : "border-slate-400"
                    )}
                  >
                    <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">{item.tone === "bad" ? "Critico" : item.tone === "warn" ? "Alerta" : item.tone === "good" ? "Logrado" : "Proximo"}</div>
                    <div className="mt-3 text-sm font-semibold text-slate-100">{item.title}</div>
                    <div className="mt-2 text-xs leading-5 text-slate-400">{item.detail}</div>
                  </div>
                ))
              ) : (
                <div className="rounded-[20px] border border-white/10 bg-[var(--app-surface)] p-4 text-xs text-slate-500">
                  Sin alertas críticas por ahora.
                </div>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function KpiCard({
  tone,
  label,
  value,
  subtitle,
  detail,
}: {
  tone: "good" | "bad" | "info" | "neutral";
  label: string;
  value: string;
  subtitle: string;
  detail: string;
}) {
  const toneClass =
    tone === "good"
      ? "text-emerald-300 bg-emerald-500/10 border-emerald-500/20"
      : tone === "bad"
      ? "text-rose-300 bg-rose-500/10 border-rose-500/20"
      : tone === "info"
      ? "text-sky-300 bg-sky-500/10 border-sky-500/20"
      : "text-slate-200 bg-white/5 border-white/10";

  return (
    <div className="relative overflow-hidden rounded-[24px] border border-white/10 bg-[var(--app-surface)] p-5 md:p-6">
      <div className={cls("inline-flex rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em]", toneClass)}>{label}</div>
      <div className="mt-5 text-4xl font-black tracking-tight text-slate-100">{value}</div>
      <div className="mt-2 text-sm font-medium text-slate-300">{subtitle}</div>
      <div className="mt-4 text-xs uppercase tracking-[0.16em] text-slate-500">{detail}</div>
    </div>
  );
}

