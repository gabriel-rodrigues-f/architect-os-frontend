import type { SessionUser } from "./api";
import type { Architect } from "./domain";

type ScopedArchitect = Pick<Architect, "id" | "leadUserId">;

export class UiAuthorizationPolicy {
  canActFor(user: SessionUser, architect: ScopedArchitect | undefined): boolean {
    if (user.role === "admin") return true;
    if (!architect) return false;
    if (user.architectId === architect.id) return true;
    return user.role === "lead" && architect.leadUserId === user.id;
  }

  isLeadOf(user: SessionUser, architect: ScopedArchitect | undefined): boolean {
    if (user.role === "admin") return true;
    if (!architect) return false;
    return user.role === "lead" && architect.leadUserId === user.id;
  }

  isAssignedTechLeadOf(user: SessionUser, architect: ScopedArchitect | undefined): boolean {
    if (!architect) return false;
    return user.role === "lead" && architect.leadUserId === user.id;
  }

  isAdmin(user: SessionUser): boolean {
    return user.role === "admin";
  }
}

export const defaultUiAuthorizationPolicy = new UiAuthorizationPolicy();
