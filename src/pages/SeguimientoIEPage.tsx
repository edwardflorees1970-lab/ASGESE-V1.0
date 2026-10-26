import { Fragment, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAppConfig } from "../app/AppConfigProvider";
import { SkeletonCards, SkeletonLine } from "../components/Skeleton";
import { SeguimientoHero, SeguimientoToast } from "../components/SeguimientoHero";
import {
  daysSince,
  fichaUrl as buildFichaUrl,
  fmtDate,
  fmtNum,
  normalize,
  usePadronIe,
  useSeguimiento,
  type Ficha,
  type IePadron,
} from "../lib/seguimiento";
import "./SeguimientoPage.css";

type Tab = "directorio" | "repetidas" | "cobertura";
type EstadoIe = "finalizada" | "borrador" | "sin_ficha";
type FiltroEstado = "todas" | "con_ficha" | "sin_ficha" | "borrador" | "repetidas" | "varios";

type IeRow = {
  ie: IePadron;
  fichas: Ficha[];
  finalizadas: number;
  especialistas: string[];
  ultima: string | null;
  estado: EstadoIe;
  compromisos: number;
  texto: string;
};

const ESTADO_IE: Record<EstadoIe, { label: string; cls: string }> = {
  finalizada: { label: "Con ficha", cls: "is-ok" },
  borrador: { label: "Solo borrador", cls: "is-media" },
  sin_ficha: { label: "Sin ficha", cls: "is-info" },
};

const FILTROS: { id: FiltroEstado; label: string }[] = [
  { id: "todas", label: "Todas" },
  { id: "con_ficha", label: "Con ficha" },
  { id: "sin_ficha", label: "Sin ficha" },
  { id: "borrador", label: "Solo borrador" },
  { id: "repetidas", label: "Repetidas" },
  { id: "varios", label: "Varios especialistas" },
];

const PAGE = 25;
const NIVELES = ["Inicial", "Primaria", "Secundaria"];

