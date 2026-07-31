import { useEffect, useRef, useState } from "react";
import { DashboardIcon } from "../components/dashboard/DashboardWidgets";
import { ReportFilterPanel } from "../components/reports/ReportFilterPanel";
import { ExecutiveReportView } from "../components/reports/ExecutiveReportView";
import { MonitorDetailReportView } from "../components/reports/MonitorDetailReportView";
import { QuestionResultsReportView } from "../components/reports/QuestionResultsReportView";
import {
  EMPTY_REPORT_FILTERS,
  loadExecutiveReport,
  loadFullMonitorDetailReport,
  loadMonitorDetailReport,
  loadQuestionResultsReport,
  loadReportFilterOptions,
  reportFilterSummary,
  type AnalyticsReportFilters,
  type AnalyticsReportType,
  type ExecutiveReport,
  type MonitorDetailReport,
  type QuestionResultsReport,
  type ReportFilterOptions,
} from "../lib/analyticsReportsApi";
import { analyticsReportExportTable } from "../lib/analyticsReportExport";
import { exportAnalyticsCsv, exportAnalyticsExcel } from "../lib/analyticsExport";
import { captureTelemetry } from "../lib/telemetry";
import { useAuth } from "../app/AuthProvider";
import { IconButton } from "../components/ui/IconButton";

const EMPTY_OPTIONS: ReportFilterOptions = {
  years: [], monitorings: [], templates: [], monitors: [], institutions: [], reis: [], levels: [], districts: [], questions: [], responses: [],
};
const PAGE_SIZE = 100;
const REPORT_TYPES: Array<{ type: AnalyticsReportType; title: string; description: string; icon: "people" | "target" | "trend" }> = [
  { type: "monitor", title: "Detalle por monitor y fichas", description: "Matrices por nivel, REI, fecha e instituciones monitoreadas.", icon: "people" },
  { type: "results", title: "Resultados por preguntas", description: "Porcentajes por alternativa, institución, REI, distrito y nivel.", icon: "target" },
  { type: "executive", title: "Indicadores generales", description: "KPIs y gráficos ejecutivos para toma de decisiones.", icon: "trend" },
];

type GeneratedReport =
  | { type: "monitor"; data: MonitorDetailReport }
  | { type: "results"; data: QuestionResultsReport }
  | { type: "executive"; data: ExecutiveReport };

function ExportFileIcon({ format }: { format: "XLSX" | "CSV" | "PDF" }) {
  return <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 2.8h8l4 4V21H6z" /><path d="M14 3v5h5" /><path d="M8.2 16.5h7.6" /><text x="12" y="14" textAnchor="middle" fill="currentColor" stroke="none" fontSize={format === "XLSX" ? "4.6" : "5.2"} fontWeight="800">{format}</text></svg>;
}

function reportFilename(type: AnalyticsReportType) {
  const date = new Date().toISOString().slice(0, 10);
  return `agebre_${type}_${date}`;
}

