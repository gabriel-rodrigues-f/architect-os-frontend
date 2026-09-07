import type { SessionUser } from "./api";
import { TeamLeadershipRoles } from "./gateways/auth.gateway";
import type { TeamLeadershipRole } from "./gateways/auth.gateway";
import type { Architect } from "./domain";

type ScopedArchitect = Pick<Architect, "id" | "teamId">;

/**
 * Revisão de papéis (dono, 2026-09-05, D1–D5) — a régua da tela espelha a do
 * servidor (`AuthorizationService`), e as duas dizem a mesma coisa:
 *
 *  - o ADMINISTRADOR administra o sistema, não as pessoas: catálogo, ciclos,
 *    faixas, times, contas, importação, operação. Sobre uma pessoa ele só LÊ,
 *    em MODO DE SUPORTE, declarando o motivo (`SupportAccess`), e nunca age
 *    nem usa IA;
 *  - o GERENTE decide carreira (nível, conclusão da avaliação, desativação),
 *    compõe o time, cadastra tech lead e membro, calibra, administra as
 *    contas dos times dele;
 *  - o TECH LEAD pontua, revisa evidência, rege a régua com o gerente,
 *    mentora, vê o mapa técnico do time — e não cadastra nem conclui;
 *  - a PESSOA vê tudo o que é dela: radar, distâncias, aderência, evolução,
 *    extrato — e NÃO age sobre nada (dono, 2026-09-06): a autoavaliação, a
 *    evidência e o PDI dela são registrados por quem a lidera, na 1:1. A
 *    única exceção é o progresso na própria trilha.
 */

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
 *   dois chapéus (gerente de um time, tech lead de outro) alcança os dois;
 *
 *   PODER ESTRITO (`isAssignedTechLeadOf`) exige papel global E vínculo
 *   naquele time, os dois iguais — é o que o backend guarda na proficiência
 *   observada e na reabertura de PDI.
 *
 * `canCalibrate` é de um terceiro tipo, e por isso não se apoia em nenhum dos
 * dois: o CONTRATO PRD-03 reserva a leitura de calibração a gerente + admin
 * SEM falar de time, porque ela compara avaliadores entre si em vez de agir
 * sobre alguém. Papel global, vínculo nenhum.
 */
type AccountLike = { id: string; status: string; role: string };

export class UiAuthorizationPolicy {
  /** LEITURA sobre uma pessoa: ela mesma, quem a lidera por vínculo, ou o admin (em modo de suporte). */
  canReadAbout(user: SessionUser, architect: ScopedArchitect | undefined): boolean {
    if (!architect) return false;
    if (this.isOwn(user, architect)) return true;
    if (this.isAdmin(user)) return true;
    return this.leadsTeamOf(user, architect);
  }

  /**
   * AÇÃO sobre uma pessoa: SÓ quem a lidera por vínculo. Admin não, e
   * NINGUÉM age sobre si (dono, 2026-09-06): "autoavaliação é um processo de
   * PDI e 1:1 — o líder faz perguntas e anota a opinião do membro". Quem
   * lidera registra a autoavaliação, a evidência e o PDI; a pessoa LÊ tudo o
   * que é dela (`canReadAbout`, `readsOwn`).
   */
  canActFor(user: SessionUser, architect: ScopedArchitect | undefined): boolean {
    if (!architect) return false;
    if (this.isOwn(user, architect)) return this.actsOnSelf(user, architect.id);
    return this.leadsTeamOf(user, architect);
  }

  /**
   * A pessoa agindo sobre a própria carreira: ninguém (dono, 2026-09-06).
   * Continua existindo como a resposta NOMEADA à pergunta — quem ler a régua
   * encontra aqui a decisão, e não um `false` perdido dentro de `canActFor`.
   */
  actsOnSelf(_user: SessionUser, _architectId: string | undefined): boolean {
    return false;
  }

  /** A pessoa LENDO o que é dela — números, veredito, respostas, radar, Evolução, Extrato, Roteiro. */
  readsOwn(user: SessionUser, architectId: string | undefined): boolean {
    return architectId !== undefined && user.architectId === architectId;
  }

