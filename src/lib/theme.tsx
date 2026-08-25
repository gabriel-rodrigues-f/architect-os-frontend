import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

import { readMigratedItem } from "./storage";

/**
 * Tema da interface. "system" segue a preferência do sistema operacional e é o
 * padrão — só vira claro ou escuro quando a pessoa escolhe explicitamente.
 *
 * O CSS já traz a paleta escura no bloco `.dark`; aqui só decidimos quando a
 * classe entra no `<html>`.
 */
export type Theme = "light" | "dark" | "system";

const STORAGE_KEY = "synapse:theme";
const LEGACY_STORAGE_KEY = "architect-os:theme";

interface ThemeApi {
  theme: Theme;
  /** O que está de fato aplicado agora — resolve "system". */
  resolved: "light" | "dark";
  setTheme: (theme: Theme) => void;
}

const Ctx = createContext<ThemeApi | null>(null);

const prefersDark = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;

export function ThemeProvider({ children }: { children: ReactNode }) {
  /**
   * Começa em "system" e só lê a preferência depois da montagem: no SSR não há
   * `localStorage` nem `matchMedia`, e decidir no primeiro render quebraria a
   * hidratação.
   */
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

  // Em "system", acompanha a troca no SO sem exigir recarregar a página.
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
