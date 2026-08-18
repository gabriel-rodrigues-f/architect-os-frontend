import { useI18n, type MessageKey } from "./i18n";
import type {
  ActionType,
  Architect,
  Assessment,
  DevelopmentCycle,
  DevelopmentPlan,
  DevelopmentPlanItem,
  EvidenceType,
  LearningItemProgress,
} from "./domain";

/**
 * Rótulos dos valores que ficam gravados em inglês no banco.
 *
 * O valor canônico continua sendo o inglês — é o que a API valida e o que já
 * está persistido. A tradução acontece só na exibição, então trocar um rótulo
 * não exige migração de dados.
 *
 * Os mapas apontam para *chaves* de mensagem, não para texto: o texto vem do
 * arquivo do idioma ativo. Antes eram strings fixas em português, o que
 * deixava metade da interface fora do seletor de idioma.
 */

const planStatusKey: Record<DevelopmentPlan["status"], MessageKey> = {
  Draft: "status.draft",
  Approved: "status.approved",
  Completed: "status.completed",
};

const planItemStatusKey: Record<DevelopmentPlanItem["status"], MessageKey> = {
  "Not Started": "status.notStarted",
  "In Progress": "status.inProgress",
  Blocked: "status.blocked",
  Completed: "status.completed",
};

const learningStatusKey: Record<LearningItemProgress["status"], MessageKey> = {
  "Not Started": "status.notStarted",
  "In Progress": "status.inProgress",
  Completed: "status.completed",
};

const priorityKey: Record<DevelopmentPlanItem["priority"], MessageKey> = {
  Low: "priority.low",
  Medium: "priority.medium",
  High: "priority.high",
  Critical: "priority.critical",
};

/** Usado em desempenho e potencial (matriz 9-box). */
const ratingKey: Record<Architect["performance"], MessageKey> = {
  Low: "rating.low",
  Medium: "rating.medium",
  High: "rating.high",
};

const cycleStatusKey: Record<DevelopmentCycle["status"], MessageKey> = {
  Active: "status.active",
  Closed: "status.closed",
  Planned: "status.planned",
};

const assessmentStatusKey: Record<Assessment["status"], MessageKey> = {
  Draft: "status.draft",
  "In Review": "status.inReview",
  Completed: "status.completed",
};

const actionTypeKey: Record<ActionType, MessageKey> = {
  Learn: "action.learn",
  Practice: "action.practice",
  Apply: "action.apply",
  Teach: "action.teach",
  Mentor: "action.mentor",
  Lead: "action.lead",
};

const evidenceTypeKey: Record<EvidenceType, MessageKey> = {
  "Architecture Design": "evidence.architectureDesign",
  ADR: "evidence.adr",
  "Technical Presentation": "evidence.technicalPresentation",
  Workshop: "evidence.workshop",
  Project: "evidence.project",
  Certification: "evidence.certification",
  Course: "evidence.course",
  "Proof of Concept": "evidence.proofOfConcept",
  "Architecture Review": "evidence.architectureReview",
  Mentoring: "evidence.mentoring",
  "Technical Article": "evidence.technicalArticle",
};

/** Nível de complexidade de uma evidência. */
const complexityKey: Record<"Low" | "Medium" | "High", MessageKey> = {
  Low: "complexity.low",
  Medium: "complexity.medium",
  High: "complexity.high",
};

/**
 * Rótulos já traduzidos para o idioma ativo. É hook porque depende do contexto
 * de i18n — a alternativa seria passar `t` para cada chamada, o que poluiria
 * todas as telas.
 */
export function useLabels() {
  const { t } = useI18n();
  const traduzir = <K extends string>(mapa: Record<K, MessageKey>) =>
    Object.fromEntries(Object.entries(mapa).map(([k, v]) => [k, t(v as MessageKey)])) as Record<
      K,
      string
    >;

  return {
    planStatus: traduzir(planStatusKey),
    planItemStatus: traduzir(planItemStatusKey),
    learningStatus: traduzir(learningStatusKey),
    priority: traduzir(priorityKey),
    rating: traduzir(ratingKey),
    cycleStatus: traduzir(cycleStatusKey),
    assessmentStatus: traduzir(assessmentStatusKey),
    actionType: traduzir(actionTypeKey),
    evidenceType: traduzir(evidenceTypeKey),
    complexity: traduzir(complexityKey),
  };
}
