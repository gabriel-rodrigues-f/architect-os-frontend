import { cleanup, screen } from "@testing-library/react";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** Mesma razão de team-deactivate.test.tsx: `<Link>` exige RouterProvider real. */
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
import {
  fixtureAdminUser,
  fixtureMemberUser,
  fixtureState,
  scopedFixtureStateFor,
} from "../helpers/fixtures";
import { mockAppFetch, operationsOverviewRoute, renderWithApp } from "../helpers/render-app";

/**
 * FASE 2 (quinta rodada) — "homes distintas Member/Lead/Admin": antes, todo
 * mundo via a mesma visão executiva de time, mesmo enxergando só uma fatia
 * dos registros (roster é dado de diretório, sem filtro; assessments/PDIs/
 * evidências, sim). Member vê "Minha Evolução" (agenda pessoal); Lead vê
 * "Pendências do Lead" (fila do que depende de uma decisão dele); Admin
 * mantinha a visão executiva original. Ver AUDITORIA-QUINTA-RODADA-360-
 * SYNAPSE-2026-08-19.md, Seção 7 e 33.
 *
 * Revisão de papéis (dono, 2026-09-05, D1): o Painel do admin virou o Painel
 * de OPERAÇÃO — o sistema em números, sem nome ao lado de nota. E o alcance
 * da liderança é o VÍNCULO: sem membership, a fila fica vazia mesmo que o
 * servidor entregue alguém.
 */

const fetchMock = vi.fn();

const TIME_DE_ANA = "time-de-ana";

const fixtureLeadOfAna: SessionUser = {
  id: "test-lead-de-ana",
  email: "lead-de-ana@company.com",
  name: "Lead de Ana",
  role: "tech_lead",
  architectId: null,
  status: "active",
  mustChangePassword: false,
  createdAt: "2026-01-01T00:00:00Z",
};

/**
 * ADR-0047 do backend — o `lead` morreu e virou `manager` + `tech_lead`. O
 * ternário do painel não era exaustivo: papel que não fosse `lead` nem
 * `member` caía no `AdminHome` por OMISSÃO, calado. O gerente é o caso que
 * morde na aplicação do dono (`gerente@synapse.com.br`).
 */
const fixtureGestorDeAna: SessionUser = {
  id: "test-gerente-de-ana",
  email: "gerente-de-ana@company.com",
  name: "Gerente de Ana",
  role: "manager",
  architectId: null,
  status: "active",
  mustChangePassword: false,
  createdAt: "2026-01-01T00:00:00Z",
  memberships: [{ teamId: TIME_DE_ANA, role: "manager" }],
};

const fixtureTechLeadDeAna: SessionUser = {
  ...fixtureGestorDeAna,
  id: "test-techlead-de-ana",
  email: "techlead-de-ana@company.com",
  name: "Tech Lead de Ana",
  role: "tech_lead",
  memberships: [{ teamId: TIME_DE_ANA, role: "tech_lead" }],
};

const DashboardPage = DashboardRoute.options.component as () => ReactNode;

/** OO3-11/D-7 — setup compartilhado em `render-app.tsx`. */
function renderAs(user: SessionUser, state: AppState = fixtureState) {
  mockAppFetch(fetchMock, { user, state, routes: [operationsOverviewRoute] });
  return renderWithApp(<DashboardPage />);
}

/** Ana no time da liderança da sessão, com o recorte que o servidor faria. */
function renderAsLeaderOfAna(user: SessionUser) {
  const state: AppState = {
    ...fixtureState,
    architects: fixtureState.architects.map((architect) =>
      architect.id === "ana" ? { ...architect, teamId: TIME_DE_ANA } : architect,
    ),
  };
  return renderAs(user, scopedFixtureStateFor(user, state, [TIME_DE_ANA]));
}

