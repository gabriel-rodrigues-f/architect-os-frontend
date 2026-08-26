import type { AppState, SessionUser } from "./api";
import type {
  Architect,
  Assessment,
  AssessmentTargetSemantics,
  Competency,
  Capability,
  Evidence,
  Level,
  RoleName,
} from "./domain";
import { capabilityShortLabels } from "./domain";
import { defaultUiAuthorizationPolicy, type UiAuthorizationPolicy } from "./scope";

/**
 * Derivações puras sobre o snapshot da API. Ficam fora do componente para poderem
 * ser testadas sem React — `useSelectors()` apenas memoiza `createSelectors`.
 *
 * OO2-08 (AUDITORIA-OO-PADRONIZACAO-ANALYTICS-IA-SYNAPSE-2026-08-25.md,
 * Seção 62) — por dentro, `createSelectors` deixou de ser um único closure
 * gigante e passou a montar quatro objetos por contexto
 * (`ArchitectSelectors`, `AssessmentSelectors`, `DevelopmentSelectors`,
 * `CapabilitySelectors`, mais `TrainingSelectors` para a agregação de time
 * que depende dos outros dois) — os quatro nomes que a própria auditoria
 * sugere. A forma externa NÃO mudou: `createSelectors(s)` continua
 * devolvendo o mesmo objeto achatado de sempre (`Selectors`), porque uns 20
 * arquivos (rotas, `store.tsx`, outros `-shared.tsx`) já chamam `sel.gapsFor(...)`
 * etc. diretamente — refazer todos os call sites nesta mesma PR seria o
 * Big Bang que a Seção 145 proíbe. As classes internas ficam exportadas
 * para quem quiser instanciar/testar uma fatia isolada (ex.: um ViewModel
 * futuro que só precisa de `AssessmentSelectors`, sem montar o objeto
 * achatado inteiro).
 */

export const emptyState: AppState = {
  capabilities: [],
  competencies: [],
  careerLevelPolicies: [],
  architects: [],
  assessments: [],
  cycles: [],
  plans: [],
  learningPaths: [],
  mentoringSessions: [],
  evidences: [],
  activeCycleId: "",
};

/**
 * Item de assessment com `self`/`leader`/`final` garantidamente preenchidos
 * — o backend só deixa um assessment virar `Completed` quando todos os
 * itens têm os três campos preenchidos (ver AUDITORIA-QUINTA-RODADA-360-
 * SYNAPSE-2026-08-19.md, DOM-002), então filtrar por `officialAssessmentFor`
 * (só `Completed`) e por item preenchido garante este tipo sem precisar de
 * `!` espalhado pelas telas que consomem gap.
 */
export type EvaluatedAssessmentItem = Assessment["items"][number] & {
  self: Level;
  leader: Level;
  final: Level;
};

const isEvaluated = (item: Assessment["items"][number]): item is EvaluatedAssessmentItem =>
  item.final !== null;

/**
 * ORIENTACAO-NONA-RODADA, Seção 17/18 (BLOCO B/F) — um `gap` sozinho não diz
 * se é uma lacuna de progressão de verdade (`targetSemantics: "NEXT_ROLE"`,
 * o assessment mirou o PRÓXIMO nível), se é oportunidade de maestria (Nível
 * III, sem próximo nível — `"MASTERY"`) ou histórico de um assessment V1
 * (mirava o cargo ATUAL — `null`/`"CURRENT_ROLE"`). Misturar os três sob o
 * mesmo rótulo "GAP" é exatamente o que a Seção 18 pede para não fazer.
 * `assessmentId` é obrigatório para poder chamar `/from-gap` (Seção 4) — sem
 * ele, quem consome `Gap` não tem como criar o item source-driven.
 */
export interface Gap {
  competency: Competency | undefined;
  item: EvaluatedAssessmentItem;
  gap: number;
  assessmentId: string;
  targetSemantics: AssessmentTargetSemantics | null;
}

