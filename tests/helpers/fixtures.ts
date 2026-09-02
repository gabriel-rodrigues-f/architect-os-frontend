import type { AppState, SessionUser } from "@/lib/api";
import { TeamLeadershipRoles } from "@/lib/gateways/auth.gateway";

/**
 * Sessão de admin — o Tech Lead surrogate do modelo de contas atual (ver
 * `assessments.ts` no backend). Usada nos testes que exercitam telas atrás
 * de `useCurrentUser()`: dá acesso total, sem prender o teste a ser dono de
 * um arquiteto específico.
 */
export const fixtureAdminUser: SessionUser = {
  id: "test-admin",
  email: "admin@teste.local",
  name: "Admin de teste",
  role: "admin",
  architectId: null,
  status: "active",
  mustChangePassword: false,
  createdAt: "2026-01-01T00:00:00Z",
};

/** Sessão de member — a própria Ana Martins, dona da autoavaliação dela. */
export const fixtureMemberUser: SessionUser = {
  id: "test-member",
  email: "ana@company.com",
  name: "Ana Martins",
  role: "member",
  architectId: "ana",
  status: "active",
  mustChangePassword: false,
  createdAt: "2026-01-01T00:00:00Z",
};

/**
 * Sessão de tech lead sem nenhum arquiteto no escopo (o recorte do servidor
 * não lhe entrega ninguém) — usada para provar que `isLeadOf` nega por padrão
 * sobre arquiteto sem time, em vez de liberar campo pra qualquer conta de
 * liderança da empresa (UX-001, semântica pós-Fase 2: o vínculo é o TIME).
 */
export const fixtureUnassignedTechLeadUser: SessionUser = {
  id: "test-tech-lead-sem-atribuicao",
  email: "tech-lead-sem-atribuicao@company.com",
  name: "Tech Lead sem atribuição",
  role: "tech_lead",
  architectId: null,
  status: "active",
  mustChangePassword: false,
  createdAt: "2026-01-01T00:00:00Z",
};

/**
 * Onda 17.1 — a sessão passou a expor `memberships`. Este é o tech lead COM
 * vínculo de tech lead no time, a conta que de fato rege a régua daquele
 * time (backend `isLeadOfTeam`). O par dele é o
 * `fixtureUnassignedTechLeadUser`: mesmo papel, sem vínculo nenhum — e por
 * isso sem régua para configurar.
 */
export const fixtureAssignedTechLeadUser: SessionUser = {
  id: "test-tech-lead-do-time",
  email: "tech-lead-do-time@company.com",
  name: "Tech Lead do time",
  role: "tech_lead",
  architectId: null,
  status: "active",
  mustChangePassword: false,
  createdAt: "2026-01-01T00:00:00Z",
  memberships: [{ teamId: "time-plataforma", role: "tech_lead" }],
};

/**
 * Fase 3 (backend ADR-0047) — o gestor COM vínculo de gestor no time. Mesmo
 * ALCANCE do tech lead atribuído (a união dos vínculos de liderança), poder
 * diferente: a ficha funcional é dele, a proficiência observada não.
 */
export const fixtureAssignedManagerUser: SessionUser = {
  id: "test-gestor-do-time",
  email: "gestor-do-time@company.com",
  name: "Gestor do time",
  role: "manager",
  architectId: null,
  status: "active",
  mustChangePassword: false,
  createdAt: "2026-01-01T00:00:00Z",
  memberships: [{ teamId: "time-plataforma", role: "manager" }],
};

/**
 * B-24 (ADR-0011) — `careerLevels` saiu de `AppState`/`fixtureState`
 * (migrado para `GET /api/v1/career-levels`); testes que renderizam telas que
 * leem `useCareerLevelsByRank()` mockam esta resposta separadamente com
 * este fixture.
 */
export const fixtureCareerLevels = [
  { id: "arquiteto-de-solucoes-i", name: "Júnior", rank: 1 },
  { id: "arquiteto-de-solucoes-ii", name: "Pleno", rank: 2 },
  { id: "arquiteto-de-solucoes-iii", name: "Sênior", rank: 3 },
];

/** O time da fixture — pós-Fase 2 o vínculo de escopo e da régua é o TIME. */
export const fixtureTeamId = "time-plataforma";

/**
 * Estado mínimo, porém coerente, para exercitar os selectors — na forma que o
 * backend f1926f7 REALMENTE emite (Fase 2, ADRs 0032-0035): competência
 * global sem `requirementType`/`expected` (a obrigatoriedade e o nível
 * exigido moram na régua do time e chegam à UI pela FOTO do item de
 * avaliação); `careerLevelPolicies` morreu e `/state` carrega
 * `teamLevelRules` (piso por time×nível); curadoria sem contagem por tipo
 * (o teto virou sinal, ADR-0034); arquiteto com `teamId`, sem `leadUserId`.
 */
