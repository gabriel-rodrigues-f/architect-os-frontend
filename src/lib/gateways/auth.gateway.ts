import type { ApiClient } from "../api-client";

export const TEAM_LEADERSHIP_ROLES = ["manager", "tech_lead"] as const;
export type TeamLeadershipRole = (typeof TEAM_LEADERSHIP_ROLES)[number];
export const USER_ROLES = ["admin", ...TEAM_LEADERSHIP_ROLES, "member"] as const;
export type UserRole = (typeof USER_ROLES)[number];
export type UserStatus = "active" | "disabled";
export const TEAM_MEMBER_ROLES = [...TEAM_LEADERSHIP_ROLES, "member"] as const;
export type TeamMemberRole = (typeof TEAM_MEMBER_ROLES)[number];

export class UserRoles {
  static readonly ALL = USER_ROLES;

  static includes(role: string): role is UserRole {
    return (USER_ROLES as readonly string[]).includes(role);
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
  temporaryPassword: string;
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
}
