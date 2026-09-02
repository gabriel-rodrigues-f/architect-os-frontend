import { describe, expect, it } from "vitest";

import type {
  CareerLevelTransition,
  DevelopmentPlanEvent,
  Evidence,
  MentoringSession,
} from "@/lib/domain";
import type { TeamTransitionRecord } from "@/lib/gateways/reports.gateway";
import { CareerStatementViewModel, type StatementSources } from "@/lib/view-models";

/**
 * Tela 4 (spec §4, CONTRATO PRD-04) — extrato de carreira: a história da
 * pessoa em ordem CRONOLÓGICA, e TUDO entra — transições de nível, degraus
 * de competência, evidências, eventos de PDI e mentorias, as 5 fontes que
 * já existem. A VM normaliza as 5 no mesmo StatementEntry, ordena do mais
 * recente para o mais antigo, agrupa por ano e aplica os filtros de
 * período/tipo. Quando o PRD-04 entregar o agregado, a VM troca 5 chamadas
 * por 1 sem a tela mudar.
 *
 * O `translate` é injetado: título de entrada é texto de tela (i18n),
 * nunca string montada fora do catálogo.
 */
const translate = (key: string, vars?: Record<string, string | number>): string =>
  vars ? `${key} ${Object.values(vars).join(" ")}` : key;

const vm = () =>
  new CareerStatementViewModel(translate, (id) => (id === "cc" ? "Clean Core" : undefined));

const transition: CareerLevelTransition = {
  id: "tr-1",
  architectId: "ana",
  fromRole: "Júnior",
  toRole: "Pleno",
  actorUserId: "user-lead",
  reason: "Promoção do ciclo",
  occurredAt: "2026-03-10T12:00:00.000Z",
  architectVersion: 3,
};

const competencyEvent = {
  id: "ev-1",
  architectId: "ana",
  competencyId: "cc",
  fromLevel: 2 as const,
  toLevel: 3 as const,
  sourceType: "MENTORING" as const,
  sourceId: "mnt-1",
  effectiveDate: "2025-11-05",
  recordedAt: "2025-11-05T10:00:00.000Z",
  actorUserId: "user-lead",
  note: "Evoluiu no workshop",
};

const evidence: Evidence = {
  id: "evd-1",
  architectId: "ana",
  title: "Certificação BTP",
  description: "Prova de certificação",
  type: "Certification",
  competencyIds: ["cc"],
  date: "2026-01-20",
  complexity: "Medium",
  status: "Accepted",
};

const planEvent: DevelopmentPlanEvent = {
  id: "pe-1",
  planId: "plan-1",
  eventType: "PlanApproved",
  fromStatus: "Draft",
  toStatus: "Approved",
  actorUserId: "user-lead",
  reason: null,
  occurredAt: "2026-02-01T09:00:00.000Z",
  planVersion: 2,
};

const mentoring: MentoringSession = {
  id: "mnt-1",
  mentor: "Carlos Prado",
  menteeId: "ana",
  date: "2025-12-15",
  durationMin: 60,
  topic: "Arquitetura de Eventos",
  competencyIds: ["cc"],
  notes: "",
  decisions: "",
  actions: "",
};

const teamTransition: TeamTransitionRecord = {
  id: "tt-1",
  occurredOn: "2026-02-15",
  fromTeamName: "Plataforma",
  toTeamName: "Dados",
  reason: "Reforço do time de dados",
};

const sources: StatementSources = {
  architectId: "ana",
  transitions: [transition],
  teamTransitions: [teamTransition],
  competencyEvents: [competencyEvent],
  evidences: [evidence],
  planEvents: [planEvent],
  mentoringSessions: [mentoring],
};

