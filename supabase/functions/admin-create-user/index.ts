import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

type CreateBody = {
  tipo_documento?: string;          // "DNI" | "CE"
  numero_documento?: string;
  apellido_paterno?: string;
  apellido_materno?: string;
  nombres?: string;
  correo: string;                   // obligatorio
  telefono?: string | null;
  fecha_nacimiento?: string | null; // "YYYY-MM-DD"
  cargo?: string | null;
  area?: string | null;
  comision?: string | null;
  ugel?: string | null;
  rei?: string | null;
  can_create_monitoreo?: boolean | null;
  rol?: "admin" | "user" | "jefe_area" | "director" | "responsable_cdd"; // OJO: tu tabla usa "role", no "rol"
  password: string;                 // obligatorio
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
    },
  });
}

function bad(msg: string, details?: unknown, code?: string) {
  return json({ error: msg, details, code }, 400);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return json({ ok: true }, 200);
  if (req.method !== "POST") return json({ error: "Use POST" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRole =
      Deno.env.get("SB_SERVICE_ROLE_KEY") ||
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !anonKey) return json({ error: "Faltan SUPABASE_URL o SUPABASE_ANON_KEY" }, 500);
    if (!serviceRole) return json({ error: "Falta SB_SERVICE_ROLE_KEY en secrets." }, 500);

    // 1) Validar que quien llama esté autenticado
    const supaCaller = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });

    const { data: authData, error: authErr } = await supaCaller.auth.getUser();
    if (authErr || !authData?.user) return json({ error: "No autorizado (sin sesión)" }, 401);
    const callerId = authData.user.id;

    // 2) Cliente admin (service role)
    const supaAdmin = createClient(supabaseUrl, serviceRole);

    // 3) Verificar que el caller sea admin (tu tabla usa "role")
    const { data: callerProfile, error: callerProfErr } = await supaAdmin
      .from("profiles")
      .select("role")
      .eq("id", callerId)
      .single();

    if (callerProfErr) return json({ error: "No se pudo verificar rol", details: callerProfErr.message }, 403);
    if (!callerProfile || callerProfile.role !== "admin") {
      return json({ error: "Solo admin puede crear usuarios" }, 403);
    }

    // 4) Leer body
    const body = (await req.json().catch(() => null)) as CreateBody | null;
    if (!body) return bad("Body inválido (JSON)");

    const correo = (body.correo || "").trim().toLowerCase();
    const password = (body.password || "").trim();

    if (!correo) return bad("correo es obligatorio");
    if (!correo.endsWith("@ugel06.gob.pe")) return bad("Solo correos @ugel06.gob.pe");
    if (password.length < 8) return bad("password debe tener mínimo 8 caracteres");

    // 5) Crear usuario en Auth
    // OJO: Tu trigger on_auth_user_created creará el profile automático.
    const { data: created, error: createErr } = await supaAdmin.auth.admin.createUser({
      email: correo,
      password,
      email_confirm: true,
      user_metadata: {
        nombres: (body.nombres || "").trim(),
      },
    });

    if (createErr || !created?.user) {
      return bad("No se pudo crear usuario en Auth", createErr?.message ?? "Sin detalle", "AUTH_CREATE_FAILED");
    }

    const userId = created.user.id;

    // 6) UPSERT profile (NO INSERT) para no chocar con el trigger
    //    También usamos columnas reales: correo / role / nombres / etc.
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

      // IMPORTANTE: tu columna es "role"
      role: (body.rol || "user") as "admin" | "user" | "jefe_area" | "director" | "responsable_cdd",

      updated_at: new Date().toISOString(),
    };

    const { error: profErr } = await supaAdmin
      .from("profiles")
      .upsert(profileRow, { onConflict: "id" });

    if (profErr) {
      // Si falla profile, no dejamos usuario “huérfano”: lo borramos de Auth.
      await supaAdmin.auth.admin.deleteUser(userId).catch(() => {});
      return bad("No se pudo guardar profile", profErr.message, "PROFILE_UPSERT_FAILED");
    }

    return json({ ok: true, user_id: userId });
  } catch (e) {
    return json({ error: "Error interno", details: String(e) }, 500);
  }
});
