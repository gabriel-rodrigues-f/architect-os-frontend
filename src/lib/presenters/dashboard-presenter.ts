import type { AppState, SessionUser } from "../api";
import type {
  Professional,
  Assessment,
  DevelopmentPlan,
  LearningPath,
  MentoringSession,
} from "../domain";
import { defaultUiAuthorizationPolicy, type UiAuthorizationPolicy } from "../scope";
import { defaultGapSeverityRuler, type BandTone, type GapSeverityRuler } from "../scoring-bands";
import type { Gap, Selectors } from "../selectors";

interface AssessmentCoverage {
  completed: number;
  inReview: number;
  draft: number;
  notStarted: number;
}

interface GapWithProfessional extends Gap {
  professional: Professional;
}

export const CRITICAL_GAP_THRESHOLD = defaultGapSeverityRuler.criticalThreshold;

interface ProfessionalAwaitingCalibration {
  professional: Professional;
  assessment: Assessment | undefined;
}

interface ProfessionalAwaitingApproval {
  professional: Professional;
  plan: DevelopmentPlan | undefined;
}

/** Quantas distâncias críticas UMA pessoa carrega — o nome por trás do agregado. */
export interface ProfessionalCriticalGaps {
  professional: Professional;
  count: number;
}

/** Há quantos dias a pessoa não tem uma 1:1 registrada. `null` = nunca teve. */
export interface OneOnOneRecency {
  professional: Professional;
  days: number | null;
}

/** A 1:1 de retorno que ficou para trás, com o dia que foi marcado. */
export interface OverdueFollowUp {
  professional: Professional;
  dueOn: string;
}

/** A trilha que a pessoa tem atribuída e ainda não moveu nenhum item. */
export interface StalledPath {
  professional: Professional;
  path: LearningPath;
}

/**
 * As filas que esperam uma decisão da liderança. Eram três; a de evidências a
 * revisar saiu com a evidência (dono, 2026-09-08, regra 17), e `totalPending`
 * — o número do bloco "Ações da Liderança" — passou a somar duas parcelas.
 */
export class LeadPendingQueues {
  constructor(
    readonly people: readonly Professional[],
    readonly awaitingCalibration: readonly ProfessionalAwaitingCalibration[],
    readonly awaitingApproval: readonly ProfessionalAwaitingApproval[],
  ) {}

  get totalPending(): number {
    return this.awaitingCalibration.length + this.awaitingApproval.length;
  }
}

export class DashboardPresenter {
  private readonly gapsCache = new WeakMap<readonly Professional[], GapWithProfessional[]>();

  constructor(
    private readonly state: Pick<
      AppState,
      "professionals" | "plans" | "learningPaths" | "mentoringSessions" | "cycles" | "activeCycleId"
    >,
    private readonly sel: Pick<Selectors, "progressionGapsFor" | "assessmentFor" | "planFor">,
    private readonly criticalGapThreshold: number = CRITICAL_GAP_THRESHOLD,
    private readonly authorization: UiAuthorizationPolicy = defaultUiAuthorizationPolicy,
  ) {}

  get noCycleRegistered(): boolean {
    return this.state.cycles.length === 0;
  }

  pendingQueuesFor(user: SessionUser): LeadPendingQueues {
    const people = this.state.professionals.filter(
      (professional) => professional.active && this.authorization.leadsTeamOf(user, professional),
    );

    const awaitingCalibration = people
      .map((professional) => ({
        professional,
        assessment: this.sel.assessmentFor(professional.id),
      }))
      .filter((entry) => entry.assessment?.status === "In Review");

    const awaitingApproval = people
      .map((professional) => ({ professional, plan: this.sel.planFor(professional.id) }))
      .filter(
        (entry) => entry.plan && entry.plan.status === "Draft" && entry.plan.items.length > 0,
      );

    return new LeadPendingQueues(people, awaitingCalibration, awaitingApproval);
  }

