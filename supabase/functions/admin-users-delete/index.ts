import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { enforceRateLimit, getClientIp, readPositiveIntEnv } from "../_shared/rateLimit.ts";

type Body = { id: string };

const DEFAULT_ALLOWED_ORIGINS = ["http://localhost:5173", "http://127.0.0.1:5173"];
const RATE_LIMIT_SCOPE = "admin-users-delete";
const RATE_LIMIT_MAX = readPositiveIntEnv("RATE_LIMIT_ADMIN_USERS_DELETE_MAX", 15);
const RATE_LIMIT_WINDOW_SECONDS = readPositiveIntEnv("RATE_LIMIT_ADMIN_USERS_DELETE_WINDOW_SECONDS", 60);

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
  if (!prof || prof.role !== "admin") return { ok: false as const, status: 403, error: "Solo admin puede eliminar usuarios" };

  return { ok: true as const, supaAdmin, callerId };
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
    if (!guard.ok) {
      const details = "details" in guard ? guard.details : undefined;
      return json({ error: guard.error, details }, origin, guard.status);
    }

    const supaAdmin = guard.supaAdmin;
    const callerId = guard.callerId;

    const body = (await req.json().catch(() => ({}))) as Partial<Body>;
    const id = String(body.id ?? "").trim();
    if (!id) return json({ error: "id es requerido" }, origin, 400);

    if (id === callerId) return json({ error: "No puedes eliminarte a ti mismo (admin)" }, origin, 400);

    const { data: profileBackup, error: backupErr } = await supaAdmin
      .from("profiles")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (backupErr) {
      return json({ error: "No se pudo preparar la eliminación", details: backupErr.message }, origin, 400);
    }

    const { error: profErr } = await supaAdmin.from("profiles").delete().eq("id", id);
    if (profErr) return json({ error: "No se pudo borrar profile", details: profErr.message }, origin, 400);

    const { error: delErr } = await supaAdmin.auth.admin.deleteUser(id);
    if (delErr) {
      const { error: restoreErr } = profileBackup
        ? await supaAdmin.from("profiles").upsert(profileBackup, { onConflict: "id" })
        : { error: null };
      return json(
        {
          error: restoreErr
            ? "No se pudo borrar el usuario de Auth ni restaurar su profile"
            : profileBackup
              ? "No se pudo borrar el usuario de Auth; se restauró su profile"
              : "No se pudo borrar el usuario de Auth",
          details: delErr.message,
          profile_restore_error: restoreErr?.message,
        },
        origin,
        400
      );
    }

    return json({ ok: true }, origin);
  } catch (e) {
    return json({ error: "Error interno", details: String(e) }, origin, 500);
  }
});
