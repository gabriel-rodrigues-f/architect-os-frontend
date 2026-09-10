import {
  Activity,
  BarChart3,
  Bell,
  BookMarked,
  BookOpen,
  Building2,
  CalendarRange,
  ClipboardCheck,
  Compass,
  FileText,
  GitCompare,
  GraduationCap,
  Grid3x3,
  LayoutDashboard,
  Layers,
  LibraryBig,
  ListOrdered,
  Map,
  Milestone,
  Ruler,
  Scale,
  SlidersHorizontal,
  Tags,
  Target,
  TrendingUp,
  Type,
  UserCog,
  Users,
} from "lucide-react";

import type { SessionUser } from "./api";
import type { MessageKey } from "./i18n";
import { defaultUiAuthorizationPolicy } from "./scope";

/**
 * O CATÁLOGO DO MENU — o que existe, para quem, e onde cada entrada leva.
 * Saiu do `AppShell` ([N-01], [FA-12]): a casca desenha; quem decide o que
 * ela desenha é este arquivo, e as regras de alcance são perguntas à política
 * (`UiAuthorizationPolicy`), nunca um papel comparado à mão.
 */
export interface NavItem {
  to: string;
  labelKey: MessageKey;
  icon: typeof LayoutDashboard;

  activePrefixes?: string[];

  /** Catálogo: de quem opera o sistema — SUPPORT (o antigo admin) e ADMIN. */
  systemOperationOnly?: boolean;
  /** Métricas da Plataforma: todos menos o member (adendo do dono, 2026-09-08, item 5). */
  platformMetricsOnly?: boolean;

  teamRuleReachOnly?: boolean;

  calibrationReachOnly?: boolean;

  teamCompositionReachOnly?: boolean;

  teamAnalysisOnly?: boolean;

  leadershipOnly?: boolean;
  /** Usuários e Times: administrador e gerente com vínculo (revisão de papéis, 2026-09-05). */
  peopleAdministrationOnly?: boolean;
  /** Avaliações, Planos e Mentoria: quem trabalha com pessoas — o admin sem vínculo não. */
  personWorkOnly?: boolean;

  ownCareerOnly?: boolean;

  /**
   * O destino abre numa ABA NOVA, reservada já no CLIQUE do menu (dono,
   * 2026-09-08). O navegador só deixa abrir aba durante o gesto: a rota é
   * interna e desenha a transição, mas a aba precisa nascer aqui.
   */
  opensInNewTab?: boolean;

  hintKey?: MessageKey;

  /** Dono (2026-09-06): o item carrega a contagem de transferências A APROVAR por quem está logado. */
  countsPendingTeamTransfers?: boolean;
}

const OWN_PROFESSIONAL_PARAM = "$professionalId";

export interface NavGroup {
  labelKey?: MessageKey;
  items: NavItem[];
}

/**
 * "Minha carreira" é um GRUPO, não um item (dono, 2026-09-06): Visão geral,
 * Evolução, Extrato e Roteiro são quatro entradas do menu para quem tem
 * ficha — e por isso o botão "Voltar" da própria ficha morreu.
 */
export const MY_CAREER_GROUP_KEY: MessageKey = "nav.group.myCareer";

