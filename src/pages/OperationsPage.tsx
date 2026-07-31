import { useCallback, useEffect, useRef, useState } from "react";
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
};

type TelemetryRow = {
  id: number;
  occurred_at: string;
  severity: string;
  event_type: string;
  message: string;
  context: unknown;
};

const dateFormatter = new Intl.DateTimeFormat("es-PE", { dateStyle: "short", timeStyle: "medium" });
const AUDIT_PAGE_SIZE = 25;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

export function OperationsPage() {
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [telemetry, setTelemetry] = useState<TelemetryRow[]>([]);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [auditPage, setAuditPage] = useState(0);
  const [auditTotal, setAuditTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loadSequence = useRef(0);

  const load = useCallback(async () => {
    const sequence = ++loadSequence.current;
    setLoading(true);
    setError(null);
    const from = auditPage * AUDIT_PAGE_SIZE;
    const searchFilter = auditSearchFilter(debouncedQuery);
    let auditQuery = supabase
      .from("audit_event")
      .select("id,occurred_at,actor_id,actor_role,action,entity_table,entity_id,before_data,after_data,request_id", { count: "exact" })
      .order("occurred_at", { ascending: false });
    if (searchFilter) auditQuery = auditQuery.or(searchFilter);
    const [auditResult, telemetryResult] = await Promise.all([
      auditQuery.range(from, from + AUDIT_PAGE_SIZE - 1),
      supabase.from("app_telemetry_event").select("id,occurred_at,severity,event_type,message,context").order("occurred_at", { ascending: false }).limit(100),
    ]);
    if (sequence !== loadSequence.current) return;
    const resultError = auditResult.error ?? telemetryResult.error;
    if (resultError) setError(resultError.message);
    else {
      const total = auditResult.count ?? 0;
      const lastPage = Math.max(0, Math.ceil(total / AUDIT_PAGE_SIZE) - 1);
      setAudit((auditResult.data ?? []) as AuditRow[]);
      setAuditTotal(total);
      setTelemetry((telemetryResult.data ?? []) as TelemetryRow[]);
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

  return (
    <div className="space-y-6 text-white">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Operaciones y auditoria</h1>
          <p className="mt-1 text-sm text-white/60">Cambios críticos y errores centralizados. Los eventos de auditoria son de solo lectura.</p>
        </div>
        <button type="button" onClick={() => void load()} disabled={loading} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm disabled:opacity-50">
          {loading ? "Actualizando..." : "Actualizar"}
        </button>
      </header>

      {error && <div role="alert" className="rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-100">{error}</div>}

      <section aria-labelledby="audit-heading" className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 id="audit-heading" className="font-semibold">Bitacora uniforme</h2>
          <label className="text-xs text-white/60">
            Buscar evento
            <input value={query} onChange={(event) => { setQuery(event.target.value); setAuditPage(0); }} className="ml-2 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white" placeholder="Tabla, accion o ID" />
          </label>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-xs">
            <thead className="text-white/50"><tr><th className="p-2">Fecha</th><th className="p-2">Accion</th><th className="p-2">Entidad</th><th className="p-2">Actor</th><th className="p-2">Detalle</th></tr></thead>
            <tbody>
              {!loading && audit.length === 0 && (
                <tr><td colSpan={5} className="border-t border-white/10 p-6 text-center text-sm text-white/50">No se encontraron eventos de auditoria.</td></tr>
              )}
              {audit.map((row) => (
                <tr key={row.id} className="border-t border-white/10 align-top">
                  <td className="p-2 whitespace-nowrap">{dateFormatter.format(new Date(row.occurred_at))}</td>
                  <td className="p-2 font-medium">{row.action}</td>
                  <td className="p-2">{row.entity_table}<div className="text-white/40">{row.entity_id ?? "Sin ID"}</div></td>
                  <td className="p-2">{row.actor_role ?? "sistema"}<div className="text-white/40">{row.actor_id ?? "interno"}</div></td>
                  <td className="p-2"><details><summary className="cursor-pointer text-cyan-200">Ver JSON</summary><pre className="mt-2 max-h-56 max-w-xl overflow-auto whitespace-pre-wrap rounded bg-black/30 p-2 text-[10px]">{JSON.stringify({ before: row.before_data, after: row.after_data, requestId: row.request_id }, null, 2)}</pre></details></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <nav aria-label="Paginacion de auditoria" className="mt-4 flex flex-col gap-3 border-t border-white/10 pt-4 text-xs sm:flex-row sm:items-center sm:justify-between">
          <span className="text-white/55">Mostrando {auditFrom}-{auditTo} de {auditTotal} registros · 25 por pagina</span>
          <div className="flex items-center gap-2">
            <button type="button" disabled={loading || auditPage === 0} onClick={() => setAuditPage((page) => Math.max(0, page - 1))} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 font-medium text-white/75 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40">Anterior</button>
            <span className="min-w-24 text-center text-white/65">Pagina {auditPage + 1} de {auditPageCount}</span>
            <button type="button" disabled={loading || auditPage + 1 >= auditPageCount} onClick={() => setAuditPage((page) => Math.min(auditPageCount - 1, page + 1))} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 font-medium text-white/75 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40">Siguiente</button>
          </div>
        </nav>
      </section>

      <section aria-labelledby="telemetry-heading" className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <h2 id="telemetry-heading" className="font-semibold">Telemetria y alertas</h2>
        <div className="mt-3 space-y-2">
          {telemetry.length === 0 && <p className="text-sm text-white/50">Sin incidentes registrados.</p>}
          {telemetry.map((row) => (
            <article key={row.id} className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2"><span className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${row.severity === "fatal" || row.severity === "error" ? "bg-red-500/20 text-red-100" : "bg-amber-500/20 text-amber-100"}`}>{row.severity}</span><strong>{row.event_type}</strong><time className="ml-auto text-xs text-white/40">{dateFormatter.format(new Date(row.occurred_at))}</time></div>
              <p className="mt-2 text-white/70">{row.message}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