export function AnalyticsReportsPage() {
  const { profile, user } = useAuth();
  const [reportType, setReportType] = useState<AnalyticsReportType>("executive");
  const [filters, setFilters] = useState<AnalyticsReportFilters>({ ...EMPTY_REPORT_FILTERS });
  const [appliedFilters, setAppliedFilters] = useState<AnalyticsReportFilters>({ ...EMPTY_REPORT_FILTERS });
  const [options, setOptions] = useState<ReportFilterOptions>(EMPTY_OPTIONS);
  const [generated, setGenerated] = useState<GeneratedReport | null>(null);
  const [page, setPage] = useState(0);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const requestRef = useRef<AbortController | null>(null);
  const optionYear = filters.year;
  const optionMonth = filters.month;
  const optionMonitoreoId = filters.monitoreo_id;
  const optionTemplateId = filters.template_id;
  const optionQuestionId = filters.question_id;

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoadingOptions(true);
      const optionFilters = {
        ...EMPTY_REPORT_FILTERS,
        year: optionYear,
        month: optionMonth,
        monitoreo_id: optionMonitoreoId,
        template_id: optionTemplateId,
        question_id: optionQuestionId,
      };
      void loadReportFilterOptions(optionFilters, controller.signal)
        .then((next) => setOptions(next ?? EMPTY_OPTIONS))
        .catch((loadError: unknown) => {
          if (!controller.signal.aborted) setError(loadError instanceof Error ? loadError.message : "No se pudieron cargar los filtros.");
        })
        .finally(() => { if (!controller.signal.aborted) setLoadingOptions(false); });
    }, 250);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [optionYear, optionMonth, optionMonitoreoId, optionTemplateId, optionQuestionId]);

  useEffect(() => () => requestRef.current?.abort(), []);

  const patchFilters = (patch: Partial<AnalyticsReportFilters>) => {
    setFilters((current) => ({ ...current, ...patch }));
  };

  const runReport = async (nextPage = 0, pageOnly = false) => {
    if (filters.date_from && filters.date_to && filters.date_from > filters.date_to) {
      setError("La fecha inicial no puede ser posterior a la fecha final.");
      return;
    }
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setLoading(true);
    setError(null);
    try {
      if (reportType === "monitor") {
        const data = await loadMonitorDetailReport(pageOnly ? appliedFilters : filters, nextPage, PAGE_SIZE, controller.signal);
        setGenerated({ type: "monitor", data });
        setPage(nextPage);
      } else if (reportType === "results") {
        const data = await loadQuestionResultsReport(filters, controller.signal);
        setGenerated({ type: "results", data });
        setPage(0);
      } else {
        const data = await loadExecutiveReport(filters, controller.signal);
        setGenerated({ type: "executive", data });
        setPage(0);
      }
      if (!pageOnly) setAppliedFilters({ ...filters });
      setLastUpdated(new Date());
    } catch (reportError) {
      if (controller.signal.aborted) return;
      const message = reportError instanceof Error ? reportError.message : "No se pudo generar el reporte.";
      setError(message);
      void captureTelemetry("analytics_report_failed", message, "error", { reportType });
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  };

  const changeReportType = (next: AnalyticsReportType) => {
    requestRef.current?.abort();
    setReportType(next);
    setGenerated(null);
    setFilters((current) => ({ ...current, question_id: "", response: "" }));
    setError(null);
    setPage(0);
  };

  const exportReport = async (format: "csv" | "xlsx" | "pdf") => {
    if (!generated) return;
    setExporting(true);
    try {
      const exportData = generated.type === "monitor"
        ? await loadFullMonitorDetailReport(appliedFilters)
        : generated.data;
      const base = reportFilename(generated.type);
      if (format === "pdf") {
        const { exportAnalyticsPdf } = await import("../lib/analyticsReportPdf");
        const exportedBy = [profile?.nombres, profile?.apellido_paterno, profile?.apellido_materno].filter(Boolean).join(" ") || profile?.correo || profile?.email || user?.email || "Usuario autenticado";
        await exportAnalyticsPdf({ filename: `${base}.pdf`, reportType: generated.type, report: exportData, filters: reportFilterSummary(appliedFilters, options), exportedBy, generatedAt: new Date() });
      } else {
        const table = analyticsReportExportTable(generated.type, exportData);
        if (format === "csv") exportAnalyticsCsv(`${base}.csv`, table.columns, table.rows);
        else await exportAnalyticsExcel(`${base}.xlsx`, table.sheet, table.columns, table.rows);
      }
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : "No se pudo exportar el reporte.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="analytics-reports min-w-0 space-y-5 pb-8 text-white">
      <header className="report-screen-header executive-report-header rounded-3xl border p-5 sm:p-7">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-300">Inteligencia de datos · UGEL 06</div>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Reportes analíticos</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-white/55">Construye informes interactivos sobre monitores, fichas, instituciones y resultados. Las consultas se agregan en Supabase y nunca incluyen registros TEST.</p>
          </div>
          <div className="flex flex-wrap gap-2 print:hidden">
            <IconButton label="Exportar Excel" disabled={!generated || exporting} onClick={() => void exportReport("xlsx")} className="border-emerald-500/35 bg-emerald-500/10 text-emerald-300 disabled:opacity-40"><ExportFileIcon format="XLSX" /></IconButton>
            <IconButton label="Exportar CSV" disabled={!generated || exporting} onClick={() => void exportReport("csv")} className="disabled:opacity-40"><ExportFileIcon format="CSV" /></IconButton>
            <IconButton label="Exportar PDF" disabled={!generated || exporting} onClick={() => void exportReport("pdf")} tone="danger" className="disabled:opacity-40"><ExportFileIcon format="PDF" /></IconButton>
          </div>
        </div>
      </header>

      <section aria-labelledby="report-type-heading" className="print:hidden">
        <h2 id="report-type-heading" className="sr-only">Tipo de reporte</h2>
        <div className="grid gap-3 lg:grid-cols-3">
          {REPORT_TYPES.map((item) => (
            <button key={item.type} type="button" aria-pressed={reportType === item.type} onClick={() => changeReportType(item.type)} className={`group rounded-2xl border p-4 text-left transition ${reportType === item.type ? "border-cyan-300/45 bg-cyan-400/10 shadow-sm" : "border-white/10 bg-white/[0.035] hover:border-white/20 hover:bg-white/[0.055]"}`}>
              <div className="flex items-start gap-3"><span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${reportType === item.type ? "bg-cyan-300 text-slate-950" : "bg-white/5 text-white/65"}`}><DashboardIcon name={item.icon} /></span><span><strong className="block text-sm">{item.title}</strong><span className="mt-1 block text-xs leading-5 text-white/45">{item.description}</span></span></div>
            </button>
          ))}
        </div>
      </section>

      <div className="grid min-w-0 gap-5 xl:grid-cols-[300px_minmax(0,1fr)]">
        <div className="print:hidden xl:sticky xl:top-0 xl:self-start">
          <ReportFilterPanel reportType={reportType} filters={filters} options={options} loading={loading || loadingOptions} onChange={patchFilters} onGenerate={() => void runReport(0)} onReset={() => { setFilters({ ...EMPTY_REPORT_FILTERS }); setGenerated(null); setError(null); }} />
        </div>

        <main className="min-w-0" aria-live="polite" aria-busy={loading}>
          {error && <div role="alert" className="mb-4 rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-100">{error}</div>}
          {generated && (
            <div className="report-applied-summary mb-4 flex flex-col gap-1 rounded-xl border border-white/10 bg-white/[0.025] px-4 py-3 text-xs text-white/55 sm:flex-row sm:items-center sm:justify-between">
              <span>{reportFilterSummary(appliedFilters, options)}</span>
              {lastUpdated && <time dateTime={lastUpdated.toISOString()}>Generado: {lastUpdated.toLocaleString("es-PE")}</time>}
            </div>
          )}
          {!generated && !loading && !error && (
            <div className="grid min-h-[32rem] place-items-center rounded-3xl border border-dashed border-white/10 bg-white/[0.02] p-8 text-center"><div><DashboardIcon name="trend" className="mx-auto h-10 w-10 text-cyan-300/60" /><h2 className="mt-4 text-lg font-semibold">Configura tu informe</h2><p className="mt-2 max-w-md text-sm leading-6 text-white/45">Elige el tipo de reporte, aplica los filtros necesarios y pulsa Generar reporte.</p></div></div>
          )}
          {loading && !generated && <div className="grid min-h-[32rem] place-items-center rounded-3xl border border-white/10 bg-white/[0.02]"><div className="text-center text-sm text-white/55"><span className="mx-auto mb-3 block h-8 w-8 animate-spin rounded-full border-2 border-cyan-300 border-t-transparent" />Procesando agregaciones seguras...</div></div>}
          {generated?.type === "executive" && <ExecutiveReportView report={generated.data} />}
          {generated?.type === "monitor" && <MonitorDetailReportView report={generated.data} page={page} pageSize={PAGE_SIZE} onPageChange={(next) => void runReport(next, true)} />}
          {generated?.type === "results" && <QuestionResultsReportView report={generated.data} />}
        </main>
      </div>
    </div>
  );
}
