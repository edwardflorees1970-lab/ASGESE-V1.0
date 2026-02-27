import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";

type AppConfigCtx = {
  loading: boolean;
  isTestMode: boolean;
  refresh: () => Promise<void>;
  setMode: (mode: "test" | "prod") => Promise<void>;
};

const Ctx = createContext<AppConfigCtx | null>(null);

function parseMode(value: unknown): boolean {
  const raw = String(value ?? "").toLowerCase();
  return raw === "true" || raw === "1" || raw === "si" || raw === "sí";
}

async function fetchMode(): Promise<boolean | null> {
  const { data, error } = await supabase
    .from("app_config")
    .select("value")
    .eq("key", "modo_test")
    .maybeSingle();

  if (error) {
    console.warn("app_config: no se pudo leer modo_test:", error.message);
    return null;
  }
  return parseMode((data as any)?.value);
}

export function AppConfigProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [isTestMode, setIsTestMode] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try {
      const v = await fetchMode();
      if (v !== null) {
        setIsTestMode(v);
      }
    } finally {
      setLoading(false);
    }
  };

  const setMode = async (mode: "test" | "prod") => {
    const value = mode === "test" ? "true" : "false";
    const { error } = await supabase
      .from("app_config")
      .upsert({ key: "modo_test", value }, { onConflict: "key" });
    if (error) throw new Error(error.message);
    setIsTestMode(mode === "test");
  };

  useEffect(() => {
    refresh();

    // Relee modo cuando se establece/actualiza sesión para evitar estado
    // inicial incorrecto al entrar (ej. mostrar PROD hasta refrescar).
    const { data: authSub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        refresh();
      }
    });

    return () => {
      authSub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel("app_config_modo_test")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "app_config",
          filter: "key=eq.modo_test",
        },
        (payload) => {
          const next = parseMode((payload.new as any)?.value);
          setIsTestMode(next);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        refresh();
      }
    };
    const interval = setInterval(() => {
      refresh();
    }, 30000);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  const value = useMemo<AppConfigCtx>(
    () => ({ loading, isTestMode, refresh, setMode }),
    [loading, isTestMode]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAppConfig() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAppConfig debe usarse dentro de AppConfigProvider");
  return v;
}
