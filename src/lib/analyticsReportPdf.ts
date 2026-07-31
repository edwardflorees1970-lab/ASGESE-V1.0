import type { AnalyticsReportType, ExecutiveReport, MonitorDetailReport, QuestionResultsReport } from "./analyticsReportsApi";
import { analyticsReportExportTable } from "./analyticsReportExport";

type AnalyticsReport = ExecutiveReport | MonitorDetailReport | QuestionResultsReport;

function reportTitle(type: AnalyticsReportType) {
  if (type === "monitor") return "Detalle por monitor y fichas";
  if (type === "results") return "Resultados por preguntas";
  return "Indicadores generales";
}

function cellText(value: unknown, kind?: string) {
  if (value == null) return "";
  if (value instanceof Date) return value.toLocaleString("es-PE");
  if (kind === "percentage" && typeof value === "number") return `${(value * 100).toLocaleString("es-PE", { maximumFractionDigits: 2 })}%`;
  if (typeof value === "number") return value.toLocaleString("es-PE", { maximumFractionDigits: 8 });
  return String(value);
}

function kpis(reportType: AnalyticsReportType, report: AnalyticsReport) {
  if (reportType === "executive") {
    const data = (report as ExecutiveReport).kpis;
    return [["Total de fichas", data.total_runs], ["Finalizadas", data.finalized_runs], ["En proceso", data.draft_runs], ["Monitores", data.monitor_count], ["Instituciones", data.institution_count]];
  }
  if (reportType === "monitor") {
    const data = (report as MonitorDetailReport).kpis;
    return [["Fichas registradas", data.total_runs], ["Monitores", data.monitor_count], ["Instituciones", data.institution_count]];
  }
  const data = (report as QuestionResultsReport).kpis;
  return [["Fichas consideradas", data.run_count], ["Preguntas", data.question_count], ["Respuestas", data.answer_count]];
}

export async function exportAnalyticsPdf(options: {
  filename: string;
  reportType: AnalyticsReportType;
  report: AnalyticsReport;
  filters: string;
  exportedBy: string;
  generatedAt: Date;
}) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const document = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4", compress: true });
  const table = analyticsReportExportTable(options.reportType, options.report);
  const title = reportTitle(options.reportType);
  const pageWidth = document.internal.pageSize.getWidth();
  const pageHeight = document.internal.pageSize.getHeight();
  const generatedText = options.generatedAt.toLocaleString("es-PE");

  const drawFrame = () => {
    document.setFillColor(8, 17, 31);
    document.rect(0, 0, pageWidth, 25, "F");
    document.setTextColor(255, 255, 255);
    document.setFont("helvetica", "bold");
    document.setFontSize(13);
    document.text(`AGEBERE · ${title}`, 10, 9);
    document.setFont("helvetica", "normal");
    document.setFontSize(7.5);
    document.setTextColor(205, 220, 232);
    document.text(`Filtros: ${options.filters}`, 10, 15, { maxWidth: pageWidth - 20 });
    document.text(`Exportado por: ${options.exportedBy} · ${generatedText}`, 10, 21);
    document.setDrawColor(210, 220, 230);
    document.line(10, pageHeight - 10, pageWidth - 10, pageHeight - 10);
    document.setTextColor(80, 95, 110);
    document.setFontSize(7);
    document.text("Créditos: Ing. Alex Alberto Quispe Pillaca · Ing. Diego Axel Arce Muñoz · Propietario UGEL 06", 10, pageHeight - 5);
    document.text(`Página ${document.getCurrentPageInfo().pageNumber}`, pageWidth - 10, pageHeight - 5, { align: "right" });
  };

  autoTable(document, {
    startY: 29,
    head: [kpis(options.reportType, options.report).map(([label]) => String(label))],
    body: [kpis(options.reportType, options.report).map(([, value]) => Number(value).toLocaleString("es-PE"))],
    theme: "grid",
    styles: { fontSize: 8, halign: "center", cellPadding: 2 },
    headStyles: { fillColor: [23, 50, 77], textColor: 255 },
    margin: { left: 10, right: 10, top: 27, bottom: 13 },
    didDrawPage: drawFrame,
  });

  const summaryEnd = (document as typeof document & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 42;
  autoTable(document, {
    startY: summaryEnd + 4,
    head: [table.columns.map((column) => column.header)],
    body: table.rows.map((row) => table.columns.map((column) => cellText(row[column.key], column.kind))),
    theme: "striped",
    styles: { fontSize: options.reportType === "monitor" ? 5.8 : 6.8, cellPadding: 1.25, overflow: "linebreak", valign: "middle" },
    headStyles: { fillColor: [23, 50, 77], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [241, 245, 249] },
    margin: { left: 8, right: 8, top: 27, bottom: 13 },
    rowPageBreak: "avoid",
    horizontalPageBreak: true,
    horizontalPageBreakRepeat: 0,
    didDrawPage: drawFrame,
  });

  document.save(options.filename);
}
