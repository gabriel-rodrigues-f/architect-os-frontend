import { ApiError } from "../api-errors";
import type { ApiClient } from "../api-client";
import { teamTransferRequestSchema, teamTransferRequestsResponseSchema } from "../api-schemas";
import type {
  Architect,
  TeamTransferRequest,
  TeamTransferRequestStatus,
  TeamTransferRequestView,
} from "../domain";
import type { SessionUser } from "./auth.gateway";
import type { TeamSummary } from "./teams.gateway";

/**
 * Contrato do backend ebb305f — a mudança de time como SOLICITAÇÃO:
 *   POST /architects/:id/team-transfer-requests { toTeamId, reason }   — o gerente do time atual
 *   GET  /team-transfer-requests?status=pending                          — as minhas ∪ as do meu destino
 *   POST /team-transfer-requests/:id/approve { note? }                   — o gerente do destino (ou admin)
 *   POST /team-transfer-requests/:id/refuse  { note }                    — idem, nota obrigatória
 *   POST /team-transfer-requests/:id/cancel                              — quem pediu (ou admin)
 */
export interface TeamTransfersGateway {
  requestTeamTransfer(
    architectId: string,
    toTeamId: string,
    reason: string,
  ): Promise<TeamTransferRequest>;
  teamTransferRequests(status?: TeamTransferRequestStatus): Promise<TeamTransferRequestView[]>;
  approveTeamTransfer(requestId: string, note?: string): Promise<TeamTransferRequest>;
  refuseTeamTransfer(requestId: string, note: string): Promise<TeamTransferRequest>;
  cancelTeamTransfer(requestId: string): Promise<TeamTransferRequest>;
}

export class HttpTeamTransfersGateway implements TeamTransfersGateway {
  constructor(private readonly client: ApiClient) {}

  requestTeamTransfer = (
    architectId: string,
    toTeamId: string,
    reason: string,
  ): Promise<TeamTransferRequest> =>
    this.client
      .post<unknown>(`/architects/${architectId}/team-transfer-requests`, { toTeamId, reason })
      .then((data) => this.snapshot(data));

  teamTransferRequests = (
    status?: TeamTransferRequestStatus,
  ): Promise<TeamTransferRequestView[]> => {
    const query = status === undefined ? "" : `?${new URLSearchParams({ status }).toString()}`;
    return this.client
      .request<unknown>(`/team-transfer-requests${query}`)
      .then((data) => teamTransferRequestsResponseSchema.parse(data));
  };

  approveTeamTransfer = (requestId: string, note?: string): Promise<TeamTransferRequest> =>
    this.client
      .post<unknown>(
        `/team-transfer-requests/${requestId}/approve`,
        note === undefined ? {} : { note },
      )
      .then((data) => this.snapshot(data));

  refuseTeamTransfer = (requestId: string, note: string): Promise<TeamTransferRequest> =>
    this.client
      .post<unknown>(`/team-transfer-requests/${requestId}/refuse`, { note })
      .then((data) => this.snapshot(data));

  cancelTeamTransfer = (requestId: string): Promise<TeamTransferRequest> =>
    this.client
      .request<unknown>(`/team-transfer-requests/${requestId}/cancel`, { method: "POST" })
      .then((data) => this.snapshot(data));

  /**
   * O `ApiClient` guarda o `message.code` num WeakMap indexado pelo OBJETO
   * devolvido; o parse do zod criaria outro objeto e perderia o código do
   * toast. Valida, mas devolve o original.
   */
  private snapshot(data: unknown): TeamTransferRequest {
    teamTransferRequestSchema.parse(data);
    return data as TeamTransferRequest;
  }
}

export class TeamTransferRefusal {
  static reasonRequired(): ApiError {
    return new ApiError("Informe o motivo da transferência.", 400, undefined, "VALIDATION_ERROR");
  }

  static noteRequired(): ApiError {
    return new ApiError("Informe a nota da recusa.", 400, undefined, "VALIDATION_ERROR");
  }

  static toSameTeam(): ApiError {
    return new ApiError(
      "A pessoa já está neste time.",
      400,
      undefined,
      "TEAM_TRANSFER_TO_SAME_TEAM",
    );
  }

  static alreadyPending(architect: Architect): ApiError {
    return new ApiError(
      `${architect.name} já tem uma transferência pendente.`,
      409,
      undefined,
      "TEAM_TRANSFER_REQUEST_PENDING",
    );
  }

  static alreadyDecided(): ApiError {
    return new ApiError(
      "Esta solicitação já foi decidida.",
      409,
      undefined,
      "TEAM_TRANSFER_REQUEST_ALREADY_DECIDED",
    );
  }

  static requestNotFound(requestId: string): ApiError {
    return new ApiError(
      `Solicitação ${requestId} não encontrada.`,
      404,
      undefined,
      "TEAM_TRANSFER_REQUEST_NOT_FOUND",
    );
  }

