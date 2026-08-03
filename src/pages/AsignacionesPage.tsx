import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../app/AuthProvider";
import { isAdminRole } from "../lib/roles";
import { DashboardSelect, SearchableFilter } from "../components/dashboard/DashboardWidgets";

type MonitoreoRow = {
  id: string;
  codigo: string;
  nombre: string;
  anio: number;
  fecha_inicio: string;
  fecha_fin: string;
};

type ProfileRow = {
  id: string;
  role: "admin" | "user" | string;
  nombres: string | null;
  apellido_paterno: string | null;
  apellido_materno: string | null;
  correo: string | null;
  email: string | null;
};

function cls(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function fmtDate(iso: string) {
  try {
    return new Intl.DateTimeFormat("es-PE", { dateStyle: "medium" }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function AssignmentIcon({ type = "assign" }: { type?: "assign" | "users" | "calendar" }) {
  if (type === "users") return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M16 20v-1.5a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4V20M9.5 10.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM17 8h4M19 6v4" /></svg>;
  if (type === "calendar") return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M6 3v3M18 3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v14H4V6a1 1 0 0 1 1-1Z" /></svg>;
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM3 21v-2a6 6 0 0 1 10.5-4M17 12v8M13 16h8" /></svg>;
}

export function AsignacionesPage() {
  const { profile } = useAuth();
  const canManageAssignments = isAdminRole(profile?.role);
  const now = new Date();
  const [year, setYear] = useState(String(now.getFullYear()));
  const [years, setYears] = useState<string[]>([]);
  const [monitoreos, setMonitoreos] = useState<MonitoreoRow[]>([]);
  const [monitoreoId, setMonitoreoId] = useState<string>("");

  const [users, setUsers] = useState<ProfileRow[]>([]);
  const [assignments, setAssignments] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [toast, setToast] = useState<{ type: "ok" | "err"; msg: string } | null>(null);

  // Years
  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase
        .from("monitoreo_catalog")
        .select("anio")
        .order("anio", { ascending: false });
      if (!alive) return;
      const uniq = Array.from(new Set((data ?? []).map((x: any) => String(x.anio))));
      setYears(uniq);
      if (uniq.length && !uniq.includes(year)) setYear(uniq[0]);
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Monitoreos por año
  useEffect(() => {
    let alive = true;
    (async () => {
      const { data, error } = await supabase
        .from("monitoreo_catalog")
        .select("id, codigo, nombre, anio, fecha_inicio, fecha_fin")
        .eq("anio", Number(year))
        .order("nombre", { ascending: true });
      if (!alive) return;
      if (error) {
        setToast({ type: "err", msg: error.message });
        return;
      }
      const list = (data ?? []) as MonitoreoRow[];
      setMonitoreos(list);
      if (!monitoreoId && list.length) setMonitoreoId(list[0].id);
      if (monitoreoId && !list.find((m) => m.id === monitoreoId)) {
        setMonitoreoId(list[0]?.id || "");
      }
    })();
    return () => {
      alive = false;
    };
  }, [year]);

  // Usuarios
  useEffect(() => {
    let alive = true;
    (async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, role, nombres, apellido_paterno, apellido_materno, correo, email")
        .order("apellido_paterno", { ascending: true });
      if (!alive) return;
      if (error) {
        setToast({ type: "err", msg: error.message });
        return;
      }
      setUsers((data ?? []) as ProfileRow[]);
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Asignaciones por monitoreo
  useEffect(() => {
    if (!monitoreoId) return;
    let alive = true;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("monitoreo_asignacion")
        .select("id, monitoreo_id, user_id")
        .eq("monitoreo_id", monitoreoId);
      if (!alive) return;
      if (error) {
        setToast({ type: "err", msg: error.message });
        setLoading(false);
        return;
      }
      const map: Record<string, boolean> = {};
      (data ?? []).forEach((r: any) => (map[r.user_id] = true));
      setAssignments(map);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [monitoreoId]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(t);
  }, [toast]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return users;
    return users.filter((u) => {
      const full = [
        u.apellido_paterno,
        u.apellido_materno,
        u.nombres,
        u.correo,
        u.email,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return full.includes(term);
    });
  }, [users, q]);

  const toggleAssign = async (u: ProfileRow) => {
    if (!canManageAssignments) return;
    if (!monitoreoId) return;
    setSaving(u.id);
    try {
      if (assignments[u.id]) {
        const { error } = await supabase
          .from("monitoreo_asignacion")
          .delete()
          .eq("monitoreo_id", monitoreoId)
          .eq("user_id", u.id);
        if (error) throw new Error(error.message);
        setAssignments((prev) => {
          const next = { ...prev };
          delete next[u.id];
          return next;
        });
      } else {
        const { error } = await supabase.from("monitoreo_asignacion").insert({
          monitoreo_id: monitoreoId,
          user_id: u.id,
        });
        if (error) throw new Error(error.message);
        setAssignments((prev) => ({ ...prev, [u.id]: true }));
      }
    } catch (e: any) {
      setToast({ type: "err", msg: e?.message || "No se pudo actualizar." });
    } finally {
      setSaving(null);
    }
  };

  const selected = monitoreos.find((m) => m.id === monitoreoId);
  const yearOptions = useMemo(
    () => (years.length ? years : [year]).map((item) => ({ value: item, label: item })),
    [year, years]
  );
  const monitoreoOptions = useMemo(
    () => monitoreos.map((item) => ({ value: item.id, label: item.nombre })),
    [monitoreos]
  );

  return (
    <div className="assignments-page space-y-5 text-white">
      {toast && (
        <div className="fixed right-4 top-4 z-50">
          <div
            className={cls(
              "rounded-xl border px-4 py-3 text-sm shadow-xl backdrop-blur",
              toast.type === "ok"
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
                : "border-red-500/30 bg-red-500/10 text-red-100"
            )}
          >
            {toast.msg}
          </div>
        </div>
      )}

      <header className="assignments-hero rounded-2xl border p-4 sm:p-5">
        <div className="assignments-hero-layout grid items-center gap-4">
          <div className="flex min-w-0 items-center gap-3"><div className="assignments-hero-icon"><AssignmentIcon /></div><div><div className="assignments-eyebrow">Gestión de acceso</div><h1 className="text-2xl font-bold tracking-tight sm:text-[1.7rem]">Asignaciones</h1><p className="mt-1 text-sm text-[var(--app-muted)]">Asigna usuarios a monitoreos activos por periodo de vigencia.</p></div></div>
          <div className="assignments-kpis grid grid-cols-3 gap-2">
            <div className="assignments-kpi"><span>Usuarios</span><strong>{filtered.length}</strong></div>
            <div className="assignments-kpi is-success"><span>Asignados</span><strong>{filtered.filter((user) => assignments[user.id]).length}</strong></div>
            <div className="assignments-kpi is-pending"><span>Disponibles</span><strong>{filtered.filter((user) => !assignments[user.id]).length}</strong></div>
          </div>
        </div>
      </header>

      <section className="assignments-panel assignments-controls rounded-2xl border p-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <DashboardSelect label="Año" value={year} options={yearOptions} onChange={setYear} />

        <div className="min-w-0 sm:col-span-2">
          <SearchableFilter
            label="Monitoreo"
            value={monitoreoId}
            options={monitoreoOptions}
            allLabel="Selecciona un monitoreo"
            includeAll={false}
            onChange={setMonitoreoId}
            placeholder="Buscar monitoreo..."
          />
        </div>
      </div>

      {selected && (
        <div className="assignments-period mt-3 flex items-center gap-2 rounded-xl border px-4 py-3 text-xs font-semibold">
          <AssignmentIcon type="calendar" />
          Vigencia: {fmtDate(selected.fecha_inicio)} → {fmtDate(selected.fecha_fin)}
        </div>
      )}
      </section>

      <section className="assignments-panel rounded-2xl border p-4 sm:p-5">
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2.5"><div className="assignments-section-icon"><AssignmentIcon type="users" /></div><div><div className="assignments-eyebrow">Directorio</div><div className="text-sm font-bold">Usuarios</div></div></div>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar usuario..."
            className="dashboard-control w-full rounded-xl border px-3 py-2 outline-none placeholder:text-white/30 sm:max-w-xs"
          />
        </div>

        {loading ? (
          <div className="text-sm text-white/60">Cargando asignaciones...</div>
        ) : (
          <div className="grid gap-2 md:grid-cols-2">
            {filtered.map((u) => {
              const name =
                [u.apellido_paterno, u.apellido_materno, u.nombres]
                  .filter(Boolean)
                  .join(" ")
                  .trim() ||
                u.correo ||
                u.email ||
                "Usuario";
              const assigned = !!assignments[u.id];
              return (
                <div
                  key={u.id}
                  className={cls("assignment-user-card flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5", assigned && "is-assigned")}
                >
                  <div>
                    <div className="text-sm font-semibold text-[var(--app-text)]">{name}</div>
                    <div className="text-xs text-[var(--app-muted)]">{u.correo || u.email}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleAssign(u)}
                    disabled={!canManageAssignments || saving === u.id}
                    className={cls(
                      "badge-interactive rounded-lg px-3 py-1.5 text-xs",
                      assigned
                        ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-100 badge-green"
                        : "border badge-info"
                    )}
                  >
                    {saving === u.id ? "..." : assigned ? "Asignado" : canManageAssignments ? "Asignar" : "Solo lectura"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
