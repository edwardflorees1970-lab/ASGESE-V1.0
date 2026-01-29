import { Routes, Route, Navigate } from "react-router-dom";
import { LoginPage } from "./pages/LoginPage";
import { AppShell } from "./layout/AppShell";
import { ProtectedRoute } from "./app/ProtectedRoute";
import { UsersPage } from "./pages/UsersPage";
import { MonitoreoPage } from "./pages/MonitoreoPage";
import { MonitoreoDetailPage } from "./pages/MonitoreoDetailPage";
import { FichaRouterPage } from "./pages/FichaRouterPage";
import { HomePage } from "./pages/HomePage";
import { ReportesPage } from "./pages/ReportesPage";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<ProtectedRoute />}>
        <Route path="/app" element={<AppShell />}>
          <Route index element={<HomePage />} />

          {/* Monitoreo */}
          <Route path="monitoreo" element={<MonitoreoPage />} />
          <Route path="monitoreo/:monitoreoCodigo" element={<MonitoreoDetailPage />} />
          <Route path="monitoreo/:monitoreoCodigo/ficha/:fichaCodigo" element={<FichaRouterPage />} />

          <Route path="reportes" element={<ReportesPage />} />

          {/* Solo admin */}
          <Route element={<ProtectedRoute requireAdmin />}>
            <Route path="usuarios" element={<UsersPage />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
