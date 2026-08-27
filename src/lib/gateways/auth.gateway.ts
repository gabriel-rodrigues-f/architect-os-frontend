import type { ApiClient } from "../api-client";

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

  createUser = (input: {
    name: string;
    email: string;
    role: UserRole;
    architectId?: string | null;
  }): Promise<{ user: SessionUser; temporaryPassword: string }> =>
    this.client.post<{ user: SessionUser; temporaryPassword: string }>("/auth/users", input);

  changePassword = (currentPassword: string, newPassword: string): Promise<void> =>
    this.client.post<void>("/auth/change-password", { currentPassword, newPassword });
}
