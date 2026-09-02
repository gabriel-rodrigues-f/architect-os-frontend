import { screen } from "@testing-library/react";

import type { AppState } from "@/lib/api";
import type { TeamLevelRule } from "@/lib/domain";
import { fixtureState, fixtureTeamId } from "./fixtures";
import { apiPath } from "@/lib/api-path";
import { jsonResponse, type FetchRoute } from "./render-app";

/**
 * Os níveis de carreira com os nomes que o dono pediu na onda 32 — Júnior,
 * Pleno e Sênior. Os IDs não mudam: são identificadores, referenciados por
 * dezenas de chaves estrangeiras; o NOME é dado, e é o que muda.
 */
export const NIVEL_JUNIOR = "arquiteto-de-solucoes-i";
export const NIVEL_PLENO = "arquiteto-de-solucoes-ii";
export const NIVEL_SENIOR = "arquiteto-de-solucoes-iii";

export const niveisDeCarreira = [
  { id: NIVEL_JUNIOR, name: "Júnior", rank: 1 },
  { id: NIVEL_PLENO, name: "Pleno", rank: 2 },
  { id: NIVEL_SENIOR, name: "Sênior", rank: 3 },
] as const;

export const niveisDeCarreiraRoute: FetchRoute = (href) =>
  href.endsWith(apiPath("/career-levels")) ? jsonResponse(niveisDeCarreira) : undefined;

export const TIME_PLATAFORMA = fixtureTeamId;
export const TIME_INTEGRACOES = "time-integracoes";

export const doisTimesRoute: FetchRoute = (href) =>
  href.endsWith(apiPath("/teams"))
    ? jsonResponse([
        { id: TIME_PLATAFORMA, name: "Plataforma", active: true },
        { id: TIME_INTEGRACOES, name: "Integrações", active: true },
      ])
    : undefined;

export const regra = (
  id: string,
  teamId: string,
  minimo: number,
  careerLevelId: string = NIVEL_JUNIOR,
): TeamLevelRule => ({
  id,
  teamId,
  careerLevelId,
  minimumQualifiedCapabilities: minimo,
});

/** O `/state` que o servidor manda para quem alcança N times, só com as réguas dadas. */
export const estadoCom = (regras: readonly TeamLevelRule[]): AppState => ({
  ...fixtureState,
  teamLevelRules: [...regras],
});

/**
 * Onda 35, item 12 — o mínimo não pode passar do que existe pronto. A fixture
 * base tem 2 capacidades prontas; um teste que grava mínimo maior precisa
 * declarar quantas prontas existem, senão a tela apaga o Salvar de propósito.
 */
export const capacidadesProntas = (quantas: number): AppState["capabilities"] =>
  Array.from({ length: quantas }, (_, indice) => ({
    id: `pronta-${indice + 1}`,
    name: `Capacidade pronta ${indice + 1}`,
    short: `P${indice + 1}`,
    active: true,
    curation: { activeCompetencyCount: 2, status: "READY" as const },
  }));

export async function linhaDoNivel(nivel = "Júnior"): Promise<HTMLTableRowElement> {
  const nome = await screen.findByText(nivel);
  return nome.closest("tr") as HTMLTableRowElement;
}

/** A célula do mínimo na linha do nível de carreira. */
export async function celulaDoMinimo(nivel = "Júnior"): Promise<HTMLElement> {
  const linha = await linhaDoNivel(nivel);
  return linha.querySelectorAll("td")[1] as HTMLElement;
}
