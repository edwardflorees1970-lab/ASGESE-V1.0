import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

type Body = {
  userId?: string;
  user_id?: string;
  id?: string;
  new_password?: string;
  password?: string;
  newPassword?: string;
};

const DEFAULT_ALLOWED_ORIGINS = ["http://localhost:5173", "http://127.0.0.1:5173"];

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

function json(data: unknown, origin: string | null, status = 200) {
  const { headers } = responseHeaders(origin);
  return new Response(JSON.stringify(data), { status, headers });
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

    if (!serviceRole) {
      return json({ error: "Falta SB_SERVICE_ROLE_KEY en secrets." }, origin, 500);
    }

    const supaUser = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });

    const { data: authData, error: authErr } = await supaUser.auth.getUser();
    if (authErr || !authData?.user) {
      return json({ error: "No autorizado (sin sesion)" }, origin, 401);
    }

    const callerId = authData.user.id;
    const supaAdmin = createClient(supabaseUrl, serviceRole);

    const { data: prof, error: profErr } = await supaAdmin
      .from("profiles")
      .select("role")
      .eq("id", callerId)
      .single();

    if (profErr) {
      return json({ error: "No se pudo verificar role", details: profErr.message }, origin, 403);
    }
    if (!prof || prof.role !== "admin") {
      return json({ error: "Solo admin puede resetear contraseñas" }, origin, 403);
    }

    const body = (await req.json().catch(() => ({}))) as Body;

    const userId = String(body.user_id ?? body.userId ?? body.id ?? "").trim();
    const newPassRaw = String(body.new_password ?? body.password ?? body.newPassword ?? "");
    const newPassword = newPassRaw.trim();

    if (!userId) return json({ error: "userId es requerido" }, origin, 400);
    if (!newPassword) return json({ error: "password es requerido" }, origin, 400);
    if (newPassword.length < 8) {
      return json({ error: "password minimo 8 caracteres", details: { len: newPassword.length } }, origin, 400);
    }

    const { error: upErr } = await supaAdmin.auth.admin.updateUserById(userId, {
      password: newPassword,
    });

    if (upErr) {
      return json({ error: "No se pudo resetear password", details: upErr.message }, origin, 400);
    }

    return json({ ok: true }, origin, 200);
  } catch (e) {
    return json({ error: "Error interno", details: String(e) }, origin, 500);
  }
});
