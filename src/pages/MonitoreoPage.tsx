import { useMemo } from "react";
import { useNavigate } from "react-router-dom";

type MonitoreoCard = {
  id: string;
  title: string;
  subtitle: string;
};

function cls(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

export function MonitoreoPage() {
  const nav = useNavigate();

  const monitoreos: MonitoreoCard[] = useMemo(
    () => [
      {
        id: "lengua-materna",
        title: "Lengua Materna",
        subtitle: "Fichas: Escribe / Lee / Comunicación oral",
      },
    ],
    []
  );

  return (
    <div className="text-white">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Elegir monitoreo</h1>
          <p className="mt-1 text-sm text-white/60">
            Selecciona el monitoreo y luego la ficha/formulario.
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {monitoreos.map((m) => (
          <button
            key={m.id}
            onClick={() => nav(`/app/monitoreo/${m.id}`)}
            className={cls(
              "text-left rounded-2xl border border-white/10 bg-white/5 p-5",
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
        ))}
      </div>
    </div>
  );
}
