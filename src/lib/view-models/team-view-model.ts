import { UserFacingError } from "../api-errors";
import type { SessionUser } from "../api";
import type { Architect, RoleName } from "../domain";
import type { TeamSummary } from "../gateways/teams.gateway";
import type { UiAuthorizationPolicy } from "../scope";
import type { Api } from "../store";

/** Vazio enquanto nenhum nível de carreira estiver escolhido — nunca um `RoleName` inventado. */
export type ArchitectFormRole = RoleName | "";

export interface ArchitectFormValues {
  name: string;
  role: ArchitectFormRole;

  specialization: string;
  primarySpecializationCompetencyId: string | null;
  years: string;
  email: string;
  teamId: string | null;
}

export const emptyArchitectForm = (defaultRole: ArchitectFormRole): ArchitectFormValues => ({
  name: "",
  role: defaultRole,
  specialization: "",
  primarySpecializationCompetencyId: null,
  years: "",
  email: "",
  teamId: null,
});

export type TeamRosterService = Pick<
  Api,
  "addArchitect" | "updateArchitect" | "transitionCareerLevel" | "deactivate"
>;

export class TeamViewModel {
  constructor(
    private readonly service: TeamRosterService,
    private readonly policy: UiAuthorizationPolicy,
  ) {}

  isAdmin(user: SessionUser): boolean {
    return this.policy.isAdmin(user);
  }

  allocatableTeams(teams: readonly TeamSummary[]): TeamSummary[] {
    return teams.filter((team) => team.active);
  }

  validate(form: ArchitectFormValues): { yearsValid: boolean; canSubmit: boolean } {
    const yearsValid =
      form.years.trim() !== "" && Number.isInteger(Number(form.years)) && Number(form.years) >= 0;
    const canSubmit =
      form.name.trim().length > 0 &&
      form.email.trim().length > 0 &&
      form.email.includes("@") &&
      form.role !== "" &&
      yearsValid;
    return { yearsValid, canSubmit };
  }

  async submit(form: ArchitectFormValues, editingId: string | null): Promise<void> {
    const payload = {
      name: form.name.trim(),
      yearsAsArchitect: Number(form.years),
      primarySpecializationCompetencyId: form.primarySpecializationCompetencyId,
      email: form.email.trim(),
    };

    if (editingId) {
      this.service.updateArchitect(editingId, { ...payload, teamId: form.teamId });
      return;
    }

    if (form.role === "") {
      throw new UserFacingError(
        "Escolha o nível de carreira antes de cadastrar a pessoa. Se a lista está vazia, cadastre os níveis de carreira primeiro.",
      );
    }

    await this.service.addArchitect({
      ...payload,
      ...(form.teamId === null ? {} : { teamId: form.teamId }),
      specialization: "",
      role: form.role,
      active: true,
    });
  }

  reactivate(architect: Architect): void {
    this.service.updateArchitect(architect.id, { active: true });
  }

  transitionCareerLevel(architectId: string, toRole: RoleName, reason: string): Promise<Architect> {
    return this.service.transitionCareerLevel(architectId, toRole, reason);
  }

  deactivate(architectId: string, reason: string): Promise<Architect> {
    return this.service.deactivate(architectId, reason);
  }
}
