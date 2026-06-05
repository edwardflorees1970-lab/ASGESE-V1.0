import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../app/AuthProvider";
import { canSeeAllRole } from "../lib/roles";
import { daysFromToday, isMonitoreoExpired } from "../lib/monitoreoVigencia";

type MonitoreoCard = {
  id: string;
  key: string;
  title: string;
  subtitle: string;
  descriptionFull: string;
  to: string;
  fecha_fin?: string | null;
};

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
  const [loading, setLoading] = useState(true);
  const [monitoreos, setMonitoreos] = useState<MonitoreoCard[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [estadoFilter, setEstadoFilter] = useState<"ALL" | "DISPONIBLE" | "VENCIDO">("ALL");
  const [descModal, setDescModal] = useState<MonitoreoCard | null>(null);
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);

  useEffect(() => {
    let alive = true;
    if (profileLoading) return;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        if (!profile?.id) {
          setMonitoreos([]);
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
        const items = allowed.map((m: any) => ({
          id: m.id,
          key: m.codigo,
          title: m.nombre,
          subtitle: m.descripcion?.trim() || `${m.anio}`,
          descriptionFull: m.descripcion?.trim() || `${m.anio}`,
          to: `/app/monitoreo/${m.codigo}`,
          fecha_fin: m.fecha_fin ?? null,
        })) as MonitoreoCard[];

        if (!alive) return;
        setMonitoreos(items);
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
  }, [profileLoading, profile?.id, profile?.role]);

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

  useEffect(() => {
    setPage(1);
  }, [query, estadoFilter, pageSize, monitoreos.length]);

  return (
    <div className="text-white">
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => nav(-1)}
          className="self-start rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 hover:bg-white/10"
        >
          ← Volver
        </button>
        <div>
          <h1 className="text-xl font-semibold tracking-tight md:text-2xl">Elegir monitoreo</h1>
          <p className="mt-1 text-sm text-white/60">Selecciona el monitoreo y luego la ficha/formulario.</p>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar monitoreo"
            className="w-full min-w-0 flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm sm:min-w-[220px]"
          />
          <select
            value={estadoFilter}
            onChange={(e) => setEstadoFilter(e.target.value as "ALL" | "DISPONIBLE" | "VENCIDO")}
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm"
          >
            <option value="ALL">Todos</option>
            <option value="DISPONIBLE">Disponibles</option>
            <option value="VENCIDO">Vencidos</option>
          </select>
          <label className="flex items-center gap-2 text-xs text-white/60">
            Mostrar:
            <select
              value={String(pageSize)}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm"
            >
              <option value="10">10</option>
              <option value="20">20</option>
              <option value="50">50</option>
            </select>
          </label>
      </div>

      <div className="mt-5 grid auto-rows-[260px] grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {loading ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/60 sm:col-span-2 xl:col-span-3">
            Cargando monitoreos...
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-100 sm:col-span-2 xl:col-span-3">
            {error}
          </div>
        ) : cards.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/60 sm:col-span-2 xl:col-span-3">
            No tienes monitoreos asignados.
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
                onKeyDown={(e) => {
                  if (e.key !== "Enter" && e.key !== " ") return;
                  e.preventDefault();
                  if (expired) return;
                  nav(m.to);
                }}
                role="button"
                tabIndex={0}
                className={cls(
                  "agebre-uniform-card flex h-[260px] w-full min-w-0 flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-5 text-left shadow-lg shadow-black/10",
                  expired ? "is-disabled cursor-not-allowed opacity-80" : "hover:bg-white/10"
                )}
              >
                <div className="mb-4 flex h-10 shrink-0 items-start justify-between gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-black/20 text-white/75">
                    <ClipboardIcon />
                  </div>
                  {expired ? (
                    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-red-500/30 bg-red-500/10 px-2.5 py-1 text-[11px] font-medium leading-none text-red-100">
                      <span className="h-1.5 w-1.5 rounded-full bg-red-300" />
                      Vencido
                    </span>
                  ) : (
                    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium leading-none text-emerald-100">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
                      Disponible
                    </span>
                  )}
                </div>

                <h2
                  className="agebre-card-title h-12 shrink-0 text-base font-bold leading-[1.35] tracking-tight text-white"
                >
                  {m.title}
                </h2>

                <div className="flex flex-1 flex-col pt-4">
                  <div className="flex h-5 shrink-0 items-center gap-2 text-xs text-white/60">
                    <CalendarIcon />
                    <span className="truncate">Vence: {formatDate(m.fecha_fin)}</span>
                  </div>
                </div>

                <div className="mt-auto grid shrink-0 gap-3">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setDescModal(m);
                    }}
                    disabled={!hasDescription}
                    className="inline-flex h-8 w-full items-center justify-center gap-2 rounded-lg border border-white/15 bg-white/10 px-3 text-xs font-medium text-white/80 transition hover:border-white/25 hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-45"
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
                      "inline-flex h-9 w-full items-center justify-center gap-2 rounded-xl border px-3 text-xs font-semibold transition",
                      expired
                        ? "cursor-not-allowed border-white/10 bg-black/20 text-white/45"
                        : "border-white/10 bg-white text-zinc-950 hover:bg-white/90"
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
        <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-white/60 sm:flex-row sm:items-center sm:justify-between">
          <div>
            Mostrando {pageStart}-{pageEnd} de {cards.length} monitoreos
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className={cls(
                "rounded-xl border px-3 py-2 text-xs transition",
                safePage <= 1
                  ? "border-white/10 text-white/30"
                  : "border-white/10 bg-white/10 text-white/85 hover:bg-white/15"
              )}
            >
              Anterior
            </button>
            <span className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-white/75">
              {safePage} / {totalPages}
            </span>
            <button
              type="button"
              disabled={safePage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className={cls(
                "rounded-xl border px-3 py-2 text-xs transition",
                safePage >= totalPages
                  ? "border-white/10 text-white/30"
                  : "border-white/10 bg-white/10 text-white/85 hover:bg-white/15"
              )}
            >
              Siguiente
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
                      : "border-white/10 bg-white text-zinc-950 hover:bg-white/90"
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
