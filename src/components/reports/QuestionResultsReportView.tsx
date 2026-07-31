import { DashboardPanel, KpiCard } from "../dashboard/DashboardWidgets";
import type { QuestionResultsReport } from "../../lib/analyticsReportsApi";
import { BarSeriesPanel, PieSeriesPanel, QuestionsConsolidatedPanel, ResponseMatrixTable } from "./ReportCharts";

const format = new Intl.NumberFormat("es-PE");

export function QuestionResultsReportView({ report }: { report: QuestionResultsReport }) {
  const primary = report.questions[0];
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <KpiCard label="Fichas consideradas" value={format.format(report.kpis.run_count)} detail="Registros reales según filtros" icon="activity" />
        <KpiCard label="Preguntas analizadas" value={format.format(report.kpis.question_count)} detail="Preguntas con respuesta válida" icon="target" tone="violet" />
        <KpiCard label="Respuestas" value={format.format(report.kpis.answer_count)} detail="Respuestas únicas; opción múltiple no duplica este KPI" icon="check" tone="emerald" />
      </div>

      {primary && (
        <div className="grid gap-4 2xl:grid-cols-[1fr_1.2fr]">
          <DashboardPanel title="Pregunta seleccionada" description={`${primary.question_type} · ${primary.axis}`}>
            <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-5 text-base leading-7 text-white/85">{primary.question_text}</div>
          </DashboardPanel>
          <PieSeriesPanel title="Porcentaje de respuesta" description={`${primary.total} respuestas válidas`} data={primary.distribution} />
        </div>
      )}

      <QuestionsConsolidatedPanel questions={report.questions} />

      <div className="grid gap-4 2xl:grid-cols-2">
        {report.questions.slice(0, 12).map((question) => (
          <BarSeriesPanel key={`${question.question_id}-${question.axis}`} title={`Ítem ${question.question_order}: ${question.question_text}`} description={`Dimensión: ${question.axis} · Base: ${question.total}`} data={question.distribution} horizontal={false} limit={12} />
        ))}
      </div>

      <div className="grid gap-4 2xl:grid-cols-2">
        <ResponseMatrixTable title="Matriz de resultados por institución" rows={report.by_institution} />
        <ResponseMatrixTable title="Matriz de resultados por REI" rows={report.by_rei} />
        <ResponseMatrixTable title="Matriz de resultados por distrito" rows={report.by_district} />
        <ResponseMatrixTable title="Matriz de resultados por nivel" rows={report.by_level} />
      </div>
    </div>
  );
}