/**
 * `avg`/`target` ficam `undefined` quando não há assessment oficial cobrindo
 * a capacidade para essa pessoa/ciclo — nunca `0`. Um `0` aqui seria
 * indistinguível de "avaliado e no nível mais baixo", e cada tela que soma
 * ou classifica por nível herdaria esse erro silenciosamente (ver
 * AUDITORIA-RIGIDA-SEGUNDA-REVISAO-SYNAPSE.md, Seção 6).
 */
export interface CapabilityAverage {
  capability: Capability;
  avg: number | undefined;
  target: number | undefined;
}

export interface TrainingNeed {
  competency: Competency | undefined;
  people: number;
  avgGap: number;
  totalGap: number;
  /** Quem tem essa lacuna — para poder atribuir uma trilha coletiva a eles de verdade, não só contar. */
  architectIds: string[];
}

const byId = <T extends { id: string }>(items: T[]): Map<string, T> =>
  new Map(items.map((item) => [item.id, item]));

/** Chave composta para o que é indexado por arquiteto + ciclo. */
const cycleKey = (architectId: string, cycleId: string) => `${architectId} ${cycleId}`;

const indexByArchitectAndCycle = <T extends { architectId: string; cycleId: string }>(
  items: T[],
): Map<string, T> => new Map(items.map((item) => [cycleKey(item.architectId, item.cycleId), item]));

/**
 * Índices construídos uma vez por snapshot de `AppState`, compartilhados
 * pelas classes de seletor abaixo — antes cada busca era um `find` linear
 * dentro de laços (`capabilityAverages` chegava a ser O(capacidades ×
 * competências²) por arquiteto, e o painel repete isso para o time
 * inteiro a cada render). Não é um dos quatro nomes que a auditoria pede
 * (`ArchitectSelectors`/`AssessmentSelectors`/`DevelopmentSelectors`/
 * `CapabilitySelectors`) de propósito: é infraestrutura de indexação
 * compartilhada, não uma fatia de domínio própria — expor os mesmos quatro
 * `Map`s dentro de cada classe geraria quatro cópias divergentes do mesmo
 * índice.
 */
export class SelectorIndex {
  readonly competencyIndex: Map<string, Competency>;
  readonly capabilityIndex: Map<string, Capability>;
  readonly architectIndex: Map<string, Architect>;
  readonly assessmentIndex: Map<string, Assessment>;
  readonly planIndex: Map<string, AppState["plans"][number]>;

  constructor(private readonly s: AppState) {
    this.competencyIndex = byId(s.competencies);
    this.capabilityIndex = byId(s.capabilities);
    this.architectIndex = byId(s.architects);
    this.assessmentIndex = indexByArchitectAndCycle(s.assessments);
    this.planIndex = indexByArchitectAndCycle(s.plans);
  }

  get activeCycleId(): string {
    return this.s.activeCycleId;
  }
}

/**
 * Time atual — quem já saiu não conta em análise de capacidade, lacuna,
 * necessidade de treinamento nem em atribuição nova de trilha/mentoria/PDI/
 * avaliação. Uma tela que quer incluir gente inativa explicitamente (ex.:
 * Time, que separa ativos/inativos) usa `s.architects` direto, não este
 * selector. Ver AUDITORIA-TERCEIRA-RODADA-RECONSTRUCAO-PRODUTO-SYNAPSE.md,
 * EPIC E.
 */
export class ArchitectSelectors {
  readonly active: Architect[];
  private readonly visibleCache = new Map<string, Architect[]>();

  constructor(
    s: AppState,
    private readonly index: SelectorIndex,
    private readonly policy: UiAuthorizationPolicy = defaultUiAuthorizationPolicy,
  ) {
    this.active = s.architects.filter((a) => a.active);
  }

  byId = (id: string): Architect | undefined => this.index.architectIndex.get(id);

