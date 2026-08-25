import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../app/AuthProvider";
import { roleLabel } from "../lib/roles";
import { useTheme } from "../app/ThemeProvider";
import { useAppConfig } from "../app/AppConfigProvider";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { SessionExpiryNotice } from "../components/SessionExpiryNotice";
import logoAgebreUrl from "../assets/logoagebresf.png";

function cls(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

const Item = ({
  to,
  label,
  icon,
  onClick,
  reloadOnClick = false,
  collapsed = false,
}: {
  to: string;
  label: string;
  icon: ReactNode;
  onClick?: () => void;
  reloadOnClick?: boolean;
  collapsed?: boolean;
}) => (
  <NavLink
    to={to}
    end
    aria-label={collapsed ? label : undefined}
    title={collapsed ? label : undefined}
    data-tooltip={collapsed ? label : undefined}
    onClick={(e) => {
      onClick?.();
      if (reloadOnClick) {
        e.preventDefault();
        window.location.assign(to);
      }
    }}
    className={({ isActive }) =>
      [
        "agebre-nav-item flex h-10 items-center gap-3 rounded-xl px-3 text-sm font-medium",
        collapsed ? "justify-center px-0" : "",
        isActive
          ? "is-active"
          : "",
      ].join(" ")
    }
  >
    <span className="agebre-nav-icon grid h-7 w-7 shrink-0 place-items-center rounded-lg">
      {icon}
    </span>
    {!collapsed && <span className="truncate">{label}</span>}
  </NavLink>
);

export function AppShell() {
  const { profile, signOut, canViewModule } = useAuth();
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
  const isResponsableCdD = role === "responsable_cdd";
  const inFichaRoute = /^\/app\/monitoreo\/[^/]+\/ficha\/[^/]+$/i.test(location.pathname);
  const [sidebarHidden, setSidebarHidden] = useState(false);
  const initials = nombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "U";
  const pageTitle = location.pathname === "/app"
    ? "Dashboard"
    : location.pathname.includes("reportes-analiticos")
      ? "Reportes analíticos"
      : location.pathname.includes("gestion-monitoreos")
        ? "Crear Monitoreo"
        : location.pathname.includes("indicadores-cdd")
          ? "Indicadores CdD"
          : location.pathname.includes("operaciones")
            ? "Auditoría y alertas"
            : location.pathname.includes("asignaciones")
              ? "Asignaciones"
              : location.pathname.includes("roles-permisos")
                ? "Roles y permisos"
                : location.pathname.includes("catalogos")
                  ? "Catalogos"
              : location.pathname.includes("instituciones")
                ? "Instituciones"
                : location.pathname.includes("usuarios")
                  ? "Usuarios"
                  : location.pathname.includes("seguimiento")
                    ? "Seguimiento"
                    : location.pathname.includes("reportes")
                      ? "Reportes y resultados"
                      : "Monitoreo";

  const renderSidebarContent = ({
    onItemClick,
    mobile = false,
  }: {
    onItemClick?: () => void;
    mobile?: boolean;
  }) => {
    const collapsed = sidebarHidden && !mobile;
    const sectionLabel = (label: string) => !collapsed && (
      <div className="mb-1 mt-5 px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">{label}</div>
    );
    return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-[68px] shrink-0 items-center gap-3 border-b border-slate-800 px-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-xl bg-white shadow-sm">
          <img src={logoAgebreUrl} alt="" className="h-9 w-9 object-contain" />
        </div>
        {!collapsed && <div className="min-w-0 flex-1"><div className="text-base font-extrabold tracking-[0.04em] text-white">ASGESE</div><div className="truncate text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-500">Monitoreo integral</div></div>}
        {mobile && <button type="button" onClick={onItemClick} className="agebre-shell-icon-button" aria-label="Cerrar menú"><CloseIcon /></button>}
      </div>

      <nav className="min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain px-3 pb-4">
        {sectionLabel("Principal")}
        {canViewModule("inicio") && <Item
          to="/app"
          label="Inicio"
          icon={<HomeIcon />}
          onClick={onItemClick}
          reloadOnClick={inFichaRoute}
          collapsed={collapsed}
        />}
        {sectionLabel("Operación")}
        {canViewModule("monitoreo") && <Item
          to="/app/monitoreo"
          label="Monitoreo"
          icon={<ClipboardIcon />}
          onClick={onItemClick}
          reloadOnClick={inFichaRoute}
          collapsed={collapsed}
        />}
        {canViewModule("seguimiento") && !isResponsableCdD && (
          <Item
            to="/app/seguimiento"
            label="Seguimiento"
            icon={<TrackIcon />}
            onClick={onItemClick}
            reloadOnClick={inFichaRoute}
            collapsed={collapsed}
          />
        )}
        {canViewModule("gestion_monitoreos") && !isResponsableCdD && (
          <Item
            to="/app/gestion-monitoreos"
            label={"Crear Monitoreo"}
            icon={<FormIcon />}
            onClick={onItemClick}
            reloadOnClick={inFichaRoute}
            collapsed={collapsed}
          />
        )}
        {canViewModule("asignaciones") && (
          <Item
            to="/app/asignaciones"
            label="Asignaciones"
            icon={<UsersCheckIcon />}
            onClick={onItemClick}
            reloadOnClick={inFichaRoute}
            collapsed={collapsed}
          />
        )}
        {sectionLabel("Análisis")}
        {canViewModule("operaciones") && (
          <Item
            to="/app/operaciones"
            label="Auditoria y alertas"
            icon={<TrackIcon />}
            onClick={onItemClick}
            reloadOnClick={inFichaRoute}
            collapsed={collapsed}
          />
        )}
        {canViewModule("reportes") && <Item
          to="/app/reportes"
          label="Reportes y resultados"
          icon={<ChartIcon />}
          onClick={onItemClick}
          reloadOnClick={inFichaRoute}
          collapsed={collapsed}
        />}
        {canViewModule("reportes_analiticos") && <Item
          to="/app/reportes-analiticos"
          label="Reportes analíticos"
          icon={<SparkIcon />}
          onClick={onItemClick}
          reloadOnClick={inFichaRoute}
          collapsed={collapsed}
        />}
        {canViewModule("indicadores_cdd") && (
          <Item
            to="/app/indicadores-cdd"
            label="Indicadores CdD"
            icon={<SparkIcon />}
            onClick={onItemClick}
            reloadOnClick={inFichaRoute}
            collapsed={collapsed}
          />
        )}
        {sectionLabel("Administración")}
        {canViewModule("instituciones") && <Item
          to="/app/instituciones"
          label="Instituciones"
          icon={<SchoolIcon />}
          onClick={onItemClick}
          reloadOnClick={inFichaRoute}
          collapsed={collapsed}
        />}
        {canViewModule("usuarios") && (
          <Item
            to="/app/usuarios"
            label="Usuarios"
            icon={<UserIcon />}
            onClick={onItemClick}
            reloadOnClick={inFichaRoute}
            collapsed={collapsed}
          />
        )}
        {canViewModule("roles_permisos") && <Item to="/app/roles-permisos" label="Roles y permisos" icon={<UsersCheckIcon />} onClick={onItemClick} reloadOnClick={inFichaRoute} collapsed={collapsed} />}
        {canViewModule("catalogos") && <Item to="/app/catalogos" label="Catalogos" icon={<FormIcon />} onClick={onItemClick} reloadOnClick={inFichaRoute} collapsed={collapsed} />}
      </nav>

      <div className="shrink-0 border-t border-slate-800 p-3">
        {!mobile && <button type="button" onClick={() => setSidebarHidden((value) => !value)} className="agebre-sidebar-collapse" aria-label={collapsed ? "Expandir menú" : "Contraer menú"} data-tooltip={collapsed ? "Expandir menú" : undefined}><CollapseIcon reversed={collapsed} />{!collapsed && <span>Contraer menú</span>}</button>}
        {!collapsed && <div className="mt-2 text-center text-[9px] text-slate-600">v1.0 · UGEL 06®</div>}
      </div>
    </div>
  );
  };

  return (
    <div className="agebre-app-shell flex h-[100dvh] w-full overflow-hidden">
      {mobileOpen && <button type="button" aria-label="Cerrar menú" className="fixed inset-0 z-40 bg-slate-950/55 lg:hidden" onClick={() => setMobileOpen(false)} />}

      <aside className={cls("agebre-suite-sidebar hidden shrink-0 border-r lg:block", sidebarHidden ? "w-[76px]" : "w-[252px]")}>
        {renderSidebarContent({})}
      </aside>

      {mobileOpen && (
        <aside className="agebre-suite-sidebar fixed inset-y-0 left-0 z-50 w-[min(17rem,88vw)] border-r lg:hidden">
          {renderSidebarContent({ onItemClick: () => setMobileOpen(false), mobile: true })}
        </aside>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="agebre-topbar flex h-[68px] shrink-0 items-center border-b px-3 sm:px-5">
          <button type="button" onClick={() => setMobileOpen(true)} className="agebre-shell-icon-button mr-2 lg:hidden" aria-label="Abrir menú"><MenuIcon /></button>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--app-muted-2)]"><span>ASGESE</span><ChevronIcon /><span className="truncate text-[var(--app-muted)]">{pageTitle}</span></div>
            <div className="mt-0.5 truncate text-sm font-bold text-[var(--app-text)] sm:text-base">{pageTitle}</div>
          </div>

          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            {role === "admin" ? (
              <button type="button" onClick={async () => { await setMode(isTestMode ? "prod" : "test"); }} className={cls("badge-interactive agebre-environment-badge hidden items-center rounded-full border px-2 py-0.5 text-[9px] font-bold tracking-[0.06em] sm:inline-flex", isTestMode ? "badge-amber" : "badge-green")}>
                <span className="mr-1 h-1.5 w-1.5 rounded-full bg-current" />{isTestMode ? "TEST" : "PRODUCCIÓN"}
              </button>
            ) : (
              <span className={cls("agebre-environment-badge hidden items-center rounded-full border px-2 py-0.5 text-[9px] font-bold tracking-[0.06em] sm:inline-flex", isTestMode ? "badge-amber" : "badge-green")}>{isTestMode ? "TEST" : "PRODUCCIÓN"}</span>
            )}
            <button type="button" onClick={toggleTheme} className="agebre-shell-icon-button" aria-label={theme === "dark" ? "Activar tema claro" : "Activar tema oscuro"} data-tooltip={theme === "dark" ? "Tema claro" : "Tema oscuro"}>{theme === "dark" ? <SunIcon /> : <MoonIcon />}</button>
            <div className="ml-1 flex items-center gap-2 border-l border-[var(--app-border)] pl-2 sm:gap-3 sm:pl-3">
              <div className="hidden min-w-0 text-right lg:block"><div className="max-w-48 truncate text-xs font-semibold text-[var(--app-text)]">{nombre}</div><button type="button" onClick={() => setLogoutOpen(true)} className="mt-0.5 text-[10px] text-[var(--app-muted)] transition hover:text-[var(--app-accent)]">{roleLabel(role)} · Salir</button></div>
              <button type="button" onClick={() => setLogoutOpen(true)} className="agebre-avatar" aria-label="Cerrar sesión" data-tooltip="Cerrar sesión">{initials}</button>
            </div>
          </div>
        </header>

        <a href="#main-content" className="sr-only z-[60] rounded-lg bg-white px-3 py-2 text-slate-950 focus:not-sr-only focus:fixed focus:left-3 focus:top-3">Saltar al contenido principal</a>
        <main id="main-content" tabIndex={-1} className="agebre-page min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-3 py-4 sm:px-5 lg:px-6">
          <div className="mx-auto min-w-0 max-w-[1680px] fade-in-up"><Outlet key={`${location.pathname}${location.search}`} /></div>
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
      <SessionExpiryNotice />
    </div>
  );
}