export const fixtureState: AppState = {
  capabilities: [
    {
      id: "cloud",
      name: "Cloud Architecture",
      short: "Cloud",
      active: true,
      curation: {
        activeCompetencyCount: 2,
        status: "READY",
      },
    },
    {
      id: "security",
      name: "Security",
      short: "Security",
      active: true,
      curation: {
        activeCompetencyCount: 1,
        status: "READY",
      },
    },
  ],
  teamLevelRules: [
    {
      id: "regra-plataforma-i",
      teamId: fixtureTeamId,
      careerLevelId: "arquiteto-de-solucoes-i",
      minimumQualifiedCapabilities: 3,
    },
    {
      id: "regra-plataforma-ii",
      teamId: fixtureTeamId,
      careerLevelId: "arquiteto-de-solucoes-ii",
      minimumQualifiedCapabilities: 3,
    },
    {
      id: "regra-plataforma-iii",
      teamId: fixtureTeamId,
      careerLevelId: "arquiteto-de-solucoes-iii",
      minimumQualifiedCapabilities: 3,
    },
  ],
  competencies: [
    {
      id: "cloud-k8s",
      name: "Kubernetes",
      capabilityId: "cloud",
      active: true,
    },
    {
      id: "cloud-serverless",
      name: "Serverless",
      capabilityId: "cloud",
      active: true,
    },
    {
      id: "security-iam",
      name: "IAM",
      capabilityId: "security",
      active: true,
    },
  ],
  architects: [
    {
      id: "ana",
      name: "Ana Martins",
      role: "Pleno",
      yearsAsArchitect: 6,
      specialization: "Integration",
      email: "ana@company.com",
      active: true,
      teamId: fixtureTeamId,
      version: 1,
    },
    {
      id: "bruno",
      name: "Bruno Almeida",
      role: "Júnior",
      yearsAsArchitect: 3,
      specialization: "Cloud",
      email: "bruno@company.com",
      active: true,
      teamId: fixtureTeamId,
      version: 1,
    },
  ],
  assessments: [
    {
      id: "ana-h1",
      architectId: "ana",
      cycleId: "2026-h1",
      status: "Completed",
      modelVersion: 1,
      targetCareerLevelId: null,
      targetSemantics: null,
      version: 1,
      items: [
        {
          competencyId: "cloud-k8s",
          self: 3,
          leader: 3,
          target: 4,
          final: 3,
          comments: [],
          requirementType: "NON_RESTRICTIVE",
        },
        {
          competencyId: "cloud-serverless",
          self: 3,
          leader: 3,
          target: 4,
          final: 3,
          comments: [],
          requirementType: "NON_RESTRICTIVE",
        },
        {
          competencyId: "security-iam",
          self: 2,
          leader: 2,
          target: 3,
          final: 2,
          comments: [],
          requirementType: "NON_RESTRICTIVE",
        },
      ],
    },
    {
      id: "ana-h2",
      architectId: "ana",
      cycleId: "2026-h2",
      // Completed: gapsFor/capabilityAverages só usam assessment oficial.
      status: "Completed",
      modelVersion: 1,
      targetCareerLevelId: null,
      targetSemantics: null,
      version: 1,
      items: [
        {
          competencyId: "cloud-k8s",
          self: 4,
          leader: 4,
          target: 4,
          final: 4,
          comments: [],
          requirementType: "NON_RESTRICTIVE",
        },
        {
          competencyId: "cloud-serverless",
          self: 4,
          leader: 3,
          target: 4,
          final: 4,
          comments: [],
          requirementType: "NON_RESTRICTIVE",
        },
        {
          competencyId: "security-iam",
          self: 2,
          leader: 2,
          target: 3,
          final: 2,
          comments: [],
          requirementType: "NON_RESTRICTIVE",
        },
      ],
    },
    {
      id: "bruno-h2",
      architectId: "bruno",
      cycleId: "2026-h2",
      status: "Completed",
      modelVersion: 1,
      targetCareerLevelId: null,
      targetSemantics: null,
      version: 1,
      items: [
        {
          competencyId: "cloud-k8s",
          self: 2,
          leader: 2,
          target: 3,
          final: 2,
          comments: [],
          requirementType: "NON_RESTRICTIVE",
        },
        {
          competencyId: "cloud-serverless",
          self: 3,
          leader: 3,
          target: 3,
          final: 3,
          comments: [],
          requirementType: "NON_RESTRICTIVE",
        },
        {
          competencyId: "security-iam",
          self: 1,
          leader: 1,
          target: 2,
          final: 1,
          comments: [],
          requirementType: "NON_RESTRICTIVE",
        },
      ],
    },
  ],
  cycles: [
    { id: "2026-h1", name: "2026 H1", start: "2026-01-01", end: "2026-06-30", status: "Closed" },
    { id: "2026-h2", name: "2026 H2", start: "2026-07-01", end: "2026-12-31", status: "Active" },
  ],
  plans: [
    {
      id: "pdi-ana",
      architectId: "ana",
      cycleId: "2026-h2",
      status: "Approved",
      version: 1,
      items: [
        {
          id: "pdi-ana-0",
          competencyId: "security-iam",
          currentLevel: 2,
          targetLevel: 3,
          objective: "Evoluir IAM",
          actionType: "Learn",
          actionPlan: "Curso + laboratório",
          startDate: "2026-07-01",
          targetDate: "2026-12-15",
          priority: "High",
          owner: "Ana Martins",
          status: "In Progress",
          checkins: [
            {
              id: "checkin-pdi-ana-0-1",
              authorUserId: "test-admin",
              text: "Concluiu o módulo introdutório do curso.",
              createdAt: "2026-08-01T10:00:00Z",
            },
          ],
          version: 1,
        },
        {
          id: "pdi-ana-1",
          competencyId: "cloud-k8s",
          currentLevel: 3,
          targetLevel: 4,
          objective: "Evoluir Kubernetes",
          actionType: "Practice",
          actionPlan: "Projeto real",
          startDate: "2026-07-01",
          targetDate: "2026-12-15",
          priority: "Medium",
          owner: "Ana Martins",
          status: "In Progress",
          checkins: [],
          version: 1,
        },
      ],
    },
  ],
  learningPaths: [
    {
      id: "lp-sec",
      name: "Security Path",
      description: "",
      competencyIds: ["security-iam"],
      assignedTo: ["ana"],
      items: [
        { id: "lp-sec-1", title: "IAM Essentials", type: "Curso", hours: 8 },
        { id: "lp-sec-2", title: "OAuth", type: "Curso", hours: 6 },
      ],
      progress: [
        { architectId: "ana", itemId: "lp-sec-1", status: "Completed", progress: 100 },
        { architectId: "ana", itemId: "lp-sec-2", status: "In Progress", progress: 20 },
      ],
    },
  ],
  mentoringSessions: [],
  evidences: [
    {
      id: "e1",
      architectId: "ana",
      title: "ADR-014",
      description: "",
      type: "ADR",
      competencyIds: ["security-iam"],
      date: "2026-08-06",
      complexity: "High",
      status: "Pending",
    },
  ],
  activeCycleId: "2026-h2",
};

