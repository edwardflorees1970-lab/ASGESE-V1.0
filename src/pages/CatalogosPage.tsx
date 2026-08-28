import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

const catalogs = [
  ["cat_nivel", "Niveles"], ["cat_modalidad", "Modalidades"], ["cat_ugel", "UGEL"],
  ["cat_distrito", "Distritos"], ["cat_departamento", "Departamentos"],
  ["cat_provincia", "Provincias"], ["cat_dre", "DRE"],
] as const;
type Row = { id: string; nombre: string };

export function CatalogosPage() {
  const [table, setTable] = useState<(typeof catalogs)[number][0]>("cat_nivel");
  const [rows, setRows] = useState<Row[]>([]); const [name, setName] = useState(""); const [editing, setEditing] = useState<Row | null>(null); const [message, setMessage] = useState("");
  const load = async () => { const { data, error } = await supabase.from(table).select("id,nombre").order("nombre"); if (error) throw error; setRows((data ?? []) as Row[]); };
  useEffect(() => { (async () => { const { data, error } = await supabase.from(table).select("id,nombre").order("nombre"); if (error) setMessage(error.message); else setRows((data ?? []) as Row[]); })(); }, [table]);
  const save = async () => { if (!name.trim()) return; const result = editing ? await supabase.from(table).update({ nombre: name.trim() }).eq("id", editing.id) : await supabase.from(table).insert({ nombre: name.trim() }); if (result.error) return setMessage(result.error.message); setName(""); setEditing(null); setMessage("Catálogo actualizado."); await load(); };
  const remove = async (row: Row) => { if (!window.confirm(`Eliminar ${row.nombre}?`)) return; const { error } = await supabase.from(table).delete().eq("id", row.id); if (error) return setMessage("No se puede eliminar porque está en uso o no tienes permiso: " + error.message); await load(); };
  return <div className="space-y-5"><header className="agebre-surface rounded-2xl p-5"><div className="text-xs font-bold uppercase tracking-widest text-[var(--app-accent)]">Administración</div><h1 className="mt-1 text-2xl font-bold text-[var(--app-text)]">Catálogos</h1><p className="mt-1 text-sm text-[var(--app-muted)]">Gestión centralizada de valores usados por instituciones y formularios.</p></header>{message && <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-[var(--app-text)]">{message}</div>}<div className="grid gap-5 lg:grid-cols-[18rem_1fr]"><aside className="agebre-surface rounded-2xl p-3">{catalogs.map(([code,label]) => <button key={code} onClick={() => { setTable(code); setEditing(null); setName(""); }} className={`mb-1 w-full rounded-xl px-3 py-2 text-left text-sm ${table===code?"bg-violet-600 text-white":"text-[var(--app-text)] hover:bg-white/5"}`}>{label}</button>)}</aside><section className="agebre-surface rounded-2xl p-4"><div className="flex flex-col gap-2 sm:flex-row"><input value={name} onChange={(e)=>setName(e.target.value)} placeholder="Nombre del valor" className="dashboard-control flex-1 rounded-xl border px-3 py-2"/><button onClick={save} className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white">{editing?"Guardar":"Agregar"}</button>{editing&&<button onClick={()=>{setEditing(null);setName("");}} className="rounded-xl border border-white/10 px-4 py-2 text-sm text-[var(--app-text)]">Cancelar</button>}</div><div className="mt-4 divide-y divide-white/5">{rows.map(row=><div key={row.id} className="flex items-center gap-2 py-3"><span className="flex-1 text-sm text-[var(--app-text)]">{row.nombre}</span><button onClick={()=>{setEditing(row);setName(row.nombre);}} className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-[var(--app-text)]">Editar</button><button onClick={()=>remove(row)} className="rounded-lg border border-red-400/20 px-3 py-1.5 text-xs text-red-300">Eliminar</button></div>)}</div></section></div></div>;
}
