import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import type { User, Session } from "@supabase/supabase-js";

export type Profile = {
  id: string;
  email: string | null;
  correo: string | null;
  role: string | null;

  nombres: string | null;
  apellido_paterno: string | null;
  apellido_materno: string | null;

  numero_documento: string | null;
  tipo_documento: string | null;

  area: string | null;
  ugel: string | null;
  rei: string | null;
  can_create_monitoreo: boolean | null;
  must_change_password: boolean | null;
};

type AuthCtx = {
  loading: boolean; // SOLO sesión
  profileLoading: boolean;
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  profileError: string | null;
  modulePermissions: Record<string, { canView: boolean; canManage: boolean }>;
  permissionsLoading: boolean;
  canViewModule: (moduleCode: string) => boolean;
  canManageModule: (moduleCode: string) => boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return v;
}

async function fetchProfile(userId: string) {
  return supabase
    .from("profiles")
    .select(
      "id, email, correo, role, nombres, apellido_paterno, apellido_materno, numero_documento, tipo_documento, area, ugel, rei, can_create_monitoreo, must_change_password"
    )
    .eq("id", userId)
    .maybeSingle();
}

const legacyModulesByRole: Record<string, string[]> = {
  admin: ["inicio", "monitoreo", "seguimiento", "gestion_monitoreos", "asignaciones", "reportes", "reportes_analiticos", "indicadores_cdd", "instituciones", "usuarios", "roles_permisos", "catalogos", "operaciones"],
  jefe_area: ["inicio", "monitoreo", "seguimiento", "gestion_monitoreos", "asignaciones", "reportes", "reportes_analiticos", "indicadores_cdd", "instituciones", "usuarios"],
  director: ["inicio", "monitoreo", "seguimiento", "gestion_monitoreos", "asignaciones", "reportes", "reportes_analiticos", "indicadores_cdd", "instituciones", "usuarios"],
  responsable_cdd: ["inicio", "monitoreo", "reportes", "reportes_analiticos", "indicadores_cdd", "instituciones"],
  director_iiee: ["inicio", "monitoreo", "reportes", "instituciones"],
  user: ["inicio", "monitoreo", "reportes", "reportes_analiticos", "instituciones"],
};

