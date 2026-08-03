import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../app/AuthProvider";
import { canSeeAllRole } from "../lib/roles";
import { daysFromToday, isMonitoreoExpired } from "../lib/monitoreoVigencia";
import { useAppConfig } from "../app/AppConfigProvider";
import { loadCddRegisteredRunCount, loadMonitoringRunCounts } from "../lib/monitoringRunCounts";

type MonitoreoCard = {
  id: string;
  key: string;
  title: string;
  subtitle: string;
  descriptionFull: string;
  to: string;
  fecha_fin?: string | null;
  runCount: number;
};

function MonitorIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 19c.5-3.5 2.3-5.5 5.5-5.5s5 2 5.5 5.5" />
      <path d="M16 7h4M16 11h4M17 15h3" />
    </svg>
  );
}

function FormsIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="6" y="4" width="13" height="16" rx="2" />
      <path d="M3 8v10a3 3 0 0 0 3 3h9M10 9h5M10 13h5M10 17h3" />
    </svg>
  );
}

function cls(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function ClipboardIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M9 5h6" />
      <path d="M9 3.5h6a1.5 1.5 0 0 1 1.5 1.5v1A1.5 1.5 0 0 1 15 7.5H9A1.5 1.5 0 0 1 7.5 6V5A1.5 1.5 0 0 1 9 3.5Z" />
      <path d="M7.5 5H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-1.5" />
      <path d="M8 12h8M8 16h5" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4-4" />
    </svg>
  );
}

function BackIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