  gapsOf(population: readonly Professional[]): GapWithProfessional[] {
    const cached = this.gapsCache.get(population);
    if (cached) return cached;

    const gaps = population.flatMap((a) =>
      this.sel.progressionGapsFor(a.id).map((g) => ({ ...g, professional: a })),
    );

    this.gapsCache.set(population, gaps);
    return gaps;
  }

  /** Quantas distâncias do time caem em cada faixa de severidade da régua. */
  gapsBySeverity(
    population: readonly Professional[],
    ruler: GapSeverityRuler,
  ): Record<BandTone, number> {
    const counts: Record<BandTone, number> = { ok: 0, low: 0, high: 0, critical: 0 };
    for (const gap of this.gapsOf(population)) counts[ruler.severityOf(gap.gap)] += 1;
    return counts;
  }

  criticalGapCount(population: readonly Professional[]): number {
    return this.gapsOf(population).filter((g) => g.gap >= this.criticalGapThreshold).length;
  }

  /**
   * QUEM tem distância crítica, e quantas — do maior para o menor.
   *
   * O agregado sozinho ("21 distâncias críticas na organização") apaga a
   * única informação que muda decisão: no banco do dono, 100% das 21 estavam
   * em DUAS pessoas. Nesta escala, "onde agir" não tem resolução
   * organizacional — resolve em nomes.
   */
  criticalGapsByProfessional(
    population: readonly Professional[],
  ): readonly ProfessionalCriticalGaps[] {
    const byProfessional = new Map<string, ProfessionalCriticalGaps>();
    for (const gap of this.gapsOf(population)) {
      if (gap.gap < this.criticalGapThreshold) continue;
      const entry = byProfessional.get(gap.professional.id);
      if (entry) entry.count += 1;
      else byProfessional.set(gap.professional.id, { professional: gap.professional, count: 1 });
    }
    return [...byProfessional.values()].sort((a, b) => b.count - a.count);
  }

  activePlans(): DevelopmentPlan[] {
    return this.state.plans.filter((p) => p.cycleId === this.state.activeCycleId);
  }

  /**
   * Os planos APROVADOS do ciclo, restritos à mesma população do denominador.
   *
   * O cartão "PDIs do ciclo" dividia populações diferentes: o numerador
   * contava planos de todo o recorte que a API entregou — inclusive pessoas
   * desativadas e o próprio líder —, e o denominador contava só as pessoas
   * ativas sob liderança. Bastava uma pessoa desativada com PDI aprovado para
   * o cartão passar de 100%. Uma pessoa conta uma vez, mesmo com dois planos.
   */
  approvedPlansOf(population: readonly Professional[]): DevelopmentPlan[] {
    const inScope = new Set(population.map((professional) => professional.id));
    const seen = new Set<string>();
    return this.activePlans().filter((plan) => {
      if (plan.status !== "Approved") return false;
      if (!inScope.has(plan.professionalId)) return false;
      if (seen.has(plan.professionalId)) return false;
      seen.add(plan.professionalId);
      return true;
    });
  }

  private get activePlanItems() {
    return this.activePlans().flatMap((p) => p.items);
  }

  get goalsInProgress(): number {
    return this.activePlanItems.filter((i) => i.status === "In Progress").length;
  }

  get goalsDone(): number {
    return this.activePlanItems.filter((i) => i.status === "Completed").length;
  }

  /**
   * DIAS DESDE A ÚLTIMA 1:1, pessoa a pessoa. `null` é quem nunca teve uma —
   * ausência, nunca zero: zero diria "conversamos hoje".
   */
  oneOnOneRecency(
    population: readonly Professional[],
    today: Date = new Date(),
  ): readonly OneOnOneRecency[] {
    return population.map((professional) => {
      const last = this.lastSessionOf(professional.id);
      return {
        professional,
        days: last ? DashboardPresenter.daysBetween(last.date, today) : null,
      };
    });
  }

  /** O maior intervalo do time — o número-síntese da recência de 1:1. */
  longestSinceOneOnOne(population: readonly Professional[], today: Date = new Date()): number {
    const days = this.oneOnOneRecency(population, today)
      .map((entry) => entry.days)
      .filter((value): value is number => value !== null);
    return days.length > 0 ? Math.max(...days) : 0;
  }

