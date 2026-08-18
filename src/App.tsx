import { Suspense, lazy } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { AppShell } from "./layout/AppShell";
import { ProtectedRoute } from "./app/ProtectedRoute";
import { useAuth } from "./app/AuthProvider";

const LoginPage = lazy(() => import("./pages/LoginPage").then((m) => ({ default: m.LoginPage })));
const SetupPasswordPage = lazy(() => import("./pages/SetupPasswordPage").then((m) => ({ default: m.SetupPasswordPage })));
const UsersPage = lazy(() => import("./pages/UsersPage").then((m) => ({ default: m.UsersPage })));
const MonitoreoPage = lazy(() =>
  import("./pages/MonitoreoPage").then((m) => ({ default: m.MonitoreoPage }))
);
const MonitoreoDetailPage = lazy(() =>
  import("./pages/MonitoreoDetailPage").then((m) => ({ default: m.MonitoreoDetailPage }))
);
const FichaRouterPage = lazy(() =>
  import("./pages/FichaRouterPage").then((m) => ({ default: m.FichaRouterPage }))
);
const HomePage = lazy(() => import("./pages/HomePage").then((m) => ({ default: m.HomePage })));
const ReportesPage = lazy(() =>
  import("./pages/ReportesPage").then((m) => ({ default: m.ReportesPage }))
);
const AnalyticsReportsPage = lazy(() =>
  import("./pages/AnalyticsReportsPage").then((m) => ({ default: m.AnalyticsReportsPage }))
);
const SeguimientoPage = lazy(() =>
  import("./pages/SeguimientoPage").then((m) => ({ default: m.SeguimientoPage }))
);
const AsignacionesPage = lazy(() =>
  import("./pages/AsignacionesPage").then((m) => ({ default: m.AsignacionesPage }))
);
const InstitucionesPage = lazy(() =>
  import("./pages/InstitucionesPage").then((m) => ({ default: m.InstitucionesPage }))
);
const GestionMonitoreosPage = lazy(() =>
  import("./pages/GestionMonitoreosPage").then((m) => ({ default: m.GestionMonitoreosPage }))
);
const IndicadoresCdDPage = lazy(() =>
  import("./pages/IndicadoresCdDPage").then((m) => ({ default: m.IndicadoresCdDPage }))
);
const OperationsPage = lazy(() => import("./pages/OperationsPage").then((m) => ({ default: m.OperationsPage })));
const RolesPermisosPage = lazy(() => import("./pages/RolesPermisosPage").then((m) => ({ default: m.RolesPermisosPage })));
const CatalogosPage = lazy(() => import("./pages/CatalogosPage").then((m) => ({ default: m.CatalogosPage })));

function PageLoader() {
  return (
    <div className="grid min-h-[50vh] place-items-center text-sm text-[var(--app-muted)]">
      Cargando...
    </div>
  );
}

function LoginRoute() {
  const { loading, user } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white grid place-items-center">
        <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-sm text-white/70">
          Verificando sesión...
        </div>
      </div>
    );
  }

  if (user) {
    return <Navigate to="/app" replace />;
  }

  return <LoginPage />;
}

export default function App() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/login" element={<LoginRoute />} />
        <Route path="/setup-password" element={<SetupPasswordPage />} />

        <Route element={<ProtectedRoute />}>
          <Route path="/app" element={<AppShell />}>
            <Route element={<ProtectedRoute requireModule="inicio" />}><Route index element={<HomePage />} /></Route>

            {/* Monitoreo */}
            <Route element={<ProtectedRoute requireModule="monitoreo" />}>
              <Route path="monitoreo" element={<MonitoreoPage />} />
              <Route path="monitoreo/:monitoreoCodigo" element={<MonitoreoDetailPage />} />
              <Route
                path="monitoreo/:monitoreoCodigo/ficha/:fichaCodigo"
                element={<FichaRouterPage />}
              />
            </Route>

            <Route element={<ProtectedRoute requireModule="reportes" />}><Route path="reportes" element={<ReportesPage />} /></Route>
            <Route element={<ProtectedRoute requireModule="reportes_analiticos" />}>
              <Route path="reportes-analiticos" element={<AnalyticsReportsPage />} />
            </Route>
            <Route element={<ProtectedRoute requireModule="seguimiento" />}>
              <Route path="seguimiento" element={<SeguimientoPage />} />
            </Route>
            <Route element={<ProtectedRoute requireModule="instituciones" />}><Route path="instituciones" element={<InstitucionesPage />} /></Route>
            <Route element={<ProtectedRoute requireModule="gestion_monitoreos" />}>
              <Route path="gestion-monitoreos" element={<GestionMonitoreosPage />} />
            </Route>

            <Route element={<ProtectedRoute requireModule="indicadores_cdd" />}>
              <Route path="indicadores-cdd" element={<IndicadoresCdDPage />} />
            </Route>

            {/* Administracion controlada por permisos de modulo */}
            <Route element={<ProtectedRoute requireModule="usuarios" />}><Route path="usuarios" element={<UsersPage />} /></Route>
            <Route element={<ProtectedRoute requireModule="asignaciones" />}><Route path="asignaciones" element={<AsignacionesPage />} /></Route>
            <Route element={<ProtectedRoute requireModule="operaciones" />}><Route path="operaciones" element={<OperationsPage />} /></Route>
            <Route element={<ProtectedRoute requireModule="roles_permisos" />}><Route path="roles-permisos" element={<RolesPermisosPage />} /></Route>
            <Route element={<ProtectedRoute requireModule="catalogos" />}><Route path="catalogos" element={<CatalogosPage />} /></Route>
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Suspense>
  );
}
