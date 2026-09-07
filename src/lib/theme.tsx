import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { readMigratedItem } from "./storage";

export type Theme = "light" | "dark" | "system";

const STORAGE_KEY = "synapse:theme";
const LEGACY_STORAGE_KEY = "architect-os:theme";

interface ThemeApi {
  theme: Theme;

  resolved: "light" | "dark";
  setTheme: (theme: Theme) => void;
  /**
   * Segura o documento no escuro enquanto quem chamou estiver montado.
   * Devolve a função que solta. Dono (2026-09-08): "a tela inicial do
   * Synapse é sempre escura… o tema só é aplicado depois de realizado o
   * login" — a preferência continua salva e volta a valer quando o palco sai.
   */
  holdDark: () => () => void;
}

const Ctx = createContext<ThemeApi | null>(null);

const prefersDark = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("system");
  const [resolved, setResolved] = useState<"light" | "dark">("light");
  const [darkHolds, setDarkHolds] = useState(0);
  const holds = useRef(0);

  const apply = useCallback((next: Theme) => {
    const preferido = next === "system" ? (prefersDark() ? "dark" : "light") : next;
    const efetivo = holds.current > 0 ? "dark" : preferido;
    document.documentElement.classList.toggle("dark", efetivo === "dark");
    setResolved(efetivo);
  }, []);

  const holdDark = useCallback(() => {
    holds.current += 1;
    setDarkHolds(holds.current);
    let released = false;
    return () => {
      if (released) return;
      released = true;
      holds.current -= 1;
      setDarkHolds(holds.current);
    };
  }, []);

  // Cada entrada ou saída de palco reaplica o tema — com a preferência de
  // sempre, que nunca deixou de estar salva.
  useEffect(() => {
    apply(theme);
  }, [darkHolds, theme, apply]);

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

  return <Ctx.Provider value={{ theme, resolved, setTheme, holdDark }}>{children}</Ctx.Provider>;
}

/** O tema, se houver provedor — para quem só ajusta o palco e não pode exigir um. */
export function useThemeIfAny(): ThemeApi | null {
  return useContext(Ctx);
}

export function useTheme(): ThemeApi {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useTheme precisa estar dentro de ThemeProvider");
  return ctx;
}
