import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../app/AuthProvider";
import { canSeeAllRole } from "../lib/roles";

type MonitoreoCard = {
  id: string;
  key: string; // ej: "LM"
  title: string; // "Lengua Materna"
  subtitle: string;
  to: string; // "/app/monitoreo/LM"
};

function cls(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

export function MonitoreoPage() {
  const nav = useNavigate();
  const { profile, profileLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [monitoreos, setMonitoreos] = useState<MonitoreoCard[]>([]);
  const [error, setError] = useState<string | null>(null);

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

        const canSeeAll = canSeeAllRole(profile.role);
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
          .select("id, anio, codigo, nombre, descripcion, is_active")
          .eq("is_active", true)
          .order("anio", { ascending: false })
          .order("nombre", { ascending: true });

        const { data, error: monError } = canSeeAll ? await q : await q.in("id", ids);
        if (monError) throw new Error(monError.message);

        const items = (data ?? []).map((m: any) => ({
          id: m.id,
          key: m.codigo,
          title: m.nombre,
          subtitle: m.descripcion?.trim() || `${m.anio}`,
          to: `/app/monitoreo/${m.codigo}`,
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

  const cards = useMemo(() => monitoreos, [monitoreos]);

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
          <h1 className="text-xl font-semibold tracking-tight md:text-2xl">
            Elegir monitoreo
          </h1>
          <p className="mt-1 text-sm text-white/60">
            Selecciona el monitoreo y luego la ficha/formulario.
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {loading ? (
          <div className="text-sm text-white/60">Cargando monitoreos...</div>
        ) : error ? (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-100">
            {error}
          </div>
        ) : cards.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/60">
            No tienes monitoreos asignados.
          </div>
        ) : (
          cards.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => nav(m.to)}
              className={cls(
                "text-left rounded-2xl border border-white/10 bg-white/5 p-4 md:p-5",
                "hover:bg-white/10 transition"
              )}
            >
              <div className="text-xs text-white/50">Monitoreo</div>
              <div className="mt-1 text-lg font-semibold">{m.title}</div>
              <div className="mt-2 text-sm text-white/70">{m.subtitle}</div>

              <div className="mt-4 inline-flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-white/70">
                Elegir ficha →
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
