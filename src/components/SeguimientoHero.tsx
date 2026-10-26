import { daysFromToday, isMonitoreoExpired } from "../lib/monitoreoVigencia";
import { fmtDate, type MonitoreoRow, type Toast } from "../lib/seguimiento";


type HeroMetric = { label: string; value: string | number };

export function SeguimientoHero({
  title,
  subtitle,
  metrics,
  monitoreos,
  monitoreoId,
  onChange,
  selected,
}: {
  title: string;
  subtitle: string;
  metrics: HeroMetric[] | null;
  monitoreos: MonitoreoRow[];
  monitoreoId: string;
  onChange: (id: string) => void;
  selected: MonitoreoRow | null;
}) {
  return (
    <section className="tracking-hero">
      <div className="tracking-hero__main">
        <div className="tracking-hero__identity">
          <div className="tracking-hero__icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M4 19V9M10 19V5M16 19v-7M22 19V3M2 21h22" />
            </svg>
          </div>
          <div>
            <div className="tracking-eyebrow">SEGUIMIENTO</div>
            <h1 className="text-xl font-semibold tracking-tight md:text-2xl">{title}</h1>
            <p className="mt-1 text-sm">{subtitle}</p>
          </div>
        </div>
        {metrics && (
          <div className="seg-kpis" aria-label="Resumen del monitoreo">
            {metrics.map((m) => (
              <div key={m.label} className="tracking-metric">
                <span>{m.label}</span>
                <strong>{m.value}</strong>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="tracking-hero__monitor w-full min-w-0 sm:min-w-[220px] sm:max-w-[420px]">
        <label htmlFor="seg-monitoreo" className="tracking-control-label mb-2 block">Monitoreo</label>
        <select
          id="seg-monitoreo"
          className="w-full rounded-xl border px-3 py-2 text-sm"
          value={monitoreoId}
          onChange={(e) => onChange(e.target.value)}
        >
          {monitoreos.map((m) => (
            <option key={m.id} value={m.id}>
              {m.nombre}
              {isMonitoreoExpired(m.fecha_fin) ? " (vencido)" : !m.is_active ? " (inactivo)" : ""}
            </option>
          ))}
        </select>
        {selected && (
          <div className="tracking-monitor-status mt-2 text-xs">
            <span>{fmtDate(selected.fecha_inicio)} – {fmtDate(selected.fecha_fin)}</span>
            <span>
              {(() => {
                const d = daysFromToday(selected.fecha_fin);
                if (d == null) return "Sin fecha fin";
                if (d < 0) return `Venció hace ${Math.abs(d)} días`;
                if (d === 0) return "Vence hoy";
                return `Quedan ${d} días`;
              })()}
            </span>
          </div>
        )}
      </div>
    </section>
  );
}

export function SeguimientoToast({ toast }: { toast: Toast | null }) {
  if (!toast) return null;
  return (
    <div role="status" className={`seg-toast ${toast.type === "err" ? "is-err" : "is-ok"}`}>
      {toast.msg}
    </div>
  );
}
