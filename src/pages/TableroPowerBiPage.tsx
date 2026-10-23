// Informe de Power BI incrustado. La direccion se puede cambiar con VITE_POWERBI_REPORT_URL.
const DEFAULT_REPORT_URL =
  "https://app.powerbi.com/view?r=eyJrIjoiNjdiMTE1ZGYtZmM0My00NzExLTkxZDEtYjg5MmJkZTA1YjllIiwidCI6Ijk4MjAxZmVmLWQ5ZjYtNGU2OC04NGY1LWMyNzA1MDc0ZTM0MiIsImMiOjR9";

export function TableroPowerBiPage() {
  const configured = (import.meta.env.VITE_POWERBI_REPORT_URL as string | undefined)?.trim();
  const reportUrl = configured || DEFAULT_REPORT_URL;

  return (
    <div className="dashboard-shell min-w-0 pb-6 text-white">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <span className="dashboard-tone-blue rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.13em]">
            Power BI
          </span>
          <h1 className="mt-3 text-2xl font-semibold tracking-[-0.035em] text-white sm:text-3xl">Tablero Power BI</h1>
          <p className="mt-1.5 max-w-2xl text-sm leading-6 text-white/50">
            Avance de fichas y metas por especialista, asistencia del personal y respuestas, con datos en vivo.
          </p>
        </div>
        <a
          href={reportUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-lg border border-white/10 px-3 py-2 text-xs text-white/60 transition hover:border-white/20 hover:bg-white/5 hover:text-white"
        >
          Abrir en pantalla completa
        </a>
      </header>

      <section className="dashboard-panel mt-5 overflow-hidden rounded-2xl p-2 sm:p-3" aria-label="Tablero Power BI">
        <div className="w-full" style={{ aspectRatio: "1024 / 612" }}>
          <iframe
            title="Tablero ASGESE en Power BI"
            src={reportUrl}
            className="h-full w-full rounded-xl border-0"
            allowFullScreen
            loading="lazy"
            referrerPolicy="no-referrer"
            sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-forms"
          />
        </div>
      </section>
    </div>
  );
}
