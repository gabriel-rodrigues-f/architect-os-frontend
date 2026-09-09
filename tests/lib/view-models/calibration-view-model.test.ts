import { describe, expect, it } from "vitest";

import type {
  CalibrationEvaluator,
  CalibrationSnapshot,
  LevelDistribution,
} from "@/lib/gateways/calibration.gateway";
import { CalibrationViewModel, TeamNames } from "@/lib/view-models";

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

/**
 * Fatia CALIBRAÇÃO — o que a tela precisava dizer e não dizia.
 *
 * O dono: *"me diga a utilidade da tela de calibração"* e *"estes gráficos
 * precisam ser melhor explicados"*. Três dos quatro buracos são de CÁLCULO, e
 * por isso moram aqui: o time aparecia como identificador cru, o "vs geral"
 * não dizia contra qual número, e o aviso não dizia o que reconferir. O
 * quarto (o limiar invisível) é o número que a tela nunca mostrou, e ele já
 * vivia nesta classe.
 */
describe("CalibrationViewModel — o time tem nome, não identificador", () => {
  const times = TeamNames.of([
    { id: "seed-completo-time-dados", name: "Dados e Inteligência", active: true },
    { id: "team-integration", name: "Integração", active: true },
  ]);

  it("troca o identificador do time pelo nome cadastrado", () => {
    const views = new CalibrationViewModel(times).evaluators(
      snapshot({
        evaluators: [evaluator({ teamIds: ["seed-completo-time-dados"] })],
      }),
    );
    expect(views[0]?.teamNames).toEqual(["Dados e Inteligência"]);
  });

  /**
   * O defeito era o identificador VAZANDO para a tela. Um time que a lista
   * não conhece some da linha — mostrar `seed-completo-time-dados` de volta
   * seria repetir o defeito com outra desculpa.
   */
  it("time desconhecido não volta como identificador cru", () => {
    const views = new CalibrationViewModel(times).evaluators(
      snapshot({ evaluators: [evaluator({ teamIds: ["time-que-ninguem-cadastrou"] })] }),
    );
    expect(views[0]?.teamNames).toEqual([]);
  });

  it("sem a lista de times carregada, a linha fica vazia em vez de mostrar o identificador", () => {
    const views = new CalibrationViewModel().evaluators(
      snapshot({ evaluators: [evaluator({ teamIds: ["team-integration"] })] }),
    );
    expect(views[0]?.teamNames).toEqual([]);
  });
});

describe("CalibrationViewModel — contra o que é o 'vs geral', e por que o aviso acende", () => {
  it("publica a média geral formatada, para o 'vs' nomear o número que compara", () => {
    const vm = new CalibrationViewModel();
    expect(
      vm.overallAverageLabel(
        snapshot({ overall: { distribution: distribution([0, 0, 3, 0, 0]), average: 3.1153 } }),
      ),
    ).toBe("3.12");
  });

  it("ciclo sem nota nenhuma não inventa média geral", () => {
    const vm = new CalibrationViewModel();
    expect(
      vm.overallAverageLabel(
        snapshot({ overall: { distribution: distribution([0, 0, 0, 0, 0]), average: null } }),
      ),
    ).toBeNull();
  });

  /** O limiar existia só no código: a tela acendia o aviso sem dizer a régua. */
  it("publica o limiar do aviso formatado como os outros números da tela", () => {
    expect(new CalibrationViewModel().thresholdLabel()).toBe("0.50");
  });
});

describe("CalibrationViewModel — o aviso diz o que reconferir", () => {
  /**
   * "Vale conferir a régua" não dizia QUAIS notas conferir. O nível de
   * destaque é o degrau em que a distribuição deste avaliador mais se afasta
   * da distribuição do ciclo — é ali que a diferença de média nasce, e é o
   * que cabe reconferir numa conversa.
   */
  it("aponta o nível em que a distribuição mais se afasta da do ciclo, e quantas notas há nele", () => {
    const views = new CalibrationViewModel().evaluators(
      snapshot({
        overall: { distribution: distribution([5, 11, 16, 13, 7]), average: 162 / 52 },
        evaluators: [
          evaluator({
            userId: "lenient",
            distribution: distribution([0, 1, 4, 9, 6]),
            itemsCount: 20,
            average: 4,
          }),
        ],
      }),
    );
    expect(views[0]?.standoutLevel).toBe(4);
    expect(views[0]?.standoutCount).toBe(9);
  });

  it("o avaliador exigente destaca o degrau BAIXO em que concentrou notas", () => {
    const views = new CalibrationViewModel().evaluators(
      snapshot({
        overall: { distribution: distribution([5, 11, 16, 13, 7]), average: 162 / 52 },
        evaluators: [
          evaluator({
            userId: "severe",
            distribution: distribution([4, 7, 4, 1, 0]),
            itemsCount: 16,
            average: 2.125,
          }),
        ],
      }),
    );
    expect(views[0]?.standoutLevel).toBe(2);
    expect(views[0]?.standoutCount).toBe(7);
  });

  it("avaliador sem nota não tem nível de destaque — não há distribuição para comparar", () => {
    const views = new CalibrationViewModel().evaluators(
      snapshot({
        overall: { distribution: distribution([0, 0, 3, 0, 0]), average: 3 },
        evaluators: [
          evaluator({
            userId: "empty",
            distribution: distribution([0, 0, 0, 0, 0]),
            itemsCount: 0,
            average: null,
          }),
        ],
      }),
    );
    expect(views[0]?.standoutLevel).toBeNull();
    expect(views[0]?.standoutCount).toBe(0);
  });
});

describe("TeamNames — o nome do time, num lugar só", () => {
  const times = TeamNames.of([{ id: "time-dados", name: "Dados e Inteligência", active: true }]);

  it("responde o nome pelo identificador", () => {
    expect(times.nameOf("time-dados")).toBe("Dados e Inteligência");
  });

  it("responde nulo para quem não conhece, e para a ausência de time", () => {
    expect(times.nameOf("time-nenhum")).toBeNull();
    expect(times.nameOf(null)).toBeNull();
    expect(times.nameOf(undefined)).toBeNull();
  });

  it("traduz uma lista inteira e descarta o que não sabe nomear", () => {
    expect(times.allOf(["time-dados", "time-nenhum"])).toEqual(["Dados e Inteligência"]);
  });
});
