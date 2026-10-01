import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.tsx";
import "@fontsource/poppins/400.css";
import "@fontsource/poppins/500.css";
import "@fontsource/poppins/600.css";
import "@fontsource/poppins/700.css";
import "@fontsource/poppins/800.css";
import "./index.css";
import { AuthProvider } from "./app/AuthProvider";
import { ThemeProvider } from "./app/ThemeProvider";
import { AppConfigProvider } from "./app/AppConfigProvider";
import { AppErrorBoundary } from "./app/AppErrorBoundary";
import { captureException } from "./lib/telemetry";

// Tras cada deploy, los chunks (JS por página, con hash en el nombre) cambian.
// Una pestaña que quedó abierta desde antes del deploy sigue pidiendo un chunk
// que el servidor ya no tiene ("Failed to fetch dynamically imported module"),
// lo que tumbaba la app en la pantalla de error. En vez de eso, recargamos una
// sola vez (sessionStorage evita el loop si el reload no arregla nada).
function isStaleChunkError(err: unknown) {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  return /fetch dynamically imported module|Failed to fetch.*chunk|importing a module script failed/i.test(msg);
}
function reloadOnceForStaleChunk(err: unknown) {
  if (!isStaleChunkError(err)) return false;
  const key = "asgese:stale-chunk-reload";
  if (sessionStorage.getItem(key)) return false;
  sessionStorage.setItem(key, String(Date.now()));
  window.location.reload();
  return true;
}

window.addEventListener("error", (event) => {
  if (reloadOnceForStaleChunk(event.error ?? event.message)) return;
  void captureException(event.error ?? event.message, { source: "window.error" });
});
window.addEventListener("unhandledrejection", (event) => {
  if (reloadOnceForStaleChunk(event.reason)) return;
  void captureException(event.reason, { source: "unhandledrejection" });
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <AppErrorBoundary>
    <BrowserRouter>
      <ThemeProvider>
        <AppConfigProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </AppConfigProvider>
      </ThemeProvider>
    </BrowserRouter>
  </AppErrorBoundary>
);
