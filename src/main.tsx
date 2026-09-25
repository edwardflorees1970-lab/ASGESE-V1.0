import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.tsx";
import "@fontsource-variable/outfit";
import "./index.css";
import { AuthProvider } from "./app/AuthProvider";
import { ThemeProvider } from "./app/ThemeProvider";
import { AppConfigProvider } from "./app/AppConfigProvider";
import { AppErrorBoundary } from "./app/AppErrorBoundary";
import { captureException } from "./lib/telemetry";

window.addEventListener("error", (event) => {
  void captureException(event.error ?? event.message, { source: "window.error" });
});
window.addEventListener("unhandledrejection", (event) => {
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
