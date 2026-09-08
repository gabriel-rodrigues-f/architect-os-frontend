import { UserFacingError } from "../api-errors";
import type { Professional, DevelopmentPlan, MentoringSession } from "../domain";
import type { Gap } from "../selectors";
import type { Api } from "../store";
import { createPlanItemFromGap } from "./plan-item-from-gap";

export type MentoringService = Pick<
  Api,
  "addMentoringSession" | "scheduleMentoringFollowUp" | "createPlanItemFromGap"
>;

/**
 * O que o formulário de sessão pergunta hoje (dono, 2026-09-08, item 4):
 * TEMA e NOTAS. "Decisões" e "Ações" saíram da tela e param de viajar no
 * pedido — o serviço continua aceitando os dois (têm padrão vazio lá), e as
 * sessões antigas continuam mostrando o que já registraram.
 */
export interface MentoringSessionDraft {
  menteeId: string;
  date: string;
  topic: string;
  notes: string;
  nextSession: string;
}

export class MentoringViewModel {
  constructor(private readonly service: MentoringService) {}

  createSession(
    mentorName: string,
    form: MentoringSessionDraft,
    durationMin: number,
    competencyIds: string[],
  ): Promise<MentoringSession> {
    return this.service.addMentoringSession({
      id: "",
      mentor: mentorName,
      menteeId: form.menteeId,
      date: form.date,
      durationMin,
      topic: form.topic,
      competencyIds,
      notes: form.notes,
      ...(form.nextSession ? { nextSession: form.nextSession } : {}),
    });
  }

  /**
   * A LINHA DO TEMPO, da mais nova para a mais antiga (dono, 2026-09-08,
   * item 7). `localeCompare` devolve ZERO para o mesmo instante, e é isso que
   * faz a ordenação preservar o que o serviço mandou entre sessões do mesmo
   * dia — a comparação anterior nunca empatava e invertia esses pares.
   */
  newestFirst(sessions: readonly MentoringSession[]): MentoringSession[] {
    return [...sessions].sort((left, right) => right.date.localeCompare(left.date));
  }

  /**
   * A sessão que carrega o follow-up da pessoa: a mais recente dela. O
   * compromisso é UM só (dono, 2026-09-08, item 2) — "a evolução é contínua",
   * e a próxima conversa não pende de cada linha da história, mas do topo da
   * caixa.
   */
  followUpSessionOf(sessions: readonly MentoringSession[]): MentoringSession | undefined {
    return this.newestFirst(sessions)[0];
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

  async sendToPlan(
    session: Pick<MentoringSession, "menteeId" | "topic" | "actions" | "nextSession">,
    mentee: Pick<Professional, "name">,
    eligible: { assessmentId: string; competencyId: string },
  ): Promise<DevelopmentPlan> {
    const targetDate = session.nextSession;
    if (!targetDate) {
      throw new UserFacingError(
        "Agende o próximo encontro desta mentoria antes de mandar a ação para o PDI: sem essa data o item ficaria sem prazo real.",
      );
    }

    return createPlanItemFromGap(this.service, session.menteeId, {
      assessmentId: eligible.assessmentId,
      competencyId: eligible.competencyId,
      objective: session.topic,
      actionType: "Mentor",
      actionPlan: session.actions ?? "",
      targetDate,
      owner: mentee.name,
    });
  }
}
