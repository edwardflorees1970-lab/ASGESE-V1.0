import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../app/AuthProvider";
import { canSeeAllRole, roleLabel } from "../lib/roles";

function cls(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

const Item = ({
  to,
  label,
  onClick,
}: {
  to: string;
  label: string;
  onClick?: () => void;
}) => (
  <NavLink
    to={to}
    end
    onClick={onClick}
    className={({ isActive }) =>
      [
        "flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition",
        isActive ? "bg-white text-zinc-950" : "text-white/70 hover:bg-white/5 hover:text-white",
      ].join(" ")
    }
  >
    <span className="h-2 w-2 rounded-full bg-current opacity-60" />
    {label}
  </NavLink>
);

export function AppShell() {
  const { profile, signOut } = useAuth();
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
      </div>

      <nav className="mt-4 space-y-1">
        <Item to="/app" label="Inicio" onClick={onItemClick} />
        <Item to="/app/monitoreo" label="Monitoreo" onClick={onItemClick} />
        {canSeeAll && <Item to="/app/asignaciones" label="Asignaciones" onClick={onItemClick} />}
        <Item to="/app/reportes" label="Reportes y resultados" onClick={onItemClick} />
        <Item to="/app/instituciones" label="Instituciones" onClick={onItemClick} />
        {canSeeAll && <Item to="/app/usuarios" label="Usuarios" onClick={onItemClick} />}
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
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/80 hover:bg-white/10"
          >
            Menú
          </button>
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
