import { cleanup, fireEvent, screen } from "@testing-library/react";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** Mesma razão de `dashboard-roles.test.tsx`: `<Link>` exige RouterProvider real. */
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
  };
});

import { Route as AssessmentsRoute } from "@/routes/assessments";
import { type AppState, type SessionUser } from "@/lib/api";
import { fixtureMemberUser, fixtureState, scopedFixtureStateFor } from "../helpers/fixtures";
import { emptyEligibilityRoute, mockAppFetch, renderWithApp } from "../helpers/render-app";

/**
 * Decisão do dono (2026-09-05): "Mude para a tela de avaliações. O Painel
 * deve ser apenas de gráficos e números para avaliação analítica." A seção de
 * evidências da pessoa mora em Avaliações, ao lado da avaliação do ciclo.
 *
 * Dono, 2026-09-06 — ninguém age sobre si: o profissional LÊ as próprias
 * evidências (título, tipo, data, situação, comentário do líder) e não
 * registra nem reenvia; quem lidera registra e reenvia por ele, aqui e pela
 * ficha. A revisão continua na ficha.
 */
const fetchMock = vi.fn();

const TIME_DE_ANA = "time-de-ana";

const fixtureTechLeadDeAna: SessionUser = {
  id: "test-techlead-de-ana",
  email: "techlead-de-ana@company.com",
  name: "Tech Lead de Ana",
  role: "tech_lead",
  professionalId: null,
  status: "active",
  mustChangePassword: false,
  createdAt: "2026-01-01T00:00:00Z",
  memberships: [{ teamId: TIME_DE_ANA, role: "tech_lead" }],
};

const AssessmentsPage = AssessmentsRoute.options.component as () => ReactNode;

const stateComEvidenciaDevolvida: AppState = {
  ...fixtureState,
  evidences: [
    fixtureState.evidences[0]!,
    {
      ...fixtureState.evidences[0]!,
      id: "e2",
      title: "Workshop de observabilidade",
      type: "Workshop",
      date: "2026-08-20",
      status: "Needs Improvement",
      leaderComment: "Falta o material apresentado.",
    },
  ],
};

function renderAs(user: SessionUser, state: AppState = fixtureState) {
  mockAppFetch(fetchMock, {
    user,
    state: scopedFixtureStateFor(user, state),
    routes: [emptyEligibilityRoute],
  });
  return renderWithApp(<AssessmentsPage />);
}

describe("Avaliações — as evidências da pessoa", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("member vê a seção com as próprias evidências: título, tipo, data e situação", async () => {
    renderAs(fixtureMemberUser, stateComEvidenciaDevolvida);
    await screen.findByText("Evidências");

    expect(await screen.findByText("Evidências")).toBeTruthy();
    expect(await screen.findByText("ADR-014")).toBeTruthy();
    expect(screen.getByText("Workshop de observabilidade")).toBeTruthy();
    expect(screen.getByText("Pendente")).toBeTruthy();
    expect(screen.getByText("Precisa melhorar")).toBeTruthy();
    expect(screen.getByText(/06\/08\/2026/)).toBeTruthy();
    expect(screen.getByText(/20\/08\/2026/)).toBeTruthy();
  });

  it("member NÃO registra evidência — a seção dele é leitura (dono, 2026-09-06)", async () => {
    renderAs(fixtureMemberUser);
    await screen.findByText("Evidências");

    expect(screen.queryByRole("button", { name: "Registrar" })).toBeNull();
  });

  it("member lê a devolução com o comentário do líder, mas não corrige nem reenvia — quem lidera reenvia (dono, 2026-09-06)", async () => {
    renderAs(fixtureMemberUser, stateComEvidenciaDevolvida);
    await screen.findByText("Evidências");

    expect(screen.queryByRole("button", { name: "Corrigir e reenviar" })).toBeNull();
    expect(screen.getByText(/Falta o material apresentado/)).toBeTruthy();
  });

  it("member sem evidência vê o estado vazio da seção, sem botão de registrar", async () => {
    renderAs(fixtureMemberUser, { ...fixtureState, evidences: [] });
    await screen.findByText("Evidências");

    expect(await screen.findByText("Nenhuma evidência registrada.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Registrar" })).toBeNull();
  });

  it("a seção não mostra número de avaliação", async () => {
    renderAs(fixtureMemberUser);
    await screen.findByText("Evidências");

    expect(screen.queryByText("Nível médio")).toBeNull();
    expect(screen.queryByText("Competências em evolução")).toBeNull();
  });

  it("tech lead do time ganha a seção na avaliação da liderada e abre o MESMO diálogo de registro da ficha (dono, 2026-09-06)", async () => {
    const state: AppState = {
      ...fixtureState,
      professionals: fixtureState.professionals.map((professional) =>
        professional.id === "ana" ? { ...professional, teamId: TIME_DE_ANA } : professional,
      ),
    };
    mockAppFetch(fetchMock, {
      user: fixtureTechLeadDeAna,
      state: scopedFixtureStateFor(fixtureTechLeadDeAna, state, [TIME_DE_ANA]),
      routes: [emptyEligibilityRoute],
    });
    renderWithApp(<AssessmentsPage />);

    expect((await screen.findAllByText("Ana Martins")).length).toBeGreaterThan(0);
    await screen.findByText("Evidências");
    fireEvent.click(screen.getByRole("button", { name: "Registrar" }));

    expect(await screen.findByRole("dialog", { name: "Nova evidência" })).toBeTruthy();
    expect(screen.getByLabelText("Título")).toBeTruthy();
  });
});
