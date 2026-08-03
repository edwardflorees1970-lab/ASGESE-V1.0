import { supabase } from "./supabaseClient";

export type TelemetrySeverity = "info" | "warning" | "error" | "fatal";

function safeContext(context: Record<string, unknown>) {
  const blocked = /password|token|secret|authorization|documento|dni|email/i;
  return Object.fromEntries(Object.entries(context).filter(([key]) => !blocked.test(key)));
}

export async function captureTelemetry(
  eventType: string,
  message: string,
  severity: TelemetrySeverity = "error",
  context: Record<string, unknown> = {},
) {
  try {
    const eventContext = safeContext(context);
    const payload = {
      p_event_type: eventType.slice(0, 120),
      p_message: message.slice(0, 1000),
      p_severity: severity,
      p_context: eventContext,
    };
    const { error: rpcError } = await supabase.rpc("capture_telemetry_event", payload);

    // Compatibilidad durante el despliegue: el frontend puede publicarse antes
    // de que la migracion de consolidacion haya sido aplicada en Supabase.
    if (rpcError && /capture_telemetry_event|schema cache|function/i.test(rpcError.message)) {
      const { error: legacyError } = await supabase.from("app_telemetry_event").insert({
        event_type: payload.p_event_type,
        message: payload.p_message,
        severity,
        context: eventContext,
      });
      if (legacyError && import.meta.env.DEV) console.warn("Telemetry unavailable:", legacyError.message);
      return;
    }
    if (rpcError && import.meta.env.DEV) console.warn("Telemetry unavailable:", rpcError.message);
  } catch (error) {
    if (import.meta.env.DEV) console.warn("Telemetry unavailable:", error);
  }
}

export function captureException(error: unknown, context: Record<string, unknown> = {}) {
  const message = error instanceof Error ? error.message : String(error);
  return captureTelemetry("unhandled_exception", message, "fatal", context);
}

