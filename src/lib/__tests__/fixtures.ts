import type { AppState, SessionUser } from "../api";

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
  createdAt: "2026-01-01T00:00:00Z",
};

/** Sessão de member — a própria Ana Martins, dona da autoavaliação dela. */
export const fixtureMemberUser: SessionUser = {
  id: "test-member",
  email: "ana@company.com",
  name: "Ana Martins",
  role: "member",
  architectId: "ana",
  createdAt: "2026-01-01T00:00:00Z",
};

/** Estado mínimo, porém coerente, para exercitar os selectors. */
export const fixtureState: AppState = {
  categories: [
    { id: "cloud", name: "Cloud Architecture", short: "Cloud" },
    { id: "security", name: "Security", short: "Security" },
  ],
  competencies: [
    {
      id: "cloud-k8s",
      name: "Kubernetes",
      categoryId: "cloud",
      expected: {
        "Arquiteto de Soluções I": 3,
        "Arquiteto de Soluções II": 4,
        "Arquiteto de Soluções III": 5,
      },
    },
    {
      id: "cloud-serverless",
      name: "Serverless",
      categoryId: "cloud",
      expected: {
        "Arquiteto de Soluções I": 3,
        "Arquiteto de Soluções II": 4,
        "Arquiteto de Soluções III": 5,
      },
    },
    {
      id: "security-iam",
      name: "IAM",
      categoryId: "security",
      expected: {
        "Arquiteto de Soluções I": 2,
        "Arquiteto de Soluções II": 3,
        "Arquiteto de Soluções III": 4,
      },
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
    },
    {
      id: "bruno",
      name: "Bruno Almeida",
      role: "Arquiteto de Soluções I",
      yearsAsArchitect: 3,
      specialization: "Cloud",
      email: "bruno@company.com",
      active: true,
    },
  ],
  assessments: [
    {
      id: "ana-h1",
      architectId: "ana",
      cycleId: "2026-h1",
      status: "Completed",
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
      // Completed: gapsFor/domainAverages só usam assessment oficial.
      status: "Completed",
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
          progress: 60,
          evidenceIds: [],
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
          progress: 40,
          evidenceIds: [],
        },
      ],
    },
  ],
  okrs: [
    {
      id: "okr-ana",
      architectId: "ana",
      cycleId: "2026-h2",
      objective: "Referência em segurança",
      keyResults: [
        { id: "kr-1", title: "Curso", progress: 100 },
        { id: "kr-2", title: "ADR", progress: 0 },
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
  certifications: [],
  activeCycleId: "2026-h2",
  philosophy: {
    title: "Filosofia de Desenvolvimento",
    description: "O desenvolvimento técnico não se sustenta apenas em cursos.",
    stages: [
      { id: "aprender", name: "Aprender" },
      { id: "praticar", name: "Praticar" },
    ],
    footer: "",
  },
};
