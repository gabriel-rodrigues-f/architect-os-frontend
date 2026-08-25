import type { ApiClient } from "../api-client";

/**
 * `admin` administra o sistema (catálogo, ciclos, roster, contas). `lead`
 * exerce o papel de Tech Lead — revisa avaliação, evidência, PDI e trilha de
 * quem não é ele mesmo — sem as rotas de administração. `admin` também é
 * lead-capable (ver `isLeadCapable`, `api.ts`): a distinção existe para
 * permitir uma conta que só revisa, não para impedir quem administra de
 * revisar também.
 */
export type UserRole = "admin" | "lead" | "member";
export type UserStatus = "active" | "disabled";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  architectId: string | null;
  status: UserStatus;
  mustChangePassword: boolean;
  createdAt: string;
}

export interface AuthResult {
  user: SessionUser;
}

/**
 * OO-FE-02 — gateway do contexto "autenticação/contas". Já era um objeto
 * separado (`authApi`) antes desta migração; ganha o mesmo formato
 * interface + `Http*` dos demais gateways por consistência (métodos como
 * arrow functions de campo — ver `cycles.gateway.ts`).
 */
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
  createUser(input: {
    name: string;
    email: string;
    role: UserRole;
    architectId?: string | null;
  }): Promise<{ user: SessionUser; temporaryPassword: string }>;
  changePassword(currentPassword: string, newPassword: string): Promise<void>;
}

export class HttpAuthGateway implements AuthGateway {
  constructor(private readonly client: ApiClient) {}

  /** Diz se a instância já tem alguma conta — define login x primeiro acesso. */
  status = (): Promise<{ hasUsers: boolean }> =>
    this.client.request<{ hasUsers: boolean }>("/api/auth/status");

  login = (email: string, password: string): Promise<AuthResult> =>
    this.client.post<AuthResult>("/api/auth/login", { email, password });

  register = (input: { name: string; email: string; password: string }): Promise<AuthResult> =>
    this.client.post<AuthResult>("/api/auth/register", input);

  /** Só o servidor apaga um cookie HttpOnly — sem isto a sessão nunca de fato encerra. */
  logout = (): Promise<void> => this.client.request<void>("/api/auth/logout", { method: "POST" });

  me = (): Promise<SessionUser> => this.client.request<SessionUser>("/api/auth/me");

  users = (): Promise<SessionUser[]> => this.client.request<SessionUser[]>("/api/auth/users");

  /** Papel, vínculo com arquiteto, status (ativa/desabilitada), nome e e-mail de outra conta — admin-only no backend. */
  updateUser = (
    id: string,
    patch_: Partial<{
      role: UserRole;
      architectId: string | null;
      status: UserStatus;
      name: string;
      email: string;
    }>,
  ): Promise<SessionUser> => this.client.patch<SessionUser>(`/api/auth/users/${id}`, patch_);

  /**
   * ENT-AUTH-001 — única forma de entrar conta na instância depois do
   * bootstrap. `temporaryPassword` só vem nesta resposta — o admin repassa
   * por um canal fora da aplicação.
   */
  createUser = (input: {
    name: string;
    email: string;
    role: UserRole;
    architectId?: string | null;
  }): Promise<{ user: SessionUser; temporaryPassword: string }> =>
    this.client.post<{ user: SessionUser; temporaryPassword: string }>("/api/auth/users", input);

  changePassword = (currentPassword: string, newPassword: string): Promise<void> =>
    this.client.post<void>("/api/auth/change-password", { currentPassword, newPassword });
}
