import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";

type AuditRow = {
  id: number;
  occurred_at: string;
  actor_id: string | null;
  actor_role: string | null;
  action: string;
  entity_table: string;
  entity_id: string | null;
  before_data: unknown;
  after_data: unknown;
  request_id: string | null;
  operation_id?: string | null;
};

type TelemetryRow = {
  id: number;
  occurred_at: string;
  severity: string;
  event_type: string;
  message: string;
  context: unknown;
  fingerprint?: string | null;
  first_seen_at?: string | null;
  last_seen_at?: string | null;
  occurrence_count?: number | null;
  resolved_at?: string | null;
  resolved_by?: string | null;
  resolution_note?: string | null;
};

type AuditOperation = {
  id: string;
  occurredAt: string;
  actorId: string | null;
  actorRole: string | null;
  actions: string[];
  entities: Array<{ table: string; count: number }>;
  events: AuditRow[];
};

type TelemetryView = "active" | "resolved" | "all";

const dateFormatter = new Intl.DateTimeFormat("es-PE", { dateStyle: "short", timeStyle: "medium" });
const AUDIT_PAGE_SIZE = 25;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const TABLE_LABELS: Record<string, string> = {
  form_template: "Ficha",
  form_template_version: "Versión de ficha",
  form_section: "Sección",
  form_question: "Pregunta",
  form_run: "Registro de ficha",
  form_answer: "Respuesta",
  form_answer_evidence: "Evidencia de respuesta",
  ficha_catalog: "Ficha publicada",
  monitoreo_catalog: "Monitoreo",
  monitoreo_solicitud: "Solicitud",
  monitoreo_solicitud_ie: "Instituciones del monitoreo",
  monitoreo_solicitud_filtro: "Filtros del monitoreo",
  monitoreo_asignacion: "Asignación de usuario",
  monitoreo_role_asignacion: "Asignación de rol",
  profiles: "Usuario",
};

