import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../app/AuthProvider";
import { useAppConfig } from "../app/AppConfigProvider";
import { getFichasByMonitoreo } from "../lib/monitoreoApi";
import { canSeeAllRole } from "../lib/roles";
import { daysFromToday, isMonitoreoExpired } from "../lib/monitoreoVigencia";

type FichaCard = {
  key: string; // "ESCRIBE" | "LEE" | "ORAL"
  title: string;
  subtitle: string;
};

type MonitoreoRow = {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  anio: number;
  fecha_fin: string;
};

function FormIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M7 3.5h7l3 3V20a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 5 20V5A1.5 1.5 0 0 1 6.5 3.5H7Z" />
      <path d="M14 3.5V7h3.5" />
      <path d="M8 11h8M8 15h8M8 18h5" />
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

export function MonitoreoDetailPage() {
  const nav = useNavigate();
  const { monitoreoCodigo } = useParams();
  const { profile, profileLoading } = useAuth();
  const { isTestMode } = useAppConfig();

  const [loading, setLoading] = useState(true);
  const [monitoreo, setMonitoreo] = useState<MonitoreoRow | null>(null);
  const [assigned, setAssigned] = useState(false);
  const [fichas, setFichas] = useState<FichaCard[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);
  const [descModal, setDescModal] = useState<FichaCard | null>(null);

  useEffect(() => {
    let alive = true;
    if (!monitoreoCodigo || profileLoading) return;

    (async () => {
      setLoading(true);
      setError(null);
      setExpired(false);
      setFichas([]);
      try {
        const { data: monData, error: monError } = await supabase
          .from("monitoreo_catalog")
          .select("id, codigo, nombre, descripcion, anio, is_active, fecha_fin")
          .eq("codigo", monitoreoCodigo)
          .eq("is_active", true)
          .eq("is_test", isTestMode)
          .order("anio", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (monError) throw new Error(monError.message);
        if (!monData) {
          if (!alive) return;
          setMonitoreo(null);
          setAssigned(false);
          setLoading(false);
          return;
        }

        const mon = monData as MonitoreoRow;
        if (isMonitoreoExpired(mon.fecha_fin)) {
          if (!alive) return;
          setMonitoreo(mon);
          setAssigned(false);
          setExpired(true);
          setLoading(false);
          return;
        }
        setMonitoreo(mon);

        const canSeeAll = canSeeAllRole(profile?.role);
        let allow = canSeeAll;
        if (!canSeeAll && profile?.id) {
          const { data: asig, error: asigError } = await supabase
            .from("monitoreo_asignacion")
            .select("id")
            .eq("monitoreo_id", mon.id)
            .eq("user_id", profile.id)
            .limit(1);
          if (asigError) throw new Error(asigError.message);
          allow = (asig ?? []).length > 0;
        }
        setAssigned(allow);

        if (!alive) return;

        if (allow) {
          const rows = await getFichasByMonitoreo(mon.id);
          const seen = new Set<string>();
          const cards = rows
            .filter((r) => {
              const k = (r.codigo || "").toUpperCase();
              if (!k || seen.has(k)) return false;
              seen.add(k);
              return true;
            })
            .map((r) => ({
              key: r.codigo,
              title: `Ficha ${r.orden}: ${r.titulo}`,
              subtitle: r.titulo,
            }));
          setFichas(cards);
        }

        setLoading(false);
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message || "No se pudo cargar el monitoreo.");
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [monitoreoCodigo, profileLoading, profile?.id, profile?.role, isTestMode]);

  const cards = useMemo(() => fichas, [fichas]);

  if (!monitoreoCodigo) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-white/70">
        Falta el código del monitoreo.
      </div>
    );
  }

  return (
    <div className="monitoring-page monitoring-detail-page min-w-0">
      <section className="monitoring-hero monitoring-detail-hero grid gap-4 rounded-2xl border p-4 sm:p-5 sm:grid-cols-[minmax(0,1fr)_13rem] sm:items-center">
        <div className="flex min-w-0 items-start gap-3 sm:gap-4">
          <div className="monitoring-hero-icon grid h-12 w-12 shrink-0 place-items-center rounded-2xl border sm:h-14 sm:w-14"><FormIcon /></div>
          <div className="min-w-0">
            <button type="button" onClick={() => nav("/app/monitoreo")} className="monitoring-back-button mb-1.5 inline-flex items-center gap-1 text-[11px] font-semibold">← Volver</button>
            <h1 className="truncate text-xl font-bold tracking-tight text-[var(--app-text)] md:text-2xl">{monitoreo?.nombre || monitoreoCodigo}</h1>
            <p className="mt-1 text-sm text-[var(--app-muted)]">Elige la ficha o formulario que deseas registrar.</p>
          </div>
        </div>
        <div className="monitoring-summary is-forms flex items-center gap-3 rounded-xl border px-3.5 py-3">
          <div className="monitoring-summary-icon grid h-10 w-10 shrink-0 place-items-center rounded-xl"><FormIcon /></div>
          <div>
            <div className="text-[11px] font-semibold text-[var(--app-muted)]">Fichas disponibles</div>
            <div className="mt-0.5 text-2xl font-bold tracking-tight text-[var(--app-warning)]">{loading ? "—" : cards.length}</div>
          </div>
        </div>
      </section>

      {loading ? (
        <div className="mt-6 text-sm text-white/60">Cargando fichas...</div>
      ) : error ? (
        <div className="mt-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-sm text-red-100">
          {error}
        </div>
      ) : !monitoreo ? (
        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-6 text-white/70">
          Monitoreo no encontrado.
        </div>
      ) : expired ? (
        <div className="mt-6 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-6 text-amber-100">
          Este monitoreo está vencido. Solicita al administrador una ampliación.
        </div>
      ) : !assigned ? (
        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-6 text-white/70">
          No tienes acceso a este monitoreo. Solicita la asignación al administrador.
        </div>
      ) : cards.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-6 text-white/70">
          No hay fichas configuradas para este monitoreo.
        </div>
      ) : (
        <div className="monitoring-detail-grid mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {cards.map((f) => {
            const fichaUrl = `/app/monitoreo/${monitoreoCodigo}/ficha/${f.key}?mid=${encodeURIComponent(monitoreo.id)}`;
            return (
              <div
                key={f.key}
                onClick={() => nav(fichaUrl)}
                onKeyDown={(e) => {
                  if (e.key !== "Enter" && e.key !== " ") return;
                  e.preventDefault();
                  nav(fichaUrl);
                }}
                role="button"
                tabIndex={0}
                className="monitoring-card monitoring-detail-card agebre-uniform-card flex min-h-[230px] w-full min-w-0 flex-col overflow-hidden rounded-2xl border p-4 text-left sm:p-5"
              >
                <div className="mb-4 flex h-10 shrink-0 items-start justify-between gap-3">
                  <div className="monitoring-card-icon flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border">
                    <FormIcon />
                  </div>
                  <span className="badge-green inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold leading-none">
                    <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
                    Disponible
                  </span>
                </div>

                <h2 className="agebre-card-title h-12 shrink-0 text-base font-bold leading-[1.35] tracking-tight text-[var(--app-text)]">
                  {f.title}
                </h2>

                <div className="flex flex-1 flex-col pt-4">
                  <div className="flex h-5 shrink-0 items-center gap-2 text-xs text-[var(--app-muted)]">
                    <CalendarIcon />
                    <span className="truncate">Monitoreo vence: {formatDate(monitoreo.fecha_fin)}</span>
                  </div>
                </div>

                <div className="mt-auto grid shrink-0 grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setDescModal(f);
                    }}
                    className="monitoring-secondary-action inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg border px-3 text-xs font-semibold transition"
                  >
                    <EyeIcon />
                    Ver más
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      nav(fichaUrl);
                    }}
                    className="executive-primary-action inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg border px-3 text-xs font-semibold transition"
                  >
                    Abrir ficha
                    <ArrowIcon />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {descModal && (
        <div className="agebre-modal-overlay fixed inset-0 z-[120] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="agebre-modal-content w-full max-w-3xl overflow-hidden rounded-3xl border border-white/10 bg-zinc-950 shadow-2xl shadow-black/40">
            <div className="border-b border-white/10 bg-white/[0.03] p-4 sm:p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-black/25 text-white/80">
                    <FormIcon />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-medium uppercase tracking-[0.18em] text-white/45">Ficha</div>
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
                <span className="badge-green inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold">
                  <span className="h-2 w-2 rounded-full bg-green-400" />
                  Disponible
                </span>
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/65">
                  <CalendarIcon />
                  <span>Monitoreo vence: {formatDate(monitoreo?.fecha_fin)}</span>
                </div>
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/65">
                  {temporalLabel(monitoreo?.fecha_fin)}
                </div>
              </div>

              <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-white/45">
                  <InfoIcon />
                  Detalle de ficha
                </div>
                <div className="max-h-[34vh] overflow-y-auto whitespace-pre-wrap pr-1 text-sm leading-6 text-white/75">
                  {descModal.subtitle || descModal.title}
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
                  onClick={() => {
                    if (!monitoreo) return;
                    nav(`/app/monitoreo/${monitoreoCodigo}/ficha/${descModal.key}?mid=${encodeURIComponent(monitoreo.id)}`);
                  }}
                  className="executive-primary-action inline-flex h-10 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-semibold transition"
                >
                  Abrir ficha
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


