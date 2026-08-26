export function ReorderButtons({
  onUp,
  onDown,
  disabledUp,
  disabledDown,
  label,
}: {
  onUp: () => void;
  onDown: () => void;
  disabledUp: boolean;
  disabledDown: boolean;
  label: string;
}) {
  return (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={onUp}
        disabled={disabledUp}
        aria-label={`Subir ${label}`}
        title={`Subir ${label}`}
        className="rounded-lg border border-white/10 bg-white/5 px-2 py-2 text-xs text-white/80 disabled:cursor-not-allowed disabled:opacity-30"
      >
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
          <path d="M10 15V5" />
          <path d="M6.5 8.5L10 5L13.5 8.5" />
        </svg>
      </button>
      <button
        type="button"
        onClick={onDown}
        disabled={disabledDown}
        aria-label={`Bajar ${label}`}
        title={`Bajar ${label}`}
        className="rounded-lg border border-white/10 bg-white/5 px-2 py-2 text-xs text-white/80 disabled:cursor-not-allowed disabled:opacity-30"
      >
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
          <path d="M10 5V15" />
          <path d="M6.5 11.5L10 15L13.5 11.5" />
        </svg>
      </button>
    </div>
  );
}
