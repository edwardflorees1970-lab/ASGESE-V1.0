import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

type Body = { id: string };

function corsHeaders() {
  return {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}
function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: corsHeaders() });
}

async function requireAdmin(req: Request) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceRole =
    Deno.env.get("SB_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!serviceRole) return { ok: false as const, status: 500, error: "Falta SB_SERVICE_ROLE_KEY en secrets." };

  const supaUser = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
  const { data: authData, error: authErr } = await supaUser.auth.getUser();
  if (authErr || !authData?.user) return { ok: false as const, status: 401, error: "No autorizado (sin sesión)" };
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
  if (req.method === "OPTIONS") return json({ ok: true }, 200);
  if (req.method !== "POST") return json({ error: "Use POST" }, 405);

  try {
    const guard = await requireAdmin(req);
    if (!guard.ok) return json({ error: guard.error, details: (guard as any).details }, guard.status);

    const supaAdmin = guard.supaAdmin;
    const callerId = guard.callerId;

    const body = (await req.json().catch(() => ({}))) as Partial<Body>;
    const id = String(body.id ?? "").trim();
    if (!id) return json({ error: "id es requerido" }, 400);

    if (id === callerId) return json({ error: "No puedes eliminarte a ti mismo (admin)" }, 400);

    // 1) borrar profile
    const { error: profErr } = await supaAdmin.from("profiles").delete().eq("id", id);
    if (profErr) return json({ error: "No se pudo borrar profile", details: profErr.message }, 400);

    // 2) borrar auth user
    const { error: delErr } = await supaAdmin.auth.admin.deleteUser(id);
    if (delErr) {
      // si falla auth delete pero profile ya se borró
      return json({ ok: true, warning: "Profile borrado, pero no se pudo borrar Auth user", details: delErr.message }, 200);
    }

    return json({ ok: true });
  } catch (e) {
    return json({ error: "Error interno", details: String(e) }, 500);
  }
});
