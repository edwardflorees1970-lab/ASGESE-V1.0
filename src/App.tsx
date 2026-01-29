import { Suspense, lazy } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { AppShell } from "./layout/AppShell";
import { ProtectedRoute } from "./app/ProtectedRoute";

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
const AsignacionesPage = lazy(() =>
  import("./pages/AsignacionesPage").then((m) => ({ default: m.AsignacionesPage }))
);

function PageLoader() {
  return (
    <div className="min-h-[50vh] grid place-items-center text-white/70 text-sm">
      Cargando...
    </div>
  );
}

export default function App() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route element={<ProtectedRoute />}>
          <Route path="/app" element={<AppShell />}>
            <Route index element={<HomePage />} />

            {/* Monitoreo */}
            <Route path="monitoreo" element={<MonitoreoPage />} />
            <Route path="monitoreo/:monitoreoCodigo" element={<MonitoreoDetailPage />} />
            <Route
              path="monitoreo/:monitoreoCodigo/ficha/:fichaCodigo"
              element={<FichaRouterPage />}
            />

            <Route path="reportes" element={<ReportesPage />} />

            {/* Solo admin */}
            <Route element={<ProtectedRoute requireAdmin />}>
              <Route path="usuarios" element={<UsersPage />} />
              <Route path="asignaciones" element={<AsignacionesPage />} />
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Suspense>
  );
}
