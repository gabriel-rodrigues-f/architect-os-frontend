import { PublicReach } from "./public-reach";

export type Theme = "light" | "dark" | "system";

/**
 * A ESCOLHA DE TEMA, num objeto que o provedor (depois da hidratação) e o
 * script pré-paint (antes dela) leem igual — [FA-09]. Antes, o `<html>` saía
 * do servidor sem classe, a página pintava clara e só o `useEffect` do
 * `ThemeProvider` a escurecia: a piscada de tema a cada carga.
 *
 * O script embutido no `<head>` roda antes do primeiro paint: lê a
 * preferência salva (`synapse:theme`, ou a chave legada), consulta o
 * `prefers-color-scheme` quando ela é "system" e escreve a classe `dark` no
 * `<html>`. Numa rota pública (`PublicReach`) força o escuro — a tela de
 * porta é sempre escura (dono, 2026-09-08), e o `DarkStage` continua
 * segurando isso depois da hidratação. A CSP já admite `'unsafe-inline'`
 * em `script-src` (`start.ts`); no dia em que houver nonce, este script
 * recebe o mesmo.
 */
export class ThemeChoice {
  static readonly STORAGE_KEY = "synapse:theme";
  static readonly LEGACY_STORAGE_KEY = "architect-os:theme";
  static readonly DARK_CLASS = "dark";

  static parse(raw: string | null | undefined): Theme {
    return raw === "light" || raw === "dark" ? raw : "system";
  }

  static resolve(theme: Theme, prefersDark: boolean): "light" | "dark" {
    if (theme === "system") return prefersDark ? "dark" : "light";
    return theme;
  }

  /** O que a primeira pintura mostra: escuro na porta; fora dela, a preferência. */
  static firstPaint(input: {
    stored: string | null;
    prefersDark: boolean;
    pathname: string;
    publicReach?: PublicReach;
  }): "light" | "dark" {
    const publicReach = input.publicReach ?? new PublicReach();
    if (publicReach.covers(input.pathname)) return "dark";
    return ThemeChoice.resolve(ThemeChoice.parse(input.stored), input.prefersDark);
  }

  /**
   * O script pré-paint, em JavaScript puro (sem bundler, sem módulo): a
   * mesma decisão de `firstPaint`, escrita para rodar no `<head>`. Engole o
   * `localStorage` bloqueado — a página abre igual, na preferência do sistema.
   */
  static preambleScript(): string {
    const publicRoutes = JSON.stringify(PublicReach.ROUTES);
    return [
      "(function(){",
      "try{",
      `var p=location.pathname;if(p.length>1&&p.slice(-1)==="/")p=p.slice(0,-1);`,
      `var dark=${publicRoutes}.indexOf(p)!==-1;`,
      "if(!dark){",
      `var t=null;try{t=localStorage.getItem(${JSON.stringify(ThemeChoice.STORAGE_KEY)})||localStorage.getItem(${JSON.stringify(ThemeChoice.LEGACY_STORAGE_KEY)});}catch(e){}`,
      `dark=t==="dark"||(t!=="light"&&window.matchMedia("(prefers-color-scheme: dark)").matches);`,
      "}",
      `document.documentElement.classList.toggle(${JSON.stringify(ThemeChoice.DARK_CLASS)},dark);`,
      "}catch(e){}",
      "})();",
    ].join("");
  }
}
