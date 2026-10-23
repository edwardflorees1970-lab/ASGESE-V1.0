import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../app/AuthProvider";
import { useAppConfig } from "../app/AppConfigProvider";
import { daysFromToday, isMonitoreoExpired, todayDateOnly } from "../lib/monitoreoVigencia";
import { SkeletonCards, SkeletonLine } from "../components/Skeleton";
import "./SeguimientoPage.css";

type MonitoreoRow = {
  id: string;
  codigo: string;
  nombre: string;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  is_active: boolean;
};

type Especialista = { user_id: string; nombre: string; rei: string | null; meta: number | null };

type Ficha = {
  id: string;
  status: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  institucion_id: string | null;
  ie_nombre: string | null;
  codigo_modular: string | null;
  rei: string | null;
  nivel: string | null;
  distrito: string | null;
  fecha_aplicacion: string | null;
  template_codigo: string | null;
  firmado: boolean;
};

type CoberturaRei = { rei: string; total: number; visitadas: number };

type SeguimientoData = {
  monitoreo: { id: string; codigo: string; nombre: string; fecha_inicio: string | null; fecha_fin: string | null } | null;
  especialistas: Especialista[];
  fichas: Ficha[];
  cobertura: CoberturaRei[];
};

type Compromiso = {
  id: string;
  monitoreo_id: string;
  institucion_id: string | null;
  form_run_id: string | null;
  descripcion: string;
  responsable: string | null;
  fecha_limite: string | null;
  estado: "pendiente" | "cumplido" | "anulado";
  nota_cierre: string | null;
  created_by: string;
  created_at: string;
  cerrado_at: string | null;
};

type IePadron = { id: string; nombre: string; codigo_modular: string | null; director: string | null; telefono: string | null; nivel: { nombre: string } | null };

type Tab = "ritmo" | "pendientes" | "cobertura" | "compromisos";

type EstadoRitmo = "cumplida" | "en_ruta" | "en_riesgo" | "atrasado" | "sin_meta";

const ESTADO_LABEL: Record<EstadoRitmo, string> = {
  cumplida: "Meta cumplida",
  en_ruta: "En ruta",
  en_riesgo: "En riesgo",
  atrasado: "Atrasado",
  sin_meta: "Sin meta",
};

const DIAS_INACTIVO = 5;
const DIAS_BORRADOR = 2;

const fmtDate = (iso?: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso.length <= 10 ? `${iso}T12:00:00` : iso);
  return d.toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" });
};

const dateOnlyLima = (iso: string) =>
  new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/Lima" });

const daysSince = (iso?: string | null) => {
  if (!iso) return null;
  const d = daysFromToday(dateOnlyLima(iso));
  return d == null ? null : -d;
};

const fmtNum = (n: number, digits = 1) =>
  n.toLocaleString("es-PE", { minimumFractionDigits: digits, maximumFractionDigits: digits });

