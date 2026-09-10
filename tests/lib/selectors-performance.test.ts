import { describe, expect, it } from "vitest";

import type { AppState } from "@/lib/api";
import type { Assessment, Competency, Capability, Professional, Level } from "@/lib/domain";
import { createSelectors, emptyState } from "@/lib/selectors";

/**
 * Os selectors alimentam telas que iteram o time inteiro (mapa de calor do
 * painel, análise de lacunas). Com busca linear dentro de laços o custo crescia
 * com o quadrado do catálogo; estes testes fixam o comportamento em escala
 * realista para que uma regressão apareça como lentidão no teste, não em produção.
 */

const CAPABILITIES_COUNT = 12;
const COMPETENCIES_PER_CAPABILITY = 25; // 300 competências
const PROFESSIONALS = 40;

function buildLargeState(): AppState {
  const capabilities: Capability[] = Array.from({ length: CAPABILITIES_COUNT }, (_, i) => ({
    id: `capacidade-${i}`,
    name: `Capacidade ${i}`,
    short: `D${i}`,
    curation: {
      competencyCount: COMPETENCIES_PER_CAPABILITY,
      restrictiveCompetencyCount: 0,
      nonRestrictiveCompetencyCount: COMPETENCIES_PER_CAPABILITY,
      status: "REQUIRES_CURATION",
    },
  }));

  const competencies: Competency[] = capabilities.flatMap((cat, ci) =>
    Array.from({ length: COMPETENCIES_PER_CAPABILITY }, (_, i) => ({
      id: `comp-${ci}-${i}`,
      name: `Competência ${ci}.${i}`,
      capabilityId: cat.id,
      expected: {
        "arquiteto-de-solucoes-i": 3 as Level,
        "arquiteto-de-solucoes-ii": 4 as Level,
        "arquiteto-de-solucoes-iii": 5 as Level,
      },
    })),
  );

  const professionals: Professional[] = Array.from({ length: PROFESSIONALS }, (_, i) => ({
    id: `arq-${i}`,
    name: `Profissional ${i}`,
    role: "Pleno",
    yearsAsProfessional: 5,
    specialization: "Arquitetura de Soluções",
    email: `arq-${i}@empresa.com`,
    active: true,
    version: 1,
  }));

  const assessments: Assessment[] = professionals.map((a) => ({
    id: `${a.id}-ciclo`,
    professionalId: a.id,
    cycleId: "ciclo",
    // Completed: `gapsFor` só conta assessment oficial.
    status: "Completed",
    modelVersion: 1,
    targetCareerLevelId: null,
    targetSemantics: null,
    version: 1,
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
    capabilities,
    competencies,
    professionals,
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
    for (const professional of state.professionals) {
      sel.capabilityAverages(professional.id);
    }
    const elapsed = performance.now() - started;

    // 40 profissionais × 300 competências × 12 capacidades. Com busca linear em laço
    // isso passava de segundos; indexado fica na casa das dezenas de ms.
    expect(elapsed).toBeLessThan(250);
  });

  it("mantém o resultado correto na escala grande", () => {
    const sel = createSelectors(state);
    const averages = sel.capabilityAverages("arq-0");

    expect(averages).toHaveLength(CAPABILITIES_COUNT);
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