/**
 * O payload que o servidor manda DE VERDADE desde o roster fechado
 * (backend `d1edba4`) e o escopo por TIME da Fase 2 (backend `f1926f7`,
 * ADR-0035): `AuthorizationService.scopeAppState` recorta `architects`,
 * `assessments`, `plans`, `evidences`, `mentoringSessions`, `learningPaths`
 * e `teamLevelRules` pelo conjunto visível do papel — member vê só a si,
 * lead vê os times que lidera (papel E vínculo `tech_lead`/`manager`),
 * admin vê tudo. Este helper espelha aquele filtro, campo a campo, para que
 * os testes exercitem o mundo recortado em vez do payload antigo (roster
 * inteiro), que o servidor não emite mais. `leadTeamIds` faz o papel de
 * `team_memberships` do backend: os times que concedem escopo ao usuário.
 *
 * Nota fiel ao backend: `learningPaths` sobrevive inteiro quando UM dos
 * atribuídos é visível — `assignedTo` e `progress` seguem carregando ids fora
 * do escopo. É exatamente o caso que produz assignee sem `Architect`
 * correspondente no cliente.
 */
export function scopedFixtureStateFor(
  user: SessionUser,
  state: AppState = fixtureState,
  leadTeamIds: readonly string[] = [],
): AppState {
  if (user.role === "admin") return state;

  const visibleIds = new Set<string>();
  if (user.architectId) visibleIds.add(user.architectId);
  const scopeGrantingTeams = new Set(TeamLeadershipRoles.includes(user.role) ? leadTeamIds : []);
  for (const architect of state.architects) {
    if (architect.teamId && scopeGrantingTeams.has(architect.teamId)) {
      visibleIds.add(architect.id);
    }
  }
  const visibleTeamIds = new Set(scopeGrantingTeams);
  for (const architect of state.architects) {
    if (visibleIds.has(architect.id) && architect.teamId) visibleTeamIds.add(architect.teamId);
  }

  return {
    ...state,
    architects: state.architects.filter((architect) => visibleIds.has(architect.id)),
    teamLevelRules: state.teamLevelRules.filter((rule) => visibleTeamIds.has(rule.teamId)),
    assessments: state.assessments.filter((assessment) => visibleIds.has(assessment.architectId)),
    plans: state.plans.filter((plan) => visibleIds.has(plan.architectId)),
    evidences: state.evidences.filter((evidence) => visibleIds.has(evidence.architectId)),
    mentoringSessions: state.mentoringSessions.filter(
      (session) => visibleIds.has(session.menteeId) || session.mentorUserId === user.id,
    ),
    learningPaths: state.learningPaths.filter(
      (path) =>
        path.assignedTo.some((id) => visibleIds.has(id)) || path.createdByUserId === user.id,
    ),
  };
}
