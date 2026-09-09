import type { TeamSummary } from "../gateways/teams.gateway";

/**
 * O NOME do time a partir do identificador — num lugar só.
 *
 * Regra de reuso (2 ocorrências = componente): `TeamViewModel.teamNameOf` e
 * `TeamRegistryViewModel.teamNameOf` já eram a MESMA busca linear, letra por
 * letra, e a Calibração ia ser a terceira. Antes dela, a tela mostrava
 * `seed-completo-time-dados` no lugar de "Dados e Inteligência" — o
 * identificador interno vazando para quem lê.
 *
 * `nameOf` devolve `null` para quem não conhece, e NUNCA o identificador de
 * volta: quem chama decide o que pôr no lugar (o nome do vazio, um traço, ou
 * nada), e nenhuma tela herda o vazamento por descuido. `allOf` existe porque
 * um avaliador pode liderar mais de um time — e ali o que não se sabe nomear
 * simplesmente não entra na linha.
 */
export class TeamNames {
  private readonly byId: ReadonlyMap<string, string>;

  private constructor(teams: readonly TeamSummary[]) {
    this.byId = new Map(teams.map((team) => [team.id, team.name]));
  }

  static of(teams: readonly TeamSummary[]): TeamNames {
    return new TeamNames(teams);
  }

  nameOf(teamId: string | null | undefined): string | null {
    if (teamId === null || teamId === undefined) return null;
    return this.byId.get(teamId) ?? null;
  }

  allOf(teamIds: readonly string[]): string[] {
    return teamIds
      .map((teamId) => this.nameOf(teamId))
      .filter((name): name is string => name !== null);
  }
}
