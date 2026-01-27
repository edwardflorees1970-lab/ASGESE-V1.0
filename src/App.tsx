import { Routes, Route, Navigate } from "react-router-dom";
import { LoginPage } from "./pages/LoginPage";
import { AppShell } from "./layout/AppShell";
import { ProtectedRoute } from "./app/ProtectedRoute";
import { UsersPage } from "./pages/UsersPage";
import { MonitoreoPage } from "./pages/MonitoreoPage";
import { MonitoreoDetailPage } from "./pages/MonitoreoDetailPage";
import { FichaRouterPage } from "./pages/FichaRouterPage";

function Home() {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
      <h2 className="text-xl font-semibold tracking-tight">Inicio</h2>
      <p className="mt-2 text-sm text-white/60">Bienvenido. Aquí irá el resumen general.</p>
    </div>
  );
}

function Placeholder({ title }: { title: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      <p className="mt-2 text-sm text-white/60">Módulo en construcción.</p>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<ProtectedRoute />}>
        <Route path="/app" element={<AppShell />}>
          <Route index element={<Home />} />

          {/* Monitoreo */}
          <Route path="monitoreo" element={<MonitoreoPage />} />
          <Route path="monitoreo/:monitoreoCodigo" element={<MonitoreoDetailPage />} />
          <Route path="monitoreo/:monitoreoCodigo/ficha/:fichaCodigo" element={<FichaRouterPage />} />

          <Route path="reportes" element={<Placeholder title="Reportes y resultados" />} />

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
