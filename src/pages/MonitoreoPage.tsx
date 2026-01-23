import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

type Monitoreo = {
  id: string;
  titulo: string;
  descripcion: string;
  fichas: { id: string; titulo: string; descripcion: string }[];
};

function cls(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

export function MonitoreoPage() {
  const nav = useNavigate();
  const [selected, setSelected] = useState<string | null>(null);

  // ✅ Por ahora hardcodeado. Luego lo jalamos de BD sin llorar.
  const monitoreos: Monitoreo[] = useMemo(
    () => [
      {
        id: "comunicacion-lm",
        titulo: "Comunicación - Lengua Materna",
        descripcion: "Monitoreo pedagógico de lectura, escritura y comunicación oral.",
        fichas: [
          {
            id: "ficha-1",
            titulo: "Ficha de Monitoreo 01",
            descripcion: "Formulario principal (el que vamos a implementar primero).",
          },
        ],
      },
    ],
    []
  );

  const active = monitoreos.find((m) => m.id === selected) ?? null;

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <h2 className="text-xl font-semibold tracking-tight">Elegir monitoreo</h2>
        <p className="mt-2 text-sm text-white/60">
          Primero eliges el monitoreo. Luego eliges la ficha/formulario.
        </p>
      </div>

      {/* Monitoreos */}
      <div className="grid gap-4 md:grid-cols-2">
        {monitoreos.map((m) => {
          const isActive = m.id === selected;
          return (
            <button
              key={m.id}
              onClick={() => setSelected(m.id)}
              className={cls(
                "text-left rounded-2xl border p-5 transition",
                isActive
                  ? "border-white/30 bg-white/10"
                  : "border-white/10 bg-white/5 hover:bg-white/10"
              )}
            >
              <div className="text-sm text-white/60">Monitoreo</div>
              <div className="mt-1 text-lg font-semibold">{m.titulo}</div>
              <div className="mt-2 text-sm text-white/70">{m.descripcion}</div>
            </button>
          );
        })}
      </div>

      {/* Fichas del monitoreo */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold">Fichas / Formularios</h3>
            <p className="mt-1 text-sm text-white/60">
              {active ? `Monitoreo seleccionado: ${active.titulo}` : "Selecciona un monitoreo para ver sus fichas."}
            </p>
          </div>

          {active && (
            <span className="rounded-xl border border-white/10 bg-black/20 px-3 py-1 text-xs text-white/70">
              {active.fichas.length} ficha(s)
            </span>
          )}
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {!active ? (
            <div className="text-sm text-white/50">Aún no hay monitoreo seleccionado.</div>
          ) : (
            active.fichas.map((f) => (
              <button
                key={f.id}
                onClick={() => nav(`/app/monitoreo/${active.id}/ficha/${f.id}`)}
                className="text-left rounded-2xl border border-white/10 bg-white/5 p-5 hover:bg-white/10 transition"
              >
                <div className="text-sm text-white/60">Ficha</div>
                <div className="mt-1 text-base font-semibold">{f.titulo}</div>
                <div className="mt-2 text-sm text-white/70">{f.descripcion}</div>
                <div className="mt-3 text-xs text-white/50">Abrir formulario →</div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
