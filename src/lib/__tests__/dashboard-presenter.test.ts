import { describe, expect, it } from "vitest";

import type { AppState } from "../api";
import { CRITICAL_GAP_THRESHOLD, DashboardPresenter } from "../presenters/dashboard-presenter";
import { createSelectors } from "../selectors";
import { fixtureState } from "./fixtures";

/**
 * OO3-11e — os números do painel (`AdminHome`) ganham a cobertura unitária
 * que a suíte de DOM (`dashboard-roles.test.tsx`, que só prova qual Home
 * cada papel vê) nunca teve.
 */
const presenterFor = (state: AppState) => {
  const sel = createSelectors(state);
  return { presenter: new DashboardPresenter(state, sel), sel };
};

describe("DashboardPresenter", () => {
  const architects = fixtureState.architects;

  it("limiar de gap crítico é 3: gap 2 não conta, gap 3 conta", () => {
    expect(CRITICAL_GAP_THRESHOLD).toBe(3);
    const withCriticalGap: AppState = {
      ...fixtureState,
      assessments: fixtureState.assessments.map((a) =>
        a.id === "bruno-h2"
          ? {
              ...a,
              items: a.items.map((i) =>
                i.competencyId === "cloud-k8s"
                  ? { ...i, final: 2 as const, target: 5 as const }
                  : i,
              ),
            }
          : a,
      ),
    };
    expect(presenterFor(fixtureState).presenter.criticalGapCount(architects)).toBe(0);
    expect(presenterFor(withCriticalGap).presenter.criticalGapCount(architects)).toBe(1);
  });

  it("topGaps respeita o limite e ordena do maior gap para o menor", () => {
    const { presenter } = presenterFor(fixtureState);
    const top = presenter.topGaps(architects, 2);
    expect(top).toHaveLength(2);
    expect(top[0]!.gap).toBeGreaterThanOrEqual(top[1]!.gap);
    const all = presenter.topGaps(architects);
    expect(all.map((g) => g.gap)).toEqual([...all.map((g) => g.gap)].sort((a, b) => b - a));
  });

  it("assessmentCoverage soma exatamente population.length, com 'sem assessment' em notStarted", () => {
    const semAssessmentDoBruno: AppState = {
      ...fixtureState,
      assessments: fixtureState.assessments.filter((a) => a.id !== "bruno-h2"),
    };
    const { presenter } = presenterFor(semAssessmentDoBruno);
    const coverage = presenter.assessmentCoverage(architects);
    expect(coverage).toEqual({ completed: 1, inReview: 0, draft: 0, notStarted: 1 });
    expect(coverage.completed + coverage.inReview + coverage.draft + coverage.notStarted).toBe(
      architects.length,
    );
  });

  it("goalsInProgress/goalsDone contam só itens de planos do ciclo ativo", () => {
    const planoDeOutroCiclo: AppState = {
      ...fixtureState,
      plans: [
        ...fixtureState.plans,
        {
          ...fixtureState.plans[0]!,
          id: "pdi-antigo",
          cycleId: "2026-h1",
          items: fixtureState.plans[0]!.items.map((i) => ({
            ...i,
            status: "In Progress" as const,
          })),
        },
      ],
    };
    const base = presenterFor(fixtureState).presenter;
    const comAntigo = presenterFor(planoDeOutroCiclo).presenter;
    expect(comAntigo.goalsInProgress).toBe(base.goalsInProgress);
    expect(comAntigo.goalsDone).toBe(base.goalsDone);
    expect(
      comAntigo.activePlans().every((p) => p.cycleId === planoDeOutroCiclo.activeCycleId),
    ).toBe(true);
  });
});
