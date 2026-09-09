import type { MessageKey } from "./i18n";

export const CAREER_FILE_TABS = ["overview", "evolution", "statement", "roadmap"] as const;
export type CareerFileTab = (typeof CAREER_FILE_TABS)[number];

/**
 * AS ABAS DA FICHA — Visão geral, Evolução, Extrato, Roteiro — como
 * vocabulário: qual aba a URL abre, que título e que ajuda cada uma tem.
 * A rota-pai da ficha ([FA-08]) lê daqui o que precisa para desenhar o
 * cabeçalho fixo e a negativa de alcance UMA vez, em vez de cada aba montar
 * a mesma composição.
 *
 * `isLeadershipTab` MORREU aqui: ela dizia que a pergunta de alcance valia só
 * para Evolução, Extrato e Roteiro, e a Visão geral abria para qualquer
 * sessão — segurada apenas pela recusa do servidor nas listagens por pessoa.
 * Com essas listagens respondendo `200 []` em vez de `403`, a Visão geral
 * abriria ZERADA sobre quem não se alcança. A pergunta passou a ser uma só,
 * para as quatro abas, na rota-pai.
 */
export class CareerFileTabs {
  static readonly ALL = CAREER_FILE_TABS;

  /** `/professionals/ana/evolution` → `evolution`; `/professionals/ana` (com ou sem barra) → `overview`. */
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
}

export type CareerFileHelpKey =
  "professionalProfile" | "professionalEvolution" | "professionalStatement" | "professionalRoadmap";

const TITLE_KEY: Record<CareerFileTab, MessageKey> = {
  overview: "arch.tabs.overview",
  evolution: "arch.tabs.evolution",
  statement: "arch.tabs.statement",
  roadmap: "arch.tabs.roadmap",
};

const HELP_KEY: Record<CareerFileTab, CareerFileHelpKey> = {
  overview: "professionalProfile",
  evolution: "professionalEvolution",
  statement: "professionalStatement",
  roadmap: "professionalRoadmap",
};
