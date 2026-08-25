import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

/** Mesma razão de training-needs-intervention.test.tsx: `<Link>` exige RouterProvider real. */
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
import { type AppState } from "../api";
import { AuthProvider, useAuth } from "../auth";
import type { Assessment, AssessmentItem, Competency } from "../domain";
import { I18nProvider } from "../i18n";
import { StoreProvider } from "../store";
import { fixtureAdminUser, fixtureState } from "./fixtures";

/**
 * R2-ESC-08 (SYNAPSE-DIRECIONAMENTO-EXECUCAO.md) — os cortes de "Lacunas
 * agregadas" (15) e "Treinamentos Recomendados" (6) eram silenciosos.
 * Fixture com 16 competências, todas com gap de 3 pessoas, força ambos os
 * cortes ao mesmo tempo.
 */

const fetchMock = vi.fn();

const MANY_COMPETENCIES: Competency[] = Array.from({ length: 16 }, (_, i) => ({
  id: `comp-${i}`,
  name: `Competência ${String(i).padStart(2, "0")}`,
  capabilityId: "cloud",
  requirementType: "NON_RESTRICTIVE",
  expected: {
    "arquiteto-de-solucoes-i": 2,
    "arquiteto-de-solucoes-ii": 3,
    "arquiteto-de-solucoes-iii": 4,
  },
  active: true,
}));

const carla: AppState["architects"][number] = {
  id: "carla",
  name: "Carla Souza",
  role: "Arquiteto de Soluções II",
  yearsAsArchitect: 5,
  specialization: "",
  email: "carla@company.com",
  active: true,
  version: 1,
};

function itemsFor(): AssessmentItem[] {
  return MANY_COMPETENCIES.map((c) => ({
    competencyId: c.id,
    self: 1,
    leader: 1,
    target: 4,
    final: 1,
    comments: [],
  }));
}

function assessmentFor(id: string, architectId: string): Assessment {
  return {
    id,
    architectId,
    cycleId: "2026-h2",
    status: "Completed",
    modelVersion: 1,
    targetCareerLevelId: null,
    targetSemantics: null,
    version: 1,
    items: itemsFor(),
  };
}

const state: AppState = {
  ...fixtureState,
  architects: [...fixtureState.architects, carla],
  competencies: MANY_COMPETENCIES,
  learningPaths: [],
  assessments: [
    assessmentFor("ana-many", "ana"),
    assessmentFor("bruno-many", "bruno"),
    assessmentFor("carla-many", "carla"),
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

describe("Necessidades de Treinamento — cortes declarados (R2-ESC-08)", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  const renderPage = () => {
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
    return render(
      <Wrapper>
        <TrainingNeedsPage />
      </Wrapper>,
    );
  };

  it("Gaps agregados: acima de 15, avisa a contagem e permite ver todas", async () => {
    renderPage();

    expect(
      await screen.findByText(/Mostrando as 15 competências de maior impacto de 16\./),
    ).toBeTruthy();
    expect(screen.queryByText("Competência 15")).toBeNull();

    // Duas seções (agregadas + recomendadas) ultrapassam o limiar ao mesmo
    // tempo, então há dois botões "Mostrar todas" — o da esquerda é este.
    await userEvent.click(screen.getAllByRole("button", { name: "Mostrar todas" })[0]!);

    expect(await screen.findByText(/Mostrando as 16 competências\./)).toBeTruthy();
    expect(screen.getByText("Competência 15")).toBeTruthy();
  });

  it("Treinamentos Recomendados: acima de 6, avisa a contagem e permite ver todas", async () => {
    renderPage();
    await screen.findByText(/Mostrando as 15 competências/);

    expect(screen.getByText(/Mostrando 6 de 16 recomendações\./)).toBeTruthy();

    const buttons = screen.getAllByRole("button", { name: "Mostrar todas" });
    // Um botão por seção (agregadas + recomendadas) — clica no da direita.
    await userEvent.click(buttons[1]!);

    expect(await screen.findByText(/Mostrando as 16 recomendações\./)).toBeTruthy();
  });
});
