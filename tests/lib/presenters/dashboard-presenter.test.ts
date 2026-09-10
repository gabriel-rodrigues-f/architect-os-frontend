import { describe, expect, it } from "vitest";

import type { AppState } from "@/lib/api";
import type { Professional, Assessment, Capability, Competency, Level } from "@/lib/domain";
import {
  CRITICAL_GAP_THRESHOLD,
  DashboardPresenter,
  PersonalDashboardPresenter,
} from "@/lib/presenters";
import { createSelectors } from "@/lib/selectors";
import {
  fixtureAdminUser,
  fixtureAssignedManagerUser,
  fixtureState,
  fixtureAssignedTechLeadUser,
  fixtureUnassignedTechLeadUser,
} from "../../helpers/fixtures";

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
  const professionals = fixtureState.professionals;

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
    expect(presenterFor(fixtureState).presenter.criticalGapCount(professionals)).toBe(0);
    expect(presenterFor(withCriticalGap).presenter.criticalGapCount(professionals)).toBe(1);
  });

  it("assessmentCoverage soma exatamente population.length, com 'sem assessment' em notStarted", () => {
    const semAssessmentDoBruno: AppState = {
      ...fixtureState,
      assessments: fixtureState.assessments.filter((a) => a.id !== "bruno-h2"),
    };
    const { presenter } = presenterFor(semAssessmentDoBruno);
    const coverage = presenter.assessmentCoverage(professionals);
    expect(coverage).toEqual({ completed: 1, inReview: 0, draft: 0, notStarted: 1 });
    expect(coverage.completed + coverage.inReview + coverage.draft + coverage.notStarted).toBe(
      professionals.length,
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

/**
 * OO3-11/D-5 (reuso final) — os KPIs pessoais compartilhados entre a Home
 * de Member (`routes/index.tsx`) e o perfil do profissional.
 */
describe("PersonalDashboardPresenter", () => {
  const personalFor = (state: AppState) =>
    new PersonalDashboardPresenter(state, createSelectors(state));

  it("openGaps devolve só lacunas reais (gap > 0)", () => {
    const personal = personalFor(fixtureState);
    const gaps = personal.openGaps("ana");
    expect(gaps.length).toBeGreaterThan(0);
    expect(gaps.every((g) => g.gap > 0)).toBe(true);
    const todos = createSelectors(fixtureState).progressionGapsFor("ana");
    expect(gaps.length).toBeLessThan(todos.length);
  });

  it("planItemCounts conta os 4 baldes do PDI ativo; sem plano, tudo zero", () => {
    const personal = personalFor(fixtureState);
    expect(personal.planItemCounts("ana")).toEqual({
      notStarted: 0,
      inProgress: 2,
      blocked: 0,
      completed: 0,
    });
    expect(personal.planItemCounts("bruno")).toEqual({
      notStarted: 0,
      inProgress: 0,
      blocked: 0,
      completed: 0,
    });
  });

  it("assignedPaths devolve só trilhas atribuídas à pessoa", () => {
    const personal = personalFor(fixtureState);
    expect(personal.assignedPaths("ana").map((p) => p.id)).toEqual(["lp-sec"]);
    expect(personal.assignedPaths("bruno")).toEqual([]);
  });
});

/**
 * CFG-02 — o limiar de "gap crítico" vem da régua GAP_SEVERITY carregada
 * (`useGapSeverityRuler().criticalThreshold`, passado no construtor); sem o
 * parâmetro, o default (3, derivado do seed) mantém o comportamento antigo
 * — é o que o teste "limiar de gap crítico é 3" acima exerce.
 */
describe("DashboardPresenter com limiar configurado (CFG-02)", () => {
  it("limiar 2 (bands fake) passa a contar gaps que o default ignorava", () => {
    const sel = createSelectors(fixtureState);
    const professionals = fixtureState.professionals;
    const defaultPresenter = new DashboardPresenter(fixtureState, sel);
    const strictPresenter = new DashboardPresenter(fixtureState, sel, 2);
    const gapsAtLeast2 = defaultPresenter.gapsOf(professionals).filter((g) => g.gap >= 2).length;
    expect(strictPresenter.criticalGapCount(professionals)).toBe(gapsAtLeast2);
    expect(strictPresenter.criticalGapCount(professionals)).toBeGreaterThanOrEqual(
      defaultPresenter.criticalGapCount(professionals),
    );
  });
});

/**
 * F2 (caminhos quentes) — o painel varre os gaps do time inteiro mais de uma
 * vez por render (`criticalGapCount` e a lista nominal de distância crítica),
 * e `gapsOf` era refeito a cada chamada. Estes casos fixam a ORDEM da
 * varredura e o reaproveitamento do cálculo.
 *
 * Os três casos de `topGaps` que moravam aqui saíram com o método: ele não
 * tinha um único chamador em `src/` — só o próprio teste
 * (`painel-executivo-analise-2026-09-09.md`, A.4).
 */
describe("DashboardPresenter — prioridades do painel em escala (F2)", () => {
  const PROFESSIONALS = 8;
  const COMPETENCIES = 9;

  const empatadoState = (): AppState => {
    const capability: Capability = {
      id: "cap",
      name: "Capacidade",
      short: "Cap",
      curation: {
        competencyCount: COMPETENCIES,
        status: "REQUIRES_CURATION",
      },
    };

    const competencies: Competency[] = Array.from({ length: COMPETENCIES }, (_, i) => ({
      id: `comp-${i}`,
      name: `Competência ${i}`,
      capabilityId: capability.id,
      expected: {
        "arquiteto-de-solucoes-i": 3 as Level,
        "arquiteto-de-solucoes-ii": 4 as Level,
        "arquiteto-de-solucoes-iii": 5 as Level,
      },
    }));

    const professionals: Professional[] = Array.from({ length: PROFESSIONALS }, (_, i) => ({
      id: `arq-${i}`,
      name: `Profissional ${i}`,
      role: "Pleno",
      yearsAsProfessional: 5,
      specialization: "Integration",
      email: `arq-${i}@company.com`,
      active: true,
      version: 1,
    }));

    // final varia em ciclo curto: muitos gaps iguais, que é onde o desempate importa.
    const assessments: Assessment[] = professionals.map((a, ai) => ({
      id: `${a.id}-ciclo`,
      professionalId: a.id,
      cycleId: "ciclo",
      status: "Completed",
      modelVersion: 1,
      targetCareerLevelId: null,
      targetSemantics: null,
      version: 1,
      items: competencies.map((c, ci) => ({
        competencyId: c.id,
        self: 3 as Level,
        leader: 3 as Level,
        target: 5 as Level,
        final: (((ai + ci) % 4) + 1) as Level,
        comments: [],
      })),
    }));

    return {
      ...fixtureState,
      capabilities: [capability],
      competencies,
      professionals,
      assessments,
      plans: [],
      cycles: [
        { id: "ciclo", name: "Ciclo", start: "2026-01-01", end: "2026-06-30", status: "Active" },
      ],
      activeCycleId: "ciclo",
    };
  };

  const state = empatadoState();
  const presenterFor = () => new DashboardPresenter(state, createSelectors(state));

  /** Identidade de negócio de uma linha de prioridade: quem, em qual competência, com qual gap. */
  const rowKey = (g: {
    professional: { id: string };
    item: { competencyId: string };
    gap: number;
  }) => `${g.professional.id}|${g.item.competencyId}|${g.gap}`;

  it("gapsOf mantém a ordem: população na ordem recebida, gaps na ordem do selector", () => {
    const presenter = presenterFor();
    const sel = createSelectors(state);
    const esperado = state.professionals.flatMap((a) =>
      sel.progressionGapsFor(a.id).map((g) => `${a.id}|${g.item.competencyId}|${g.gap}`),
    );

    expect(presenter.gapsOf(state.professionals).map(rowKey)).toEqual(esperado);
    expect(esperado).toHaveLength(PROFESSIONALS * COMPETENCIES);
  });

  it("criticalGapCount continua contando todos os gaps acima do limiar", () => {
    const presenter = new DashboardPresenter(state, createSelectors(state), 3);
    const esperado = presenter.gapsOf(state.professionals).filter((g) => g.gap >= 3).length;
    expect(presenter.criticalGapCount(state.professionals)).toBe(esperado);
    expect(esperado).toBeGreaterThan(0);
  });

  it("gapsOf reaproveita o cálculo da mesma população — o painel chama duas vezes por render", () => {
    const presenter = presenterFor();
    const primeiro = presenter.gapsOf(state.professionals);
    expect(presenter.gapsOf(state.professionals)).toBe(primeiro);
  });
});

/**
 * R4 (varredura-oo-ddd-2026-08-29, §2c) — as filas de pendência do líder
 * eram calculadas inline no `LeadHome`: quem é do meu time, quem espera
 * calibração e qual plano espera aprovação. É regra de negócio, e o painel já
 * tinha presenter. Estes casos são o espelho literal daquelas linhas. Eram
 * três filas até a evidência sair do produto (dono, 2026-09-08, regra 17).
 */
describe("DashboardPresenter — filas de pendência do líder", () => {
  const leadDoTime = fixtureAssignedTechLeadUser;

  const stateWith = (patch: Partial<AppState>): AppState => ({ ...fixtureState, ...patch });

  const queuesOf = (state: AppState, user = leadDoTime) =>
    new DashboardPresenter(state, createSelectors(state)).pendingQueuesFor(user);

  it("as pessoas da fila são só as ativas que o usuário lidera", () => {
    const comInativo = stateWith({
      professionals: fixtureState.professionals.map((professional) =>
        professional.id === "bruno" ? { ...professional, active: false } : professional,
      ),
    });
    expect(queuesOf(fixtureState).people.map((professional) => professional.id)).toEqual([
      "ana",
      "bruno",
    ]);
    expect(queuesOf(comInativo).people.map((professional) => professional.id)).toEqual(["ana"]);
  });

  it("o gerente recolhe as mesmas pendências do tech lead — alcance não distingue os dois", () => {
    const gerente = { ...fixtureAssignedManagerUser };

    expect(queuesOf(fixtureState, gerente).people.map((professional) => professional.id)).toEqual([
      "ana",
      "bruno",
    ]);
  });

  it("o admin NÃO tem fila de líder — a fila é de quem tem vínculo, sem bypass", () => {
    expect(queuesOf(fixtureState, fixtureAdminUser).people).toEqual([]);
    expect(queuesOf(fixtureState, fixtureAdminUser).totalPending).toBe(0);
  });

  it("lead sem vínculo nenhum e sem time não recolhe pendência alguma", () => {
    const semTime = stateWith({
      professionals: fixtureState.professionals.map((professional) => ({
        ...professional,
        teamId: null,
      })),
    });
    const queues = queuesOf(semTime, fixtureUnassignedTechLeadUser);
    expect(queues.people).toEqual([]);
    expect(queues.awaitingCalibration).toEqual([]);
    expect(queues.totalPending).toBe(0);
  });

  it("espera calibração é a avaliação do ciclo ativo em In Review", () => {
    const emRevisao = stateWith({
      assessments: fixtureState.assessments.map((assessment) =>
        assessment.id === "bruno-h2" ? { ...assessment, status: "Draft" as const } : assessment,
      ),
    });
    expect(queuesOf(fixtureState).awaitingCalibration).toEqual([]);
    expect(queuesOf(emRevisao).awaitingCalibration.map((entry) => entry.professional.id)).toEqual([
      "bruno",
    ]);
  });

  it("espera aprovação é o plano em Draft COM item — rascunho vazio não vira fila", () => {
    const planoDeAna = fixtureState.plans[0]!;
    const rascunhoComItem = stateWith({
      plans: [{ ...planoDeAna, status: "Draft" as const }],
    });
    const rascunhoVazio = stateWith({
      plans: [{ ...planoDeAna, status: "Draft" as const, items: [] }],
    });
    expect(queuesOf(fixtureState).awaitingApproval).toEqual([]);
    expect(
      queuesOf(rascunhoComItem).awaitingApproval.map((entry) => entry.professional.id),
    ).toEqual(["ana"]);
    expect(queuesOf(rascunhoVazio).awaitingApproval).toEqual([]);
  });

  it("o total de pendências é a soma das duas filas", () => {
    const planoDeAna = fixtureState.plans[0]!;
    const tudoPendente = stateWith({
      assessments: fixtureState.assessments.map((assessment) =>
        assessment.id === "bruno-h2" ? { ...assessment, status: "Draft" as const } : assessment,
      ),
      plans: [{ ...planoDeAna, status: "Draft" as const }],
    });
    const queues = queuesOf(tudoPendente);
    expect(queues.awaitingCalibration).toHaveLength(1);
    expect(queues.awaitingApproval).toHaveLength(1);
    expect(queues.totalPending).toBe(2);
    expect(queuesOf(fixtureState).totalPending).toBe(0);
  });
});
