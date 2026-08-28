import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { enforceRateLimit, getClientIp, readPositiveIntEnv } from "../_shared/rateLimit.ts";
import { normalizeRei } from "../_shared/rei.ts";
import { normalizeInstitutionalCode } from "../_shared/institutionalCode.ts";

type ImportRow = {
  source_row: number; tipo_documento: "DNI" | "CE"; numero_documento: string;
  apellido_paterno: string; apellido_materno: string; nombres: string; correo: string;
  telefono?: string | null; fecha_nacimiento?: string | null; cargo?: string | null;
  area?: string | null; comision?: string | null; ugel?: string | null; rei?: string | null;
  codigo_institucional?: string | null;
  nombre_colegio_referencia?: string | null;
  modalidad?: string | null;
  plaza_id?: string | null;
  rol: string; can_create_monitoreo?: boolean;
  validation_errors?: string[];
};

const DEFAULT_ALLOWED_ORIGINS = ["http://localhost:5173", "http://127.0.0.1:5173"];
const MAX_BATCH_SIZE = 20;
const RATE_LIMIT_MAX = readPositiveIntEnv("RATE_LIMIT_ADMIN_USERS_IMPORT_MAX", 60);
const RATE_LIMIT_WINDOW_SECONDS = readPositiveIntEnv("RATE_LIMIT_ADMIN_USERS_IMPORT_WINDOW_SECONDS", 60);

function allowedOrigins() {
  const raw = Deno.env.get("APP_ALLOWED_ORIGINS") ?? Deno.env.get("ALLOWED_ORIGINS") ?? "";
  const values = raw.split(",").map((value) => value.trim()).filter(Boolean);
  return values.length ? values : DEFAULT_ALLOWED_ORIGINS;
}

function responseHeaders(origin: string | null) {
  const allowed = !origin || allowedOrigins().includes(origin);
  const headers: Record<string, string> = {
    "Content-Type": "application/json", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS", "X-Content-Type-Options": "nosniff", Vary: "Origin",
  };
  if (origin && allowed) headers["Access-Control-Allow-Origin"] = origin;
  return { allowed, headers };
}

function json(data: unknown, origin: string | null, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: responseHeaders(origin).headers });
}