  /**
   * 1:1 DE RETORNO VENCIDA: a pessoa cuja ÚLTIMA sessão marcou um retorno em
   * data já passada. Sessão posterior ao retorno apaga o vencimento — a
   * conversa aconteceu.
   *
   * Não há limiar de dias aqui, e não invento um: a regra é "a data marcada
   * já passou". O "8, não 14" da análise é a POPULAÇÃO medida no banco do
   * dono (8 das 14 pessoas), não um prazo.
   */
  overdueFollowUps(
    population: readonly Professional[],
    today: Date = new Date(),
  ): readonly OverdueFollowUp[] {
    const overdue: OverdueFollowUp[] = [];
    for (const professional of population) {
      const last = this.lastSessionOf(professional.id);
      const dueOn = last?.nextSession;
      if (!dueOn) continue;
      if (DashboardPresenter.daysBetween(dueOn, today) > 0) overdue.push({ professional, dueOn });
    }
    return overdue;
  }

  /**
   * TRILHA ATRIBUÍDA E PARADA: a pessoa inscrita numa trilha sem nenhum item
   * concluído. Não é "sem trilha" — é trilha que existe e não andou.
   */
  stalledPaths(population: readonly Professional[]): readonly StalledPath[] {
    const stalled: StalledPath[] = [];
    for (const professional of population) {
      for (const path of this.state.learningPaths) {
        if (!path.assignedTo.includes(professional.id)) continue;
        const completed = path.progress.some(
          (entry) => entry.professionalId === professional.id && entry.status === "Completed",
        );
        if (!completed) stalled.push({ professional, path });
      }
    }
    return stalled;
  }

  private lastSessionOf(professionalId: string): MentoringSession | undefined {
    return this.state.mentoringSessions
      .filter((session) => session.menteeId === professionalId)
      .reduce<MentoringSession | undefined>(
        (latest, session) => (latest && latest.date >= session.date ? latest : session),
        undefined,
      );
  }

  /** Dias corridos entre um dia do calendário (AAAA-MM-DD) e hoje, no UTC do dia. */
  private static daysBetween(isoDay: string, today: Date): number {
    const day = Date.parse(`${isoDay.slice(0, 10)}T00:00:00.000Z`);
    const reference = Date.UTC(
      today.getUTCFullYear(),
      today.getUTCMonth(),
      today.getUTCDate(),
      0,
      0,
      0,
      0,
    );
    return Math.round((reference - day) / 86_400_000);
  }

  assessmentCoverage(population: readonly Professional[]): AssessmentCoverage {
    return population.reduce(
      (acc, a) => {
        const status = this.sel.assessmentFor(a.id)?.status;
        if (status === "Completed") acc.completed += 1;
        else if (status === "In Review") acc.inReview += 1;
        else if (status === "Draft") acc.draft += 1;
        else acc.notStarted += 1;
        return acc;
      },
      { completed: 0, inReview: 0, draft: 0, notStarted: 0 },
    );
  }
}

interface PlanItemCounts {
  notStarted: number;
  inProgress: number;
  blocked: number;
  completed: number;
}

export class PersonalDashboardPresenter {
  constructor(
    private readonly state: Pick<AppState, "learningPaths">,
    private readonly sel: Pick<Selectors, "progressionGapsFor" | "planFor">,
  ) {}

  openGaps(professionalId: string): Gap[] {
    return this.sel.progressionGapsFor(professionalId).filter((g) => g.gap > 0);
  }

  planItemCounts(professionalId: string): PlanItemCounts {
    const items = this.sel.planFor(professionalId)?.items ?? [];
    return {
      notStarted: items.filter((i) => i.status === "Not Started").length,
      inProgress: items.filter((i) => i.status === "In Progress").length,
      blocked: items.filter((i) => i.status === "Blocked").length,
      completed: items.filter((i) => i.status === "Completed").length,
    };
  }

  assignedPaths(professionalId: string): LearningPath[] {
    return this.state.learningPaths.filter((p) => p.assignedTo.includes(professionalId));
  }
}
