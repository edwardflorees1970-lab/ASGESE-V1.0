import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { enforceRateLimit, getClientIp } from "../_shared/rateLimit.ts";

type Body = {
  token?: string;
  signature_png_base64?: string;
  foto_base64?: string;
  dni?: string;
};

const DEFAULT_ALLOWED_ORIGINS = ["http://localhost:5173", "http://127.0.0.1:5173"];
const RATE_LIMIT_SCOPE = "submit-firma-signature";
const RATE_LIMIT_MAX = 12;
const RATE_LIMIT_WINDOW_SECONDS = 60;
const MAX_PNG_BYTES = 2 * 1024 * 1024;
const MAX_FOTO_BYTES = 6 * 1024 * 1024;

function getAllowedOrigins() {
  const raw = Deno.env.get("APP_ALLOWED_ORIGINS") ?? Deno.env.get("ALLOWED_ORIGINS") ?? "";
  const fromEnv = raw.split(",").map((v) => v.trim()).filter(Boolean);
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

function decodeBase64Image(input: string, kind: "png" | "jpeg"): Uint8Array | null {
  const raw = input.includes(",") ? input.slice(input.indexOf(",") + 1) : input;
  try {
    const binary = atob(raw);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    if (kind === "png") {
      // PNG signature: 89 50 4E 47 0D 0A 1A 0A
      if (bytes.length < 8 || bytes[0] !== 0x89 || bytes[1] !== 0x50 || bytes[2] !== 0x4e || bytes[3] !== 0x47) {
        return null;
      }
    } else {
      // JPEG signature: FF D8 FF
      if (bytes.length < 3 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) {
        return null;
      }
    }
    return bytes;
  } catch {
    return null;
  }
}

function normalizeDni(value: unknown) {
  return String(value ?? "").replace(/\D/g, "");
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

    const body = (await req.json().catch(() => ({}))) as Body;
    const token = (body.token ?? "").trim();
    const pngBase64 = body.signature_png_base64 ?? "";
    const fotoBase64 = body.foto_base64 ?? "";
    const dniInput = normalizeDni(body.dni);
    if (!token) return json({ error: "Falta token." }, origin, 400);
    if (!pngBase64) return json({ error: "Falta la firma." }, origin, 400);
    if (!fotoBase64) return json({ error: "Falta la foto de verificación." }, origin, 400);
    if (dniInput.length < 8) return json({ error: "Ingresa tu DNI (8 dígitos)." }, origin, 400);

    const rateLimit = await enforceRateLimit({
      supabaseUrl,
      serviceRoleKey: serviceRole,
      scope: RATE_LIMIT_SCOPE,
      identifier: `${getClientIp(req)}:${token}`,
      maxHits: RATE_LIMIT_MAX,
      windowSeconds: RATE_LIMIT_WINDOW_SECONDS,
    });
    if (!rateLimit.allowed) {
      return json({ error: "Demasiados intentos. Intenta nuevamente en unos segundos." }, origin, 429, rateLimit.headers);
    }

    const pngBytes = decodeBase64Image(pngBase64, "png");
    if (!pngBytes) return json({ error: "La firma no es un PNG valido." }, origin, 400);
    if (pngBytes.byteLength > MAX_PNG_BYTES) return json({ error: "La firma es demasiado grande." }, origin, 400);

    const fotoBytes = decodeBase64Image(fotoBase64, "jpeg");
    if (!fotoBytes) return json({ error: "La foto no es válida." }, origin, 400);
    if (fotoBytes.byteLength > MAX_FOTO_BYTES) return json({ error: "La foto es demasiado grande." }, origin, 400);

    const supaAdmin = createClient(supabaseUrl, serviceRole);

    const { data: solicitud, error: findErr } = await supaAdmin
      .from("firma_solicitud")
      .select("id, run_id, signer, status, expires_at")
      .eq("token", token)
      .maybeSingle();

    if (findErr) return json({ error: "No se pudo verificar el enlace.", details: findErr.message }, origin, 500);
    if (!solicitud) return json({ error: "Enlace invalido." }, origin, 404);
    if (solicitud.status === "firmado") return json({ error: "Este enlace ya fue usado." }, origin, 409);
    if (solicitud.status === "expirado" || new Date(solicitud.expires_at) <= new Date()) {
      if (solicitud.status !== "expirado") {
        await supaAdmin.from("firma_solicitud").update({ status: "expirado" }).eq("id", solicitud.id);
      }
      return json({ error: "El enlace vencio." }, origin, 410);
    }

    const { data: runRow, error: runErr } = await supaAdmin
      .from("form_run")
      .select("footer_json")
      .eq("id", solicitud.run_id)
      .maybeSingle();
    if (runErr || !runRow) return json({ error: "No se pudo verificar el registro." }, origin, 500);

    const footer = (runRow.footer_json ?? {}) as Record<string, unknown>;
    const expectedDni = normalizeDni(solicitud.signer === "docente" ? footer.docente_dni : footer.monitor_dni);
    if (!expectedDni) {
      return json({ error: "La ficha no tiene un DNI registrado para verificar. Pide al monitor que lo complete antes de firmar." }, origin, 409);
    }
    if (expectedDni !== dniInput) {
      return json({ error: "El DNI ingresado no coincide con el registrado en la ficha." }, origin, 403);
    }

    const objectPath = `${solicitud.run_id}/${solicitud.signer}-${token}.png`;
    const fotoPath = `${solicitud.run_id}/${solicitud.signer}-${token}-foto.jpg`;

    const { error: uploadErr } = await supaAdmin.storage
      .from("monitoreo-firmas")
      .upload(objectPath, pngBytes, { contentType: "image/png", upsert: true });
    if (uploadErr) return json({ error: "No se pudo guardar la firma.", details: uploadErr.message }, origin, 500);

    const { error: uploadFotoErr } = await supaAdmin.storage
      .from("monitoreo-firmas")
      .upload(fotoPath, fotoBytes, { contentType: "image/jpeg", upsert: true });
    if (uploadFotoErr) {
      await supaAdmin.storage.from("monitoreo-firmas").remove([objectPath]);
      return json({ error: "No se pudo guardar la foto.", details: uploadFotoErr.message }, origin, 500);
    }

    const signedAt = new Date().toISOString();
    const { error: updSolicitudErr } = await supaAdmin
      .from("firma_solicitud")
      .update({
        status: "firmado",
        signature_path: objectPath,
        foto_path: fotoPath,
        signed_at: signedAt,
        dni_confirmado: dniInput,
        signer_ip: getClientIp(req),
        signer_user_agent: (req.headers.get("User-Agent") ?? "").slice(0, 300),
      })
      .eq("id", solicitud.id);
    if (updSolicitudErr) {
      await supaAdmin.storage.from("monitoreo-firmas").remove([objectPath, fotoPath]);
      return json({ error: "No se pudo registrar la firma.", details: updSolicitudErr.message }, origin, 500);
    }

    const column = solicitud.signer === "docente" ? "docente_firma_path" : "monitor_firma_path";
    const { error: updRunErr } = await supaAdmin
      .from("form_run")
      .update({ [column]: objectPath })
      .eq("id", solicitud.run_id);
    if (updRunErr) return json({ error: "No se pudo enlazar la firma a la ficha.", details: updRunErr.message }, origin, 500);

    return json({ ok: true }, origin);
  } catch (e) {
    return json({ error: "Error interno", details: String(e) }, origin, 500);
  }
});
