import { useMemo } from "react";

import type { Professional, CareerLevel } from "./domain";
import type { TeamSummary } from "./gateways/teams.gateway";
import { useI18n, type MessageKey } from "./i18n";
import { AUSENCIA } from "./seniority";

type Translate = (key: MessageKey, vars?: Record<string, string | number>) => string;

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"] as const;

/**
 * A POSIÇÃO de uma pessoa na tela Time (dono, 2026-09-06): para o profissional,
 * o time mais o número da senioridade — "Integração I", "BTP II"; para o tech
 * lead, "Tech Lead"; para o gerente, "Gerente". O gerente não é um
 * profissional com capacidades: `isProfessional` é o que o tira de todo
 * seletor de pessoa.
 */
export class PositionReading {
  constructor(
    private readonly t: Translate,
    private readonly teams: readonly TeamSummary[],
    private readonly careerLevels: readonly CareerLevel[],
  ) {}

  static isProfessional(professional: Pick<Professional, "cargo">): boolean {
    return professional.cargo !== "manager";
  }

  static roman(rank: number): string {
    return ROMAN[rank - 1] ?? String(rank);
  }

  labelOf(professional: Pick<Professional, "cargo" | "teamId" | "careerLevelId" | "role">): string {
    if (professional.cargo === "manager") return this.t("users.role.manager");
    if (professional.cargo === "tech_lead") return this.t("users.role.tech_lead");
    const team = this.teams.find((candidate) => candidate.id === professional.teamId)?.name;
    const level = this.careerLevels.find(
      (candidate) => candidate.id === professional.careerLevelId,
    );
    const seniority = level ? PositionReading.roman(level.rank) : (professional.role ?? null);
    const parts = [team, seniority].filter((part): part is string => Boolean(part));
    return parts.length > 0 ? parts.join(" ") : AUSENCIA;
  }
}

export function usePositionReading(
  teams: readonly TeamSummary[],
  careerLevels: readonly CareerLevel[],
): PositionReading {
  const { t } = useI18n();
  return useMemo(() => new PositionReading(t, teams, careerLevels), [t, teams, careerLevels]);
}
