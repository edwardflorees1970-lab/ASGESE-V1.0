import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { DashboardPanel, EmptyChart } from "../dashboard/DashboardWidgets";
import { exportChartElementAsPng } from "../../lib/chartImageExport";
import { EXECUTIVE_CHART, EXECUTIVE_CHART_COLORS } from "../../lib/designSystem";
import type { CrossItem, MatrixItem, QuestionDistribution, SeriesItem } from "../../lib/analyticsReportsApi";

const COLORS = EXECUTIVE_CHART_COLORS;
const percentFormat = new Intl.NumberFormat("es-PE", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

type DisplaySeriesItem = SeriesItem & { percentage: number; display: string; valueLabel: string };

function shortLabel(value: string, max = 32) {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function withPercentages(data: SeriesItem[]): DisplaySeriesItem[] {
  const total = data.reduce((sum, item) => sum + Number(item.value), 0);
  return data.map((item) => {
    const percentage = "percentage" in item && typeof item.percentage === "number"
      ? item.percentage
      : total ? Number(item.value) * 100 / total : 0;
    return {
      ...item,
      percentage,
      display: shortLabel(item.label),
      valueLabel: `${Number(item.value).toLocaleString("es-PE")} · ${percentFormat.format(percentage)}%`,
    };
  });
}

function SeriesTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ payload?: DisplaySeriesItem; color?: string; name?: string; value?: number }>;
  label?: string | number;
}) {
  if (!active || !payload?.length) return null;
  const item = payload[0]?.payload;
  return (
    <div className="dashboard-chart-tooltip min-w-44 rounded-xl border border-white/10 px-3 py-2 shadow-2xl">
      <div className="mb-1.5 text-[11px] font-semibold text-white/70">{item?.label ?? label}</div>
      <div className="flex items-center justify-between gap-4 text-xs">
        <span className="text-white/55">Cantidad</span>
        <strong>{Number(item?.value ?? 0).toLocaleString("es-PE")}</strong>
      </div>
      <div className="mt-1 flex items-center justify-between gap-4 text-xs">
        <span className="text-white/55">Porcentaje</span>
        <strong>{percentFormat.format(item?.percentage ?? 0)}%</strong>
      </div>
    </div>
  );
}

export function ReportVisualActions({ onView, onImage }: { onView: () => void; onImage: () => void }) {
  return (
    <div data-export-ignore="true" className="flex shrink-0 gap-1.5 print:hidden">
      <button type="button" onClick={onView} className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-[11px] font-semibold text-white/70 hover:bg-white/10">Ver</button>
      <button type="button" onClick={onImage} className="rounded-lg border border-cyan-300/20 bg-cyan-300/10 px-2.5 py-1.5 text-[11px] font-semibold text-cyan-100 hover:bg-cyan-300/15">PNG</button>
    </div>
  );
}

