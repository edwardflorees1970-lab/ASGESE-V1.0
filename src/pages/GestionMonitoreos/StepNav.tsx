export type StepStatus = "pending" | "active" | "done";

export interface StepNavItem {
  id: string;
  label: string;
  status: StepStatus;
}

interface StepNavProps {
  steps: StepNavItem[];
  current: string;
  onSelect: (id: string) => void;
}

/**
 * Presentation-only step navigator. Vertical list on desktop, horizontal
 * scrollable progress bar on narrow viewports. No step is ever disabled —
 * navigation is always free; only visual status (pending/active/done) hints
 * at progress.
 */
export function StepNav({ steps, current, onSelect }: StepNavProps) {
  return (
    <nav
      aria-label="Pasos del monitoreo"
      className="management-step-nav flex gap-2 overflow-x-auto pb-1 md:flex-col md:gap-1.5 md:overflow-visible md:pb-0"
    >
      {steps.map((step, idx) => {
        const isActive = step.id === current;
        const isDone = step.status === "done" && !isActive;
        return (
          <button
            key={step.id}
            type="button"
            aria-current={isActive ? "step" : undefined}
            onClick={() => onSelect(step.id)}
            className={`management-step-nav-item flex shrink-0 items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left text-xs font-semibold transition-colors md:shrink md:w-full ${
              isActive
                ? "border-[var(--app-accent)] bg-[color-mix(in_srgb,var(--app-accent)_14%,transparent)] text-[var(--app-accent)]"
                : isDone
                ? "border-[var(--app-border)] bg-[var(--app-surface-2)] text-[var(--app-text)]"
                : "border-[var(--app-border)] bg-[var(--app-surface)] text-[var(--app-muted)]"
            }`}
          >
            <span
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold ${
                isActive
                  ? "border-[var(--app-accent)] bg-[var(--app-accent)] text-white"
                  : isDone
                  ? "border-[var(--app-success)] bg-[color-mix(in_srgb,var(--app-success)_16%,transparent)] text-[var(--app-success)]"
                  : "border-[var(--app-border)] text-[var(--app-muted)]"
              }`}
            >
              {isDone ? "✓" : idx + 1}
            </span>
            <span className="whitespace-nowrap md:whitespace-normal">{step.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