  /**
   * A única exceção mantida (dono, 2026-09-06): o progresso na PRÓPRIA trilha
   * de aprendizagem continua sendo do profissional — e de quem o lidera.
   */
  recordsTrailProgressOf(user: SessionUser, architect: ScopedArchitect | undefined): boolean {
    if (!architect) return false;
    if (this.isOwn(user, architect)) return this.isSubjectOnly(user);
    return this.leadsTeamOf(user, architect);
  }

  /**
   * Quem ESCOLHE pessoa num seletor: quem lidera. O profissional não busca
   * outros membros em parte nenhuma da aplicação (dono, 2026-09-06) — o
   * seletor dele é a forma "só eu", sem gatilho e sem lista.
   */
  picksPeople(user: SessionUser): boolean {
    return this.isLeadership(user);
  }

  /** Liderança por VÍNCULO no time da pessoa — nunca sobre si, nunca o admin. */
  isLeadOf(user: SessionUser, architect: ScopedArchitect | undefined): boolean {
    if (this.isOwn(user, architect)) return false;
    return this.leadsTeamOf(user, architect);
  }

  /**
   * As AÇÕES da ficha de carreira — registrar evidência, levar distância ao
   * PDI, reenviar evidência. Na própria ficha não há ação nenhuma: a ficha é
   * leitura; quem registra evidência faz isso em Avaliações (dono, 2026-09-05).
   */
  canActOnCareerFileOf(user: SessionUser, architect: ScopedArchitect | undefined): boolean {
    if (this.isOwn(user, architect)) return false;
    return this.canActFor(user, architect);
  }

  /**
   * Quem aparece em Avaliações: para o profissional, SÓ ele (em leitura); para
   * quem lidera, os liderados — nunca ele mesmo (dono, 2026-09-06).
   */
  assessableBy<A extends ScopedArchitect>(user: SessionUser, architects: readonly A[]): A[] {
    return this.ownFirst(user, architects, (architect) => this.leadsTeamOf(user, architect));
  }

  /** Quem pode ser mentorado: quem está abaixo na hierarquia — ninguém mentora a si mesmo. */
  mentorableBy<A extends ScopedArchitect>(user: SessionUser, architects: readonly A[]): A[] {
    return architects.filter(
      (architect) => !this.isOwn(user, architect) && this.leadsTeamOf(user, architect),
    );
  }

  private ownFirst<A extends ScopedArchitect>(
    user: SessionUser,
    architects: readonly A[],
    reaches: (architect: A) => boolean,
  ): A[] {
    const own = this.isSubjectOnly(user)
      ? architects.filter((architect) => this.isOwn(user, architect))
      : [];
    const led = architects.filter(
      (architect) => !this.isOwn(user, architect) && reaches(architect),
    );
    return [...own, ...led];
  }

  private isOwn(user: SessionUser, architect: ScopedArchitect | undefined): boolean {
    return architect !== undefined && user.architectId === architect.id;
  }

  /** O profissional: sujeito da própria carreira e de mais ninguém. */
  private isSubjectOnly(user: SessionUser): boolean {
    return user.role === "member";
  }

  isAssignedTechLeadOf(user: SessionUser, architect: ScopedArchitect | undefined): boolean {
    if (this.isOwn(user, architect)) return false;
    return this.hasStrictBondWith(user, architect, TeamLeadershipRoles.TECH_LEAD);
  }

  isAssignedManagerOf(user: SessionUser, architect: ScopedArchitect | undefined): boolean {
    if (this.isOwn(user, architect)) return false;
    return this.hasStrictBondWith(user, architect, TeamLeadershipRoles.MANAGER);
  }

  /** DECISÃO de carreira — nível, conclusão da avaliação, desativação: o gerente designado; o admin como correção. */
  decidesCareerOf(user: SessionUser, architect: ScopedArchitect | undefined): boolean {
    if (this.isAdmin(user)) return true;
    return this.isAssignedManagerOf(user, architect);
  }

