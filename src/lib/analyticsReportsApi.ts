import { supabase } from "./supabaseClient";
import { isMissingRpc } from "./rpcErrors";

export type AnalyticsReportType = "monitor" | "results" | "executive";

export type ReportOption = {
  value: string;
  label: string;
  type?: string;
};

export type AnalyticsReportFilters = {
  year: string;
  month: string;
  date_from: string;
  date_to: string;
  monitoreo_id: string;
  template_id: string;
  monitor_id: string;
  institucion_id: string;
  rei: string;
  nivel: string;
  distrito: string;
  status: string;
  question_id: string;
  response: string;
};

export const EMPTY_REPORT_FILTERS: AnalyticsReportFilters = {
  year: "",
  month: "",
  date_from: "",
  date_to: "",
  monitoreo_id: "",
  template_id: "",
  monitor_id: "",
  institucion_id: "",
  rei: "",
  nivel: "",
  distrito: "",
  status: "",
  question_id: "",
  response: "",
};

export type ReportFilterOptions = {
  years: ReportOption[];
  monitorings: ReportOption[];
  templates: ReportOption[];
  monitors: ReportOption[];
  institutions: ReportOption[];
  reis: ReportOption[];
  levels: ReportOption[];
  districts: ReportOption[];
  questions: ReportOption[];
  responses: ReportOption[];
};

export type SeriesItem = { label: string; value: number };
export type MatrixItem = { label: string; axis: string; response: string; value: number; percentage: number };

export type ExecutiveReport = {
  kpis: {
    total_runs: number;
    finalized_runs: number;
    draft_runs: number;
    monitor_count: number;
    institution_count: number;
    unlinked_institution_count: number;
  };
  by_monitor: SeriesItem[];
  by_rei: SeriesItem[];
  by_district: SeriesItem[];
  by_month: SeriesItem[];
  by_status: SeriesItem[];
};

export type MonitorDetailRow = {
  run_id: string;
  registered_at: string;
  status: string;
  monitor_name: string;
  monitoreo_name: string;
  template_name: string;
  institucion_name: string;
  codigo_modular: string | null;
  codigo_local: string | null;
  rei: string;
  nivel: string;
  distrito: string;
};

export type CrossItem = { monitor?: string; rei?: string; nivel: string; period?: string; value: number };

export type MonitorDetailReport = {
  kpis: { total_runs: number; monitor_count: number; institution_count: number };
  monitor_level: CrossItem[];
  rei_level: CrossItem[];
  monitor_month: CrossItem[];
  monitor_day: CrossItem[];
  total_rows: number;
  rows: MonitorDetailRow[];
};

export type QuestionDistribution = {
  question_id: string;
  question_text: string;
  question_type: string;
  question_order: number;
  axis: string;
  total: number;
  distribution: Array<SeriesItem & { percentage: number }>;
};

export type QuestionResultsReport = {
  kpis: { run_count: number; question_count: number; answer_count: number };
  questions: QuestionDistribution[];
  by_institution: MatrixItem[];
  by_rei: MatrixItem[];
  by_district: MatrixItem[];
  by_level: MatrixItem[];
};

function compactFilters(filters: AnalyticsReportFilters) {
  return Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== ""));
}

function reportError(error: { code?: string; message: string }) {
  if (isMissingRpc(error)) {
    return new Error("Falta aplicar la migracion 2026-08-01_analytics_reporting.sql en Supabase.");
  }
  return new Error(error.message);
}

export async function loadReportFilterOptions(filters: AnalyticsReportFilters, signal?: AbortSignal) {
  const query = supabase.rpc("report_filter_options", { p_filters: compactFilters(filters) });
  const { data, error } = signal ? await query.abortSignal(signal) : await query;
  if (error) throw reportError(error);
  const result = (data ?? {}) as Partial<ReportFilterOptions>;
  return {
    years: result.years ?? [],
    monitorings: result.monitorings ?? [],
    templates: result.templates ?? [],
    monitors: result.monitors ?? [],
    institutions: result.institutions ?? [],
    reis: result.reis ?? [],
    levels: result.levels ?? [],
    districts: result.districts ?? [],
    questions: result.questions ?? [],
    responses: result.responses ?? [],
  };
}

export async function loadExecutiveReport(filters: AnalyticsReportFilters, signal?: AbortSignal) {
  const query = supabase.rpc("report_executive_summary", { p_filters: compactFilters(filters) });
  const { data, error } = signal ? await query.abortSignal(signal) : await query;
  if (error) throw reportError(error);
  return data as unknown as ExecutiveReport;
}

export async function loadMonitorDetailReport(
  filters: AnalyticsReportFilters,
  page: number,
  pageSize: number,
  signal?: AbortSignal,
) {
  const query = supabase.rpc("report_monitor_detail", {
    p_filters: compactFilters(filters),
    p_limit: pageSize,
    p_offset: page * pageSize,
  });
  const { data, error } = signal ? await query.abortSignal(signal) : await query;
  if (error) throw reportError(error);
  return data as unknown as MonitorDetailReport;
}

export async function loadFullMonitorDetailReport(filters: AnalyticsReportFilters, maxRows = 20_000) {
  const pageSize = 500;
  const first = await loadMonitorDetailReport(filters, 0, pageSize);
  if (first.total_rows > maxRows) {
    throw new Error(`El reporte contiene ${first.total_rows.toLocaleString("es-PE")} filas. Aplica más filtros antes de exportar (máximo ${maxRows.toLocaleString("es-PE")}).`);
  }
  const rows = [...first.rows];
  for (let page = 1; rows.length < first.total_rows; page += 1) {
    const next = await loadMonitorDetailReport(filters, page, pageSize);
    rows.push(...next.rows);
    if (!next.rows.length) break;
  }
  return { ...first, rows };
}

export async function loadQuestionResultsReport(filters: AnalyticsReportFilters, signal?: AbortSignal) {
  const query = supabase.rpc("report_question_results", { p_filters: compactFilters(filters) });
  const { data, error } = signal ? await query.abortSignal(signal) : await query;
  if (error) throw reportError(error);
  return data as unknown as QuestionResultsReport;
}

export function reportFilterSummary(filters: AnalyticsReportFilters, options: ReportFilterOptions) {
  const labels: string[] = [];
  const resolve = (items: ReportOption[], value: string) => items.find((item) => item.value === value)?.label ?? value;
  if (filters.year) labels.push(`Año: ${filters.year}`);
  if (filters.month) labels.push(`Mes: ${filters.month}`);
  if (filters.monitoreo_id) labels.push(`Monitoreo: ${resolve(options.monitorings, filters.monitoreo_id)}`);
  if (filters.template_id) labels.push(`Ficha: ${resolve(options.templates, filters.template_id)}`);
  if (filters.monitor_id) labels.push(`Monitor: ${resolve(options.monitors, filters.monitor_id)}`);
  if (filters.rei) labels.push(`REI: ${filters.rei}`);
  if (filters.nivel) labels.push(`Nivel: ${filters.nivel}`);
  if (filters.distrito) labels.push(`Distrito: ${filters.distrito}`);
  if (filters.status) labels.push(`Estado: ${filters.status}`);
  return labels.length ? labels.join(" · ") : "Todos los registros de produccion";
}
