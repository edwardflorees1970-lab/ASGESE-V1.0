import { useState } from "react";
import type { ReactNode } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../app/AuthProvider";
import { canSeeAllRole, roleLabel } from "../lib/roles";
import { useTheme } from "../app/ThemeProvider";

function cls(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

const Item = ({
  to,
  label,
  icon,
  onClick,
}: {
  to: string;
  label: string;
  icon: ReactNode;
  onClick?: () => void;
}) => (
  <NavLink
    to={to}
    end
    onClick={onClick}
    className={({ isActive }) =>
      [
        "flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition",
        isActive
          ? "bg-[var(--app-accent)] text-[var(--app-on-accent)]"
          : "text-white/70 hover:bg-white/5 hover:text-white",
      ].join(" ")
    }
  >
    <span className="grid h-6 w-6 place-items-center rounded-lg bg-white/5 text-white/80">
      {icon}
    </span>
    {label}
  </NavLink>
);

export function AppShell() {
  const { profile, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const nav = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const nombre =
    [profile?.nombres, profile?.apellido_paterno, profile?.apellido_materno]
      .filter(Boolean)
      .join(" ")
      .trim() || profile?.correo || profile?.email || "Usuario";

  const role = profile?.role;
  const canSeeAll = canSeeAllRole(role);

  const SidebarContent = ({
    onItemClick,
    onToggle,
  }: {
    onItemClick?: () => void;
    onToggle?: () => void;
  }) => (
    <>
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="flex items-center justify-between">
          <div className="text-xs text-white/50">Sistema</div>
          {onToggle && (
            <button
              type="button"
              onClick={onToggle}
              className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-white/80 hover:bg-white/10"
            >
              Ocultar
            </button>
          )}
        </div>
        <div className="mt-1 text-lg font-semibold tracking-tight">AGEBRE</div>
        <div className="mt-2 text-xs text-white/60">{roleLabel(role)}</div>
        <button
          type="button"
          onClick={toggleTheme}
          className="mt-3 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/80 hover:bg-white/10"
        >
          {theme === "dark" ? "Modo claro" : "Modo oscuro"}
        </button>
      </div>

      <nav className="mt-4 space-y-1">
        <Item to="/app" label="Inicio" icon={<HomeIcon />} onClick={onItemClick} />
        <Item to="/app/monitoreo" label="Monitoreo" icon={<ClipboardIcon />} onClick={onItemClick} />
        {canSeeAll && (
          <Item to="/app/asignaciones" label="Asignaciones" icon={<UsersCheckIcon />} onClick={onItemClick} />
        )}
        <Item to="/app/reportes" label="Reportes y resultados" icon={<ChartIcon />} onClick={onItemClick} />
        <Item to="/app/instituciones" label="Instituciones" icon={<SchoolIcon />} onClick={onItemClick} />
        {canSeeAll && <Item to="/app/usuarios" label="Usuarios" icon={<UserIcon />} onClick={onItemClick} />}
      </nav>

      <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="text-xs text-white/50">Sesión</div>
        <div className="mt-1 text-sm font-medium">{nombre}</div>
        <button
          onClick={async () => {
            await signOut();
            nav("/login");
          }}
          className="mt-3 w-full rounded-xl border border-white/10 bg-zinc-900/60 py-2 text-sm text-white/80 hover:bg-zinc-900"
        >
          Cerrar sesión
        </button>
      </div>
    </>
  );

  const [sidebarHidden, setSidebarHidden] = useState(false);

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Mobile top bar */}
      <div className="md:hidden sticky top-0 z-40 border-b border-white/10 bg-zinc-950/95 backdrop-blur">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="text-sm font-semibold tracking-tight">AGEBRE</div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleTheme}
              className="rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-white/80 hover:bg-white/10"
              aria-label="Cambiar tema"
            >
              {theme === "dark" ? "Claro" : "Oscuro"}
            </button>
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/80 hover:bg-white/10"
            >
              Menú
            </button>
          </div>
        </div>
      </div>

      <div className="flex">
        {/* Desktop sidebar */}
        <aside
          className={cls(
            "hidden md:block border-r border-white/10 bg-black/30",
            sidebarHidden ? "w-0 overflow-hidden p-0" : "w-[280px]"
          )}
        >
          <div className="sticky top-0 max-h-screen overflow-y-auto p-4">
            <SidebarContent onToggle={() => setSidebarHidden(true)} />
          </div>
        </aside>

        {/* Mobile drawer */}
        {mobileOpen && (
          <div className="fixed inset-0 z-50 md:hidden">
            <div
              className="absolute inset-0 bg-black/70"
              onClick={() => setMobileOpen(false)}
              aria-hidden="true"
            />
            <aside className="absolute left-0 top-0 h-full w-[280px] border-r border-white/10 bg-zinc-950 p-4">
              <div className="mb-3 flex items-center justify-between">
                <div className="text-sm font-semibold">Menú</div>
                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  className="rounded-lg px-2 py-1 text-xs text-white/70 hover:bg-white/5"
                >
                  Cerrar
                </button>
              </div>
              <SidebarContent onItemClick={() => setMobileOpen(false)} />
            </aside>
          </div>
        )}

        <main className="flex-1 p-4 md:p-6">
          {sidebarHidden && (
            <div className="mb-3 hidden md:flex items-center">
              <button
                type="button"
                onClick={() => setSidebarHidden(false)}
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/80 hover:bg-white/10"
              >
                Mostrar menú
              </button>
            </div>
          )}
          <div className="mx-auto max-w-5xl fade-in-up">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path
        d="M4 10.5L12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z"
        fill="currentColor"
      />
    </svg>
  );
}

function ClipboardIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path
        d="M9 4h6a2 2 0 0 1 2 2h2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6h2a2 2 0 0 1 2-2Zm0 2v1h6V6H9Zm-2 5h10v2H7v-2Zm0 4h10v2H7v-2Z"
        fill="currentColor"
      />
    </svg>
  );
}

function UsersCheckIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path
        d="M7 12a3 3 0 1 1 0-6 3 3 0 0 1 0 6Zm10.5-1.5l1.5 1.5 3-3 1.5 1.5-4.5 4.5-3-3 1.5-1.5ZM2 20a5 5 0 0 1 10 0v1H2v-1Zm11-4a4 4 0 0 1 4-4h2v2h-2a2 2 0 0 0-2 2v2h-2v-2Z"
        fill="currentColor"
      />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path
        d="M4 20V6h3v14H4Zm6 0V4h3v16h-3Zm6 0v-9h3v9h-3Z"
        fill="currentColor"
      />
    </svg>
  );
}

function SchoolIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path
        d="M12 3 2 8l10 5 10-5-10-5Zm-7 7v8h4v-5h6v5h4v-8l-7 3.5L5 10Z"
        fill="currentColor"
      />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path
        d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm-7 8a7 7 0 0 1 14 0v1H5v-1Z"
        fill="currentColor"
      />
    </svg>
  );
}