describe("CareerStatementViewModel — normalização das 5 fontes", () => {
  it("TUDO entra, em ordem cronológica do mais recente para o mais antigo", () => {
    const entries = vm().entries(sources);
    expect(entries.map((entry) => entry.kind)).toEqual([
      "transition",
      "teamTransition",
      "pdi",
      "evidence",
      "mentoring",
      "competencyStep",
    ]);
  });

  it("resolve nome de competência no degrau e usa o catálogo i18n nos títulos", () => {
    const entries = vm().entries(sources);
    const step = entries.find((entry) => entry.kind === "competencyStep");
    expect(step?.title).toContain("Clean Core");
    expect(step?.title).toContain("statement.entry.competencyStep");
    const pdi = entries.find((entry) => entry.kind === "pdi");
    expect(pdi?.title).toBe("statement.entry.pdi.approved");
  });

  it("cada entrada aponta para a origem (link interno)", () => {
    const entries = vm().entries(sources);
    expect(entries.find((entry) => entry.kind === "evidence")?.link).toBe("/architects/ana");
    expect(entries.find((entry) => entry.kind === "pdi")?.link).toBe(
      "/development-plans?architectId=ana",
    );
    expect(entries.find((entry) => entry.kind === "mentoring")?.link).toBe("/mentoring");
  });

  it("agrupa por ano, do mais recente para o mais antigo", () => {
    const groups = vm().groupByYear(vm().entries(sources));
    expect(groups.map((group) => group.year)).toEqual(["2026", "2025"]);
    expect(groups[0]?.entries).toHaveLength(4);
    expect(groups[1]?.entries).toHaveLength(2);
  });

  it("filtra por tipo de entrada sem perder a ordem", () => {
    const feed = vm();
    const filtered = feed.filterByKinds(feed.entries(sources), ["evidence", "mentoring"]);
    expect(filtered.map((entry) => entry.kind)).toEqual(["evidence", "mentoring"]);
  });

  it("filtra por período usando o DIA da entrada (limites inclusivos)", () => {
    const feed = vm();
    const filtered = feed.filterByRange(feed.entries(sources), {
      from: "2026-01-20",
      to: "2026-02-01",
    });
    expect(filtered.map((entry) => entry.kind)).toEqual(["pdi", "evidence"]);
  });

  it("degrau sem nível anterior usa o título de registro inicial", () => {
    const first = vm().entries({
      ...sources,
      competencyEvents: [{ ...competencyEvent, fromLevel: null }],
    });
    const step = first.find((entry) => entry.kind === "competencyStep");
    expect(step?.title).toContain("statement.entry.competencyStepFirst");
  });

  it("rangeForPreset cobre os presets e 'all' abre desde sempre", () => {
    const range = vm().rangeForPreset("all");
    expect(range.from).toBe("2000-01-01");
    const recent = vm().rangeForPreset("90");
    expect(recent.from < recent.to).toBe(true);
  });
});

/**
 * Onda 35, item 17 do dono: a mudança de time passou a exigir motivo e a ser
 * gravada como transição. O Extrato é a história da pessoa — a troca de time
 * entra nele como a transição de nível entra: título com origem e destino,
 * motivo no detalhe, e ordenada pela data junto das outras entradas.
 */
describe("CareerStatementViewModel — mudança de time no extrato", () => {
  it("com time anterior: 'mudou do time X para Y', motivo no detalhe, link para o perfil", () => {
    const entry = vm()
      .entries(sources)
      .find((candidate) => candidate.kind === "teamTransition");
    expect(entry?.id).toBe("team-transition-tt-1");
    expect(entry?.title).toBe("statement.entry.teamTransition Plataforma Dados");
    expect(entry?.detail).toBe("Reforço do time de dados");
    expect(entry?.link).toBe("/architects/ana");
  });

  it("sem time anterior: 'entrou no time Y'", () => {
    const entry = vm()
      .entries({ ...sources, teamTransitions: [{ ...teamTransition, fromTeamName: null }] })
      .find((candidate) => candidate.kind === "teamTransition");
    expect(entry?.title).toBe("statement.entry.teamTransitionFirst Dados");
  });

  it("entra na ordem cronológica junto das outras entradas e responde ao filtro de tipo", () => {
    const feed = vm();
    const entries = feed.entries(sources);
    expect(entries.map((entry) => entry.date)).toEqual([
      "2026-03-10T12:00:00.000Z",
      "2026-02-15",
      "2026-02-01T09:00:00.000Z",
      "2026-01-20",
      "2025-12-15",
      "2025-11-05",
    ]);
    expect(feed.filterByKinds(entries, ["teamTransition"]).map((entry) => entry.id)).toEqual([
      "team-transition-tt-1",
    ]);
  });
});
