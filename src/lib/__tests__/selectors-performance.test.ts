import { describe, expect, it } from "vitest";

import type { AppState } from "../api";
import type { Assessment, Competency, CompetencyCategory, Architect, Level } from "../domain";
import { createSelectors, emptyState } from "../selectors";

/**
 * Os selectors alimentam telas que iteram o time inteiro (mapa de calor do
 * painel, análise de lacunas). Com busca linear dentro de laços o custo crescia
 * com o quadrado do catálogo; estes testes fixam o comportamento em escala
 * realista para que uma regressão apareça como lentidão no teste, não em produção.
 */

const DOMAINS = 12;
const COMPETENCIES_PER_DOMAIN = 25; // 300 competências
const ARCHITECTS = 40;

function buildLargeState(): AppState {
  const categories: CompetencyCategory[] = Array.from({ length: DOMAINS }, (_, i) => ({
    id: `dominio-${i}`,
    name: `Domínio ${i}`,
    short: `D${i}`,
    active: true,
  }));

  const competencies: Competency[] = categories.flatMap((cat, ci) =>
    Array.from({ length: COMPETENCIES_PER_DOMAIN }, (_, i) => ({
      id: `comp-${ci}-${i}`,
      name: `Competência ${ci}.${i}`,
      categoryId: cat.id,
      expected: {
        "Arquiteto de Soluções I": 3 as Level,
        "Arquiteto de Soluções II": 4 as Level,
        "Arquiteto de Soluções III": 5 as Level,
      },
      active: true,
    })),
  );

  const architects: Architect[] = Array.from({ length: ARCHITECTS }, (_, i) => ({
    id: `arq-${i}`,
    name: `Arquiteto ${i}`,
    role: "Arquiteto de Soluções II",
    yearsAsArchitect: 5,
    specialization: "Arquitetura de Soluções",
    email: `arq-${i}@empresa.com`,
    active: true,
  }));

  const assessments: Assessment[] = architects.map((a) => ({
    id: `${a.id}-ciclo`,
    architectId: a.id,
    cycleId: "ciclo",
    // Completed: gapsFor/teamTrainingNeeds só contam assessment oficial.
    status: "Completed",
    items: competencies.map((c, i) => ({
      competencyId: c.id,
      self: 3 as Level,
      leader: 3 as Level,
      target: 4 as Level,
      final: ((i % 4) + 1) as Level,
      comments: [],
    })),
  }));

  return {
    ...emptyState,
    categories,
    competencies,
    architects,
    assessments,
    cycles: [
      { id: "ciclo", name: "Ciclo", start: "2026-01-01", end: "2026-06-30", status: "Active" },
    ],
    activeCycleId: "ciclo",
  };
}

describe("selectors em escala", () => {
  const state = buildLargeState();

  it("monta o mapa de calor do time inteiro rapidamente", () => {
    const sel = createSelectors(state);

    const started = performance.now();
    for (const architect of state.architects) {
      sel.domainAverages(architect.id);
    }
    const elapsed = performance.now() - started;

    // 40 arquitetos × 300 competências × 12 domínios. Com busca linear em laço
    // isso passava de segundos; indexado fica na casa das dezenas de ms.
    expect(elapsed).toBeLessThan(250);
  });

  it("agrega as necessidades de treinamento do time inteiro rapidamente", () => {
    const sel = createSelectors(state);

    const started = performance.now();
    const needs = sel.teamTrainingNeeds();
    const elapsed = performance.now() - started;

    expect(needs.length).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(250);
  });

  it("mantém o resultado correto na escala grande", () => {
    const sel = createSelectors(state);
    const averages = sel.domainAverages("arq-0");

    expect(averages).toHaveLength(DOMAINS);
    for (const domain of averages) {
      expect(domain.target).toBe(4);
      expect(domain.avg).toBeGreaterThan(0);
      expect(domain.avg).toBeLessThanOrEqual(5);
    }
  });

  it("reaproveita o cálculo dentro da mesma versão do estado", () => {
    const sel = createSelectors(state);

    const first = sel.gapsFor("arq-0");
    const second = sel.gapsFor("arq-0");

    // mesma referência: o segundo acesso não recalculou
    expect(second).toBe(first);
  });
});
