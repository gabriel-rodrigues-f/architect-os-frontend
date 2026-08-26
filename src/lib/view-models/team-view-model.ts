import type { SessionUser } from "../api";
import type { Architect, RoleName } from "../domain";
import type { UiAuthorizationPolicy } from "../scope";
import type { Api } from "../store";

export interface ArchitectFormValues {
  name: string;
  role: RoleName;

  specialization: string;
  primarySpecializationCompetencyId: string | null;
  years: string;
  email: string;
  leadUserId: string;
}

export const emptyArchitectForm = (defaultRole: RoleName): ArchitectFormValues => ({
  name: "",
  role: defaultRole,
  specialization: "",
  primarySpecializationCompetencyId: null,
  years: "",
  email: "",
  leadUserId: "",
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

  validate(form: ArchitectFormValues): { yearsValid: boolean; canSubmit: boolean } {
    const yearsValid =
      form.years.trim() !== "" && Number.isInteger(Number(form.years)) && Number(form.years) >= 0;
    const canSubmit =
      form.name.trim().length > 0 &&
      form.email.trim().length > 0 &&
      form.email.includes("@") &&
      yearsValid;
    return { yearsValid, canSubmit };
  }

  async submit(form: ArchitectFormValues, editingId: string | null): Promise<void> {
    const payload = {
      name: form.name.trim(),
      yearsAsArchitect: Number(form.years),
      primarySpecializationCompetencyId: form.primarySpecializationCompetencyId,
      email: form.email.trim(),
      leadUserId: form.leadUserId || null,
    };

    if (editingId) {
      this.service.updateArchitect(editingId, payload);
      return;
    }

    await this.service.addArchitect({
      ...payload,
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
