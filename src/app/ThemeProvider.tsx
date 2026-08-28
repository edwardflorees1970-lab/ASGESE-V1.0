import { createContext, useContext, useEffect, useMemo, useState } from "react";

type Theme = "dark" | "light";
export type Palette = "azul" | "dorado";

type ThemeCtx = {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggleTheme: () => void;
  palette: Palette;
  setPalette: (p: Palette) => void;
};

const Ctx = createContext<ThemeCtx | null>(null);

function getInitialTheme(): Theme {
  if (typeof window === "undefined") return "light";
  const stored = window.localStorage.getItem("theme");
  return stored === "dark" ? "dark" : "light";
}

function getInitialPalette(): Palette {
  if (typeof window === "undefined") return "azul";
  const stored = window.localStorage.getItem("palette");
  return stored === "dorado" ? "dorado" : "azul";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);
  const [palette, setPalette] = useState<Palette>(getInitialPalette);

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-theme", theme);
    window.localStorage.setItem("theme", theme);
  }, [theme]);

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-palette", palette);
    window.localStorage.setItem("palette", palette);
  }, [palette]);

  const value = useMemo<ThemeCtx>(
    () => ({
      theme,
      setTheme,
      toggleTheme: () => setTheme((t) => (t === "dark" ? "light" : "dark")),
      palette,
      setPalette,
    }),
    [theme, palette]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTheme() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useTheme debe usarse dentro de ThemeProvider");
  return v;
}
