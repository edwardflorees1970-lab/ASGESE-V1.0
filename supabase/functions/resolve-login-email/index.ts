import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { enforceRateLimit, getClientIp, readPositiveIntEnv } from "../_shared/rateLimit.ts";

// Antes el login por DNI/CE armaba el correo asumiendo siempre
// "{tipo}-{numero}@ugel06.gob.pe", lo que dejo de servir cuando se
// permitieron correos externos. Esta funcion resuelve el correo real
// (cualquier dominio) a partir del documento, ANTES de intentar el login,
// para que el modo "Administrador" (por DNI) siga funcionando para
// cualquier usuario. Es publica por necesidad (se llama antes de tener
// sesion), asi que se limita fuerte por IP para dificultar enumeracion
// de documentos, y nunca revela si el documento existe o no: siempre
// responde generico ante cualquier fallo de busqueda.

type Body = {
  tipo_documento?: string;
  numero_documento?: string;
};

const DOCUMENT_LENGTH: Record<string, number> = { DNI: 8, CE: 9 };
const DEFAULT_ALLOWED_ORIGINS = ["http://localhost:5173", "http://127.0.0.1:5173"];
const RATE_LIMIT_SCOPE = "resolve-login-email";
const RATE_LIMIT_MAX = readPositiveIntEnv("RATE_LIMIT_RESOLVE_LOGIN_EMAIL_MAX", 20);
const RATE_LIMIT_WINDOW_SECONDS = readPositiveIntEnv("RATE_LIMIT_RESOLVE_LOGIN_EMAIL_WINDOW_SECONDS", 60);

function getAllowedOrigins() {
  const raw = Deno.env.get("APP_ALLOWED_ORIGINS") ?? Deno.env.get("ALLOWED_ORIGINS") ?? "";
  const fromEnv = raw.split(",").map((v) => v.trim()).filter(Boolean);
  return fromEnv.length ? fromEnv : DEFAULT_ALLOWED_ORIGINS;
}

function responseHeaders(origin: string | null) {
  const allowedOrigins = getAllowedOrigins();
  const allowed = !origin || allowedOrigins.includes(origin);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    Vary: "Origin",
  };
  if (origin && allowed) headers["Access-Control-Allow-Origin"] = origin;
  return { headers, allowed };
}

function json(data: unknown, origin: string | null, status = 200, extraHeaders: Record<string, string> = {}) {
  const { headers } = responseHeaders(origin);
  return new Response(JSON.stringify(data), { status, headers: { ...headers, ...extraHeaders } });
}

function notFound(origin: string | null) {
  // Mensaje generico a proposito: no confirma ni descarta que el
  // documento exista, igual que un login fallido normal.
  return json({ error: "Usuario o contraseña incorrectos" }, origin, 404);
}

serve(async (req) => {
  const origin = req.headers.get("Origin");
  const { allowed } = responseHeaders(origin);

  if (req.method === "OPTIONS") return json({ ok: allowed }, origin, allowed ? 200 : 403);
  if (!allowed) return json({ error: "Origen no permitido por CORS" }, origin, 403);
  if (req.method !== "POST") return json({ error: "Use POST" }, origin, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRole = Deno.env.get("SB_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!serviceRole) return json({ error: "Falta SB_SERVICE_ROLE_KEY en secrets." }, origin, 500);

    const rateLimit = await enforceRateLimit({
      supabaseUrl,
      serviceRoleKey: serviceRole,
      scope: RATE_LIMIT_SCOPE,
      identifier: getClientIp(req),
      maxHits: RATE_LIMIT_MAX,
      windowSeconds: RATE_LIMIT_WINDOW_SECONDS,
    });
    if (!rateLimit.allowed) {
      return json({ error: "Demasiados intentos. Intenta nuevamente en unos segundos." }, origin, 429, rateLimit.headers);
    }

    const body = (await req.json().catch(() => ({}))) as Body;
    const tipoDocumento = (body.tipo_documento || "").trim().toUpperCase();
    const numeroDocumento = (body.numero_documento || "").trim();

    if (tipoDocumento !== "DNI" && tipoDocumento !== "CE") return notFound(origin);
    if (!/^\d+$/.test(numeroDocumento) || numeroDocumento.length !== DOCUMENT_LENGTH[tipoDocumento]) return notFound(origin);

    const supaAdmin = createClient(supabaseUrl, serviceRole);
    const { data: profile } = await supaAdmin
      .from("profiles")
      .select("correo")
      .eq("tipo_documento", tipoDocumento)
      .eq("numero_documento", numeroDocumento)
      .maybeSingle();

    if (!profile?.correo) return notFound(origin);

    return json({ correo: profile.correo }, origin);
  } catch (e) {
    return json({ error: "Error interno", details: String(e) }, origin, 500);
  }
});
