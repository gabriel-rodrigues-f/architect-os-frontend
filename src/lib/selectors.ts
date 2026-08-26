import type { AppState } from "./api";
import type {
  Architect,
  Assessment,
  AssessmentTargetSemantics,
  Competency,
  Capability,
  Level,
  RoleName,
} from "./domain";

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

  constructor(
    s: AppState,
    private readonly index: SelectorIndex,
  ) {
    this.active = s.architects.filter((a) => a.active);
  }

  byId = (id: string): Architect | undefined => this.index.architectIndex.get(id);
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

/** Leituras derivadas de PDI (`DevelopmentPlan`) — hoje só "o plano de alguém num ciclo", mas isolado à parte para crescer sem inchar `AssessmentSelectors`. */
export class DevelopmentSelectors {
  constructor(private readonly index: SelectorIndex) {}

  planFor = (architectId: string, cycleId = this.index.activeCycleId) =>
    this.index.planIndex.get(cycleKey(architectId, cycleId));
}

/** Leituras derivadas do catálogo (Capability/Competency) e da cobertura por capacidade, que soma assessment oficial + catálogo. */
export class CapabilitySelectors {
  private readonly averagesCache = new Map<string, CapabilityAverage[]>();

  constructor(
    private readonly s: AppState,
    private readonly index: SelectorIndex,
    private readonly assessment: AssessmentSelectors,
  ) {}

  competencyById = (id: string): Competency | undefined => this.index.competencyIndex.get(id);
  capabilityById = (id: string): Capability | undefined => this.index.capabilityIndex.get(id);

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

  return {
    competencyById: capability.competencyById,
    capabilityById: capability.capabilityById,
    architectById: architect.byId,
    activeArchitects: architect.active,
    assessmentFor: assessment.assessmentFor,
    officialAssessmentFor: assessment.officialAssessmentFor,
    planFor: development.planFor,
    gapsFor: assessment.gapsFor,
    progressionGapsFor: assessment.progressionGapsFor,
    masteryOpportunitiesFor: assessment.masteryOpportunitiesFor,
    capabilityAverages: capability.capabilityAverages,
    teamTrainingNeeds: training.teamTrainingNeeds,
  };
}

export type Selectors = ReturnType<typeof createSelectors>;

/**
 * ORIENTACAO-NONA-RODADA, Seção 10 (ENT-09-008/GES-010) — FK resolvida
 * quando existe; senão, fallback pro texto legado com indicação discreta
 * de pendência (nunca os dois juntos, e nunca a FK escondendo que ainda
 * não foi definida). Compartilhado entre Time e Perfil — as duas telas
 * que mostram a especialização de alguém.
 */
export function specializationLabel(
  architect: Pick<Architect, "specialization" | "primarySpecializationCompetencyId">,
  competencyById: (id: string) => { name: string } | undefined,
): string {
  if (architect.primarySpecializationCompetencyId) {
    const competency = competencyById(architect.primarySpecializationCompetencyId);
    if (competency) return competency.name;
  }
  return architect.specialization
    ? `${architect.specialization} (pendente de migração)`
    : "Especialização não definida";
}

/**
 * Média só de quem tem valor, mais cobertura (quantos de quantos) — nunca
 * trata ausência como zero. Toda tela que soma `avg`/`target` de várias
 * pessoas ou vários capacidades passa por aqui, para não repetir o mesmo erro
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
