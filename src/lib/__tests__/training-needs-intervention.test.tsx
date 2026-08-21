import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** Mesma razão de team-deactivate.test.tsx: `<Link>` exige RouterProvider real. */
vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    Link: ({ children, to: _to, ...rest }: ComponentProps<"a"> & { to?: string }) => (
      <a {...rest}>{children}</a>
    ),
  };
});

import { Route as TrainingNeedsRoute } from "@/routes/training-needs";
import { setAuthToken, type AppState, type SessionUser } from "../api";
import { AuthProvider, useAuth } from "../auth";
import { I18nProvider } from "../i18n";
import { StoreProvider } from "../store";
import { fixtureAdminUser, fixtureState } from "./fixtures";

/**
 * EPIC K — Collective Intervention: "Treinamentos Recomendados" era relatório
 * estático. A lacuna coletiva (3+ pessoas) agora vira uma trilha de verdade,
 * atribuída exatamente a quem tem a lacuna — não um número solto.
 */

const fetchMock = vi.fn();

/** Terceira pessoa com a mesma lacuna de segurança que ana e bruno já têm na fixture. */
const carla: AppState["architects"][number] = {
  id: "carla",
  name: "Carla Souza",
  role: "Arquiteto de Soluções II",
  yearsAsArchitect: 5,
  specialization: "Segurança",
  email: "carla@company.com",
  active: true,
  version: 1,
};

const state: AppState = {
  ...fixtureState,
  architects: [...fixtureState.architects, carla],
  // Sem trilha nenhuma de partida: a fixture padrão já tem uma para
  // security-iam, o que esconderia o botão de criação neste teste.
  learningPaths: [],
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
      items: [
        { competencyId: "cloud-k8s", self: 4, leader: 4, target: 4, final: 4, comments: [] },
        { competencyId: "cloud-serverless", self: 4, leader: 4, target: 4, final: 4, comments: [] },
        { competencyId: "security-iam", self: 1, leader: 1, target: 3, final: 1, comments: [] },
      ],
    },
  ],
};

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

const TrainingNeedsPage = TrainingNeedsRoute.options.component as () => ReactNode;

describe("Necessidades de Treinamento — criar intervenção coletiva", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    setAuthToken("token-de-teste");

    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      const href = String(url);
      if (href.endsWith("/api/auth/me")) {
        return Promise.resolve(
          new Response(JSON.stringify(fixtureAdminUser satisfies SessionUser), {
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
      if (init?.method === "POST" && href.endsWith("/api/learning-paths")) {
        // O servidor gera o id de verdade e devolve o recurso completo — a
        // store não insere mais o objeto local otimista (ver AUDITORIA-
        // QUINTA-RODADA-360-SYNAPSE-2026-08-19.md, IDOR-001/EVD-001).
        const body = JSON.parse(String(init.body)) as Record<string, unknown>;
        return Promise.resolve(
          new Response(
            JSON.stringify({
              ...body,
              id: "lp-intervencao-criada",
              createdAt: new Date().toISOString(),
            }),
            { status: 201, headers: { "content-type": "application/json" } },
          ),
        );
      }
      return Promise.resolve(new Response("{}", { status: 200 }));
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    setAuthToken(null);
  });

  it("com 3 pessoas na mesma lacuna, cria trilha atribuída a elas — não a um número solto", async () => {
    render(
      <Wrapper>
        <TrainingNeedsPage />
      </Wrapper>,
    );
    await userEvent.click(await screen.findByRole("button", { name: /Criar trilha coletiva/ }));

    const postCall = fetchMock.mock.calls.find(
      ([url, init]) => String(url).endsWith("/api/learning-paths") && init?.method === "POST",
    );
    expect(postCall).toBeDefined();
    const body = JSON.parse(String(postCall?.[1]?.body)) as {
      competencyIds: string[];
      assignedTo: string[];
    };
    expect(body.competencyIds).toEqual(["security-iam"]);
    expect(body.assignedTo.sort()).toEqual(["ana", "bruno", "carla"]);
  });

  it("depois de criada, mostra 'Ver trilha criada' em vez de oferecer criar de novo", async () => {
    render(
      <Wrapper>
        <TrainingNeedsPage />
      </Wrapper>,
    );
    await userEvent.click(await screen.findByRole("button", { name: /Criar trilha coletiva/ }));
    // Sem otimismo: a tela só reflete a trilha nova depois que o servidor confirma.
    expect(await screen.findByText("Ver trilha criada")).toBeTruthy();
  });
});
