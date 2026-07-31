import { describe, expect, it } from "vitest";
import { analyticsReportExportTable } from "./analyticsReportExport";
import type { ExecutiveReport, MonitorDetailReport, QuestionResultsReport } from "./analyticsReportsApi";

describe("analyticsReportExportTable", () => {
  it("convierte el reporte ejecutivo a filas por dimension", () => {
    const report: ExecutiveReport = {
      kpis: { total_runs: 2, finalized_runs: 1, draft_runs: 1, monitor_count: 1, institution_count: 2, unlinked_institution_count: 0 },
      by_monitor: [{ label: "Monitor A", value: 2 }],
      by_rei: [{ label: "01", value: 2 }],
      by_district: [],
      by_month: [],
      by_status: [],
    };
    const table = analyticsReportExportTable("executive", report);
    expect(table.sheet).toBe("Indicadores generales");
    expect(table.rows).toEqual([
      { dimension: "Monitor", categoria: "Monitor A", cantidad: 2, porcentaje: 1 },
      { dimension: "REI", categoria: "01", cantidad: 2, porcentaje: 1 },
    ]);
    expect(table.columns.find((column) => column.key === "porcentaje")?.kind).toBe("percentage");
  });

  it("mantiene cantidad y porcentaje por alternativa", () => {
    const report: QuestionResultsReport = {
      kpis: { run_count: 10, question_count: 1, answer_count: 10 },
      questions: [{
        question_id: "q1", question_text: "Pregunta", question_type: "yes_no", question_order: 1,
        axis: "respuesta", total: 10,
        distribution: [{ label: "SI", value: 7, percentage: 70 }, { label: "NO", value: 3, percentage: 30 }],
      }],
      by_institution: [], by_rei: [], by_district: [], by_level: [],
    };
    const table = analyticsReportExportTable("results", report);
    expect(table.rows).toHaveLength(2);
    expect(table.rows[0]).toMatchObject({ respuesta: "SI", cantidad: 7, porcentaje: 0.7 });
    expect(table.columns.find((column) => column.key === "cantidad")?.kind).toBe("integer");
    expect(table.columns.find((column) => column.key === "porcentaje")?.kind).toBe("percentage");
  });

  it("prepara el detalle de fichas para Excel", () => {
    const report: MonitorDetailReport = {
      kpis: { total_runs: 1, monitor_count: 1, institution_count: 1 },
      monitor_level: [], rei_level: [], monitor_month: [], monitor_day: [], total_rows: 1,
      rows: [{
        run_id: "r1", registered_at: "2026-08-01T10:00:00Z", status: "final",
        monitor_name: "Monitor A", monitoreo_name: "Monitoreo", template_name: "Ficha",
        institucion_name: "IE 001", codigo_modular: "001", codigo_local: "10",
        rei: "01", nivel: "Primaria", distrito: "Ate",
      }],
    };
    const table = analyticsReportExportTable("monitor", report);
    expect(table.rows[0]).toMatchObject({ monitor: "Monitor A", institucion: "IE 001", estado: "final" });
    expect(table.rows[0]?.fecha).toBeInstanceOf(Date);
  });
});
