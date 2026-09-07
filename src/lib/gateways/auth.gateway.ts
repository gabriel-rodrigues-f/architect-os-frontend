import type { ApiClient } from "../api-client";

export const TEAM_LEADERSHIP_ROLES = ["manager", "tech_lead"] as const;
export type TeamLeadershipRole = (typeof TEAM_LEADERSHIP_ROLES)[number];
export const TEAM_MEMBER_ROLES = [...TEAM_LEADERSHIP_ROLES, "member"] as const;
export type TeamMemberRole = (typeof TEAM_MEMBER_ROLES)[number];

/**
 * PR 5 (adendo do dono, 2026-09-08, item 2) — os papéis de ORGANIZAÇÃO, que
 * não são papéis de time, espelhando `backend/.../entities/user.ts`: `admin`
 * é a diretoria e os sócios ("estão acima dos gerentes e precisam ver tudo
 * sobre todos"); `support` é o antigo admin ("a pessoa que entraria para
 * realizar tarefas de suporte, de fato").
 */
export const ORGANIZATION_ROLES = ["admin", "support"] as const;
export type OrganizationRole = (typeof ORGANIZATION_ROLES)[number];

export const USER_ROLES = [...ORGANIZATION_ROLES, ...TEAM_MEMBER_ROLES] as const;
export type UserRole = (typeof USER_ROLES)[number];
export type UserStatus = "active" | "disabled";

/**
 * O vocabulário INTEIRO dos papéis de acesso numa classe, e as perguntas que
 * a tela faz sobre ele. O literal `"admin"` solto significava "quem opera o
 * sistema" num lugar e "quem lê a organização" noutro; a catraca
 * `o-papel-e-vocabulario` proíbe o literal fora daqui, e cada uso diz QUAL
 * pergunta faz.
 *
 *  - `operatesTheSystem`: ADMIN e SUPPORT — contas, times, catálogo, ciclos,
 *    configurações, Métricas da Plataforma. É o que o antigo `admin` fazia,
 *    e ADMIN pode tudo que SUPPORT pode;
 *  - `readsTheOrganization`: só ADMIN — a diretoria lê tudo de todos, sem
 *    passe de suporte. Ler, não agir: quem age sobre pessoa é quem a lidera
 *    por vínculo.
 */
export class UserRoles {
  static readonly ALL = USER_ROLES;

  static readonly ADMIN = ORGANIZATION_ROLES[0];

  static readonly SUPPORT = ORGANIZATION_ROLES[1];

  static readonly MANAGER = TEAM_LEADERSHIP_ROLES[0];

  static readonly TECH_LEAD = TEAM_LEADERSHIP_ROLES[1];

  static readonly MEMBER = TEAM_MEMBER_ROLES[2];

  static includes(role: string): role is UserRole {
    return (USER_ROLES as readonly string[]).includes(role);
  }

  static isOrganizationRole(role: string): role is OrganizationRole {
    return (ORGANIZATION_ROLES as readonly string[]).includes(role);
  }

  /** ADMIN e SUPPORT: quem opera o sistema (o que o antigo `admin` significava). */
  static operatesTheSystem(role: string): boolean {
    return UserRoles.isOrganizationRole(role);
  }

  /** Só ADMIN: a diretoria lê a organização inteira — e não age sobre pessoas. */
  static readsTheOrganization(role: string): boolean {
    return role === UserRoles.ADMIN;
  }

  /**
   * Quais papéis quem opera o sistema pode ATRIBUIR a uma conta: "é o único
   * [ADMIN] que atribui ADMIN"; o suporte "não cria nem promove ADMIN"
   * (adendo, item 2). Quem não opera o sistema não atribui papel nenhum.
   */
  static assignableBy(actorRole: string): readonly UserRole[] {
    if (UserRoles.readsTheOrganization(actorRole)) return USER_ROLES;
    if (UserRoles.operatesTheSystem(actorRole)) {
      return USER_ROLES.filter((role) => !UserRoles.readsTheOrganization(role));
    }
    return [];
  }

  /** Trocar o papel de uma conta para ADMIN é conceder a leitura da organização — pede confirmação. */
  static promotesToAdmin(from: string, to: string): boolean {
    return !UserRoles.readsTheOrganization(from) && UserRoles.readsTheOrganization(to);
  }
}

export class TeamLeadershipRoles {
  static readonly ALL = TEAM_LEADERSHIP_ROLES;

  static readonly MANAGER = TEAM_LEADERSHIP_ROLES[0];

  static readonly TECH_LEAD = TEAM_LEADERSHIP_ROLES[1];

  static includes(role: string): role is TeamLeadershipRole {
    return (TEAM_LEADERSHIP_ROLES as readonly string[]).includes(role);
  }
}

export class TeamMemberRoles {
  static readonly ALL = TEAM_MEMBER_ROLES;

  static readonly MANAGER = TEAM_LEADERSHIP_ROLES[0];

  static includes(role: string): role is TeamMemberRole {
    return (TEAM_MEMBER_ROLES as readonly string[]).includes(role);
  }

  /** O vínculo de gerente — cadastrar e alterar gerentes é de quem opera o sistema. */
  static isManager(role: string): boolean {
    return role === TeamMemberRoles.MANAGER;
  }
}

export interface TeamMembership {
  teamId: string;
  role: TeamMemberRole;
}

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  architectId: string | null;
  status: UserStatus;
  mustChangePassword: boolean;
  createdAt: string;
  memberships?: readonly TeamMembership[];
}

