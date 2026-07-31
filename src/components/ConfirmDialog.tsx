import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from "react";

type ConfirmVariant = "default" | "danger";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description?: string | ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: ConfirmVariant;
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
};

function cls(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmText = "Confirmar",
  cancelText = "Cancelar",
  variant = "default",
  busy = false,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    cancelRef.current?.focus();
    return () => previous?.focus();
  }, [open]);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape" && !busy) onClose();
    if (event.key !== "Tab") return;
    const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>("button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])") ?? []);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable.at(-1)!;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div
        className="agebre-dialog-overlay absolute inset-0"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={description ? descriptionId : undefined}
          onKeyDown={handleKeyDown}
          className="agebre-dialog w-full max-w-md overflow-hidden"
        >
          <div className="border-b border-[var(--app-border)] px-5 py-4">
            <div id={titleId} className="text-sm font-semibold">{title}</div>
            {description && (
              <div id={descriptionId} className="mt-1 text-xs text-[var(--app-muted)]">{description}</div>
            )}
          </div>
          <div className="flex items-center justify-end gap-2 px-5 py-4">
            <button
              ref={cancelRef}
              type="button"
              onClick={onClose}
              disabled={busy}
              className="agebre-button rounded-lg px-3 py-2 text-xs disabled:opacity-60"
            >
              {cancelText}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={busy}
              className={cls(
                "rounded-lg px-3 py-2 text-xs font-semibold transition-[background-color,border-color,box-shadow] duration-200 disabled:opacity-60",
                variant === "danger"
                  ? "border border-red-500/40 bg-red-500/15 text-red-100 hover:bg-red-500/25"
                  : "executive-primary-action"
              )}
            >
              {busy ? "Procesando..." : confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
