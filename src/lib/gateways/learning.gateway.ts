import type { LearningPath, LearningPathItem } from "../domain";
import type { ApiClient } from "../api-client";

export interface LearningGateway {
  createLearningPath(path: LearningPath): Promise<LearningPath>;
  updateLearningPath(
    id: string,
    patch_: Partial<
      Pick<LearningPath, "name" | "description" | "competencyIds" | "assignedTo" | "items">
    >,
  ): Promise<LearningPath>;
  deleteLearningPath(id: string): Promise<void>;
  addLearningItem(pathId: string, item: LearningPathItem): Promise<LearningPath>;
  removeLearningItem(pathId: string, itemId: string): Promise<LearningPath>;
  patchLearningItemProgress(
    pathId: string,
    architectId: string,
    itemId: string,
    progress: number,
  ): Promise<LearningPath>;
}

export class HttpLearningGateway implements LearningGateway {
  constructor(private readonly client: ApiClient) {}

  createLearningPath = (path: LearningPath): Promise<LearningPath> =>
    this.client.post<LearningPath>("/api/learning-paths", path);

  updateLearningPath = (
    id: string,
    patch_: Partial<
      Pick<LearningPath, "name" | "description" | "competencyIds" | "assignedTo" | "items">
    >,
  ): Promise<LearningPath> => this.client.patch<LearningPath>(`/api/learning-paths/${id}`, patch_);

  deleteLearningPath = (id: string): Promise<void> =>
    this.client.del<void>(`/api/learning-paths/${id}`);

  addLearningItem = (pathId: string, item: LearningPathItem): Promise<LearningPath> =>
    this.client.post<LearningPath>(`/api/learning-paths/${pathId}/items`, item);

  removeLearningItem = (pathId: string, itemId: string): Promise<LearningPath> =>
    this.client.del<LearningPath>(`/api/learning-paths/${pathId}/items/${itemId}`);

  patchLearningItemProgress = (
    pathId: string,
    architectId: string,
    itemId: string,
    progress: number,
  ): Promise<LearningPath> =>
    this.client.patch<LearningPath>(
      `/api/learning-paths/${pathId}/progress/${architectId}/${itemId}`,
      {
        progress,
      },
    );
}
