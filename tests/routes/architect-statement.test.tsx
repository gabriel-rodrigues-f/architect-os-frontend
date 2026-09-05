import { cleanup, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const pushMock = vi.fn();

/** Mesma razão de progression.test.tsx: `<Link>`/`useRouter` exigem RouterProvider real. */
vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    Link: ({
      children,
      to: _to,
      params: _params,
      search: _search,
      ...rest
    }: ComponentProps<"a"> & { to?: string; params?: unknown; search?: unknown }) => (
      <a {...rest}>{children}</a>
    ),
    useRouter: () => ({ history: { push: pushMock } }),
    createFileRoute:
      (..._args: unknown[]) =>
      (options: Record<string, unknown>) => ({
        ...options,
        options,
        useParams: () => ({ architectId: "ana" }),
      }),
  };
});

import { Route as StatementRoute } from "@/routes/architects.$architectId.statement";
import { apiPath } from "@/lib/api-path";
import type { AppState } from "@/lib/api";
import { fixtureAdminUser, fixtureMemberUser, fixtureState } from "../helpers/fixtures";
import { jsonResponse, mockAppFetch, renderWithApp } from "../helpers/render-app";

/**
 * Tela 4 (spec §4, CONTRATO PRD-04) — extrato de carreira: cronológico,
 * TUDO entra (5 fontes), gerado pelo LÍDER. As fontes HTTP chegam por
 * queries paralelas e uma fonte que falha vira aviso PARCIAL com retry —
 * nunca derruba o extrato inteiro (o que já chegou continua na tela). As
 * ações de gerar (imprimir / PDF de evolução) aparecem só para quem é
 * líder do arquiteto ou admin; a visibilidade da PÁGINA segue o recorte
 * do servidor, como no perfil.
 */
const fetchMock = vi.fn();

const StatementPage = StatementRoute.options.component as () => ReactNode;

const transition = {
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
  competencyId: "security-iam",
  fromLevel: 2,
  toLevel: 3,
  sourceType: "MENTORING",
  sourceId: "mnt-1",
  effectiveDate: "2025-11-05",
  recordedAt: "2025-11-05T10:00:00.000Z",
  actorUserId: "user-lead",
  note: null,
};

const evolutionResult = {
  architect: {
    id: "ana",
    name: "Ana Martins",
    role: "Pleno",
    careerLevelName: null,
  },
  summary: {
    coverage: { covered: 0, total: 0 },
    initialAverage: null,
    currentAverage: null,
    averageDelta: null,
    mentoringCount: 0,
    assessmentCount: 0,
  },
  capabilitySeries: [],
  competencySeries: [],
  events: [competencyEvent],
  snapshots: [],
  comparisons: [],
};

const planEvent = {
  id: "pe-1",
  planId: "pdi-ana",
  eventType: "PlanApproved",
  fromStatus: "Draft",
  toStatus: "Approved",
  actorUserId: "user-lead",
  reason: null,
  occurredAt: "2026-02-01T09:00:00.000Z",
  planVersion: 2,
};

const stateWithMentoring: AppState = {
  ...fixtureState,
  mentoringSessions: [
    {
      id: "mnt-1",
      mentor: "Carlos Prado",
      menteeId: "ana",
      date: "2025-12-15",
      durationMin: 60,
      topic: "Arquitetura de Eventos",
      competencyIds: ["security-iam"],
      notes: "",
      decisions: "",
      actions: "",
    },
  ],
};

const teamTransition = {
  kind: "teamTransition",
  id: "tt-1",
  occurredOn: "2026-02-15",
  fromTeamName: "Plataforma",
  toTeamName: "Dados",
  reason: "Reforço do time de dados",
};

const statementRoutes = ({ failTransitions = false } = {}) => [
  (href: string, init?: RequestInit): Response | undefined =>
    href.endsWith(apiPath("/reports/career-statement")) && init?.method === "POST"
      ? jsonResponse({
          architect: { id: "ana", name: "Ana Martins", role: "Pleno" },
          range: { from: "2000-01-01", to: "2026-12-31" },
          kinds: ["teamTransition"],
          totals: { teamTransition: 1 },
          entries: [teamTransition],
        })
      : undefined,
  (href: string): Response | undefined => {
    if (href.endsWith(apiPath("/architects/ana/career-level-transitions"))) {
      return failTransitions
        ? jsonResponse({ code: "INTERNAL", message: "erro", correlationId: "x" }, 500)
        : jsonResponse([transition]);
    }
    return undefined;
  },
  (href: string, init?: RequestInit): Response | undefined =>
    href.endsWith(apiPath("/evolution/architect")) && init?.method === "POST"
      ? jsonResponse(evolutionResult)
      : undefined,
  (href: string): Response | undefined =>
    href.endsWith(apiPath("/plans/pdi-ana/events")) ? jsonResponse([planEvent]) : undefined,
];

