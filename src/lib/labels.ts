import { useMemo } from "react";

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

/**
 * R2-VIS-07 (SYNAPSE-DIRECIONAMENTO-EXECUCAO.md) — o item do PDI é "a ação"
 * (fem.), então o particípio de status concorda em gênero: "Bloqueada", não
 * o "Bloqueado" genérico usado pelo PDI como um todo (`planStatusKey`, "o
 * PDI", masc.). "Em andamento" não é particípio, não flexiona.
 */
const planItemStatusKey: Record<DevelopmentPlanItem["status"], MessageKey> = {
  "Not Started": "status.planItem.notStarted",
  "In Progress": "status.inProgress",
  Blocked: "status.planItem.blocked",
  Completed: "status.planItem.completed",
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

/** R2-VIS-07 — "a Avaliação" é fem.: "Concluída", não o "Concluído" genérico. */
const assessmentStatusKey: Record<Assessment["status"], MessageKey> = {
  Draft: "status.draft",
  "In Review": "status.inReview",
  Completed: "status.assessment.completed",
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

const traduzir = <K extends string | number>(
  mapa: Record<K, MessageKey>,
  t: (key: MessageKey, vars?: Record<string, string | number>) => string,
): Record<K, string> =>
  Object.fromEntries(Object.entries(mapa).map(([k, v]) => [k, t(v as MessageKey)])) as Record<
    K,
    string
  >;

/**
 * OO2-08 (AUDITORIA-OO-PADRONIZACAO-ANALYTICS-IA-SYNAPSE-2026-08-25.md,
 * Seção 68) — `useLabels()` virou um adaptador fino (Seção 61) em cima
 * desta classe: todo o trabalho de traduzir os mapas acima mora aqui,
 * como campos calculados no construtor a partir de um `t` fixo — mesmo
 * momento em que a função `traduzir()` rodava antes (uma vez por chamada
 * de `useLabels()`), só que agora nomeado e reutilizável fora de um hook
 * (ex.: um teste que quer os rótulos sem montar `I18nProvider`, passando
 * um `t` fake).
 */
export class LabelFormatter {
  readonly planStatus: Record<DevelopmentPlan["status"], string>;
  readonly planItemStatus: Record<DevelopmentPlanItem["status"], string>;
  readonly learningStatus: Record<LearningItemProgress["status"], string>;
  readonly priority: Record<DevelopmentPlanItem["priority"], string>;
  readonly cycleStatus: Record<DevelopmentCycle["status"], string>;
  readonly assessmentStatus: Record<Assessment["status"], string>;
  readonly actionType: Record<ActionType, string>;
  readonly evidenceType: Record<EvidenceType, string>;
  readonly complexity: Record<"Low" | "Medium" | "High", string>;
  readonly evidenceStatus: Record<Evidence["status"], string>;
  readonly levelName: Record<Level, string>;
  readonly levelDescription: Record<Level, string>;
  readonly learningItemType: Record<LearningItemType, string>;

  constructor(t: (key: MessageKey, vars?: Record<string, string | number>) => string) {
    this.planStatus = traduzir(planStatusKey, t);
    this.planItemStatus = traduzir(planItemStatusKey, t);
    this.learningStatus = traduzir(learningStatusKey, t);
    this.priority = traduzir(priorityKey, t);
    this.cycleStatus = traduzir(cycleStatusKey, t);
    this.assessmentStatus = traduzir(assessmentStatusKey, t);
    this.actionType = traduzir(actionTypeKey, t);
    this.evidenceType = traduzir(evidenceTypeKey, t);
    this.complexity = traduzir(complexityKey, t);
    this.evidenceStatus = traduzir(evidenceStatusKey, t);
    this.levelName = traduzir(levelNameKey, t);
    this.levelDescription = traduzir(levelDescriptionKey, t);
    this.learningItemType = traduzir(learningItemTypeKey, t);
  }
}

/**
 * Rótulos já traduzidos para o idioma ativo. É hook porque depende do contexto
 * de i18n — a alternativa seria passar `t` para cada chamada, o que poluiria
 * todas as telas. `useMemo` por `t` evita recalcular os 13 mapas em todo
 * render quando o idioma não mudou (`t` só troca de referência quando o
 * `I18nProvider` troca de idioma) — antes cada chamada de `useLabels()`
 * recomputava tudo incondicionalmente; o resultado final é idêntico, só
 * mais barato quando o idioma fica parado.
 */
export function useLabels(): LabelFormatter {
  const { t } = useI18n();
  return useMemo(() => new LabelFormatter(t), [t]);
}