export interface AuthResult {
  user: SessionUser;
}

export interface AuthGateway {
  status(): Promise<{ hasUsers: boolean }>;
  login(email: string, password: string): Promise<AuthResult>;
  register(input: { name: string; email: string; password: string }): Promise<AuthResult>;
  logout(): Promise<void>;
  me(): Promise<SessionUser>;
  users(): Promise<SessionUser[]>;
  updateUser(
    id: string,
    patch_: Partial<{
      role: UserRole;
      architectId: string | null;
      status: UserStatus;
      name: string;
      email: string;
    }>,
  ): Promise<SessionUser>;
  admitPerson(input: PersonAdmissionInput): Promise<AdmittedPerson>;
  changePassword(currentPassword: string, newPassword: string): Promise<void>;
  requestAccessRecovery(email: string): Promise<void>;
  restoreAccessOf(userId: string): Promise<void>;
  setPassword(token: string, newPassword: string): Promise<void>;
  /** A quem é o convite do link — e-mail e primeiro nome — para a tela de criar a senha. */
  invitationHolder(token: string): Promise<AccessInvitationHolder>;
}

export interface AccessInvitationHolder {
  readonly email: string;
  readonly firstName: string | null;
}

/**
 * ONDA 37 (backend ADR-0084) — ADMITIR a pessoa no time é uma operação só:
 * a conta, o profissional e o vínculo de time nascem numa transação. Por
 * isso o nome não é `createUser` — não se cria um usuário, admite-se uma
 * pessoa. `architectId` saiu: não se pendura mais conta em profissional
 * criado antes. `careerLevelId` é a SENIORIDADE, e só o profissional tem.
 */
export interface PersonAdmissionInput {
  name: string;
  email: string;
  role: TeamMemberRole;
  teamId: string;
  careerLevelId?: string;
}

export interface AdmittedPerson {
  user: SessionUser;
  architectId: string;
  /**
   * Se o convite de acesso SAIU por e-mail.
   *
   * Substituiu `temporaryPassword` na onda 44 (ADR-0094): a admissão deixou de
   * sortear senha, porque duas pessoas conhecerem a senha de uma terceira era
   * exatamente o problema. Quem escolhe a senha agora é a dona dela.
   *
   * A admissão NÃO falha se o e-mail não sair — a conta, o profissional e o
   * vínculo estão certos. Mas quem cadastrou precisa saber, senão fica
   * esperando por alguém que nunca recebeu nada.
   */
  invitationDelivered: boolean;
}

export class HttpAuthGateway implements AuthGateway {
  constructor(private readonly client: ApiClient) {}

  status = (): Promise<{ hasUsers: boolean }> =>
    this.client.request<{ hasUsers: boolean }>("/auth/status");

  login = (email: string, password: string): Promise<AuthResult> =>
    this.client.post<AuthResult>("/auth/login", { email, password });

  register = (input: { name: string; email: string; password: string }): Promise<AuthResult> =>
    this.client.post<AuthResult>("/auth/register", input);

  logout = (): Promise<void> => this.client.request<void>("/auth/logout", { method: "POST" });

  me = (): Promise<SessionUser> => this.client.request<SessionUser>("/auth/me");

  users = (): Promise<SessionUser[]> => this.client.request<SessionUser[]>("/auth/users");

  updateUser = (
    id: string,
    patch_: Partial<{
      role: UserRole;
      architectId: string | null;
      status: UserStatus;
      name: string;
      email: string;
    }>,
  ): Promise<SessionUser> => this.client.patch<SessionUser>(`/auth/users/${id}`, patch_);

  admitPerson = (input: PersonAdmissionInput): Promise<AdmittedPerson> =>
    this.client.post<AdmittedPerson>("/auth/users", input);

  changePassword = (currentPassword: string, newPassword: string): Promise<void> =>
    this.client.post<void>("/auth/change-password", { currentPassword, newPassword });

  /**
   * A própria pessoa PEDE o acesso de volta, sem sessão. O serviço responde
   * **sempre 202**, exista a conta ou não — de propósito, para a resposta não
   * revelar quem tem conta aqui. Por isso não há nada a devolver: a tela
   * mostra a mesma confirmação nos dois casos, e ela não tem como (nem por
   * que) distinguir um do outro.
   */
  requestAccessRecovery = (email: string): Promise<void> =>
    this.client.post<void>("/auth/access-recovery", { email });

  /**
   * A liderança DEVOLVE o acesso de alguém. Sem corpo: o serviço já sabe para
   * quem, pelo id da rota. O que sai daqui é um convite por e-mail — um LINK,
   * nunca uma senha.
   */
  restoreAccessOf = (userId: string): Promise<void> =>
    this.client.post<void>(`/auth/users/${userId}/access-recovery`, {});

  /**
   * A pessoa DEFINE a própria senha a partir do convite. Público e sem
   * sessão: quem autentica o pedido é o token do link.
   */
  setPassword = (token: string, newPassword: string): Promise<void> =>
    this.client.post<void>("/auth/set-password", { token, newPassword });

  /**
   * Público e sem sessão, como o `setPassword`: quem apresenta o link é quem
   * abriu o e-mail. É o que permite saudar a pessoa, recusar link vencido
   * antes de qualquer digitação e conferir "não ter o seu e-mail" na tela.
   */
  invitationHolder = (token: string): Promise<AccessInvitationHolder> =>
    this.client.request<AccessInvitationHolder>(`/auth/invitations/${encodeURIComponent(token)}`);
}
