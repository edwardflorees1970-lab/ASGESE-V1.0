import { useState } from "react";
import { getTimeParts, normalizeTime24 } from "./helpers";

export function TimeField({
  value,
  onChange,
  ariaLabel = "Hora",
}: {
  value: string;
  onChange: (value: string) => void;
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const { hour, minute } = getTimeParts(value);

  const updatePart = (nextHour: string, nextMinute: string) => {
    if (!nextHour && !nextMinute) {
      onChange("");
      return;
    }
    if (nextHour && nextMinute) {
      onChange(`${nextHour}:${nextMinute}`);
      return;
    }
    if (nextHour && !nextMinute) {
      onChange(nextHour);
      return;
    }
    onChange(`${nextHour || "00"}:${nextMinute}`);
  };

  return (
    <div className="relative">
      <div className="relative">
        <input
          aria-label={ariaLabel}
          type="text"
          inputMode="numeric"
          maxLength={5}
          placeholder="HH:mm"
          className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 pr-11 text-sm"
          value={value}
          onChange={(e) => onChange(normalizeTime24(e.target.value))}
        />
        <button
          type="button"
          aria-label="Seleccionar hora"
          className="absolute inset-y-1 right-1 rounded-md border border-white/10 bg-white/5 px-2 text-sm text-white/80 hover:bg-white/10"
          onClick={() => setOpen((s) => !s)}
        >
          24h
        </button>
      </div>
      {open ? (
        <div className="absolute left-0 right-0 z-20 mt-2 rounded-xl border border-white/10 bg-slate-950 p-3 shadow-2xl">
          <div className="mb-2 flex items-center justify-between text-xs text-white/60">
            <span>Seleccione hora</span>
            <button
              type="button"
              className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-white/80 hover:bg-white/10"
              onClick={() => setOpen(false)}
            >
              Cerrar
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="mb-2 text-xs text-white/60">Hora</div>
              <div className="max-h-40 overflow-y-auto rounded-lg border border-white/10 bg-black/20 p-1">
                {Array.from({ length: 24 }, (_, idx) => String(idx).padStart(2, "0")).map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    className={`mb-1 w-full rounded-md px-3 py-2 text-sm ${
                      hour === opt ? "bg-cyan-500/20 text-cyan-100" : "bg-white/5 text-white/80 hover:bg-white/10"
                    }`}
                    onClick={() => updatePart(opt, minute)}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="mb-2 text-xs text-white/60">Minuto</div>
              <div className="max-h-40 overflow-y-auto rounded-lg border border-white/10 bg-black/20 p-1">
                {Array.from({ length: 60 }, (_, idx) => String(idx).padStart(2, "0")).map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    className={`mb-1 w-full rounded-md px-3 py-2 text-sm ${
                      minute === opt ? "bg-cyan-500/20 text-cyan-100" : "bg-white/5 text-white/80 hover:bg-white/10"
                    }`}
                    onClick={() => updatePart(hour, opt)}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
