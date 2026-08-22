import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, within } from "@testing-library/react";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `<Link>` do TanStack Router precisa de um `RouterProvider` real. A tela de
 * Capacidades ganhou `CapabilitiesTabs` (FASE 2, quinta rodada), que usa
 * `<Link>` para as três abas — como este teste não monta o router da
 * aplicação, troca por uma âncora comum. Mesmo padrão de
 * team-deactivate.test.tsx.
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
import type { SessionUser } from "../api";
import { type AppState } from "../api";
import { AuthProvider, useAuth } from "../auth";
import { I18nProvider } from "../i18n";
import { StoreProvider } from "../store";
import { fixtureAdminUser, fixtureState } from "./fixtures";

/**
 * EPIC 6 (quarta rodada) — antes, "0 Especialistas + 1 Avançado" caía no
 * mesmo `else` genérico de "0 Especialistas + 3 Avançados", os dois
 * rotulados "healthy" igual a um domínio com especialista de verdade. Cada
 * combinação agora tem um estado explícito. Ver AUDITORIA-QUARTA-REVISAO-
 * ESTADO-ATUAL-SYNAPSE.md.
 */

const fetchMock = vi.fn();

function Wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <AuthProvider>
          <AuthReady>
            <StoreProvider>{children}</StoreProvider>
          </AuthReady>
        </AuthProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}

function AuthReady({ children }: { children: ReactNode }) {
  const { loading } = useAuth();
  if (loading) return null;
  return <>{children}</>;
}

const CapabilityPage = CapabilityRoute.options.component as () => ReactNode;

const renderPage = (state: AppState, user: SessionUser = fixtureAdminUser) => {
  fetchMock.mockImplementation((url: string) => {
    const href = String(url);
    if (href.endsWith("/api/auth/me")) {
      return Promise.resolve(
        new Response(JSON.stringify(user), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );
    }
    if (href.endsWith("/api/state")) {
      return Promise.resolve(
        new Response(JSON.stringify(state), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );
    }
    return Promise.resolve(new Response("{}", { status: 200 }));
  });
  return render(
    <Wrapper>
      <CapabilityPage />
    </Wrapper>,
  );
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

  it("domínio com 1 pessoa avançada e 0 especialistas mostra risco de concentração, não 'healthy'", async () => {
    // Cloud: Ana=nível 4 (avançado), Bruno=nível 2.5 (praticante) — só 1 referência técnica.
    renderPage(fixtureState);
    const card = (await screen.findByText("Cloud Architecture")).closest("section")!;
    expect(within(card).getByText(/Risco de concentração/)).toBeTruthy();
  });

  it("domínio sem ninguém avançado ou especialista mostra 'sem referência técnica'", async () => {
    // Security: Ana e Bruno em IAM ficam abaixo de 2,5 — nenhuma referência técnica.
    renderPage(fixtureState);
    const card = (await screen.findByText("Security")).closest("section")!;
    expect(within(card).getByText(/Sem referência técnica/)).toBeTruthy();
  });

  it("domínio com duas ou mais referências técnicas mostra cobertura distribuída", async () => {
    const state: AppState = {
      ...fixtureState,
      architects: [
        ...fixtureState.architects,
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
    renderPage(state);
    const card = (await screen.findByText("Cloud Architecture")).closest("section")!;
    expect(within(card).getByText(/Cobertura distribuída/)).toBeTruthy();
  });

  /**
   * ANA-001 (AUDITORIA-QUINTA-RODADA-360-SYNAPSE-2026-08-19.md) — mesmo
   * estado do teste anterior (3 pessoas avançadas/especialistas em Cloud:
   * "cobertura distribuída" para o admin, que enxerga todo mundo), mas
   * lido por um Lead atribuído só à Ana. Bruno e Carla continuam no roster
   * (dado de diretório, sem filtro), mas fora do escopo de carreira deste
   * Lead — a população da análise de risco não pode contá-los como
   * "referência técnica" só porque o nome deles aparece na lista.
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

    renderPage(state, leadUser);
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
