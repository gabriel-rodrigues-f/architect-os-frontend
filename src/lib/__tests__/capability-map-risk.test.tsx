import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Route as CapabilityRoute } from "@/routes/capability-map";
import { setAuthToken, type AppState } from "../api";
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

const renderPage = (state: AppState) => {
  fetchMock.mockImplementation((url: string) => {
    const href = String(url);
    if (href.endsWith("/api/auth/me")) {
      return Promise.resolve(
        new Response(JSON.stringify(fixtureAdminUser), {
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
    setAuthToken("token-de-teste");
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    setAuthToken(null);
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
        },
      ],
      assessments: [
        ...fixtureState.assessments,
        {
          id: "carla-h2",
          architectId: "carla",
          cycleId: "2026-h2",
          status: "Completed",
          items: [{ competencyId: "cloud-k8s", self: 5, leader: 5, target: 4, final: 5, comments: [] }],
        },
      ],
    };
    renderPage(state);
    const card = (await screen.findByText("Cloud Architecture")).closest("section")!;
    expect(within(card).getByText(/Cobertura distribuída/)).toBeTruthy();
  });

  it("não mostra nenhuma ação de criar, editar ou excluir domínio — isso migrou para a Matriz de Competências", async () => {
    renderPage(fixtureState);
    await screen.findByText("Cloud Architecture");

    expect(screen.queryByRole("button", { name: /Nova capacidade/ })).toBeNull();
    expect(screen.queryByLabelText(/Editar Cloud Architecture/)).toBeNull();
    expect(screen.queryByLabelText(/Excluir Cloud Architecture/)).toBeNull();
  });
});
