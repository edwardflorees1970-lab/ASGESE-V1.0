import type { AnalyticsColumn, AnalyticsRow } from "./analyticsExport";
import type {
  AnalyticsReportType,
  ExecutiveReport,
  MonitorDetailReport,
  QuestionResultsReport,
} from "./analyticsReportsApi";

export function analyticsReportExportTable(
  reportType: AnalyticsReportType,
  report: ExecutiveReport | MonitorDetailReport | QuestionResultsReport,
): { sheet: string; columns: AnalyticsColumn[]; rows: AnalyticsRow[] } {
  if (reportType === "monitor") {
    const detail = report as MonitorDetailReport;
    return {
      sheet: "Detalle por monitor",
      columns: [
        { key: "fecha", header: "Fecha de registro", kind: "datetime", width: 22 },
        { key: "monitor", header: "Monitor", width: 32 },
        { key: "institucion", header: "Institucion educativa", width: 42 },
        { key: "rei", header: "REI", width: 10 },
        { key: "nivel", header: "Nivel", width: 18 },
        { key: "codigo_modular", header: "Codigo modular", width: 18 },
        { key: "codigo_local", header: "Codigo local", width: 18 },
        { key: "distrito", header: "Distrito", width: 20 },
        { key: "monitoreo", header: "Monitoreo", width: 36 },
        { key: "ficha", header: "Ficha", width: 36 },
        { key: "estado", header: "Estado", width: 16 },
      ],
      rows: detail.rows.map((row) => ({
        fecha: new Date(row.registered_at), monitor: row.monitor_name, institucion: row.institucion_name,
        rei: row.rei, nivel: row.nivel, codigo_modular: row.codigo_modular, codigo_local: row.codigo_local,
        distrito: row.distrito, monitoreo: row.monitoreo_name, ficha: row.template_name, estado: row.status,
      })),
    };
  }
  if (reportType === "results") {
    const results = report as QuestionResultsReport;
    return {
      sheet: "Resultados",
      columns: [
        { key: "orden", header: "Item", kind: "integer", width: 10 },
        { key: "pregunta", header: "Pregunta", width: 60 },
        { key: "tipo", header: "Tipo", width: 20 },
        { key: "dimension", header: "Dimension de respuesta", width: 20 },
        { key: "respuesta", header: "Respuesta", width: 28 },
        { key: "cantidad", header: "Cantidad", kind: "integer", width: 14 },
        { key: "porcentaje", header: "Porcentaje", kind: "percentage", width: 16 },
      ],
      rows: results.questions.flatMap((question) => question.distribution.map((item) => ({
        orden: question.question_order, pregunta: question.question_text, tipo: question.question_type,
        dimension: question.axis, respuesta: item.label, cantidad: item.value, porcentaje: item.percentage / 100,
      }))),
    };
  }
  const executive = report as ExecutiveReport;
  const dimensionRows = (dimension: string, items: Array<{ label: string; value: number }>) => {
    const total = items.reduce((sum, item) => sum + Number(item.value), 0);
    return items.map((item) => ({
      dimension,
      categoria: item.label,
      cantidad: item.value,
      porcentaje: total ? item.value / total : 0,
    }));
  };
  return {
    sheet: "Indicadores generales",
    columns: [
      { key: "dimension", header: "Dimension", width: 24 },
      { key: "categoria", header: "Categoria", width: 42 },
      { key: "cantidad", header: "Cantidad", kind: "integer", width: 16 },
      { key: "porcentaje", header: "Porcentaje", kind: "percentage", width: 16 },
    ],
    rows: [
      ...dimensionRows("Monitor", executive.by_monitor),
      ...dimensionRows("REI", executive.by_rei),
      ...dimensionRows("Distrito", executive.by_district),
      ...dimensionRows("Mes", executive.by_month),
      ...dimensionRows("Estado", executive.by_status),
    ],
  };
}