  /**
   * População padrão de TODA análise agregada (Painel, Cobertura, LNT,
   * Mentoria, Gap/Progressão): o time atual (`active`) recortado para quem
   * este viewer de fato enxerga (`canActFor` — própria pessoa, ou quem está
   * sob a liderança dela). Sem o recorte, o roster inteiro (que chega sem
   * filtro por ser dado de diretório, não de carreira — ver `auth/scope.ts`)
   * virava a população das análises, e quem está fora do escopo aparecia
   * como "sem lacuna"/"não iniciado" por não ter registro visível, não por
   * realmente não ter dado: ausência de autorização virando ausência de
   * dado. Ver ANA-001, AUDITORIA-QUINTA-RODADA-360-SYNAPSE-2026-08-19.md.
   *
   * Cache por viewer (mesmo padrão de `gapsCache`/`averagesCache`): sem ele,
   * cada chamada devolveria um array novo e os `useMemo([sel, user])` que
   * dependem da identidade estável (ex.: `defaultSelected` em
   * `gap-analysis-shared.tsx`) deixariam de estabilizar. A chave cobre os
   * três campos que `canActFor` lê.
   */
  visibleTo = (user: SessionUser): Architect[] => {
    const cacheKey = `${user.id}|${user.role}|${user.architectId ?? ""}`;
    const cached = this.visibleCache.get(cacheKey);
    if (cached) return cached;
    const visible = this.active.filter((a) => this.policy.canActFor(user, a));
    this.visibleCache.set(cacheKey, visible);
    return visible;
  };

  /**
   * ORIENTACAO-NONA-RODADA, Seção 10 (ENT-09-008/GES-010) — FK resolvida
   * quando existe; senão, fallback pro texto legado com indicação discreta
   * de pendência (nunca os dois juntos, e nunca a FK escondendo que ainda
   * não foi definida). Compartilhado entre Time e Perfil — as duas telas
   * que mostram a especialização de alguém. OO3-11k — virou método (lê o
   * `competencyIndex` internamente; some o segundo argumento dos call sites).
   */
  specializationLabel = (
    architect: Pick<Architect, "specialization" | "primarySpecializationCompetencyId">,
  ): string => {
    if (architect.primarySpecializationCompetencyId) {
      const competency = this.index.competencyIndex.get(
        architect.primarySpecializationCompetencyId,
      );
      if (competency) return competency.name;
    }
    return architect.specialization
      ? `${architect.specialization} (pendente de migração)`
      : "Especialização não definida";
  };
}

/**
 * Leituras derivadas de Assessment: qual é o assessment de alguém num
 * ciclo, qual é a fotografia OFICIAL (só `Completed`) e as três visões de
 * gap que dependem dela (`gapsFor` bruto, `progressionGapsFor` acionável,
 * `masteryOpportunitiesFor` Nível III). Ver Seção 17.1/18 da
 * ORIENTACAO-NONA-RODADA para a distinção entre as três.
 */
export class AssessmentSelectors {
  private readonly gapsCache = new Map<string, Gap[]>();

  constructor(private readonly index: SelectorIndex) {}

  /**
   * Nome/capacidade de um item de assessment: catálogo atual quando a competência
   * ainda existe lá (é o caso comum), senão a fotografia gravada no próprio
   * item (`competencyName`/`capabilityId`) — histórico não pode depender de uma
   * linha do catálogo que foi apagada ou renomeada depois. Itens de antes desta
   * migração não têm fotografia; nesse caso, sem catálogo vivo, não há nome a
   * mostrar. Ver AUDITORIA-TERCEIRA-RODADA-RECONSTRUCAO-PRODUTO-SYNAPSE.md, EPIC C.
   */
  private resolveCompetency = (item: Assessment["items"][number]): Competency | undefined => {
    const live = this.index.competencyIndex.get(item.competencyId);
    if (live) return live;
    if (!item.competencyName) return undefined;
    return {
      id: item.competencyId,
      name: item.competencyName,
      capabilityId: item.capabilityId ?? "",
      // Sem fotografia de exigência no item histórico (ENT-CAR-011 é
      // posterior a esses assessments) — NON_RESTRICTIVE é o valor neutro,
      // e este objeto só existe para exibição, nunca para decidir gap.
      requirementType: "NON_RESTRICTIVE",
      expected: {} as Record<RoleName, Level>,
      active: false,
    };
  };

  assessmentFor = (
    architectId: string,
    cycleId = this.index.activeCycleId,
  ): Assessment | undefined => this.index.assessmentIndex.get(cycleKey(architectId, cycleId));

