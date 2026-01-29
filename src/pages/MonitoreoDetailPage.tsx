import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";

type FichaCard = {
  key: string;     // "ESCRIBE" | "LEE" | "ORAL"
  title: string;
  subtitle: string;
};

function cls(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

export function MonitoreoDetailPage() {
  const nav = useNavigate();
  const { monitoreoCodigo } = useParams();

  // Si entras a /app/monitoreo sin código por error
  if (!monitoreoCodigo) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-white/70">
        Falta el código del monitoreo.
      </div>
    );
  }

  const fichas: FichaCard[] = useMemo(() => {
    // Por ahora solo LM 2026
    if (monitoreoCodigo === "LM") {
      return [
        {
          key: "ESCRIBE",
          title: "Ficha 1: Escribe",
          subtitle: "Escribe diversos tipos de textos en su lengua materna",
        },
        {
          key: "LEE",
          title: "Ficha 2: Lee",
          subtitle: "Lee diversos tipos de textos escritos",
        },
        {
          key: "ORAL",
          title: "Ficha 3: Oralidad",
          subtitle: "Se comunica oralmente en su lengua materna",
        },
      ];
    }

    // Monitoreos futuros: devuelve vacío o un placeholder
    return [];
  }, [monitoreoCodigo]);

  return (
    <div className="text-white">
      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <h1 className="text-xl font-semibold tracking-tight md:text-2xl">
            Monitoreo: {monitoreoCodigo}
          </h1>
          <p className="mt-1 text-sm text-white/60">
            Elige la ficha/formulario a registrar.
          </p>
        </div>

        <button
          type="button"
          onClick={() => nav("/app/monitoreo")}
          className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 hover:bg-white/10"
        >
          ← Volver
        </button>
      </div>

      {fichas.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-6 text-white/70">
          No hay fichas configuradas para este monitoreo.
        </div>
      ) : (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {fichas.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => nav(`/app/monitoreo/${monitoreoCodigo}/ficha/${f.key}`)}
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
