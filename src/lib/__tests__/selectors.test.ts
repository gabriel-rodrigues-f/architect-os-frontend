import { describe, expect, it } from "vitest";

import {
  ArchitectSelectors,
  AssessmentSelectors,
  averageWithCoverage,
  CapabilitySelectors,
  createSelectors,
  DevelopmentSelectors,
  emptyState,
  SelectorIndex,
  TrainingSelectors,
} from "../selectors";
import type { AppState, SessionUser } from "../api";
import {
  fixtureAdminUser,
  fixtureMemberUser,
  fixtureState,
  fixtureUnassignedLeadUser,
} from "./fixtures";

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
    expect(s.capabilityById("security")?.short).toBe("Security");
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

    it("Draft: gapsFor e capabilityAverages ignoram", () => {
      expect(rascunho.gapsFor("diego")).toEqual([]);
      expect(rascunho.capabilityAverages("diego").every((d) => d.avg === undefined)).toBe(true);
      expect(rascunho.officialAssessmentFor("diego")).toBeUndefined();
    });

    it("In Review: mesma exclusão — calibração ainda não fechou a nota", () => {
      expect(emRevisao.gapsFor("diego")).toEqual([]);
      expect(emRevisao.officialAssessmentFor("diego")).toBeUndefined();
    });

    it("Completed: passa a alimentar gap e média", () => {
      expect(concluida.gapsFor("diego").length).toBeGreaterThan(0);
      expect(concluida.officialAssessmentFor("diego")?.id).toBe("done-1");
    });
  });

  it("média por capacidade agrupa competências da capacidade", () => {
    const averages = s.capabilityAverages("ana");
    const cloud = averages.find((d) => d.capability.id === "cloud");
    const security = averages.find((d) => d.capability.id === "security");

    expect(cloud).toMatchObject({ avg: 4, target: 4 });
    expect(security).toMatchObject({ avg: 2, target: 3 });
  });

  it("média por capacidade fica indefinida (não zero) quando não há assessment", () => {
    expect(
      s.capabilityAverages("ninguem").every((d) => d.avg === undefined && d.target === undefined),
    ).toBe(true);
  });

  it("agrega necessidades de treinamento do time ignorando gaps não positivos", () => {
    const needs = s.teamTrainingNeeds();

    expect(needs.map((n) => n.competency?.id)).toEqual(["security-iam", "cloud-k8s"]);
    expect(needs[0]).toMatchObject({ people: 2, totalGap: 2, avgGap: 1 });
    // cloud-serverless está adequado para os dois — não aparece na LNT
    expect(needs.some((n) => n.competency?.id === "cloud-serverless")).toBe(false);
  });

  it("opera sobre o estado vazio sem quebrar", () => {
    const empty = createSelectors(emptyState);
    expect(empty.teamTrainingNeeds()).toEqual([]);
    expect(empty.capabilityAverages("ana")).toEqual([]);
  });

  /**
   * EPIC E — quem já saiu do time não conta como time atual: nem na lista
   * de `activeArchitects`, nem na Necessidade de Treinamento agregada.
   * `gapsFor`/`capabilityAverages` continuam funcionando por id explícito (uma
   * tela histórica pode pedir o gap de alguém inativo de propósito).
   */
  describe("activeArchitects — time atual exclui quem saiu", () => {
    const comInativo = createSelectors({
      ...fixtureState,
      architects: fixtureState.architects.map((a) =>
        a.id === "bruno" ? { ...a, active: false } : a,
      ),
    });

    it("activeArchitects não lista bruno", () => {
      expect(comInativo.activeArchitects.map((a) => a.id)).toEqual(["ana"]);
    });

    it("teamTrainingNeeds ignora as lacunas de bruno", () => {
      const needs = comInativo.teamTrainingNeeds();
      // Sem o bruno, só a lacuna de segurança da ana permanece.
      expect(needs.map((n) => n.competency?.id)).toEqual(["security-iam"]);
      expect(needs[0]).toMatchObject({ people: 1, totalGap: 1 });
    });

    it("gapsFor ainda funciona para quem está inativo — histórico continua acessível", () => {
      expect(comInativo.gapsFor("bruno").length).toBeGreaterThan(0);
    });
  });
});

