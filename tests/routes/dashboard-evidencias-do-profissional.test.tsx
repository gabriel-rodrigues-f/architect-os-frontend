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

import { Route as DashboardRoute } from "@/routes/index";
import { type AppState, type SessionUser } from "@/lib/api";
import { fixtureMemberUser, fixtureState, scopedFixtureStateFor } from "../helpers/fixtures";
import { mockAppFetch, renderWithApp } from "../helpers/render-app";

/**
 * RUMO AO 100% — achado da fatia `e2e-de-entrega` (2026-09-02), literal: "o
 * profissional perdeu o ÚNICO ponto de registro de evidência — EvidenceDialog
 * só vive em architects.$architectId.index.tsx atrás de canActFor, e a onda
 * 31 nega a ele a própria ficha".
 *
 * A onda 31 decidiu que o profissional não vê os próprios números nem a
 * própria ficha. Tirar dele o registro de evidência foi EFEITO COLATERAL,
 * não decisão: registrar evidência da própria competência é, por definição,
 * o que ele tem a fazer. O Painel do profissional ganha a seção "Minhas
 * evidências" — lista (título, tipo, data, situação) e o MESMO diálogo de
 * registro da ficha — sem reabrir a ficha e sem número de avaliação.
 *
 * A liderança NÃO ganha a seção: ela registra pela ficha do liderado, como
 * antes. Nasceu VERMELHO: o Painel do member não tinha a seção nem o botão.
 */
const fetchMock = vi.fn();

const TIME_DE_ANA = "time-de-ana";

const fixtureTechLeadDeAna: SessionUser = {
  id: "test-techlead-de-ana",
  email: "techlead-de-ana@company.com",
  name: "Tech Lead de Ana",
  role: "tech_lead",
  architectId: null,
  status: "active",
  mustChangePassword: false,
  createdAt: "2026-01-01T00:00:00Z",
  memberships: [{ teamId: TIME_DE_ANA, role: "tech_lead" }],
};

const DashboardPage = DashboardRoute.options.component as () => ReactNode;

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
  mockAppFetch(fetchMock, { user, state: scopedFixtureStateFor(user, state) });
  return renderWithApp(<DashboardPage />);
}

describe("Painel do profissional — Minhas evidências", () => {
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
    await screen.findByText("Minha Evolução");

    expect(await screen.findByText("Minhas evidências")).toBeTruthy();
    expect(await screen.findByText("ADR-014")).toBeTruthy();
    expect(screen.getByText("Workshop de observabilidade")).toBeTruthy();
    expect(screen.getByText("Pendente")).toBeTruthy();
    expect(screen.getByText("Precisa melhorar")).toBeTruthy();
    expect(screen.getByText(/06\/08\/2026/)).toBeTruthy();
    expect(screen.getByText(/20\/08\/2026/)).toBeTruthy();
  });

  it("member abre o MESMO diálogo de registro da ficha a partir do Painel", async () => {
    renderAs(fixtureMemberUser);
    await screen.findByText("Minhas evidências");

    fireEvent.click(screen.getByRole("button", { name: "Registrar" }));

    expect(await screen.findByRole("dialog", { name: "Nova evidência" })).toBeTruthy();
    expect(screen.getByLabelText("Título")).toBeTruthy();
  });

  it("member corrige e reenvia a evidência devolvida sem sair do Painel", async () => {
    renderAs(fixtureMemberUser, stateComEvidenciaDevolvida);
    await screen.findByText("Minhas evidências");

    expect(screen.getByRole("button", { name: "Corrigir e reenviar" })).toBeTruthy();
    expect(screen.getByText(/Falta o material apresentado/)).toBeTruthy();
  });

  it("member sem evidência vê o estado vazio da seção, com o botão de registrar", async () => {
    renderAs(fixtureMemberUser, { ...fixtureState, evidences: [] });
    await screen.findByText("Minhas evidências");

    expect(await screen.findByText("Nenhuma evidência registrada.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Registrar" })).toBeTruthy();
  });

  it("a seção não mostra número de avaliação", async () => {
    renderAs(fixtureMemberUser);
    await screen.findByText("Minhas evidências");

    expect(screen.queryByText("Nível médio")).toBeNull();
    expect(screen.queryByText("Competências em evolução")).toBeNull();
  });

  it("tech lead NÃO ganha a seção no Painel: ele registra pela ficha do liderado", async () => {
    const state: AppState = {
      ...fixtureState,
      architects: fixtureState.architects.map((architect) =>
        architect.id === "ana" ? { ...architect, teamId: TIME_DE_ANA } : architect,
      ),
    };
    mockAppFetch(fetchMock, {
      user: fixtureTechLeadDeAna,
      state: scopedFixtureStateFor(fixtureTechLeadDeAna, state, [TIME_DE_ANA]),
    });
    renderWithApp(<DashboardPage />);
    await screen.findByText("Pendências do Lead");

    expect(await screen.findByText(/ADR-014/)).toBeTruthy();
    expect(screen.queryByText("Minhas evidências")).toBeNull();
    expect(screen.queryByRole("button", { name: "Registrar" })).toBeNull();
  });
});
