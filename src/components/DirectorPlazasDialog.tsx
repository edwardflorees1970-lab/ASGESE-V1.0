import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";

type PlazaRow = {
  id: string;
  codigo_institucional: string;
  institucion_nombre: string;
  modalidad: string;
  rei: string;
  alias: string;
  estado: "VACANTE" | "OCUPADA" | "INACTIVA";
  updated_at: string;
};

export function DirectorPlazasDialog({ onClose }: { onClose: () => void }) {
  const [rows, setRows] = useState<PlazaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("director_iiee_plaza")
      .select("id,codigo_institucional,institucion_nombre,modalidad,rei,alias,estado,updated_at")
      .order("codigo_institucional")
      .order("modalidad")
      .limit(2000);
    if (error) setMessage({ type: "error", text: `No se pudieron cargar las plazas: ${error.message}` });
    else setRows((data ?? []) as PlazaRow[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const filtered = useMemo(() => {
    const term = query.trim().toLocaleUpperCase("es");
    return rows.filter((row) => {
      if (status && row.estado !== status) return false;
      if (!term) return true;
      return [row.codigo_institucional, row.institucion_nombre, row.modalidad, row.rei, row.alias]
        .some((value) => value.toLocaleUpperCase("es").includes(term));
    });
  }, [query, rows, status]);

  const counts = useMemo(() => ({
    total: rows.length,
    vacantes: rows.filter((row) => row.estado === "VACANTE").length,
    ocupadas: rows.filter((row) => row.estado === "OCUPADA").length,
    inactivas: rows.filter((row) => row.estado === "INACTIVA").length,
  }), [rows]);

  const sync = async () => {
    setSyncing(true);
    setMessage(null);
    const { data, error } = await supabase.rpc("sync_director_iiee_plazas");
    if (error) {
      setMessage({ type: "error", text: `No se pudieron sincronizar las plazas: ${error.message}` });
    } else {
      const result = (data ?? {}) as { synchronized?: number; conflicts?: number };
      setMessage({
        type: result.conflicts ? "error" : "ok",
        text: `Plazas sincronizadas: ${result.synchronized ?? 0}. Conflictos de REI pendientes: ${result.conflicts ?? 0}.`,
      });
      await load();
    }
    setSyncing(false);
  };

  return <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/70 p-3 backdrop-blur-sm sm:items-center sm:p-5" role="dialog" aria-modal="true" aria-labelledby="director-plazas-title">
    <div className="my-auto w-full max-w-6xl overflow-hidden rounded-2xl border border-white/10 bg-zinc-950 shadow-2xl">
      <header className="flex flex-col gap-3 border-b border-white/10 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
        <div><div className="text-xs font-bold uppercase tracking-widest text-sky-300">Directores IIEE</div><h2 id="director-plazas-title" className="mt-1 text-xl font-bold text-white">Plazas por institución y modalidad</h2><p className="mt-1 text-sm text-white/55">La REI y el alias se obtienen del catálogo institucional. Una cuenta se crea únicamente al ocupar una plaza desde Excel.</p></div>
        <div className="flex gap-2"><button type="button" onClick={() => void sync()} disabled={syncing || loading} className="rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{syncing ? "Sincronizando..." : "Sincronizar instituciones"}</button><button type="button" onClick={onClose} disabled={syncing} className="rounded-xl border border-white/10 px-4 py-2.5 text-sm text-white/70">Cerrar</button></div>
      </header>
      <div className="max-h-[78vh] overflow-y-auto p-5">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4"><Summary label="Total" value={counts.total}/><Summary label="Vacantes" value={counts.vacantes} tone="green"/><Summary label="Ocupadas" value={counts.ocupadas} tone="blue"/><Summary label="Inactivas" value={counts.inactivas} tone="amber"/></div>
        {message && <div role="alert" className={`mt-4 rounded-xl border px-4 py-3 text-sm ${message.type === "ok" ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-100" : "border-amber-400/20 bg-amber-500/10 text-amber-100"}`}>{message.text}</div>}
        <div className="mt-4 grid gap-3 rounded-xl border border-white/10 bg-white/5 p-3 sm:grid-cols-[1fr_220px]"><label><span className="mb-1 block text-xs text-white/55">Buscar</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Código, colegio, modalidad, REI o alias" className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none"/></label><label><span className="mb-1 block text-xs text-white/55">Estado</span><select value={status} onChange={(event) => setStatus(event.target.value)} className="w-full rounded-xl border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white outline-none"><option value="">Todos</option><option value="VACANTE">Vacantes</option><option value="OCUPADA">Ocupadas</option><option value="INACTIVA">Inactivas</option></select></label></div>
        <div className="mt-4 max-h-[52vh] overflow-auto rounded-xl border border-white/10"><table className="w-full min-w-[1050px] text-left text-xs"><thead className="sticky top-0 bg-slate-900 text-white/60"><tr><th className="px-3 py-2">Código</th><th className="px-3 py-2">Institución oficial</th><th className="px-3 py-2">Modalidad</th><th className="px-3 py-2">REI</th><th className="px-3 py-2">Alias</th><th className="px-3 py-2">Estado</th></tr></thead><tbody>{loading ? <tr><td colSpan={6} className="px-3 py-8 text-center text-white/50">Cargando plazas...</td></tr> : filtered.length === 0 ? <tr><td colSpan={6} className="px-3 py-8 text-center text-white/50">No hay plazas para los filtros seleccionados.</td></tr> : filtered.map((row) => <tr key={row.id} className="border-t border-white/5"><td className="px-3 py-2 font-mono text-white/75">{row.codigo_institucional}</td><td className="max-w-sm px-3 py-2 text-white/75">{row.institucion_nombre}</td><td className="px-3 py-2 text-white/70">{row.modalidad}</td><td className="px-3 py-2 text-white/70">{row.rei}</td><td className="px-3 py-2 font-mono text-sky-200">{row.alias}</td><td className={`px-3 py-2 font-semibold ${row.estado === "VACANTE" ? "text-emerald-300" : row.estado === "OCUPADA" ? "text-sky-300" : "text-amber-300"}`}>{row.estado}</td></tr>)}</tbody></table></div>
      </div>
    </div>
  </div>;
}

function Summary({ label, value, tone = "blue" }: { label: string; value: number; tone?: "blue" | "green" | "amber" }) {
  const colors = { blue: "border-sky-400/20 bg-sky-500/10 text-sky-100", green: "border-emerald-400/20 bg-emerald-500/10 text-emerald-100", amber: "border-amber-400/20 bg-amber-500/10 text-amber-100" };
  return <div className={`rounded-xl border px-3 py-2 text-center ${colors[tone]}`}><div className="text-[10px] uppercase tracking-wide opacity-70">{label}</div><div className="text-lg font-bold">{value}</div></div>;
}
