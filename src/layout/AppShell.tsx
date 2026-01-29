import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../app/AuthProvider";

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

  const isAdmin = profile?.role === "admin"; // ✅ FIX real

  const SidebarContent = ({ onItemClick }: { onItemClick?: () => void }) => (
    <>
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="text-xs text-white/50">Sistema</div>
        <div className="mt-1 text-lg font-semibold tracking-tight">AGEBRE</div>
        <div className="mt-2 text-xs text-white/60">{isAdmin ? "Administrador" : "Monitor"}</div>
      </div>

      <nav className="mt-4 space-y-1">
        <Item to="/app" label="Inicio" onClick={onItemClick} />
        <Item to="/app/monitoreo" label="Monitoreo" onClick={onItemClick} />
        <Item to="/app/reportes" label="Reportes y resultados" onClick={onItemClick} />
        {isAdmin && <Item to="/app/usuarios" label="Usuarios" onClick={onItemClick} />}
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
        <aside className="hidden md:block w-[280px] min-h-screen border-r border-white/10 bg-black/30 p-4">
          <SidebarContent />
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
          <div className="mx-auto max-w-5xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
