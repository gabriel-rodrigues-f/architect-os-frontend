import type { ApiClient } from "../api-client";

/** O panorama de operação do administrador — só contagens (D1, 2026-09-05). */
export interface OperationsOverview {
  people: { active: number; deactivated: number };
  teams: { active: number; deactivated: number };
  accounts: { active: number; disabled: number; byRole: Record<string, number> };
  cycle: { id: string; name: string } | null;
  assessments: Record<string, number>;
  plans: Record<string, number>;
}

export interface OperationsGateway {
  overview(): Promise<OperationsOverview>;
}

export class ApiOperationsGateway implements OperationsGateway {
  constructor(private readonly client: ApiClient) {}

  overview = (): Promise<OperationsOverview> =>
    this.client.request<OperationsOverview>("/operations/overview");
}
