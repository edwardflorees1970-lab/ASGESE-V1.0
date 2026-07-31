import type { ButtonHTMLAttributes, ReactNode } from "react";

type IconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "title"> & {
  label: string;
  children: ReactNode;
  tone?: "neutral" | "danger" | "accent";
};

function cls(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function IconButton({ label, children, tone = "neutral", className, type = "button", ...props }: IconButtonProps) {
  return (
    <button
      {...props}
      type={type}
      aria-label={label}
      data-tooltip={label}
      className={cls(
        "agebre-icon-button",
        tone === "danger" && "border-red-500/35 bg-red-500/10 text-red-200",
        tone === "accent" && "border-cyan-400/35 bg-cyan-400/10 text-cyan-200",
        className
      )}
    >
      {children}
    </button>
  );
}
