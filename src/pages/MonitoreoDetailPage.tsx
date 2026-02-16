import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../app/AuthProvider";
import { getFichasByMonitoreo } from "../lib/monitoreoApi";
import { canSeeAllRole } from "../lib/roles";

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
};

function cls(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

export function MonitoreoDetailPage() {
  const nav = useNavigate();
  const { monitoreoCodigo } = useParams();
  const { profile, profileLoading } = useAuth();

  const [loading, setLoading] = useState(true);
  const [monitoreo, setMonitoreo] = useState<MonitoreoRow | null>(null);
  const [assigned, setAssigned] = useState(false);
  const [fichas, setFichas] = useState<FichaCard[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    if (!monitoreoCodigo || profileLoading) return;

    (async () => {
      setLoading(true);
      setError(null);
      setFichas([]);
      try {
        const { data: monData, error: monError } = await supabase
          .from("monitoreo_catalog")
          .select("id, codigo, nombre, descripcion, anio, is_active")
          .eq("codigo", monitoreoCodigo)
          .eq("is_active", true)
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
  }, [monitoreoCodigo, profileLoading, profile?.id, profile?.role]);

  const cards = useMemo(() => fichas, [fichas]);

  if (!monitoreoCodigo) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-white/70">
        Falta el código del monitoreo.
      </div>
    );
  }

  return (
    <div className="text-white">
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => nav("/app/monitoreo")}
          className="self-start rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 hover:bg-white/10"
        >
          ← Volver
        </button>
        <div>
          <h1 className="text-xl font-semibold tracking-tight md:text-2xl">
            Monitoreo: {monitoreo?.nombre || monitoreoCodigo}
          </h1>
          <p className="mt-1 text-sm text-white/60">
            Elige la ficha/formulario a registrar.
          </p>
        </div>
      </div>

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
      ) : !assigned ? (
        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-6 text-white/70">
          No tienes acceso a este monitoreo. Solicita la asignación al administrador.
        </div>
      ) : cards.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-6 text-white/70">
          No hay fichas configuradas para este monitoreo.
        </div>
      ) : (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {cards.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() =>
                nav(
                  `/app/monitoreo/${monitoreoCodigo}/ficha/${f.key}?mid=${encodeURIComponent(monitoreo.id)}`
                )
              }
              className={cls(
                "text-left rounded-2xl border border-white/10 bg-white/5 p-4 md:p-5",
                "hover:bg-white/10 transition"
              )}
            >
              <div className="text-xs text-white/50">Ficha</div>
              <div className="mt-1 text-lg font-semibold">{f.title}</div>
              <div className="mt-2 text-sm text-white/70">{f.subtitle}</div>

              <div className="mt-4 inline-flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-white/70">
                Abrir ficha →
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
