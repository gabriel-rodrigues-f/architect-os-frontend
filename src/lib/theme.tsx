import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

import { readMigratedItem } from "./storage";

export type Theme = "light" | "dark" | "system";

const STORAGE_KEY = "synapse:theme";
const LEGACY_STORAGE_KEY = "architect-os:theme";

interface ThemeApi {
  theme: Theme;

  resolved: "light" | "dark";
  setTheme: (theme: Theme) => void;
}

const Ctx = createContext<ThemeApi | null>(null);

const prefersDark = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("system");
  const [resolved, setResolved] = useState<"light" | "dark">("light");

  const apply = useCallback((next: Theme) => {
    const efetivo = next === "system" ? (prefersDark() ? "dark" : "light") : next;
    document.documentElement.classList.toggle("dark", efetivo === "dark");
    setResolved(efetivo);
  }, []);

  useEffect(() => {
    const salvo = readMigratedItem(STORAGE_KEY, LEGACY_STORAGE_KEY) as Theme | null;
    const inicial: Theme = salvo === "light" || salvo === "dark" ? salvo : "system";
    setThemeState(inicial);
    apply(inicial);
  }, [apply]);

  useEffect(() => {
    if (theme !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => apply("system");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [theme, apply]);

  const setTheme = useCallback(
    (next: Theme) => {
      setThemeState(next);
      window.localStorage.setItem(STORAGE_KEY, next);
      apply(next);
    },
    [apply],
  );

  return <Ctx.Provider value={{ theme, resolved, setTheme }}>{children}</Ctx.Provider>;
}

export function useTheme(): ThemeApi {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useTheme precisa estar dentro de ThemeProvider");
  return ctx;
}
