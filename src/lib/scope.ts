import type { SessionUser } from "./api";
import { TeamLeadershipRoles } from "./gateways/auth.gateway";
import type { TeamLeadershipRole } from "./gateways/auth.gateway";
import type { Architect } from "./domain";

type ScopedArchitect = Pick<Architect, "id" | "teamId">;

/**
 * Fase 2 (backend ADR-0035) — `lead_user_id` morreu: o vínculo de escopo é o
 * TIME (`architects.team_id` + `team_memberships`). Desde a onda 17.1 a
 * sessão (`/auth/me`) carrega `memberships`, e são eles que respondem ONDE o
 * papel vale — os DOIS eixos, como o backend os exige. Onde a sessão ainda
 * não traz vínculo, a política se apoia no recorte do servidor: para uma
 * conta de liderança, todo arquiteto COM TIME que o `/state` entrega chegou
 * porque o usuário lidera aquele time.
 *
 * Fase 3 (backend ADR-0047) — o papel `lead` virou `manager` + `tech_lead`, e
 * os dois eixos passaram a falar o MESMO vocabulário (`TeamLeadershipRoles`).
 * A distinção entre os dois papéis NÃO está no alcance e sim no poder:
 *
 *   ALCANCE (`canActFor`, `isLeadOf`, `configurableTeamIds`) é a união dos
 *   times com vínculo de liderança, exigido papel de liderança — a conta de
 *   dois chapéus (gestora de um time, tech lead de outro) alcança os dois;
 *
 *   PODER ESTRITO (`isAssignedTechLeadOf`) exige papel global E vínculo
 *   naquele time, os dois iguais — é o que o backend guarda na proficiência
 *   observada e na reabertura de PDI.
 */
export class UiAuthorizationPolicy {
  canActFor(user: SessionUser, architect: ScopedArchitect | undefined): boolean {
    if (user.role === "admin") return true;
    if (!architect) return false;
    if (user.architectId === architect.id) return true;
    return this.leadsTeamOf(user, architect);
  }

  isLeadOf(user: SessionUser, architect: ScopedArchitect | undefined): boolean {
    if (user.role === "admin") return true;
    return this.leadsTeamOf(user, architect);
  }

  isAssignedTechLeadOf(user: SessionUser, architect: ScopedArchitect | undefined): boolean {
    return this.hasStrictBondWith(user, architect, TeamLeadershipRoles.TECH_LEAD);
  }

  isAdmin(user: SessionUser): boolean {
    return user.role === "admin";
  }

  canAnalyzeTeam(user: SessionUser): boolean {
    return user.role !== "member";
  }

  canConfigureRulesOf(user: SessionUser, teamId: string): boolean {
    const reach = this.configurableTeamIds(user);
    return reach === "all" || reach.has(teamId);
  }

  canConfigureAnyTeamRules(user: SessionUser): boolean {
    const reach = this.configurableTeamIds(user);
    return reach === "all" || reach.size > 0;
  }

  configurableTeamIds(user: SessionUser): "all" | ReadonlySet<string> {
    if (this.isAdmin(user)) return "all";
    return this.scopeGrantingTeamsOf(user);
  }

  leadsTeamOf(user: SessionUser, architect: ScopedArchitect | undefined): boolean {
    if (!architect || !TeamLeadershipRoles.includes(user.role) || architect.teamId == null) {
      return false;
    }
    if (this.scopeGrantingTeamsOf(user).has(architect.teamId)) return true;
    return architect.id !== user.architectId;
  }

  private scopeGrantingTeamsOf(user: SessionUser): ReadonlySet<string> {
    if (!TeamLeadershipRoles.includes(user.role)) return new Set();
    return this.teamsBoundAs(user, TeamLeadershipRoles.ALL);
  }

  private hasStrictBondWith(
    user: SessionUser,
    architect: ScopedArchitect | undefined,
    role: TeamLeadershipRole,
  ): boolean {
    if (user.role !== role || !architect || architect.teamId == null) return false;
    return this.teamsBoundAs(user, [role]).has(architect.teamId);
  }

  private teamsBoundAs(
    user: SessionUser,
    roles: readonly TeamLeadershipRole[],
  ): ReadonlySet<string> {
    return new Set(
      (user.memberships ?? [])
        .filter((membership) => (roles as readonly string[]).includes(membership.role))
        .map((membership) => membership.teamId),
    );
  }
}

export const defaultUiAuthorizationPolicy = new UiAuthorizationPolicy();
