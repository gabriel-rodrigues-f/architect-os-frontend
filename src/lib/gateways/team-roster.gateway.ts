import { teamRosterResponseSchema } from "../api-schemas";
import type { ApiClient } from "../api-client";
import { RefusalNumber } from "../refusal-number";
import { TeamMemberRoles, type TeamMemberRole } from "./auth.gateway";
import type { DataOrigin, OriginatedData } from "./data-origin";

export interface TeamRosterMember {
  userId: string;
  name: string;
  email: string;
  role: TeamMemberRole;
}

export interface AvailableTeamRoster extends OriginatedData {
  readonly reading: "available";
  readonly teamId: string;
  readonly members: readonly TeamRosterMember[];
}

export interface UnavailableTeamRoster extends OriginatedData {
  readonly reading: "unavailable";
  readonly teamId: string;
}

export type TeamRoster = AvailableTeamRoster | UnavailableTeamRoster;

export interface TeamRosterGateway {
  readonly dataOrigin: DataOrigin;
  rosterOf(teamId: string): Promise<TeamRoster>;
}

export class TeamRosterOrder {
  private static readonly RANK_BY_ROLE: Record<TeamMemberRole, number> = Object.fromEntries(
    TeamMemberRoles.ALL.map((role, index) => [role, index]),
  ) as Record<TeamMemberRole, number>;

  sorted(members: readonly TeamRosterMember[]): TeamRosterMember[] {
    return [...members].sort(
      (left, right) =>
        TeamRosterOrder.RANK_BY_ROLE[left.role] - TeamRosterOrder.RANK_BY_ROLE[right.role] ||
        left.name.localeCompare(right.name),
    );
  }
}

export class HttpTeamRosterGateway implements TeamRosterGateway {
  readonly dataOrigin: DataOrigin = "organization";

  constructor(private readonly client: ApiClient) {}

  rosterOf = (teamId: string): Promise<TeamRoster> =>
    this.client
      .request<unknown>(`/teams/${teamId}/memberships`)
      .then((data): TeamRoster => ({
        reading: "available",
        teamId,
        members: teamRosterResponseSchema.parse(data),
        dataOrigin: this.dataOrigin,
      }))
      /**
       * REGRA 18 (dono, 2026-09-09) — o quadro do time é uma das DUAS
       * exceções nomeadas que ficaram fora do lote, e é por isso que engolir
       * o 404 aqui continua sendo legítimo: nesta rota ele quer dizer
       * "leitura do quadro indisponível", e mais nada.
       *
       * Se um dia o quadro entrar na troca, esta linha tem de cair junto: a
       * recusa passaria a ter SUCESSO e a tela desenharia *"O quadro deste
       * time ainda não pode ser listado aqui. Os vínculos existem e
       * continuam valendo."* para quem não lidera aquele time — o único
       * ponto do produto onde o 404 faz a tela AFIRMAR uma coisa falsa em
       * vez de calar. Por isso a leitura é assinada pela rota, e a assinatura
       * mora em `RefusalNumber`: tirar a rota de lá derruba esta chamada.
       */
      .catch((error: unknown): TeamRoster => {
        if (RefusalNumber.answersAbsenceOn("quadro-do-time", error)) {
          return { reading: "unavailable", teamId, dataOrigin: this.dataOrigin };
        }
        throw error;
      });
}

export class InMemoryTeamRosterGateway implements TeamRosterGateway {
  readonly dataOrigin: DataOrigin = "demonstration";

  private readonly order = new TeamRosterOrder();

  constructor(
    private readonly membersByTeam: ReadonlyMap<string, readonly TeamRosterMember[]>,
    private readonly readable: boolean = true,
  ) {}

  static unavailable(): InMemoryTeamRosterGateway {
    return new InMemoryTeamRosterGateway(new Map(), false);
  }

  rosterOf = (teamId: string): Promise<TeamRoster> => {
    if (!this.readable) {
      return Promise.resolve({ reading: "unavailable", teamId, dataOrigin: this.dataOrigin });
    }
    return Promise.resolve({
      reading: "available",
      teamId,
      members: this.order.sorted(this.membersByTeam.get(teamId) ?? []),
      dataOrigin: this.dataOrigin,
    });
  };
}
