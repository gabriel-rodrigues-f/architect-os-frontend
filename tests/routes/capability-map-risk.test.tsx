import { cleanup, screen, within } from "@testing-library/react";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `<Link>` do TanStack Router precisa de um `RouterProvider` real — como
 * este teste não monta o router da aplicação, troca por uma âncora comum.
 * Mesmo padrão de team-deactivate.test.tsx.
 */
vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    Link: ({ children, to: _to, ...rest }: ComponentProps<"a"> & { to?: string }) => (
      <a {...rest}>{children}</a>
    ),
  };
});

import { Route as CapabilityRoute } from "@/routes/capability-map";
import type { SessionUser } from "@/lib/api";
import { type AppState } from "@/lib/api";
import { fixtureAdminUser, fixtureState, scopedFixtureStateFor } from "../helpers/fixtures";
import { renderWithApp } from "../helpers/render-app";
import { apiPath } from "@/lib/api-path";

/**
 * EPIC 6 (quarta rodada) — antes, "0 Especialistas + 1 Avançado" caía no
 * mesmo `else` genérico de "0 Especialistas + 3 Avançados", os dois
 * rotulados "healthy" igual a um domínio com especialista de verdade. Cada
 * combinação agora tem um estado explícito. Ver AUDITORIA-QUARTA-REVISAO-
 * ESTADO-ATUAL-SYNAPSE.md.
 */

const fetchMock = vi.fn();

/** OO3-11/D-7 — providers compartilhados em `render-app.tsx` (`renderWithApp`). */

const CapabilityPage = CapabilityRoute.options.component as () => ReactNode;

const renderPage = (state: AppState, user: SessionUser = fixtureAdminUser) => {
  fetchMock.mockImplementation((url: string) => {
    const href = String(url);
    if (href.endsWith(apiPath("/auth/me"))) {
      return Promise.resolve(
        new Response(JSON.stringify(user), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );
    }
    if (href.endsWith(apiPath("/state"))) {
      return Promise.resolve(
        new Response(JSON.stringify(state), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );
    }
    return Promise.resolve(new Response("{}", { status: 200 }));
  });
  return renderWithApp(<CapabilityPage />);
};

describe("Mapa de Capacidades — risco explícito, sem CRUD de domínio", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("mostra as faixas em ordem crescente de proficiência, sem chamar a primeira de 'Lacunas'", async () => {
    renderPage(fixtureState);
    await screen.findByText("Cloud Architecture");

    const ordem = [
      "Em desenvolvimento (<2,5)",
      "Praticantes (2,5+)",
      "Avançados (3,5+)",
      "Especialistas (4,5+)",
    ];
    const noCard = screen
      .getAllByText(/^(Em desenvolvimento|Praticantes|Avançados|Especialistas) \(/)
      .map((el) => el.textContent);
    expect(noCard.slice(0, 4)).toEqual(ordem);
  });

  /**
   * OO3-11h — os 3 estados de risco pela DOM viraram casos unitários do
   * `CapabilityCoveragePresenter` (`capability-coverage-presenter.test.ts`);
   * aqui ficam os invariantes de tela: ordem/rótulo das faixas, o recorte
   * por escopo (ANA-001) e a ausência de CRUD.
   */
  /**
   * ANA-001 (AUDITORIA-QUINTA-RODADA-360-SYNAPSE-2026-08-19.md) — estado
   * com 3 pessoas avançadas/especialistas em Cloud (
   * "cobertura distribuída" para o admin, que enxerga todo mundo), mas
   * lido por um Lead atribuído só à Ana. Desde o roster fechado (backend
   * `d1edba4`) o recorte é do servidor: o payload deste Lead traz só a Ana
   * (`scopedFixtureStateFor`), e a análise de risco não pode contar Bruno e
   * Carla como "referência técnica" — eles nem chegam ao navegador.
   */
  it("Lead sem Bruno/Carla atribuídos vê risco de concentração, não a cobertura distribuída que o admin vê", async () => {
    const leadUser: SessionUser = {
      id: "test-lead-de-ana",
      email: "lead-de-ana@company.com",
      name: "Lead de Ana",
      role: "lead",
      architectId: null,
      status: "active",
      mustChangePassword: false,
      createdAt: "2026-01-01T00:00:00Z",
    };
    const state: AppState = {
      ...fixtureState,
      architects: [
        ...fixtureState.architects.map((a) =>
          a.id === "ana" ? { ...a, leadUserId: leadUser.id } : a,
        ),
        {
          id: "carla",
          name: "Carla Souza",
          role: "Arquiteto de Soluções III",
          yearsAsArchitect: 8,
          specialization: "Cloud",
          email: "carla@company.com",
          active: true,
          version: 1,
        },
      ],
      assessments: [
        ...fixtureState.assessments,
        {
          id: "carla-h2",
          architectId: "carla",
          cycleId: "2026-h2",
          status: "Completed",
          modelVersion: 1,
          targetCareerLevelId: null,
          targetSemantics: null,
          version: 1,
          items: [
            { competencyId: "cloud-k8s", self: 5, leader: 5, target: 4, final: 5, comments: [] },
          ],
        },
      ],
    };

    renderPage(scopedFixtureStateFor(leadUser, state), leadUser);
    const card = (await screen.findByText("Cloud Architecture")).closest("section")!;
    expect(within(card).getByText(/Risco de concentração/)).toBeTruthy();
    expect(within(card).queryByText(/Cobertura distribuída/)).toBeNull();
  });

  it("não mostra nenhuma ação de criar, editar ou excluir domínio — isso migrou para a Matriz de Competências", async () => {
    renderPage(fixtureState);
    await screen.findByText("Cloud Architecture");

    expect(screen.queryByRole("button", { name: /Nova capacidade/ })).toBeNull();
    expect(screen.queryByLabelText(/Editar Cloud Architecture/)).toBeNull();
    expect(screen.queryByLabelText(/Excluir Cloud Architecture/)).toBeNull();
  });
});