// PREVISUALIZACION LOCAL: activada con VITE_LOCAL_PREVIEW=true.
// Hace un inicio de sesion real (no simulado) contra una cuenta de prueba
// dedicada, usando las credenciales de VITE_LOCAL_PREVIEW_EMAIL /
// VITE_LOCAL_PREVIEW_PASSWORD (solo en .env local, nunca en produccion).
// Asi las llamadas a Supabase corren autenticadas de verdad en local,
// respetando RLS igual que un usuario real.
//
// IMPORTANTE: se exige ademas import.meta.env.DEV (true SOLO con
// `vite dev`, false en cualquier `vite build`) como candado duro. No basta
// con confiar en que .env no tenga esta variable en produccion: un build
// de produccion corrido localmente (`vercel --prod` desde una maquina con
// .env de desarrollo) igual la incluiria en el bundle publico sin este
// candado -- eso ya paso una vez y expuso una contraseña real.
const LOCAL_PREVIEW = import.meta.env.DEV && import.meta.env.VITE_LOCAL_PREVIEW === "true";
const LOCAL_PREVIEW_EMAIL = import.meta.env.VITE_LOCAL_PREVIEW_EMAIL as string | undefined;
const LOCAL_PREVIEW_PASSWORD = import.meta.env.VITE_LOCAL_PREVIEW_PASSWORD as string | undefined;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);

  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [modulePermissions, setModulePermissions] = useState<Record<string, { canView: boolean; canManage: boolean }>>({});
  const [permissionsRole, setPermissionsRole] = useState<string | null>(null);

  const alive = useRef(true);
  const inflight = useRef<Promise<void> | null>(null);
  const currentUserId = useRef<string | null>(null);

  const loadProfile = useCallback(async (uid: string, opts?: { silent?: boolean }) => {
    const silent = Boolean(opts?.silent);
    if (!silent) {
      setProfileLoading(true);
      setProfileError(null);
    }

    const { data, error } = await fetchProfile(uid);

    // Descarta respuestas de una sesión anterior. Sin esta comprobación, una
    // consulta lenta podía aplicar el perfil y los permisos del usuario previo.
    if (!alive.current || currentUserId.current !== uid) return;

    if (error) {
      console.warn("AuthProvider: no se pudo cargar profile:", error.message);
      // En refresh silencioso por foco, conserva el perfil previo para no
      // desmontar vistas protegidas mientras el usuario edita.
      if (!silent) setProfile(null);
      setProfileError(error.message);
    } else {
      setProfile((data as Profile) ?? null);
      setProfileError(null);
    }

    if (!silent) {
      setProfileLoading(false);
    }
  }, []);

  const userId = user?.id;

  useEffect(() => {
    if (!userId || !profile?.role) {
      return;
    }
    let active = true;
    const role = profile.role;
    (async () => {
      const { data, error } = await supabase.rpc("get_my_module_permissions");
      if (!active) return;
      if (!error && data) {
        const next: Record<string, { canView: boolean; canManage: boolean }> = {};
        for (const row of data as Array<{ module_code: string; can_view: boolean; can_manage: boolean }>) {
          next[row.module_code] = { canView: row.can_view, canManage: row.can_manage };
        }
        setModulePermissions(next);
      } else {
        const fallback: Record<string, { canView: boolean; canManage: boolean }> = {};
        for (const code of legacyModulesByRole[role] ?? []) {
          fallback[code] = { canView: true, canManage: role === "admin" };
        }
        setModulePermissions(fallback);
      }
      setPermissionsRole(role);
    })();
    return () => { active = false; };
  }, [profile?.role, userId]);

  const refreshProfile = useCallback(async () => {
    if (!userId) return;
    if (inflight.current) return;

    inflight.current = (async () => {
      await loadProfile(userId, { silent: true });
    })().finally(() => {
      inflight.current = null;
    });
  }, [loadProfile, userId]);

  useEffect(() => {
    if (!userId) return;
    const onFocus = () => refreshProfile();
    window.addEventListener("focus", onFocus);
    const t = window.setTimeout(() => refreshProfile(), 500);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.clearTimeout(t);
    };
  }, [refreshProfile, userId]);

  useEffect(() => {
    alive.current = true;

    (async () => {
      setLoading(true);

      if (LOCAL_PREVIEW) {
        const { data: existing } = await supabase.auth.getSession();
        if (!existing.session) {
          if (LOCAL_PREVIEW_EMAIL && LOCAL_PREVIEW_PASSWORD) {
            const { error: signInError } = await supabase.auth.signInWithPassword({
              email: LOCAL_PREVIEW_EMAIL,
              password: LOCAL_PREVIEW_PASSWORD,
            });
            if (signInError) {
              console.warn("VITE_LOCAL_PREVIEW: no se pudo iniciar sesion con la cuenta de prueba:", signInError.message);
            }
          } else {
            console.warn("VITE_LOCAL_PREVIEW=true pero faltan VITE_LOCAL_PREVIEW_EMAIL / VITE_LOCAL_PREVIEW_PASSWORD en .env");
          }
        }
      }

      // ✅ 1) Solo sesión (rápido)
      const { data, error } = await supabase.auth.getSession();
      if (error) console.warn("AuthProvider getSession error:", error.message);

      const s = data.session ?? null;
      if (!alive.current) return;

      currentUserId.current = s?.user?.id ?? null;
      setSession(s);
      setUser(s?.user ?? null);

      // ✅ suelta la app YA, aunque profile demore/falle
      setLoading(false);

      // ✅ 2) Profile en background
      if (s?.user?.id) {
        loadProfile(s.user.id);
      } else {
        setProfile(null);
        setProfileError(null);
        setProfileLoading(false);
      }
    })();

    // ✅ 3) Cambios de sesión
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      // DIAGNOSTICO TEMPORAL: identificar que evento reestablece la sesion
      // despues de un logout. Quitar una vez resuelto.
      // eslint-disable-next-line no-console
      console.warn("[AUTH-DEBUG]", _event, "sesion:", newSession ? newSession.user?.email : null, "en", new Date().toISOString());
      if (!alive.current) return;

      const nextUserId = newSession?.user?.id ?? null;
      const userChanged = currentUserId.current !== nextUserId;
      currentUserId.current = nextUserId;

      setSession(newSession);
      setUser(newSession?.user ?? null);

      // si hay sesión, NO bloquees app
      setLoading(false);

      if (newSession?.user?.id) {
        if (userChanged) setProfile(null);
        loadProfile(newSession.user.id);
      } else {
        setProfile(null);
        setProfileError(null);
        setProfileLoading(false);
      }
    });

    return () => {
      alive.current = false;
      currentUserId.current = null;
      sub.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const signOut = useCallback(async () => {
    // eslint-disable-next-line no-console
    console.warn("[AUTH-DEBUG] signOut() llamado en", new Date().toISOString());
    // scope "global" revoca el refresh token en el servidor (no solo borra
    // el localStorage de este navegador). Sin esto, una copia del token en
    // otro dispositivo/perfil (ej. perfil de Windows itinerante, sync del
    // navegador) puede seguir refrescando la sesion despues de "cerrar sesion".
    await supabase.auth.signOut({ scope: "global" });
    currentUserId.current = null;
    setSession(null);
    setUser(null);
    setProfile(null);
    setProfileError(null);
    setProfileLoading(false);
    setModulePermissions({});
    setPermissionsRole(null);
  }, []);

  const effectivePermissionsLoading = Boolean(profile?.role) && permissionsRole !== profile?.role;
  const canViewModule = useCallback((moduleCode: string) => profile?.role === "admin" || (permissionsRole === profile?.role && Boolean(modulePermissions[moduleCode]?.canView)), [modulePermissions, permissionsRole, profile?.role]);
  const canManageModule = useCallback((moduleCode: string) => profile?.role === "admin" || (permissionsRole === profile?.role && Boolean(modulePermissions[moduleCode]?.canManage)), [modulePermissions, permissionsRole, profile?.role]);

  const value = useMemo<AuthCtx>(
    () => ({
      loading,
      profileLoading,
      user,
      session,
      profile,
      profileError,
      modulePermissions,
      permissionsLoading: effectivePermissionsLoading,
      canViewModule,
      canManageModule,
      signOut,
      refreshProfile,
    }),
    [loading, profileLoading, user, session, profile, profileError, modulePermissions, effectivePermissionsLoading, canViewModule, canManageModule, signOut, refreshProfile]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