export const NAV_GROUPS: NavGroup[] = [
  {
    labelKey: MY_CAREER_GROUP_KEY,
    items: [
      {
        to: `/professionals/${OWN_PROFESSIONAL_PARAM}`,
        labelKey: "arch.tabs.overview",
        icon: Compass,
        ownCareerOnly: true,
      },
      {
        to: `/professionals/${OWN_PROFESSIONAL_PARAM}/evolution`,
        labelKey: "arch.tabs.evolution",
        icon: TrendingUp,
        ownCareerOnly: true,
      },
      {
        to: `/professionals/${OWN_PROFESSIONAL_PARAM}/statement`,
        labelKey: "arch.tabs.statement",
        icon: FileText,
        ownCareerOnly: true,
      },
      {
        to: `/professionals/${OWN_PROFESSIONAL_PARAM}/roadmap`,
        labelKey: "arch.tabs.roadmap",
        icon: Milestone,
        ownCareerOnly: true,
      },
    ],
  },
  {
    labelKey: "nav.group.operation",
    items: [
      { to: "/", labelKey: "nav.dashboard", icon: LayoutDashboard },
      {
        to: "/team",
        labelKey: "nav.team",
        icon: Users,
        activePrefixes: ["/professionals"],
        leadershipOnly: true,
        countsPendingTeamTransfers: true,
      },
      {
        to: "/assessments",
        labelKey: "nav.assessments",
        icon: ClipboardCheck,
        personWorkOnly: true,
      },
    ],
  },
  {
    labelKey: "nav.capabilities",
    items: [
      { to: "/capability-map", labelKey: "cap.tabs.coverage", icon: Map, teamAnalysisOnly: true },
      {
        to: "/gap-analysis",
        labelKey: "cap.tabs.priorities",
        icon: ListOrdered,
        teamAnalysisOnly: true,
      },
      {
        to: "/progression",
        labelKey: "cap.tabs.progression",
        icon: TrendingUp,
        teamAnalysisOnly: true,
      },
      {
        to: "/training-needs",
        labelKey: "cap.tabs.collective",
        icon: Layers,
        teamAnalysisOnly: true,
      },
      {
        to: "/compare",
        labelKey: "cap.tabs.comparison",
        icon: GitCompare,
        teamAnalysisOnly: true,
      },
    ],
  },
  {
    labelKey: "nav.group.development",
    items: [
      {
        to: "/development-plans",
        labelKey: "nav.developmentPlans",
        icon: Target,
        personWorkOnly: true,
      },
      { to: "/learning-paths", labelKey: "nav.learningPaths", icon: BookOpen },
      { to: "/mentoring", labelKey: "nav.mentoring", icon: GraduationCap, personWorkOnly: true },
    ],
  },
  {
    labelKey: "nav.group.ruler",
    items: [
      { to: "/cycles", labelKey: "nav.cycles", icon: CalendarRange, leadershipOnly: true },
      {
        to: "/team-rules",
        labelKey: "nav.teamRules",
        icon: Ruler,
        teamRuleReachOnly: true,
      },
    ],
  },
  /**
   * CRITÉRIOS DE PROGRESSÃO É UM GRUPO (dono, 2026-09-10): *"deixa de ser um
   * menu e torna-se um grupo… organizamos o que antes seriam abas em menus do
   * grupo Critérios de Progressão. Assim resolvemos o problema de rolar e
   * também o de enxergar o que tem lá."*
   *
   * O que o grupo dá e a aba não daria: a coluna JÁ esconde item por alcance.
   * A tela única tinha TRÊS alcances convivendo dentro dela, e quem não
   * alcançava um pedaço via caixa vazia sem saber se faltava permissão ou
   * configuração. Aqui cada fatia declara o próprio dono, e a que a pessoa não
   * alcança simplesmente não aparece:
   *
   *   Elegibilidade      → quem rege a régua do time (`teamRuleReachOnly`)
   *   Réguas e limiares  → quem opera o sistema
   *   Textos             → quem opera o sistema
   *   Catálogo           → quem opera o sistema
   *   Vocabulários       → quem opera o sistema
   *   Referência…        → toda a liderança, porque é LEITURA (`leadershipOnly`)
   */
  {
    labelKey: "nav.group.progressionCriteria",
    items: [
      {
        to: "/eligibility",
        labelKey: "eligibility.title",
        icon: Scale,
        teamRuleReachOnly: true,
      },
      {
        to: "/scoring-rulers",
        labelKey: "config.bands.title",
        icon: SlidersHorizontal,
        systemOperationOnly: true,
      },
      {
        to: "/text-templates",
        labelKey: "config.templates.title",
        icon: Type,
        systemOperationOnly: true,
      },
      {
        to: "/catalog-policy",
        labelKey: "config.curation.title",
        icon: LibraryBig,
        systemOperationOnly: true,
      },
      {
        to: "/vocabularies",
        labelKey: "config.vocab.title",
        icon: Tags,
        systemOperationOnly: true,
      },
      {
        to: "/model-reference",
        labelKey: "ref.referenceSectionTitle",
        icon: BookMarked,
        leadershipOnly: true,
      },
    ],
  },
  {
    labelKey: "nav.group.admin",
    items: [
      {
        to: "/competency-matrix",
        labelKey: "nav.competencyMatrix",
        icon: Grid3x3,
        systemOperationOnly: true,
      },
      {
        to: "/calibration",
        labelKey: "nav.calibration",
        icon: BarChart3,
        calibrationReachOnly: true,
      },
      { to: "/teams", labelKey: "nav.teams", icon: Building2, peopleAdministrationOnly: true },
      {
        to: "/platform-metrics",
        labelKey: "nav.platformMetrics",
        icon: Activity,
        platformMetricsOnly: true,
        opensInNewTab: true,
        hintKey: "nav.platformMetricsHint",
      },
      { to: "/users", labelKey: "nav.users", icon: UserCog, peopleAdministrationOnly: true },
    ],
  },
  /**
   * A CENTRAL DO USUÁRIO fecha a coluna (dono, 2026-09-08). Até aqui os
   * Avisos só existiam no sino do cabeçalho: a tela estava no ar sem NENHUMA
   * entrada de menu, alcançável só por URL ou pelo "Ver todos" do popover.
   * O grupo não tem régua de alcance porque avisos são de todo mundo — cada
   * papel vê a caixa dele, e o recorte é do servidor.
   */
  {
    labelKey: "nav.group.userCenter",
    items: [{ to: "/notices", labelKey: "nav.notices", icon: Bell }],
  },
];