describe("Painel — Home por papel", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("D1 (dono, 2026-09-05): admin vê o Painel de operação — contagens, sem nome de pessoa", async () => {
    renderAs(fixtureAdminUser);
    await screen.findByText("Visão do Sistema");
    expect(await screen.findByText("Pessoas ativas")).toBeTruthy();
    expect(screen.getByText("Contas por cargo")).toBeTruthy();
    expect(screen.queryByText("Painel de Capacidades")).toBeNull();
    expect(screen.queryByText("Ações da Liderança")).toBeNull();
    expect(screen.queryByText("Ana Martins")).toBeNull();
    expect(screen.queryByText(/ADR-014/)).toBeNull();
  });

  it("member vê 'Minha Evolução', não a visão de time", async () => {
    renderAs(fixtureMemberUser);
    await screen.findByText("Minha Evolução");
    expect(screen.queryByText("Painel de Capacidades")).toBeNull();
    expect(screen.queryByText("Profissionais")).toBeNull();
    expect(await screen.findByText("Meu PDI")).toBeTruthy();
  });

  /**
   * Onda 31 — pedido literal do dono (2026-09-01): "eu não quero que o
   * profissional veja seus números de avaliação. isso pode influenciá-lo
   * negativamente. pode remover o 'Nível médio' e 'gaps abertos'". Os dois
   * cartões saem SÓ da visão do profissional; a ficha que a liderança abre
   * continua com eles.
   */
  it("member não vê 'Nível médio' nem a contagem de competências em evolução no painel", async () => {
    renderAs(fixtureMemberUser);
    await screen.findByText("Minha Evolução");
    expect(await screen.findByText("Avaliação")).toBeTruthy();
    expect(screen.queryByText("Nível médio")).toBeNull();
    expect(screen.queryByText("Competências em evolução")).toBeNull();
  });

  it("member sem architectId vinculado vê o estado de conta não vinculada", async () => {
    const unlinked: SessionUser = { ...fixtureMemberUser, architectId: null };
    renderAs(unlinked);
    await screen.findByText("Minha Evolução");
    expect(
      await screen.findByText("Sua conta ainda não está vinculada a um perfil profissional"),
    ).toBeTruthy();
  });

  it("lead sem pessoa atribuída vê o estado vazio, não a visão de time", async () => {
    renderAs(fixtureLeadOfAna, scopedFixtureStateFor(fixtureLeadOfAna));
    await screen.findByText("Ações da Liderança");
    expect(screen.queryByText("Painel de Capacidades")).toBeNull();
    expect(await screen.findByText("Nenhuma pessoa sob sua liderança ainda")).toBeTruthy();
  });

  it("gerente vê 'Pendências do Lead', nunca a visão executiva do admin", async () => {
    renderAsLeaderOfAna(fixtureGestorDeAna);
    await screen.findByText("Ações da Liderança");
    expect(screen.queryByText("Painel de Capacidades")).toBeNull();
    expect(await screen.findByText(/ADR-014/)).toBeTruthy();
  });

  it("tech lead vê 'Pendências do Lead', nunca a visão executiva do admin", async () => {
    renderAsLeaderOfAna(fixtureTechLeadDeAna);
    await screen.findByText("Ações da Liderança");
    expect(screen.queryByText("Painel de Capacidades")).toBeNull();
    expect(await screen.findByText(/ADR-014/)).toBeTruthy();
  });

  it("sessão de liderança SEM vínculo vê o estado vazio mesmo com gente no payload — o alcance é o vínculo (dono, 2026-09-05)", async () => {
    renderAsLeaderOfAna(fixtureLeadOfAna);
    await screen.findByText("Ações da Liderança");
    // "e1" na fixture: evidência Pending de "ana", título "ADR-014" — o servidor
    // entregou, mas sem membership a fila não é dele.
    expect(await screen.findByText("Nenhuma pessoa sob sua liderança ainda")).toBeTruthy();
    expect(screen.queryByText(/ADR-014/)).toBeNull();
  });
});
