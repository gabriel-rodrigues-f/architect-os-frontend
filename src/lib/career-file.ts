import type { MessageKey } from "./i18n";

export const CAREER_FILE_TABS = ["overview", "evolution", "statement", "roadmap"] as const;
export type CareerFileTab = (typeof CAREER_FILE_TABS)[number];

/**
 * AS ABAS DA FICHA — Visão geral, Evolução, Extrato, Roteiro — como
 * vocabulário: qual aba a URL abre, que título e que ajuda cada uma tem.
 * A rota-pai da ficha ([FA-08]) lê daqui o que precisa para desenhar o
 * cabeçalho fixo e a negativa de alcance UMA vez, em vez de cada aba montar
 * a mesma composição.
 */
export class CareerFileTabs {
  static readonly ALL = CAREER_FILE_TABS;

  /** `/architects/ana/evolution` → `evolution`; `/architects/ana` (com ou sem barra) → `overview`. */
  static fromPathname(pathname: string): CareerFileTab {
    const ultimo = pathname.replace(/\/+$/, "").split("/").pop() ?? "";
    return CareerFileTabs.includes(ultimo) && ultimo !== "overview" ? ultimo : "overview";
  }

  static includes(value: string): value is CareerFileTab {
    return (CAREER_FILE_TABS as readonly string[]).includes(value);
  }

  static titleKeyOf(tab: CareerFileTab): MessageKey {
    return TITLE_KEY[tab];
  }

  static helpKeyOf(tab: CareerFileTab): CareerFileHelpKey {
    return HELP_KEY[tab];
  }

  /**
   * Evolução, Extrato e Roteiro são da própria pessoa e de quem a lidera; a
   * Visão geral abre para quem lê a ficha — a rota-pai só pergunta o alcance
   * das abas quando a URL é de uma delas.
   */
  static isLeadershipTab(tab: CareerFileTab): boolean {
    return tab !== "overview";
  }
}

export type CareerFileHelpKey =
  "architectProfile" | "architectEvolution" | "architectStatement" | "architectRoadmap";

const TITLE_KEY: Record<CareerFileTab, MessageKey> = {
  overview: "arch.tabs.overview",
  evolution: "arch.tabs.evolution",
  statement: "arch.tabs.statement",
  roadmap: "arch.tabs.roadmap",
};

const HELP_KEY: Record<CareerFileTab, CareerFileHelpKey> = {
  overview: "architectProfile",
  evolution: "architectEvolution",
  statement: "architectStatement",
  roadmap: "architectRoadmap",
};
