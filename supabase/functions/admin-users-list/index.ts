import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

type Body = {
  q?: string; // búsqueda (nombre/doc/correo)
  rol?: "admin" | "user" | "jefe_area" | "director";
  area?: string;
  ugel?: string;
  rei?: string;

  page?: number; // 1..N
  pageSize?: number; // 1..100
};

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

function getAuthHeader(req: Request) {
  const raw = req.headers.get("Authorization") ?? "";
  if (!raw) return "";
  // Si el front manda solo el token (sin "Bearer "), lo arreglamos.
  if (!raw.toLowerCase().startsWith("bearer ")) return `Bearer ${raw}`;
  return raw;
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

    if (!serviceRole) return json({ error: "Falta SB_SERVICE_ROLE_KEY en secrets." }, 500);

    // 1) Validar sesión del caller con JWT real
    const authHeader = getAuthHeader(req);

    const supaUser = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: authData, error: authErr } = await supaUser.auth.getUser();

    // Si el JWT es inválido, devolvemos 401 claro
    if (authErr || !authData?.user) {
      return json(
        {
          error: "No autorizado (JWT inválido o sin sesión)",
          details: authErr?.message ?? "Sin user",
          hint: "Asegúrate de enviar Authorization: Bearer <access_token>",
        },
        401
      );
    }

    const callerId = authData.user.id;

    // 2) Admin client (Service Role)
    const supaAdmin = createClient(supabaseUrl, serviceRole);

    // 3) Verificar que el caller sea admin (columna REAL: role)
    const { data: prof, error: profErr } = await supaAdmin
      .from("profiles")
      .select("role")
      .eq("id", callerId)
      .single();

    if (profErr) {
      return json({ error: "No se pudo verificar rol", details: profErr.message }, 403);
    }
    if (!prof || prof.role !== "admin") {
      return json({ error: "Solo admin puede listar usuarios" }, 403);
    }

    const body = (await req.json().catch(() => ({}))) as Body;

    const page = Math.max(1, Number(body.page ?? 1));
    const pageSize = Math.min(100, Math.max(1, Number(body.pageSize ?? 20)));
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    // 4) Listar usuarios (columna REAL: role)
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

    const { data, error, count } = await query
      .order("updated_at", { ascending: false })
      .range(from, to);

    if (error) return json({ error: "No se pudo listar", details: error.message }, 400);

    // 5) Compatibilidad: devolvemos rol (alias) además de role
    const items = (data ?? []).map((row: any) => ({
      ...row,
      rol: row.role, // alias para tu front
    }));

    return json({
      ok: true,
      page,
      pageSize,
      total: count ?? 0,
      items,
    });
  } catch (e) {
    return json({ error: "Error interno", details: String(e) }, 500);
  }
});
