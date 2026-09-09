import type { SessionUser } from "../api";
import type {
  LearningItemProgress,
  LearningItemType,
  LearningPath,
  LearningPathItem,
} from "../domain";
import { LearningPathEnrollmentReading } from "../learning-path-enrollment";
import type { Api } from "../store";

export type LearningPathService = Pick<
  Api,
  | "addLearningPath"
  | "updateLearningPath"
  | "removeLearningPath"
  | "addLearningPathItem"
  | "removeLearningPathItem"
  | "updateLearningItemProgress"
  | "renewLearningPathEnrollment"
>;

/** O que a tela precisa dizer sobre a inscrição de uma pessoa (fatia PRAZOS). */
export interface LearningPathDeadlineReading {
  readonly hasDeadline: boolean;
  readonly expired: boolean;
  readonly daysLeft: number | undefined;
  readonly dueAt: string | undefined;
}

export class LearningPathsViewModel {
  constructor(private readonly service: LearningPathService) {}

  progressFor(
    path: Pick<LearningPath, "progress">,
    professionalId: string,
    itemId: string,
  ): LearningItemProgress {
    return (
      path.progress.find((p) => p.professionalId === professionalId && p.itemId === itemId) ?? {
        professionalId,
        itemId,
        status: "Not Started",
        progress: 0,
      }
    );
  }

  private personProgress(
    path: Pick<LearningPath, "progress" | "items">,
    professionalId: string,
  ): number {
    const values = path.items.map(
      (item) => this.progressFor(path, professionalId, item.id).progress,
    );
    return values.length ? values.reduce((s, v) => s + v, 0) / values.length : 0;
  }

  progressPercentFor(
    path: Pick<LearningPath, "progress" | "items">,
    professionalId: string,
  ): number {
    return Math.round(this.personProgress(path, professionalId));
  }

  teamProgressPercent(path: Pick<LearningPath, "progress" | "items" | "assignedTo">): number {
    const perPerson = path.assignedTo.map((professionalId) =>
      this.personProgress(path, professionalId),
    );
    return perPerson.length
      ? Math.round(perPerson.reduce((s, v) => s + v, 0) / perPerson.length)
      : 0;
  }

  /**
   * Fatia PRAZOS — o prazo de UMA pessoa nesta trilha: quanto falta, se
   * venceu, quando vence. A conta é a mesma do backend
   * (`LearningPathEnrollment`); a tela pergunta para não oferecer um controle
   * que o servidor vai negar.
   */
  deadlineFor(
    path: Pick<LearningPath, "enrollments" | "completionDeadlineDays">,
    professionalId: string,
    at: Date,
  ): LearningPathDeadlineReading | undefined {
    const enrollment = LearningPathEnrollmentReading.of(path, professionalId);
    if (!enrollment) return undefined;
    return {
      hasDeadline: enrollment.hasDeadline,
      expired: enrollment.expiredAt(at),
      daysLeft: enrollment.daysLeftAt(at),
      dueAt: enrollment.dueAt,
    };
  }

  createPath(
    user: Pick<SessionUser, "email" | "id">,
    form: { name: string; description: string; completionDeadlineDays: number | null },
    competencyIds: string[],
    assignedTo: string[],
  ): Promise<LearningPath> {
    const enrolledAt = new Date().toISOString();
    return this.service.addLearningPath({
      id: "",
      name: form.name.trim(),
      description: form.description.trim(),
      competencyIds,
      assignedTo,
      enrollments: assignedTo.map((professionalId) => ({ professionalId, enrolledAt })),
      completionDeadlineDays: form.completionDeadlineDays,
      items: [],
      progress: [],
      createdBy: user.email,
      createdByUserId: user.id,
      createdAt: enrolledAt,
    });
  }