export function ReportVisualModal({ title, onClose, children, details, autoExport = false, onAutoExported, wide = false }: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  details?: ReactNode;
  autoExport?: boolean;
  onAutoExported?: () => void;
  wide?: boolean;
}) {
  const exportRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const exportImage = async () => {
    if (!exportRef.current || exporting) return;
    setExporting(true);
    setExportError(null);
    try { await exportChartElementAsPng(exportRef.current, title); }
    catch (error) { setExportError(error instanceof Error ? error.message : "No se pudo exportar la imagen."); }
    finally { setExporting(false); onAutoExported?.(); }
  };

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", close);
    return () => { document.body.style.overflow = previous; window.removeEventListener("keydown", close); };
  }, [onClose]);

  useEffect(() => {
    if (!autoExport || !exportRef.current) return;
    const frame = window.requestAnimationFrame(() => { void exportImage(); });
    return () => window.cancelAnimationFrame(frame);
    // La exportación se dispara sólo cuando el modal termina de montar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoExport]);

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={title} className="report-visual-modal fixed inset-0 z-[2147482000] bg-slate-950/90 p-2 backdrop-blur-md sm:p-5">
      <div className={`mx-auto flex max-h-[calc(100dvh-1rem)] w-full flex-col overflow-hidden rounded-2xl border border-white/15 bg-[var(--app-surface)] shadow-2xl sm:max-h-[calc(100dvh-2.5rem)] ${wide ? "max-w-[1500px]" : "max-w-5xl"}`}>
        <header data-export-ignore="true" className="report-modal-header flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3 sm:px-6">
          <h2 className="min-w-0 flex-1 text-sm font-semibold text-white sm:text-lg">{title}</h2>
          <div className="flex shrink-0 gap-2">
            <button type="button" disabled={exporting} onClick={() => void exportImage()} className="rounded-lg border border-cyan-300/25 bg-cyan-300/10 px-3 py-2 text-xs font-semibold text-cyan-100 disabled:opacity-50">{exporting ? "Generando…" : "Exportar PNG"}</button>
            <button type="button" onClick={onClose} className="rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-white/75">Cerrar</button>
          </div>
        </header>
        {exportError && <div role="alert" className="mx-3 mt-3 rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs text-red-100 sm:mx-6">{exportError}</div>}
        <div className="min-h-0 flex-1 overflow-auto p-3 sm:p-6">
          <div ref={exportRef} className="report-image-surface rounded-xl bg-[var(--app-surface)] p-2 sm:p-4">
            <h2 data-export-only="true" className="mb-4 hidden text-lg font-semibold text-white">{title}</h2>
            {children}
            {details && <div className="chart-static-details mt-4 sm:mt-5">{details}</div>}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function StaticSeriesDetails({ data }: { data: DisplaySeriesItem[] }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {data.map((item, index) => (
        <div key={`${item.label}-${index}`} className="rounded-xl border border-white/10 bg-white/[0.035] p-3 text-xs">
          <div className="truncate text-white/55" title={item.label}>{item.label}</div>
          <div className="mt-1 flex items-baseline justify-between gap-3"><strong className="text-base text-white">{Number(item.value).toLocaleString("es-PE")}</strong><span className="font-semibold text-cyan-200">{percentFormat.format(item.percentage)}%</span></div>
        </div>
      ))}
    </div>
  );
}

function SeriesBarChart({ data, horizontal, expanded = false }: { data: DisplaySeriesItem[]; horizontal: boolean; expanded?: boolean }) {
  const height = horizontal
    ? Math.min(expanded ? 960 : 720, Math.max(expanded ? 260 : 230, data.length * (expanded ? 46 : 36) + 90))
    : Math.min(expanded ? 560 : 440, Math.max(expanded ? 300 : 260, 250 + data.length * (expanded ? 22 : 16)));
  return (
    <div style={{ height }} className="min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout={horizontal ? "vertical" : "horizontal"} margin={{ top: 28, right: expanded ? 38 : 22, bottom: horizontal ? 8 : 72, left: horizontal ? (expanded ? 70 : 30) : 0 }}>
          <CartesianGrid stroke={EXECUTIVE_CHART.grid} strokeDasharray="3 3" horizontal={!horizontal} vertical={horizontal} />
          {horizontal ? <>
            <XAxis type="number" domain={[0, (maximum: number) => Math.max(1, Math.ceil(maximum * 1.22))]} tick={{ fill: "#94a3b8", fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="display" interval={0} minTickGap={0} width={expanded ? 200 : 145} tick={{ fill: "#cbd5e1", fontSize: expanded ? 12 : 10 }} axisLine={false} tickLine={false} />
          </> : <>
            <XAxis dataKey="display" interval={0} minTickGap={0} angle={-35} textAnchor="end" height={78} tick={{ fill: "#94a3b8", fontSize: expanded ? 11 : 9 }} axisLine={false} tickLine={false} />
            <YAxis domain={[0, (maximum: number) => Math.max(1, Math.ceil(maximum * 1.18))]} tick={{ fill: "#94a3b8", fontSize: 10 }} axisLine={false} tickLine={false} />
          </>}
          <Tooltip content={<SeriesTooltip />} />
          <Bar isAnimationActive={false} dataKey="value" name="Cantidad" fill={EXECUTIVE_CHART.primary} radius={horizontal ? [0, 5, 5, 0] : [5, 5, 0, 0]} maxBarSize={expanded ? 34 : 28}>
            <LabelList dataKey="valueLabel" position={horizontal ? "right" : "top"} fill="#e2e8f0" fontSize={expanded ? 11 : 9} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function BarSeriesPanel({ title, description, data, horizontal = true, limit }: {
  title: string; description?: string; data: SeriesItem[]; horizontal?: boolean; limit?: number;
}) {
  const visible = useMemo(() => withPercentages(limit ? data.slice(0, limit) : data), [data, limit]);
  const [expanded, setExpanded] = useState(false);
  const [autoExport, setAutoExport] = useState(false);
  const openForExport = () => { setAutoExport(true); setExpanded(true); };
  return (
    <>
      <DashboardPanel title={title} description={description} action={<ReportVisualActions onView={() => setExpanded(true)} onImage={openForExport} />}>
        <div data-export-expand="true" role="img" aria-label={`${title}. Gráfico de barras con ${visible.length} categorías.`} className="mt-4 max-h-[32rem] min-w-0 overflow-y-auto overflow-x-hidden">
          {!visible.length ? <EmptyChart /> : <SeriesBarChart data={visible} horizontal={horizontal} />}
        </div>
      </DashboardPanel>
      {expanded && <ReportVisualModal title={title} wide={visible.length > 10} autoExport={autoExport} onAutoExported={() => setAutoExport(false)} onClose={() => { setExpanded(false); setAutoExport(false); }} details={<StaticSeriesDetails data={visible} />}>
        {!visible.length ? <EmptyChart /> : <SeriesBarChart data={visible} horizontal={horizontal} expanded />}
      </ReportVisualModal>}
    </>
  );
}

function SeriesPieChart({ data, expanded = false }: { data: DisplaySeriesItem[]; expanded?: boolean }) {
  const renderLabel = ({ cx = 0, cy = 0, midAngle = 0, innerRadius = 0, outerRadius = 0, payload }: { cx?: number; cy?: number; midAngle?: number; innerRadius?: number; outerRadius?: number; payload?: DisplaySeriesItem }) => {
    if (!payload) return null;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.58;
    const radians = -midAngle * Math.PI / 180;
    const x = cx + radius * Math.cos(radians);
    const y = cy + radius * Math.sin(radians);
    return <text x={x} y={y} fill="#fff" textAnchor="middle" dominantBaseline="central" fontSize={expanded ? 11 : 9} fontWeight={700}><tspan x={x} dy="-0.35em">{payload.value.toLocaleString("es-PE")}</tspan><tspan x={x} dy="1.2em">{percentFormat.format(payload.percentage)}%</tspan></text>;
  };
  return (
    <div style={{ height: expanded ? Math.min(500, Math.max(330, 300 + data.length * 18)) : 320 }}>
      <ResponsiveContainer width="100%" height="100%"><PieChart>
        <Pie isAnimationActive={false} data={data} dataKey="value" nameKey="label" cx="50%" cy="45%" outerRadius={expanded ? 150 : 92} innerRadius={expanded ? 70 : 42} paddingAngle={2} label={renderLabel} labelLine={false}>
          {data.map((item, index) => <Cell key={`${item.label}-${index}`} fill={COLORS[index % COLORS.length]} />)}
        </Pie>
        <Tooltip content={<SeriesTooltip />} />
        <Legend formatter={(value) => shortLabel(String(value), expanded ? 34 : 20)} wrapperStyle={{ fontSize: expanded ? 13 : 11 }} />
      </PieChart></ResponsiveContainer>
    </div>
  );
}

export function PieSeriesPanel({ title, description, data }: { title: string; description?: string; data: SeriesItem[] }) {
  const visible = useMemo(() => withPercentages(data), [data]);
  const [expanded, setExpanded] = useState(false);
  const [autoExport, setAutoExport] = useState(false);
  const openForExport = () => { setAutoExport(true); setExpanded(true); };
  return <>
    <DashboardPanel title={title} description={description} action={<ReportVisualActions onView={() => setExpanded(true)} onImage={openForExport} />}>
      <div role="img" aria-label={`${title}. Gráfico circular con ${visible.length} categorías.`} className="mt-4 min-w-0">{!visible.length ? <EmptyChart /> : <SeriesPieChart data={visible} />}</div>
    </DashboardPanel>
    {expanded && <ReportVisualModal title={title} autoExport={autoExport} onAutoExported={() => setAutoExport(false)} onClose={() => { setExpanded(false); setAutoExport(false); }} details={<StaticSeriesDetails data={visible} />}>
      {!visible.length ? <EmptyChart /> : <SeriesPieChart data={visible} expanded />}
    </ReportVisualModal>}
  </>;
}

export function QuestionsConsolidatedPanel({ questions }: { questions: QuestionDistribution[] }) {
  const answers = useMemo(() => Array.from(new Set(questions.flatMap((question) => question.distribution.map((item) => item.label)))), [questions]);
  const rows = useMemo(() => questions.map((question) => {
    const values = question.distribution.flatMap((item) => [
      [item.label, item.percentage],
      [`${item.label}__label`, `${percentFormat.format(item.percentage)}% · ${item.value.toLocaleString("es-PE")}`],
    ]);
    return { label: `Ítem ${question.question_order} · ${question.axis}`, question: question.question_text, ...Object.fromEntries(values) };
  }), [questions]);
  const [expanded, setExpanded] = useState(false);
  const [autoExport, setAutoExport] = useState(false);
  const chart = (isExpanded: boolean) => {
    const height = Math.min(isExpanded ? 980 : 760, Math.max(isExpanded ? 300 : 280, rows.length * (isExpanded ? 58 : 48) + 100));
    return <div style={{ height }}><ResponsiveContainer width="100%" height="100%"><BarChart data={rows} layout="vertical" margin={{ top: 12, left: isExpanded ? 36 : 8, right: isExpanded ? 125 : 105, bottom: 30 }}><CartesianGrid stroke="rgba(148,163,184,.12)" strokeDasharray="3 3" /><XAxis type="number" domain={[0, 112]} unit="%" tick={{ fill: "#94a3b8", fontSize: 10 }} /><YAxis type="category" dataKey="label" interval={0} width={isExpanded ? 112 : 82} tick={{ fill: "#cbd5e1", fontSize: 10 }} /><Tooltip formatter={(value, name) => [`${percentFormat.format(Number(value))}%`, String(name)]} labelFormatter={(label, payload) => String(payload?.[0]?.payload?.question ?? label)} /><Legend />{answers.map((answer, index) => <Bar isAnimationActive={false} key={answer} dataKey={answer} fill={COLORS[index % COLORS.length]} maxBarSize={24}><LabelList dataKey={`${answer}__label`} position="right" fill="#e2e8f0" fontSize={isExpanded ? 11 : 9} /></Bar>)}</BarChart></ResponsiveContainer></div>;
  };
  const details = <div className="space-y-2">{questions.map((question) => <div key={`${question.question_id}-${question.axis}`} className="rounded-xl border border-white/10 bg-white/[0.035] p-3 text-xs"><div className="font-medium text-white/80">Ítem {question.question_order}: {question.question_text}</div><div className="mt-2 flex flex-wrap gap-2">{question.distribution.map((item) => <span key={item.label} className="rounded-lg bg-white/5 px-2 py-1 text-white/60">{item.label}: <strong className="text-cyan-200">{percentFormat.format(item.percentage)}%</strong> ({item.value})</span>)}</div></div>)}</div>;
  const openForExport = () => { setAutoExport(true); setExpanded(true); };
  return <>
    <DashboardPanel title="Consolidado de resultados por pregunta" description="Todas las preguntas y sus porcentajes por alternativa" action={<ReportVisualActions onView={() => setExpanded(true)} onImage={openForExport} />}><div data-export-expand="true" className="mt-4 max-h-[42rem] overflow-y-auto overflow-x-hidden">{rows.length ? chart(false) : <EmptyChart />}</div></DashboardPanel>
    {expanded && <ReportVisualModal title="Consolidado de resultados por pregunta" wide autoExport={autoExport} onAutoExported={() => setAutoExport(false)} onClose={() => { setExpanded(false); setAutoExport(false); }} details={details}>{chart(true)}</ReportVisualModal>}
  </>;
}

export function CrossMatrixTable({ title, rows, rowKey }: { title: string; rows: CrossItem[]; rowKey: "monitor" | "rei" }) {
  const matrix = useMemo(() => { const columns = Array.from(new Set(rows.map((row) => row.nivel))).sort((a, b) => a.localeCompare(b, "es")); const byLabel = new Map<string, Record<string, number>>(); rows.forEach((row) => { const label = String(row[rowKey] ?? "Sin dato"); const current = byLabel.get(label) ?? {}; current[row.nivel] = (current[row.nivel] ?? 0) + Number(row.value); byLabel.set(label, current); }); return { columns, rows: Array.from(byLabel.entries()).map(([label, values]) => ({ label, values, total: Object.values(values).reduce((sum, value) => sum + value, 0) })) }; }, [rowKey, rows]);
  const labelWidth = Math.min(280, Math.max(rowKey === "monitor" ? 180 : 72, ...matrix.rows.map((row) => row.label.length * 7)));
  const expandedWidth = Math.min(1100, labelWidth + (matrix.columns.length + 1) * 96);
  const [expanded, setExpanded] = useState(false);
  const [autoExport, setAutoExport] = useState(false);
  const table = (large: boolean) => <div className={`overflow-auto rounded-xl border border-white/10 ${large ? "flex justify-center" : "max-h-96"}`}><table style={large ? { width: `${expandedWidth}px`, maxWidth: "100%" } : undefined} className={`${large ? "table-auto" : "w-full min-w-[560px]"} text-left text-[10px] sm:text-xs`}><thead className="sticky top-0 bg-slate-950 text-white/55"><tr><th style={large ? { width: labelWidth } : undefined} className="px-2.5 py-2">{rowKey === "monitor" ? "Monitor" : "REI"}</th>{matrix.columns.map((column) => <th key={column} className="px-2.5 py-2 text-right">{column}</th>)}<th className="px-2.5 py-2 text-right">Total</th></tr></thead><tbody>{matrix.rows.map((row) => <tr key={row.label} className="border-t border-white/10"><td className={`${large ? "whitespace-normal" : "max-w-64 truncate"} px-2.5 py-2`} title={row.label}>{row.label}</td>{matrix.columns.map((column) => <td key={column} className="px-2.5 py-2 text-right text-white/70">{row.values[column] ?? 0}</td>)}<td className="px-2.5 py-2 text-right font-semibold">{row.total}</td></tr>)}</tbody></table></div>;
  const openForExport = () => { setAutoExport(true); setExpanded(true); };
  return <>
    <DashboardPanel title={title} action={<ReportVisualActions onView={() => setExpanded(true)} onImage={openForExport} />}><div className="mt-4">{table(false)}</div></DashboardPanel>
    {expanded && <ReportVisualModal title={title} wide={expandedWidth > 900} autoExport={autoExport} onAutoExported={() => setAutoExport(false)} onClose={() => { setExpanded(false); setAutoExport(false); }}>{table(true)}</ReportVisualModal>}
  </>;
}

export function ResponseMatrixTable({ title, rows, limit = 100 }: { title: string; rows: MatrixItem[]; limit?: number }) {
  const matrix = useMemo(() => { const columnKey = (row: MatrixItem) => row.axis === "respuesta" || row.axis === "opcion" ? row.response : `${row.axis}: ${row.response}`; const columns = Array.from(new Set(rows.map(columnKey))).sort((a, b) => a.localeCompare(b, "es")); const byLabel = new Map<string, Record<string, number>>(); rows.forEach((row) => { const current = byLabel.get(row.label) ?? {}; current[columnKey(row)] = row.percentage; byLabel.set(row.label, current); }); return { columns, rows: Array.from(byLabel.entries()).slice(0, limit) }; }, [limit, rows]);
  const labelWidth = Math.min(320, Math.max(190, ...matrix.rows.map(([label]) => label.length * 7)));
  const answerWidths = matrix.columns.map((column) => Math.min(180, Math.max(84, column.length * 7 + 28)));
  const expandedWidth = Math.min(1200, labelWidth + answerWidths.reduce((sum, width) => sum + width, 0));
  const [expanded, setExpanded] = useState(false);
  const [autoExport, setAutoExport] = useState(false);
  const table = (large: boolean) => <div className={`overflow-auto rounded-xl border border-white/10 ${large ? "flex justify-center" : "max-h-96"}`}><table style={large ? { width: `${expandedWidth}px`, maxWidth: "100%" } : undefined} className={`${large ? "table-auto" : "w-full min-w-[520px]"} text-left text-[10px] sm:text-xs`}><thead className="sticky top-0 bg-slate-950 text-white/55"><tr><th style={large ? { width: labelWidth } : undefined} className="px-2.5 py-2">Dimensión</th>{matrix.columns.map((column, index) => <th key={column} style={large ? { width: answerWidths[index] } : undefined} className="px-2.5 py-2 text-right">{column}</th>)}</tr></thead><tbody>{matrix.rows.map(([label, values]) => <tr key={label} className="border-t border-white/10"><td className={`${large ? "whitespace-normal" : "max-w-72 truncate"} px-2.5 py-2`} title={label}>{label}</td>{matrix.columns.map((column) => <td key={column} className="px-2.5 py-2 text-right text-white/70">{values[column] === undefined ? "—" : `${values[column].toFixed(1)} %`}</td>)}</tr>)}</tbody></table></div>;
  const openForExport = () => { setAutoExport(true); setExpanded(true); };
  return <>
    <DashboardPanel title={title} action={<ReportVisualActions onView={() => setExpanded(true)} onImage={openForExport} />}><div className="mt-4">{table(false)}</div></DashboardPanel>
    {expanded && <ReportVisualModal title={title} wide={expandedWidth > 900} autoExport={autoExport} onAutoExported={() => setAutoExport(false)} onClose={() => { setExpanded(false); setAutoExport(false); }}>{table(true)}</ReportVisualModal>}
  </>;
}