function ChevronIcon({ direction }: { direction: "left" | "right" }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.9">
      <path d={direction === "left" ? "m15 18-6-6 6-6" : "m9 18 6-6-6-6"} />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M7 3v4M17 3v4M4 9h16" />
      <rect x="4" y="5" width="16" height="16" rx="2.5" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M2.6 12S6 5 12 5s9.4 7 9.4 7-3.4 7-9.4 7-9.4-7-9.4-7Z" />
      <circle cx="12" cy="12" r="2.6" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="agebre-action-icon h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 10.8v5" />
      <path d="M12 7.5h.01" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.9">
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

function formatDate(date?: string | null) {
  if (!date) return "Sin fecha fin";
  const [y, m, d] = date.split("-");
  if (!y || !m || !d) return date;
  return `${d}/${m}/${y}`;
}

function temporalLabel(date?: string | null) {
  const days = daysFromToday(date);
  if (days == null) return "Sin fecha de vencimiento";
  if (days < 0) return `Vencido hace ${Math.abs(days)} días`;
  if (days === 0) return "Vence hoy";
  return `Faltan ${days} días`;
}

export function MonitoreoPage() {
  const nav = useNavigate();
  const { profile, profileLoading } = useAuth();
  const { isTestMode } = useAppConfig();
  const [loading, setLoading] = useState(true);
  const [monitoreos, setMonitoreos] = useState<MonitoreoCard[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [estadoFilter, setEstadoFilter] = useState<"ALL" | "DISPONIBLE" | "VENCIDO">("ALL");
  const [descModal, setDescModal] = useState<MonitoreoCard | null>(null);
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const [totalFichaCount, setTotalFichaCount] = useState(0);
  const [cddRunCount, setCddRunCount] = useState(0);

  useEffect(() => {
    let alive = true;
    if (profileLoading) return;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        if (!profile?.id) {
          setMonitoreos([]);
          setTotalFichaCount(0);
          setCddRunCount(0);
          setLoading(false);
          return;
        }

        const isResponsableCdD = profile.role === "responsable_cdd";
        const canSeeAll = !isResponsableCdD && canSeeAllRole(profile.role);
        let ids: string[] = [];

        if (!canSeeAll) {
          const { data: asig, error: asigError } = await supabase
            .from("monitoreo_asignacion")
            .select("monitoreo_id")
            .eq("user_id", profile.id);
          if (asigError) throw new Error(asigError.message);
          ids = (asig ?? []).map((r: any) => r.monitoreo_id);
          if (!ids.length) {
            if (!alive) return;
            setMonitoreos([]);
            setTotalFichaCount(0);
            setCddRunCount(0);
            setLoading(false);
            return;
          }
        }

        const q = supabase
          .from("monitoreo_catalog")
          .select("id, anio, codigo, nombre, descripcion, is_active, fecha_fin")
          .eq("is_active", true)
          .order("anio", { ascending: false })
          .order("nombre", { ascending: true });

        const { data, error: monError } = canSeeAll ? await q : await q.in("id", ids);
        if (monError) throw new Error(monError.message);

        const allowed = canSeeAll ? (data ?? []) : (data ?? []).filter((m: any) => ids.includes(m.id));
        const allowedIds = allowed.map((m: any) => m.id);
        const fichaCountResult = allowedIds.length
          ? await supabase
              .from("ficha_catalog")
              .select("id", { count: "exact", head: true })
              .in("monitoreo_id", allowedIds)
              .eq("is_active", true)
          : { count: 0, error: null };
        if (fichaCountResult.error) throw new Error(fichaCountResult.error.message);
        const [runCounts, cddCount] = await Promise.all([
          loadMonitoringRunCounts(allowedIds, isTestMode),
          loadCddRegisteredRunCount(allowedIds, isTestMode),
        ]);
        const items = allowed.map((m: any) => ({
          id: m.id,
          key: m.codigo,
          title: m.nombre,
          subtitle: m.descripcion?.trim() || `${m.anio}`,
          descriptionFull: m.descripcion?.trim() || `${m.anio}`,
          to: `/app/monitoreo/${m.codigo}`,
          fecha_fin: m.fecha_fin ?? null,
          runCount: runCounts[m.id] ?? 0,
        })) as MonitoreoCard[];

        if (!alive) return;
        setMonitoreos(items);
        setTotalFichaCount(fichaCountResult.count ?? 0);
        setCddRunCount(cddCount);
        setLoading(false);
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message || "No se pudo cargar los monitoreos.");
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [profileLoading, profile?.id, profile?.role, isTestMode]);

  const cards = useMemo(() => {
    const term = query.trim().toLowerCase();
    return monitoreos.filter((m) => {
      const expired = isMonitoreoExpired(m.fecha_fin);
      if (estadoFilter === "DISPONIBLE" && expired) return false;
      if (estadoFilter === "VENCIDO" && !expired) return false;
      if (!term) return true;
      return (
        m.title.toLowerCase().includes(term) ||
        m.key.toLowerCase().includes(term) ||
        m.subtitle.toLowerCase().includes(term)
      );
    });
  }, [monitoreos, query, estadoFilter]);

  const totalPages = Math.max(1, Math.ceil(cards.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageStart = cards.length ? (safePage - 1) * pageSize + 1 : 0;
  const pageEnd = Math.min(safePage * pageSize, cards.length);
  const pagedCards = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return cards.slice(start, start + pageSize);
  }, [cards, safePage, pageSize]);

  const totalRunCount = useMemo(
    () => monitoreos.reduce((total, item) => total + item.runCount, 0),
    [monitoreos],
  );
  const monitoringRunCount = Math.max(0, totalRunCount - cddRunCount);

  const pageNumbers = useMemo(() => {
    const first = Math.max(1, Math.min(safePage - 2, totalPages - 4));
    const last = Math.min(totalPages, first + 4);
    return Array.from({ length: last - first + 1 }, (_, index) => first + index);
  }, [safePage, totalPages]);

  useEffect(() => {
    setPage(1);
  }, [query, estadoFilter, pageSize, monitoreos.length]);

  return (
    <div className="monitoring-page min-w-0 text-white">
      <section className="monitoring-hero grid gap-4 rounded-2xl border p-4 sm:p-5">
        <div className="flex min-w-0 items-start gap-3 sm:gap-4">
          <div className="monitoring-hero-icon grid h-12 w-12 shrink-0 place-items-center rounded-2xl border sm:h-14 sm:w-14">
            <ClipboardIcon />
          </div>
          <div className="min-w-0">
            <button type="button" onClick={() => nav(-1)} className="monitoring-back-button mb-1.5 inline-flex items-center gap-1 text-[11px] font-semibold">
              <BackIcon />
              Volver
            </button>
            <h1>Elegir monitoreo</h1>
            <p className="mt-1 text-sm text-[var(--app-muted)]">Selecciona el monitoreo y luego la ficha o formulario correspondiente.</p>
          </div>
        </div>

        <div className="monitoring-kpi-grid grid gap-2.5">
          <div className="monitoring-summary is-runs flex items-center gap-3 rounded-xl border px-3.5 py-3">
            <div className="monitoring-summary-icon grid h-10 w-10 shrink-0 place-items-center rounded-xl"><ClipboardIcon /></div>
            <div className="min-w-0">
              <div className="text-[11px] font-semibold text-[var(--app-muted)]">Fichas de monitoreos</div>
              <div className="monitoring-accent-text mt-0.5 text-2xl font-bold tracking-tight">{loading ? "—" : monitoringRunCount}</div>
              <div className="mt-0.5 text-[10px] text-[var(--app-muted-2)]">Sin registros CdD</div>
            </div>
          </div>
          <div className="monitoring-summary is-cdd flex items-center gap-3 rounded-xl border px-3.5 py-3">
            <div className="monitoring-summary-icon grid h-10 w-10 shrink-0 place-items-center rounded-xl"><ClipboardIcon /></div>
            <div className="min-w-0">
              <div className="text-[11px] font-semibold text-[var(--app-muted)]">Fichas CdD</div>
              <div className="mt-0.5 text-2xl font-bold tracking-tight text-[var(--app-violet)]">{loading ? "—" : cddRunCount}</div>
              <div className="mt-0.5 text-[10px] text-[var(--app-muted-2)]">Registros responsable CdD</div>
            </div>
          </div>
          <div className="monitoring-summary is-monitorings flex items-center gap-3 rounded-xl border px-3.5 py-3">
            <div className="monitoring-summary-icon grid h-10 w-10 shrink-0 place-items-center rounded-xl"><MonitorIcon /></div>
            <div className="min-w-0">
              <div className="text-[11px] font-semibold text-[var(--app-muted)]">Monitoreos</div>
              <div className="mt-0.5 text-2xl font-bold tracking-tight text-[var(--app-info)]">{loading ? "—" : monitoreos.length}</div>
              <div className="mt-0.5 text-[10px] text-[var(--app-muted-2)]">Monitoreos activos</div>
            </div>
          </div>
          <div className="monitoring-summary is-forms flex items-center gap-3 rounded-xl border px-3.5 py-3">
            <div className="monitoring-summary-icon grid h-10 w-10 shrink-0 place-items-center rounded-xl"><FormsIcon /></div>
            <div className="min-w-0">
              <div className="text-[11px] font-semibold text-[var(--app-muted)]">Fichas configuradas</div>
              <div className="mt-0.5 text-2xl font-bold tracking-tight text-[var(--app-warning)]">{loading ? "—" : totalFichaCount}</div>
              <div className="mt-0.5 text-[10px] text-[var(--app-muted-2)]">Fichas configuradas</div>
            </div>
          </div>
        </div>
      </section>

      <section className="monitoring-toolbar mt-4 grid gap-3 rounded-2xl border p-3 sm:grid-cols-[minmax(0,1fr)_13rem_auto] sm:items-center sm:p-4">
        <label className="monitoring-search relative block min-w-0">
          <span className="pointer-events-none absolute inset-y-0 left-3 grid place-items-center text-[var(--app-muted-2)]"><SearchIcon /></span>
          <span className="sr-only">Buscar monitoreo</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar monitoreo..."
            className="h-11 w-full min-w-0 rounded-xl border pl-11 pr-3 text-sm"
          />
        </label>
        <label>
          <span className="sr-only">Estado del monitoreo</span>
          <select
            aria-label="Estado del monitoreo"
            value={estadoFilter}
            onChange={(e) => setEstadoFilter(e.target.value as "ALL" | "DISPONIBLE" | "VENCIDO")}
            className="h-11 w-full rounded-xl border px-3 text-sm"
          >
            <option value="ALL">Todos los estados</option>
            <option value="DISPONIBLE">Disponibles</option>
            <option value="VENCIDO">Vencidos</option>
          </select>
        </label>
        <label className="monitoring-page-size flex h-11 items-center justify-between gap-2 rounded-xl border pl-3 text-xs font-semibold text-[var(--app-muted)] sm:justify-start">
          Mostrar
          <select
            aria-label="Monitoreos por página"
            value={String(pageSize)}
            onChange={(e) => setPageSize(Number(e.target.value))}
            className="h-full min-w-16 rounded-xl border-0 bg-transparent px-2 text-sm font-semibold"
          >
            <option value="10">10</option>
            <option value="20">20</option>
            <option value="50">50</option>
          </select>
        </label>
      </section>

      <div className="monitoring-grid mt-4 grid grid-cols-1 gap-4">
        {loading ? (
          <div className="monitoring-empty-state rounded-2xl border p-6 text-center text-sm text-[var(--app-muted)] lg:col-span-2">
            <div className="monitoring-loading-icon mx-auto mb-3 grid h-10 w-10 place-items-center rounded-xl"><ClipboardIcon /></div>
            Cargando monitoreos...
          </div>
        ) : error ? (
          <div className="monitoring-grid-message rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-100 lg:col-span-2">
            {error}
          </div>
        ) : cards.length === 0 ? (
          <div className="monitoring-empty-state rounded-2xl border p-8 text-center lg:col-span-2">
            <div className="monitoring-summary-icon mx-auto grid h-12 w-12 place-items-center rounded-2xl"><SearchIcon /></div>
            <div className="mt-3 text-sm font-semibold text-[var(--app-text)]">No encontramos monitoreos</div>
            <p className="mt-1 text-xs text-[var(--app-muted)]">Prueba con otro término o cambia el filtro de estado.</p>
          </div>
        ) : (
          pagedCards.map((m) => {
            const expired = isMonitoreoExpired(m.fecha_fin);
            const hasDescription = !!(m.descriptionFull || "").trim();
            return (
              <div
                key={m.id}
                onClick={() => {
                  if (expired) return;
                  nav(m.to);
                }}
                role="group"
                aria-labelledby={`monitoreo-title-${m.id}`}
                className={cls(
                  "monitoring-card agebre-uniform-card flex min-h-[244px] w-full min-w-0 flex-col overflow-hidden rounded-2xl border p-4 text-left sm:p-5",
                  expired ? "is-disabled cursor-not-allowed" : "cursor-pointer"
                )}
              >
                <div className="mb-4 flex shrink-0 items-start justify-between gap-3">
                  <div className="monitoring-card-icon flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border">
                    <ClipboardIcon />
                  </div>
                  {expired ? (
                    <span className="badge-red inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold leading-none">
                      <span className="h-1.5 w-1.5 rounded-full bg-red-300" />
                      Vencido
                    </span>
                  ) : (
                    <span className="badge-green inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold leading-none">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
                      Disponible
                    </span>
                  )}
                </div>

                <h2
                  id={`monitoreo-title-${m.id}`}
                  className="agebre-card-title min-h-11 shrink-0 text-[15px] font-bold leading-[1.4] tracking-[-0.012em] text-white sm:text-base"
                >
                  {m.title}
                </h2>

                <div className="monitoring-card-meta mt-4 flex flex-wrap items-center justify-between gap-2 border-b pb-4 text-[11px] text-[var(--app-muted)]">
                  <div className="flex min-w-0 items-center gap-2">
                    <CalendarIcon />
                    <span className="truncate">Vence: <strong className="font-semibold text-[var(--app-text)]">{formatDate(m.fecha_fin)}</strong></span>
                  </div>
                  <span className="monitoring-run-count inline-flex max-w-full items-center gap-1.5 rounded-md px-2 py-1 font-semibold" title={`${m.runCount} fichas run registradas por monitores`}>
                    <ClipboardIcon />
                    <span className="truncate">{m.runCount} {m.runCount === 1 ? "ficha" : "fichas"}</span>
                  </span>
                </div>

                <div className="mt-auto grid shrink-0 grid-cols-2 gap-2 pt-4">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setDescModal(m);
                    }}
                    disabled={!hasDescription}
                    className="monitoring-secondary-action inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg border px-3 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    <EyeIcon />
                    Ver más
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (!expired) nav(m.to);
                    }}
                    disabled={expired}
                    className={cls(
                      "inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg border px-3 text-xs font-semibold transition",
                      expired
                        ? "monitoring-disabled-action cursor-not-allowed"
                        : "executive-primary-action"
                    )}
                  >
                    Elegir ficha
                    <ArrowIcon />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
      {!loading && !error && cards.length > 0 && (
        <div className="monitoring-pagination mt-4 flex flex-col gap-3 rounded-2xl border px-4 py-3 text-xs sm:flex-row sm:items-center sm:justify-between">
          <div className="text-[var(--app-muted)]">
            Mostrando <strong className="font-semibold text-[var(--app-text)]">{pageStart}-{pageEnd}</strong> de <strong className="font-semibold text-[var(--app-text)]">{cards.length}</strong> monitoreos
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Página anterior"
              disabled={safePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="monitoring-pagination-button grid h-9 w-9 place-items-center rounded-lg border transition disabled:cursor-not-allowed disabled:opacity-35"
            >
              <ChevronIcon direction="left" />
            </button>
            {pageNumbers.map((pageNumber) => (
              <button
                key={pageNumber}
                type="button"
                aria-label={`Página ${pageNumber}`}
                aria-current={pageNumber === safePage ? "page" : undefined}
                onClick={() => setPage(pageNumber)}
                className="monitoring-pagination-button grid h-9 min-w-9 place-items-center rounded-lg border px-2 font-semibold transition"
              >
                {pageNumber}
              </button>
            ))}
            <button
              type="button"
              aria-label="Página siguiente"
              disabled={safePage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="monitoring-pagination-button grid h-9 w-9 place-items-center rounded-lg border transition disabled:cursor-not-allowed disabled:opacity-35"
            >
              <ChevronIcon direction="right" />
            </button>
          </div>
        </div>
      )}
      {descModal && (
        <div className="agebre-modal-overlay fixed inset-0 z-[120] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="agebre-modal-content w-full max-w-3xl overflow-hidden rounded-3xl border border-white/10 bg-zinc-950 shadow-2xl shadow-black/40">
            <div className="border-b border-white/10 bg-white/[0.03] p-4 sm:p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-black/25 text-white/80">
                    <ClipboardIcon />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-medium uppercase tracking-[0.18em] text-white/45">Monitoreo</div>
                    <h2 className="agebre-modal-title mt-1 max-h-[78px] text-lg font-bold leading-[1.3] text-white sm:text-xl">
                      {descModal.title}
                    </h2>
                  </div>
                </div>
                <button
                  type="button"
                  title="Cerrar"
                  aria-label="Cerrar"
                  onClick={() => setDescModal(null)}
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/70 transition hover:border-white/20 hover:bg-white/10 hover:text-white"
                >
                  <CloseIcon />
                </button>
              </div>
            </div>

            <div className="space-y-4 p-4 sm:p-5">
              <div className="flex flex-wrap items-center gap-2">
                {isMonitoreoExpired(descModal.fecha_fin) ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-100">
                    <span className="h-2 w-2 rounded-full bg-red-300" />
                    Vencido
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-100">
                    <span className="h-2 w-2 rounded-full bg-emerald-300" />
                    Disponible
                  </span>
                )}
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/65">
                  <CalendarIcon />
                  <span>Vence: {formatDate(descModal.fecha_fin)}</span>
                </div>
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/65">
                  {temporalLabel(descModal.fecha_fin)}
                </div>
              </div>

              {isMonitoreoExpired(descModal.fecha_fin) && (
                <div className="rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                  Este monitoreo está vencido. La ficha no se puede abrir desde este acceso.
                </div>
              )}

              <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-white/45">
                  <InfoIcon />
                  Descripción
                </div>
                <div className="max-h-[34vh] overflow-y-auto whitespace-pre-wrap pr-1 text-sm leading-6 text-white/75">
                  {descModal.descriptionFull || "Sin descripción."}
                </div>
              </section>

              <div className="flex flex-col gap-2 border-t border-white/10 pt-4 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setDescModal(null)}
                  className="inline-flex h-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 text-sm font-medium text-white/75 transition hover:border-white/20 hover:bg-white/10 hover:text-white"
                >
                  Cerrar
                </button>
                <button
                  type="button"
                  disabled={isMonitoreoExpired(descModal.fecha_fin)}
                  onClick={() => {
                    if (isMonitoreoExpired(descModal.fecha_fin)) return;
                    nav(descModal.to);
                  }}
                  className={cls(
                    "inline-flex h-10 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-semibold transition",
                    isMonitoreoExpired(descModal.fecha_fin)
                      ? "cursor-not-allowed border-white/10 bg-white/5 text-white/40"
                      : "executive-primary-action"
                  )}
                >
                  Elegir ficha
                  <ArrowIcon />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
