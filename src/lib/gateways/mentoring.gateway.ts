import type { MentoringSession, ProficiencyUpdate } from "../domain";
import type { ApiClient } from "../api-client";

/**
 * OO-FE-02 — gateway do contexto "mentoria". Ver `cycles.gateway.ts` para a
 * explicação do padrão interface + `Http*` e do porquê dos métodos serem
 * arrow functions de campo (spread-safe na fachada `api.ts`).
 */
export interface MentoringGateway {
  createMentoringSession(
    session: MentoringSession,
    proficiencyUpdates?: ProficiencyUpdate[],
  ): Promise<MentoringSession>;
  scheduleMentoringFollowUp(id: string, nextSession: string | null): Promise<MentoringSession>;
}

export class HttpMentoringGateway implements MentoringGateway {
  constructor(private readonly client: ApiClient) {}

  createMentoringSession = (
    session: MentoringSession,
    proficiencyUpdates: ProficiencyUpdate[] = [],
  ): Promise<MentoringSession> =>
    this.client.post<MentoringSession>("/api/mentoring-sessions", {
      ...session,
      proficiencyUpdates,
    });

  scheduleMentoringFollowUp = (id: string, nextSession: string | null): Promise<MentoringSession> =>
    this.client.patch<MentoringSession>(`/api/mentoring-sessions/${id}`, { nextSession });
}
