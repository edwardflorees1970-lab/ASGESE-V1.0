import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../app/AuthProvider";
import { FichaDinamicaPage } from "./FichaDinamicaPage";
import { canSeeAllRole } from "../lib/roles";

export function FichaRouterPage() {
  const { monitoreoCodigo, fichaCodigo } = useParams();
  const [searchParams] = useSearchParams();
  const midParam = searchParams.get("mid");
  const { profile, profileLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);

  const m = (monitoreoCodigo || "").toUpperCase();
  void fichaCodigo;

  useEffect(() => {
    let alive = true;
    if (!m || profileLoading) return;

    (async () => {
      setLoading(true);
      try {
        if (!profile?.id) {
          if (!alive) return;
          setAllowed(false);
          setLoading(false);
          return;
        }

        if (canSeeAllRole(profile.role)) {
          if (!alive) return;
          setAllowed(true);
          setLoading(false);
          return;
        }

        let targetMonitoreoId = midParam;
        if (!targetMonitoreoId) {
          const { data: asigRows, error: asigRowsError } = await supabase
            .from("monitoreo_asignacion")
            .select("monitoreo_id")
            .eq("user_id", profile.id);
          if (asigRowsError) throw new Error(asigRowsError.message);
          const assignedIds = (asigRows ?? []).map((r: any) => r.monitoreo_id);
          if (assignedIds.length) {
            const { data: monRows, error: monRowsError } = await supabase
              .from("monitoreo_catalog")
              .select("id, anio")
              .eq("codigo", m)
              .eq("is_active", true)
              .in("id", assignedIds)
              .order("anio", { ascending: false })
              .limit(1);
            if (monRowsError) throw new Error(monRowsError.message);
            targetMonitoreoId = monRows?.[0]?.id ?? null;
          }
        }
        if (!targetMonitoreoId) {
          if (!alive) return;
          setAllowed(false);
          setLoading(false);
          return;
        }

        const { data: asig, error: asigError } = await supabase
          .from("monitoreo_asignacion")
          .select("id")
          .eq("monitoreo_id", targetMonitoreoId)
          .eq("user_id", profile.id)
          .limit(1);
        if (asigError) throw new Error(asigError.message);

        if (!alive) return;
        setAllowed((asig ?? []).length > 0);
        setLoading(false);
      } catch {
        if (!alive) return;
        setAllowed(false);
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [m, midParam, profile?.id, profile?.role, profileLoading]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-white/70">
        Cargando ficha...
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-white/70">
        No tienes acceso a este monitoreo. Solicita la asignación al administrador.
      </div>
    );
  }

  return <FichaDinamicaPage />;
}