  static personNotFound(architectId: string): ApiError {
    return new ApiError(
      `Profissional ${architectId} não encontrado.`,
      404,
      undefined,
      "ARCHITECT_NOT_FOUND",
    );
  }

  static teamNotFound(teamId: string): ApiError {
    return new ApiError(`Time ${teamId} não encontrado.`, 404, undefined, "TEAM_NOT_FOUND");
  }
}

/**
 * O oráculo do contrato para as telas e os testes: reproduz as recusas do
 * backend e a consequência da aprovação (a pessoa migra).
 */
export class InMemoryTeamTransfersGateway implements TeamTransfersGateway {
  private readonly peopleById: Map<string, Architect>;
  private readonly requests: TeamTransferRequest[] = [];
  private sequence = 0;

  constructor(
    people: readonly Architect[],
    private readonly teams: readonly TeamSummary[],
    private readonly actor: Pick<SessionUser, "id" | "name">,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {
    this.peopleById = new Map(people.map((person) => [person.id, { ...person }]));
  }

  teamOf(architectId: string): string | null {
    return this.peopleById.get(architectId)?.teamId ?? null;
  }

  requestTeamTransfer = (
    architectId: string,
    toTeamId: string,
    reason: string,
  ): Promise<TeamTransferRequest> => {
    if (reason.trim() === "") return Promise.reject(TeamTransferRefusal.reasonRequired());
    const person = this.peopleById.get(architectId);
    if (!person) return Promise.reject(TeamTransferRefusal.personNotFound(architectId));
    if (!this.teams.some((team) => team.id === toTeamId))
      return Promise.reject(TeamTransferRefusal.teamNotFound(toTeamId));
    if (person.teamId === toTeamId) return Promise.reject(TeamTransferRefusal.toSameTeam());
    if (this.requests.some((it) => it.architectId === architectId && it.status === "pending"))
      return Promise.reject(TeamTransferRefusal.alreadyPending(person));
    this.sequence += 1;
    const request: TeamTransferRequest = {
      id: `transfer-${this.sequence}`,
      architectId,
      fromTeamId: person.teamId ?? "",
      toTeamId,
      reason,
      requestedByUserId: this.actor.id,
      requestedAt: this.now(),
      status: "pending",
      decidedByUserId: null,
      decidedAt: null,
      decisionNote: null,
      version: 1,
    };
    this.requests.push(request);
    return Promise.resolve({ ...request });
  };

  teamTransferRequests = (status?: TeamTransferRequestStatus): Promise<TeamTransferRequestView[]> =>
    Promise.resolve(
      this.requests
        .filter((request) => status === undefined || request.status === status)
        .sort((left, right) => right.requestedAt.localeCompare(left.requestedAt))
        .map((request) => this.viewOf(request)),
    );

  approveTeamTransfer = (requestId: string, note?: string): Promise<TeamTransferRequest> =>
    this.decide(requestId, "approved", note ?? null).then((approved) => {
      const person = this.peopleById.get(approved.architectId);
      if (person) {
        this.peopleById.set(person.id, {
          ...person,
          teamId: approved.toTeamId,
          version: person.version + 1,
        });
      }
      return approved;
    });

  refuseTeamTransfer = (requestId: string, note: string): Promise<TeamTransferRequest> =>
    note.trim() === ""
      ? Promise.reject(TeamTransferRefusal.noteRequired())
      : this.decide(requestId, "refused", note);

  cancelTeamTransfer = (requestId: string): Promise<TeamTransferRequest> =>
    this.decide(requestId, "cancelled", null);

  private decide(
    requestId: string,
    status: Exclude<TeamTransferRequestStatus, "pending">,
    note: string | null,
  ): Promise<TeamTransferRequest> {
    const request = this.requests.find((candidate) => candidate.id === requestId);
    if (!request) return Promise.reject(TeamTransferRefusal.requestNotFound(requestId));
    if (request.status !== "pending") return Promise.reject(TeamTransferRefusal.alreadyDecided());
    request.status = status;
    request.decidedByUserId = this.actor.id;
    request.decidedAt = this.now();
    request.decisionNote = note;
    request.version += 1;
    return Promise.resolve({ ...request });
  }

  private viewOf(request: TeamTransferRequest): TeamTransferRequestView {
    const nameOfTeam = (teamId: string) =>
      this.teams.find((team) => team.id === teamId)?.name ?? teamId;
    const nameOfUser = (userId: string | null) =>
      userId === null ? null : userId === this.actor.id ? this.actor.name : userId;
    return {
      ...request,
      architectName: this.peopleById.get(request.architectId)?.name ?? request.architectId,
      fromTeamName: nameOfTeam(request.fromTeamId),
      toTeamName: nameOfTeam(request.toTeamId),
      requestedByName: nameOfUser(request.requestedByUserId) ?? request.requestedByUserId,
      decidedByName: nameOfUser(request.decidedByUserId),
    };
  }
}
