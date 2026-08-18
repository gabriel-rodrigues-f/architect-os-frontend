import { describe, expect, it } from "vitest";

import { averageWithCoverage, createSelectors, emptyState } from "../selectors";
import { fixtureState } from "./fixtures";

describe("averageWithCoverage", () => {
  it("ignora undefined na média, mas conta na cobertura", () => {
    expect(averageWithCoverage([4, undefined, 2])).toEqual({ avg: 3, covered: 2, total: 3 });
  });

  it("fica undefined quando ninguém contribuiu — nunca 0", () => {
    expect(averageWithCoverage([undefined, undefined])).toEqual({
      avg: undefined,
      covered: 0,
      total: 2,
    });
  });

  it("lista vazia também fica undefined, sem dividir por zero", () => {
    expect(averageWithCoverage([])).toEqual({ avg: undefined, covered: 0, total: 0 });
  });
});

describe("createSelectors", () => {
  const s = createSelectors(fixtureState);

  it("resolve entidades por id", () => {
    expect(s.competencyById("cloud-k8s")?.name).toBe("Kubernetes");
    expect(s.categoryById("security")?.short).toBe("Security");
    expect(s.architectById("ana")?.name).toBe("Ana Martins");
    expect(s.competencyById("nao-existe")).toBeUndefined();
  });

  it("usa o ciclo ativo por padrão e aceita ciclo explícito", () => {
    expect(s.assessmentFor("ana")?.id).toBe("ana-h2");
    expect(s.assessmentFor("ana", "2026-h1")?.id).toBe("ana-h1");
  });

  it("calcula gaps ordenados do maior para o menor", () => {
    const gaps = s.gapsFor("bruno");
    expect(gaps.map((g) => g.item.competencyId)).toEqual([
      "cloud-k8s",
      "security-iam",
      "cloud-serverless",
    ]);
    expect(gaps[0]?.gap).toBe(1);
    expect(gaps[2]?.gap).toBe(0);
  });

  it("gapsFor devolve vazio quando não há assessment no ciclo", () => {
    expect(s.gapsFor("bruno", "2026-h1")).toEqual([]);
    expect(s.gapsFor("ninguem")).toEqual([]);
  });

  describe("Draft e In Review não alimentam indicador oficial", () => {
    /**
     * PLANO-360-AGENTES-SYNAPSE.md, Seção 9 — "Regra crítica": gapsFor() e
     * companhia não podem tratar uma avaliação ainda em curso como fotografia
     * oficial do ciclo. Uma autoavaliação em rascunho nasce com todo item em
     * nível 1 — se contasse, pintaria todo mundo como lacuna crítica antes
     * mesmo de a pessoa ter respondido.
     */
    const rascunho = createSelectors({
      ...fixtureState,
      assessments: [
        {
          ...fixtureState.assessments[0]!,
          id: "draft-1",
          architectId: "diego",
          cycleId: "2026-h2",
          status: "Draft",
        },
      ],
    });
    const emRevisao = createSelectors({
      ...fixtureState,
      assessments: [
        {
          ...fixtureState.assessments[0]!,
          id: "review-1",
          architectId: "diego",
          cycleId: "2026-h2",
          status: "In Review",
        },
      ],
    });
    const concluida = createSelectors({
      ...fixtureState,
      assessments: [
        {
          ...fixtureState.assessments[0]!,
          id: "done-1",
          architectId: "diego",
          cycleId: "2026-h2",
          status: "Completed",
        },
      ],
    });

    it("Draft: gapsFor, domainAverages e developmentScore ignoram", () => {
      expect(rascunho.gapsFor("diego")).toEqual([]);
      expect(rascunho.domainAverages("diego").every((d) => d.avg === undefined)).toBe(true);
      expect(rascunho.officialAssessmentFor("diego")).toBeUndefined();
    });

    it("In Review: mesma exclusão — calibração ainda não fechou a nota", () => {
      expect(emRevisao.gapsFor("diego")).toEqual([]);
      expect(emRevisao.officialAssessmentFor("diego")).toBeUndefined();
    });

    it("Completed: passa a alimentar gap, média e score", () => {
      expect(concluida.gapsFor("diego").length).toBeGreaterThan(0);
      expect(concluida.officialAssessmentFor("diego")?.id).toBe("done-1");
    });
  });

  it("média por domínio agrupa competências da categoria", () => {
    const averages = s.domainAverages("ana");
    const cloud = averages.find((d) => d.category.id === "cloud");
    const security = averages.find((d) => d.category.id === "security");

    expect(cloud).toMatchObject({ avg: 4, target: 4 });
    expect(security).toMatchObject({ avg: 2, target: 3 });
  });

  it("média por domínio fica indefinida (não zero) quando não há assessment", () => {
    expect(
      s.domainAverages("ninguem").every((d) => d.avg === undefined && d.target === undefined),
    ).toBe(true);
  });

  it("agrega necessidades de treinamento do time ignorando gaps não positivos", () => {
    const needs = s.teamTrainingNeeds();

    expect(needs.map((n) => n.competency?.id)).toEqual(["security-iam", "cloud-k8s"]);
    expect(needs[0]).toMatchObject({ people: 2, totalGap: 2, avgGap: 1 });
    // cloud-serverless está adequado para os dois — não aparece na LNT
    expect(needs.some((n) => n.competency?.id === "cloud-serverless")).toBe(false);
  });

  it("developmentScore combina PDI, OKR, trilhas, evidências e evolução", () => {
    // PDI 50*.3 + OKR 50*.15 + trilha 60*.15 + evidências 25*.2 + evolução 66,7*.2 ≈ 50
    expect(s.developmentScore("ana")).toBe(50);
  });

  it("developmentScore é 0 para quem não tem nada registrado", () => {
    expect(s.developmentScore("bruno")).toBe(0);
  });

  it("opera sobre o estado vazio sem quebrar", () => {
    const empty = createSelectors(emptyState);
    expect(empty.teamTrainingNeeds()).toEqual([]);
    expect(empty.domainAverages("ana")).toEqual([]);
    expect(empty.developmentScore("ana")).toBe(0);
    expect(empty.swotFor("ana")).toBeUndefined();
  });
});
