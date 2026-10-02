// Borrador local (localStorage) de la ficha dinámica.
//
// El snapshot solo se escribe tras una edición real del usuario y guarda la
// versión del registro en servidor sobre la que se trabajó (updated_at, o
// created_at si no hay updated_at). Al volver a cargar, el snapshot solo se
// aplica si el servidor no cambió desde entonces: si hay una versión más
// nueva (otro dispositivo, otra pestaña, un envío ya hecho) gana el servidor.

export type LocalDraftSnapshot<H = unknown, F = unknown> = {
  /** Registro de servidor sobre el que se editó (null = ficha nueva). */
  runId: string | null;
  /** updated_at/created_at de ese registro cuando se cargó/guardó. */
  serverUpdatedAt?: string | null;
  header: H;
  footer: F;
  answers: Record<string, unknown>;
  updatedAt: string;
};

/** Lee y valida el snapshot; devuelve null (y lo borra) si está corrupto. */
export function readLocalDraft<H, F>(storage: Storage, key: string): LocalDraftSnapshot<H, F> | null {
  let raw: string | null = null;
  try {
    raw = storage.getItem(key);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as LocalDraftSnapshot<H, F>;
    if (parsed && typeof parsed === "object" && parsed.updatedAt) return parsed;
  } catch {
    // cae al borrado de abajo
  }
  try {
    storage.removeItem(key);
  } catch {
    // ignore
  }
  return null;
}

function toTime(value: string | null | undefined): number | null {
  if (!value) return null;
  const t = new Date(value).getTime();
  return Number.isFinite(t) ? t : null;
}

/**
 * Decide si el snapshot local puede aplicarse sobre lo que devolvió el servidor.
 * - server = null: no hay registro en servidor. Solo vale un snapshot de una
 *   ficha nueva (runId null); si apuntaba a un registro que ya no está como
 *   borrador (enviado/eliminado), está obsoleto.
 * - server presente: el snapshot debe ser del mismo registro y su versión base
 *   no puede ser anterior a la del servidor. Sin versión comparable, gana el
 *   servidor.
 */
export function isLocalDraftUsable(
  snapshot: Pick<LocalDraftSnapshot, "runId" | "serverUpdatedAt">,
  server: { id: string; version: string | null } | null
): boolean {
  if (!server) return !snapshot.runId;
  if (snapshot.runId && snapshot.runId !== server.id) return false;
  const serverTime = toTime(server.version);
  const baseTime = toTime(snapshot.serverUpdatedAt);
  if (serverTime === null) {
    // El servidor no expone versión: solo se acepta si el snapshot tampoco
    // tenía una (misma base desconocida) y apunta explícitamente al registro.
    return snapshot.runId === server.id && baseTime === null;
  }
  if (baseTime === null) return false;
  return serverTime <= baseTime;
}
