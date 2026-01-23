import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
    },
  });
}

type Body = {
  userId?: string;
  user_id?: string;
  id?: string;

  new_password?: string;
  password?: string;
  newPassword?: string;
};

serve(async (req) => {
  if (req.method === "OPTIONS") return json({ ok: true }, 200);
  if (req.method !== "POST") return json({ error: "Use POST" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRole =
      Deno.env.get("SB_SERVICE_ROLE_KEY") ||
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!serviceRole) {
      return json({ error: "Falta SB_SERVICE_ROLE_KEY en secrets." }, 500);
    }

    // 1) Validar sesión del caller (JWT del frontend)
    const supaUser = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });

    const { data: authData, error: authErr } = await supaUser.auth.getUser();
    if (authErr || !authData?.user) {
      return json({ error: "No autorizado (sin sesión)" }, 401);
    }

    const callerId = authData.user.id;

    // 2) Cliente admin (service role)
    const supaAdmin = createClient(supabaseUrl, serviceRole);

    // 3) Verificar que caller sea admin (columna REAL: role)
    const { data: prof, error: profErr } = await supaAdmin
      .from("profiles")
      .select("role")
      .eq("id", callerId)
      .single();

    if (profErr) {
      return json({ error: "No se pudo verificar role", details: profErr.message }, 403);
    }
    if (!prof || prof.role !== "admin") {
      return json({ error: "Solo admin puede resetear contraseñas" }, 403);
    }

    // 4) Leer body con compatibilidad de claves
    const body = (await req.json().catch(() => ({}))) as Body;

    const userId = String(body.user_id ?? body.userId ?? body.id ?? "").trim();
    const newPassRaw = String(body.new_password ?? body.password ?? body.newPassword ?? "");

    // OJO: no “embellecemos” el password, solo quitamos espacios al inicio/fin
    const newPassword = newPassRaw.trim();

    if (!userId) return json({ error: "userId es requerido" }, 400);
    if (!newPassword) return json({ error: "password es requerido" }, 400);
    if (newPassword.length < 8) {
      return json({
        error: "password mínimo 8 caracteres",
        details: { len: newPassword.length },
      }, 400);
    }

    // 5) Reset password en Auth
    const { error: upErr } = await supaAdmin.auth.admin.updateUserById(userId, {
      password: newPassword,
    });

    if (upErr) {
      return json({ error: "No se pudo resetear password", details: upErr.message }, 400);
    }

    return json({ ok: true }, 200);
  } catch (e) {
    return json({ error: "Error interno", details: String(e) }, 500);
  }
});
