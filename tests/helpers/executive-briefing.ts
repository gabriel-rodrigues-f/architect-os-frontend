import { apiPath } from "@/lib/api-path";
import type { ExecutiveBriefing } from "@/lib/gateways/executive-dashboard.gateway";

import { jsonResponse } from "./render-app";

/**
 * A LEITURA EXECUTIVA como o servidor a devolve (onda 3 do Painel Executivo).
 *
 * Desde que o Painel virou UM pedido, toda tela que monta `/` precisa desta
 * resposta — inclusive as suítes que não falam do Painel e só passam por ele
 * (o estrangulamento do blob, o mapa de calor, o painel do profissional).
 * Sem ela a tela fica no esqueleto e o teste morre por timeout, dizendo
 * "não achei o texto" quando o defeito era outro. Uma fixture só, aqui.
 */
/** O ciclo da leitura de teste. */
const CICLO = { id: "cy-2", name: "2026 H2", start: "2026-07-01", end: "2026-12-31" };

export const LEITURA_EXECUTIVA_VAZIA: ExecutiveBriefing = {
  cycle: CICLO,
  comparedCycle: null,
  population: { inScope: 0, outOfScope: 0 },
  coverage: { cycle: CICLO, completed: { part: 0, whole: 0 } },
  previousCoverage: null,
  decisionsOnTheDesk: { total: 0, awaitingCalibration: [], awaitingPlanApproval: [] },
  peopleWhoNeedYou: { part: 0, whole: 0 },
  health: {
    funnel: {
      cycle: CICLO,
      steps: [
        { kind: "NOT_STARTED", people: 0 },
        { kind: "DRAFT", people: 0 },
        { kind: "IN_REVIEW", people: 0 },
        { kind: "COMPLETED", people: 0 },
      ],
      biggestHoldUp: [],
    },
    previousFunnel: null,
    planCoverage: { cycle: CICLO, approved: { part: 0, whole: 0 } },
    previousPlanCoverage: null,
    goalsCompleted: { part: 0, whole: 0 },
    peopleWithoutPlan: [],
    openAndUnscored: [],
  },
  valueCreated: { movement: null, gapMovement: null, promotions: [] },
  trend: { available: false, cyclesWithReading: 1, cyclesRequired: 3, cycleNamesWithReading: [] },
  arrowRuler: { comparablePeople: 0, minimumRelativeChange: null, anyArrowEarned: false },
  risks: {
    criticalGapConcentration: {
      criticalThreshold: 3,
      minimumCompetencies: 3,
      carriers: [],
      assessedWithNoCriticalGap: 0,
      averageGap: null,
      previousAverageGap: null,
    },
    withoutApplicableRuler: { people: { part: 0, whole: 0 }, groups: [] },
    overdueFollowUps: [],
    oneOnOneRecency: [],
    longestSilenceDays: null,
    stalledLearningPaths: [],
  },
  recommendedActions: [],
  actionWeights: [
    "OVERDUE_ONE_ON_ONE",
    "ASSESSMENT_NOT_COMPLETED",
    "NO_APPROVED_PLAN",
    "CRITICAL_GAP_CONCENTRATION",
    "STALLED_LEARNING_PATH",
  ],
  documentedDependencies: [],
};

/** A rota de `GET /dashboard/executive`, para somar às `routes` do `mockAppFetch`. */
export const executiveBriefingRoute = (href: string) =>
  href.includes(apiPath("/dashboard/executive"))
    ? jsonResponse(LEITURA_EXECUTIVA_VAZIA)
    : undefined;