  /** A FICHA FUNCIONAL e o extrato completo: a própria pessoa, o gerente designado, o admin em suporte. */
  canReadPersonnelFileOf(user: SessionUser, architect: ScopedArchitect | undefined): boolean {
    if (this.isOwn(user, architect)) return true;
    if (this.isAdmin(user)) return true;
    return this.isAssignedManagerOf(user, architect);
  }

  isAdmin(user: SessionUser): boolean {
    return user.role === "admin";
  }

  /** Análise de time (cobertura, prioridades, necessidades): liderança COM vínculo. O admin lê o Painel de operação. */
  canAnalyzeTeam(user: SessionUser): boolean {
    return this.isLeadership(user) && this.scopeGrantingTeamsOf(user).size > 0;
  }

  /** Contas (Usuários) e composição de times: o administrador e o gerente com vínculo. */
  canAdministerPeople(user: SessionUser): boolean {
    return this.isAdmin(user) || this.canComposeAnyTeam(user);
  }

  canRestoreAccessOf(user: SessionUser, account: AccountLike): boolean {
    return this.administersAccount(user, account) && account.status === "active";
  }

  /**
   * Quem muda o STATUS de uma conta (desativar, reativar, devolver acesso):
   * o admin, de qualquer conta que não a própria; o gerente com vínculo, só
   * de tech lead e profissional — cadastrar e alterar GERENTES é do
   * administrador (dono, 2026-09-06).
   */
  administersAccount(user: SessionUser, account: AccountLike): boolean {
    if (account.id === user.id) return false;
    if (this.isAdmin(user)) return true;
    return (
      this.canAdministerPeople(user) &&
      account.role !== "admin" &&
      account.role !== TeamLeadershipRoles.MANAGER
    );
  }

  isLeadership(user: SessionUser): boolean {
    return user.role !== "member";
  }

  /**
   * Quem lidera alguém — com vínculo — tem o que FAZER em Avaliações, PDI e
   * Mentoria; quem tem ficha própria tem o que LER ali (dono, 2026-09-06: os
   * três menus continuam no menu do profissional, em leitura).
   */
  worksWithPeople(user: SessionUser): boolean {
    if (this.isAdmin(user)) return this.scopeGrantingTeamsOf(user).size > 0;
    return true;
  }

  /**
   * As ABAS da ficha — Evolução, Extrato e Roteiro — são da própria pessoa
   * (D2), de quem a lidera por vínculo, e do admin em modo de suporte. Com só
   * o id na mão (guarda de rota) a régua é a do papel; a tela confere o vínculo.
   */
  canOpenCareerTabsOf(user: SessionUser, architect: ScopedArchitect | string | undefined): boolean {
    if (typeof architect === "string") {
      return user.architectId === architect || this.isLeadership(user);
    }
    return this.canReadAbout(user, architect);
  }

  /** O Extrato é de quem lê a ficha: a própria pessoa, quem a lidera por vínculo, o admin em suporte (dono, 2026-09-06). */
  canOpenStatementOf(user: SessionUser, architect: ScopedArchitect | undefined): boolean {
    return this.canReadAbout(user, architect);
  }

  /** Calibração é rito de gestão: o gerente com vínculo (D1: o admin não calibra). */
  canCalibrate(user: SessionUser): boolean {
    return (
      user.role === TeamLeadershipRoles.MANAGER &&
      this.teamsBoundAs(user, [TeamLeadershipRoles.MANAGER]).size > 0
    );
  }

  canConfigureRulesOf(user: SessionUser, teamId: string): boolean {
    return this.scopeGrantingTeamsOf(user).has(teamId);
  }

  /** A régua é regida por quem lidera o time; o admin a LÊ. */
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

  /** Liderança do time da pessoa, por VÍNCULO — sem o atalho antigo de "qualquer outra pessoa" (inconsistência G). */
  leadsTeamOf(user: SessionUser, architect: ScopedArchitect | undefined): boolean {
    if (!architect || !TeamLeadershipRoles.includes(user.role) || architect.teamId == null) {
      return false;
    }
    return this.scopeGrantingTeamsOf(user).has(architect.teamId);
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
