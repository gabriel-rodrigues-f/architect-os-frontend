import type { AppState, SessionUser } from "@/lib/api";

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
 * Sessão de lead sem nenhum arquiteto atribuído (`architect.leadUserId` não
 * aponta para ela em nenhum arquiteto da fixture) — usada para provar que
 * `isLeadOf` nega por padrão sem a atribuição real, em vez de liberar campo
 * pra qualquer conta `lead` da empresa (UX-001).
 */
export const fixtureUnassignedLeadUser: SessionUser = {
  id: "test-lead-sem-atribuicao",
  email: "lead-sem-atribuicao@company.com",
  name: "Lead sem atribuição",
  role: "lead",
  architectId: null,
  status: "active",
  mustChangePassword: false,
  createdAt: "2026-01-01T00:00:00Z",
};

/**
 * B-24 (ADR-0011) — `careerLevels` saiu de `AppState`/`fixtureState`
 * (migrado para `GET /api/v1/career-levels`); testes que renderizam telas que
 * leem `useCareerLevelsByRank()` mockam esta resposta separadamente com
 * este fixture.
 */
export const fixtureCareerLevels = [
  { id: "arquiteto-de-solucoes-i", name: "Arquiteto de Soluções I", rank: 1 },
  { id: "arquiteto-de-solucoes-ii", name: "Arquiteto de Soluções II", rank: 2 },
  { id: "arquiteto-de-solucoes-iii", name: "Arquiteto de Soluções III", rank: 3 },
];

/** Estado mínimo, porém coerente, para exercitar os selectors. */
export const fixtureState: AppState = {
  capabilities: [
    {
      id: "cloud",
      name: "Cloud Architecture",
      short: "Cloud",
      active: true,
      curation: {
        activeCompetencyCount: 2,
        restrictiveCompetencyCount: 0,
        nonRestrictiveCompetencyCount: 2,
        status: "REQUIRES_CURATION",
      },
    },
    {
      id: "security",
      name: "Security",
      short: "Security",
      active: true,
      curation: {
        activeCompetencyCount: 1,
        restrictiveCompetencyCount: 0,
        nonRestrictiveCompetencyCount: 1,
        status: "REQUIRES_CURATION",
      },
    },
  ],
  careerLevelPolicies: [
    { careerLevelId: "arquiteto-de-solucoes-i", minimumQualifiedCapabilities: 3 },
    { careerLevelId: "arquiteto-de-solucoes-ii", minimumQualifiedCapabilities: 3 },
    { careerLevelId: "arquiteto-de-solucoes-iii", minimumQualifiedCapabilities: 3 },
  ],
  competencies: [
    {
      id: "cloud-k8s",
      name: "Kubernetes",
      capabilityId: "cloud",
      requirementType: "NON_RESTRICTIVE",
      expected: {
        "arquiteto-de-solucoes-i": 3,
        "arquiteto-de-solucoes-ii": 4,
        "arquiteto-de-solucoes-iii": 5,
      },
      active: true,
    },
    {
      id: "cloud-serverless",
      name: "Serverless",
      capabilityId: "cloud",
      requirementType: "NON_RESTRICTIVE",
      expected: {
        "arquiteto-de-solucoes-i": 3,
        "arquiteto-de-solucoes-ii": 4,
        "arquiteto-de-solucoes-iii": 5,
      },
      active: true,
    },
    {
      id: "security-iam",
      name: "IAM",
      capabilityId: "security",
      requirementType: "NON_RESTRICTIVE",
      expected: {
        "arquiteto-de-solucoes-i": 2,
        "arquiteto-de-solucoes-ii": 3,
        "arquiteto-de-solucoes-iii": 4,
      },
      active: true,
    },
  ],
  architects: [
    {
      id: "ana",
      name: "Ana Martins",
      role: "Arquiteto de Soluções II",
      yearsAsArchitect: 6,
      specialization: "Integration",
      email: "ana@company.com",
      active: true,
      version: 1,
    },
    {
      id: "bruno",
      name: "Bruno Almeida",
      role: "Arquiteto de Soluções I",
      yearsAsArchitect: 3,
      specialization: "Cloud",
      email: "bruno@company.com",
      active: true,
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
        { competencyId: "cloud-k8s", self: 3, leader: 3, target: 4, final: 3, comments: [] },
        { competencyId: "cloud-serverless", self: 3, leader: 3, target: 4, final: 3, comments: [] },
        { competencyId: "security-iam", self: 2, leader: 2, target: 3, final: 2, comments: [] },
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
        { competencyId: "cloud-k8s", self: 4, leader: 4, target: 4, final: 4, comments: [] },
        { competencyId: "cloud-serverless", self: 4, leader: 3, target: 4, final: 4, comments: [] },
        { competencyId: "security-iam", self: 2, leader: 2, target: 3, final: 2, comments: [] },
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
        { competencyId: "cloud-k8s", self: 2, leader: 2, target: 3, final: 2, comments: [] },
        { competencyId: "cloud-serverless", self: 3, leader: 3, target: 3, final: 3, comments: [] },
        { competencyId: "security-iam", self: 1, leader: 1, target: 2, final: 1, comments: [] },
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
