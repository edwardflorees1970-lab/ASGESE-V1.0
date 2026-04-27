import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { enforceRateLimit, getClientIp, readPositiveIntEnv } from "../_shared/rateLimit.ts";

type Body = {
  q?: string;
  rol?: "admin" | "user" | "jefe_area" | "director" | "responsable_cdd";
  area?: string;
  ugel?: string;
  rei?: string;
  page?: number;
  pageSize?: number;
};

const DEFAULT_ALLOWED_ORIGINS = ["http://localhost:5173", "http://127.0.0.1:5173"];
const RATE_LIMIT_SCOPE = "admin-users-list";
const RATE_LIMIT_MAX = readPositiveIntEnv("RATE_LIMIT_ADMIN_USERS_LIST_MAX", 60);
const RATE_LIMIT_WINDOW_SECONDS = readPositiveIntEnv("RATE_LIMIT_ADMIN_USERS_LIST_WINDOW_SECONDS", 60);

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

function getAuthHeader(req: Request) {
  const raw = req.headers.get("Authorization") ?? "";
  if (!raw) return "";
  if (!raw.toLowerCase().startsWith("bearer ")) return `Bearer ${raw}`;
  return raw;
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

    const authHeader = getAuthHeader(req);

    const supaUser = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: authData, error: authErr } = await supaUser.auth.getUser();

    if (authErr || !authData?.user) {
      return json(
        {
          error: "No autorizado (JWT invalido o sin sesion)",
          details: authErr?.message ?? "Sin user",
          hint: "Asegurate de enviar Authorization: Bearer <access_token>",
        },
        origin,
        401
      );
    }

    const callerId = authData.user.id;
    const supaAdmin = createClient(supabaseUrl, serviceRole);

    const { data: prof, error: profErr } = await supaAdmin
      .from("profiles")
      .select("role")
      .eq("id", callerId)
      .single();

    if (profErr) {
      return json({ error: "No se pudo verificar rol", details: profErr.message }, origin, 403);
    }
    if (!prof || prof.role !== "admin") {
      return json({ error: "Solo admin puede listar usuarios" }, origin, 403);
    }

    const body = (await req.json().catch(() => ({}))) as Body;

    const page = Math.max(1, Number(body.page ?? 1));
    const pageSize = Math.min(100, Math.max(1, Number(body.pageSize ?? 20)));
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supaAdmin
      .from("profiles")
      .select(
        "id, tipo_documento, numero_documento, apellido_paterno, apellido_materno, nombres, correo, telefono, fecha_nacimiento, cargo, area, comision, ugel, rei, can_create_monitoreo, role, created_at, updated_at",
        { count: "exact" }
      );

    if (body.rol) query = query.eq("role", body.rol);
    if (body.area) query = query.eq("area", body.area);
    if (body.ugel) query = query.eq("ugel", body.ugel);
    if (body.rei) query = query.eq("rei", body.rei);

    if (body.q && body.q.trim()) {
      const q = body.q.trim();
      query = query.or(
        [
          `correo.ilike.%${q}%`,
          `nombres.ilike.%${q}%`,
          `apellido_paterno.ilike.%${q}%`,
          `apellido_materno.ilike.%${q}%`,
          `numero_documento.ilike.%${q}%`,
        ].join(",")
      );
    }

    const { data, error, count } = await query.order("updated_at", { ascending: false }).range(from, to);

    if (error) return json({ error: "No se pudo listar", details: error.message }, origin, 400);

    const items = (data ?? []).map((row: any) => ({
      ...row,
      rol: row.role,
    }));

    return json(
      {
        ok: true,
        page,
        pageSize,
        total: count ?? 0,
        items,
      },
      origin
    );
  } catch (e) {
    return json({ error: "Error interno", details: String(e) }, origin, 500);
  }
});
