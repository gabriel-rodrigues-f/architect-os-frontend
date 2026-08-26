import type { AppState } from "../api";
import type { Architect, DevelopmentPlan, LearningPath } from "../domain";
import { defaultGapSeverityRuler } from "../scoring-bands";
import type { Gap, Selectors } from "../selectors";

/**
 * OO3-11e — os KPIs do painel (`AdminHome`, `routes/index.tsx`) eram ~30
 * linhas de derivação inline dentro do componente, sem cobertura unitária
 * (a suíte de DOM só prova qual Home cada papel vê). Presenter, não
 * ViewModel: derivação pura de estado para exibição — não recebe serviço,
 * não tem método que devolve `Promise` (ver a definição que os ViewModels
 * documentam no próprio docstring).
 */

export interface AssessmentCoverage {
  completed: number;
  inReview: number;
  draft: number;
  notStarted: number;
}

export interface GapWithArchitect extends Gap {
  architect: Architect;
}

/**
 * Limiar de "gap crítico" do painel — CFG-02: deixou de ser o literal 3 e
 * virou o `min` da faixa `critical` da régua DEFAULT de gap
 * (`DEFAULT_SCORING_BANDS`, fallback byte-idêntico ao seed). A rota passa o
 * limiar EFETIVO (`useGapSeverityRuler().criticalThreshold`) no construtor.
 */
export const CRITICAL_GAP_THRESHOLD = defaultGapSeverityRuler.criticalThreshold;

export class DashboardPresenter {
  constructor(
    private readonly state: Pick<AppState, "plans" | "learningPaths" | "activeCycleId">,
    private readonly sel: Pick<Selectors, "progressionGapsFor" | "assessmentFor">,
    private readonly criticalGapThreshold: number = CRITICAL_GAP_THRESHOLD,
  ) {}

  gapsOf(population: readonly Architect[]): GapWithArchitect[] {
    return population.flatMap((a) =>
      this.sel.progressionGapsFor(a.id).map((g) => ({ ...g, architect: a })),
    );
  }

  criticalGapCount(population: readonly Architect[]): number {
    return this.gapsOf(population).filter((g) => g.gap >= this.criticalGapThreshold).length;
  }

  /**
   * `sort` estável sobre uma cópia — `gapsFor` já devolve ordenado desc por
   * gap dentro de cada pessoa; reordenar aqui preserva os empates na mesma
   * ordem de antes.
   */
  topGaps(population: readonly Architect[], limit = 6): GapWithArchitect[] {
    return [...this.gapsOf(population)].sort((a, b) => b.gap - a.gap).slice(0, limit);
  }

  activePlans(): DevelopmentPlan[] {
    return this.state.plans.filter((p) => p.cycleId === this.state.activeCycleId);
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

  get pathsInProgress(): number {
    return this.state.learningPaths.filter((p) =>
      p.progress.some((entry) => entry.status === "In Progress"),
    ).length;
  }

  /**
   * Cobertura das avaliações do ciclo ativo — sem isto, o heatmap e as
   * médias do painel podem parecer representar o time inteiro quando na
   * verdade só cobrem quem já tem assessment `Completed`. "Sem assessment"
   * cai em `notStarted`; os 4 baldes sempre somam `population.length`. Ver
   * AUDITORIA-RIGIDA-SEGUNDA-REVISAO-SYNAPSE.md, Seção 42.
   */
  assessmentCoverage(population: readonly Architect[]): AssessmentCoverage {
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

/** Itens do PDI ativo da pessoa, por status — os 4 baldes que a Home de Member exibe. */
export interface PlanItemCounts {
  notStarted: number;
  inProgress: number;
  blocked: number;
  completed: number;
}

/**
 * OO3-11/D-5 (reuso final) — os KPIs PESSOAIS eram derivados inline duas
 * vezes: na Home de Member (`routes/index.tsx`) e no perfil do arquiteto
 * (`routes/architects.$architectId.index.tsx`), com o mesmo cálculo
 * (`progressionGapsFor` filtrado a gap>0, itens do PDI por status,
 * evidências Pending, trilhas atribuídas). Mesmo padrão do
 * `DashboardPresenter` acima: derivação pura, sem serviço, sem `Promise`.
 * A média com cobertura (`coverageFor`) já é seletor compartilhado e não
 * entra aqui de novo.
 */
export class PersonalDashboardPresenter {
  constructor(
    private readonly state: Pick<AppState, "learningPaths" | "evidences">,
    private readonly sel: Pick<Selectors, "progressionGapsFor" | "planFor">,
  ) {}

  /** Só lacunas reais (gap > 0) — `progressionGapsFor` também devolve gap 0/negativo. */
  openGaps(architectId: string): Gap[] {
    return this.sel.progressionGapsFor(architectId).filter((g) => g.gap > 0);
  }

  planItemCounts(architectId: string): PlanItemCounts {
    const items = this.sel.planFor(architectId)?.items ?? [];
    return {
      notStarted: items.filter((i) => i.status === "Not Started").length,
      inProgress: items.filter((i) => i.status === "In Progress").length,
      blocked: items.filter((i) => i.status === "Blocked").length,
      completed: items.filter((i) => i.status === "Completed").length,
    };
  }

  pendingEvidenceCount(architectId: string): number {
    return this.state.evidences.filter(
      (e) => e.architectId === architectId && e.status === "Pending",
    ).length;
  }

  assignedPaths(architectId: string): LearningPath[] {
    return this.state.learningPaths.filter((p) => p.assignedTo.includes(architectId));
  }
}
