import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";

type AppConfigCtx = {
  loading: boolean;
  isTestMode: boolean;
  refresh: () => Promise<void>;
  setMode: (mode: "test" | "prod") => Promise<void>;
};

const Ctx = createContext<AppConfigCtx | null>(null);

async function fetchMode(): Promise<boolean> {
  const { data, error } = await supabase
    .from("app_config")
    .select("value")
    .eq("key", "modo_test")
    .maybeSingle();

  if (error) {
    console.warn("app_config: no se pudo leer modo_test:", error.message);
    return false;
  }
  const raw = String((data as any)?.value ?? "").toLowerCase();
  return raw === "true" || raw === "1" || raw === "si" || raw === "sí";
}

export function AppConfigProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [isTestMode, setIsTestMode] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try {
      const v = await fetchMode();
      setIsTestMode(v);
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
