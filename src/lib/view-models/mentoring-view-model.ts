import type { Architect, DevelopmentPlan, MentoringSession, ProficiencyUpdate } from "../domain";
import type { Gap } from "../selectors";
import type { Api } from "../store";
import { defaultDateFormatter } from "../text";
import { createPlanItemFromGap } from "./plan-item-from-gap";

export type MentoringService = Pick<
  Api,
  "addMentoringSession" | "scheduleMentoringFollowUp" | "createPlanItemFromGap"
>;

export interface MentoringSessionDraft {
  menteeId: string;
  date: string;
  topic: string;
  notes: string;
  decisions: string;
  actions: string;
  nextSession: string;
}

export class MentoringViewModel {
  constructor(private readonly service: MentoringService) {}

  createSession(
    mentorName: string,
    form: MentoringSessionDraft,
    durationMin: number,
    competencyIds: string[],
    proficiencyUpdates: ProficiencyUpdate[],
  ): Promise<MentoringSession> {
    return this.service.addMentoringSession(
      {
        id: "",
        mentor: mentorName,
        menteeId: form.menteeId,
        date: form.date,
        durationMin,
        topic: form.topic,
        competencyIds,
        notes: form.notes,
        decisions: form.decisions,
        actions: form.actions,
        ...(form.nextSession ? { nextSession: form.nextSession } : {}),
      },
      proficiencyUpdates,
    );
  }

  scheduleFollowUp(sessionId: string, nextSession: string | null): Promise<MentoringSession> {
    return this.service.scheduleMentoringFollowUp(sessionId, nextSession);
  }

  eligibleGapForPlan(
    session: Pick<MentoringSession, "competencyIds">,
    gaps: readonly Gap[],
    plan: Pick<DevelopmentPlan, "items"> | undefined,
  ): Gap | undefined {
    return session.competencyIds
      .map((competencyId) => gaps.find((g) => g.item.competencyId === competencyId))
      .find((g) => g && !plan?.items.some((i) => i.competencyId === g.item.competencyId));
  }

  sendToPlan(
    session: Pick<MentoringSession, "menteeId" | "topic" | "actions" | "nextSession">,
    mentee: Pick<Architect, "name">,
    eligible: { assessmentId: string; competencyId: string },
  ): Promise<DevelopmentPlan> {
    return createPlanItemFromGap(this.service, session.menteeId, {
      assessmentId: eligible.assessmentId,
      competencyId: eligible.competencyId,
      objective: session.topic,
      actionType: "Mentor",
      actionPlan: session.actions,
      targetDate: session.nextSession ?? defaultDateFormatter.todayIso(),
      owner: mentee.name,
    });
  }
}
