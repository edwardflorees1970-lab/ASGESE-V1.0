import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { enforceRateLimit, getClientIp, readPositiveIntEnv } from "../_shared/rateLimit.ts";

type CreateBody = {
  tipo_documento?: string;
  numero_documento?: string;
  apellido_paterno?: string;
  apellido_materno?: string;
  nombres?: string;
  correo: string;
  telefono?: string | null;
  fecha_nacimiento?: string | null;
  cargo?: string | null;
  area?: string | null;
  comision?: string | null;
  ugel?: string | null;
  rei?: string | null;
  can_create_monitoreo?: boolean | null;
  rol?: "admin" | "user" | "jefe_area" | "director" | "responsable_cdd";
  password: string;
};

const DEFAULT_ALLOWED_ORIGINS = ["http://localhost:5173", "http://127.0.0.1:5173"];
const RATE_LIMIT_SCOPE = "admin-create-user";
const RATE_LIMIT_MAX = readPositiveIntEnv("RATE_LIMIT_ADMIN_CREATE_USER_MAX", 15);
const RATE_LIMIT_WINDOW_SECONDS = readPositiveIntEnv("RATE_LIMIT_ADMIN_CREATE_USER_WINDOW_SECONDS", 60);

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

function bad(origin: string | null, msg: string, details?: unknown, code?: string) {
  return json({ error: msg, details, code }, origin, 400);
}

serve(async (req) => {
  const origin = req.headers.get("Origin");
  const { allowed } = responseHeaders(origin);

  if (req.method === "OPTIONS") return json({ ok: allowed }, origin, allowed ? 200 : 403);
  if (!allowed) return json({ error: "Origen no permitido por CORS" }, origin, 403);
  if (req.method !== "POST") return json({ error: "Use POST" }, origin, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRole = Deno.env.get("SB_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !anonKey) return json({ error: "Faltan SUPABASE_URL o SUPABASE_ANON_KEY" }, origin, 500);
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

    const supaCaller = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });

    const { data: authData, error: authErr } = await supaCaller.auth.getUser();
    if (authErr || !authData?.user) return json({ error: "No autorizado (sin sesion)" }, origin, 401);
    const callerId = authData.user.id;

    const supaAdmin = createClient(supabaseUrl, serviceRole);

    const { data: callerProfile, error: callerProfErr } = await supaAdmin
      .from("profiles")
      .select("role")
      .eq("id", callerId)
      .single();

    if (callerProfErr) return json({ error: "No se pudo verificar rol", details: callerProfErr.message }, origin, 403);
    if (!callerProfile || callerProfile.role !== "admin") {
      return json({ error: "Solo admin puede crear usuarios" }, origin, 403);
    }

    const body = (await req.json().catch(() => null)) as CreateBody | null;
    if (!body) return bad(origin, "Body invalido (JSON)");

    const correo = (body.correo || "").trim().toLowerCase();
    const password = (body.password || "").trim();

    if (!correo) return bad(origin, "correo es obligatorio");
    if (!correo.endsWith("@ugel06.gob.pe")) return bad(origin, "Solo correos @ugel06.gob.pe");
    if (password.length < 8) return bad(origin, "password debe tener minimo 8 caracteres");

    const { data: created, error: createErr } = await supaAdmin.auth.admin.createUser({
      email: correo,
      password,
      email_confirm: true,
      user_metadata: {
        nombres: (body.nombres || "").trim(),
      },
    });

    if (createErr || !created?.user) {
      return bad(origin, "No se pudo crear usuario en Auth", createErr?.message ?? "Sin detalle", "AUTH_CREATE_FAILED");
    }

    const userId = created.user.id;

    const profileRow = {
      id: userId,
      correo,
      email: correo,
      email_login: correo,
      tipo_documento: (body.tipo_documento || "DNI").trim(),
      numero_documento: (body.numero_documento || "").trim() || null,
      apellido_paterno: (body.apellido_paterno || "").trim() || null,
      apellido_materno: (body.apellido_materno || "").trim() || null,
      nombres: (body.nombres || "").trim() || null,
      telefono: (body.telefono ?? null) ? String(body.telefono).trim() : null,
      fecha_nacimiento: (body.fecha_nacimiento ?? null) || null,
      cargo: (body.cargo ?? null) ? String(body.cargo).trim() : null,
      area: (body.area ?? null) ? String(body.area).trim() : null,
      comision: (body.comision ?? null) ? String(body.comision).trim() : null,
      ugel: (body.ugel ?? null) ? String(body.ugel).trim() : null,
      rei: (body.rei ?? null) ? String(body.rei).trim() : "SIN REI",
      can_create_monitoreo: body.can_create_monitoreo ?? false,
      role: (body.rol || "user") as "admin" | "user" | "jefe_area" | "director" | "responsable_cdd",
      updated_at: new Date().toISOString(),
    };

    const { error: profErr } = await supaAdmin.from("profiles").upsert(profileRow, { onConflict: "id" });

    if (profErr) {
      await supaAdmin.auth.admin.deleteUser(userId).catch(() => {});
      return bad(origin, "No se pudo guardar profile", profErr.message, "PROFILE_UPSERT_FAILED");
    }

    return json({ ok: true, user_id: userId }, origin);
  } catch (e) {
    return json({ error: "Error interno", details: String(e) }, origin, 500);
  }
});
