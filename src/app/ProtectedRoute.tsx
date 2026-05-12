import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "./AuthProvider";
import { canSeeAllRole } from "../lib/roles";

export function ProtectedRoute({ requireAdmin = false, allowedRoles }: { requireAdmin?: boolean; allowedRoles?: string[] }) {
  const { loading, user, profile, profileLoading, profileError, refreshProfile } =
    useAuth();
  const location = useLocation();
  const requiresProfileCheck = requireAdmin || Boolean(allowedRoles?.length);

  // Solo bloquea durante carga inicial de sesión (rápido)
  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white grid place-items-center">
        <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-sm text-white/70">
          Verificando sesión...
        </div>
      </div>
    );
  }

  // Si no hay sesión => login
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  // Si es ruta admin:
  // - si aún está cargando profile, muestra loader corto (solo aquí).
  // - si no es admin, afuera.
  if (requiresProfileCheck) {
    if (profileLoading && !profile) {
      return (
        <div className="min-h-screen bg-zinc-950 text-white grid place-items-center">
          <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-sm text-white/70">
            Validando permisos...
          </div>
        </div>
      );
    }

    if (profileError) {
      return (
        <div className="min-h-screen bg-zinc-950 text-white grid place-items-center px-4">
          <div className="max-w-md rounded-2xl border border-red-500/30 bg-red-500/10 px-5 py-4 text-sm text-red-100">
            <div className="font-semibold">No se pudo cargar tu perfil</div>
            <div className="mt-2 text-red-200/80">{profileError}</div>
            <button
              onClick={refreshProfile}
              className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-xs text-red-100 hover:bg-red-500/20"
            >
              Reintentar
            </button>
          </div>
        </div>
      );
    }

    const role = profile?.role;
    if (requireAdmin && !canSeeAllRole(role)) {
      return <Navigate to="/app" replace />;
    }
    if (allowedRoles?.length && !allowedRoles.includes(String(role ?? ""))) {
      return <Navigate to="/app" replace />;
    }
  }

  return <Outlet />;
}
