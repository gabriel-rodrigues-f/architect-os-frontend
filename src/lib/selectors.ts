import type { AppState } from "./api";
import type { Assessment, Competency, CompetencyCategory, Level, RoleName } from "./domain";

/**
 * Derivações puras sobre o snapshot da API. Ficam fora do componente para poderem
 * ser testadas sem React — `useSelectors()` apenas memoiza `createSelectors`.
 */

export const emptyState: AppState = {
  categories: [],
  competencies: [],
  architects: [],
  assessments: [],
  cycles: [],
  plans: [],
  learningPaths: [],
  mentoringSessions: [],
  evidences: [],
  activeCycleId: "",
};

export interface Gap {
  competency: Competency | undefined;
  item: Assessment["items"][number];
  gap: number;
}

/**
 * `avg`/`target` ficam `undefined` quando não há assessment oficial cobrindo
 * o domínio para essa pessoa/ciclo — nunca `0`. Um `0` aqui seria
 * indistinguível de "avaliado e no nível mais baixo", e cada tela que soma
 * ou classifica por nível herdaria esse erro silenciosamente (ver
 * AUDITORIA-RIGIDA-SEGUNDA-REVISAO-SYNAPSE.md, Seção 6).
 */
export interface DomainAverage {
  category: CompetencyCategory;
  avg: number | undefined;
  target: number | undefined;
}

export interface TrainingNeed {
  competency: Competency | undefined;
  people: number;
  avgGap: number;
  totalGap: number;
}

const byId = <T extends { id: string }>(items: T[]): Map<string, T> =>
  new Map(items.map((item) => [item.id, item]));

/** Chave composta para o que é indexado por arquiteto + ciclo. */
const cycleKey = (architectId: string, cycleId: string) => `${architectId} ${cycleId}`;

const indexByArchitectAndCycle = <T extends { architectId: string; cycleId: string }>(
  items: T[],
): Map<string, T> => new Map(items.map((item) => [cycleKey(item.architectId, item.cycleId), item]));

/**
 * Os índices são construídos uma vez por versão do estado. Antes cada busca era
 * um `find` linear dentro de laços — `domainAverages` chegava a ser O(domínios ×
 * competências²) por arquiteto, e o painel repete isso para o time inteiro a
 * cada render.
 */