  /**
   * A mesma busca de `assessmentFor`, mas só devolve o assessment quando ele
   * é `Completed` — a fotografia oficial do ciclo. Gap, cobertura de capacidade,
   * índice de desenvolvimento e necessidade de treinamento usam esta versão:
   * uma autoavaliação em rascunho (todo item nasce em nível 1) não pode
   * aparecer como lacuna real, e uma avaliação em revisão ainda não foi
   * calibrada pelo Tech Lead. Ver PLANO-360-AGENTES-SYNAPSE.md, Seção 9.
   */
  officialAssessmentFor = (
    architectId: string,
    cycleId = this.index.activeCycleId,
  ): Assessment | undefined => {
    const assessment = this.assessmentFor(architectId, cycleId);
    return assessment?.status === "Completed" ? assessment : undefined;
  };

  /**
   * Base bruta — todas as semânticas juntas (NEXT_ROLE/MASTERY/V1
   * histórico). Uso direto é raro: quase todo consumidor quer
   * `progressionGapsFor` (lacuna de progressão de verdade) ou
   * `masteryOpportunitiesFor` (Nível III). Ver Seção 17.1/18.
   */
  gapsFor = (architectId: string, cycleId = this.index.activeCycleId): Gap[] => {
    const cacheKey = cycleKey(architectId, cycleId);
    const cached = this.gapsCache.get(cacheKey);
    if (cached) return cached;

    const assessment = this.officialAssessmentFor(architectId, cycleId);
    const gaps = !assessment
      ? []
      : assessment.items
          .filter(isEvaluated)
          .map((item) => ({
            competency: this.resolveCompetency(item),
            item,
            gap: item.target - item.final,
            assessmentId: assessment.id,
            targetSemantics: assessment.targetSemantics,
          }))
          .filter((g) => !!g.competency)
          .sort((x, y) => y.gap - x.gap);

    this.gapsCache.set(cacheKey, gaps);
    return gaps;
  };

  /**
   * ORIENTACAO-NONA-RODADA, Seção 5/17.1/18 — "GAP" no sentido acionável
   * (badge, prioridade, sugestão de PDI, `/from-gap`) é qualquer diferença
   * contra um alvo real de progressão: o próximo nível
   * (`targetSemantics === "NEXT_ROLE"`) OU um assessment V1 histórico
   * (`null`/`"CURRENT_ROLE"`, que mirava o cargo atual — o único alvo que
   * existia antes desta migração, mas ainda um alvo real, não fabricado).
   * O que fica de fora é só Maestria (`"MASTERY"`, Nível III): aí não há
   * "próximo nível" para o qual progredir, então a diferença não é GAP de
   * progressão — é oportunidade de aprofundamento (`masteryOpportunitiesFor`).
   * `/from-gap` no servidor só rejeita MASTERY pela mesma razão — nunca
   * V1, que continua com alvo válido para derivar um item.
   */
  progressionGapsFor = (architectId: string, cycleId = this.index.activeCycleId): Gap[] =>
    this.gapsFor(architectId, cycleId).filter((g) => g.targetSemantics !== "MASTERY");

  /**
   * Nível III (topo da carreira): a diferença contra a própria régua atual
   * não é "GAP de progressão" — é oportunidade de aprofundamento/maestria.
   * Nunca usar para alimentar `/from-gap` (o servidor rejeita mesmo assim,
   * mas o produto não deve nem oferecer o CTA nesse caso).
   */
  masteryOpportunitiesFor = (architectId: string, cycleId = this.index.activeCycleId): Gap[] =>
    this.gapsFor(architectId, cycleId).filter((g) => g.targetSemantics === "MASTERY");
}

/**
 * ORIENTACAO-NONA-RODADA ENT-09-012 — uma linha consolidada por competência
 * com todos os números secundários (Seção 33): quantas pessoas, gap médio e
 * máximo, e as médias que compõem esse gap — nunca só o pior caso.
 * `requirementType` vem junto porque separar bloqueante de oportunidade é a
 * própria reestruturação pedida, não um detalhe da tabela.
 *
 * OO3-11g — morava em `components/app/gap-analysis-shared.tsx` e era
 * importado por `lib/team-report-*.ts` (`lib/` dependendo de `components/`,
 * inversão que esta extração corrige).
 */
