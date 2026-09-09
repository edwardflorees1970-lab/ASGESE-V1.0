import { useMemo, useState } from "react";
import { DashboardIcon, DashboardPanel, KpiCard } from "../dashboard/DashboardWidgets";
import type { ExecutiveReport, StatusSeriesItem } from "../../lib/analyticsReportsApi";
import { PieSeriesPanel, ReportVisualActions, ReportVisualModal, StatusBarSeriesPanel } from "./ReportCharts";

const format = new Intl.NumberFormat("es-PE");

type AttentionRow = StatusSeriesItem & { reason: "sin_actividad" | "sin_cierre" };

/**
 * Lista, no grafico: para que una jefa de area pueda escanear en segundos
 * quien no ha registrado nada o quien tiene fichas abiertas que nunca
 * cierra -- la senal que las barras por si solas no resaltan lo suficiente
 * cuando hay muchos monitores.
 */
function MonitorAttentionPanel({ data }: { data: StatusSeriesItem[] }) {
  const rows = useMemo<AttentionRow[]>(() => {
    const sinActividad = data.filter((item) => item.value === 0).map((item) => ({ ...item, reason: "sin_actividad" as const }));
    const sinCierre = data
      .filter((item) => item.value > 0 && item.finalizada === 0)
      .sort((a, b) => b.en_proceso - a.en_proceso)
      .map((item) => ({ ...item, reason: "sin_cierre" as const }));
    return [...sinActividad, ...sinCierre];
  }, [data]);

  if (!data.length) return null;

  return (
    <DashboardPanel
      title="Monitores que requieren atención"
      description="Sin actividad registrada, o con fichas abiertas que nunca finalizan."
    >
      {!rows.length ? (
        <div className="mt-4 flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.025] p-3 text-xs text-white/60">
          <DashboardIcon name="check" className="h-4 w-4 shrink-0 text-emerald-300" />
          Todos los monitores con fichas asignadas registraron actividad y tienen al menos una ficha finalizada.
        </div>
      ) : (
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((row, index) => (
            <div key={`${row.label}-${index}`} className="flex items-start justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.025] p-3">
              <div className="min-w-0">
                <div className="truncate text-xs font-semibold text-white" title={row.label}>{row.label}</div>
                <div className="mt-0.5 text-[11px] text-white/45">
                  {row.reason === "sin_actividad" ? "Sin fichas registradas" : `${row.en_proceso} en proceso · 0 finalizadas`}
                </div>
              </div>
              <span className={row.reason === "sin_actividad" ? "badge-red shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold" : "badge-amber shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold"}>
                {row.reason === "sin_actividad" ? "Sin actividad" : "Sin cierre"}
              </span>
            </div>
          ))}
        </div>
      )}
    </DashboardPanel>
  );
}

function ExecutiveContent({ report, expanded = false }: { report: ExecutiveReport; expanded?: boolean }) {
  const completion = report.kpis.total_runs ? Math.round(report.kpis.finalized_runs * 100 / report.kpis.total_runs) : 0;
  return (
    <div className="space-y-4">
      <div className={`grid gap-3 sm:grid-cols-2 ${expanded ? "xl:grid-cols-5" : "lg:grid-cols-3"}`}>
        <KpiCard label="Total de fichas" value={format.format(report.kpis.total_runs)} detail="Registros reales, sin fichas TEST" icon="activity" />
        <KpiCard label="Finalizadas" value={format.format(report.kpis.finalized_runs)} detail={`${completion}% del total`} icon="check" tone="emerald" progress={completion} />
        <KpiCard label="En proceso" value={format.format(report.kpis.draft_runs)} detail="Fichas registradas pendientes de cierre" icon="clock" tone="amber" />
        <KpiCard label="Monitores" value={format.format(report.kpis.monitor_count)} detail="Usuarios con registros en el periodo" icon="people" tone="violet" />
        <KpiCard label="Instituciones" value={format.format(report.kpis.institution_count)} detail={report.kpis.unlinked_institution_count ? `${report.kpis.unlinked_institution_count} fichas requieren vinculación` : "Todas las fichas están vinculadas"} icon="target" className={expanded ? "sm:col-span-2 xl:col-span-1" : "sm:col-span-2 lg:col-span-1"} />
      </div>
      <MonitorAttentionPanel data={report.by_monitor} />
      <div className={`grid gap-4 ${expanded ? "xl:grid-cols-2" : "lg:grid-cols-2"}`}>
        <StatusBarSeriesPanel title="Fichas por monitor" description="Finalizada vs en proceso. Incluye monitores asignados sin fichas." data={report.by_monitor} />
        <StatusBarSeriesPanel title="Fichas por REI" description="Finalizada vs en proceso. Incluye REI sin actividad." data={report.by_rei} />
        <StatusBarSeriesPanel title="Fichas por distrito" description="Finalizada vs en proceso. Incluye distritos sin actividad." data={report.by_district} />
        <PieSeriesPanel title="Distribución por mes de registro" data={report.by_month} />
      </div>
    </div>
  );
}

export function ExecutiveReportView({ report }: { report: ExecutiveReport }) {
  const [expanded, setExpanded] = useState(false);
  const [autoExport, setAutoExport] = useState(false);
  const openForExport = () => { setAutoExport(true); setExpanded(true); };
  return <>
    <div className="mb-3 flex justify-end"><ReportVisualActions onView={() => setExpanded(true)} onImage={openForExport} /></div>
    <ExecutiveContent report={report} />
    {expanded && <ReportVisualModal title="Indicadores generales" wide autoExport={autoExport} onAutoExported={() => setAutoExport(false)} onClose={() => { setExpanded(false); setAutoExport(false); }}><ExecutiveContent report={report} expanded /></ReportVisualModal>}
  </>;
}