export function createSelectors(s: AppState) {
  const competencyIndex = byId(s.competencies);
  const categoryIndex = byId(s.categories);
  const architectIndex = byId(s.architects);
  const assessmentIndex = indexByArchitectAndCycle(s.assessments);
  const planIndex = indexByArchitectAndCycle(s.plans);

  const competencyById = (id: string) => competencyIndex.get(id);
  const categoryById = (id: string) => categoryIndex.get(id);
  const architectById = (id: string) => architectIndex.get(id);

  /**
   * Nome/domínio de um item de assessment: catálogo atual quando a competência
   * ainda existe lá (é o caso comum), senão a fotografia gravada no próprio
   * item (`competencyName`/`categoryId`) — histórico não pode depender de uma
   * linha do catálogo que foi apagada ou renomeada depois. Itens de antes desta
   * migração não têm fotografia; nesse caso, sem catálogo vivo, não há nome a
   * mostrar. Ver AUDITORIA-TERCEIRA-RODADA-RECONSTRUCAO-PRODUTO-SYNAPSE.md, EPIC C.
   */
  const resolveCompetency = (item: Assessment["items"][number]): Competency | undefined => {
    const live = competencyIndex.get(item.competencyId);
    if (live) return live;
    if (!item.competencyName) return undefined;
    return {
      id: item.competencyId,
      name: item.competencyName,
      categoryId: item.categoryId ?? "",
      expected: {} as Record<RoleName, Level>,
      active: false,
    };
  };

  const assessmentFor = (architectId: string, cycleId = s.activeCycleId) =>
    assessmentIndex.get(cycleKey(architectId, cycleId));
  const planFor = (architectId: string, cycleId = s.activeCycleId) =>
    planIndex.get(cycleKey(architectId, cycleId));

  /**
   * A mesma busca de `assessmentFor`, mas só devolve o assessment quando ele
   * é `Completed` — a fotografia oficial do ciclo. Gap, cobertura de domínio,
   * índice de desenvolvimento e necessidade de treinamento usam esta versão:
   * uma autoavaliação em rascunho (todo item nasce em nível 1) não pode
   * aparecer como lacuna real, e uma avaliação em revisão ainda não foi
   * calibrada pelo Tech Lead. Ver PLANO-360-AGENTES-SYNAPSE.md, Seção 9.
   */
  const officialAssessmentFor = (architectId: string, cycleId = s.activeCycleId) => {
    const assessment = assessmentFor(architectId, cycleId);
    return assessment?.status === "Completed" ? assessment : undefined;
  };

  // As telas pedem os mesmos recortes várias vezes no mesmo render; o cache vive
  // enquanto esta versão do estado existir.
  const gapsCache = new Map<string, Gap[]>();
  const averagesCache = new Map<string, DomainAverage[]>();

  const gapsFor = (architectId: string, cycleId = s.activeCycleId): Gap[] => {
    const cacheKey = cycleKey(architectId, cycleId);
    const cached = gapsCache.get(cacheKey);
    if (cached) return cached;

    const assessment = officialAssessmentFor(architectId, cycleId);
    const gaps = !assessment
      ? []
      : assessment.items
          .map((item) => ({
            competency: resolveCompetency(item),
            item,
            gap: item.target - item.final,
          }))
          .filter((g) => !!g.competency)
          .sort((x, y) => y.gap - x.gap);

    gapsCache.set(cacheKey, gaps);
    return gaps;
  };

  const domainAverages = (architectId: string, cycleId = s.activeCycleId): DomainAverage[] => {
    const cacheKey = cycleKey(architectId, cycleId);
    const cached = averagesCache.get(cacheKey);
    if (cached) return cached;

    // Uma passada pelos itens acumulando por domínio, em vez de varrer os itens
    // uma vez para cada domínio.
    const totals = new Map<string, { final: number; target: number; count: number }>();
    for (const item of officialAssessmentFor(architectId, cycleId)?.items ?? []) {
      const categoryId = competencyIndex.get(item.competencyId)?.categoryId ?? item.categoryId;
      if (!categoryId) continue;
      const acc = totals.get(categoryId) ?? { final: 0, target: 0, count: 0 };
      acc.final += item.final;
      acc.target += item.target;
      acc.count += 1;
      totals.set(categoryId, acc);
    }

    const averages = s.categories.map((category) => {
      const acc = totals.get(category.id);
      if (!acc?.count) return { category, avg: undefined, target: undefined };
      const mean = (value: number) => Number((value / acc.count).toFixed(2));
      return { category, avg: mean(acc.final), target: mean(acc.target) };
    });

    averagesCache.set(cacheKey, averages);
    return averages;
  };

  /** LNT: lacunas positivas agregadas por competência, ordenadas pelo impacto. */
  const teamTrainingNeeds = (): TrainingNeed[] => {
    const totals = new Map<string, { people: number; totalGap: number }>();
    for (const architect of s.architects) {
      for (const gap of gapsFor(architect.id)) {
        if (gap.gap <= 0) continue;
        const acc = totals.get(gap.item.competencyId) ?? { people: 0, totalGap: 0 };
        totals.set(gap.item.competencyId, {
          people: acc.people + 1,
          totalGap: acc.totalGap + gap.gap,
        });
      }
    }

    return [...totals.entries()]
      .map(([competencyId, v]) => ({
        competency: competencyIndex.get(competencyId),
        people: v.people,
        avgGap: Number((v.totalGap / v.people).toFixed(1)),
        totalGap: v.totalGap,
      }))
      .filter((need) => !!need.competency)
      .sort((x, y) => y.totalGap - x.totalGap);
  };

  return {
    competencyById,
    categoryById,
    architectById,
    assessmentFor,
    officialAssessmentFor,
    planFor,
    gapsFor,
    domainAverages,
    teamTrainingNeeds,
  };
}

export type Selectors = ReturnType<typeof createSelectors>;

/**
 * Média só de quem tem valor, mais cobertura (quantos de quantos) — nunca
 * trata ausência como zero. Toda tela que soma `avg`/`target` de várias
 * pessoas ou vários domínios passa por aqui, para não repetir o mesmo erro
 * em cada lugar. Ver AUDITORIA-RIGIDA-SEGUNDA-REVISAO-SYNAPSE.md, Seção 9.
 */
export function averageWithCoverage(values: (number | undefined)[]): {
  avg: number | undefined;
  covered: number;
  total: number;
} {
  const present = values.filter((v): v is number => v !== undefined);
  return {
    avg: present.length ? present.reduce((sum, v) => sum + v, 0) / present.length : undefined,
    covered: present.length,
    total: values.length,
  };
}
