import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../app/AuthProvider";
import { FichaEscribeLMPage } from "./FichaEscribeLMPage";
import { FichaLeeLMPage } from "./FichaLeeLMPage";
import { FichaOralLMPage } from "./FichaOralLMPage";

function Placeholder({ title }: { title: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-white">
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      <p className="mt-2 text-sm text-white/60">Módulo en construcción.</p>
    </div>
  );
}

export function FichaRouterPage() {
  const { monitoreoCodigo, fichaCodigo } = useParams();
  const { profile, profileLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);

  const m = (monitoreoCodigo || "").toUpperCase();
  const f = (fichaCodigo || "").toUpperCase();

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

        if (profile.role === "admin") {
          if (!alive) return;
          setAllowed(true);
          setLoading(false);
          return;
        }

        const { data: mon, error: monError } = await supabase
          .from("monitoreo_catalog")
          .select("id, codigo, is_active")
          .eq("codigo", m)
          .eq("is_active", true)
          .order("anio", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (monError) throw new Error(monError.message);
        if (!mon?.id) {
          if (!alive) return;
          setAllowed(false);
          setLoading(false);
          return;
        }

        const { data: asig, error: asigError } = await supabase
          .from("monitoreo_asignacion")
          .select("id")
          .eq("monitoreo_id", mon.id)
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
  }, [m, profile?.id, profile?.role, profileLoading]);

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

  // Por ahora implementamos LM/ESCRIBE real
  if (m === "LM" && f === "ESCRIBE") {
    return <FichaEscribeLMPage />;
  }

  if (m === "LM" && f === "LEE") {
    return <FichaLeeLMPage />;
  }

  if (m === "LM" && f === "ORAL") {
    return <FichaOralLMPage />;
  }

  return <Placeholder title={`Ficha no soportada: ${m}/${f}`} />;
}
