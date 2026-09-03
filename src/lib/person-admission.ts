import { ApiError } from "./api-errors";
import {
  TeamLeadershipRoles,
  TEAM_MEMBER_ROLES,
  type SessionUser,
  type TeamMemberRole,
} from "./gateways/auth.gateway";
import type { TeamSummary } from "./gateways/teams.gateway";

export type AdmissionField = "name" | "email" | "cargo" | "seniority" | "team" | "form";

export interface PersonAdmissionValues {
  name: string;
  email: string;
  cargo: TeamMemberRole;
  careerLevelId: string | null;
  teamId: string | null;
}

export interface PersonAdmissionRequest {
  name: string;
  email: string;
  role: TeamMemberRole;
  teamId: string;
  careerLevelId?: string;
}

const CARGOS_DO_GESTOR: readonly TeamMemberRole[] = [TeamLeadershipRoles.TECH_LEAD, "member"];
const CARGOS_DO_TECH_LEAD: readonly TeamMemberRole[] = ["member"];

export class PersonAdmissionPolicy {
  admits(user: SessionUser): boolean {
    return this.admissibleCargos(user).length > 0;
  }

  admissibleCargos(user: SessionUser): readonly TeamMemberRole[] {
    if (user.role === "admin") return TEAM_MEMBER_ROLES;
    if (user.role === TeamLeadershipRoles.MANAGER) return CARGOS_DO_GESTOR;
    if (user.role === TeamLeadershipRoles.TECH_LEAD) return CARGOS_DO_TECH_LEAD;
    return [];
  }

  admissibleTeams(user: SessionUser, teams: readonly TeamSummary[]): TeamSummary[] {
    const active = teams.filter((team) => team.active);
    if (user.role === "admin") return active;
    if (!TeamLeadershipRoles.includes(user.role)) return [];
    const bound = this.teamsBoundAsOwnRole(user);
    return active.filter((team) => bound.has(team.id));
  }

  preselectedTeamId(user: SessionUser, teams: readonly TeamSummary[]): string | null {
    const reachable = this.admissibleTeams(user, teams);
    const [only, ...rest] = reachable;
    return only !== undefined && rest.length === 0 ? only.id : null;
  }

  private teamsBoundAsOwnRole(user: SessionUser): ReadonlySet<string> {
    return new Set(
      (user.memberships ?? [])
        .filter((membership) => membership.role === user.role)
        .map((membership) => membership.teamId),
    );
  }
}

export const defaultPersonAdmissionPolicy = new PersonAdmissionPolicy();

export class PersonAdmission {
  constructor(private readonly values: PersonAdmissionValues) {}

  static empty(cargo: TeamMemberRole, teamId: string | null): PersonAdmissionValues {
    return { name: "", email: "", cargo, careerLevelId: null, teamId };
  }

  get seniorityApplies(): boolean {
    return !TeamLeadershipRoles.includes(this.values.cargo);
  }

  get pending(): readonly AdmissionField[] {
    const missing: AdmissionField[] = [];
    if (this.values.name.trim().length < 2) missing.push("name");
    if (!this.values.email.includes("@") || this.values.email.trim().length < 4) {
      missing.push("email");
    }
    if (this.values.teamId === null) missing.push("team");
    if (this.seniorityApplies && this.values.careerLevelId === null) missing.push("seniority");
    return missing;
  }

  get isComplete(): boolean {
    return this.pending.length === 0;
  }

  toRequest(): PersonAdmissionRequest {
    const { name, email, cargo, teamId, careerLevelId } = this.values;
    if (teamId === null) throw new Error("Escolha o time desta pessoa");
    return {
      name: name.trim(),
      email: email.trim(),
      role: cargo,
      teamId,
      ...(this.seniorityApplies && careerLevelId !== null ? { careerLevelId } : {}),
    };
  }
}

/**
 * A recusa do serviço vira TEXTO JUNTO DO CAMPO que a causou, e trava o
 * envio até aquele campo mudar. Um toast some sozinho e deixa o formulário
 * com cara de pronto — foi por isso que o dono pediu a mensagem no campo.
 *
 * O texto é sempre o DO SERVIÇO (mesma régua da alocação de time, onda 33):
 * ele nomeia o gestor atual do time e diz o alcance de quem tentou; a tela
 * não inventa outro.
 */
export class AdmissionRefusal {
  private static readonly FIELD_BY_CODE: ReadonlyMap<string, AdmissionField> = new Map([
    ["TEAM_ALREADY_HAS_MANAGER", "team"],
    ["NOT_FOUND", "team"],
    ["PERSON_ADMISSION_FORBIDDEN", "cargo"],
    ["USER_ROLE_INVALID", "cargo"],
    ["EMAIL_ALREADY_REGISTERED", "email"],
    ["SENIORITY_REQUIRED_FOR_MEMBER", "seniority"],
    ["SENIORITY_NOT_APPLICABLE_TO_LEADERSHIP", "seniority"],
  ]);

  private constructor(
    readonly field: AdmissionField,
    readonly message: string,
    private readonly refused: PersonAdmissionValues,
  ) {}

  static of(error: unknown, values: PersonAdmissionValues): AdmissionRefusal | null {
    if (!(error instanceof ApiError)) return null;
    const field = AdmissionRefusal.FIELD_BY_CODE.get(error.code ?? "") ?? "form";
    return new AdmissionRefusal(field, error.message, { ...values });
  }

  stillApplies(values: PersonAdmissionValues): boolean {
    if (this.field === "form") return false;
    return this.culprit(values) === this.culprit(this.refused);
  }

  private culprit(values: PersonAdmissionValues): string {
    switch (this.field) {
      case "email":
        return values.email.trim().toLowerCase();
      case "cargo":
        return values.cargo;
      case "seniority":
        return `${values.cargo}/${values.careerLevelId ?? ""}`;
      case "team":
        return `${values.cargo}/${values.teamId ?? ""}`;
      default:
        return values.name.trim();
    }
  }
}
