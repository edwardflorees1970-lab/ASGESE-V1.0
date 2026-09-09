import { DashboardIcon, DashboardSelect, SearchableFilter } from "../dashboard/DashboardWidgets";
import type { IconName } from "../dashboard/DashboardWidgets";
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

function FilterSection({
  icon,
  title,
  hint,
  children,
}: {
  icon: IconName;
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="report-filter-section">
      <div className="report-filter-section-head">
        <DashboardIcon name={icon} className="h-3.5 w-3.5" />
        <span>{title}</span>
        {hint && <span className="report-filter-section-hint">{hint}</span>}
      </div>
      <div className="mt-2 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-1">{children}</div>
    </div>
  );
}

export function ReportFilterPanel({
  reportType,
  reportTypeInfo,
  filters,
  options,
  loading,
  onChange,
  onGenerate,
  onReset,
}: {
  reportType: AnalyticsReportType;
  reportTypeInfo?: { title: string; description: string };
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
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 basis-48">
          <div className="flex items-center gap-2 text-sm font-semibold text-white"><DashboardIcon name="filter" className="h-4 w-4 text-cyan-300" />Filtros</div>
          <p className="mt-1 text-[11px] text-white/45">Solo datos reales; las fichas TEST se excluyen en servidor.</p>
        </div>
        <button type="button" onClick={onReset} className="report-filter-reset ml-auto shrink-0 whitespace-nowrap rounded-lg border border-white/10 px-2.5 py-1.5 text-center text-xs leading-5 text-white/60 hover:bg-white/5">Limpiar</button>
      </div>

      {reportTypeInfo && (
        <div className="report-filter-guide mt-3 flex items-start gap-2.5 rounded-xl border">
          <DashboardIcon name="trend" className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="min-w-0 text-xs leading-5">
            <strong className="block text-white/85">{reportTypeInfo.title}</strong>
            <span className="text-white/50">{reportTypeInfo.description}</span>
          </div>
        </div>
      )}

      <div className="report-filter-sections mt-3">
        <FilterSection icon="calendar" title="Periodo">
          <DashboardSelect icon="calendar" label="Año" value={filters.year} options={optionsWithAll(options.years, "Todos los años")} onChange={(value) => onChange({ year: value })} />
          <DashboardSelect icon="calendar" label="Mes" value={filters.month} options={MONTH_OPTIONS} onChange={(value) => onChange({ month: value })} />
        </FilterSection>

        <FilterSection icon="target" title="Qué reporte ver">
          <SearchableFilter label="Monitoreo" value={searchableValue(filters.monitoreo_id)} options={options.monitorings} allLabel="Todos los monitoreos" placeholder="Buscar monitoreo..." onChange={searchableChange("monitoreo_id")} />
          <DashboardSelect icon="target" label="Ficha" value={filters.template_id} options={optionsWithAll(options.templates, "Todas las fichas")} onChange={(value) => onChange({ template_id: value, question_id: "", response: "" })} />
          {reportType === "results" && (
            <>
              <SearchableFilter label="Pregunta" value={searchableValue(filters.question_id)} options={options.questions} allLabel="Todas las preguntas" placeholder="Buscar pregunta..." onChange={searchableChange("question_id")} />
              <DashboardSelect icon="check" label="Respuesta" value={filters.response} options={optionsWithAll(options.responses, "Todas las respuestas")} onChange={(value) => onChange({ response: value })} />
            </>
          )}
        </FilterSection>

        <FilterSection icon="people" title="Quién y en qué nivel">
          <DashboardSelect icon="activity" label="Nivel" value={filters.nivel} options={optionsWithAll(options.levels, "Todos los niveles")} onChange={(value) => onChange({ nivel: value })} />
          <DashboardSelect icon="people" label="REI" value={filters.rei} options={optionsWithAll(options.reis, "Todas las REI")} onChange={(value) => onChange({ rei: value })} />
          <div className="sm:col-span-2 xl:col-span-1">
            <SearchableFilter label="Monitor" value={searchableValue(filters.monitor_id)} options={options.monitors} allLabel="Todos los monitores" placeholder="Buscar monitor..." onChange={searchableChange("monitor_id")} />
          </div>
        </FilterSection>
      </div>

      <details className="report-filter-advanced mt-3 rounded-xl border border-white/10 bg-white/[0.025] p-3">
        <summary className="cursor-pointer text-xs font-semibold text-white/65">Filtros avanzados <span className="text-white/35">· institución, distrito, estado, fechas exactas</span></summary>
        <div className="mt-3 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-1">
          <SearchableFilter label="Institución" value={searchableValue(filters.institucion_id)} options={options.institutions} allLabel="Todas las instituciones" placeholder="Buscar institución..." onChange={searchableChange("institucion_id")} />
          <DashboardSelect icon="target" label="Distrito" value={filters.distrito} options={optionsWithAll(options.districts, "Todos los distritos")} onChange={(value) => onChange({ distrito: value })} />
          <DashboardSelect icon="check" label="Estado" value={filters.status} options={STATUS_OPTIONS} onChange={(value) => onChange({ status: value })} />
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

      <button type="button" disabled={loading} onClick={onGenerate} className="executive-primary-action mt-3 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition disabled:cursor-wait disabled:opacity-60">
        <DashboardIcon name={loading ? "clock" : "trend"} className="h-4 w-4" />
        {loading ? "Generando reporte..." : "Generar reporte"}
      </button>
    </aside>
  );
}