export interface ConsolidatedGapRow {
  competencyId: string;
  name: string;
  capabilityId: string;
  requirementType: "RESTRICTIVE" | "NON_RESTRICTIVE";
  people: number;
  /** Nomes de quem tem essa lacuna — a lista de prioridades mostrava só a contagem, e quem lê queria saber quem. */
  architectNames: string[];
  totalGap: number;
  maxGap: number;
  avgGap: number;
  avgFinal: number;
  avgTarget: number;
}

/** Consolidação de lacunas por competência — contexto próprio, sobre as visões de gap de `AssessmentSelectors`. */
export class GapConsolidationSelectors {
  constructor(private readonly assessment: AssessmentSelectors) {}

  consolidate(
    architects: readonly Architect[],
    gapsFor: (architectId: string) => Gap[],
  ): ConsolidatedGapRow[] {
    const map = new Map<
      string,
      {
        competencyId: string;
        name: string;
        capabilityId: string;
        requirementType: "RESTRICTIVE" | "NON_RESTRICTIVE";
        people: number;
        architectNames: string[];
        totalGap: number;
        maxGap: number;
        sumFinal: number;
        sumTarget: number;
      }
    >();

    for (const architect of architects) {
      for (const gap of gapsFor(architect.id)) {
        if (gap.gap <= 0 || !gap.competency) continue;
        const current = map.get(gap.competency.id) ?? {
          competencyId: gap.competency.id,
          name: gap.competency.name,
          capabilityId: gap.competency.capabilityId,
          requirementType: gap.competency.requirementType,
          people: 0,
          architectNames: [],
          totalGap: 0,
          maxGap: 0,
          sumFinal: 0,
          sumTarget: 0,
        };
        map.set(gap.competency.id, {
          ...current,
          people: current.people + 1,
          architectNames: [...current.architectNames, architect.name],
          totalGap: current.totalGap + gap.gap,
          maxGap: Math.max(current.maxGap, gap.gap),
          sumFinal: current.sumFinal + gap.item.final,
          sumTarget: current.sumTarget + gap.item.target,
        });
      }
    }

    return [...map.values()]
      .map((row) => ({
        ...row,
        avgFinal: Number((row.sumFinal / row.people).toFixed(1)),
        avgTarget: Number((row.sumTarget / row.people).toFixed(1)),
        avgGap: Number((row.totalGap / row.people).toFixed(1)),
      }))
      .sort((a, b) => b.totalGap - a.totalGap || b.maxGap - a.maxGap);
  }

  progression = (architects: readonly Architect[]): ConsolidatedGapRow[] =>
    this.consolidate(architects, this.assessment.progressionGapsFor);

  mastery = (architects: readonly Architect[]): ConsolidatedGapRow[] =>
    this.consolidate(architects, this.assessment.masteryOpportunitiesFor);
}

/** Leituras derivadas de PDI (`DevelopmentPlan`) — hoje só "o plano de alguém num ciclo", mas isolado à parte para crescer sem inchar `AssessmentSelectors`. */
export class DevelopmentSelectors {
  constructor(private readonly index: SelectorIndex) {}

  planFor = (architectId: string, cycleId = this.index.activeCycleId) =>
    this.index.planIndex.get(cycleKey(architectId, cycleId));

  /** Evidências que sustentam um item do PDI — sempre uma consulta, nunca um array guardado (OO3-11l, de `domain.ts`). */
  evidencesForPlanItem = (evidences: readonly Evidence[], itemId: string): Evidence[] =>
    evidences.filter((e) => e.developmentPlanItemId === itemId);
}

/** Leituras derivadas do catálogo (Capability/Competency) e da cobertura por capacidade, que soma assessment oficial + catálogo. */
export class CapabilitySelectors {
  private readonly averagesCache = new Map<string, CapabilityAverage[]>();

