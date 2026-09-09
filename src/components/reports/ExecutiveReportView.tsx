import { useState } from "react";
import { KpiCard } from "../dashboard/DashboardWidgets";
import type { ExecutiveReport } from "../../lib/analyticsReportsApi";
import { PieSeriesPanel, ReportVisualActions, ReportVisualModal, StatusBarSeriesPanel } from "./ReportCharts";

const format = new Intl.NumberFormat("es-PE");

function ExecutiveContent({ report, expanded = false }: { report: ExecutiveReport; expanded?: boolean }) {
  const completion = report.kpis.total_runs ? Math.round(report.kpis.finalized_runs * 100 / report.kpis.total_runs) : 0;
  return (
    <div className="space-y-4">
      <div className={`grid gap-3 sm:grid-cols-2 ${expanded ? "xl:grid-cols-5" : "2xl:grid-cols-3"}`}>
        <KpiCard label="Total de fichas" value={format.format(report.kpis.total_runs)} detail="Registros reales, sin fichas TEST" icon="activity" />
        <KpiCard label="Finalizadas" value={format.format(report.kpis.finalized_runs)} detail={`${completion}% del total`} icon="check" tone="emerald" progress={completion} />
        <KpiCard label="En proceso" value={format.format(report.kpis.draft_runs)} detail="Fichas registradas pendientes de cierre" icon="clock" tone="amber" />
        <KpiCard label="Monitores" value={format.format(report.kpis.monitor_count)} detail="Usuarios con registros en el periodo" icon="people" tone="violet" />
        <KpiCard label="Instituciones" value={format.format(report.kpis.institution_count)} detail={report.kpis.unlinked_institution_count ? `${report.kpis.unlinked_institution_count} fichas requieren vinculación` : "Todas las fichas están vinculadas"} icon="target" className={expanded ? "sm:col-span-2 xl:col-span-1" : "sm:col-span-2 2xl:col-span-1"} />
      </div>
      <div className={`grid gap-4 ${expanded ? "xl:grid-cols-2" : "2xl:grid-cols-2"}`}>
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
