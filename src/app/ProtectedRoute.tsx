import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "./AuthProvider";

export function ProtectedRoute({ requireAdmin = false }: { requireAdmin?: boolean }) {
  const { loading, user, profile, profileLoading } = useAuth();
  const location = useLocation();

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
  if (requireAdmin) {
    if (profileLoading) {
      return (
        <div className="min-h-screen bg-zinc-950 text-white grid place-items-center">
          <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-sm text-white/70">
            Validando permisos...
          </div>
        </div>
      );
    }

    const role = profile?.role;
    if (role !== "admin") {
      return <Navigate to="/app" replace />;
    }
  }

  return <Outlet />;
}