  /**
   * R2-ESC-02/OO3-11d — dedup do rótulo compacto (siglas duplicadas legadas),
   * calculado UMA vez por snapshot em vez de `capabilityShortLabels(store.
   * capabilities)` reconstruído a cada render em 7 telas. Os exports CSV/PDF
   * continuam com a função pura de `domain.ts` (trabalham sobre a projeção
   * `TeamReportInput`, sem `sel`).
   */
  readonly shortLabels: Map<string, string>;

  constructor(
    private readonly s: AppState,
    private readonly index: SelectorIndex,
    private readonly assessment: AssessmentSelectors,
  ) {
    this.shortLabels = capabilityShortLabels(s.capabilities);
  }

  competencyById = (id: string): Competency | undefined => this.index.competencyIndex.get(id);
  capabilityById = (id: string): Capability | undefined => this.index.capabilityIndex.get(id);

  /** Rótulo compacto com o fallback `?? c.short` que estava repetido ~12× nos call sites. */
  shortLabelFor = (c: Pick<Capability, "id" | "short">): string =>
    this.shortLabels.get(c.id) ?? c.short;

  /**
   * OO3-11k — média geral + cobertura de UMA pessoa sobre as capacidades:
   * `averageWithCoverage(sel.capabilityAverages(id).map(d => d.avg))`
   * aparecia idêntico no Painel (MemberHome), no Perfil e no roster do Time.
   */
  coverageFor = (
    architectId: string,
    cycleId?: string,
  ): { avg: number | undefined; covered: number; total: number } =>
    averageWithCoverage(this.capabilityAverages(architectId, cycleId).map((d) => d.avg));

  /**
   * OO3-11k — média do TIME numa capacidade, com cobertura (radar de
   * gap-analysis). Devolve os números crus — `toFixed` é decisão de exibição
   * e fica nos call sites.
   */
  teamAverageFor = (
    capabilityId: string,
    architects: readonly Pick<Architect, "id">[],
  ): {
    atual: { avg: number | undefined; covered: number; total: number };
    alvo: { avg: number | undefined; covered: number; total: number };
  } => {
    const rows = architects.map((a) =>
      this.capabilityAverages(a.id).find((d) => d.capability.id === capabilityId),
    );
    return {
      atual: averageWithCoverage(rows.map((r) => r?.avg)),
      alvo: averageWithCoverage(rows.map((r) => r?.target)),
    };
  };

  capabilityAverages = (
    architectId: string,
    cycleId = this.index.activeCycleId,
  ): CapabilityAverage[] => {
    const cacheKey = cycleKey(architectId, cycleId);
    const cached = this.averagesCache.get(cacheKey);
    if (cached) return cached;

    // Uma passada pelos itens acumulando por capacidade, em vez de varrer os itens
    // uma vez para cada capacidade.
    const totals = new Map<string, { final: number; target: number; count: number }>();
    for (const item of this.assessment.officialAssessmentFor(architectId, cycleId)?.items ?? []) {
      if (item.final === null) continue;
      const capabilityId =
        this.index.competencyIndex.get(item.competencyId)?.capabilityId ?? item.capabilityId;
      if (!capabilityId) continue;
      const acc = totals.get(capabilityId) ?? { final: 0, target: 0, count: 0 };
      acc.final += item.final;
      acc.target += item.target;
      acc.count += 1;
      totals.set(capabilityId, acc);
    }

    const averages = this.s.capabilities.map((capability) => {
      const acc = totals.get(capability.id);
      if (!acc?.count) return { capability, avg: undefined, target: undefined };
      const mean = (value: number) => Number((value / acc.count).toFixed(2));
      return { capability, avg: mean(acc.final), target: mean(acc.target) };
    });

    this.averagesCache.set(cacheKey, averages);
    return averages;
  };
}

/**
 * LNT (Levantamento de Necessidades de Treinamento) — agregação por time
 * inteiro, por isso depende de `ArchitectSelectors` (população padrão) e
 * `AssessmentSelectors` (gap por pessoa), em vez de recalcular índice
 * nenhum por conta própria.
 */
export class TrainingSelectors {
  constructor(
    private readonly index: SelectorIndex,
    private readonly architect: ArchitectSelectors,
    private readonly assessment: AssessmentSelectors,
  ) {}