  /**
   * A EDIÇÃO PEDIDA, e o que ela grava — a mesma régua do `removeItem` daqui
   * de baixo: otimista, `onConfirmed` roda quando o SERVIÇO confirma, e é lá
   * que mora o aviso de sucesso, nunca no clique.
   */
  updateDetails(
    path: Pick<LearningPath, "id" | "name">,
    form: { name: string; description: string; completionDeadlineDays: number | null },
    onConfirmed?: (updated: LearningPath) => void,
  ): void {
    this.service.updateLearningPath(path.id, this.detailsPatchOf(path, form), onConfirmed);
  }

  /**
   * O QUE SOBE NO PATCH — publicado para a tela conseguir perguntar se ainda
   * há alteração pendente sem reconstruir a conta por fora (nome vazio cai no
   * nome atual da trilha).
   */
  detailsPatchOf(
    path: Pick<LearningPath, "name">,
    form: { name: string; description: string; completionDeadlineDays: number | null },
  ): Pick<LearningPath, "name" | "description" | "completionDeadlineDays"> {
    return {
      name: form.name.trim() || path.name,
      description: form.description,
      completionDeadlineDays: form.completionDeadlineDays,
    };
  }

  /**
   * Ainda há o que salvar? A gravação otimista já deixou a trilha com os
   * valores enviados antes da resposta, então isto vira `false` no instante
   * do clique e volta a `true` se o serviço recusar e o rollback devolver os
   * valores antigos — é a tranca do segundo envio, derivada do estado, sem
   * `saving` local que ficaria preso na recusa.
   */
  hasPendingDetails(
    path: Pick<LearningPath, "name" | "description" | "completionDeadlineDays">,
    form: { name: string; description: string; completionDeadlineDays: number | null },
  ): boolean {
    const patch = this.detailsPatchOf(path, form);
    return (
      patch.name !== path.name ||
      patch.description !== path.description ||
      patch.completionDeadlineDays !== path.completionDeadlineDays
    );
  }

  toggleCompetency(path: Pick<LearningPath, "id" | "competencyIds">, competencyId: string): void {
    const current = path.competencyIds;
    this.service.updateLearningPath(path.id, {
      competencyIds: current.includes(competencyId)
        ? current.filter((id) => id !== competencyId)
        : [...current, competencyId],
    });
  }

  toggleAssignment(path: Pick<LearningPath, "id" | "assignedTo">, professionalId: string): void {
    const current = path.assignedTo;
    this.service.updateLearningPath(path.id, {
      assignedTo: current.includes(professionalId)
        ? current.filter((id) => id !== professionalId)
        : [...current, professionalId],
    });
  }

  addItem(pathId: string, title: string, type: LearningItemType, hours: string): void {
    this.service.addLearningPathItem(pathId, {
      id: `lpi-${Date.now()}`,
      title: title.trim(),
      type,
      hours: Number(hours) || 1,
    });
  }

  updateItem(
    path: Pick<LearningPath, "id" | "items">,
    itemId: string,
    patch: Partial<Pick<LearningPathItem, "type" | "title" | "hours">>,
  ): void {
    this.service.updateLearningPath(path.id, {
      items: path.items.map((item) => (item.id === itemId ? { ...item, ...patch } : item)),
    });
  }

  removeItem(pathId: string, itemId: string): void {
    this.service.removeLearningPathItem(pathId, itemId);
  }

  /** Otimista: `onConfirmed` roda quando o serviço confirma — o aviso de sucesso vai lá, não no clique. */
  removePath(pathId: string, onConfirmed?: () => void): void {
    this.service.removeLearningPath(pathId, onConfirmed);
  }

  recordProgress(pathId: string, professionalId: string, itemId: string, progress: number): void {
    this.service.updateLearningItemProgress(pathId, professionalId, itemId, progress);
  }

  /** Fatia PRAZOS — inscrever de novo quem estourou o prazo: o relógio recomeça, o estudo fica. */
  renewEnrollment(pathId: string, professionalId: string): Promise<LearningPath> {
    return this.service.renewLearningPathEnrollment(pathId, professionalId);
  }
}
