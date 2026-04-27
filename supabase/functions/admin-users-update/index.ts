import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { enforceRateLimit, getClientIp, readPositiveIntEnv } from "../_shared/rateLimit.ts";

type UpdateBody = {
  id: string;
  tipo_documento?: string | null;
  numero_documento?: string | null;
  apellido_paterno?: string | null;
  apellido_materno?: string | null;
  nombres?: string | null;
  correo?: string | null;
  telefono?: string | null;
  fecha_nacimiento?: string | null;
  cargo?: string | null;
  area?: string | null;
  comision?: string | null;
  ugel?: string | null;
  rei?: string | null;
  can_create_monitoreo?: boolean | null;
  rol?: "admin" | "user" | "jefe_area" | "director" | "responsable_cdd" | null;
  role?: "admin" | "user" | "jefe_area" | "director" | "responsable_cdd" | null;
};

const DEFAULT_ALLOWED_ORIGINS = ["http://localhost:5173", "http://127.0.0.1:5173"];
const RATE_LIMIT_SCOPE = "admin-users-update";
const RATE_LIMIT_MAX = readPositiveIntEnv("RATE_LIMIT_ADMIN_USERS_UPDATE_MAX", 30);
const RATE_LIMIT_WINDOW_SECONDS = readPositiveIntEnv("RATE_LIMIT_ADMIN_USERS_UPDATE_WINDOW_SECONDS", 60);

function getAllowedOrigins() {
  const raw = Deno.env.get("APP_ALLOWED_ORIGINS") ?? Deno.env.get("ALLOWED_ORIGINS") ?? "";
  const fromEnv = raw
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
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

async function requireAdmin(req: Request) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceRole = Deno.env.get("SB_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!serviceRole) return { ok: false as const, status: 500, error: "Falta SB_SERVICE_ROLE_KEY en secrets." };

  const supaUser = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });

  const { data: authData, error: authErr } = await supaUser.auth.getUser();
  if (authErr || !authData?.user) return { ok: false as const, status: 401, error: "No autorizado (sin sesion)" };
  const callerId = authData.user.id;

  const supaAdmin = createClient(supabaseUrl, serviceRole);

  const { data: prof, error: profErr } = await supaAdmin
    .from("profiles")
    .select("role")
    .eq("id", callerId)
    .maybeSingle();

  if (profErr) return { ok: false as const, status: 403, error: "No se pudo verificar rol", details: profErr.message };
  if (!prof || prof.role !== "admin") return { ok: false as const, status: 403, error: "Solo admin puede editar usuarios" };

  return { ok: true as const, supaAdmin };
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
      return json(
        { error: "Demasiadas solicitudes. Intenta nuevamente en unos segundos." },
        origin,
        429,
        rateLimit.headers
      );
    }

    const guard = await requireAdmin(req);
    if (!guard.ok) return json({ error: guard.error, details: (guard as any).details }, origin, guard.status);

    const supaAdmin = guard.supaAdmin;
    const body = (await req.json().catch(() => ({}))) as Partial<UpdateBody>;

    const id = String(body.id ?? "").trim();
    if (!id) return json({ error: "id es requerido" }, origin, 400);

    const nextRole = (body.role ?? body.rol ?? undefined) as any;
    const updates: Record<string, unknown> = {};

    const put = (k: string, v: unknown) => {
      if (v !== undefined) updates[k] = v;
    };

    put("tipo_documento", body.tipo_documento);
    put("numero_documento", body.numero_documento);
    put("apellido_paterno", body.apellido_paterno);
    put("apellido_materno", body.apellido_materno);
    put("nombres", body.nombres);
    put("telefono", body.telefono);
    put("fecha_nacimiento", body.fecha_nacimiento);
    put("cargo", body.cargo);
    put("area", body.area);
    put("comision", body.comision);
    put("ugel", body.ugel);
    put("rei", body.rei);
    put("can_create_monitoreo", body.can_create_monitoreo);

    if (body.correo !== undefined && body.correo !== null) {
      const correo = String(body.correo).trim().toLowerCase();
      if (!correo.endsWith("@ugel06.gob.pe")) return json({ error: "Solo correos @ugel06.gob.pe" }, origin, 400);
      updates["correo"] = correo;
      updates["email"] = correo;
      updates["email_login"] = correo;
    }

    if (nextRole !== undefined && nextRole !== null) updates["role"] = nextRole;

    if (Object.keys(updates).length === 0) {
      return json({ ok: true, warning: "Nada para actualizar" }, origin);
    }

    const { error } = await supaAdmin.from("profiles").update(updates).eq("id", id);
    if (error) return json({ error: "No se pudo actualizar profile", details: error.message }, origin, 400);

    return json({ ok: true }, origin);
  } catch (e) {
    return json({ error: "Error interno", details: String(e) }, origin, 500);
  }
});
