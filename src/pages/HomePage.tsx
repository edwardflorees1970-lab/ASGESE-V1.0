import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { roleLabel } from "../lib/roles";

type RunRow = {
  id: string;
  status: string;
  created_by: string;
  created_at: string;
  ficha_id: string;
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

type FichaRow = {
  id: string;
  codigo: string;
  monitoreo_id: string;
};

type MonitoreoRow = {
  id: string;
  codigo: string;
  nombre: string;
  anio: number;
  is_active: boolean;
};

function cls(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function fmtDateShort(iso: string) {
  try {
    return new Intl.DateTimeFormat("es-PE", {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: "America/Lima",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function monthOptions() {
  return [
    { value: "ALL", label: "Todo el año" },
    { value: "1", label: "Enero" },
    { value: "2", label: "Febrero" },
    { value: "3", label: "Marzo" },
    { value: "4", label: "Abril" },
    { value: "5", label: "Mayo" },
    { value: "6", label: "Junio" },
    { value: "7", label: "Julio" },
    { value: "8", label: "Agosto" },
    { value: "9", label: "Septiembre" },
    { value: "10", label: "Octubre" },
    { value: "11", label: "Noviembre" },
    { value: "12", label: "Diciembre" },
  ];
}

export function HomePage() {
  const now = new Date();
  const [year, setYear] = useState(String(now.getFullYear()));
  const [month, setMonth] = useState("ALL");
  const [monitoreo, setMonitoreo] = useState("ALL");

  const [years, setYears] = useState<string[]>([]);
  const [monitoreos, setMonitoreos] = useState<MonitoreoRow[]>([]);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [runs, setRuns] = useState<RunRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProfileRow>>({});
  const [fichas, setFichas] = useState<Record<string, FichaRow>>({});
  const [monById, setMonById] = useState<Record<string, MonitoreoRow>>({});

  // Cargar años disponibles
  useEffect(() => {
    let alive = true;
    (async () => {
      const { data, error } = await supabase
        .from("monitoreo_catalog")
        .select("anio")
        .order("anio", { ascending: false });
      if (!alive) return;
      if (error) return;
      const uniq = Array.from(new Set((data ?? []).map((x: any) => String(x.anio))));
      setYears(uniq);
      if (uniq.length && !uniq.includes(year)) {
        setYear(uniq[0]);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Cargar monitoreos activos por año
  useEffect(() => {
    let alive = true;
    (async () => {
      const { data, error } = await supabase
        .from("monitoreo_catalog")
        .select("id, codigo, nombre, anio, is_active")
        .eq("anio", Number(year))
        .eq("is_active", true)
        .order("nombre", { ascending: true });
      if (!alive) return;
      if (error) return;
      setMonitoreos((data ?? []) as MonitoreoRow[]);
      if (monitoreo !== "ALL" && !(data ?? []).some((m: any) => m.codigo === monitoreo)) {
        setMonitoreo("ALL");
      }
    })();
    return () => {
      alive = false;
    };
  }, [year]);

  // Cargar métricas
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setErr(null);

        // Filtro por fechas
        const y = Number(year);
        const m = month === "ALL" ? null : Number(month);
        const start = m ? new Date(y, m - 1, 1) : new Date(y, 0, 1);
        const end = m ? new Date(y, m, 1) : new Date(y + 1, 0, 1);

        // Si hay filtro por monitoreo, resolvemos fichas_id
        let fichaIds: string[] | null = null;
        if (monitoreo !== "ALL") {
          const mon = monitoreos.find((x) => x.codigo === monitoreo);
          if (mon?.id) {
            const { data: fichasData, error: fichasErr } = await supabase
              .from("ficha_catalog")
              .select("id, codigo, monitoreo_id")
              .eq("monitoreo_id", mon.id);
            if (fichasErr) throw new Error(fichasErr.message);
            fichaIds = (fichasData ?? []).map((f: any) => f.id);
          } else {
            fichaIds = [];
          }
        }

        let query = supabase
          .from("ficha_run")
          .select("id, status, created_by, created_at, ficha_id")
          .gte("created_at", start.toISOString())
          .lt("created_at", end.toISOString())
          .order("created_at", { ascending: false });

        if (fichaIds) {
          if (fichaIds.length === 0) {
            if (!alive) return;
            setRuns([]);
            setProfiles({});
            setFichas({});
            setMonById({});
            setLoading(false);
            return;
          }
          query = query.in("ficha_id", fichaIds);
        }

        const { data: runData, error: runErr } = await query;
        if (runErr) throw new Error(runErr.message);
        const runRows = (runData ?? []) as RunRow[];
        if (!alive) return;
        setRuns(runRows);

        // Cargar fichas (para mostrar monitoreo/ficha)
        const fichaIdSet = Array.from(new Set(runRows.map((r) => r.ficha_id)));
        if (fichaIdSet.length) {
          const { data: fData, error: fErr } = await supabase
            .from("ficha_catalog")
            .select("id, codigo, monitoreo_id")
            .in("id", fichaIdSet);
          if (fErr) throw new Error(fErr.message);
          const fMap: Record<string, FichaRow> = {};
          (fData ?? []).forEach((f: any) => (fMap[f.id] = f));
          setFichas(fMap);

          const monIdSet = Array.from(new Set((fData ?? []).map((f: any) => f.monitoreo_id)));
          if (monIdSet.length) {
            const { data: mData, error: mErr } = await supabase
              .from("monitoreo_catalog")
              .select("id, codigo, nombre, anio, is_active")
              .in("id", monIdSet);
            if (mErr) throw new Error(mErr.message);
            const mMap: Record<string, MonitoreoRow> = {};
            (mData ?? []).forEach((m: any) => (mMap[m.id] = m));
            setMonById(mMap);
          } else {
            setMonById({});
          }
        } else {
          setFichas({});
          setMonById({});
        }

        // Cargar perfiles
        const userIds = Array.from(new Set(runRows.map((r) => r.created_by)));
        if (userIds.length) {
          const { data: pData, error: pErr } = await supabase
            .from("profiles")
            .select("id, role, nombres, apellido_paterno, apellido_materno, correo, email")
            .in("id", userIds);
          if (pErr) throw new Error(pErr.message);
          const pMap: Record<string, ProfileRow> = {};
          (pData ?? []).forEach((p: any) => (pMap[p.id] = p));
          setProfiles(pMap);
        } else {
          setProfiles({});
        }
      } catch (e: any) {
        if (!alive) return;
        setErr(e?.message || "No se pudo cargar indicadores.");
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [year, month, monitoreo, monitoreos]);

  const stats = useMemo(() => {
    const totalRuns = runs.length;
    const statusCounts = runs.reduce<Record<string, number>>((acc, r) => {
      const st = r.status === "submitted" ? "draft" : r.status;
      acc[st] = (acc[st] || 0) + 1;
      return acc;
    }, {});
    const userCount = new Set(runs.map((r) => r.created_by)).size;

    const roleCounts = Object.values(profiles).reduce<Record<string, number>>((acc, p) => {
      acc[p.role] = (acc[p.role] || 0) + 1;
      return acc;
    }, {});

    const byMonitoreo = runs.reduce<Record<string, number>>((acc, r) => {
      const ficha = fichas[r.ficha_id];
      const mon = ficha ? monById[ficha.monitoreo_id] : null;
      const key = mon?.codigo || "SIN_MON";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    const byUser = runs.reduce<Record<string, number>>((acc, r) => {
      acc[r.created_by] = (acc[r.created_by] || 0) + 1;
      return acc;
    }, {});

    const topUsers = Object.entries(byUser)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([uid, count]) => ({
        id: uid,
        count,
        name:
          [profiles[uid]?.apellido_paterno, profiles[uid]?.apellido_materno, profiles[uid]?.nombres]
            .filter(Boolean)
            .join(" ")
            .trim() ||
          profiles[uid]?.correo ||
          profiles[uid]?.email ||
          "Usuario",
      }));

    return { totalRuns, statusCounts, userCount, roleCounts, byMonitoreo, topUsers };
  }, [runs, profiles, fichas, monById]);

  return (
    <div className="text-white">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight md:text-2xl">Inicio</h1>
          <p className="mt-1 text-sm text-white/60">
            Indicadores en tiempo real por monitoreo, mes y año.
          </p>
        </div>
      </div>

      {/* Filtros */}
      <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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

          <label className="block">
            <div className="mb-2 text-xs font-medium text-white/70">Mes</div>
            <select
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-white/10"
            >
              {monthOptions().map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <div className="mb-2 text-xs font-medium text-white/70">Monitoreo</div>
            <select
              value={monitoreo}
              onChange={(e) => setMonitoreo(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-white/10"
            >
              <option value="ALL">Todos</option>
              {monitoreos.map((m) => (
                <option key={m.codigo} value={m.codigo}>
                  {m.codigo} - {m.nombre}
                </option>
              ))}
            </select>
          </label>

          <div className="flex items-end">
            <div className="text-xs text-white/50">
              {loading ? "Actualizando..." : "Actualizado"}
            </div>
          </div>
        </div>
      </div>

      {err && (
        <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-100">
          {err}
        </div>
      )}

      {/* Cards */}
      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="text-xs text-white/60">Fichas registradas</div>
          <div className="mt-1 text-2xl font-semibold">{stats.totalRuns}</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="text-xs text-white/60">Finalizadas</div>
          <div className="mt-1 text-2xl font-semibold">{stats.statusCounts.final || 0}</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="text-xs text-white/60">Borradores</div>
          <div className="mt-1 text-2xl font-semibold">{stats.statusCounts.draft || 0}</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="text-xs text-white/60">Usuarios registradores</div>
          <div className="mt-1 text-2xl font-semibold">{stats.userCount}</div>
        </div>
      </div>

      {/* Distribuciones */}
      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="text-sm font-semibold">Por monitoreo</div>
          <div className="mt-3 space-y-2 text-sm text-white/70">
            {Object.keys(stats.byMonitoreo).length === 0 ? (
              <div className="text-xs text-white/50">Sin datos.</div>
            ) : (
              Object.entries(stats.byMonitoreo).map(([k, v]) => (
                <div key={k} className="flex items-center justify-between">
                  <div>{k}</div>
                  <div className="text-white">{v}</div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="text-sm font-semibold">Usuarios por rol</div>
          <div className="mt-3 space-y-2 text-sm text-white/70">
            {Object.keys(stats.roleCounts).length === 0 ? (
              <div className="text-xs text-white/50">Sin datos.</div>
            ) : (
              Object.entries(stats.roleCounts).map(([k, v]) => (
                <div key={k} className="flex items-center justify-between">
                  <div>{roleLabel(k)}</div>
                  <div className="text-white">{v}</div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="text-sm font-semibold">Top monitores</div>
          <div className="mt-3 space-y-2 text-sm text-white/70">
            {stats.topUsers.length === 0 ? (
              <div className="text-xs text-white/50">Sin datos.</div>
            ) : (
              stats.topUsers.map((u) => (
                <div key={u.id} className="flex items-center justify-between">
                  <div className="truncate pr-2">{u.name}</div>
                  <div className="text-white">{u.count}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Últimos registros */}
      <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="text-sm font-semibold">Últimos registros</div>
        <div className="mt-3 space-y-2 text-sm text-white/70">
          {runs.slice(0, 6).map((r) => {
            const ficha = fichas[r.ficha_id];
            const mon = ficha ? monById[ficha.monitoreo_id] : null;
            return (
              <div key={r.id} className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-white/80">
                  {mon?.codigo || "MON"} / {ficha?.codigo || "FICHA"}
                </div>
                <div className="text-xs text-white/50">{fmtDateShort(r.created_at)}</div>
                <div
                  className={cls(
                    "rounded-lg border px-2 py-1 text-xs",
                    r.status === "final"
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
                      : "border-white/10 bg-white/5 text-white/70"
                  )}
                >
                  {r.status}
                </div>
              </div>
            );
          })}
          {runs.length === 0 && <div className="text-xs text-white/50">Sin registros.</div>}
        </div>
      </div>
    </div>
  );
}
