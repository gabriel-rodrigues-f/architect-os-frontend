import { useI18n, type MessageKey } from "./i18n";
import type {
  ActionType,
  Assessment,
  DevelopmentCycle,
  DevelopmentPlan,
  DevelopmentPlanItem,
  Evidence,
  EvidenceType,
  LearningItemProgress,
  LearningItemType,
  Level,
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

/** Status da revisão da evidência pelo Tech Lead. */
const evidenceStatusKey: Record<Evidence["status"], MessageKey> = {
  Pending: "evidence.status.pending",
  Accepted: "evidence.status.accepted",
  "Needs Improvement": "evidence.status.needsImprovement",
  Rejected: "evidence.status.rejected",
};

/**
 * R2-VIS-05 (SYNAPSE-DIRECIONAMENTO-EXECUCAO.md) — a escala de proficiência
 * (`LEVELS`, `domain.ts`) tinha nome/descrição fixos em português direto no
 * código, ignorados pelo seletor de idioma; e `pt.json` mantinha um segundo
 * mapa (`level.*`) nunca lido, com nível 2 numa palavra diferente
 * ("Iniciante" × "Fundamentos"). Único mapa agora, como todo o resto deste
 * arquivo.
 */
const levelNameKey: Record<Level, MessageKey> = {
  1: "level.1",
  2: "level.2",
  3: "level.3",
  4: "level.4",
  5: "level.5",
};

const levelDescriptionKey: Record<Level, MessageKey> = {
  1: "level.1.description",
  2: "level.2.description",
  3: "level.3.description",
  4: "level.4.description",
  5: "level.5.description",
};

/**
 * O valor canônico de `LearningItemType` continua em português (é o que fica
 * gravado em `learning_path_items.type`) — diferente de `ActionType`/
 * `EvidenceType`, que já são canônicos em inglês. Aqui o mapa só traduz a
 * *exibição*; o valor persistido não muda.
 */
const learningItemTypeKey: Record<LearningItemType, MessageKey> = {
  Curso: "learningItemType.curso",
  Vídeo: "learningItemType.video",
  Livro: "learningItemType.livro",
  Artigo: "learningItemType.artigo",
  Laboratório: "learningItemType.laboratorio",
  Desafio: "learningItemType.desafio",
  Projeto: "learningItemType.projeto",
  Certificação: "learningItemType.certificacao",
  Apresentação: "learningItemType.apresentacao",
  Workshop: "learningItemType.workshop",
};

/**
 * Rótulos já traduzidos para o idioma ativo. É hook porque depende do contexto
 * de i18n — a alternativa seria passar `t` para cada chamada, o que poluiria
 * todas as telas.
 */
export function useLabels() {
  const { t } = useI18n();
  const traduzir = <K extends string | number>(mapa: Record<K, MessageKey>) =>
    Object.fromEntries(Object.entries(mapa).map(([k, v]) => [k, t(v as MessageKey)])) as Record<
      K,
      string
    >;

  return {
    planStatus: traduzir(planStatusKey),
    planItemStatus: traduzir(planItemStatusKey),
    learningStatus: traduzir(learningStatusKey),
    priority: traduzir(priorityKey),
    cycleStatus: traduzir(cycleStatusKey),
    assessmentStatus: traduzir(assessmentStatusKey),
    actionType: traduzir(actionTypeKey),
    evidenceType: traduzir(evidenceTypeKey),
    complexity: traduzir(complexityKey),
    evidenceStatus: traduzir(evidenceStatusKey),
    levelName: traduzir(levelNameKey),
    levelDescription: traduzir(levelDescriptionKey),
    learningItemType: traduzir(learningItemTypeKey),
  };
}
