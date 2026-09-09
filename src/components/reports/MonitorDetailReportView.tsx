import { useMemo, useState } from "react";
import { DashboardPanel, KpiCard } from "../dashboard/DashboardWidgets";
import type { MonitorDetailReport, SeriesItem } from "../../lib/analyticsReportsApi";
import { BarSeriesPanel, CrossMatrixTable, ReportVisualActions, ReportVisualModal } from "./ReportCharts";

const format = new Intl.NumberFormat("es-PE");
const dateFormatter = new Intl.DateTimeFormat("es-PE", { dateStyle: "short", timeStyle: "short" });

export function MonitorDetailReportView({ report, page, pageSize, onPageChange }: {
  report: MonitorDetailReport;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}) {
  const monthSeries = useMemo<SeriesItem[]>(() => {
    const totals = new Map<string, number>();
    report.monitor_month.forEach((item) => totals.set(item.period ?? "Sin fecha", (totals.get(item.period ?? "Sin fecha") ?? 0) + Number(item.value)));
    return Array.from(totals, ([label, value]) => ({ label, value })).sort((a, b) => a.label.localeCompare(b.label));
  }, [report.monitor_month]);
  const pages = Math.max(1, Math.ceil(report.total_rows / pageSize));
  const [tableExpanded, setTableExpanded] = useState(false);
  const [tableAutoExport, setTableAutoExport] = useState(false);
  const table = (large: boolean) => <div className={`agebre-table-shell ${large ? "flex justify-center" : "max-h-[34rem]"}`}>
    <table className={`${large ? "w-max min-w-[980px] max-w-[1280px] table-auto" : "w-full min-w-[1180px]"} text-left text-[10px] sm:text-xs`}>
      <thead className="sticky top-0 bg-slate-950 text-white/55"><tr><th className="p-2.5">Fecha</th><th className="p-2.5">Monitor</th><th className="p-2.5">Institución</th><th className="p-2.5">REI</th><th className="p-2.5">Nivel</th><th className="p-2.5">Cód. modular</th><th className="p-2.5">Cód. local</th><th className="p-2.5">Distrito</th><th className="p-2.5">Monitoreo</th><th className="p-2.5">Ficha</th><th className="p-2.5">Estado</th></tr></thead>
      <tbody>{report.rows.map((row) => <tr key={row.run_id} className="border-t border-white/10"><td className="whitespace-nowrap p-2.5">{dateFormatter.format(new Date(row.registered_at))}</td><td className={`${large ? "whitespace-normal" : "max-w-56 truncate"} p-2.5`} title={row.monitor_name}>{row.monitor_name || "Sin nombre"}</td><td className={`${large ? "whitespace-normal" : "max-w-72 truncate"} p-2.5`} title={row.institucion_name}>{row.institucion_name}</td><td className="p-2.5">{row.rei}</td><td className="p-2.5">{row.nivel}</td><td className="p-2.5">{row.codigo_modular ?? "—"}</td><td className="p-2.5">{row.codigo_local ?? "—"}</td><td className="p-2.5">{row.distrito}</td><td className={`${large ? "whitespace-normal" : "max-w-64 truncate"} p-2.5`} title={row.monitoreo_name}>{row.monitoreo_name ?? "—"}</td><td className={`${large ? "whitespace-normal" : "max-w-64 truncate"} p-2.5`} title={row.template_name}>{row.template_name}</td><td className="p-2.5"><span className={`rounded-full px-2 py-1 text-[10px] ${row.status === "final" ? "bg-emerald-400/15 text-emerald-200" : "bg-amber-400/15 text-amber-200"}`}>{row.status === "final" ? "Finalizada" : "En proceso"}</span></td></tr>)}</tbody>
    </table>
  </div>;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <KpiCard label="Fichas registradas" value={format.format(report.kpis.total_runs)} detail="Sin registros de prueba" icon="activity" />
        <KpiCard label="Monitores con registros" value={format.format(report.kpis.monitor_count)} detail="Según los filtros aplicados" icon="people" tone="violet" />
        <KpiCard label="Instituciones monitoreadas" value={format.format(report.kpis.institution_count)} detail="Instituciones únicas vinculadas" icon="target" tone="emerald" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <CrossMatrixTable title="Recuento de fichas por monitor y nivel" rows={report.monitor_level} rowKey="monitor" />
        <CrossMatrixTable title="Recuento de fichas por REI y nivel" rows={report.rei_level} rowKey="rei" />
      </div>
      <BarSeriesPanel title="Fichas por mes de registro" data={monthSeries} horizontal={false} />
      <DashboardPanel title="Instituciones monitoreadas" description={`${format.format(report.total_rows)} registros encontrados`} action={<ReportVisualActions onView={() => setTableExpanded(true)} onImage={() => { setTableAutoExport(true); setTableExpanded(true); }} />}>
        <div className="mt-4">{table(false)}</div>
        <div className="mt-4 flex items-center justify-between gap-3 text-xs text-white/55">
          <span>Página {page + 1} de {pages}</span>
          <div className="flex gap-2"><button type="button" disabled={page === 0} onClick={() => onPageChange(page - 1)} className="rounded-lg border border-white/10 px-3 py-2 disabled:opacity-40">Anterior</button><button type="button" disabled={page + 1 >= pages} onClick={() => onPageChange(page + 1)} className="rounded-lg border border-white/10 px-3 py-2 disabled:opacity-40">Siguiente</button></div>
        </div>
      </DashboardPanel>
      {tableExpanded && <ReportVisualModal title="Instituciones monitoreadas" wide autoExport={tableAutoExport} onAutoExported={() => setTableAutoExport(false)} onClose={() => { setTableExpanded(false); setTableAutoExport(false); }}>{table(true)}</ReportVisualModal>}
    </div>
  );
}
