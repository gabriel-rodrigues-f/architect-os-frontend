import type { SessionUser } from "./api";
import type { Architect } from "./domain";

type ScopedArchitect = Pick<Architect, "id" | "teamId">;

/**
 * Fase 2 (backend ADR-0035) — `lead_user_id` morreu: o vínculo de escopo é o
 * TIME (`architects.team_id` + `team_memberships`). A sessão (`/auth/me`) NÃO
 * carrega os times que o usuário lidera, então esta política se apoia no
 * recorte do servidor: para uma conta `lead`, todo arquiteto COM TIME que o
 * `/state` entrega chegou porque o usuário lidera aquele time — a exceção é o
 * próprio arquiteto do usuário, visível por ser ele mesmo.
 *
 * Limite conhecido (registrado em ATIVIDADES como pergunta de contrato): um
 * lead que também é arquiteto E lidera o próprio time não se distingue aqui —
 * a UI não mostra a ele as ações de lead sobre si mesmo, embora o backend as
 * permitisse. Fechar isso exige a sessão expor os times liderados.
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

  private leadsTeamOf(user: SessionUser, architect: ScopedArchitect): boolean {
    return user.role === "lead" && architect.teamId != null && architect.id !== user.architectId;
  }
}

export const defaultUiAuthorizationPolicy = new UiAuthorizationPolicy();
