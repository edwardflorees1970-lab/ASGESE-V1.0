import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";

type Role = { code: string; name: string; description: string | null; is_system: boolean; is_active: boolean };
type Module = { code: string; name: string; sort_order: number };
type Permission = { module_code: string; can_view: boolean; can_manage: boolean };

const slug = (value: string) => value.trim().toLocaleLowerCase("es").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 50);

export function RolesPermisosPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [selected, setSelected] = useState("");
  const [permissions, setPermissions] = useState<Record<string, Permission>>({});
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [message, setMessage] = useState("");

  const load = async () => {
    const [roleRes, moduleRes] = await Promise.all([
      supabase.from("app_role").select("code,name,description,is_system,is_active").order("name"),
      supabase.from("app_module").select("code,name,sort_order").eq("is_active", true).order("sort_order"),
    ]);
    if (roleRes.error || moduleRes.error) throw new Error(roleRes.error?.message || moduleRes.error?.message);
    const nextRoles = (roleRes.data ?? []) as Role[];
    setRoles(nextRoles); setModules((moduleRes.data ?? []) as Module[]);
    setSelected((current) => current || nextRoles[0]?.code || "");
  };

  useEffect(() => { (async () => { try { await load(); } catch (e) { setMessage(e instanceof Error ? e.message : "No se pudo cargar la configuracion."); } })(); }, []);
  useEffect(() => {
    if (!selected) return;
    supabase.from("role_module_permission").select("module_code,can_view,can_manage").eq("role_code", selected)
      .then(({ data, error }) => {
        if (error) return setMessage(error.message);
        setPermissions(Object.fromEntries(((data ?? []) as Permission[]).map((row) => [row.module_code, row])));
      });
  }, [selected]);

  const selectedRole = useMemo(() => roles.find((role) => role.code === selected), [roles, selected]);

  const createRole = async () => {
    const code = slug(name);
    if (code.length < 2) return setMessage("Ingresa un nombre de rol valido.");
    const { error } = await supabase.from("app_role").insert({ code, name: name.trim(), description: description.trim() || null });
    if (error) return setMessage(error.message);
    setName(""); setDescription(""); setMessage("Rol creado."); await load(); setSelected(code);
  };

  const setPermission = async (moduleCode: string, field: "can_view" | "can_manage", checked: boolean) => {
    const current = permissions[moduleCode] ?? { module_code: moduleCode, can_view: false, can_manage: false };
    const next = { ...current, [field]: checked };
    if (field === "can_manage" && checked) next.can_view = true;
    if (field === "can_view" && !checked) next.can_manage = false;
    const { error } = await supabase.from("role_module_permission").upsert({ role_code: selected, module_code: moduleCode, can_view: next.can_view, can_manage: next.can_manage });
    if (error) return setMessage(error.message);
    setPermissions((value) => ({ ...value, [moduleCode]: next }));
  };

  const toggleRole = async () => {
    if (!selectedRole || selectedRole.is_system) return;
    const { error } = await supabase.from("app_role").update({ is_active: !selectedRole.is_active, updated_at: new Date().toISOString() }).eq("code", selectedRole.code);
    if (error) return setMessage(error.message);
    await load();
  };

  return <div className="space-y-5">
    <header className="agebre-surface rounded-2xl p-5"><div className="text-xs font-bold uppercase tracking-widest text-[var(--app-accent)]">Administracion</div><h1 className="mt-1 text-2xl font-bold text-[var(--app-text)]">Roles y permisos</h1><p className="mt-1 text-sm text-[var(--app-muted)]">Crea roles y define los modulos que pueden ver o gestionar.</p></header>
    {message && <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-[var(--app-text)]">{message}</div>}
    <div className="grid gap-5 lg:grid-cols-[22rem_1fr]">
      <section className="agebre-surface rounded-2xl p-4">
        <h2 className="font-bold text-[var(--app-text)]">Roles</h2>
        <div className="mt-3 space-y-2">{roles.map((role) => <button key={role.code} onClick={() => setSelected(role.code)} className={`w-full rounded-xl border px-3 py-2 text-left text-sm ${selected === role.code ? "border-sky-400/50 bg-sky-500/10" : "border-white/10 bg-white/5"}`}><div className="font-semibold text-[var(--app-text)]">{role.name}</div><div className="text-xs text-[var(--app-muted)]">{role.is_active ? "Activo" : "Inactivo"}{role.is_system ? " · Sistema" : ""}</div></button>)}</div>
        <div className="mt-5 border-t border-white/10 pt-4"><div className="text-sm font-semibold text-[var(--app-text)]">Nuevo rol</div><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre" className="dashboard-control mt-2 w-full rounded-xl border px-3 py-2"/><textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descripcion opcional" className="dashboard-control mt-2 w-full rounded-xl border px-3 py-2"/><button onClick={createRole} className="mt-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white">Crear rol</button></div>
      </section>
      <section className="agebre-surface rounded-2xl p-4">
        <div className="flex items-center justify-between"><div><h2 className="font-bold text-[var(--app-text)]">{selectedRole?.name || "Permisos"}</h2><p className="text-xs text-[var(--app-muted)]">Ver controla el acceso; gestionar habilita operaciones de escritura.</p></div>{selectedRole && !selectedRole.is_system && <button onClick={toggleRole} className="rounded-xl border border-white/10 px-3 py-2 text-xs text-[var(--app-text)]">{selectedRole.is_active ? "Desactivar" : "Activar"}</button>}</div>
        <div className="mt-4 overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-white/10 text-left text-[var(--app-muted)]"><th className="py-2">Modulo</th><th className="w-24 text-center">Ver</th><th className="w-24 text-center">Gestionar</th></tr></thead><tbody>{modules.map((module) => { const p = permissions[module.code]; return <tr key={module.code} className="border-b border-white/5"><td className="py-3 text-[var(--app-text)]">{module.name}</td><td className="text-center"><input type="checkbox" checked={Boolean(p?.can_view)} onChange={(e) => setPermission(module.code,"can_view",e.target.checked)}/></td><td className="text-center"><input type="checkbox" checked={Boolean(p?.can_manage)} onChange={(e) => setPermission(module.code,"can_manage",e.target.checked)}/></td></tr>; })}</tbody></table></div>
      </section>
    </div>
  </div>;
}
