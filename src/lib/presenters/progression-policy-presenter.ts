import type { TeamLevelRule } from "../domain";
import type { MessageKey } from "../i18n";

/**
 * Onda 36.1 — pedido do dono: *"a quantidade de capacidades minima de um time
 * não pode ser 3, tem que ser 1."* Este é o piso do MODELO, espelho do
 * `career.schemas` do backend (`minimumQualifiedCapabilities` inteiro >= 1).
 *
 * Não confundir com `career.minimumQualifiedFloor` de `app_settings`: aquele é
 * o mínimo PADRÃO — o que vale para o time sem régua acertada — e continua
 * sendo o valor que o editor sugere. Usá-lo como limite inferior do campo era
 * o que impedia gravar 1, e foi o que fez a tela responder 500 quando o
 * backend ainda tinha CHECK >= 3.
 */
export class QualifiedCapabilityMinimum {
  static readonly FLOOR = 1;

  static admits(value: number): boolean {
    return Number.isInteger(value) && value >= QualifiedCapabilityMinimum.FLOOR;
  }
}

export class ReadyCompetencyShortfall {
  private constructor(readonly missing: number) {}

  static between(minimum: number, readyCompetencies: number): ReadyCompetencyShortfall {
    if (!Number.isFinite(minimum)) return ReadyCompetencyShortfall.none();
    return new ReadyCompetencyShortfall(Math.max(0, minimum - readyCompetencies));
  }

  static none(): ReadyCompetencyShortfall {
    return new ReadyCompetencyShortfall(0);
  }

  get blocksSaving(): boolean {
    return this.missing > 0;
  }

  get messageKey(): MessageKey {
    return this.missing === 1 ? "policy.row.shortfall.one" : "policy.row.shortfall.many";
  }
}

export type ProgressionMinimumReading =
  | { readonly kind: "absent" }
  | { readonly kind: "agreed"; readonly minimum: number }
  | {
      readonly kind: "divergent";
      readonly lowest: number;
      readonly highest: number;
      readonly listed: string;
    };

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

export class ProgressionMinimumPresenter {
  private readonly rules: readonly TeamLevelRule[];
  private readonly scope: ProgressionPolicyScope;

  private constructor(rules: readonly TeamLevelRule[], scope: ProgressionPolicyScope) {
    this.rules = rules;
    this.scope = scope;
  }

  static forCareerLevel(
    teamLevelRules: readonly TeamLevelRule[],
    careerLevelId: string,
    scope: ProgressionPolicyScope = ProgressionPolicyScope.allTeams(),
  ): ProgressionMinimumPresenter {
    return new ProgressionMinimumPresenter(
      teamLevelRules.filter((rule) => rule.careerLevelId === careerLevelId && scope.includes(rule)),
      scope,
    );
  }

  get reading(): ProgressionMinimumReading {
    const [lowest, ...rest] = this.minimums;
    if (lowest === undefined) return { kind: "absent" };
    const highest = rest[rest.length - 1];
    if (highest === undefined) return { kind: "agreed", minimum: lowest };
    return {
      kind: "divergent",
      lowest,
      highest,
      listed: this.minimums.join(" · "),
    };
  }

  get agreedMinimum(): number | undefined {
    const reading = this.reading;
    return reading.kind === "agreed" ? reading.minimum : undefined;
  }

  get team(): ProgressionPolicyTeam | undefined {
    return this.scope.team;
  }

  get soleTeamRule(): TeamLevelRule | undefined {
    return this.rules.length === 1 ? this.rules[0] : undefined;
  }

  get editableTeamId(): string | undefined {
    return this.scope.team?.id ?? this.soleTeamRule?.teamId;
  }

  shortfall(readyCompetencies: number): ReadyCompetencyShortfall {
    const reading = this.reading;
    if (reading.kind === "absent") return ReadyCompetencyShortfall.none();
    const binding = reading.kind === "agreed" ? reading.minimum : reading.highest;
    return ReadyCompetencyShortfall.between(binding, readyCompetencies);
  }

  private get minimums(): number[] {
    return [...new Set(this.rules.map((rule) => rule.minimumQualifiedCapabilities))].sort(
      (first, second) => first - second,
    );
  }
}
