import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import type { User, Session } from "@supabase/supabase-js";

export type Profile = {
  id: string;
  email: string | null;
  correo: string | null;
  role: "admin" | "user" | "jefe_area" | "director" | "responsable_cdd" | null;

  nombres: string | null;
  apellido_paterno: string | null;
  apellido_materno: string | null;

  numero_documento: string | null;
  tipo_documento: string | null;

  area: string | null;
  ugel: string | null;
  rei: string | null;
  can_create_monitoreo: boolean | null;
};

type AuthCtx = {
  loading: boolean; // SOLO sesión
  profileLoading: boolean;
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  profileError: string | null;
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
      "id, email, correo, role, nombres, apellido_paterno, apellido_materno, numero_documento, tipo_documento, area, ugel, rei, can_create_monitoreo"
    )
    .eq("id", userId)
    .maybeSingle();
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);

  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

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
    await supabase.auth.signOut();
    currentUserId.current = null;
    setSession(null);
    setUser(null);
    setProfile(null);
    setProfileError(null);
    setProfileLoading(false);
  }, []);

  const value = useMemo<AuthCtx>(
    () => ({
      loading,
      profileLoading,
      user,
      session,
      profile,
      profileError,
      signOut,
      refreshProfile,
    }),
    [loading, profileLoading, user, session, profile, profileError, signOut, refreshProfile]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

