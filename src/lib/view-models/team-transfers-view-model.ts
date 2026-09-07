import type { SessionUser } from "../api";
import type { Architect, TeamTransferRequestView } from "../domain";
import { TeamLeadershipRoles } from "../gateways/auth.gateway";
import type { UiAuthorizationPolicy } from "../scope";

/**
 * Como o time de alguém muda, para quem está logado:
 *   - `immediate`: o admin move direto (correção de cadastro);
 *   - `request`:   o gerente designado SOLICITA, e o gerente do destino aprova;
 *   - `null`:      ninguém mais (tech lead, profissional) muda time de ninguém.
 * Decisão do dono, 2026-09-06.
 */
export type TeamChangeMode = "immediate" | "request";

export interface TeamTransfersInbox {
  /** Pendentes cujo destino é um time em que eu sou gerente — ou todas, para o admin. */
  readonly toDecide: TeamTransferRequestView[];
  /** Pendentes que eu mesmo pedi. */
  readonly requestedByMe: TeamTransferRequestView[];
}

export class TeamTransfersViewModel {
  constructor(private readonly policy: UiAuthorizationPolicy) {}

  teamChangeModeFor(
    user: SessionUser,
    architect: Pick<Architect, "id" | "teamId">,
  ): TeamChangeMode | null {
    if (this.policy.isAdmin(user)) return "immediate";
    if (this.policy.isAssignedManagerOf(user, architect)) return "request";
    return null;
  }

  /** Só admin e gerente com vínculo podem ter pendência — só eles consultam a caixa. */
  mayHavePending(user: SessionUser): boolean {
    return this.policy.isAdmin(user) || this.policy.canComposeAnyTeam(user);
  }

  decides(user: SessionUser, request: TeamTransferRequestView): boolean {
    if (request.status !== "pending") return false;
    return this.policy.isAdmin(user) || this.managesDestinationOf(user, request);
  }

  mayCancel(user: SessionUser, request: TeamTransferRequestView): boolean {
    if (request.status !== "pending") return false;
    return this.policy.isAdmin(user) || request.requestedByUserId === user.id;
  }

  inbox(user: SessionUser, requests: readonly TeamTransferRequestView[]): TeamTransfersInbox {
    const pending = requests.filter((request) => request.status === "pending");
    const toDecide = pending.filter((request) => this.decides(user, request));
    return {
      toDecide,
      requestedByMe: pending.filter(
        (request) => !toDecide.includes(request) && request.requestedByUserId === user.id,
      ),
    };
  }

  countToDecide(user: SessionUser, requests: readonly TeamTransferRequestView[]): number {
    return this.inbox(user, requests).toDecide.length;
  }

  pendingOf(
    architectId: string,
    requests: readonly TeamTransferRequestView[],
  ): TeamTransferRequestView | undefined {
    return requests.find(
      (request) => request.status === "pending" && request.architectId === architectId,
    );
  }

  private managesDestinationOf(user: SessionUser, request: TeamTransferRequestView): boolean {
    if (user.role !== TeamLeadershipRoles.MANAGER) return false;
    return (user.memberships ?? []).some(
      (membership) =>
        membership.role === TeamLeadershipRoles.MANAGER && membership.teamId === request.toTeamId,
    );
  }
}
