import { Suspense, lazy } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { AppShell } from "./layout/AppShell";
import { ProtectedRoute } from "./app/ProtectedRoute";
import { useAuth } from "./app/AuthProvider";

const LoginPage = lazy(() => import("./pages/LoginPage").then((m) => ({ default: m.LoginPage })));
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

function PageLoader() {
  return (
    <div className="grid min-h-[50vh] place-items-center text-sm text-[var(--app-muted)]">
      Cargando...
    </div>
  );
}

function HomeEntry() {
  const { profile } = useAuth();
  if (profile?.role === "responsable_cdd") {
    return <Navigate to="/app/indicadores-cdd" replace />;
  }
  return <HomePage />;
}

export default function App() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route element={<ProtectedRoute />}>
          <Route path="/app" element={<AppShell />}>
            <Route index element={<HomeEntry />} />

            {/* Monitoreo */}
            <Route element={<ProtectedRoute allowedRoles={["admin", "user", "jefe_area", "director", "responsable_cdd"]} />}>
              <Route path="monitoreo" element={<MonitoreoPage />} />
              <Route path="monitoreo/:monitoreoCodigo" element={<MonitoreoDetailPage />} />
              <Route
                path="monitoreo/:monitoreoCodigo/ficha/:fichaCodigo"
                element={<FichaRouterPage />}
              />
            </Route>

            <Route path="reportes" element={<ReportesPage />} />
            <Route element={<ProtectedRoute allowedRoles={["admin", "user", "jefe_area", "director", "responsable_cdd"]} />}>
              <Route path="reportes-analiticos" element={<AnalyticsReportsPage />} />
            </Route>
            <Route element={<ProtectedRoute allowedRoles={["admin", "user", "jefe_area", "director"]} />}>
              <Route path="seguimiento" element={<SeguimientoPage />} />
            </Route>
            <Route path="instituciones" element={<InstitucionesPage />} />
            <Route element={<ProtectedRoute allowedRoles={["admin", "user", "jefe_area", "director"]} />}>
              <Route path="gestion-monitoreos" element={<GestionMonitoreosPage />} />
            </Route>

            <Route element={<ProtectedRoute allowedRoles={["responsable_cdd", "admin", "jefe_area", "director"]} />}>
              <Route path="indicadores-cdd" element={<IndicadoresCdDPage />} />
            </Route>

            {/* Solo admin */}
            <Route element={<ProtectedRoute requireAdmin />}>
              <Route path="usuarios" element={<UsersPage />} />
              <Route path="asignaciones" element={<AsignacionesPage />} />
              <Route path="operaciones" element={<OperationsPage />} />
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Suspense>
  );
}
