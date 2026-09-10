import type { TeamLevelRule } from "../domain";

/**
 * O PISO DO MODELO MORREU AQUI (dono, 2026-09-10): *"Remova os critérios de
 * elegibilidade… não quero mais cravar na pedra 'para ser júnior precisa de 1
 * capacidade'."* Saíram `QualifiedCapabilityMinimum` (a régua do número),
 * `ReadyCompetencyShortfall` (o "faltam N competências prontas" que travava o
 * salvar), `ProgressionMinimumReading` e o `ProgressionMinimumPresenter`
 * inteiro — todos existiam para ler, comparar e exibir esse número.
 *
 * O que sobrou é o RECORTE POR TIME, que não tem nada a ver com veredito: ele
 * responde "de qual time é a régua que estou vendo?" e serve o seletor da
 * tela.
 */
export interface ProgressionPolicyTeam {
  readonly id: string;
  readonly name: string;
}

export class ProgressionPolicyScope {
  static readonly ALL_TEAMS_CHOICE = "todos-os-times";

  private constructor(readonly team: ProgressionPolicyTeam | undefined) {}

  static allTeams(): ProgressionPolicyScope {
    return new ProgressionPolicyScope(undefined);
  }

  static ofTeam(team: ProgressionPolicyTeam): ProgressionPolicyScope {
    return new ProgressionPolicyScope(team);
  }

  static fromChoice(
    choice: string,
    teams: readonly ProgressionPolicyTeam[],
  ): ProgressionPolicyScope {
    const team = teams.find((candidate) => candidate.id === choice);
    return team ? ProgressionPolicyScope.ofTeam(team) : ProgressionPolicyScope.allTeams();
  }

  static choosable(
    teams: readonly { id: string; name: string; active: boolean }[],
    configurable: (teamId: string) => boolean,
  ): ProgressionPolicyTeam[] {
    return teams
      .filter((team) => team.active && configurable(team.id))
      .map((team) => ({ id: team.id, name: team.name }));
  }

  get choice(): string {
    return this.team?.id ?? ProgressionPolicyScope.ALL_TEAMS_CHOICE;
  }

  includes(rule: TeamLevelRule): boolean {
    return this.team === undefined || rule.teamId === this.team.id;
  }
}
