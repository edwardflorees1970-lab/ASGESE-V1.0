import { supabase } from "./supabaseClient";

/** Tipos */
export type UsersListQuery = {
  q?: string;
  rol?: "admin" | "user" | "jefe_area" | "director";
  area?: string;
  ugel?: string;
  page?: number;
  pageSize?: number;
};

export type ProfileRow = {
  id: string;
  tipo_documento: string;
  numero_documento: string;
  apellido_paterno: string;
  apellido_materno: string;
  nombres: string;
  correo: string;
  telefono: string | null;
  fecha_nacimiento: string | null;
  cargo: string | null;
  area: string | null;
  comision: string | null;
  ugel: string | null;
  // OJO: en BD es "role", pero en el frontend usamos "rol"
  rol: "admin" | "user" | "jefe_area" | "director";
  created_at?: string;
  updated_at?: string;
};

export type AdminCreateUserInput = {
  tipo_documento: "DNI" | "CE";
  numero_documento: string;
  apellido_paterno: string;
  apellido_materno: string;
  nombres: string;
  correo: string;
  telefono?: string | null;
  fecha_nacimiento?: string | null;
  cargo?: string | null;
  area?: string | null;
  comision?: string | null;
  ugel?: string | null;
  rol: "admin" | "user" | "jefe_area" | "director";
  password: string;
};

type Ok<T> = T;

async function getAccessTokenOrThrow() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw new Error(`Auth: ${error.message}`);
  const token = data.session?.access_token;
  if (!token) throw new Error("No hay sesión activa (token vacío). Vuelve a iniciar sesión.");
  return token;
}

async function callFn<T>(name: string, body?: any): Promise<Ok<T>> {
  const token = await getAccessTokenOrThrow();

  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${name}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body ?? {}),
  });

  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    // no-op
  }

  if (!res.ok) {
    const detail = json ? JSON.stringify(json) : text;
    throw new Error(`EdgeFn ${name} -> ${res.status} ${detail}`);
  }

  return (json ?? {}) as T;
}

/** API */
export async function adminUsersList(query: UsersListQuery) {
  return callFn<{
    ok: true;
    page: number;
    pageSize: number;
    total: number;
    items: ProfileRow[];
  }>("admin-users-list", query);
}

export async function adminCreateUser(input: AdminCreateUserInput) {
  return callFn<{ ok: boolean; warning?: string }>("admin-create-user", input);
}

export async function adminUsersUpdate(payload: any) {
  return callFn<{ ok: boolean; warning?: string; details?: string }>(
    "admin-users-update",
    payload
  );
}

export async function adminUsersDelete(id: string) {
  return callFn<{ ok: boolean }>("admin-users-delete", { id });
}

/**
 * RESET PASSWORD (compat):
 * Mandamos userId/user_id y password/new_password para que calce con tu EdgeFn.
 * OJO: no validamos mínimo aquí para no bloquear por bug de UI.
 */
export async function adminResetPassword(userId: string, newPassword: string) {
  const uid = String(userId ?? "").trim();
  const pwd = String(newPassword ?? "");

  if (!uid) throw new Error("adminResetPassword: userId requerido");

  return callFn<{ ok: boolean }>("admin-reset-password", {
    userId: uid,
    user_id: uid,
    password: pwd,
    new_password: pwd,
  });
}
