import { Navigate, useNavigate, useParams } from "react-router-dom";
import { FICHA_ESCRIBE_LM } from "../forms/ficha_escribe_lm";

function cls(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

type FichaCard = {
  id: string;
  title: string;
  subtitle: string;
  enabled?: boolean;
};

export function MonitoreoDetailPage() {
  const { monitoreoId } = useParams();
  const nav = useNavigate();

  if (!monitoreoId) return <Navigate to="/app/monitoreo" replace />;

  // Solo tenemos implementada "escribe-lm" por ahora.
  // Las otras quedan listas pero deshabilitadas hasta que creemos sus páginas/forms.
  const fichas: FichaCard[] =
    monitoreoId === "lengua-materna"
      ? [
          {
            id: FICHA_ESCRIBE_LM.key, // "escribe-lm"
            title: "Ficha 1: Escribe",
            subtitle: "Escribe diversos tipos de textos en su lengua materna",
            enabled: true,
          },
          {
            id: "lee-lm",
            title: "Ficha 2: Lee",
            subtitle: "Lee diversos tipos de textos escritos",
            enabled: false,
          },
          {
            id: "comunica-oral-lm",
            title: "Ficha 3: Comunicación oral",
            subtitle: "Se comunica oralmente en su lengua materna",
            enabled: false,
          },
        ]
      : [];

  if (!fichas.length) return <Navigate to="/app/monitoreo" replace />;

  return (
    <div className="text-white">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Monitoreo: Lengua Materna
          </h1>
          <p className="mt-1 text-sm text-white/60">
            Elige la ficha que vas a aplicar.
          </p>
        </div>

        <button
          onClick={() => nav("/app/monitoreo")}
          className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 hover:bg-white/10"
        >
          ← Volver
        </button>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {fichas.map((f) => {
          const disabled = !f.enabled;
          return (
            <button
              key={f.id}
              disabled={disabled}
              onClick={() => nav(`/app/monitoreo/${monitoreoId}/ficha/${f.id}`)}
              className={cls(
                "text-left rounded-2xl border border-white/10 bg-white/5 p-5 transition",
                disabled
                  ? "opacity-50 cursor-not-allowed"
                  : "hover:bg-white/10"
              )}
            >
              <div className="text-xs text-white/50">Ficha</div>
              <div className="mt-1 text-lg font-semibold">{f.title}</div>
              <div className="mt-2 text-sm text-white/70">{f.subtitle}</div>

              <div className="mt-4 inline-flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-white/70">
                {disabled ? "Próximamente" : "Abrir ficha →"}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
