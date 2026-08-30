import type { SessionUser, TeamMemberRole } from "./api";
import type { Architect } from "./domain";

type ScopedArchitect = Pick<Architect, "id" | "teamId">;

const SCOPE_GRANTING_TEAM_ROLES: readonly TeamMemberRole[] = ["manager", "tech_lead"];

/**
 * Fase 2 (backend ADR-0035) — `lead_user_id` morreu: o vínculo de escopo é o
 * TIME (`architects.team_id` + `team_memberships`). Desde a onda 17.1 a
 * sessão (`/auth/me`) carrega `memberships`, e são eles que respondem ONDE o
 * papel vale — os DOIS eixos, como o backend os exige. Onde a sessão ainda
 * não traz vínculo, a política se apoia no recorte do servidor: para uma
 * conta `lead`, todo arquiteto COM TIME que o `/state` entrega chegou porque
 * o usuário lidera aquele time.
 *
 * O limite que este cabeçalho registrava como pergunta de contrato — o lead
 * que também é arquiteto E lidera o próprio time — fechou com os
 * `memberships`: quando o vínculo diz que ele rege aquele time, a UI para de
 * lhe esconder ações que o backend sempre permitiu.
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
    if (!architect) return false;
    return this.leadsTeamOf(user, architect);
  }

  isAssignedTechLeadOf(user: SessionUser, architect: ScopedArchitect | undefined): boolean {
    if (!architect) return false;
    return this.leadsTeamOf(user, architect);
  }

  isAdmin(user: SessionUser): boolean {
    return user.role === "admin";
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

  private leadsTeamOf(user: SessionUser, architect: ScopedArchitect): boolean {
    if (user.role !== "lead" || architect.teamId == null) return false;
    if (this.scopeGrantingTeamsOf(user).has(architect.teamId)) return true;
    return architect.id !== user.architectId;
  }

  private scopeGrantingTeamsOf(user: SessionUser): ReadonlySet<string> {
    if (user.role !== "lead") return new Set();
    return new Set(
      (user.memberships ?? [])
        .filter((membership) => SCOPE_GRANTING_TEAM_ROLES.includes(membership.role))
        .map((membership) => membership.teamId),
    );
  }
}

export const defaultUiAuthorizationPolicy = new UiAuthorizationPolicy();
