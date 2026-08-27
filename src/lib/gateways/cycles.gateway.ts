import type { DevelopmentCycle } from "../domain";
import type { ApiClient } from "../api-client";

export interface CyclesGateway {
  setActiveCycle(cycleId: string): Promise<{ cycleId: string }>;
  createCycle(cycle: DevelopmentCycle): Promise<DevelopmentCycle>;
  updateCycle(id: string, patch_: Partial<Omit<DevelopmentCycle, "id">>): Promise<DevelopmentCycle>;
  deleteCycle(id: string): Promise<void>;
}

export class HttpCyclesGateway implements CyclesGateway {
  constructor(private readonly client: ApiClient) {}

  setActiveCycle = (cycleId: string): Promise<{ cycleId: string }> =>
    this.client.put<{ cycleId: string }>("/settings/active-cycle", { cycleId });

  createCycle = (cycle: DevelopmentCycle): Promise<DevelopmentCycle> =>
    this.client.post<DevelopmentCycle>("/cycles", cycle);

  updateCycle = (
    id: string,
    patch_: Partial<Omit<DevelopmentCycle, "id">>,
  ): Promise<DevelopmentCycle> => this.client.patch<DevelopmentCycle>(`/cycles/${id}`, patch_);

  deleteCycle = (id: string): Promise<void> => this.client.del<void>(`/cycles/${id}`);
}