export function SeguimientoPage() {
  const { profile, canManageModule } = useAuth();
  const { isTestMode } = useAppConfig();
  const canWrite = canManageModule("seguimiento");

  const [loading, setLoading] = useState(true);
  const [monitoreos, setMonitoreos] = useState<MonitoreoRow[]>([]);
  const [monitoreoId, setMonitoreoId] = useState("");
  const [data, setData] = useState<SeguimientoData | null>(null);
  const [loadedId, setLoadedId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("ritmo");
  const [toast, setToast] = useState<{ type: "ok" | "err"; msg: string } | null>(null);

  const [compromisos, setCompromisos] = useState<Compromiso[]>([]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const { data: rows, error: err } = await supabase
        .from("monitoreo_catalog")
        .select("id, codigo, nombre, fecha_inicio, fecha_fin, is_active")
        .eq("is_test", isTestMode)
        .order("is_active", { ascending: false })
        .order("fecha_inicio", { ascending: false, nullsFirst: false });
      if (!alive) return;
      if (err) setError(err.message);
      const list = (rows ?? []) as MonitoreoRow[];
      setMonitoreos(list);
      setMonitoreoId((prev) => (prev && list.some((m) => m.id === prev) ? prev : (list[0]?.id ?? "")));
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [isTestMode]);

  const loadCompromisos = useCallback(async (mid: string) => {
    const { data: rows, error: err } = await supabase
      .from("monitoreo_compromiso")
      .select("id, monitoreo_id, institucion_id, form_run_id, descripcion, responsable, fecha_limite, estado, nota_cierre, created_by, created_at, cerrado_at")
      .eq("monitoreo_id", mid)
      .order("created_at", { ascending: false });
    if (err) {
      setToast({ type: "err", msg: err.message });
      return;
    }
    setCompromisos((rows ?? []) as Compromiso[]);
  }, []);

  useEffect(() => {
    if (!monitoreoId) return;
    let alive = true;
    (async () => {
      const [{ data: payload, error: err }] = await Promise.all([
        supabase.rpc("seguimiento_monitoreo", { p_monitoreo_id: monitoreoId }),
        loadCompromisos(monitoreoId),
      ]);
      if (!alive) return;
      setError(err ? err.message : null);
      setData(err ? null : (payload as SeguimientoData));
      setLoadedId(monitoreoId);
    })();
    return () => {
      alive = false;
    };
  }, [monitoreoId, loadCompromisos]);

  const loadingData = loadedId !== monitoreoId;
  const selected = monitoreos.find((m) => m.id === monitoreoId) ?? null;
  const fichas = useMemo(() => data?.fichas ?? [], [data]);
  const especialistas = useMemo(() => data?.especialistas ?? [], [data]);
  const nameById = useMemo(() => new Map(especialistas.map((e) => [e.user_id, e.nombre])), [especialistas]);

  const fichaUrl = useCallback(
    (f: Ficha) =>
      selected && f.template_codigo
        ? `/app/monitoreo/${selected.codigo}/ficha/${f.template_codigo}?runId=${f.id}&mid=${encodeURIComponent(selected.id)}&returnTo=seguimiento`
        : null,
    [selected],
  );

  // ---------- Ritmo ----------
  const today = todayDateOnly();
  const inicio = selected?.fecha_inicio ?? null;
  const fin = selected?.fecha_fin ?? null;
  const diasTranscurridos = useMemo(() => {
    if (!inicio) return 1;
    const hasta = fin && fin < today ? fin : today;
    const d = (daysFromToday(hasta, inicio) ?? 0) + 1;
    return Math.max(1, d);
  }, [inicio, fin, today]);
  const diasRestantes = Math.max(0, daysFromToday(fin) ?? 0);

  const ritmo = useMemo(() => {
    return especialistas
      .map((e) => {
        const mias = fichas.filter((f) => f.created_by === e.user_id);
        const finalizadas = mias.filter((f) => f.status === "final").length;
        const borradores = mias.length - finalizadas;
        const ultima = mias.reduce<string | null>((acc, f) => (!acc || f.created_at > acc ? f.created_at : acc), null);
        const actual = finalizadas / diasTranscurridos;
        const meta = e.meta;
        const faltan = meta != null ? Math.max(0, meta - finalizadas) : null;
        const requerido = faltan != null ? (diasRestantes > 0 ? faltan / diasRestantes : faltan > 0 ? Infinity : 0) : null;
        const proyeccion = Math.round(finalizadas + actual * diasRestantes);
        let estado: EstadoRitmo = "sin_meta";
        if (meta != null && meta > 0) {
          if (finalizadas >= meta) estado = "cumplida";
          else if (proyeccion >= meta) estado = "en_ruta";
          else if (proyeccion >= meta * 0.8) estado = "en_riesgo";
          else estado = "atrasado";
        }
        const inactivo = daysSince(ultima);
        return { ...e, subidas: mias.length, finalizadas, borradores, ultima, actual, faltan, requerido, proyeccion, estado, inactivo };
      })
      .sort((a, b) => (b.meta ?? -1) - (a.meta ?? -1) || b.finalizadas - a.finalizadas);
  }, [especialistas, fichas, diasTranscurridos, diasRestantes]);

  const totales = useMemo(() => {
    const meta = ritmo.reduce((s, r) => s + (r.meta ?? 0), 0);
    const finalizadas = fichas.filter((f) => f.status === "final").length;
    const ies = new Set(fichas.map((f) => f.institucion_id).filter(Boolean)).size;
    return { meta, finalizadas, borradores: fichas.length - finalizadas, ies };
  }, [ritmo, fichas]);

  const porDia = useMemo(() => {
    const days: { fecha: string; n: number }[] = [];
    for (let i = 13; i >= 0; i -= 1) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push({ fecha: d.toLocaleDateString("en-CA", { timeZone: "America/Lima" }), n: 0 });
    }
    const idx = new Map(days.map((d, i) => [d.fecha, i]));
    fichas.forEach((f) => {
      const i = idx.get(dateOnlyLima(f.created_at));
      if (i != null) days[i].n += 1;
    });
    return days;
  }, [fichas]);

  // ---------- Pendientes ----------
  const [verSinFirma, setVerSinFirma] = useState(false);
  const [filtroEsp, setFiltroEsp] = useState("");

  const alertas = useMemo(() => {
    type Alerta = { key: string; tipo: string; nivel: "alta" | "media" | "info"; detalle: string; ficha?: Ficha; userId?: string };
    const out: Alerta[] = [];
    fichas
      .filter((f) => f.status !== "final")
      .forEach((f) => {
        const d = daysSince(f.updated_at) ?? 0;
        out.push({
          key: `b-${f.id}`,
          tipo: "Borrador sin cerrar",
          nivel: d >= DIAS_BORRADOR ? "alta" : "media",
          detalle: d === 0 ? "Editado hoy" : `Sin cambios hace ${d} día${d === 1 ? "" : "s"}`,
          ficha: f,
          userId: f.created_by,
        });
      });
    const porIe = new Map<string, Ficha[]>();
    fichas.forEach((f) => {
      if (!f.institucion_id) return;
      porIe.set(f.institucion_id, [...(porIe.get(f.institucion_id) ?? []), f]);
    });
    porIe.forEach((list) => {
      if (list.length < 2) return;
      list.forEach((f) =>
        out.push({ key: `r-${f.id}`, tipo: "IE repetida", nivel: "media", detalle: `${list.length} fichas para la misma IE`, ficha: f, userId: f.created_by }),
      );
    });
    fichas
      .filter((f) => !f.institucion_id)
      .forEach((f) =>
        out.push({ key: `s-${f.id}`, tipo: "Ficha sin IE vinculada", nivel: "media", detalle: f.ie_nombre ? `Escrita como "${f.ie_nombre}"` : "Sin institución", ficha: f, userId: f.created_by }),
      );
    ritmo.forEach((r) => {
      if (r.estado === "cumplida" || r.meta == null) return;
      if (r.inactivo == null || r.inactivo >= DIAS_INACTIVO)
        out.push({
          key: `i-${r.user_id}`,
          tipo: "Especialista sin registrar",
          nivel: "alta",
          detalle: r.inactivo == null ? "Aún no registra fichas" : `Última ficha hace ${r.inactivo} días`,
          userId: r.user_id,
        });
    });
    if (verSinFirma)
      fichas
        .filter((f) => f.status === "final" && !f.firmado)
        .forEach((f) => out.push({ key: `f-${f.id}`, tipo: "Finalizada sin firma", nivel: "info", detalle: "Sin firma digital registrada", ficha: f, userId: f.created_by }));
    const rank = { alta: 0, media: 1, info: 2 };
    return out
      .filter((a) => !filtroEsp || a.userId === filtroEsp)
      .sort((a, b) => rank[a.nivel] - rank[b.nivel]);
  }, [fichas, ritmo, verSinFirma, filtroEsp]);

  const sinFirma = fichas.filter((f) => f.status === "final" && !f.firmado).length;
  const alertasActivas = alertas.filter((a) => a.nivel !== "info").length;

  // ---------- Compromisos ----------
  const compromisosAbiertos = compromisos.filter((c) => c.estado === "pendiente").length;

  if (loading) {
    return (
      <div className="space-y-4">
        <SkeletonLine width="240px" />
        <div className="grid gap-3 md:grid-cols-2">
          <SkeletonCards count={4} />
        </div>
      </div>
    );
  }

  const tabs: { id: Tab; label: string; badge?: number }[] = [
    { id: "ritmo", label: "Ritmo por especialista" },
    { id: "pendientes", label: "Pendientes y alertas", badge: alertasActivas },
    { id: "cobertura", label: "Cobertura de IE" },
    { id: "compromisos", label: "Compromisos", badge: compromisosAbiertos },
  ];

  return (
    <div className="tracking-page seg-page max-w-full space-y-5 overflow-x-hidden">
      {toast && (
        <div role="status" className={`seg-toast ${toast.type === "err" ? "is-err" : "is-ok"}`}>
          {toast.msg}
        </div>
      )}

      <section className="tracking-hero">
        <div className="tracking-hero__main">
          <div className="tracking-hero__identity">
            <div className="tracking-hero__icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M4 19V9M10 19V5M16 19v-7M22 19V3M2 21h22" />
              </svg>
            </div>
            <div>
              <div className="tracking-eyebrow">CONTROL OPERATIVO</div>
              <h1 className="text-xl font-semibold tracking-tight md:text-2xl">Seguimiento</h1>
              <p className="mt-1 text-sm">Ritmo del equipo, pendientes, cobertura y compromisos del monitoreo elegido.</p>
            </div>
          </div>
          {data && (
            <div className="seg-kpis" aria-label="Resumen del monitoreo">
              <div className="tracking-metric"><span>Finalizadas</span><strong>{totales.finalizadas}{totales.meta ? ` / ${totales.meta}` : ""}</strong></div>
              <div className="tracking-metric"><span>Avance</span><strong>{totales.meta ? `${fmtNum((totales.finalizadas / totales.meta) * 100)}%` : "—"}</strong></div>
              <div className="tracking-metric"><span>Borradores</span><strong>{totales.borradores}</strong></div>
              <div className="tracking-metric"><span>IE visitadas</span><strong>{totales.ies}</strong></div>
            </div>
          )}
        </div>
        <div className="tracking-hero__monitor w-full min-w-0 sm:min-w-[220px] sm:max-w-[420px]">
          <label htmlFor="seg-monitoreo" className="tracking-control-label mb-2 block">Monitoreo</label>
          <select
            id="seg-monitoreo"
            className="w-full rounded-xl border px-3 py-2 text-sm"
            value={monitoreoId}
            onChange={(e) => setMonitoreoId(e.target.value)}
          >
            {monitoreos.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nombre}
                {isMonitoreoExpired(m.fecha_fin) ? " (vencido)" : !m.is_active ? " (inactivo)" : ""}
              </option>
            ))}
          </select>
          {selected && (
            <div className="tracking-monitor-status mt-2 text-xs">
              <span>{fmtDate(selected.fecha_inicio)} – {fmtDate(selected.fecha_fin)}</span>
              <span>
                {(() => {
                  const d = daysFromToday(selected.fecha_fin);
                  if (d == null) return "Sin fecha fin";
                  if (d < 0) return `Venció hace ${Math.abs(d)} días`;
                  if (d === 0) return "Vence hoy";
                  return `Quedan ${d} días`;
                })()}
              </span>
            </div>
          )}
        </div>
      </section>

      {!monitoreos.length && (
        <div className="tracking-panel seg-empty">No hay monitoreos en modo {isTestMode ? "Prueba" : "Producción"}.</div>
      )}

      {error && <div className="tracking-panel seg-error">No se pudo cargar el seguimiento: {error}</div>}

      {monitoreoId && !error && (
        <>
          <nav className="seg-tabs" role="tablist" aria-label="Secciones del seguimiento">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                className={`seg-tab ${tab === t.id ? "is-active" : ""}`}
                onClick={() => setTab(t.id)}
              >
                {t.label}
                {t.badge ? <span className="seg-tab__badge">{t.badge}</span> : null}
              </button>
            ))}
          </nav>

          {loadingData || !data ? (
            <div className="grid gap-3 md:grid-cols-2">
              <SkeletonCards count={4} />
            </div>
          ) : (
            <>
              {tab === "ritmo" && (
                <RitmoPanel
                  ritmo={ritmo}
                  porDia={porDia}
                  diasTranscurridos={diasTranscurridos}
                  diasRestantes={diasRestantes}
                />
              )}
              {tab === "pendientes" && (
                <section className="tracking-panel seg-panel">
                  <header className="seg-panel__head">
                    <div>
                      <h2 className="seg-title">Pendientes y alertas</h2>
                      <p className="seg-sub">Lo que hay que resolver para cerrar bien el monitoreo. Ordenado por urgencia.</p>
                    </div>
                    <div className="seg-filters">
                      <select value={filtroEsp} onChange={(e) => setFiltroEsp(e.target.value)} className="rounded-lg border px-3 py-1.5 text-xs" aria-label="Filtrar por especialista">
                        <option value="">Todos los especialistas</option>
                        {especialistas.map((e) => (
                          <option key={e.user_id} value={e.user_id}>{e.nombre}</option>
                        ))}
                      </select>
                      <label className="seg-check">
                        <input type="checkbox" checked={verSinFirma} onChange={(e) => setVerSinFirma(e.target.checked)} />
                        Incluir sin firma ({sinFirma})
                      </label>
                    </div>
                  </header>
                  {alertas.length === 0 ? (
                    <p className="seg-empty-inline">Sin pendientes. Todo al día.</p>
                  ) : (
                    <div className="seg-table-wrap">
                      <table className="seg-table">
                        <thead>
                          <tr><th>Tipo</th><th>Institución</th><th>Especialista</th><th>Detalle</th><th aria-label="Acción" /></tr>
                        </thead>
                        <tbody>
                          {alertas.map((a) => {
                            const url = a.ficha ? fichaUrl(a.ficha) : null;
                            return (
                              <tr key={a.key}>
                                <td><span className={`seg-pill is-${a.nivel}`}>{a.tipo}</span></td>
                                <td>
                                  {a.ficha ? (
                                    <>
                                      <div className="seg-strong">{a.ficha.ie_nombre ?? "—"}</div>
                                      <div className="seg-muted">{[a.ficha.codigo_modular, a.ficha.rei ? `REI ${a.ficha.rei}` : null].filter(Boolean).join(" · ")}</div>
                                    </>
                                  ) : "—"}
                                </td>
                                <td>{(a.userId && nameById.get(a.userId)) ?? "—"}</td>
                                <td className="seg-muted">{a.detalle}</td>
                                <td className="text-right">{url ? <Link className="seg-link" to={url}>Abrir ficha</Link> : null}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              )}
              {tab === "cobertura" && <CoberturaPanel cobertura={data.cobertura} fichas={fichas} nameById={nameById} fichaUrl={fichaUrl} />}
              {tab === "compromisos" && selected && (
                <CompromisosPanel
                  monitoreoId={selected.id}
                  compromisos={compromisos}
                  fichas={fichas}
                  canWrite={canWrite}
                  isAdmin={profile?.role === "admin"}
                  userId={profile?.id ?? ""}
                  onChanged={() => loadCompromisos(selected.id)}
                  onToast={setToast}
                />
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

// ======================= Ritmo =======================

type RitmoRow = Especialista & {
  subidas: number;
  finalizadas: number;
  borradores: number;
  ultima: string | null;
  actual: number;
  faltan: number | null;
  requerido: number | null;
  proyeccion: number;
  estado: EstadoRitmo;
  inactivo: number | null;
};

function RitmoPanel({
  ritmo,
  porDia,
  diasTranscurridos,
  diasRestantes,
}: {
  ritmo: RitmoRow[];
  porDia: { fecha: string; n: number }[];
  diasTranscurridos: number;
  diasRestantes: number;
}) {
  const maxDia = Math.max(1, ...porDia.map((d) => d.n));
  return (
    <div className="space-y-5">
      <section className="tracking-panel seg-panel">
        <header className="seg-panel__head">
          <div>
            <h2 className="seg-title">Ritmo por especialista</h2>
            <p className="seg-sub">
              Fichas finalizadas por día desde el inicio ({diasTranscurridos} días) y lo que necesita cada uno en los {diasRestantes} días que quedan.
            </p>
          </div>
        </header>
        {ritmo.length === 0 ? (
          <p className="seg-empty-inline">No hay especialistas asignados ni fichas en este monitoreo.</p>
        ) : (
          <div className="seg-table-wrap">
            <table className="seg-table">
              <thead>
                <tr>
                  <th>Especialista</th>
                  <th>Estado</th>
                  <th className="text-right">Meta</th>
                  <th>Avance</th>
                  <th className="text-right">Borradores</th>
                  <th className="text-right" title="Fichas finalizadas por día, en promedio">Ritmo actual</th>
                  <th className="text-right" title="Fichas por día necesarias para llegar a la meta">Ritmo requerido</th>
                  <th className="text-right" title="Finalizadas estimadas al cierre si sigue al ritmo actual">Proyección</th>
                  <th>Última ficha</th>
                </tr>
              </thead>
              <tbody>
                {ritmo.map((r) => {
                  const pct = r.meta ? Math.min(100, (r.finalizadas / r.meta) * 100) : 0;
                  const exceso = r.meta != null && r.subidas > r.meta ? r.subidas - r.meta : 0;
                  return (
                    <tr key={r.user_id}>
                      <td>
                        <div className="seg-strong">{r.nombre}</div>
                        <div className="seg-muted">{r.rei && r.rei !== "SIN REI" ? `REI ${r.rei}` : "Sin REI"}</div>
                      </td>
                      <td><span className={`seg-status is-${r.estado}`}>{ESTADO_LABEL[r.estado]}</span></td>
                      <td className="text-right seg-num">{r.meta ?? "—"}</td>
                      <td className="seg-progress-cell">
                        <div className="seg-progress" aria-hidden="true"><span style={{ width: `${pct}%` }} /></div>
                        <div className="seg-muted">
                          {r.finalizadas} finalizadas{r.meta ? ` · ${fmtNum(pct)}%` : ""}
                          {exceso ? <span className="seg-tag">+{exceso} excedente</span> : null}
                        </div>
                      </td>
                      <td className="text-right seg-num">{r.borradores}</td>
                      <td className="text-right seg-num">{fmtNum(r.actual)}/día</td>
                      <td className="text-right seg-num">
                        {r.requerido == null ? "—" : r.requerido === 0 ? "Listo" : Number.isFinite(r.requerido) ? `${fmtNum(r.requerido)}/día` : "Fuera de plazo"}
                      </td>
                      <td className="text-right seg-num">{r.meta ? `${r.proyeccion} / ${r.meta}` : r.proyeccion}</td>
                      <td>
                        <div>{r.ultima ? fmtDate(r.ultima) : "—"}</div>
                        {r.inactivo != null && r.inactivo >= DIAS_INACTIVO && r.estado !== "cumplida" ? (
                          <div className="seg-warn">Hace {r.inactivo} días</div>
                        ) : r.inactivo != null ? (
                          <div className="seg-muted">{r.inactivo === 0 ? "Hoy" : `Hace ${r.inactivo} día${r.inactivo === 1 ? "" : "s"}`}</div>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="seg-foot">
          Proyección = finalizadas + ritmo actual × días restantes. «En riesgo» si la proyección llega al 80 % de la meta; «Atrasado» si queda por debajo.
        </p>
      </section>

      <section className="tracking-panel seg-panel">
        <header className="seg-panel__head">
          <div>
            <h2 className="seg-title">Fichas registradas en los últimos 14 días</h2>
            <p className="seg-sub">Todas las fichas (borradores y finalizadas), por día de registro en el sistema.</p>
          </div>
        </header>
        <div className="seg-bars" role="img" aria-label="Fichas registradas por día en los últimos 14 días">
          {porDia.map((d) => (
            <div key={d.fecha} className="seg-bar" title={`${fmtDate(d.fecha)}: ${d.n} ficha${d.n === 1 ? "" : "s"}`}>
              <span className="seg-bar__n">{d.n || ""}</span>
              <span className="seg-bar__fill" style={{ height: `${(d.n / maxDia) * 100}%` }} />
              <span className="seg-bar__day">{d.fecha.slice(8, 10)}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

// ======================= Cobertura =======================

function CoberturaPanel({
  cobertura,
  fichas,
  nameById,
  fichaUrl,
}: {
  cobertura: CoberturaRei[];
  fichas: Ficha[];
  nameById: Map<string, string>;
  fichaUrl: (f: Ficha) => string | null;
}) {
  const [rei, setRei] = useState<string>("");
  const [padron, setPadron] = useState<IePadron[]>([]);
  const [loadingPadron, setLoadingPadron] = useState(false);
  const [busca, setBusca] = useState("");

  const visitadasPorIe = useMemo(() => {
    const m = new Map<string, Ficha[]>();
    fichas.forEach((f) => {
      if (f.institucion_id) m.set(f.institucion_id, [...(m.get(f.institucion_id) ?? []), f]);
    });
    return m;
  }, [fichas]);

  useEffect(() => {
    if (!rei) return;
    let alive = true;
    (async () => {
      setLoadingPadron(true);
      let q = supabase
        .from("institucion_educativa")
        .select("id, nombre, codigo_modular, director, telefono, nivel:cat_nivel(nombre)")
        .order("nombre", { ascending: true })
        .limit(1000);
      q = rei === "Sin REI" ? q.or("rei.is.null,rei.eq.") : q.eq("rei", rei);
      const { data } = await q;
      if (!alive) return;
      setPadron((data ?? []) as unknown as IePadron[]);
      setLoadingPadron(false);
    })();
    return () => {
      alive = false;
    };
  }, [rei]);

  const term = busca.trim().toLowerCase();
  const match = (ie: IePadron) =>
    !term || ie.nombre.toLowerCase().includes(term) || (ie.codigo_modular ?? "").includes(term);
  const padronRei = rei ? padron : [];
  const visitadas = padronRei.filter((ie) => visitadasPorIe.has(ie.id) && match(ie));
  const porVisitar = padronRei.filter((ie) => !visitadasPorIe.has(ie.id) && match(ie));

  const totalIe = cobertura.reduce((s, c) => s + c.total, 0);
  const totalVis = cobertura.reduce((s, c) => s + c.visitadas, 0);

  return (
    <div className="space-y-5">
      <section className="tracking-panel seg-panel">
        <header className="seg-panel__head">
          <div>
            <h2 className="seg-title">Cobertura por REI</h2>
            <p className="seg-sub">
              IE del padrón de la UGEL con al menos una ficha en este monitoreo: {totalVis} de {totalIe}. Elige una REI para ver qué IE faltan.
            </p>
          </div>
        </header>
        <div className="seg-rei-grid">
          {cobertura.map((c) => {
            const pct = c.total ? (c.visitadas / c.total) * 100 : 0;
            return (
              <button
                key={c.rei}
                type="button"
                className={`seg-rei ${rei === c.rei ? "is-active" : ""}`}
                onClick={() => setRei(rei === c.rei ? "" : c.rei)}
                aria-pressed={rei === c.rei}
              >
                <span className="seg-rei__name">{c.rei === "Sin REI" ? "Sin REI" : `REI ${c.rei}`}</span>
                <span className="seg-rei__num">{c.visitadas}<small> / {c.total}</small></span>
                <span className="seg-progress" aria-hidden="true"><span style={{ width: `${pct}%` }} /></span>
                <span className="seg-muted">{fmtNum(pct)}%</span>
              </button>
            );
          })}
        </div>
      </section>

      {rei && (
        <section className="tracking-panel seg-panel">
          <header className="seg-panel__head">
            <div>
              <h2 className="seg-title">{rei === "Sin REI" ? "IE sin REI" : `REI ${rei}`}</h2>
              <p className="seg-sub">{visitadas.length} visitadas · {porVisitar.length} por visitar</p>
            </div>
            <input
              className="rounded-lg border px-3 py-1.5 text-sm"
              placeholder="Buscar IE o código modular"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              aria-label="Buscar IE en la REI"
            />
          </header>
          {loadingPadron ? (
            <SkeletonLine width="60%" />
          ) : (
            <div className="seg-two-col">
              <div>
                <h3 className="seg-col-title">Visitadas</h3>
                {visitadas.length === 0 ? (
                  <p className="seg-empty-inline">Ninguna todavía.</p>
                ) : (
                  <ul className="seg-list">
                    {visitadas.map((ie) => {
                      const fs = visitadasPorIe.get(ie.id) ?? [];
                      return (
                        <li key={ie.id}>
                          <div className="seg-strong">{ie.nombre}</div>
                          <div className="seg-muted">{[ie.codigo_modular, ie.nivel?.nombre].filter(Boolean).join(" · ")}</div>
                          {fs.map((f) => {
                            const url = fichaUrl(f);
                            return (
                              <div key={f.id} className="seg-list__meta">
                                <span className={`seg-pill ${f.status === "final" ? "is-ok" : "is-media"}`}>{f.status === "final" ? "Finalizada" : "Borrador"}</span>
                                <span>{fmtDate(f.created_at)} · {nameById.get(f.created_by) ?? "—"}</span>
                                {url && <Link className="seg-link" to={url}>Abrir</Link>}
                              </div>
                            );
                          })}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
              <div>
                <h3 className="seg-col-title">Por visitar</h3>
                {porVisitar.length === 0 ? (
                  <p className="seg-empty-inline">No quedan IE por visitar en esta REI.</p>
                ) : (
                  <ul className="seg-list">
                    {porVisitar.map((ie) => (
                      <li key={ie.id}>
                        <div className="seg-strong">{ie.nombre}</div>
                        <div className="seg-muted">
                          {[ie.codigo_modular, ie.nivel?.nombre, ie.director ? `Dir. ${ie.director}` : null, ie.telefono].filter(Boolean).join(" · ")}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

// ======================= Compromisos =======================

type FiltroComp = "abiertos" | "vencidos" | "cumplidos" | "todos";

function CompromisosPanel({
  monitoreoId,
  compromisos,
  fichas,
  canWrite,
  isAdmin,
  userId,
  onChanged,
  onToast,
}: {
  monitoreoId: string;
  compromisos: Compromiso[];
  fichas: Ficha[];
  canWrite: boolean;
  isAdmin: boolean;
  userId: string;
  onChanged: () => Promise<void> | void;
  onToast: (t: { type: "ok" | "err"; msg: string }) => void;
}) {
  const [runId, setRunId] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [responsable, setResponsable] = useState("");
  const [fechaLimite, setFechaLimite] = useState("");
  const [saving, setSaving] = useState(false);
  const [filtro, setFiltro] = useState<FiltroComp>("abiertos");
  const [cerrando, setCerrando] = useState<string | null>(null);
  const [nota, setNota] = useState("");

  const today = todayDateOnly();
  const fichaById = useMemo(() => new Map(fichas.map((f) => [f.id, f])), [fichas]);
  const opciones = useMemo(
    () => fichas.filter((f) => f.institucion_id).slice().sort((a, b) => (a.ie_nombre ?? "").localeCompare(b.ie_nombre ?? "")),
    [fichas],
  );

  const vencido = (c: Compromiso) => c.estado === "pendiente" && !!c.fecha_limite && c.fecha_limite < today;
  const lista = compromisos.filter((c) =>
    filtro === "todos" ? true : filtro === "cumplidos" ? c.estado !== "pendiente" : filtro === "vencidos" ? vencido(c) : c.estado === "pendiente",
  );
  const counts = {
    abiertos: compromisos.filter((c) => c.estado === "pendiente").length,
    vencidos: compromisos.filter(vencido).length,
    cumplidos: compromisos.filter((c) => c.estado !== "pendiente").length,
    todos: compromisos.length,
  };

  const crear = async (e: FormEvent) => {
    e.preventDefault();
    const ficha = fichaById.get(runId);
    if (!ficha || descripcion.trim().length < 3) return;
    setSaving(true);
    const { error } = await supabase.from("monitoreo_compromiso").insert({
      monitoreo_id: monitoreoId,
      form_run_id: ficha.id,
      institucion_id: ficha.institucion_id,
      descripcion: descripcion.trim(),
      responsable: responsable.trim() || null,
      fecha_limite: fechaLimite || null,
      created_by: userId,
    });
    setSaving(false);
    if (error) {
      onToast({ type: "err", msg: error.message });
      return;
    }
    setDescripcion("");
    setResponsable("");
    setFechaLimite("");
    setRunId("");
    onToast({ type: "ok", msg: "Compromiso registrado." });
    await onChanged();
  };

  const cambiarEstado = async (c: Compromiso, estado: Compromiso["estado"], notaCierre?: string) => {
    const { error } = await supabase
      .from("monitoreo_compromiso")
      .update({ estado, nota_cierre: estado === "pendiente" ? null : (notaCierre?.trim() || null) })
      .eq("id", c.id);
    if (error) {
      onToast({ type: "err", msg: error.message });
      return;
    }
    setCerrando(null);
    setNota("");
    await onChanged();
  };

  const eliminar = async (c: Compromiso) => {
    if (!window.confirm("¿Eliminar este compromiso? No se puede deshacer.")) return;
    const { error } = await supabase.from("monitoreo_compromiso").delete().eq("id", c.id);
    if (error) {
      onToast({ type: "err", msg: error.message });
      return;
    }
    await onChanged();
  };

  return (
    <div className="space-y-5">
      {canWrite && (
        <section className="tracking-panel seg-panel">
          <header className="seg-panel__head">
            <div>
              <h2 className="seg-title">Nuevo compromiso</h2>
              <p className="seg-sub">Acuerdo con la IE tras la visita, con responsable y fecha para verificarlo.</p>
            </div>
          </header>
          <form className="seg-form" onSubmit={crear}>
            <label className="seg-field seg-field--wide">
              <span>Institución visitada</span>
              <select value={runId} onChange={(e) => setRunId(e.target.value)} required className="rounded-lg border px-3 py-2 text-sm">
                <option value="">Elige la ficha / IE</option>
                {opciones.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.ie_nombre} {f.codigo_modular ? `(${f.codigo_modular})` : ""} · {fmtDate(f.created_at)}
                  </option>
                ))}
              </select>
            </label>
            <label className="seg-field seg-field--wide">
              <span>Compromiso</span>
              <textarea
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                required
                minLength={3}
                maxLength={1000}
                rows={2}
                placeholder="Ej.: El director regulariza el registro de asistencia del personal docente."
                className="rounded-lg border px-3 py-2 text-sm"
              />
            </label>
            <label className="seg-field">
              <span>Responsable (opcional)</span>
              <input value={responsable} onChange={(e) => setResponsable(e.target.value)} maxLength={200} placeholder="Director(a) de la IE" className="rounded-lg border px-3 py-2 text-sm" />
            </label>
            <label className="seg-field">
              <span>Fecha límite (opcional)</span>
              <input type="date" value={fechaLimite} min={today} onChange={(e) => setFechaLimite(e.target.value)} className="rounded-lg border px-3 py-2 text-sm" />
            </label>
            <div className="seg-form__actions">
              <button type="submit" disabled={saving || !runId || descripcion.trim().length < 3} className="tracking-primary-action rounded-lg border px-4 py-2 text-sm">
                {saving ? "Guardando…" : "Registrar compromiso"}
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="tracking-panel seg-panel">
        <header className="seg-panel__head">
          <div>
            <h2 className="seg-title">Compromisos del monitoreo</h2>
            <p className="seg-sub">{canWrite ? "Marca cada compromiso cuando verifiques que se cumplió." : "Solo lectura para tu rol."}</p>
          </div>
          <div className="seg-segmented" role="group" aria-label="Filtrar compromisos">
            {(["abiertos", "vencidos", "cumplidos", "todos"] as FiltroComp[]).map((f) => (
              <button key={f} type="button" className={filtro === f ? "is-active" : ""} onClick={() => setFiltro(f)} aria-pressed={filtro === f}>
                {f[0].toUpperCase() + f.slice(1)} <span>{counts[f]}</span>
              </button>
            ))}
          </div>
        </header>
        {lista.length === 0 ? (
          <p className="seg-empty-inline">
            {compromisos.length === 0 ? "Aún no hay compromisos registrados en este monitoreo." : "No hay compromisos con este filtro."}
          </p>
        ) : (
          <ul className="seg-comp-list">
            {lista.map((c) => {
              const f = c.form_run_id ? fichaById.get(c.form_run_id) : undefined;
              const esVencido = vencido(c);
              return (
                <li key={c.id} className={`seg-comp ${esVencido ? "is-late" : ""} ${c.estado !== "pendiente" ? "is-closed" : ""}`}>
                  <div className="seg-comp__main">
                    <div className="seg-comp__top">
                      <span className={`seg-pill ${c.estado === "cumplido" ? "is-ok" : c.estado === "anulado" ? "is-info" : esVencido ? "is-alta" : "is-media"}`}>
                        {c.estado === "cumplido" ? "Cumplido" : c.estado === "anulado" ? "Anulado" : esVencido ? "Vencido" : "Pendiente"}
                      </span>
                      <span className="seg-strong">{f?.ie_nombre ?? "IE"}</span>
                      {f?.codigo_modular && <span className="seg-muted">{f.codigo_modular}</span>}
                    </div>
                    <p className="seg-comp__text">{c.descripcion}</p>
                    <div className="seg-muted">
                      {[
                        c.responsable ? `Responsable: ${c.responsable}` : null,
                        c.fecha_limite ? `Fecha límite: ${fmtDate(c.fecha_limite)}` : "Sin fecha límite",
                        `Registrado ${fmtDate(c.created_at)}`,
                        c.cerrado_at ? `Cerrado ${fmtDate(c.cerrado_at)}` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </div>
                    {c.nota_cierre && <div className="seg-comp__note">Verificación: {c.nota_cierre}</div>}
                    {cerrando === c.id && (
                      <div className="seg-comp__close">
                        <input
                          value={nota}
                          onChange={(e) => setNota(e.target.value)}
                          maxLength={1000}
                          placeholder="Cómo se verificó (opcional)"
                          className="rounded-lg border px-3 py-1.5 text-sm"
                          aria-label="Nota de verificación"
                        />
                        <button type="button" className="tracking-primary-action rounded-lg border px-3 py-1.5 text-xs" onClick={() => cambiarEstado(c, "cumplido", nota)}>
                          Confirmar
                        </button>
                        <button type="button" className="seg-btn" onClick={() => { setCerrando(null); setNota(""); }}>
                          Cancelar
                        </button>
                      </div>
                    )}
                  </div>
                  {canWrite && cerrando !== c.id && (
                    <div className="seg-comp__actions">
                      {c.estado === "pendiente" ? (
                        <>
                          <button type="button" className="tracking-primary-action rounded-lg border px-3 py-1.5 text-xs" onClick={() => { setCerrando(c.id); setNota(""); }}>
                            Marcar cumplido
                          </button>
                          <button type="button" className="seg-btn" onClick={() => cambiarEstado(c, "anulado")}>Anular</button>
                        </>
                      ) : (
                        <button type="button" className="seg-btn" onClick={() => cambiarEstado(c, "pendiente")}>Reabrir</button>
                      )}
                      {(isAdmin || c.created_by === userId) && (
                        <button type="button" className="seg-btn is-danger" onClick={() => eliminar(c)}>Eliminar</button>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