/**
 * OO2-08 (AUDITORIA-OO-PADRONIZACAO-ANALYTICS-IA-SYNAPSE-2026-08-25.md,
 * Seção 62) — os testes de `createSelectors` acima já cobrem o
 * comportamento (a forma achatada não mudou); estes confirmam que as
 * classes por contexto funcionam também quando instanciadas diretamente,
 * fora do objeto achatado — o caso de uso que motivou a divisão (ex.: um
 * ViewModel futuro que só precisa de uma fatia).
 */
describe("classes por contexto (instanciadas diretamente)", () => {
  const index = new SelectorIndex(fixtureState);

  it("ArchitectSelectors resolve por id e lista só quem está ativo", () => {
    const architects = new ArchitectSelectors(fixtureState, index);
    expect(architects.byId("ana")?.name).toBe("Ana Martins");
    expect(architects.byId("nao-existe")).toBeUndefined();
    expect(architects.active.map((a) => a.id)).toEqual(["ana", "bruno"]);
  });

  it("AssessmentSelectors calcula gap igual ao objeto achatado", () => {
    const assessment = new AssessmentSelectors(index);
    const viaClasse = assessment.gapsFor("bruno");
    const viaFlat = createSelectors(fixtureState).gapsFor("bruno");
    expect(viaClasse).toEqual(viaFlat);
    expect(
      assessment.progressionGapsFor("bruno").every((g) => g.targetSemantics !== "MASTERY"),
    ).toBe(true);
  });

  it("DevelopmentSelectors resolve o plano do ciclo ativo", () => {
    const development = new DevelopmentSelectors(index);
    expect(development.planFor("ana")?.id).toBe("pdi-ana");
    expect(development.planFor("bruno")).toBeUndefined();
  });

  it("CapabilitySelectors calcula média por capacidade usando o AssessmentSelectors injetado", () => {
    const assessment = new AssessmentSelectors(index);
    const capability = new CapabilitySelectors(fixtureState, index, assessment);
    const cloud = capability.capabilityAverages("ana").find((d) => d.capability.id === "cloud");
    expect(cloud).toMatchObject({ avg: 4, target: 4 });
  });

  it("TrainingSelectors agrega necessidade de treinamento a partir de Architect + Assessment", () => {
    const architects = new ArchitectSelectors(fixtureState, index);
    const assessment = new AssessmentSelectors(index);
    const training = new TrainingSelectors(index, architects, assessment);
    const needs = training.teamTrainingNeeds();
    expect(needs.map((n) => n.competency?.id)).toEqual(["security-iam", "cloud-k8s"]);
  });
});

describe("visibleArchitects", () => {
  /**
   * OO3-11a — a regra de população visível (ANA-001) que estava copiada em
   * 5 telas agora mora em `ArchitectSelectors.visibleTo`. Estes casos provam
   * a regra espelhada (`UiAuthorizationPolicy.canActFor`) direto no selector.
   */
  const leadUser: SessionUser = {
    ...fixtureUnassignedLeadUser,
    id: "lead-da-ana",
  };
  const state: AppState = {
    ...fixtureState,
    architects: [
      { ...fixtureState.architects[0]!, leadUserId: "lead-da-ana" },
      fixtureState.architects[1]!,
      {
        id: "carla",
        name: "Carla Inativa",
        role: "Arquiteto de Soluções I",
        yearsAsArchitect: 2,
        specialization: "Data",
        email: "carla@company.com",
        active: false,
        leadUserId: "lead-da-ana",
        version: 1,
      },
    ],
  };
  const sel = createSelectors(state);

  it("admin vê todo o time ativo", () => {
    expect(sel.visibleArchitects(fixtureAdminUser).map((a) => a.id)).toEqual(["ana", "bruno"]);
  });

  it("member vê só a si", () => {
    expect(sel.visibleArchitects(fixtureMemberUser).map((a) => a.id)).toEqual(["ana"]);
  });

  it("lead vê só quem lidera", () => {
    expect(sel.visibleArchitects(leadUser).map((a) => a.id)).toEqual(["ana"]);
  });

  it("inativo nunca aparece, nem para o próprio lead", () => {
    expect(sel.visibleArchitects(leadUser).some((a) => a.id === "carla")).toBe(false);
    expect(sel.visibleArchitects(fixtureAdminUser).some((a) => a.id === "carla")).toBe(false);
  });

  it("devolve a MESMA referência para o mesmo viewer — identidade estável para useMemo", () => {
    expect(sel.visibleArchitects(fixtureAdminUser)).toBe(sel.visibleArchitects(fixtureAdminUser));
  });
});
