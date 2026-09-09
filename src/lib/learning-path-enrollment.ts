import type { LearningPath } from "./domain";

/**
 * FATIA PRAZOS, item 2 — a INSCRIÇÃO de uma pessoa numa trilha, lida pelo
 * prazo: quando ela entrou, quando vence, quanto falta e se já saiu.
 *
 * É o espelho de tela do objeto de valor do backend
 * (`LearningPathEnrollment`), como `UiAuthorizationPolicy` é o espelho do
 * `AuthorizationService`: o backend continua sendo a autoridade — ele recusa
 * o avanço de quem venceu —, e a tela precisa da MESMA conta para não
 * prometer um controle que o servidor vai negar.
 *
 * O relógio entra pela porta (`at`). A tela passa `new Date()`; o teste passa
 * o dia que quiser, e nenhum dos dois precisa congelar o tempo do processo.
 */
export class LearningPathEnrollmentReading {
  private static readonly MILLIS_PER_DAY = 86_400_000;

  private constructor(
    readonly professionalId: string,
    readonly enrolledAt: string,
    private readonly deadlineDays: number | null,
  ) {}

  /** A inscrição desta pessoa nesta trilha — `undefined` se ela não está inscrita. */
  static of(
    path: Pick<LearningPath, "enrollments" | "completionDeadlineDays">,
    professionalId: string,
  ): LearningPathEnrollmentReading | undefined {
    const enrollment = path.enrollments.find(
      (candidate) => candidate.professionalId === professionalId,
    );
    if (!enrollment) return undefined;
    return new LearningPathEnrollmentReading(
      enrollment.professionalId,
      enrollment.enrolledAt,
      path.completionDeadlineDays,
    );
  }

  get hasDeadline(): boolean {
    return this.deadlineDays !== null;
  }

  /** O instante do vencimento — `undefined` quando a trilha não tem prazo. */
  get dueAt(): string | undefined {
    if (this.deadlineDays === null) return undefined;
    const start = new Date(this.enrolledAt).getTime();
    return new Date(
      start + this.deadlineDays * LearningPathEnrollmentReading.MILLIS_PER_DAY,
    ).toISOString();
  }

  /** Quantos dias faltam, arredondando para cima; negativo depois de vencido. */
  daysLeftAt(at: Date): number | undefined {
    const dueAt = this.dueAt;
    if (dueAt === undefined) return undefined;
    return Math.ceil(
      (new Date(dueAt).getTime() - at.getTime()) / LearningPathEnrollmentReading.MILLIS_PER_DAY,
    );
  }

  expiredAt(at: Date): boolean {
    const dueAt = this.dueAt;
    return dueAt !== undefined && at.getTime() > new Date(dueAt).getTime();
  }
}

/**
 * O campo do formulário fala TEXTO; a trilha fala número de dias ou nada.
 * Vazio, zero e lixo viram `null` — "sem prazo" —, que é o que o backend
 * grava e o CHECK do banco aceita. A tradução mora aqui porque os dois
 * diálogos da tela (criar e editar) fazem a mesma conversão.
 */
export class CompletionDeadlineInput {
  static toDays(text: string): number | null {
    const parsed = Number(text.trim());
    if (text.trim() === "" || !Number.isFinite(parsed) || parsed < 1) return null;
    return Math.floor(parsed);
  }

  static fromDays(days: number | null): string {
    return days === null ? "" : String(days);
  }
}
