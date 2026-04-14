import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../app/AuthProvider";
import { canSeeAllRole, roleLabel } from "../lib/roles";
import { useTheme } from "../app/ThemeProvider";
import { useAppConfig } from "../app/AppConfigProvider";
import { ConfirmDialog } from "../components/ConfirmDialog";

function cls(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

const Item = ({
  to,
  label,
  icon,
  onClick,
  reloadOnClick = false,
}: {
  to: string;
  label: string;
  icon: ReactNode;
  onClick?: () => void;
  reloadOnClick?: boolean;
}) => (
  <NavLink
    to={to}
    end
    onClick={(e) => {
      onClick?.();
      if (reloadOnClick) {
        e.preventDefault();
        window.location.assign(to);
      }
    }}
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
  const { isTestMode, setMode } = useAppConfig();
  const nav = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [logoutBusy, setLogoutBusy] = useState(false);
  const bodyOverflowRef = useRef<string | null>(null);
  const bodyPositionRef = useRef<string | null>(null);
  const bodyTopRef = useRef<string | null>(null);
  const bodyWidthRef = useRef<string | null>(null);
  const scrollYRef = useRef(0);
  useEffect(() => {
    if (bodyOverflowRef.current == null) {
      bodyOverflowRef.current = document.body.style.overflow;
      bodyPositionRef.current = document.body.style.position;
      bodyTopRef.current = document.body.style.top;
      bodyWidthRef.current = document.body.style.width;
    }
    if (mobileOpen) {
      scrollYRef.current = window.scrollY;
      document.body.style.overflow = "hidden";
      document.body.style.position = "fixed";
      document.body.style.top = `-${scrollYRef.current}px`;
      document.body.style.width = "100%";
    } else {
      document.body.style.overflow = bodyOverflowRef.current || "";
      document.body.style.position = bodyPositionRef.current || "";
      document.body.style.top = bodyTopRef.current || "";
      document.body.style.width = bodyWidthRef.current || "";
      if (scrollYRef.current > 0) {
        window.scrollTo(0, scrollYRef.current);
      }
    }
    return () => {
      document.body.style.overflow = bodyOverflowRef.current || "";
      document.body.style.position = bodyPositionRef.current || "";
      document.body.style.top = bodyTopRef.current || "";
      document.body.style.width = bodyWidthRef.current || "";
    };
  }, [mobileOpen]);

  const nombre =
    [profile?.nombres, profile?.apellido_paterno, profile?.apellido_materno]
      .filter(Boolean)
      .join(" ")
      .trim() || profile?.correo || profile?.email || "Usuario";

  const role = profile?.role;
  const canSeeAll = canSeeAllRole(role);
  const isResponsableCdD = role === "responsable_cdd";
  const inFichaRoute = /^\/app\/monitoreo\/[^/]+\/ficha\/[^/]+$/i.test(location.pathname);

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
        <div
          className={cls(
            "mt-2 inline-flex items-center rounded-full border px-2 py-0.5 text-[11px]",
            isTestMode
              ? "border-amber-500/40 bg-amber-500/10 text-amber-100"
              : "border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
          )}
        >
          {isTestMode ? "Modo TEST" : "Modo PRODUCCIÓN"}
        </div>
        {role === "admin" && (
          <button
            type="button"
            onClick={async () => {
              await setMode(isTestMode ? "prod" : "test");
            }}
            className={cls(
              "mt-3 w-full rounded-lg border px-3 py-2 text-xs",
              isTestMode
                ? "border-amber-500/40 bg-amber-500/10 text-amber-100 badge-amber"
                : "border-emerald-500/30 bg-emerald-500/10 text-emerald-100 badge-green"
            )}
          >
            {isTestMode ? "Modo TEST" : "Modo PRODUCCIÓN"}
          </button>
        )}
        <button
          type="button"
          onClick={toggleTheme}
          className="mt-3 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/80 hover:bg-white/10"
        >
          {theme === "dark" ? "Modo claro" : "Modo oscuro"}
        </button>
      </div>

      <nav className="mt-4 space-y-1">
        {!isResponsableCdD && (
          <Item
            to="/app"
            label="Inicio"
            icon={<HomeIcon />}
            onClick={onItemClick}
            reloadOnClick={inFichaRoute}
          />
        )}
        <Item
          to="/app/monitoreo"
          label="Monitoreo"
          icon={<ClipboardIcon />}
          onClick={onItemClick}
          reloadOnClick={inFichaRoute}
        />
        {!isResponsableCdD && (
          <Item
            to="/app/seguimiento"
            label="Seguimiento"
            icon={<TrackIcon />}
            onClick={onItemClick}
            reloadOnClick={inFichaRoute}
          />
        )}
        {!isResponsableCdD && (
          <Item
            to="/app/gestion-monitoreos"
            label={"Gesti\u00f3n de Monitoreos"}
            icon={<FormIcon />}
            onClick={onItemClick}
            reloadOnClick={inFichaRoute}
          />
        )}
        {canSeeAll && (
          <Item
            to="/app/asignaciones"
            label="Asignaciones"
            icon={<UsersCheckIcon />}
            onClick={onItemClick}
            reloadOnClick={inFichaRoute}
          />
        )}
        <Item
          to="/app/reportes"
          label="Reportes y resultados"
          icon={<ChartIcon />}
          onClick={onItemClick}
          reloadOnClick={inFichaRoute}
        />
        {(role === "responsable_cdd" || canSeeAll) && (
          <Item
            to="/app/indicadores-cdd"
            label="Indicadores CdD"
            icon={<SparkIcon />}
            onClick={onItemClick}
            reloadOnClick={inFichaRoute}
          />
        )}
        <Item
          to="/app/instituciones"
          label="Instituciones"
          icon={<SchoolIcon />}
          onClick={onItemClick}
          reloadOnClick={inFichaRoute}
        />
        {canSeeAll && (
          <Item
            to="/app/usuarios"
            label="Usuarios"
            icon={<UserIcon />}
            onClick={onItemClick}
            reloadOnClick={inFichaRoute}
          />
        )}
      </nav>

      <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="text-xs text-white/50">Sesión</div>
        <div className="mt-1 text-sm font-medium">{nombre}</div>
        <button
          onClick={() => setLogoutOpen(true)}
          className="mt-3 w-full rounded-xl border border-white/10 bg-zinc-900/60 py-2 text-sm text-white/80 hover:bg-zinc-900"
        >
          Cerrar sesión
        </button>
      </div>
      <div className="mt-4 text-center text-[11px] text-white/50">
        v1.0 Propietario UGEL 06®
      </div>
    </>
  );

  const [sidebarHidden, setSidebarHidden] = useState(false);

  return (
    <div className="flex h-[100dvh] w-full flex-col overflow-hidden bg-zinc-950 text-white">
      {/* Mobile top bar */}
      <div className="md:hidden sticky top-0 z-40 border-b border-white/10 bg-zinc-950/95 backdrop-blur">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="text-sm font-semibold tracking-tight">AGEBRE</div>
          <div className="flex items-center gap-2">
            <div
              className={cls(
                "rounded-full border px-2 py-1 text-[11px]",
                isTestMode
                  ? "border-amber-500/40 bg-amber-500/10 text-amber-100"
                  : "border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
              )}
            >
              {isTestMode ? "TEST" : "PROD"}
            </div>
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

      <div className="flex min-h-0 min-w-0 flex-1">
        {/* Desktop sidebar */}
        <aside
          className={cls(
            "hidden md:block border-r border-white/10 bg-black/30",
            sidebarHidden ? "w-0 overflow-hidden p-0" : "w-[280px]"
          )}
        >
          <div className="h-full overflow-y-auto overscroll-contain p-4">
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
            <aside className="absolute left-0 top-0 h-full w-[280px] overflow-y-auto overscroll-contain border-r border-white/10 bg-zinc-950 p-4 pb-6">
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

        <main className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain p-4 md:p-6">
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
          <div className="mx-auto min-w-0 max-w-5xl fade-in-up">
            <Outlet key={`${location.pathname}${location.search}`} />
          </div>
        </main>
      </div>

      <ConfirmDialog
        open={logoutOpen}
        title="Cerrar sesión"
        description="¿Estás seguro de cerrar la sesión actual?"
        confirmText="Cerrar sesión"
        cancelText="Cancelar"
        variant="danger"
        busy={logoutBusy}
        onClose={() => !logoutBusy && setLogoutOpen(false)}
        onConfirm={async () => {
          setLogoutBusy(true);
          await signOut();
          setLogoutBusy(false);
          setLogoutOpen(false);
          nav("/login");
        }}
      />
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

function FormIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path
        d="M6 3h9a2 2 0 0 1 2 2v1h2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6h2V5a2 2 0 0 1 2-2Zm0 5v12h11V8H6Zm2 2h7v2H8v-2Zm0 4h7v2H8v-2Z"
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

function TrackIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path
        d="M4 18h16v2H4v-2Zm2-3h4v2H6v-2Zm6-4h4v2h-4v-2Zm6-4h2v2h-2V7ZM6 6h6v2H6V6Z"
        fill="currentColor"
      />
    </svg>
  );
}

function SparkIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path d="M4 18h16v2H4v-2Zm1-4 4-4 3 3 6-7 1.5 1.3-7 8.2-3-3-3 3L5 14Z" fill="currentColor" />
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
