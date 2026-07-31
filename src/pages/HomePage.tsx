import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { supabase } from "../lib/supabaseClient";
import { useAppConfig } from "../app/AppConfigProvider";
import { roleLabel } from "../lib/roles";
import {
  ChartTooltip,
  DashboardIcon,
  DashboardPanel,
  DashboardSelect,
  EmptyChart,
  KpiCard,
  SearchableFilter,
} from "../components/dashboard/DashboardWidgets";

type RunRow = {
  id: string;
  status: string;
  created_by: string;
  created_at: string;
  template_id?: string;
};

type ProfileRow = {
  id: string;
  role: "admin" | "user" | string;
  nombres: string | null;
  apellido_paterno: string | null;
  apellido_materno: string | null;
  correo: string | null;
  email: string | null;
};

type FichaRow = {
  id: string;
  codigo: string;
  monitoreo_id: string;
  form_template_id?: string | null;
};

type MonitoreoRow = {
  id: string;
  codigo: string;
  nombre: string;
  anio: number;
  is_active: boolean;
};

const MONTHS = [
  { value: "ALL", label: "Todo el año", short: "Año" },
  { value: "1", label: "Enero", short: "Ene" },
  { value: "2", label: "Febrero", short: "Feb" },
  { value: "3", label: "Marzo", short: "Mar" },
  { value: "4", label: "Abril", short: "Abr" },
  { value: "5", label: "Mayo", short: "May" },
  { value: "6", label: "Junio", short: "Jun" },
  { value: "7", label: "Julio", short: "Jul" },
  { value: "8", label: "Agosto", short: "Ago" },
  { value: "9", label: "Septiembre", short: "Sep" },
  { value: "10", label: "Octubre", short: "Oct" },
  { value: "11", label: "Noviembre", short: "Nov" },
  { value: "12", label: "Diciembre", short: "Dic" },
] as const;

const STATUS_COLORS = ["#22d3ee", "#34d399", "#f59e0b", "#a78bfa", "#64748b"];
const RUN_PAGE_SIZE = 1000;
const formatter = new Intl.NumberFormat("es-PE");

function isFinalStatus(status: string) {
  return ["final", "finalizado", "completado", "completed"].includes(status.toLowerCase());
}

function statusLabel(status: string) {
  const normalized = status.toLowerCase();
  if (isFinalStatus(normalized)) return "Finalizada";
  if (["draft", "borrador", "guardado"].includes(normalized)) return "Guardada";
  if (["en_proceso", "proceso", "in_progress"].includes(normalized)) return "En proceso";
  return status.replaceAll("_", " ");
}

