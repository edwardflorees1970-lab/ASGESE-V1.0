import { memo, useCallback, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";

export type IconName =
  | "activity"
  | "check"
  | "clock"
  | "people"
  | "search"
  | "trend"
  | "filter"
  | "calendar"
  | "target";

type Option = { value: string; label: string };

function normalizeSearchValue(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es")
    .trim();
}

type FloatingMenuPosition = {
  bottom?: number;
  left: number;
  maxHeight: number;
  top?: number;
  width: number;
};

function useFloatingMenu<T extends HTMLElement>(open: boolean, preferredHeight = 288) {
  const anchorRef = useRef<T>(null);
  const [menuPosition, setMenuPosition] = useState<FloatingMenuPosition | null>(null);

  const updateMenuPosition = useCallback(() => {
    const anchor = anchorRef.current;
    if (!anchor) return;

    const rect = anchor.getBoundingClientRect();
    const viewportPadding = 8;
    const gap = 8;
    const minimumUsableHeight = 144;
    const spaceBelow = window.innerHeight - rect.bottom - gap - viewportPadding;
    const spaceAbove = rect.top - gap - viewportPadding;
    const openAbove = spaceBelow < minimumUsableHeight && spaceAbove > spaceBelow;
    const availableHeight = openAbove ? spaceAbove : spaceBelow;
    const maxHeight = Math.max(96, Math.min(preferredHeight, availableHeight));
    const width = Math.min(rect.width, window.innerWidth - viewportPadding * 2);
    const left = Math.min(
      Math.max(viewportPadding, rect.left),
      Math.max(viewportPadding, window.innerWidth - width - viewportPadding)
    );

    setMenuPosition({
      left,
      maxHeight,
      width,
      ...(openAbove
        ? { bottom: window.innerHeight - rect.top + gap }
        : { top: rect.bottom + gap }),
    });
  }, [preferredHeight]);

  useLayoutEffect(() => {
    if (!open) return;

    updateMenuPosition();
    const handleViewportChange = () => updateMenuPosition();
    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleViewportChange, true);

    const observer = typeof ResizeObserver === "undefined"
      ? null
      : new ResizeObserver(handleViewportChange);
    if (anchorRef.current) observer?.observe(anchorRef.current);

    return () => {
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleViewportChange, true);
      observer?.disconnect();
    };
  }, [open, updateMenuPosition]);

  return { anchorRef, menuPosition };
}

export function DashboardIcon({ name, className = "h-5 w-5" }: { name: IconName; className?: string }) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  const paths: Record<IconName, ReactNode> = {
    activity: <><path d="M3 12h4l2.2-6 4.2 12 2.2-6H21" /></>,
    check: <><path d="M20 6 9 17l-5-5" /></>,
    clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7v5l3.5 2" /></>,
    people: <><path d="M16 20v-1.8a4.2 4.2 0 0 0-4.2-4.2H6.2A4.2 4.2 0 0 0 2 18.2V20" /><circle cx="9" cy="7" r="3" /><path d="M22 20v-1.8a4.2 4.2 0 0 0-3.2-4.1M16 4.2a3 3 0 0 1 0 5.8" /></>,
    search: <><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5" /></>,
    trend: <><path d="m3 17 6-6 4 4 8-9" /><path d="M15 6h6v6" /></>,
    filter: <><path d="M4 6h16M7 12h10M10 18h4" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></>,
    target: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></>,
  };

  return <svg viewBox="0 0 24 24" aria-hidden="true" className={className} {...common}>{paths[name]}</svg>;
}

