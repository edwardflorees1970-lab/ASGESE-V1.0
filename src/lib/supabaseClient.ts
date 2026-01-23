import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl) throw new Error("Falta VITE_SUPABASE_URL en .env");
if (!supabaseAnonKey) throw new Error("Falta VITE_SUPABASE_ANON_KEY en .env");

const projectRef = new URL(supabaseUrl).hostname.split(".")[0];
export const AUTH_STORAGE_KEY = `sb-${projectRef}-auth-token`;

/**
 * Limpia SOLO llaves legacy que ya no debemos usar.
 * ⚠️ NO borra la llave oficial AUTH_STORAGE_KEY, porque eso te rompe la sesión.
 */
export function clearLegacyAuthStorage() {
  try {
    const legacyKeys = ["agebre-auth"]; // tu key antigua

    legacyKeys.forEach((k) => window.localStorage.removeItem(k));
    legacyKeys.forEach((k) => window.sessionStorage.removeItem(k));

    console.log("Legacy auth storage cleared:", legacyKeys);
  } catch (e) {
    console.warn("clearLegacyAuthStorage warning:", e);
  }
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storageKey: AUTH_STORAGE_KEY,
    storage: window.localStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