describe("/architects/$architectId/statement — extrato de carreira", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    pushMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    window.history.replaceState(null, "", "/architects/ana/statement");
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    window.history.replaceState(null, "", "/");
  });

  it("mostra as 5 fontes num feed só, agrupado por ano", async () => {
    mockAppFetch(fetchMock, {
      user: fixtureAdminUser,
      state: stateWithMentoring,
      routes: statementRoutes(),
    });
    renderWithApp(<StatementPage />);

    expect(await screen.findByText("Transição de nível: Júnior → Pleno")).toBeTruthy();
    expect(screen.getByText("Evidência: ADR-014")).toBeTruthy();
    expect(screen.getByText("PDI aprovado")).toBeTruthy();
    expect(screen.getByText("Mentoria: Arquitetura de Eventos")).toBeTruthy();
    expect(screen.getByText("IAM: L2 → L3")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "2026" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "2025" })).toBeTruthy();
  });

  it("fonte que falha vira aviso PARCIAL com retry — o resto do extrato continua na tela", async () => {
    mockAppFetch(fetchMock, {
      user: fixtureAdminUser,
      state: stateWithMentoring,
      routes: statementRoutes({ failTransitions: true }),
    });
    renderWithApp(<StatementPage />);

    expect(await screen.findByText("Transições de nível não carregou.")).toBeTruthy();
    expect(screen.getByText("Evidência: ADR-014")).toBeTruthy();
    expect(screen.queryByText(/Transição de nível:/)).toBeNull();
  });

  /**
   * Onda 31 — a própria pessoa deixou de ABRIR o extrato (o dono tirou do
   * profissional os próprios números); a negativa da tela é o que ela vê, e
   * o botão de imprimir continua fora do alcance dela.
   */
  it("as ações de gerar (imprimir) aparecem para admin/líder, nunca para a própria pessoa", async () => {
    mockAppFetch(fetchMock, {
      user: fixtureAdminUser,
      state: stateWithMentoring,
      routes: statementRoutes(),
    });
    const { unmount } = renderWithApp(<StatementPage />);
    expect(await screen.findByRole("button", { name: "Imprimir extrato" })).toBeTruthy();
    unmount();
    cleanup();

    mockAppFetch(fetchMock, {
      user: fixtureMemberUser,
      state: stateWithMentoring,
      routes: statementRoutes(),
    });
    renderWithApp(<StatementPage />);
    await screen.findByText(
      "Evolução, Extrato e Roteiro são leituras da liderança sobre a carreira de uma pessoa.",
    );
    expect(screen.queryByText("Evidência: ADR-014")).toBeNull();
    expect(screen.queryByRole("button", { name: "Imprimir extrato" })).toBeNull();
  });

  /**
   * Onda 35, item 17 do dono: a mudança de time tem motivo e vira transição.
   * O Extrato pede ao relatório de carreira SÓ as transições de time da
   * pessoa e as mostra como linha própria — título com origem e destino,
   * motivo no detalhe, tipo filtrável ao lado dos outros.
   */
  it("a mudança de time aparece no extrato com o motivo, e o filtro lista o tipo", async () => {
    mockAppFetch(fetchMock, {
      user: fixtureAdminUser,
      state: stateWithMentoring,
      routes: statementRoutes(),
    });
    renderWithApp(<StatementPage />);

    expect(await screen.findByText("Mudou do time Plataforma para Dados")).toBeTruthy();
    expect(screen.getByText("Reforço do time de dados")).toBeTruthy();
    expect(screen.getByText("Mudança de time")).toBeTruthy();

    const pedido = fetchMock.mock.calls.find(
      ([href, init]) =>
        String(href).endsWith(apiPath("/reports/career-statement")) &&
        (init as RequestInit | undefined)?.method === "POST",
    );
    const corpo = JSON.parse(String((pedido?.[1] as RequestInit).body)) as {
      architectId: string;
      kinds: string[];
    };
    expect(corpo.architectId).toBe("ana");
    expect(corpo.kinds).toEqual(["teamTransition"]);

    await userEvent.click(screen.getByRole("button", { name: /Tipos de entrada/ }));
    expect(await screen.findByRole("option", { name: /Mudança de time/ })).toBeTruthy();
  });

  it("'Ver origem' navega para a fonte da entrada", async () => {
    mockAppFetch(fetchMock, {
      user: fixtureAdminUser,
      state: stateWithMentoring,
      routes: statementRoutes(),
    });
    renderWithApp(<StatementPage />);
    await screen.findByText("Evidência: ADR-014");
    const openButtons = screen.getAllByRole("button", { name: "Ver origem" });
    openButtons[0]?.click();
    expect(pushMock).toHaveBeenCalled();
  });
});
