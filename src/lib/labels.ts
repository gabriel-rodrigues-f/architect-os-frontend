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

const planStatusKey: Record<DevelopmentPlan["status"], MessageKey> = {
  Draft: "status.draft",
  Approved: "status.approved",
  Completed: "status.completed",
};

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

const complexityKey: Record<"Low" | "Medium" | "High", MessageKey> = {
  Low: "complexity.low",
  Medium: "complexity.medium",
  High: "complexity.high",
};

const evidenceStatusKey: Record<Evidence["status"], MessageKey> = {
  Pending: "evidence.status.pending",
  Accepted: "evidence.status.accepted",
  "Needs Improvement": "evidence.status.needsImprovement",
  Rejected: "evidence.status.rejected",
};

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

type Translate = (key: MessageKey, vars?: Record<string, string | number>) => string;

const traduzir = <K extends string | number>(
  mapa: Record<K, MessageKey>,
  t: Translate,
): Record<K, string> =>
  Object.fromEntries(Object.entries(mapa).map(([k, v]) => [k, t(v as MessageKey)])) as Record<
    K,
    string
  >;

export const LABEL_KEY_MAPS = {
  planStatus: planStatusKey,
  planItemStatus: planItemStatusKey,
  learningStatus: learningStatusKey,
  priority: priorityKey,
  cycleStatus: cycleStatusKey,
  assessmentStatus: assessmentStatusKey,
  actionType: actionTypeKey,
  evidenceType: evidenceTypeKey,
  complexity: complexityKey,
  evidenceStatus: evidenceStatusKey,
  levelName: levelNameKey,
  levelDescription: levelDescriptionKey,
  learningItemType: learningItemTypeKey,
} as const;

type LabelMaps = {
  readonly [K in keyof typeof LABEL_KEY_MAPS]: Record<
    keyof (typeof LABEL_KEY_MAPS)[K] & (string | number),
    string
  >;
};

// eslint-disable-next-line @typescript-eslint/no-empty-object-type, @typescript-eslint/no-unsafe-declaration-merging -- merge intencional (OO3-11f): dá à classe os 13 campos tipados que o laço do construtor preenche.
export interface LabelFormatter extends LabelMaps {}
// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging -- par do merge acima.
export class LabelFormatter {
  constructor(t: Translate) {
    Object.assign(
      this,
      Object.fromEntries(
        Object.entries(LABEL_KEY_MAPS).map(([nome, mapa]) => [
          nome,
          traduzir(mapa as Record<string, MessageKey>, t),
        ]),
      ),
    );
  }
}

export function useLabels(): LabelFormatter {
  const { t } = useI18n();
  return useMemo(() => new LabelFormatter(t), [t]);
}
