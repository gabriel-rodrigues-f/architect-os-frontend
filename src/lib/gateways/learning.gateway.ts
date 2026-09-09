import type { LearningPath, LearningPathItem } from "../domain";
import type { ApiClient } from "../api-client";

export type LearningPathPatch = Partial<
  Pick<
    LearningPath,
    "name" | "description" | "competencyIds" | "assignedTo" | "completionDeadlineDays" | "items"
  >
>;

export interface LearningGateway {
  createLearningPath(path: LearningPath): Promise<LearningPath>;
  updateLearningPath(id: string, patch_: LearningPathPatch): Promise<LearningPath>;
  deleteLearningPath(id: string): Promise<void>;
  /** Fatia PRAZOS: inscrever de novo quem estourou o prazo. */
  renewLearningPathEnrollment(pathId: string, professionalId: string): Promise<LearningPath>;
  addLearningItem(pathId: string, item: LearningPathItem): Promise<LearningPath>;
  removeLearningItem(pathId: string, itemId: string): Promise<LearningPath>;
  patchLearningItemProgress(
    pathId: string,
    professionalId: string,
    itemId: string,
    progress: number,
  ): Promise<LearningPath>;
}

export class HttpLearningGateway implements LearningGateway {
  constructor(private readonly client: ApiClient) {}

  createLearningPath = (path: LearningPath): Promise<LearningPath> =>
    this.client.post<LearningPath>("/learning-paths", path);

  updateLearningPath = (id: string, patch_: LearningPathPatch): Promise<LearningPath> =>
    this.client.patch<LearningPath>(`/learning-paths/${id}`, patch_);

  renewLearningPathEnrollment = (pathId: string, professionalId: string): Promise<LearningPath> =>
    this.client.post<LearningPath>(
      `/learning-paths/${pathId}/enrollments/${professionalId}`,
      undefined,
    );

  deleteLearningPath = (id: string): Promise<void> =>
    this.client.del<void>(`/learning-paths/${id}`);

  addLearningItem = (pathId: string, item: LearningPathItem): Promise<LearningPath> =>
    this.client.post<LearningPath>(`/learning-paths/${pathId}/items`, item);

  removeLearningItem = (pathId: string, itemId: string): Promise<LearningPath> =>
    this.client.del<LearningPath>(`/learning-paths/${pathId}/items/${itemId}`);

  patchLearningItemProgress = (
    pathId: string,
    professionalId: string,
    itemId: string,
    progress: number,
  ): Promise<LearningPath> =>
    this.client.patch<LearningPath>(
      `/learning-paths/${pathId}/progress/${professionalId}/${itemId}`,
      {
        progress,
      },
    );
}
