import type { MentoringSession } from "../domain";
import type { Api } from "../store";

export type MentoringService = Pick<Api, "addMentoringSession" | "scheduleMentoringFollowUp">;

/**
 * O que o formulário de sessão pergunta hoje: MENTORADO, DATA DA MENTORIA,
 * DURAÇÃO, TEMA e NOTAS — os cinco campos que o dono deixou em 2026-09-09.
 *
 * "Decisões" e "Ações" saíram do formulário em 2026-09-08 (item 4) e do
 * produto inteiro em 2026-09-09 — *"deve morrer totalmente, front, back e
 * banco"* —, junto com "Competências discutidas" e com o botão que mandava a
 * ação da 1:1 para o PDI: *"não quero mais vinculo aqui com PDI."*
 *
 * A PRÓXIMA CONVERSA não some do produto: quem a marca é o "Agendar
 * follow-up" da Linha do Tempo, que escreve a mesma coluna por outro caminho
 * (PATCH sobre a sessão mais recente da pessoa).
 */
export interface MentoringSessionDraft {
  menteeId: string;
  date: string;
  topic: string;
  notes: string;
}

export class MentoringViewModel {
  constructor(private readonly service: MentoringService) {}

  createSession(
    mentorName: string,
    form: MentoringSessionDraft,
    durationMin: number,
  ): Promise<MentoringSession> {
    return this.service.addMentoringSession({
      id: "",
      mentor: mentorName,
      menteeId: form.menteeId,
      date: form.date,
      durationMin,
      topic: form.topic,
      notes: form.notes,
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
}