  /**
   * lacunas positivas agregadas por competência, ordenadas pelo
   * impacto — só time atual.
   *
   * `population` (padrão: `activeArchitects`, o time inteiro) existe porque
   * `s.architects` chega inteiro do backend mesmo para quem só enxerga uma
   * fatia dos registros individuais (roster é dado público de diretório, não
   * de carreira — ver `auth/scope.ts`, `scopeAppState`). Agregar sobre o
   * roster inteiro sem filtrar a população faz `gapsFor()` devolver `[]`
   * para quem está fora do escopo (não por não ter lacuna — por não ser
   * visível), e a lacuna real vira estatisticamente invisível: ausência de
   * autorização virando ausência de dado. Quem chama por uma população já
   * restrita ao próprio escopo (ex.: `canActFor`) evita isso. Ver ANA-001,
   * AUDITORIA-QUINTA-RODADA-360-SYNAPSE-2026-08-19.md.
   */
  teamTrainingNeeds = (population: Architect[] = this.architect.active): TrainingNeed[] => {
    const totals = new Map<string, { people: number; totalGap: number; architectIds: string[] }>();
    for (const architect of population) {
      for (const gap of this.assessment.progressionGapsFor(architect.id)) {
        if (gap.gap <= 0) continue;
        const acc = totals.get(gap.item.competencyId) ?? {
          people: 0,
          totalGap: 0,
          architectIds: [],
        };
        totals.set(gap.item.competencyId, {
          people: acc.people + 1,
          totalGap: acc.totalGap + gap.gap,
          architectIds: [...acc.architectIds, architect.id],
        });
      }
    }

    return [...totals.entries()]
      .map(([competencyId, v]) => ({
        competency: this.index.competencyIndex.get(competencyId),
        people: v.people,
        avgGap: Number((v.totalGap / v.people).toFixed(1)),
        totalGap: v.totalGap,
        architectIds: v.architectIds,
      }))
      .filter((need) => !!need.competency)
      .sort((x, y) => y.totalGap - x.totalGap);
  };
}

export function createSelectors(s: AppState) {
  const index = new SelectorIndex(s);
  const architect = new ArchitectSelectors(s, index);
  const assessment = new AssessmentSelectors(index);
  const development = new DevelopmentSelectors(index);
  const capability = new CapabilitySelectors(s, index, assessment);
  const training = new TrainingSelectors(index, architect, assessment);
  const gapConsolidation = new GapConsolidationSelectors(assessment);

  return {
    competencyById: capability.competencyById,
    capabilityById: capability.capabilityById,
    architectById: architect.byId,
    activeArchitects: architect.active,
    visibleArchitects: architect.visibleTo,
    specializationLabel: architect.specializationLabel,
    assessmentFor: assessment.assessmentFor,
    officialAssessmentFor: assessment.officialAssessmentFor,
    planFor: development.planFor,
    evidencesForPlanItem: development.evidencesForPlanItem,
    gapsFor: assessment.gapsFor,
    progressionGapsFor: assessment.progressionGapsFor,
    masteryOpportunitiesFor: assessment.masteryOpportunitiesFor,
    capabilityAverages: capability.capabilityAverages,
    capabilityShortLabels: capability.shortLabels,
    capabilityShortLabel: capability.shortLabelFor,
    coverageFor: capability.coverageFor,
    teamAverageFor: capability.teamAverageFor,
    consolidateProgressionGaps: gapConsolidation.progression,
    consolidateMasteryGaps: gapConsolidation.mastery,
    teamTrainingNeeds: training.teamTrainingNeeds,
  };
}

export type Selectors = ReturnType<typeof createSelectors>;

/**
 * Média só de quem tem valor, mais cobertura (quantos de quantos) — nunca
 * trata ausência como zero. Ver AUDITORIA-RIGIDA-SEGUNDA-REVISAO-SYNAPSE.md,
 * Seção 9. OO3-11k — deixou de ser exportada: as telas consomem
 * `coverageFor`/`teamAverageFor` (contexto `CapabilitySelectors`), que
 * embutem esta regra.
 */
function averageWithCoverage(values: (number | undefined)[]): {
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
