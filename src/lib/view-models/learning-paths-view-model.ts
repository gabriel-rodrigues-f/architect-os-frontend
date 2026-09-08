import type { SessionUser } from "../api";
import type {
  LearningItemProgress,
  LearningItemType,
  LearningPath,
  LearningPathItem,
} from "../domain";
import type { Api } from "../store";

export type LearningPathService = Pick<
  Api,
  | "addLearningPath"
  | "updateLearningPath"
  | "removeLearningPath"
  | "addLearningPathItem"
  | "removeLearningPathItem"
  | "updateLearningItemProgress"
>;

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

  createPath(
    user: Pick<SessionUser, "email" | "id">,
    form: { name: string; description: string },
    competencyIds: string[],
    assignedTo: string[],
  ): Promise<LearningPath> {
    return this.service.addLearningPath({
      id: "",
      name: form.name.trim(),
      description: form.description.trim(),
      competencyIds,
      assignedTo,
      items: [],
      progress: [],
      createdBy: user.email,
      createdByUserId: user.id,
      createdAt: new Date().toISOString(),
    });
  }

  updateDetails(
    path: Pick<LearningPath, "id" | "name">,
    form: { name: string; description: string },
  ): void {
    this.service.updateLearningPath(path.id, {
      name: form.name.trim() || path.name,
      description: form.description,
    });
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
}