function ShellSvg({ children }: { children: ReactNode }) {
  return <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>;
}

function MenuIcon() { return <ShellSvg><path d="M4 7h16M4 12h16M4 17h16" /></ShellSvg>; }
function CloseIcon() { return <ShellSvg><path d="m6 6 12 12M18 6 6 18" /></ShellSvg>; }
function ChevronIcon() { return <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="m4 2.5 3.5 3.5L4 9.5" /></svg>; }
function MoonIcon() { return <ShellSvg><path d="M20 15.2A8.5 8.5 0 0 1 8.8 4a8.5 8.5 0 1 0 11.2 11.2Z" /></ShellSvg>; }
function SunIcon() { return <ShellSvg><circle cx="12" cy="12" r="3.5" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></ShellSvg>; }
function CollapseIcon({ reversed = false }: { reversed?: boolean }) { return <ShellSvg><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M8 4v16" />{reversed ? <path d="m13 9 3 3-3 3" /> : <path d="m16 9-3 3 3 3" />}</ShellSvg>; }

function HomeIcon() {
  return <ShellSvg><path d="m3 10 9-7 9 7" /><path d="M5 9v11h14V9M9 20v-6h6v6" /></ShellSvg>;
}

function FormIcon() {
  return <ShellSvg><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4V2h6v2M8 9h8M8 13h8M8 17h5" /></ShellSvg>;
}

function ClipboardIcon() {
  return <ShellSvg><rect x="4" y="5" width="16" height="16" rx="2" /><path d="M9 5V3h6v2M8 10h8M8 14h8M8 18h5" /></ShellSvg>;
}

function UsersCheckIcon() {
  return <ShellSvg><circle cx="8" cy="8" r="3" /><path d="M3 20v-1a5 5 0 0 1 10 0v1M15 11l2 2 4-4" /></ShellSvg>;
}

function TrackIcon() {
  return <ShellSvg><path d="M4 19h16M6 15h4M12 11h4M18 7h2M6 7h6" /></ShellSvg>;
}

function SparkIcon() {
  return <ShellSvg><path d="m3 17 6-6 4 4 7-9" /><path d="M15 6h5v5M4 21h16" /></ShellSvg>;
}

function ChartIcon() {
  return <ShellSvg><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></ShellSvg>;
}

function SchoolIcon() {
  return <ShellSvg><path d="m3 10 9-6 9 6-9 6-9-6Z" /><path d="M6 13v6h12v-6M9 19v-4h6v4" /></ShellSvg>;
}

function UserIcon() {
  return <ShellSvg><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></ShellSvg>;
}