function fmtDateShort(iso: string) {
  try {
    return new Intl.DateTimeFormat("es-PE", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "America/Lima",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function userName(profile?: ProfileRow) {
  if (!profile) return "Usuario";
  return (
    [profile.apellido_paterno, profile.apellido_materno, profile.nombres]
      .filter(Boolean)
      .join(" ")
      .trim() ||
    profile.correo ||
    profile.email ||
    "Usuario"
  );
}

export function HomePage() {
  const { isTestMode } = useAppConfig();
  const now = new Date();
  const [year, setYear] = useState(String(now.getFullYear()));
  const [month, setMonth] = useState("ALL");
  const [monitoreo, setMonitoreo] = useState("ALL");
  const [rankingQuery, setRankingQuery] = useState("");

  const [years, setYears] = useState<string[]>([]);
  const [monitoreos, setMonitoreos] = useState<MonitoreoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const [runs, setRuns] = useState<RunRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProfileRow>>({});
  const [fichasByTemplate, setFichasByTemplate] = useState<Record<string, FichaRow>>({});
  const [monById, setMonById] = useState<Record<string, MonitoreoRow>>({});

  useEffect(() => {
    let alive = true;
    void (async () => {
      const { data, error } = await supabase
        .from("monitoreo_catalog")
        .select("anio")
        .order("anio", { ascending: false });
      if (!alive || error) return;
      const availableYears = Array.from(new Set((data ?? []).map((row) => String(row.anio))));
      setYears(availableYears);
      setYear((current) => availableYears.length && !availableYears.includes(current) ? availableYears[0] : current);
    })();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const { data, error } = await supabase
        .from("monitoreo_catalog")
        .select("id, codigo, nombre, anio, is_active")
        .eq("anio", Number(year))
        .eq("is_active", true)
        .order("nombre", { ascending: true });
      if (!alive || error) return;
      const rows = (data ?? []) as MonitoreoRow[];
      setMonitoreos(rows);
      setMonitoreo((current) => current !== "ALL" && !rows.some((item) => item.codigo === current) ? "ALL" : current);
    })();
    return () => { alive = false; };
  }, [year]);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        setLoading(true);
        setErr(null);

        const selectedYear = Number(year);
        const selectedMonth = month === "ALL" ? null : Number(month);
        const start = selectedMonth ? new Date(selectedYear, selectedMonth - 1, 1) : new Date(selectedYear, 0, 1);
        const end = selectedMonth ? new Date(selectedYear, selectedMonth, 1) : new Date(selectedYear + 1, 0, 1);

        let templateIdsByMonitoreo: string[] | null = null;
        if (monitoreo !== "ALL") {
          const selected = monitoreos.find((item) => item.codigo === monitoreo);
          if (selected) {
            const { data, error } = await supabase
              .from("ficha_catalog")
              .select("form_template_id")
              .eq("monitoreo_id", selected.id);
            if (error) throw new Error(error.message);
            templateIdsByMonitoreo = (data ?? [])
              .map((item) => item.form_template_id as string | null)
              .filter((value): value is string => Boolean(value));
          } else {
            templateIdsByMonitoreo = [];
          }
        }

        const runRows: RunRow[] = [];
        if (!templateIdsByMonitoreo || templateIdsByMonitoreo.length > 0) {
          for (let from = 0; alive; from += RUN_PAGE_SIZE) {
            let query = supabase
              .from("form_run")
              .select("id, status, created_by, created_at, template_id")
              .gte("created_at", start.toISOString())
              .lt("created_at", end.toISOString())
              .eq("is_test", isTestMode)
              .neq("status", "borrador")
              .order("created_at", { ascending: false })
              .range(from, from + RUN_PAGE_SIZE - 1);

            if (templateIdsByMonitoreo) query = query.in("template_id", templateIdsByMonitoreo);
            const { data, error } = await query;
            if (error) throw new Error(error.message);
            const page = (data ?? []) as RunRow[];
            runRows.push(...page);
            if (page.length < RUN_PAGE_SIZE) break;
          }
        }
        if (!alive) return;

        const templateIds = Array.from(new Set(runRows.map((run) => run.template_id).filter((id): id is string => Boolean(id))));
        const userIds = Array.from(new Set(runRows.map((run) => run.created_by)));

        const [fichasResult, profilesResult] = await Promise.all([
          templateIds.length
            ? supabase.from("ficha_catalog").select("id, codigo, monitoreo_id, form_template_id").in("form_template_id", templateIds)
            : Promise.resolve({ data: [], error: null }),
          userIds.length
            ? supabase.from("profiles").select("id, role, nombres, apellido_paterno, apellido_materno, correo, email").in("id", userIds)
            : Promise.resolve({ data: [], error: null }),
        ]);
        if (fichasResult.error) throw new Error(fichasResult.error.message);
        if (profilesResult.error) throw new Error(profilesResult.error.message);

        const fichaRows = (fichasResult.data ?? []) as FichaRow[];
        const monitoreoIds = Array.from(new Set(fichaRows.map((ficha) => ficha.monitoreo_id)));
        const monResult = monitoreoIds.length
          ? await supabase.from("monitoreo_catalog").select("id, codigo, nombre, anio, is_active").in("id", monitoreoIds)
          : { data: [], error: null };
        if (monResult.error) throw new Error(monResult.error.message);
        if (!alive) return;

        const fichaMap: Record<string, FichaRow> = {};
        fichaRows.forEach((ficha) => { if (ficha.form_template_id) fichaMap[ficha.form_template_id] = ficha; });
        const profileMap: Record<string, ProfileRow> = {};
        ((profilesResult.data ?? []) as ProfileRow[]).forEach((profile) => { profileMap[profile.id] = profile; });
        const monitoreoMap: Record<string, MonitoreoRow> = {};
        ((monResult.data ?? []) as MonitoreoRow[]).forEach((item) => { monitoreoMap[item.id] = item; });

        setRuns(runRows);
        setFichasByTemplate(fichaMap);
        setProfiles(profileMap);
        setMonById(monitoreoMap);
        setLastUpdated(new Date());
      } catch (error: unknown) {
        if (!alive) return;
        setErr(error instanceof Error ? error.message : "No se pudo cargar el Dashboard.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [year, month, monitoreo, monitoreos, isTestMode]);

  const analytics = useMemo(() => {
    const statusMap = new Map<string, number>();
    const userMap = new Map<string, number>();
    const roleMap = new Map<string, number>();
    const monitoreoMap = new Map<string, { total: number; finalizadas: number; proceso: number }>();
    const bucketMap = new Map<string, { total: number; finalizadas: number }>();

    const selectedMonth = month === "ALL" ? null : Number(month);
    if (selectedMonth) {
      for (let week = 1; week <= 5; week += 1) bucketMap.set(`Sem ${week}`, { total: 0, finalizadas: 0 });
    } else {
      MONTHS.slice(1).forEach((item) => bucketMap.set(item.short, { total: 0, finalizadas: 0 }));
    }

    let finalizadas = 0;
    runs.forEach((run) => {
      const normalizedStatus = statusLabel(run.status);
      statusMap.set(normalizedStatus, (statusMap.get(normalizedStatus) ?? 0) + 1);
      userMap.set(run.created_by, (userMap.get(run.created_by) ?? 0) + 1);
      if (isFinalStatus(run.status)) finalizadas += 1;

      const ficha = run.template_id ? fichasByTemplate[run.template_id] : undefined;
      const mon = ficha ? monById[ficha.monitoreo_id] : undefined;
      const monName = mon?.nombre ?? "Sin monitoreo asociado";
      const monMetric = monitoreoMap.get(monName) ?? { total: 0, finalizadas: 0, proceso: 0 };
      monMetric.total += 1;
      if (isFinalStatus(run.status)) monMetric.finalizadas += 1;
      else monMetric.proceso += 1;
      monitoreoMap.set(monName, monMetric);

      const createdAt = new Date(run.created_at);
      const bucket = selectedMonth
        ? `Sem ${Math.min(5, Math.ceil(createdAt.getDate() / 7))}`
        : MONTHS[createdAt.getMonth() + 1]?.short;
      if (bucket) {
        const metric = bucketMap.get(bucket) ?? { total: 0, finalizadas: 0 };
        metric.total += 1;
        if (isFinalStatus(run.status)) metric.finalizadas += 1;
        bucketMap.set(bucket, metric);
      }
    });

    Object.values(profiles).forEach((profile) => roleMap.set(profile.role, (roleMap.get(profile.role) ?? 0) + 1));

    const total = runs.length;
    const proceso = total - finalizadas;
    const userCount = userMap.size;
    const completionRate = total ? Math.round((finalizadas / total) * 100) : 0;
    const monitoringData = Array.from(monitoreoMap.entries())
      .map(([name, value]) => ({ name, shortName: name.length > 26 ? `${name.slice(0, 24)}…` : name, ...value }))
      .sort((a, b) => b.total - a.total);
    const trendData = Array.from(bucketMap.entries()).map(([periodo, value]) => ({ periodo, ...value }));
    const statusData = Array.from(statusMap.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
    const userRanking = Array.from(userMap.entries())
      .map(([id, count]) => ({ id, count, name: userName(profiles[id]), role: roleLabel(profiles[id]?.role) }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "es"));
    const roleData = Array.from(roleMap.entries()).map(([role, count]) => ({ role: roleLabel(role), count })).sort((a, b) => b.count - a.count);
    const peak = trendData.reduce((best, item) => item.total > best.total ? item : best, { periodo: "—", total: 0, finalizadas: 0 });
    const previousBucket = trendData.at(-2)?.total ?? 0;
    const currentBucket = trendData.at(-1)?.total ?? 0;
    const trendPercent = previousBucket ? Math.round(((currentBucket - previousBucket) / previousBucket) * 100) : currentBucket ? 100 : 0;

    return {
      total,
      finalizadas,
      proceso,
      userCount,
      completionRate,
      monitoringData,
      trendData,
      statusData,
      userRanking,
      roleData,
      peak,
      trendPercent,
      averagePerUser: userCount ? total / userCount : 0,
    };
  }, [runs, profiles, fichasByTemplate, monById, month]);

  const visibleRanking = useMemo(() => {
    const query = rankingQuery.trim().toLocaleLowerCase("es");
    const filtered = query
      ? analytics.userRanking.filter((item) => `${item.name} ${item.role}`.toLocaleLowerCase("es").includes(query))
      : analytics.userRanking;
    return filtered.slice(0, query ? 10 : 5);
  }, [analytics.userRanking, rankingQuery]);

  const selectedMonthLabel = MONTHS.find((item) => item.value === month)?.label ?? "Todo el año";
  const selectedMonitoreoLabel = monitoreo === "ALL" ? "Todos los monitoreos" : monitoreos.find((item) => item.codigo === monitoreo)?.nombre ?? monitoreo;
  const monitoreoOptions = useMemo(() => monitoreos.map((item) => ({ value: item.codigo, label: item.nombre })), [monitoreos]);
  const hasFilters = month !== "ALL" || monitoreo !== "ALL";
  const topMonitoreo = analytics.monitoringData[0];

  return (
    <div className="dashboard-shell min-w-0 pb-6 text-white">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.13em] text-cyan-200">Business Intelligence</span>
            <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold ${isTestMode ? "border-amber-400/20 bg-amber-400/10 text-amber-200" : "border-emerald-400/20 bg-emerald-400/10 text-emerald-200"}`}>{isTestMode ? "Entorno de prueba" : "Datos de producción"}</span>
          </div>
          <h1 className="mt-3 text-2xl font-semibold tracking-[-0.035em] text-white sm:text-3xl">Dashboard ejecutivo</h1>
          <p className="mt-1.5 max-w-2xl text-sm leading-6 text-white/50">Seguimiento consolidado de fichas, avance operativo y participación de usuarios.</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-white/40">
          <span className={`h-2 w-2 rounded-full ${loading ? "animate-pulse bg-amber-400" : "bg-emerald-400"}`} />
          {loading ? "Actualizando indicadores…" : lastUpdated ? `Actualizado ${lastUpdated.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" })}` : "Listo"}
        </div>
      </header>

      <section className="dashboard-panel mt-5 rounded-2xl p-4 sm:p-5" aria-label="Filtros del Dashboard">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-white"><DashboardIcon name="filter" className="h-4 w-4 text-cyan-300" />Filtros de análisis</div>
            <div className="mt-1 text-xs text-white/40">Los gráficos se actualizan automáticamente.</div>
          </div>
          {hasFilters && <button type="button" onClick={() => { setMonth("ALL"); setMonitoreo("ALL"); }} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-white/60 transition hover:border-white/20 hover:bg-white/5 hover:text-white">Limpiar filtros</button>}
        </div>
        <div className="grid items-end gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(140px,0.7fr)_minmax(180px,0.9fr)_minmax(260px,1.8fr)_auto]">
          <DashboardSelect label="Año" value={year} options={(years.length ? years : [year]).map((item) => ({ value: item, label: item }))} onChange={setYear} />
          <DashboardSelect label="Periodo" value={month} options={MONTHS} onChange={setMonth} />
          <SearchableFilter label="Monitoreo" value={monitoreo} options={monitoreoOptions} allLabel="Todos los monitoreos" onChange={setMonitoreo} />
          <div className="flex h-11 min-w-36 items-center justify-center rounded-xl border border-white/10 bg-black/10 px-4 text-center text-xs text-white/50 sm:col-span-2 xl:col-span-1">
            {formatter.format(analytics.total)} registros
          </div>
        </div>
      </section>

      {err && <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-100"><div className="font-semibold">No se pudo actualizar el Dashboard</div><div className="mt-1 text-xs text-red-100/80">{err}</div></div>}

      <section className="mt-5 grid min-w-0 grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-5" aria-label="Indicadores principales">
        <KpiCard label="Fichas registradas" value={formatter.format(analytics.total)} detail={`${selectedMonthLabel} · ${year}`} icon="activity" tone="cyan" />
        <KpiCard label="Finalizadas" value={formatter.format(analytics.finalizadas)} detail={`${analytics.completionRate}% del total registrado`} icon="check" tone="emerald" progress={analytics.completionRate} />
        <KpiCard label="En proceso" value={formatter.format(analytics.proceso)} detail="Pendientes de cierre o validación" icon="clock" tone="amber" />
        <KpiCard label="Usuarios activos" value={formatter.format(analytics.userCount)} detail="Registradores únicos del periodo" icon="people" tone="violet" />
        <KpiCard label="Tasa de cierre" value={`${analytics.completionRate}%`} detail={analytics.completionRate >= 80 ? "Nivel de cumplimiento alto" : "Oportunidad de seguimiento"} icon="target" tone="emerald" progress={analytics.completionRate} className="col-span-2 lg:col-span-2 xl:col-span-1" />
      </section>

      <DashboardPanel title="Resumen ejecutivo" eyebrow="Lectura rápida" className="mt-5" action={<span className="hidden rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] text-white/45 sm:block">{selectedMonitoreoLabel}</span>}>
        <div className="mt-4 grid gap-4 lg:grid-cols-[1.5fr_1fr] lg:items-center">
          <p className="text-sm leading-6 text-white/60">
            En <strong className="font-semibold text-white">{selectedMonthLabel.toLowerCase()} de {year}</strong> se registraron <strong className="font-semibold text-cyan-200">{formatter.format(analytics.total)} fichas</strong>. {analytics.finalizadas ? `${formatter.format(analytics.finalizadas)} están finalizadas, con una tasa de cierre de ${analytics.completionRate}%.` : "Todavía no existen fichas finalizadas en este periodo."} {topMonitoreo ? `${topMonitoreo.name} concentra el mayor volumen (${formatter.format(topMonitoreo.total)}).` : "No hay concentración por monitoreo para mostrar."}
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-2">
            <QuickMetric label="Promedio por usuario" value={analytics.averagePerUser.toFixed(1)} />
            <QuickMetric label="Monitoreos con actividad" value={String(analytics.monitoringData.length)} />
            <QuickMetric label="Periodo de mayor actividad" value={analytics.peak.periodo} />
            <QuickMetric label="Variación reciente" value={`${analytics.trendPercent > 0 ? "+" : ""}${analytics.trendPercent}%`} />
          </div>
        </div>
      </DashboardPanel>

      <div className="mt-4 grid min-w-0 gap-4 xl:grid-cols-12">
        <DashboardPanel title="Evolución de registros" eyebrow="Tendencia" description={month === "ALL" ? "Volumen mensual y fichas finalizadas." : "Comportamiento semanal dentro del mes seleccionado."} className="xl:col-span-8">
          <div className="mt-4 h-72 min-w-0 sm:h-80">
            {analytics.total ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={analytics.trendData} margin={{ top: 8, right: 6, left: -18, bottom: 0 }}>
                  <defs>
                    <linearGradient id="totalArea" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#22d3ee" stopOpacity={0.32} /><stop offset="95%" stopColor="#22d3ee" stopOpacity={0.02} /></linearGradient>
                    <linearGradient id="finalArea" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#34d399" stopOpacity={0.28} /><stop offset="95%" stopColor="#34d399" stopOpacity={0.01} /></linearGradient>
                  </defs>
                  <CartesianGrid stroke="var(--dashboard-grid)" strokeDasharray="3 5" vertical={false} />
                  <XAxis dataKey="periodo" axisLine={false} tickLine={false} tick={{ fill: "var(--app-muted)", fontSize: 11 }} dy={8} />
                  <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: "var(--app-muted)", fontSize: 11 }} />
                  <Tooltip content={<ChartTooltip />} cursor={{ stroke: "rgba(34,211,238,.25)", strokeWidth: 1 }} />
                  <Area type="monotone" dataKey="total" name="Registradas" stroke="#22d3ee" strokeWidth={2.2} fill="url(#totalArea)" activeDot={{ r: 5, strokeWidth: 0 }} />
                  <Area type="monotone" dataKey="finalizadas" name="Finalizadas" stroke="#34d399" strokeWidth={2} fill="url(#finalArea)" activeDot={{ r: 4, strokeWidth: 0 }} />
                </AreaChart>
              </ResponsiveContainer>
            ) : <EmptyChart />}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-4 text-[11px] text-white/45"><LegendDot color="#22d3ee" label="Registradas" /><LegendDot color="#34d399" label="Finalizadas" /></div>
        </DashboardPanel>

        <DashboardPanel title="Distribución por estado" eyebrow="Composición" description="Participación de cada estado sobre el total." className="xl:col-span-4">
          <div className="relative mt-4 h-72 min-w-0 sm:h-80">
            {analytics.total ? (
              <>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={analytics.statusData} dataKey="value" nameKey="name" innerRadius="58%" outerRadius="82%" paddingAngle={3} cornerRadius={5} stroke="none">
                      {analytics.statusData.map((item, index) => <Cell key={item.name} fill={STATUS_COLORS[index % STATUS_COLORS.length]} />)}
                    </Pie>
                    <Tooltip content={<ChartTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 grid place-items-center"><div className="text-center"><div className="text-2xl font-semibold text-white">{formatter.format(analytics.total)}</div><div className="text-[10px] uppercase tracking-wider text-white/40">Total</div></div></div>
              </>
            ) : <EmptyChart />}
          </div>
          <div className="mt-1 grid gap-2 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
            {analytics.statusData.map((item, index) => <div key={item.name} className="flex items-center justify-between gap-3 text-xs"><LegendDot color={STATUS_COLORS[index % STATUS_COLORS.length]} label={item.name} /><span className="font-semibold text-white">{formatter.format(item.value)}</span></div>)}
          </div>
        </DashboardPanel>
      </div>

      <div className="mt-4 grid min-w-0 gap-4 xl:grid-cols-12">
        <DashboardPanel title="Comparativo por monitoreo" eyebrow="Rendimiento" description="Top 8 por volumen, separado entre finalizadas y en proceso." className="xl:col-span-7">
          <div className="mt-4 h-80 min-w-0 sm:h-96">
            {analytics.monitoringData.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics.monitoringData.slice(0, 8)} layout="vertical" margin={{ top: 4, right: 8, left: 10, bottom: 0 }}>
                  <CartesianGrid stroke="var(--dashboard-grid)" strokeDasharray="3 5" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: "var(--app-muted)", fontSize: 10 }} />
                  <YAxis type="category" dataKey="shortName" width={108} axisLine={false} tickLine={false} tick={{ fill: "var(--app-muted)", fontSize: 10 }} />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(148,163,184,.06)" }} />
                  <Bar dataKey="finalizadas" name="Finalizadas" stackId="status" fill="#34d399" radius={[5, 0, 0, 5]} maxBarSize={24} />
                  <Bar dataKey="proceso" name="En proceso" stackId="status" fill="#f59e0b" radius={[0, 5, 5, 0]} maxBarSize={24} />
                </BarChart>
              </ResponsiveContainer>
            ) : <EmptyChart />}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-4 text-[11px] text-white/45"><LegendDot color="#34d399" label="Finalizadas" /><LegendDot color="#f59e0b" label="En proceso" /></div>
        </DashboardPanel>

        <DashboardPanel title="Ranking de registradores" eyebrow="Top usuarios" description="Cinco resultados iniciales; busca para consultar el resto." className="xl:col-span-5" action={<span className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[10px] text-white/40">{analytics.userRanking.length} usuarios</span>}>
          <label className="relative mt-4 block">
            <DashboardIcon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
            <input value={rankingQuery} onChange={(event) => setRankingQuery(event.target.value)} className="dashboard-control h-10 w-full rounded-xl border py-2 pl-9 pr-3 text-sm outline-none" placeholder="Buscar por nombre o rol..." />
          </label>
          <div className="mt-4 space-y-2.5">
            {visibleRanking.map((item, index) => {
              const max = Math.max(1, visibleRanking[0]?.count ?? 1);
              return (
                <div key={item.id} className="rounded-xl border border-white/8 bg-black/10 p-3">
                  <div className="flex items-center gap-3">
                    <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg text-xs font-bold ${index < 3 && !rankingQuery ? "bg-cyan-400/15 text-cyan-200" : "bg-white/5 text-white/50"}`}>{index + 1}</div>
                    <div className="min-w-0 flex-1"><div className="truncate text-sm font-medium text-white/85" title={item.name}>{item.name}</div><div className="mt-0.5 text-[10px] text-white/40">{item.role}</div></div>
                    <div className="text-sm font-semibold text-white">{formatter.format(item.count)}</div>
                  </div>
                  <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/5"><div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-sky-500" style={{ width: `${(item.count / max) * 100}%` }} /></div>
                </div>
              );
            })}
            {!visibleRanking.length && <EmptyChart message={rankingQuery ? "No se encontraron usuarios." : undefined} />}
          </div>
          {analytics.roleData.length > 0 && <div className="mt-4 flex flex-wrap gap-2 border-t border-white/10 pt-4">{analytics.roleData.map((item) => <span key={item.role} className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] text-white/50">{item.role}: <strong className="text-white/75">{item.count}</strong></span>)}</div>}
        </DashboardPanel>
      </div>

      <DashboardPanel title="Actividad reciente" eyebrow="Últimos movimientos" description="Registros más recientes del periodo seleccionado." className="mt-4">
        <div className="mt-4 hidden overflow-hidden rounded-xl border border-white/10 md:block">
          <table className="w-full table-fixed text-left text-xs">
            <thead className="bg-white/5 text-[10px] uppercase tracking-[0.1em] text-white/40"><tr><th className="w-[42%] px-4 py-3 font-semibold">Monitoreo / ficha</th><th className="w-[25%] px-4 py-3 font-semibold">Registrador</th><th className="w-[18%] px-4 py-3 font-semibold">Fecha</th><th className="w-[15%] px-4 py-3 text-right font-semibold">Estado</th></tr></thead>
            <tbody className="divide-y divide-white/8">
              {runs.slice(0, 5).map((run) => <RecentRow key={run.id} run={run} profile={profiles[run.created_by]} ficha={run.template_id ? fichasByTemplate[run.template_id] : undefined} monitoreo={run.template_id && fichasByTemplate[run.template_id] ? monById[fichasByTemplate[run.template_id].monitoreo_id] : undefined} />)}
            </tbody>
          </table>
        </div>
        <div className="mt-4 space-y-2 md:hidden">
          {runs.slice(0, 5).map((run) => {
            const ficha = run.template_id ? fichasByTemplate[run.template_id] : undefined;
            const mon = ficha ? monById[ficha.monitoreo_id] : undefined;
            return <article key={run.id} className="rounded-xl border border-white/10 bg-black/10 p-3"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="truncate text-sm font-medium text-white/80">{mon?.nombre ?? "Monitoreo"}</div><div className="mt-0.5 text-xs text-white/40">{ficha?.codigo ?? "Ficha"} · {userName(profiles[run.created_by])}</div></div><StatusPill status={run.status} /></div><div className="mt-2 text-[10px] text-white/35">{fmtDateShort(run.created_at)}</div></article>;
          })}
        </div>
        {!runs.length && <div className="mt-4"><EmptyChart message="No hay actividad reciente para los filtros seleccionados." /></div>}
      </DashboardPanel>
    </div>
  );
}

function QuickMetric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-white/10 bg-black/10 px-3 py-3"><div className="truncate text-[10px] uppercase tracking-[0.08em] text-white/35" title={label}>{label}</div><div className="mt-1 truncate text-sm font-semibold text-white" title={value}>{value}</div></div>;
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return <span className="inline-flex min-w-0 items-center gap-1.5"><span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} /><span className="truncate">{label}</span></span>;
}

function StatusPill({ status }: { status: string }) {
  const final = isFinalStatus(status);
  return <span className={`inline-flex shrink-0 rounded-full border px-2 py-1 text-[10px] font-semibold ${final ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-200" : "border-amber-400/20 bg-amber-400/10 text-amber-200"}`}>{statusLabel(status)}</span>;
}

function RecentRow({ run, profile, ficha, monitoreo }: { run: RunRow; profile?: ProfileRow; ficha?: FichaRow; monitoreo?: MonitoreoRow }) {
  return (
    <tr className="bg-black/5 transition-colors hover:bg-white/[0.035]">
      <td className="px-4 py-3"><div className="truncate font-medium text-white/80" title={monitoreo?.nombre}>{monitoreo?.nombre ?? "Monitoreo"}</div><div className="mt-0.5 text-[10px] text-white/35">{ficha?.codigo ?? "Ficha"}</div></td>
      <td className="truncate px-4 py-3 text-white/55" title={userName(profile)}>{userName(profile)}</td>
      <td className="px-4 py-3 text-white/45">{fmtDateShort(run.created_at)}</td>
      <td className="px-4 py-3 text-right"><StatusPill status={run.status} /></td>
    </tr>
  );
}
