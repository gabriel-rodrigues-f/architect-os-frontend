import type { CareerLevel, CareerLevelPolicy } from "../domain";
import { careerLevelsResponseSchema } from "../api-schemas";
import type { ApiClient } from "../api-client";

export interface CareerGateway {
  careerLevels(): Promise<CareerLevel[]>;
  updateCareerLevelPolicy(
    careerLevelId: string,
    minimumQualifiedCapabilities: number,
  ): Promise<CareerLevelPolicy>;
}

export class HttpCareerGateway implements CareerGateway {
  constructor(private readonly client: ApiClient) {}

  careerLevels = (): Promise<CareerLevel[]> =>
    this.client
      .request<CareerLevel[]>("/career-levels")
      .then((data) => careerLevelsResponseSchema.parse(data));

  updateCareerLevelPolicy = (
    careerLevelId: string,
    minimumQualifiedCapabilities: number,
  ): Promise<CareerLevelPolicy> =>
    this.client.patch<CareerLevelPolicy>(`/career-levels/${careerLevelId}/policy`, {
      minimumQualifiedCapabilities,
    });
}