function clean(value: unknown) { return String(value ?? "").trim(); }
function nullable(value: unknown) { const result = clean(value); return result || null; }
function upper(value: unknown) { return clean(value).toLocaleUpperCase("es"); }
function nullableUpper(value: unknown) { const result = upper(value); return result || null; }
function normalizeModalidad(value: unknown) { return upper(value).replace(/\s+/g, " "); }
function plazaKey(codigoInstitucional: unknown, modalidad: unknown) {
  return `${normalizeInstitutionalCode(codigoInstitucional)}|${normalizeModalidad(modalidad)}`;
}
function generateTemporaryPassword(apellidoPaterno: unknown) {
  const base = clean(apellidoPaterno).split(/[^\p{L}\p{N}]+/u).filter(Boolean).map((part) => {
    const lower = part.toLocaleLowerCase("es");
    return lower.charAt(0).toLocaleUpperCase("es") + lower.slice(1);
  }).join("");
  return base ? `${base}123@@` : "";
}
function isStrongPassword(password: string) {
  return password.length >= 8 && /\p{Lu}/u.test(password) && /\p{Ll}/u.test(password)
    && /\p{N}/u.test(password) && /[^\p{L}\p{N}]/u.test(password);
}
function validIsoDate(value: unknown) {
  const text = clean(value);
  if (!text) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  const date = new Date(`${text}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === text;
}

serve(async (req) => {
  const origin = req.headers.get("Origin");
  const cors = responseHeaders(origin);
  if (req.method === "OPTIONS") return json({ ok: cors.allowed }, origin, cors.allowed ? 200 : 403);
  if (!cors.allowed) return json({ error: "Origen no permitido por CORS" }, origin, 403);
  if (req.method !== "POST") return json({ error: "Use POST" }, origin, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRole = Deno.env.get("SB_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!serviceRole) return json({ error: "Falta SUPABASE_SERVICE_ROLE_KEY" }, origin, 500);

    const rateLimit = await enforceRateLimit({ supabaseUrl, serviceRoleKey: serviceRole, scope: "admin-users-import", identifier: getClientIp(req), maxHits: RATE_LIMIT_MAX, windowSeconds: RATE_LIMIT_WINDOW_SECONDS });
    if (!rateLimit.allowed) return json({ error: "Demasiadas solicitudes. Espera unos segundos antes de continuar." }, origin, 429);

    const caller = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } });
    const { data: authData, error: authError } = await caller.auth.getUser();
    if (authError || !authData.user) return json({ error: "No autorizado" }, origin, 401);
    const admin = createClient(supabaseUrl, serviceRole);
    const { data: callerProfile } = await admin.from("profiles").select("role").eq("id", authData.user.id).maybeSingle();
    if (callerProfile?.role !== "admin") return json({ error: "Solo el administrador puede importar usuarios" }, origin, 403);

    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const action = clean(body.action);
    if (action === "start") {
      const totalRows = Number(body.total_rows);
      const fileName = clean(body.file_name).slice(0, 180);
      if (!fileName || !Number.isInteger(totalRows) || totalRows < 1 || totalRows > 300) return json({ error: "Datos de carga inválidos" }, origin, 400);
      const { data, error } = await admin.from("user_import_job").insert({ file_name: fileName, total_rows: totalRows, created_by: authData.user.id }).select("id").single();
      if (error) return json({ error: "No se pudo iniciar la carga", details: error.message }, origin, 400);
      return json({ ok: true, job_id: data.id }, origin);
    }

    const jobId = clean(body.job_id);
    if (!jobId) return json({ error: "job_id requerido" }, origin, 400);
    const { data: job } = await admin.from("user_import_job").select("id,status,created_by").eq("id", jobId).eq("created_by", authData.user.id).maybeSingle();
    if (!job) return json({ error: "Carga inexistente o no autorizada" }, origin, 404);

    if (action === "finish") {
      const { data: entries, error } = await admin.from("user_import_row").select("status").eq("job_id", jobId);
      if (error) return json({ error: error.message }, origin, 400);
      const summary = { total: entries?.length ?? 0, created: 0, skipped: 0, errors: 0 };
      for (const entry of entries ?? []) {
        if (entry.status === "created") summary.created += 1;
        else if (entry.status === "skipped") summary.skipped += 1;
        else summary.errors += 1;
      }
      await admin.from("user_import_job").update({ status: summary.errors ? "completed_with_errors" : "completed", created_count: summary.created, skipped_count: summary.skipped, error_count: summary.errors, completed_at: new Date().toISOString() }).eq("id", jobId);
      return json({ ok: true, summary }, origin);
    }

    if (action !== "process" || !Array.isArray(body.rows) || body.rows.length < 1 || body.rows.length > MAX_BATCH_SIZE) {
      return json({ error: `Cada lote debe contener entre 1 y ${MAX_BATCH_SIZE} filas` }, origin, 400);
    }

    const rows = body.rows as ImportRow[];
    const sourceRows = rows.map((row) => Number(row.source_row));
    const { data: alreadyProcessed } = await admin.from("user_import_row").select("source_row,correo,numero_documento,input_data,status,message").eq("job_id", jobId).in("source_row", sourceRows);
    const processed = new Map((alreadyProcessed ?? []).map((entry) => [entry.source_row, entry]));
    const { data: roleRows, error: roleError } = await admin.from("app_role").select("code").eq("is_active", true);
    if (roleError) return json({ error: "No se pudieron validar los roles", details: roleError.message }, origin, 400);
    const roles = new Set((roleRows ?? []).map((role) => role.code));
    const documents = rows.map((row) => clean(row.numero_documento)).filter(Boolean);
    const institutionalCodes = Array.from(new Set(rows
      .filter((row) => clean(row.rol).toLowerCase() === "director_iiee")
      .map((row) => normalizeInstitutionalCode(row.codigo_institucional))
      .filter((code) => /^\d{8}$/.test(code))));
    const plazaResponse = institutionalCodes.length
      ? await admin.from("director_iiee_plaza").select("id,codigo_institucional,institucion_nombre,modalidad,rei,alias,estado").in("codigo_institucional", institutionalCodes)
      : { data: [], error: null };
    if (plazaResponse.error) return json({ error: "No se pudieron validar las plazas de Director IIEE", details: plazaResponse.error.message }, origin, 400);
    const plazaByKey = new Map<string, { id: string; codigo: string; nombre: string; modalidad: string; rei: string; alias: string; estado: string }>();
    for (const plaza of plazaResponse.data ?? []) {
      const info = {
        id: clean(plaza.id), codigo: normalizeInstitutionalCode(plaza.codigo_institucional),
        nombre: clean(plaza.institucion_nombre), modalidad: normalizeModalidad(plaza.modalidad),
        rei: clean(plaza.rei), alias: clean(plaza.alias).toLowerCase(), estado: clean(plaza.estado),
      };
      plazaByKey.set(plazaKey(info.codigo, info.modalidad), info);
    }
    const emails = rows.map((row) => {
      if (clean(row.rol).toLowerCase() !== "director_iiee") return clean(row.correo).toLowerCase();
      return plazaByKey.get(plazaKey(row.codigo_institucional, row.modalidad))?.alias ?? clean(row.correo).toLowerCase();
    }).filter(Boolean);
    const [{ data: emailProfiles }, { data: documentProfiles }] = await Promise.all([
      admin.from("profiles").select("id,correo").in("correo", emails),
      admin.from("profiles").select("id,numero_documento").in("numero_documento", documents),
    ]);
    const existingEmails = new Set((emailProfiles ?? []).map((profile) => clean(profile.correo).toLowerCase()));
    const existingDocuments = new Set((documentProfiles ?? []).map((profile) => clean(profile.numero_documento)));
    const results: Array<Record<string, unknown>> = [];

    for (const raw of rows) {
      const previous = processed.get(Number(raw.source_row));
      if (previous) {
        const previousInput = previous.input_data as Record<string, unknown>;
        results.push({ source_row: previous.source_row, correo: previous.correo, numero_documento: previous.numero_documento, nombres: clean(previousInput?.nombres), codigo_institucional: nullable(previousInput?.codigo_institucional), institucion_nombre: nullable(previousInput?.institucion_nombre), modalidad: nullable(previousInput?.modalidad), rei: nullable(previousInput?.rei), plaza_id: nullable(previousInput?.plaza_id), status: previous.status, message: previous.message, ...(previous.status === "created" ? { temporary_password: generateTemporaryPassword(previousInput?.apellido_paterno) } : {}) });
        continue;
      }
      const rawDocumentType = upper(raw.tipo_documento);
      const row: ImportRow = { ...raw, source_row: Number(raw.source_row), tipo_documento: rawDocumentType === "CE" ? "CE" : "DNI", numero_documento: clean(raw.numero_documento), apellido_paterno: upper(raw.apellido_paterno), apellido_materno: upper(raw.apellido_materno), nombres: upper(raw.nombres), correo: clean(raw.correo).toLowerCase(), telefono: nullable(raw.telefono), fecha_nacimiento: nullable(raw.fecha_nacimiento), cargo: nullableUpper(raw.cargo), area: nullableUpper(raw.area), comision: nullableUpper(raw.comision), ugel: nullableUpper(raw.ugel) ?? "UGEL 06", rei: nullableUpper(raw.rei) ?? "SIN REI", nombre_colegio_referencia: nullableUpper(raw.nombre_colegio_referencia), modalidad: normalizeModalidad(raw.modalidad) || null, plaza_id: nullable(raw.plaza_id), rol: clean(raw.rol).toLowerCase(), can_create_monitoreo: raw.can_create_monitoreo === true };
      const normalizedRei = normalizeRei(raw.rei);
      row.rei = normalizedRei ?? "SIN REI";
      const institutionalCode = normalizeInstitutionalCode(raw.codigo_institucional);
      row.codigo_institucional = institutionalCode || null;
      const plaza = plazaByKey.get(plazaKey(institutionalCode, row.modalidad));
      if (row.rol === "director_iiee" && plaza) {
        row.plaza_id = plaza.id;
        row.correo = plaza.alias;
        row.rei = plaza.rei;
        row.can_create_monitoreo = false;
      }
      const temporaryPassword = generateTemporaryPassword(row.apellido_paterno);
      let status: "created" | "skipped" | "error" = "error";
      let message = "";
      let createdUserId: string | null = null;
      if (Array.isArray(raw.validation_errors) && raw.validation_errors.length) message = raw.validation_errors.map(clean).filter(Boolean).join("; ");
      else if (!Number.isInteger(row.source_row) || row.source_row < 2 || !row.numero_documento || !row.apellido_paterno || !row.apellido_materno || !row.nombres) message = "Faltan campos obligatorios";
      else if (rawDocumentType !== "DNI" && rawDocumentType !== "CE") message = "Tipo de documento inválido";
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.correo)) message = "Correo inválido";
      else if (!roles.has(row.rol)) message = "Rol inexistente o inactivo";
      else if (!validIsoDate(row.fecha_nacimiento)) message = "Fecha inválida; usa AAAA-MM-DD";
      else if (row.rol !== "director_iiee" && normalizedRei === null) message = "REI inválida; usa 01 a 19 o SIN REI";
      else if (row.rol === "director_iiee" && !institutionalCode) message = "Código institucional obligatorio para Director IIEE";
      else if (row.rol === "director_iiee" && !/^\d{8}$/.test(institutionalCode)) message = "Código institucional debe tener exactamente 8 dígitos";
      else if (row.rol === "director_iiee" && !row.modalidad) message = "Modalidad obligatoria para Director IIEE";
      else if (row.rol === "director_iiee" && !row.nombre_colegio_referencia) message = "Nombre del colegio obligatorio como referencia";
      else if (row.rol === "director_iiee" && !plaza) message = "No existe una plaza para el código institucional y modalidad";
      else if (row.rol === "director_iiee" && plaza?.estado !== "VACANTE") message = `La plaza está ${plaza?.estado?.toLowerCase() ?? "no disponible"}`;
      else if (row.rol !== "director_iiee" && (institutionalCode || row.modalidad || row.nombre_colegio_referencia)) message = "Los datos de plaza solo corresponden al rol Director IIEE";
      else if (!isStrongPassword(temporaryPassword)) message = "No se pudo generar una contraseña temporal segura";
      else if (existingEmails.has(row.correo)) { status = "skipped"; message = "Correo ya registrado"; }
      else if (existingDocuments.has(row.numero_documento)) { status = "skipped"; message = "Documento ya registrado"; }
      else {
        const { data: created, error: createError } = await admin.auth.admin.createUser({ email: row.correo, password: temporaryPassword, email_confirm: true, user_metadata: { nombres: row.nombres } });
        if (createError || !created.user) message = createError?.message || "No se pudo crear el usuario";
        else {
          createdUserId = created.user.id;
          const profile = { id: createdUserId, correo: row.correo, email: row.correo, email_login: row.correo, tipo_documento: row.tipo_documento, numero_documento: row.numero_documento, apellido_paterno: row.apellido_paterno, apellido_materno: row.apellido_materno, nombres: row.nombres, telefono: row.telefono, fecha_nacimiento: row.fecha_nacimiento, cargo: row.cargo, area: row.area, comision: row.comision, ugel: row.ugel, rei: row.rei, can_create_monitoreo: row.rol === "director_iiee" ? false : row.can_create_monitoreo ?? false, role: row.rol, must_change_password: true, updated_at: new Date().toISOString() };
          const { error: profileError } = await admin.from("profiles").upsert(profile, { onConflict: "id" });
          if (profileError) { await admin.auth.admin.deleteUser(createdUserId).catch(() => {}); createdUserId = null; message = `No se pudo guardar el perfil: ${profileError.message}`; }
          else {
            const assignmentError = row.rol === "director_iiee"
              ? (await admin.from("director_iiee_plaza_asignacion").insert({ plaza_id: plaza?.id, user_id: createdUserId, director_documento: row.numero_documento, director_nombre: `${row.apellido_paterno} ${row.apellido_materno} ${row.nombres}`.trim(), assigned_by: authData.user.id })).error
              : null;
            if (assignmentError) {
              await admin.auth.admin.deleteUser(createdUserId).catch(() => {});
              createdUserId = null;
              message = `No se pudo asignar el colegio: ${assignmentError.message}`;
            } else {
              status = "created";
              message = row.rol === "director_iiee" ? `Usuario creado y plaza ${plaza?.modalidad ?? ""} ocupada en ${plaza?.nombre ?? institutionalCode}` : "Usuario creado con contraseña temporal";
              existingEmails.add(row.correo); existingDocuments.add(row.numero_documento);
            }
          }
        }
      }
      const result = { source_row: row.source_row, correo: row.correo, numero_documento: row.numero_documento, nombres: row.nombres, codigo_institucional: row.codigo_institucional, institucion_nombre: plaza?.nombre ?? null, modalidad: row.modalidad, rei: row.rei, plaza_id: plaza?.id ?? null, status, message, ...(status === "created" ? { temporary_password: temporaryPassword } : {}) };
      await admin.from("user_import_row").upsert({ job_id: jobId, source_row: row.source_row, correo: row.correo, numero_documento: row.numero_documento, input_data: { nombres: row.nombres, apellido_paterno: row.apellido_paterno, apellido_materno: row.apellido_materno, rol: row.rol, codigo_institucional: row.codigo_institucional, institucion_nombre: plaza?.nombre ?? null, modalidad: row.modalidad, rei: row.rei, plaza_id: plaza?.id ?? null }, status, message, created_user_id: createdUserId }, { onConflict: "job_id,source_row" });
      results.push(result);
    }
    return json({ ok: true, items: results }, origin);
  } catch (error) {
    return json({ error: "Error interno de carga", details: error instanceof Error ? error.message : String(error) }, origin, 500);
  }
});