export const DashboardPanel = memo(function DashboardPanel({
  title,
  eyebrow,
  description,
  action,
  children,
  className = "",
}: {
  title: string;
  eyebrow?: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`dashboard-panel min-w-0 rounded-2xl p-4 sm:p-5 ${className}`}>
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          {eyebrow && <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-cyan-300/80">{eyebrow}</div>}
          <h2 className="mt-0.5 text-sm font-semibold tracking-tight text-white sm:text-base">{title}</h2>
          {description && <p className="mt-1 text-xs leading-5 text-white/50">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
});

export const KpiCard = memo(function KpiCard({
  label,
  value,
  detail,
  icon,
  tone = "cyan",
  progress,
  className = "",
}: {
  label: string;
  value: string;
  detail: string;
  icon: IconName;
  tone?: "cyan" | "emerald" | "amber" | "violet";
  progress?: number;
  className?: string;
}) {
  const tones = {
    cyan: "dashboard-tone-blue",
    emerald: "dashboard-tone-green",
    amber: "dashboard-tone-amber",
    violet: "dashboard-tone-violet",
  };

  return (
    <article className={`dashboard-kpi group relative min-h-40 min-w-0 overflow-hidden rounded-2xl border border-white/10 p-4 sm:p-5 ${className}`}>
      <div className={`dashboard-kpi-accent absolute inset-x-0 top-0 h-1 ${tones[tone]}`} />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-medium text-white/55">{label}</div>
          <div className="mt-2 truncate text-2xl font-semibold tracking-[-0.035em] text-white sm:text-3xl">{value}</div>
        </div>
        <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl border ${tones[tone]}`}>
          <DashboardIcon name={icon} className="h-5 w-5" />
        </div>
      </div>
      <div className="mt-4 min-h-8 text-[11px] leading-4 text-white/45">{detail}</div>
      {progress !== undefined && (
        <div className="dashboard-progress-track mt-3 h-1.5 overflow-hidden rounded-full">
          <div className="dashboard-progress-value h-full rounded-full transition-[width] duration-700" style={{ width: `${Math.max(0, Math.min(100, progress))}%` }} />
        </div>
      )}
    </article>
  );
});

export function EmptyChart({ message = "No hay información para los filtros seleccionados." }: { message?: string }) {
  return (
    <div className="grid h-full min-h-52 place-items-center rounded-xl border border-dashed border-white/10 bg-black/10 px-5 text-center text-xs text-white/40">
      <div><DashboardIcon name="activity" className="mx-auto mb-2 h-6 w-6 opacity-60" />{message}</div>
    </div>
  );
}

export function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: string | number; color?: string }>;
  label?: string | number;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="dashboard-chart-tooltip min-w-36 rounded-xl border border-white/10 px-3 py-2 shadow-2xl">
      {label !== undefined && <div className="mb-1.5 text-[11px] font-semibold text-white/70">{label}</div>}
      <div className="space-y-1">
        {payload.map((item, index) => (
          <div key={`${item.name}-${index}`} className="flex items-center justify-between gap-4 text-xs">
            <span className="flex items-center gap-1.5 text-white/55"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />{item.name}</span>
            <span className="font-semibold text-white">{Number(item.value ?? 0).toLocaleString("es-PE")}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function DashboardSelect({
  label,
  value,
  options,
  onChange,
  icon = "calendar",
}: {
  label: string;
  value: string;
  options: readonly Option[];
  onChange: (value: string) => void;
  icon?: IconName;
}) {
  const [open, setOpen] = useState(false);
  const { anchorRef, menuPosition } = useFloatingMenu<HTMLButtonElement>(open, 256);
  const menuId = useId();
  const labelId = useId();
  const selectedLabel = options.find((option) => option.value === value)?.label ?? value;

  const select = (next: string) => {
    onChange(next);
    setOpen(false);
  };

  return (
    <div className="relative min-w-0">
      <span id={labelId} className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.11em] text-white/45">
        <DashboardIcon name={icon} className="h-3.5 w-3.5" />{label}
      </span>
      <button
        ref={anchorRef}
        type="button"
        className="dashboard-control dashboard-select-trigger flex h-11 w-full items-center justify-between gap-3 rounded-xl border px-3 text-left text-sm outline-none"
        aria-controls={open ? menuId : undefined}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-labelledby={labelId}
        onClick={() => setOpen((current) => !current)}
        onBlur={() => window.setTimeout(() => setOpen(false), 140)}
        onKeyDown={(event) => {
          if (event.key === "Escape") setOpen(false);
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            const currentIndex = Math.max(0, options.findIndex((option) => option.value === value));
            const direction = event.key === "ArrowDown" ? 1 : -1;
            const nextIndex = (currentIndex + direction + options.length) % options.length;
            if (options[nextIndex]) onChange(options[nextIndex].value);
            setOpen(true);
          }
        }}
      >
        <span className="min-w-0 truncate">{selectedLabel}</span>
        <svg className="dashboard-select-chevron h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <path d="m7 9 5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && menuPosition && createPortal(
        <div
          id={menuId}
          role="listbox"
          aria-label={`${label}: opciones disponibles`}
          className="dashboard-filter-menu dashboard-filter-portal overflow-y-auto overscroll-contain rounded-xl border border-white/10 p-1.5 shadow-2xl"
          style={menuPosition}
        >
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={option.value === value}
              className="dashboard-filter-option flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => select(option.value)}
            >
              <span className="min-w-0 truncate">{option.label}</span>
              {option.value === value && <DashboardIcon name="check" className="h-4 w-4 shrink-0" />}
            </button>
          ))}
          {!options.length && <div className="dashboard-filter-empty px-3 py-3 text-xs">No hay opciones disponibles.</div>}
        </div>,
        document.body
      )}
    </div>
  );
}

export function SearchableFilter({
  label,
  value,
  options,
  allLabel,
  includeAll = true,
  onChange,
  placeholder = "Buscar...",
}: {
  label: string;
  value: string;
  options: readonly Option[];
  allLabel: string;
  includeAll?: boolean;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const { anchorRef, menuPosition } = useFloatingMenu<HTMLInputElement>(open);
  const menuId = useId();
  const selectedLabel = includeAll && value === "ALL"
    ? allLabel
    : options.find((option) => option.value === value)?.label ?? allLabel;
  const visibleOptions = useMemo(() => {
    const normalized = normalizeSearchValue(query);
    const filtered = normalized
      ? options.filter((option) => normalizeSearchValue(`${option.label} ${option.value}`).includes(normalized))
      : options;
    return filtered.slice(0, normalized ? 20 : 5);
  }, [options, query]);

  const select = (next: string) => {
    onChange(next);
    setQuery("");
    setOpen(false);
  };

  return (
    <label className="relative block min-w-0">
      <span className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.11em] text-white/45">
        <DashboardIcon name="search" className="h-3.5 w-3.5" />{label}
      </span>
      <input
        ref={anchorRef}
        type="search"
        value={open ? query : selectedLabel}
        onFocus={() => { setOpen(true); setQuery(""); }}
        onClick={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 140)}
        onChange={(event) => { setQuery(event.target.value); setOpen(true); }}
        onKeyDown={(event) => {
          if (event.key === "Escape") setOpen(false);
          if (event.key === "Enter" && visibleOptions[0]) {
            event.preventDefault();
            select(visibleOptions[0].value);
          }
        }}
        className="dashboard-control h-11 w-full rounded-xl border px-3 outline-none"
        placeholder={placeholder}
        title={open ? undefined : selectedLabel}
        autoComplete="off"
        spellCheck={false}
        aria-controls={open ? menuId : undefined}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-autocomplete="list"
        role="combobox"
      />
      {open && menuPosition && createPortal(
        <div
          id={menuId}
          role="listbox"
          aria-label={`${label}: opciones disponibles`}
          className="dashboard-filter-menu dashboard-filter-portal overflow-y-auto overscroll-contain rounded-xl border border-white/10 p-1.5 shadow-2xl"
          style={menuPosition}
        >
          {includeAll && !query.trim() && <button type="button" role="option" aria-selected={value === "ALL"} onMouseDown={(event) => event.preventDefault()} onClick={() => select("ALL")} className="dashboard-filter-option w-full rounded-lg px-3 py-2 text-left">{allLabel}</button>}
          {visibleOptions.map((option) => (
            <button key={option.value} type="button" role="option" aria-selected={option.value === value} onMouseDown={(event) => event.preventDefault()} onClick={() => select(option.value)} className="dashboard-filter-option w-full truncate rounded-lg px-3 py-2 text-left" title={option.label}>{option.label}</button>
          ))}
          {!visibleOptions.length && <div className="dashboard-filter-empty px-3 py-3 text-xs">Sin coincidencias.</div>}
          {!query && options.length > 5 && <div className="dashboard-filter-hint border-t px-3 pt-2 text-[10px]">Escribe para buscar entre {options.length} registros.</div>}
        </div>,
        document.body
      )}
    </label>
  );
}
