import type {
  ActionType,
  Architect,
  Assessment,
  DevelopmentCycle,
  DevelopmentPlan,
  DevelopmentPlanItem,
  EvidenceType,
  LearningPathItem,
} from "./domain";

/**
 * Rótulos em português para os valores que ficam gravados em inglês no banco.
 *
 * O valor canônico continua sendo o inglês — é o que a API valida e o que já
 * está persistido. A tradução acontece só na exibição, então mudar um rótulo
 * aqui não exige migração de dados.
 */

export const assessmentStatusLabel: Record<Assessment["status"], string> = {
  Draft: "Rascunho",
  "In Review": "Em revisão",
  Completed: "Concluído",
};

export const planStatusLabel: Record<DevelopmentPlan["status"], string> = {
  Draft: "Rascunho",
  Approved: "Aprovado",
  Completed: "Concluído",
};

export const planItemStatusLabel: Record<DevelopmentPlanItem["status"], string> = {
  "Not Started": "Não iniciado",
  "In Progress": "Em andamento",
  Blocked: "Bloqueado",
  Completed: "Concluído",
};

export const learningStatusLabel: Record<LearningPathItem["status"], string> = {
  "Not Started": "Não iniciado",
  "In Progress": "Em andamento",
  Completed: "Concluído",
};

export const priorityLabel: Record<DevelopmentPlanItem["priority"], string> = {
  Low: "Baixa",
  Medium: "Média",
  High: "Alta",
  Critical: "Crítica",
};

/** Usado em performance e potencial (matriz 9-box). */
export const ratingLabel: Record<Architect["performance"], string> = {
  Low: "Baixo",
  Medium: "Médio",
  High: "Alto",
};

export const cycleStatusLabel: Record<DevelopmentCycle["status"], string> = {
  Active: "Ativo",
  Closed: "Encerrado",
  Planned: "Planejado",
};

export const actionTypeLabel: Record<ActionType, string> = {
  Learn: "Aprender",
  Practice: "Praticar",
  Apply: "Aplicar",
  Teach: "Ensinar",
  Mentor: "Mentorar",
  Lead: "Liderar",
};

export const evidenceTypeLabel: Record<EvidenceType, string> = {
  "Architecture Design": "Desenho de arquitetura",
  ADR: "ADR",
  "Technical Presentation": "Apresentação técnica",
  Workshop: "Workshop",
  Project: "Projeto",
  Certification: "Certificação",
  Course: "Curso",
  "Proof of Concept": "Prova de conceito",
  "Architecture Review": "Revisão de arquitetura",
  Mentoring: "Mentoria",
  "Technical Article": "Artigo técnico",
};

/** Nível de complexidade de uma evidência. */
export const complexityLabel: Record<"Low" | "Medium" | "High", string> = {
  Low: "Baixa",
  Medium: "Média",
  High: "Alta",
};
