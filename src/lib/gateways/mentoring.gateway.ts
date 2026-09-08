import type { MentoringSession } from "../domain";
import type { ApiClient } from "../api-client";

export interface MentoringGateway {
  createMentoringSession(session: MentoringSession): Promise<MentoringSession>;
  scheduleMentoringFollowUp(id: string, nextSession: string | null): Promise<MentoringSession>;
}

export class HttpMentoringGateway implements MentoringGateway {
  constructor(private readonly client: ApiClient) {}

  createMentoringSession = (session: MentoringSession): Promise<MentoringSession> =>
    this.client.post<MentoringSession>("/mentoring-sessions", session);

  scheduleMentoringFollowUp = (id: string, nextSession: string | null): Promise<MentoringSession> =>
    this.client.patch<MentoringSession>(`/mentoring-sessions/${id}`, { nextSession });
}
