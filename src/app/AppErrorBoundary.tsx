import { Component, type ErrorInfo, type ReactNode } from "react";
import { captureException } from "../lib/telemetry";

type Props = { children: ReactNode };
type State = { failed: boolean };

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    void captureException(error, { componentStack: info.componentStack?.slice(0, 4000) });
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="grid min-h-screen place-items-center bg-slate-950 p-6 text-white">
        <section role="alert" className="max-w-lg rounded-2xl border border-red-400/30 bg-red-950/30 p-6 text-center">
          <h1 className="text-xl font-semibold">No pudimos mostrar esta pantalla</h1>
          <p className="mt-2 text-sm text-white/70">El incidente fue registrado. Recarga para continuar.</p>
          <button className="mt-5 rounded-lg bg-cyan-500 px-4 py-2 font-medium text-slate-950" onClick={() => window.location.reload()}>
            Recargar aplicacion
          </button>
        </section>
      </main>
    );
  }
}

