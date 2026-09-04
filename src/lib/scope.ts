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
 *
 * `canCalibrate` é de um terceiro tipo, e por isso não se apoia em nenhum dos
 * dois: o CONTRATO PRD-03 reserva a leitura de calibração a gestor + admin
 * SEM falar de time, porque ela compara avaliadores entre si em vez de agir
 * sobre alguém. Papel global, vínculo nenhum.
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
    return this.isLeadership(user);
  }

  /**
   * DEVOLVER O ACESSO de alguém — `POST /auth/users/:id/access-recovery`.
   *
   * O serviço pode recusar com `ACCESS_RESTORE_FORBIDDEN`, e um 403 não pode
   * ser a primeira vez que a pessoa descobre que não podia: o botão só
   * aparece para quem alcança. As duas condições, e por que cada uma:
   *
   *   **É ato de quem administra.** O diretório de contas já é administrativo
   *   (o backend guarda `GET /auth/users` com `requireAdmin`), e devolver
   *   acesso é da mesma família — mexer na porta de outra pessoa.
   *
   *   **Nunca na própria conta.** Quem está logado não precisa de convite
   *   para entrar: já entrou. A saída de quem esqueceu a senha é o pedido da
   *   tela de login, e a de quem quer trocá-la é a troca de senha.
   *
   * Conta desativada fica de fora por não ter acesso a devolver: o caminho
   * dela é ser reativada primeiro, e prometer um link que não abriria nada
   * seria mentir com um botão.
   */
  canRestoreAccessOf(user: SessionUser, account: { id: string; status: string }): boolean {
    return this.isAdmin(user) && account.id !== user.id && account.status === "active";
  }

  isLeadership(user: SessionUser): boolean {
    return user.role !== "member";
  }

  canOpenCareerFileOf(user: SessionUser, architectId: string): boolean {
    if (this.isLeadership(user)) return true;
    return user.architectId !== architectId;
  }

  canCalibrate(user: SessionUser): boolean {
    return this.isAdmin(user) || user.role === TeamLeadershipRoles.MANAGER;
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

  canComposeAnyTeam(user: SessionUser): boolean {
    const reach = this.composableTeamIds(user);
    return reach === "all" || reach.size > 0;
  }

  canComposeTeam(user: SessionUser, teamId: string): boolean {
    const reach = this.composableTeamIds(user);
    return reach === "all" || reach.has(teamId);
  }

  composableTeamIds(user: SessionUser): "all" | ReadonlySet<string> {
    if (this.isAdmin(user)) return "all";
    if (user.role !== TeamLeadershipRoles.MANAGER) return new Set();
    return this.teamsBoundAs(user, [TeamLeadershipRoles.MANAGER]);
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