export class NavigationOfUser {
  constructor(
    private readonly user: SessionUser | undefined,
    private readonly policy = defaultUiAuthorizationPolicy,
  ) {}

  reaches(item: NavItem): boolean {
    const user = this.user;
    if (item.systemOperationOnly && !(user && this.policy.operatesTheSystem(user))) return false;
    if (item.platformMetricsOnly && !(user && this.policy.readsPlatformMetrics(user))) return false;
    if (item.teamRuleReachOnly && !(user && this.policy.canConfigureAnyTeamRules(user))) {
      return false;
    }
    if (item.calibrationReachOnly && !(user && this.policy.canCalibrate(user))) return false;
    if (item.teamCompositionReachOnly && !(user && this.policy.canComposeAnyTeam(user))) {
      return false;
    }
    if (item.teamAnalysisOnly && !(user && this.policy.canAnalyzeTeam(user))) return false;
    if (item.peopleAdministrationOnly && !(user && this.policy.canAdministerPeople(user))) {
      return false;
    }
    if (item.personWorkOnly && !(user && this.policy.worksWithPeople(user))) return false;
    if (item.leadershipOnly && !(user && this.policy.isLeadership(user))) return false;
    return !item.ownCareerOnly || this.reachesOwnCareer();
  }

  /** Quem tem ficha tem "Minha carreira" (dono, 2026-09-05) — a política diz quem. */
  private reachesOwnCareer(): boolean {
    return this.user !== undefined && this.policy.hasOwnCareerFile(this.user);
  }

  addressed(item: NavItem): NavItem {
    const professionalId = this.ownProfessionalId;
    if (!item.ownCareerOnly || professionalId === null) return item;
    const resolve = (path: string) => path.replace(OWN_PROFESSIONAL_PARAM, professionalId);
    return {
      ...item,
      to: resolve(item.to),
      ...(item.activePrefixes ? { activePrefixes: item.activePrefixes.map(resolve) } : {}),
    };
  }

  private get ownProfessionalId(): string | null {
    return this.user?.professionalId ?? null;
  }
}

export function filterNavGroups(groups: NavGroup[], user: SessionUser | undefined): NavGroup[] {
  const navigation = new NavigationOfUser(user);
  return groups
    .map((group) => ({
      ...group,
      items: group.items
        .filter((item) => navigation.reaches(item))
        .map((item) => navigation.addressed(item)),
    }))
    .filter((group) => group.items.length > 0);
}

export class NavRouteMatch {
  constructor(private readonly pathname: string) {}

  specificityOf(item: NavItem): number {
    if (item.to === "/") return this.pathname === "/" ? 1 : -1;
    return [item.to, ...(item.activePrefixes ?? [])].reduce(
      (best, prefix) => (this.covers(prefix) ? Math.max(best, prefix.length) : best),
      -1,
    );
  }

  private covers(prefix: string): boolean {
    return this.pathname === prefix || this.pathname.startsWith(`${prefix}/`);
  }
}

export function isNavItemActive(
  item: NavItem,
  pathname: string,
  siblings: readonly NavItem[] = [],
): boolean {
  const match = new NavRouteMatch(pathname);
  const own = match.specificityOf(item);
  if (own < 0) return false;
  return siblings.every((sibling) => sibling === item || match.specificityOf(sibling) <= own);
}
