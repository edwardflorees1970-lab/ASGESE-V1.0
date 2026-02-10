import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../app/AuthProvider";
import { isAdminRole } from "../lib/roles";

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

  return (
    <div className="text-white">
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

      <div>
        <h1 className="text-xl font-semibold tracking-tight md:text-2xl">Asignaciones</h1>
        <p className="mt-1 text-sm text-white/60">
          Asigna usuarios a monitoreos por rango de fechas.
        </p>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <label className="block">
          <div className="mb-2 text-xs font-medium text-white/70">Año</div>
          <select
            value={year}
            onChange={(e) => setYear(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-white/10"
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
            {!years.length && <option value={year}>{year}</option>}
          </select>
        </label>

        <label className="block sm:col-span-2">
          <div className="mb-2 text-xs font-medium text-white/70">Monitoreo</div>
          <select
            value={monitoreoId}
            onChange={(e) => setMonitoreoId(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-white/10"
          >
            {monitoreos.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nombre}
              </option>
            ))}
          </select>
        </label>
      </div>

      {selected && (
        <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-white/60">
          Vigencia: {fmtDate(selected.fecha_inicio)} → {fmtDate(selected.fecha_fin)}
        </div>
      )}

      <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm font-semibold">Usuarios</div>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar usuario..."
            className="w-full rounded-xl border border-white/10 bg-zinc-900/60 px-3 py-2 text-sm outline-none placeholder:text-white/30 focus:ring-2 focus:ring-white/10 sm:max-w-xs"
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
                  className={cls(
                    "flex items-center justify-between rounded-xl border px-3 py-2",
                    assigned
                      ? "border-emerald-500/30 bg-emerald-500/10"
                      : "border-white/10 bg-white/5"
                  )}
                >
                  <div>
                    <div className="text-sm text-white">{name}</div>
                    <div className="text-xs text-white/50">{u.correo || u.email}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleAssign(u)}
                    disabled={!canManageAssignments || saving === u.id}
                    className={cls(
                      "rounded-lg px-3 py-1.5 text-xs",
                      assigned
                        ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-100 badge-green"
                        : "border border-white/10 bg-white/5 badge-muted"
                    )}
                  >
                    {saving === u.id ? "..." : assigned ? "Asignado" : canManageAssignments ? "Asignar" : "Solo lectura"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
