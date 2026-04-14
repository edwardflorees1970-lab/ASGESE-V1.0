import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
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

  const loadProfile = async (uid: string) => {
    setProfileLoading(true);
    setProfileError(null);

    const { data, error } = await fetchProfile(uid);

    if (!alive.current) return;

    if (error) {
      console.warn("AuthProvider: no se pudo cargar profile:", error.message);
      setProfile(null);
      setProfileError(error.message);
    } else {
      setProfile((data as Profile) ?? null);
      setProfileError(null);
    }

    setProfileLoading(false);
  };

  const refreshProfile = async () => {
    if (!user?.id) return;
    if (inflight.current) return;

    inflight.current = (async () => {
      await loadProfile(user.id);
    })().finally(() => {
      inflight.current = null;
    });
  };

  useEffect(() => {
    if (!user?.id) return;
    const onFocus = () => refreshProfile();
    window.addEventListener("focus", onFocus);
    const t = window.setTimeout(() => refreshProfile(), 500);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.clearTimeout(t);
    };
  }, [user?.id]);

  useEffect(() => {
    alive.current = true;

    (async () => {
      setLoading(true);

      // ✅ 1) Solo sesión (rápido)
      const { data, error } = await supabase.auth.getSession();
      if (error) console.warn("AuthProvider getSession error:", error.message);

      const s = data.session ?? null;
      if (!alive.current) return;

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

      setSession(newSession);
      setUser(newSession?.user ?? null);

      // si hay sesión, NO bloquees app
      setLoading(false);

      if (newSession?.user?.id) {
        loadProfile(newSession.user.id);
      } else {
        setProfile(null);
        setProfileError(null);
        setProfileLoading(false);
      }
    });

    return () => {
      alive.current = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setProfile(null);
    setProfileError(null);
    setProfileLoading(false);
  };

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
    [loading, profileLoading, user, session, profile, profileError]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

