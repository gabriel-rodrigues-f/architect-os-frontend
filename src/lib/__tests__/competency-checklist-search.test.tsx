import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

/** Mesma razão de outros testes de rota: `<Link>` exige RouterProvider real. */
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

import { Route as MentoringRoute } from "@/routes/mentoring";
import { Route as LearningRoute } from "@/routes/learning-paths";
import { type AppState } from "../api";
import { AuthProvider, useAuth } from "../auth";
import type { Competency } from "../domain";
import { I18nProvider } from "../i18n";
import { StoreProvider } from "../store";
import { fixtureAdminUser, fixtureState } from "./fixtures";

/**
 * R2-ESC-07 (SYNAPSE-DIRECIONAMENTO-EXECUCAO.md) — checklists de
 * competências sem busca (Mentoria/Trilhas) ganham input de filtro local
 * quando o catálogo passa de 20 itens. Abaixo disso, o campo nem aparece —
 * não vale a pena filtrar 3 opções.
 */

const fetchMock = vi.fn();

const MANY_COMPETENCIES: Competency[] = Array.from({ length: 25 }, (_, i) => ({
  id: `comp-${i}`,
  name: i === 7 ? "Observabilidade e SRE" : `Competência ${String(i).padStart(2, "0")}`,
  capabilityId: "cloud",
  requirementType: "NON_RESTRICTIVE",
  expected: {
    "arquiteto-de-solucoes-i": 2,
    "arquiteto-de-solucoes-ii": 3,
    "arquiteto-de-solucoes-iii": 4,
  },
  active: true,
}));

const manyCompetenciesState: AppState = { ...fixtureState, competencies: MANY_COMPETENCIES };

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

function mockFetch(state: AppState) {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
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
}

const MentoringPage = MentoringRoute.options.component as () => ReactNode;
const LearningPage = LearningRoute.options.component as () => ReactNode;

describe("Checklists de competências — busca local acima de 20 itens (R2-ESC-07)", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("Mentoria: acima de 20 competências, filtro aparece e restringe a lista", async () => {
    mockFetch(manyCompetenciesState);
    render(
      <Wrapper>
        <MentoringPage />
      </Wrapper>,
    );

    await userEvent.click(await screen.findByRole("button", { name: "Registrar sessão" }));
    const filtro = await screen.findByLabelText("Buscar competência…");

    expect(screen.getByText("Observabilidade e SRE")).toBeTruthy();
    expect(screen.getByText("Competência 00")).toBeTruthy();

    await userEvent.type(filtro, "observabilidade");

    expect(screen.getByText("Observabilidade e SRE")).toBeTruthy();
    expect(screen.queryByText("Competência 00")).toBeNull();
  });

  it("Mentoria: abaixo de 20 competências (fixture padrão), o filtro nem aparece", async () => {
    mockFetch(fixtureState);
    render(
      <Wrapper>
        <MentoringPage />
      </Wrapper>,
    );

    await userEvent.click(await screen.findByRole("button", { name: "Registrar sessão" }));
    await screen.findByText("Kubernetes");

    expect(screen.queryByLabelText("Buscar competência…")).toBeNull();
  });

  it("Trilhas: acima de 20 competências, filtro aparece na criação de trilha", async () => {
    mockFetch(manyCompetenciesState);
    render(
      <Wrapper>
        <LearningPage />
      </Wrapper>,
    );

    await userEvent.click(await screen.findByRole("button", { name: "Nova trilha" }));
    const filtro = await screen.findByLabelText("Buscar competência…");

    expect(screen.getByText("Observabilidade e SRE")).toBeTruthy();
    expect(screen.getByText("Competência 00")).toBeTruthy();

    await userEvent.type(filtro, "observabilidade");

    expect(screen.getByText("Observabilidade e SRE")).toBeTruthy();
    expect(screen.queryByText("Competência 00")).toBeNull();
  });
});