export function SeguimientoIEPage() {
  const { isTestMode } = useAppConfig();
  const { loading, monitoreos, monitoreoId, setMonitoreoId, selected, data, loadingData, error, compromisos, toast } =
    useSeguimiento(isTestMode);
  const { padron, error: padronError } = usePadronIe();

  const [tab, setTab] = useState<Tab>("directorio");
  const [estado, setEstado] = useState<FiltroEstado>("todas");
  const [rei, setRei] = useState("");
  const [nivel, setNivel] = useState("");
  const [distrito, setDistrito] = useState("");
  const [esp, setEsp] = useState("");
  const [busca, setBusca] = useState("");
  const [page, setPage] = useState(0);
  const [abierta, setAbierta] = useState<string | null>(null);

  const fichas = useMemo(() => data?.fichas ?? [], [data]);
  const especialistas = useMemo(() => data?.especialistas ?? [], [data]);
  const nameById = useMemo(() => new Map(especialistas.map((e) => [e.user_id, e.nombre])), [especialistas]);
  const fichaUrl = (f: Ficha) => buildFichaUrl(selected, f, "seguimiento-ie");

  // Una fila por IE del padron, con lo que paso en este monitoreo.
  const rows = useMemo<IeRow[]>(() => {
    if (!padron) return [];
    const porIe = new Map<string, Ficha[]>();
    fichas.forEach((f) => {
      if (f.institucion_id) porIe.set(f.institucion_id, [...(porIe.get(f.institucion_id) ?? []), f]);
    });
    const compPorIe = new Map<string, number>();
    compromisos
      .filter((c) => c.estado === "pendiente" && c.institucion_id)
      .forEach((c) => compPorIe.set(c.institucion_id!, (compPorIe.get(c.institucion_id!) ?? 0) + 1));
    return padron.map((ie) => {
      const fs = (porIe.get(ie.id) ?? []).slice().sort((a, b) => b.created_at.localeCompare(a.created_at));
      const finalizadas = fs.filter((f) => f.status === "final").length;
      return {
        ie,
        fichas: fs,
        finalizadas,
        especialistas: [...new Set(fs.map((f) => f.created_by))],
        ultima: fs[0]?.created_at ?? null,
        estado: fs.length === 0 ? "sin_ficha" : finalizadas > 0 ? "finalizada" : "borrador",
        compromisos: compPorIe.get(ie.id) ?? 0,
        texto: normalize(`${ie.nombre} ${ie.cm ?? ""} ${ie.cl ?? ""} ${ie.director ?? ""}`),
      };
    });
  }, [padron, fichas, compromisos]);

  const opciones = useMemo(() => {
    const reis = new Set<string>();
    const distritos = new Set<string>();
    rows.forEach((r) => {
      reis.add(r.ie.rei ?? "Sin REI");
      if (r.ie.distrito) distritos.add(r.ie.distrito);
    });
    return { reis: [...reis].sort(), distritos: [...distritos].sort() };
  }, [rows]);

  const kpi = useMemo(() => {
    const con = rows.filter((r) => r.fichas.length > 0).length;
    return {
      total: rows.length,
      con,
      sin: rows.length - con,
      repetidas: rows.filter((r) => r.fichas.length > 1).length,
      varios: rows.filter((r) => r.especialistas.length > 1).length,
      borrador: rows.filter((r) => r.estado === "borrador").length,
      sinVinculo: fichas.filter((f) => !f.institucion_id).length,
    };
  }, [rows, fichas]);

  const filtradas = useMemo(() => {
    const term = normalize(busca.trim());
    return rows.filter((r) => {
      if (estado === "con_ficha" && r.fichas.length === 0) return false;
      if (estado === "sin_ficha" && r.fichas.length > 0) return false;
      if (estado === "borrador" && r.estado !== "borrador") return false;
      if (estado === "repetidas" && r.fichas.length < 2) return false;
      if (estado === "varios" && r.especialistas.length < 2) return false;
      if (rei && (r.ie.rei ?? "Sin REI") !== rei) return false;
      if (nivel && r.ie.nivel !== nivel) return false;
      if (distrito && r.ie.distrito !== distrito) return false;
      if (esp && !r.especialistas.includes(esp)) return false;
      if (term && !r.texto.includes(term)) return false;
      return true;
    });
  }, [rows, estado, rei, nivel, distrito, esp, busca]);

  const pages = Math.max(1, Math.ceil(filtradas.length / PAGE));
  const pageSafe = Math.min(page, pages - 1);
  const visibles = filtradas.slice(pageSafe * PAGE, pageSafe * PAGE + PAGE);
  const resetPage = () => setPage(0);

  const repetidas = useMemo(
    () =>
      rows
        .filter((r) => r.fichas.length > 1)
        .sort((a, b) => b.especialistas.length - a.especialistas.length || b.fichas.length - a.fichas.length),
    [rows],
  );

  const cobertura = useMemo(() => {
    const m = new Map<string, { rei: string; total: number; con: number; niveles: Record<string, [number, number]> }>();
    rows.forEach((r) => {
      const k = r.ie.rei ?? "Sin REI";
      const e = m.get(k) ?? { rei: k, total: 0, con: 0, niveles: {} };
      e.total += 1;
      if (r.fichas.length) e.con += 1;
      const nv = r.ie.nivel && NIVELES.includes(r.ie.nivel) ? r.ie.nivel : null;
      if (nv) {
        const [c, t] = e.niveles[nv] ?? [0, 0];
        e.niveles[nv] = [c + (r.fichas.length ? 1 : 0), t + 1];
      }
      m.set(k, e);
    });
    return [...m.values()].sort((a, b) => a.rei.localeCompare(b.rei));
  }, [rows]);

  const verRei = (k: string) => {
    setRei(k);
    setEstado("sin_ficha");
    setTab("directorio");
    resetPage();
  };

  const exportar = () => {
    const head = ["Código modular", "Código local", "Institución", "Nivel", "REI", "Distrito", "Gestión", "Director", "Teléfono",
      "Fichas", "Finalizadas", "Especialistas", "Última ficha", "Estado"];
    const esc = (v: string | number | null | undefined) => {
      const s = String(v ?? "");
      return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = filtradas.map((r) =>
      [r.ie.cm, r.ie.cl, r.ie.nombre, r.ie.nivel, r.ie.rei ?? "Sin REI", r.ie.distrito, r.ie.gestion, r.ie.director, r.ie.telefono,
        r.fichas.length, r.finalizadas, r.especialistas.map((u) => nameById.get(u) ?? "").join(" / "),
        r.ultima ? fmtDate(r.ultima) : "", ESTADO_IE[r.estado].label].map(esc).join(";"),
    );
    const blob = new Blob(["﻿" + [head.join(";"), ...lines].join("\r\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `seguimiento-ie-${selected?.codigo ?? "monitoreo"}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

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

  const listo = !loadingData && !!data && !!padron;
  const tabs: { id: Tab; label: string; badge?: number }[] = [
    { id: "directorio", label: "Directorio de IE" },
    { id: "repetidas", label: "IE repetidas", badge: kpi.repetidas },
    { id: "cobertura", label: "Cobertura por REI" },
  ];

  return (
    <div className="tracking-page seg-page max-w-full space-y-5 overflow-x-hidden">
      <SeguimientoToast toast={toast} />

      <SeguimientoHero
        title="Seguimiento de instituciones educativas"
        subtitle="Qué IE del padrón tienen ficha en el monitoreo elegido, cuáles faltan y cuáles se repiten."
        metrics={listo ? [
          { label: "Con ficha", value: `${kpi.con} / ${kpi.total}` },
          { label: "Cobertura", value: kpi.total ? `${fmtNum((kpi.con / kpi.total) * 100)}%` : "—" },
          { label: "Sin ficha", value: kpi.sin },
          { label: "Repetidas", value: kpi.repetidas },
        ] : null}
        monitoreos={monitoreos}
        monitoreoId={monitoreoId}
        onChange={(id) => {
          setMonitoreoId(id);
          resetPage();
        }}
        selected={selected}
      />

      {!monitoreos.length && (
        <div className="tracking-panel seg-empty">No hay monitoreos en modo {isTestMode ? "Prueba" : "Producción"}.</div>
      )}
      {(error || padronError) && (
        <div className="tracking-panel seg-error">No se pudo cargar el seguimiento: {error ?? padronError}</div>
      )}

      {monitoreoId && !error && !padronError && (
        <>
          <nav className="seg-tabs" role="tablist" aria-label="Secciones del seguimiento de IE">
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

          {!listo ? (
            <div className="grid gap-3 md:grid-cols-2">
              <SkeletonCards count={4} />
            </div>
          ) : (
            <>
              {tab === "directorio" && (
                <section className="tracking-panel seg-panel">
                  <header className="seg-panel__head">
                    <div>
                      <h2 className="seg-title">Directorio de IE</h2>
                      <p className="seg-sub">
                        Padrón completo de la UGEL cruzado con las fichas del monitoreo. {kpi.varios} IE fueron visitadas por más de un
                        especialista{kpi.sinVinculo ? `; ${kpi.sinVinculo} ficha(s) no tienen IE vinculada` : ""}.
                      </p>
                    </div>
                    <button type="button" className="seg-btn" onClick={exportar} disabled={!filtradas.length}>
                      Exportar CSV ({filtradas.length})
                    </button>
                  </header>

                  <div className="seg-chips" role="group" aria-label="Filtrar por estado">
                    {FILTROS.map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        aria-pressed={estado === f.id}
                        className={estado === f.id ? "is-active" : ""}
                        onClick={() => {
                          setEstado(f.id);
                          resetPage();
                        }}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>

                  <div className="seg-filter-grid">
                    <input
                      className="rounded-lg border px-3 py-2 text-sm"
                      placeholder="Buscar IE, código o director"
                      value={busca}
                      onChange={(e) => {
                        setBusca(e.target.value);
                        resetPage();
                      }}
                      aria-label="Buscar institución"
                    />
                    <select className="rounded-lg border px-3 py-2 text-sm" value={rei} onChange={(e) => { setRei(e.target.value); resetPage(); }} aria-label="REI">
                      <option value="">Todas las REI</option>
                      {opciones.reis.map((r) => <option key={r} value={r}>{r === "Sin REI" ? r : `REI ${r}`}</option>)}
                    </select>
                    <select className="rounded-lg border px-3 py-2 text-sm" value={nivel} onChange={(e) => { setNivel(e.target.value); resetPage(); }} aria-label="Nivel">
                      <option value="">Todos los niveles</option>
                      {NIVELES.map((n) => <option key={n} value={n}>{n}</option>)}
                    </select>
                    <select className="rounded-lg border px-3 py-2 text-sm" value={distrito} onChange={(e) => { setDistrito(e.target.value); resetPage(); }} aria-label="Distrito">
                      <option value="">Todos los distritos</option>
                      {opciones.distritos.map((d) => <option key={d} value={d}>{d}</option>)}
                    </select>
                    <select className="rounded-lg border px-3 py-2 text-sm" value={esp} onChange={(e) => { setEsp(e.target.value); resetPage(); }} aria-label="Especialista">
                      <option value="">Todos los especialistas</option>
                      {especialistas.map((e) => <option key={e.user_id} value={e.user_id}>{e.nombre}</option>)}
                    </select>
                  </div>

                  {filtradas.length === 0 ? (
                    <p className="seg-empty-inline">Ninguna IE coincide con los filtros.</p>
                  ) : (
                    <>
                      <div className="seg-table-wrap">
                        <table className="seg-table">
                          <thead>
                            <tr>
                              <th>Institución</th>
                              <th>Nivel</th>
                              <th>REI</th>
                              <th>Distrito</th>
                              <th className="text-right">Fichas</th>
                              <th>Especialista</th>
                              <th>Última ficha</th>
                              <th>Estado</th>
                              <th aria-label="Detalle" />
                            </tr>
                          </thead>
                          <tbody>
                            {visibles.map((r) => {
                              const open = abierta === r.ie.id;
                              return (
                                <Fragment key={r.ie.id}>
                                  <tr className={open ? "is-open" : ""}>
                                    <td>
                                      <div className="seg-strong">{r.ie.nombre}</div>
                                      <div className="seg-muted">{[r.ie.cm && `CM ${r.ie.cm}`, r.ie.cl && `Local ${r.ie.cl}`].filter(Boolean).join(" · ")}</div>
                                    </td>
                                    <td>{r.ie.nivel ?? "—"}</td>
                                    <td className="seg-num">{r.ie.rei ?? "Sin REI"}</td>
                                    <td>{r.ie.distrito ?? "—"}</td>
                                    <td className="text-right seg-num">
                                      {r.fichas.length || "—"}
                                      {r.fichas.length > 1 && <span className="seg-tag">repetida</span>}
                                    </td>
                                    <td>
                                      {r.especialistas.length === 0 ? "—" : r.especialistas.map((u) => (
                                        <div key={u}>{nameById.get(u) ?? "—"}</div>
                                      ))}
                                    </td>
                                    <td>
                                      {r.ultima ? (
                                        <>
                                          <div>{fmtDate(r.ultima)}</div>
                                          <div className="seg-muted">{(() => { const d = daysSince(r.ultima) ?? 0; return d === 0 ? "Hoy" : `Hace ${d} día${d === 1 ? "" : "s"}`; })()}</div>
                                        </>
                                      ) : "—"}
                                    </td>
                                    <td>
                                      <span className={`seg-pill ${ESTADO_IE[r.estado].cls}`}>{ESTADO_IE[r.estado].label}</span>
                                      {r.compromisos > 0 && <div className="seg-muted">{r.compromisos} compromiso(s) abierto(s)</div>}
                                    </td>
                                    <td className="text-right">
                                      <button
                                        type="button"
                                        className="seg-link"
                                        aria-expanded={open}
                                        onClick={() => setAbierta(open ? null : r.ie.id)}
                                      >
                                        {open ? "Cerrar" : "Ver"}
                                      </button>
                                    </td>
                                  </tr>
                                  {open && (
                                    <tr className="seg-detail-row">
                                      <td colSpan={9}>
                                        <div className="seg-detail">
                                          <div>
                                            <div className="seg-col-title">Datos de la IE</div>
                                            <div>Director(a): {r.ie.director ?? "—"}</div>
                                            <div>Teléfono: {r.ie.telefono ?? "—"}</div>
                                            <div>Gestión: {r.ie.gestion ?? "—"}</div>
                                          </div>
                                          <div>
                                            <div className="seg-col-title">Fichas en este monitoreo</div>
                                            {r.fichas.length === 0 ? (
                                              <div className="seg-muted">Aún no tiene fichas.</div>
                                            ) : (
                                              r.fichas.map((f) => {
                                                const url = fichaUrl(f);
                                                return (
                                                  <div key={f.id} className="seg-list__meta">
                                                    <span className={`seg-pill ${f.status === "final" ? "is-ok" : "is-media"}`}>{f.status === "final" ? "Finalizada" : "Borrador"}</span>
                                                    <span>{nameById.get(f.created_by) ?? "—"} · registrada {fmtDate(f.created_at)}{f.fecha_aplicacion ? ` · aplicada ${fmtDate(f.fecha_aplicacion)}` : ""}</span>
                                                    {url && <Link className="seg-link" to={url}>Abrir ficha</Link>}
                                                  </div>
                                                );
                                              })
                                            )}
                                          </div>
                                        </div>
                                      </td>
                                    </tr>
                                  )}
                                </Fragment>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                      <div className="seg-pager">
                        <span>
                          {pageSafe * PAGE + 1}–{Math.min(filtradas.length, (pageSafe + 1) * PAGE)} de {filtradas.length} IE
                        </span>
                        <div>
                          <button type="button" className="seg-btn" disabled={pageSafe === 0} onClick={() => setPage(pageSafe - 1)}>Anterior</button>
                          <button type="button" className="seg-btn" disabled={pageSafe >= pages - 1} onClick={() => setPage(pageSafe + 1)}>Siguiente</button>
                        </div>
                      </div>
                    </>
                  )}
                </section>
              )}

              {tab === "repetidas" && (
                <section className="tracking-panel seg-panel">
                  <header className="seg-panel__head">
                    <div>
                      <h2 className="seg-title">IE con más de una ficha</h2>
                      <p className="seg-sub">
                        «Varios especialistas»: la IE fue visitada por más de una persona (posible doble asignación).
                        «Mismo especialista»: posible ficha duplicada; revisar si una debe anularse.
                      </p>
                    </div>
                  </header>
                  {repetidas.length === 0 ? (
                    <p className="seg-empty-inline">Ninguna IE tiene más de una ficha en este monitoreo.</p>
                  ) : (
                    <ul className="seg-comp-list">
                      {repetidas.map((r) => {
                        const varios = r.especialistas.length > 1;
                        return (
                          <li key={r.ie.id} className={`seg-comp ${varios ? "is-late" : ""}`}>
                            <div className="seg-comp__main">
                              <div className="seg-comp__top">
                                <span className={`seg-pill ${varios ? "is-alta" : "is-media"}`}>{varios ? "Varios especialistas" : "Mismo especialista"}</span>
                                <span className="seg-strong">{r.ie.nombre}</span>
                                <span className="seg-muted">{[r.ie.cm, r.ie.nivel, r.ie.rei ? `REI ${r.ie.rei}` : null].filter(Boolean).join(" · ")}</span>
                              </div>
                              {r.fichas.map((f) => {
                                const url = fichaUrl(f);
                                return (
                                  <div key={f.id} className="seg-list__meta">
                                    <span className={`seg-pill ${f.status === "final" ? "is-ok" : "is-media"}`}>{f.status === "final" ? "Finalizada" : "Borrador"}</span>
                                    <span>{nameById.get(f.created_by) ?? "—"} · registrada {fmtDate(f.created_at)}{f.fecha_aplicacion ? ` · aplicada ${fmtDate(f.fecha_aplicacion)}` : ""}</span>
                                    {url && <Link className="seg-link" to={url}>Abrir ficha</Link>}
                                  </div>
                                );
                              })}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </section>
              )}

              {tab === "cobertura" && (
                <section className="tracking-panel seg-panel">
                  <header className="seg-panel__head">
                    <div>
                      <h2 className="seg-title">Cobertura por REI</h2>
                      <p className="seg-sub">IE del padrón con al menos una ficha, por REI y por nivel. Elige una REI para ver las IE que faltan.</p>
                    </div>
                  </header>
                  <div className="seg-table-wrap">
                    <table className="seg-table">
                      <thead>
                        <tr>
                          <th>REI</th>
                          <th className="text-right">IE con ficha</th>
                          <th>Cobertura</th>
                          {NIVELES.map((n) => <th key={n} className="text-right">{n}</th>)}
                          <th aria-label="Acción" />
                        </tr>
                      </thead>
                      <tbody>
                        {cobertura.map((c) => {
                          const pct = c.total ? (c.con / c.total) * 100 : 0;
                          return (
                            <tr key={c.rei}>
                              <td className="seg-strong">{c.rei === "Sin REI" ? c.rei : `REI ${c.rei}`}</td>
                              <td className="text-right seg-num">{c.con} / {c.total}</td>
                              <td className="seg-progress-cell">
                                <span className="seg-progress" aria-hidden="true"><span style={{ width: `${pct}%` }} /></span>
                                <span className="seg-muted">{fmtNum(pct)}%</span>
                              </td>
                              {NIVELES.map((n) => {
                                const v = c.niveles[n];
                                return <td key={n} className="text-right seg-num">{v ? `${v[0]} / ${v[1]}` : "—"}</td>;
                              })}
                              <td className="text-right">
                                {c.con < c.total && (
                                  <button type="button" className="seg-link" onClick={() => verRei(c.rei)}>Ver faltantes</button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
