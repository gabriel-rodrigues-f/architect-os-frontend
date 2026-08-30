import { describe, expect, it } from "vitest";

import type {
  CalibrationEvaluator,
  CalibrationSnapshot,
  LevelDistribution,
} from "@/lib/gateways/calibration.gateway";
import { CalibrationViewModel } from "@/lib/view-models";

/**
 * Tela 3 (spec-telas-novas-2026-08-29, FASE B) — calibração entre líderes.
 * A VM responde "os avaliadores estão usando a mesma régua?": calcula o
 * desvio de cada avaliador contra a média geral, ordena do mais desviante
 * para o menos, e marca quem passa do limiar de alerta. O limiar é uma
 * CONSTANTE da VM até o ScoringRuler da R2 existir (decisão da spec §3) —
 * trocar a fonte do limiar não muda a tela.
 */
const distribution = (counts: [number, number, number, number, number]): LevelDistribution => ({
  "1": counts[0],
  "2": counts[1],
  "3": counts[2],
  "4": counts[3],
  "5": counts[4],
});

function evaluator(overrides: Partial<CalibrationEvaluator>): CalibrationEvaluator {
  return {
    userId: "user-1",
    name: "Marina Lopes",
    teamIds: ["team-integration"],
    distribution: distribution([0, 1, 4, 9, 6]),
    average: 4,
    itemsCount: 20,
    assessmentsCount: 4,
    ...overrides,
  };
}

function snapshot(overrides: Partial<CalibrationSnapshot>): CalibrationSnapshot {
  return {
    dataOrigin: "demonstration",
    cycleId: "cycle-1",
    overall: { distribution: distribution([2, 5, 10, 8, 5]), average: 3.3 },
    evaluators: [],
    ...overrides,
  };
}

describe("CalibrationViewModel", () => {
  const vm = new CalibrationViewModel();

  it("calcula o desvio assinado de cada avaliador contra a média geral", () => {
    const views = vm.evaluators(
      snapshot({
        overall: { distribution: distribution([0, 0, 3, 0, 0]), average: 3 },
        evaluators: [evaluator({ userId: "lenient", average: 4 })],
      }),
    );
    expect(views[0]?.delta).toBe(1);
  });

  it("ordena do maior desvio absoluto para o menor, com nome como desempate", () => {
    const views = vm.evaluators(
      snapshot({
        overall: { distribution: distribution([0, 0, 3, 0, 0]), average: 3 },
        evaluators: [
          evaluator({ userId: "central", name: "Ricardo Nunes", average: 3.1 }),
          evaluator({ userId: "severe", name: "Paula Souza", average: 2.2 }),
          evaluator({ userId: "lenient", name: "Marina Lopes", average: 3.9 }),
        ],
      }),
    );
    expect(views.map((view) => view.userId)).toEqual(["lenient", "severe", "central"]);
  });

  it("marca como desviante quem passa do limiar, e só quem passa", () => {
    const views = vm.evaluators(
      snapshot({
        overall: { distribution: distribution([0, 0, 3, 0, 0]), average: 3 },
        evaluators: [
          evaluator({
            userId: "severe",
            average: 3 - CalibrationViewModel.DEVIATION_ALERT_THRESHOLD,
          }),
          evaluator({ userId: "central", average: 3.2 }),
        ],
      }),
    );
    expect(views.find((view) => view.userId === "severe")?.deviates).toBe(true);
    expect(views.find((view) => view.userId === "central")?.deviates).toBe(false);
  });

  it("avaliador sem nota (average nulo) não desvia nem quebra a ordenação", () => {
    const views = vm.evaluators(
      snapshot({
        overall: { distribution: distribution([0, 0, 3, 0, 0]), average: 3 },
        evaluators: [
          evaluator({ userId: "empty", average: null, itemsCount: 0 }),
          evaluator({ userId: "lenient", average: 4 }),
        ],
      }),
    );
    expect(views.map((view) => view.userId)).toEqual(["lenient", "empty"]);
    const empty = views.find((view) => view.userId === "empty");
    expect(empty?.delta).toBeNull();
    expect(empty?.deviates).toBe(false);
  });

  it("média geral nula (ciclo sem notas) zera os desvios em vez de inventar número", () => {
    const views = vm.evaluators(
      snapshot({
        overall: { distribution: distribution([0, 0, 0, 0, 0]), average: null },
        evaluators: [evaluator({ userId: "lenient", average: 4 })],
      }),
    );
    expect(views[0]?.delta).toBeNull();
    expect(views[0]?.deviates).toBe(false);
  });

  it("converte a distribuição em linhas 1..5 para a figura, preservando zeros", () => {
    const rows = vm.scoreLevels(distribution([0, 2, 0, 1, 4]));
    expect(rows).toEqual([
      { level: 1, count: 0 },
      { level: 2, count: 2 },
      { level: 3, count: 0 },
      { level: 4, count: 1 },
      { level: 5, count: 4 },
    ]);
  });
});
