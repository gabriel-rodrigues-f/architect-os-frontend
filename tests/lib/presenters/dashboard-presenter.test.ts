import { describe, expect, it } from "vitest";

import type { AppState } from "@/lib/api";
import type { Architect, Assessment, Capability, Competency, Level } from "@/lib/domain";
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

/**
 * OO3-11/D-5 (reuso final) — os KPIs pessoais compartilhados entre a Home
 * de Member (`routes/index.tsx`) e o perfil do arquiteto.
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

  it("pendingEvidenceCount conta só Pending da própria pessoa", () => {
    const comRevisada: AppState = {
      ...fixtureState,
      evidences: [
        ...fixtureState.evidences,
        { ...fixtureState.evidences[0]!, id: "e2", status: "Accepted" as const },
        { ...fixtureState.evidences[0]!, id: "e3", architectId: "bruno" },
      ],
    };
    const personal = personalFor(comRevisada);
    expect(personal.pendingEvidenceCount("ana")).toBe(1);
    expect(personal.pendingEvidenceCount("bruno")).toBe(1);
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
    const architects = fixtureState.architects;
    const defaultPresenter = new DashboardPresenter(fixtureState, sel);
    const strictPresenter = new DashboardPresenter(fixtureState, sel, 2);
    const gapsAtLeast2 = defaultPresenter.gapsOf(architects).filter((g) => g.gap >= 2).length;
    expect(strictPresenter.criticalGapCount(architects)).toBe(gapsAtLeast2);
    expect(strictPresenter.criticalGapCount(architects)).toBeGreaterThanOrEqual(
      defaultPresenter.criticalGapCount(architects),
    );
  });
});

/**
 * F2 (caminhos quentes) — `topGaps` ordenava os ~3.588 gaps do time inteiro
 * só para mostrar 6 linhas, e `gapsOf` era refeito a cada chamada (o painel
 * chama duas vezes por render: `criticalGapCount` e `topGaps`). Estes casos
 * são de caracterização: fixam a SAÍDA de hoje — inclusive o desempate entre
 * gaps de mesmo tamanho, que a ordenação estável do JavaScript resolve pela
 * ordem de origem — para que a troca por seleção dos N maiores sem ordenar
 * tudo seja provadamente equivalente, não "parecida".
 */
