import type { CareerLevel, Professional, TeamLevelRule } from "../domain";
import { TeamLeadershipRoles } from "../gateways/auth.gateway";
import type { TeamSummary } from "../gateways/teams.gateway";
import type { TeamLeadershipBoard } from "./team-leadership";
import type { TeamRegistryViewModel } from "./team-registry-view-model";

/**
 * O QUE FALTA PARA UM TIME FUNCIONAR — as quatro pendências do cadastro.
 *
 * Três vieram da sugestão de tela (dono, 2026-09-10): time sem gerente, sem
 * tech lead e sem gente ativa. **A quarta não estava na foto e é a que mais
 * pesa**: time sem RÉGUA para todos os níveis de carreira. Foi a falta da
 * régua do Trainee que derrubou PDI, Avaliação e 1:1 na manhã de 2026-09-09,
 * e depois que a REGRA 19 matou a escada configurável ("todos os times terão
 * os 5 níveis") não sobrou nada segurando o invariante — ele passou a ser do
 * cadastro do time, e nada na tela mostrava o furo.
 *
 * A régua NÃO é "cinco" escrito à mão: é UMA por nível do catálogo de
 * carreira. Fixar o número aqui seria a mesma escada que a regra 19 matou,
 * agora em constante.
 */
export const TEAM_PENDENCY_KINDS = ["manager", "techLead", "people", "levelRules"] as const;

export type TeamPendencyKind = (typeof TEAM_PENDENCY_KINDS)[number];

export class TeamPendency {
  constructor(
    readonly kind: TeamPendencyKind,
    readonly teams: readonly TeamSummary[],
  ) {}

  get count(): number {
    return this.teams.length;
  }

  /** A régua se revisa em outra tela (Perfil de Competências do Time); o resto, no Quadro. */
  get reviewedInTeamRules(): boolean {
    return this.kind === "levelRules";
  }
}

export class TeamConfiguration {
  /**
   * `teams` já chega RECORTADO pelo alcance de quem lê (`reachableTeams`) e
   * pelos ATIVOS: contar time desativado como pendente seria cobrar conserto
   * de quem já saiu de cena, e contar time fora do alcance revelaria a
   * existência de time que a pessoa não pode ver.
   */
  constructor(
    private readonly teams: readonly TeamSummary[],
    private readonly leadership: TeamLeadershipBoard,
    private readonly professionals: readonly Professional[],
    private readonly levelRules: readonly TeamLevelRule[],
    private readonly careerLevels: readonly CareerLevel[],
    private readonly registry: TeamRegistryViewModel,
  ) {}

  /**
   * Sem os quadros lidos e sem o catálogo de níveis não há o que afirmar —
   * contador que nasce em zero enquanto a leitura chega diz "está tudo certo"
   * de um time que pode estar furado.
   */
  get readable(): boolean {
    return this.leadership.settledOver(this.teams) && this.careerLevels.length > 0;
  }

  pendencies(): TeamPendency[] {
    return [
      new TeamPendency(
        "manager",
        this.leadership.teamsLacking(TeamLeadershipRoles.MANAGER, this.teams),
      ),
      new TeamPendency(
        "techLead",
        this.leadership.teamsLacking(TeamLeadershipRoles.TECH_LEAD, this.teams),
      ),
      new TeamPendency("people", this.teamsWithoutActivePeople()),
      new TeamPendency("levelRules", this.teamsWithoutRuleForEveryLevel()),
    ];
  }

  /** ZERO pendência é ESTADO BOM, e a tela o diz — não é um vazio. */
  get clear(): boolean {
    return this.pendencies().every((pendency) => pendency.count === 0);
  }

  private teamsWithoutActivePeople(): TeamSummary[] {
    return this.teams.filter(
      (team) => this.registry.activePeopleOf(team.id, this.professionals).length === 0,
    );
  }

  private teamsWithoutRuleForEveryLevel(): TeamSummary[] {
    return this.teams.filter((team) =>
      this.careerLevels.some(
        (level) =>
          !this.levelRules.some(
            (rule) => rule.teamId === team.id && rule.careerLevelId === level.id,
          ),
      ),
    );
  }
}
