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
    const { error } = await supabase.from("app_telemetry_event").insert({
      event_type: eventType.slice(0, 120),
      message: message.slice(0, 1000),
      severity,
      context: safeContext(context),
    });
    if (error && import.meta.env.DEV) console.warn("Telemetry unavailable:", error.message);
  } catch (error) {
    if (import.meta.env.DEV) console.warn("Telemetry unavailable:", error);
  }
}

export function captureException(error: unknown, context: Record<string, unknown> = {}) {
  const message = error instanceof Error ? error.message : String(error);
  return captureTelemetry("unhandled_exception", message, "fatal", context);
}