describe("DashboardPresenter — prioridades do painel em escala (F2)", () => {
  const ARCHITECTS = 8;
  const COMPETENCIES = 9;

  const empatadoState = (): AppState => {
    const capability: Capability = {
      id: "cap",
      name: "Capacidade",
      short: "Cap",
      active: true,
      curation: {
        activeCompetencyCount: COMPETENCIES,
        status: "REQUIRES_CURATION",
      },
    };

    const competencies: Competency[] = Array.from({ length: COMPETENCIES }, (_, i) => ({
      id: `comp-${i}`,
      name: `Competência ${i}`,
      capabilityId: capability.id,
      requirementType: "NON_RESTRICTIVE",
      expected: {
        "arquiteto-de-solucoes-i": 3 as Level,
        "arquiteto-de-solucoes-ii": 4 as Level,
        "arquiteto-de-solucoes-iii": 5 as Level,
      },
      active: true,
    }));

    const architects: Architect[] = Array.from({ length: ARCHITECTS }, (_, i) => ({
      id: `arq-${i}`,
      name: `Arquiteto ${i}`,
      role: "Pleno",
      yearsAsArchitect: 5,
      specialization: "Integration",
      email: `arq-${i}@company.com`,
      active: true,
      version: 1,
    }));

    // final varia em ciclo curto: muitos gaps iguais, que é onde o desempate importa.
    const assessments: Assessment[] = architects.map((a, ai) => ({
      id: `${a.id}-ciclo`,
      architectId: a.id,
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
      architects,
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
  const rowKey = (g: { architect: { id: string }; item: { competencyId: string }; gap: number }) =>
    `${g.architect.id}|${g.item.competencyId}|${g.gap}`;

  it("gapsOf mantém a ordem: população na ordem recebida, gaps na ordem do selector", () => {
    const presenter = presenterFor();
    const sel = createSelectors(state);
    const esperado = state.architects.flatMap((a) =>
      sel.progressionGapsFor(a.id).map((g) => `${a.id}|${g.item.competencyId}|${g.gap}`),
    );

    expect(presenter.gapsOf(state.architects).map(rowKey)).toEqual(esperado);
    expect(esperado).toHaveLength(ARCHITECTS * COMPETENCIES);
  });

  it("topGaps é idêntico a ordenar tudo por gap desc e cortar — inclusive no empate", () => {
    const presenter = presenterFor();
    const todos = presenter.gapsOf(state.architects);
    // referência: exatamente o algoritmo antigo (sort estável + slice).
    const referencia = (limit: number) =>
      [...todos]
        .sort((a, b) => b.gap - a.gap)
        .slice(0, limit)
        .map(rowKey);

    for (const limit of [0, 1, 2, 6, 7, 20, todos.length, todos.length + 5]) {
      expect(presenter.topGaps(state.architects, limit).map(rowKey)).toEqual(referencia(limit));
    }
    // o default do painel são 6 linhas
    expect(presenter.topGaps(state.architects).map(rowKey)).toEqual(referencia(6));
    // o cenário precisa ter empates, senão o teste não prova nada sobre desempate
    const seis = presenter.topGaps(state.architects).map((g) => g.gap);
    expect(new Set(seis).size).toBeLessThan(seis.length);
  });

  it("topGaps não reordena a lista base nem os gaps do selector", () => {
    const presenter = presenterFor();
    const antes = presenter.gapsOf(state.architects).map(rowKey);
    presenter.topGaps(state.architects, 6);
    expect(presenter.gapsOf(state.architects).map(rowKey)).toEqual(antes);
  });

  it("criticalGapCount continua contando todos os gaps acima do limiar", () => {
    const presenter = new DashboardPresenter(state, createSelectors(state), 3);
    const esperado = presenter.gapsOf(state.architects).filter((g) => g.gap >= 3).length;
    expect(presenter.criticalGapCount(state.architects)).toBe(esperado);
    expect(esperado).toBeGreaterThan(0);
  });

  it("gapsOf reaproveita o cálculo da mesma população — o painel chama duas vezes por render", () => {
    const presenter = presenterFor();
    const primeiro = presenter.gapsOf(state.architects);
    expect(presenter.gapsOf(state.architects)).toBe(primeiro);
  });
});

/**
 * R4 (varredura-oo-ddd-2026-08-29, §2c) — as três filas de pendência do
 * líder (`routes/index.tsx:394-397`) eram calculadas inline no `LeadHome`:
 * quem é do meu time, quem espera calibração, qual evidência espera revisão
 * e qual plano espera aprovação. É regra de negócio, e o painel já tinha
 * presenter. Estes casos são o espelho literal daquelas linhas.
 */
describe("DashboardPresenter — filas de pendência do líder", () => {
  const leadDoTime = fixtureAssignedTechLeadUser;

  const stateWith = (patch: Partial<AppState>): AppState => ({ ...fixtureState, ...patch });

  const queuesOf = (state: AppState, user = leadDoTime) =>
    new DashboardPresenter(state, createSelectors(state)).pendingQueuesFor(user);

  it("as pessoas da fila são só as ativas que o usuário lidera", () => {
    const comInativo = stateWith({
      architects: fixtureState.architects.map((architect) =>
        architect.id === "bruno" ? { ...architect, active: false } : architect,
      ),
    });
    expect(queuesOf(fixtureState).people.map((architect) => architect.id)).toEqual([
      "ana",
      "bruno",
    ]);
    expect(queuesOf(comInativo).people.map((architect) => architect.id)).toEqual(["ana"]);
  });

  it("o gestor recolhe as mesmas pendências do tech lead — alcance não distingue os dois", () => {
    const gestor = { ...fixtureAssignedManagerUser };

    expect(queuesOf(fixtureState, gestor).people.map((architect) => architect.id)).toEqual([
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
      architects: fixtureState.architects.map((architect) => ({ ...architect, teamId: null })),
    });
    const queues = queuesOf(semTime, fixtureUnassignedTechLeadUser);
    expect(queues.people).toEqual([]);
    expect(queues.pendingEvidence).toEqual([]);
    expect(queues.totalPending).toBe(0);
  });

  it("espera calibração é a avaliação do ciclo ativo em In Review", () => {
    const emRevisao = stateWith({
      assessments: fixtureState.assessments.map((assessment) =>
        assessment.id === "bruno-h2" ? { ...assessment, status: "In Review" as const } : assessment,
      ),
    });
    expect(queuesOf(fixtureState).awaitingCalibration).toEqual([]);
    expect(queuesOf(emRevisao).awaitingCalibration.map((entry) => entry.architect.id)).toEqual([
      "bruno",
    ]);
  });

  it("evidência pendente é só a Pending de gente do time, na ordem em que o estado a entrega", () => {
    const comOutraPendente = stateWith({
      evidences: [
        ...fixtureState.evidences,
        { ...fixtureState.evidences[0]!, id: "e2", architectId: "bruno" },
        { ...fixtureState.evidences[0]!, id: "e3", status: "Accepted" as const },
        { ...fixtureState.evidences[0]!, id: "e4", architectId: "de-fora" },
      ],
    });
    expect(queuesOf(comOutraPendente).pendingEvidence.map((evidence) => evidence.id)).toEqual([
      "e1",
      "e2",
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
    expect(queuesOf(rascunhoComItem).awaitingApproval.map((entry) => entry.architect.id)).toEqual([
      "ana",
    ]);
    expect(queuesOf(rascunhoVazio).awaitingApproval).toEqual([]);
  });

  it("o total de pendências é a soma das três filas", () => {
    const planoDeAna = fixtureState.plans[0]!;
    const tudoPendente = stateWith({
      assessments: fixtureState.assessments.map((assessment) =>
        assessment.id === "bruno-h2" ? { ...assessment, status: "In Review" as const } : assessment,
      ),
      plans: [{ ...planoDeAna, status: "Draft" as const }],
    });
    const queues = queuesOf(tudoPendente);
    expect(queues.awaitingCalibration).toHaveLength(1);
    expect(queues.pendingEvidence).toHaveLength(1);
    expect(queues.awaitingApproval).toHaveLength(1);
    expect(queues.totalPending).toBe(3);
    expect(queuesOf(fixtureState).totalPending).toBe(1);
  });
});