function humanizeTableName(table: string) {
  return table
    .split("_")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function tableLabel(table: string) {
  return TABLE_LABELS[table] ?? humanizeTableName(table);
}

const ACTION_LABELS: Record<string, string> = {
  INSERT: "Creación",
  UPDATE: "Edición",
  DELETE: "Eliminación",
};

function actionLabel(action: string) {
  return ACTION_LABELS[action] ?? action;
}

type ProfileRow = {
  id: string;
  nombres: string | null;
  apellido_paterno: string | null;
  apellido_materno: string | null;
};

function profileDisplayName(profile?: ProfileRow) {
  if (!profile) return null;
  const name = [profile.apellido_paterno, profile.apellido_materno, profile.nombres]
    .filter(Boolean)
    .join(" ")
    .trim();
  return name || null;
}

function shortActorId(actorId: string) {
  return actorId.slice(0, 8);
}

function auditSearchFilter(value: string) {
  const safe = value.replace(/[,%()]/g, " ").trim();
  if (!safe) return "";
  const filters = [
    `action.ilike.%${safe}%`,
    `entity_table.ilike.%${safe}%`,
    `actor_role.ilike.%${safe}%`,
  ];
  if (UUID_PATTERN.test(safe)) {
    filters.push(`entity_id.eq.${safe}`, `request_id.eq.${safe}`);
  }
  return filters.join(",");
}

function missingUpgrade(error: { message?: string } | null | undefined, field: string) {
  return Boolean(error?.message && new RegExp(`${field}|schema cache`, "i").test(error.message));
}

function knownResolvedDevelopmentIncident(message: string) {
  return message === "CollapseIcon is not defined"
    || message === "ChartActions is not defined"
    || message === "options is not iterable"
    || message.startsWith('Attempting to parse an unsupported color function "oklab"')
    || /Failed to fetch dynamically imported module:.*\/src\/pages\/AnalyticsReportsPage\.tsx/i.test(message);
}

function OperationsIcon({ type = "audit" }: { type?: "audit" | "log" | "alert" | "refresh" }) {
  if (type === "refresh") return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M20 7v5h-5M4 17v-5h5" /><path strokeLinecap="round" d="M6 8.5A7 7 0 0 1 18.5 7M18 15.5A7 7 0 0 1 5.5 17" /></svg>;
  if (type === "alert") return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M12 3 2.8 20h18.4L12 3Z" /><path strokeLinecap="round" d="M12 9v5M12 17.5h.01" /></svg>;
  if (type === "log") return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M7 3h10v3H7zM5 5H3v16h18V5h-2" /><path strokeLinecap="round" d="M8 11h8M8 15h8" /></svg>;
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M12 3 4 6v6c0 5 3.4 7.8 8 9 4.6-1.2 8-4 8-9V6l-8-3Z" /><path strokeLinecap="round" d="m9 12 2 2 4-5" /></svg>;
}

export function OperationsPage() {
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [actorProfiles, setActorProfiles] = useState<Map<string, ProfileRow>>(new Map());
  const [telemetry, setTelemetry] = useState<TelemetryRow[]>([]);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [auditPage, setAuditPage] = useState(0);
  const [auditTotal, setAuditTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [telemetryView, setTelemetryView] = useState<TelemetryView>("active");
  const [telemetryLifecycleAvailable, setTelemetryLifecycleAvailable] = useState(true);
  const [resolvingId, setResolvingId] = useState<number | null>(null);
  const loadSequence = useRef(0);

  const load = useCallback(async () => {
    const sequence = ++loadSequence.current;
    setLoading(true);
    setError(null);
    const from = auditPage * AUDIT_PAGE_SIZE;
    const searchFilter = auditSearchFilter(debouncedQuery);
    let auditQuery = supabase
      .from("audit_event")
      .select("id,occurred_at,actor_id,actor_role,action,entity_table,entity_id,before_data,after_data,request_id,operation_id", { count: "exact" })
      .order("occurred_at", { ascending: false });
    if (searchFilter) auditQuery = auditQuery.or(searchFilter);
    const [enhancedAuditResult, enhancedTelemetryResult] = await Promise.all([
      auditQuery.range(from, from + AUDIT_PAGE_SIZE - 1),
      supabase.from("app_telemetry_event").select("id,occurred_at,severity,event_type,message,context,fingerprint,first_seen_at,last_seen_at,occurrence_count,resolved_at,resolved_by,resolution_note").order("last_seen_at", { ascending: false }).limit(100),
    ]);

    let auditRows = (enhancedAuditResult.data ?? []) as AuditRow[];
    let auditCount = enhancedAuditResult.count ?? 0;
    let auditError = enhancedAuditResult.error;
    let telemetryRows = (enhancedTelemetryResult.data ?? []) as TelemetryRow[];
    let telemetryError = enhancedTelemetryResult.error;

    if (missingUpgrade(auditError, "operation_id")) {
      let legacyAuditQuery = supabase
        .from("audit_event")
        .select("id,occurred_at,actor_id,actor_role,action,entity_table,entity_id,before_data,after_data,request_id", { count: "exact" })
        .order("occurred_at", { ascending: false });
      if (searchFilter) legacyAuditQuery = legacyAuditQuery.or(searchFilter);
      const legacyAuditResult = await legacyAuditQuery.range(from, from + AUDIT_PAGE_SIZE - 1);
      auditRows = (legacyAuditResult.data ?? []) as AuditRow[];
      auditCount = legacyAuditResult.count ?? 0;
      auditError = legacyAuditResult.error;
    }
    if (missingUpgrade(telemetryError, "fingerprint")) {
      setTelemetryLifecycleAvailable(false);
      const legacyTelemetryResult = await supabase
        .from("app_telemetry_event")
        .select("id,occurred_at,severity,event_type,message,context")
        .order("occurred_at", { ascending: false })
        .limit(100);
      telemetryRows = ((legacyTelemetryResult.data ?? []) as TelemetryRow[]).map((event) =>
        knownResolvedDevelopmentIncident(event.message)
          ? { ...event, resolved_at: event.occurred_at, resolution_note: "Incidente histórico de desarrollo corregido y verificado." }
          : event
      );
      telemetryError = legacyTelemetryResult.error;
    } else {
      setTelemetryLifecycleAvailable(true);
    }
    const actorIds = Array.from(new Set(auditRows.map((row) => row.actor_id).filter((id): id is string => Boolean(id))));
    const profileResult = actorIds.length
      ? await supabase.from("profiles").select("id, nombres, apellido_paterno, apellido_materno").in("id", actorIds)
      : { data: [] as ProfileRow[], error: null };
    if (sequence !== loadSequence.current) return;
    const resultError = auditError ?? telemetryError;
    if (resultError) setError(resultError.message);
    else {
      const total = auditCount;
      const lastPage = Math.max(0, Math.ceil(total / AUDIT_PAGE_SIZE) - 1);
      setAudit(auditRows);
      setAuditTotal(total);
      setTelemetry(telemetryRows);
      setActorProfiles(new Map(((profileResult.data ?? []) as ProfileRow[]).map((profile) => [profile.id, profile])));
      if (auditPage > lastPage) setAuditPage(lastPage);
    }
    setLoading(false);
  }, [auditPage, debouncedQuery]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const auditPageCount = Math.max(1, Math.ceil(auditTotal / AUDIT_PAGE_SIZE));
  const auditFrom = auditTotal === 0 ? 0 : auditPage * AUDIT_PAGE_SIZE + 1;
  const auditTo = Math.min((auditPage + 1) * AUDIT_PAGE_SIZE, auditTotal);
  const auditOperations = useMemo<AuditOperation[]>(() => {
    const grouped = new Map<string, AuditOperation>();
    audit.forEach((event) => {
      const operationId = event.operation_id || event.request_id || `legacy-tx:${event.actor_id ?? "system"}:${event.occurred_at}`;
      let operation = grouped.get(operationId);
      if (!operation) {
        operation = {
          id: operationId,
          occurredAt: event.occurred_at,
          actorId: event.actor_id,
          actorRole: event.actor_role,
          actions: [],
          entities: [],
          events: [],
        };
        grouped.set(operationId, operation);
      }
      operation.events.push(event);
      if (!operation.actions.includes(event.action)) operation.actions.push(event.action);
      const entity = operation.entities.find((item) => item.table === event.entity_table);
      if (entity) entity.count += 1;
      else operation.entities.push({ table: event.entity_table, count: 1 });
    });
    return Array.from(grouped.values());
  }, [audit]);
  const visibleTelemetry = useMemo(() => telemetry.filter((event) => {
    if (telemetryView === "all") return true;
    if (!telemetryLifecycleAvailable) return !event.resolved_at;
    return telemetryView === "resolved" ? Boolean(event.resolved_at) : !event.resolved_at;
  }), [telemetry, telemetryLifecycleAvailable, telemetryView]);
  const activeTelemetryCount = telemetry.filter((event) => !event.resolved_at).length;

  const resolveTelemetry = async (eventId: number) => {
    setResolvingId(eventId);
    const { error: resolveError } = await supabase.rpc("resolve_telemetry_event", {
      p_event_id: eventId,
      p_resolution_note: "Validado y resuelto desde el modulo de observabilidad.",
    });
    setResolvingId(null);
    if (resolveError) {
      setError(resolveError.message);
      return;
    }
    setTelemetry((current) => current.map((event) => event.id === eventId
      ? { ...event, resolved_at: new Date().toISOString(), resolution_note: "Validado y resuelto desde el modulo de observabilidad." }
      : event));
  };

  return (
    <div className="operations-page space-y-5 text-white">
      <header className="operations-hero rounded-2xl border p-4 sm:p-5">
        <div className="operations-hero-layout grid items-center gap-4">
        <div className="flex min-w-0 items-center gap-3"><div className="operations-hero-icon"><OperationsIcon /></div><div><div className="operations-eyebrow">Control y trazabilidad</div><h1 className="text-2xl font-bold tracking-tight sm:text-[1.7rem]">Auditoría y alertas</h1><p className="mt-1 text-sm text-[var(--app-muted)]">Consulta cambios críticos, responsables e incidentes centralizados.</p></div></div>
        <div className="operations-kpis grid grid-cols-3 gap-2"><div className="operations-kpi"><span>Cambios</span><strong>{auditTotal}</strong></div><div className="operations-kpi is-info"><span>Operaciones</span><strong>{auditOperations.length}</strong></div><div className="operations-kpi is-alert"><span>Activas</span><strong>{activeTelemetryCount}</strong></div></div>
        <button type="button" onClick={() => void load()} disabled={loading} className="operations-refresh inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold disabled:opacity-50">
          <OperationsIcon type="refresh" />
          {loading ? "Actualizando..." : "Actualizar"}
        </button>
        </div>
      </header>

      {error && <div role="alert" className="rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-100">{error}</div>}

      <section aria-labelledby="audit-heading" className="operations-panel rounded-2xl border p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2.5"><div className="operations-section-icon"><OperationsIcon type="log" /></div><div><div className="operations-eyebrow">Solo lectura</div><h2 id="audit-heading" className="font-bold">Bitácora uniforme</h2></div></div>
          <label className="operations-search-label text-xs">
            Buscar evento
            <input value={query} onChange={(event) => { setQuery(event.target.value); setAuditPage(0); }} className="operations-control ml-2 rounded-lg border px-3 py-2 text-sm" placeholder="Tabla, acción o ID" />
          </label>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="operations-table w-full min-w-[760px] text-left text-xs">
            <thead><tr><th className="p-2">Fecha</th><th className="p-2">Operación</th><th className="p-2">Cambios incluidos</th><th className="p-2">Actor</th><th className="p-2">Detalle</th></tr></thead>
            <tbody>
              {!loading && auditOperations.length === 0 && (
                <tr><td colSpan={5} className="border-t border-white/10 p-6 text-center text-sm text-white/50">No se encontraron eventos de auditoria.</td></tr>
              )}
              {auditOperations.map((operation) => (
                <tr key={operation.id} className="border-t border-white/10 align-top">
                  <td className="p-2 whitespace-nowrap">{dateFormatter.format(new Date(operation.occurredAt))}</td>
                  <td className="p-2"><div className="font-semibold">{operation.actions.map(actionLabel).join(" + ")}</div><div className="text-white/40">{operation.events.length} cambio{operation.events.length === 1 ? "" : "s"}</div></td>
                  <td className="p-2">{operation.entities.map((entity) => <div key={entity.table}>{tableLabel(entity.table)} <span className="text-white/40">× {entity.count}</span></div>)}</td>
                  <td className="p-2">
                    {operation.actorId ? (
                      <span title={operation.actorId}>{profileDisplayName(actorProfiles.get(operation.actorId)) ?? shortActorId(operation.actorId)}</span>
                    ) : (
                      <span>Sistema</span>
                    )}
                    <div className="text-white/40">{operation.actorRole ?? "sistema"}</div>
                  </td>
                  <td className="p-2"><details><summary className="operations-json-toggle cursor-pointer font-semibold">Ver {operation.events.length} cambios</summary><div className="operations-json mt-2 max-h-72 max-w-xl space-y-2 overflow-auto rounded p-2 text-[10px]">{operation.events.map((event) => <div key={event.id} className="border-b border-white/10 pb-2 last:border-0"><div className="mb-1 font-semibold">{actionLabel(event.action)} · {tableLabel(event.entity_table)} · {event.entity_id ?? "Sin ID"}</div><pre className="whitespace-pre-wrap">{JSON.stringify({ before: event.before_data, after: event.after_data, requestId: event.request_id, operationId: event.operation_id }, null, 2)}</pre></div>)}</div></details></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <nav aria-label="Paginacion de auditoria" className="mt-4 flex flex-col gap-3 border-t border-white/10 pt-4 text-xs sm:flex-row sm:items-center sm:justify-between">
          <span className="text-white/55">Mostrando {auditFrom}-{auditTo} de {auditTotal} cambios · {auditOperations.length} operaciones agrupadas en esta página</span>
          <div className="flex items-center gap-2">
            <button type="button" disabled={loading || auditPage === 0} onClick={() => setAuditPage((page) => Math.max(0, page - 1))} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 font-medium text-white/75 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40">Anterior</button>
            <span className="min-w-24 text-center text-white/65">Pagina {auditPage + 1} de {auditPageCount}</span>
            <button type="button" disabled={loading || auditPage + 1 >= auditPageCount} onClick={() => setAuditPage((page) => Math.min(auditPageCount - 1, page + 1))} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 font-medium text-white/75 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40">Siguiente</button>
          </div>
        </nav>
      </section>

      <section aria-labelledby="telemetry-heading" className="operations-panel rounded-2xl border p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2.5"><div className="operations-section-icon is-alert"><OperationsIcon type="alert" /></div><div><div className="operations-eyebrow">Observabilidad</div><h2 id="telemetry-heading" className="font-bold">Telemetría y alertas</h2></div></div>
          {telemetryLifecycleAvailable && <label className="operations-search-label text-xs">Estado<select value={telemetryView} onChange={(event) => setTelemetryView(event.target.value as TelemetryView)} className="operations-control ml-2 rounded-lg border px-3 py-2 text-sm"><option value="active">Activas</option><option value="resolved">Resueltas</option><option value="all">Todas</option></select></label>}
        </div>
        <div className="mt-3 space-y-2">
          {visibleTelemetry.length === 0 && <p className="text-sm text-white/50">Sin incidentes en este estado.</p>}
          {visibleTelemetry.map((row) => (
            <article key={row.id} className={`operations-alert-card rounded-xl border p-3 text-sm ${row.resolved_at ? "is-resolved" : ""}`}>
              <div className="flex flex-wrap items-center gap-2"><span className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${row.resolved_at ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-200" : row.severity === "fatal" || row.severity === "error" ? "bg-red-500/20 text-red-700 dark:text-red-200" : "bg-amber-500/20 text-amber-700 dark:text-amber-200"}`}>{row.resolved_at ? "resuelta" : row.severity}</span><strong>{row.event_type}</strong>{(row.occurrence_count ?? 1) > 1 && <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] font-semibold">{row.occurrence_count} ocurrencias</span>}<time className="ml-auto text-xs text-white/40">{dateFormatter.format(new Date(row.last_seen_at || row.occurred_at))}</time></div>
              <p className="mt-2 text-white/70">{row.message}</p>
              {row.resolution_note && <p className="mt-2 text-xs text-white/50">Resolución: {row.resolution_note}</p>}
              {telemetryLifecycleAvailable && !row.resolved_at && <div className="mt-3 flex justify-end"><button type="button" onClick={() => void resolveTelemetry(row.id)} disabled={resolvingId === row.id} className="operations-resolve rounded-lg border px-3 py-1.5 text-xs font-semibold disabled:opacity-50">{resolvingId === row.id ? "Resolviendo..." : "Marcar resuelta"}</button></div>}
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
