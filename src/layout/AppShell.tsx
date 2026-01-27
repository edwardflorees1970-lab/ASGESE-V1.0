import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../app/AuthProvider";

const Item = ({ to, label }: { to: string; label: string }) => (
  <NavLink
    to={to}
    end
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

  const nombre =
    [profile?.nombres, profile?.apellido_paterno, profile?.apellido_materno]
      .filter(Boolean)
      .join(" ")
      .trim() || profile?.correo || "Usuario";

  const isAdmin = profile?.role === "admin";

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="flex">
        <aside className="w-[280px] min-h-screen border-r border-white/10 bg-black/30 p-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-xs text-white/50">Sistema</div>
            <div className="mt-1 text-lg font-semibold tracking-tight">AGEBRE</div>
            <div className="mt-2 text-xs text-white/60">{isAdmin ? "Administrador" : "Monitor"}</div>
          </div>

          <nav className="mt-4 space-y-1">
            <Item to="/app" label="Inicio" />
            <Item to="/app/monitoreo" label="Elegir monitoreo" />
            <Item to="/app/reportes" label="Reportes y resultados" />
            {isAdmin && <Item to="/app/usuarios" label="Usuarios" />}
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
        </aside>

        <main className="flex-1 p-6">
          <div className="mx-auto max-w-5xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
