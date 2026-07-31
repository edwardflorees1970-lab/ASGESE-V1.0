import { DashboardIcon, DashboardSelect, SearchableFilter } from "../dashboard/DashboardWidgets";
import type {
  AnalyticsReportFilters,
  AnalyticsReportType,
  ReportFilterOptions,
  ReportOption,
} from "../../lib/analyticsReportsApi";

const MONTH_OPTIONS: ReportOption[] = [
  { value: "", label: "Todos los meses" },
  ...["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]
    .map((label, index) => ({ value: String(index + 1), label })),
];

const STATUS_OPTIONS: ReportOption[] = [
  { value: "", label: "Todos los estados" },
  { value: "draft", label: "Registrada / en proceso" },
  { value: "final", label: "Finalizada" },
];

function optionsWithAll(options: ReportOption[], allLabel: string) {
  return [{ value: "", label: allLabel }, ...options];
}

export function ReportFilterPanel({
  reportType,
  filters,
  options,
  loading,
  onChange,
  onGenerate,
  onReset,
}: {
  reportType: AnalyticsReportType;
  filters: AnalyticsReportFilters;
  options: ReportFilterOptions;
  loading: boolean;
  onChange: (patch: Partial<AnalyticsReportFilters>) => void;
  onGenerate: () => void;
  onReset: () => void;
}) {
  const searchableValue = (value: string) => value || "ALL";
  const searchableChange = (key: keyof AnalyticsReportFilters) => (value: string) => onChange({ [key]: value === "ALL" ? "" : value });

  return (
    <aside aria-label="Filtros del reporte" className="report-filter-panel rounded-2xl border p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-white"><DashboardIcon name="filter" className="h-4 w-4 text-cyan-300" />Filtros</div>
          <p className="mt-1 text-[11px] text-white/45">Solo datos reales; las fichas TEST se excluyen en servidor.</p>
        </div>
        <button type="button" onClick={onReset} className="rounded-lg border border-white/10 px-2.5 py-1.5 text-xs text-white/60 hover:bg-white/5">Limpiar</button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
        <DashboardSelect label="Año" value={filters.year} options={optionsWithAll(options.years, "Todos los años")} onChange={(value) => onChange({ year: value })} />
        <DashboardSelect label="Mes" value={filters.month} options={MONTH_OPTIONS} onChange={(value) => onChange({ month: value })} />
        <SearchableFilter label="Monitoreo" value={searchableValue(filters.monitoreo_id)} options={options.monitorings} allLabel="Todos los monitoreos" placeholder="Buscar monitoreo..." onChange={searchableChange("monitoreo_id")} />
        <DashboardSelect label="Ficha" value={filters.template_id} options={optionsWithAll(options.templates, "Todas las fichas")} onChange={(value) => onChange({ template_id: value, question_id: "", response: "" })} />
        <SearchableFilter label="Monitor" value={searchableValue(filters.monitor_id)} options={options.monitors} allLabel="Todos los monitores" placeholder="Buscar monitor..." onChange={searchableChange("monitor_id")} />
        <DashboardSelect label="Nivel" value={filters.nivel} options={optionsWithAll(options.levels, "Todos los niveles")} onChange={(value) => onChange({ nivel: value })} />
        <DashboardSelect label="REI" value={filters.rei} options={optionsWithAll(options.reis, "Todas las REI")} onChange={(value) => onChange({ rei: value })} />

        {reportType === "results" && (
          <>
            <SearchableFilter label="Pregunta" value={searchableValue(filters.question_id)} options={options.questions} allLabel="Todas las preguntas" placeholder="Buscar pregunta..." onChange={searchableChange("question_id")} />
            <DashboardSelect label="Respuesta" value={filters.response} options={optionsWithAll(options.responses, "Todas las respuestas")} onChange={(value) => onChange({ response: value })} />
          </>
        )}
      </div>

      <details className="mt-4 rounded-xl border border-white/10 bg-white/[0.025] p-3">
        <summary className="cursor-pointer text-xs font-semibold text-white/65">Filtros avanzados</summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
          <SearchableFilter label="Institución" value={searchableValue(filters.institucion_id)} options={options.institutions} allLabel="Todas las instituciones" placeholder="Buscar institución..." onChange={searchableChange("institucion_id")} />
          <DashboardSelect label="Distrito" value={filters.distrito} options={optionsWithAll(options.districts, "Todos los distritos")} onChange={(value) => onChange({ distrito: value })} />
          <DashboardSelect label="Estado" value={filters.status} options={STATUS_OPTIONS} onChange={(value) => onChange({ status: value })} />
          <label className="text-[11px] font-semibold uppercase tracking-[0.11em] text-white/45">
            Fecha desde
            <input type="date" value={filters.date_from} onChange={(event) => onChange({ date_from: event.target.value })} className="dashboard-control mt-2 h-11 w-full rounded-xl border px-3 text-sm text-white outline-none" />
          </label>
          <label className="text-[11px] font-semibold uppercase tracking-[0.11em] text-white/45">
            Fecha hasta
            <input type="date" value={filters.date_to} min={filters.date_from || undefined} onChange={(event) => onChange({ date_to: event.target.value })} className="dashboard-control mt-2 h-11 w-full rounded-xl border px-3 text-sm text-white outline-none" />
          </label>
        </div>
      </details>

      <button type="button" disabled={loading} onClick={onGenerate} className="executive-primary-action mt-4 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition disabled:cursor-wait disabled:opacity-60">
        <DashboardIcon name={loading ? "clock" : "trend"} className="h-4 w-4" />
        {loading ? "Generando reporte..." : "Generar reporte"}
      </button>
    </aside>
  );
}
