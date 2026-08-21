import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, within } from "@testing-library/react";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** Mesma razão de dashboard-roles.test.tsx: `<Link>` exige RouterProvider real. */
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

import { Route as GapRoute } from "@/routes/gap-analysis";
import { setAuthToken, type AppState } from "../api";
import { AuthProvider, useAuth } from "../auth";
import type { Assessment, Competency } from "../domain";
import { I18nProvider } from "../i18n";
import { StoreProvider } from "../store";
import { fixtureAdminUser, fixtureState } from "./fixtures";

/**
 * ORIENTACAO-NONA-RODADA ENT-09-012 — a tela de Gap Analysis restructurada:
 * bloqueante (RESTRICTIVE) e oportunidade (NON_RESTRICTIVE) nunca na mesma
 * lista, e Nível III (MASTERY) nunca tratado como "gap de progressão".
 * Nenhum teste de render existia antes desta rodada.
 */

const fetchMock = vi.fn();

/** Competência restritiva nova, com gap para Ana em 2026-h2 — sem isto, a fixture padrão não tem nenhum bloqueante. */
const restrictiveCompetency: Competency = {
  id: "cloud-iac",
  name: "Infra as Code",
  capabilityId: "cloud",
  requirementType: "RESTRICTIVE",
  expected: {
    "Arquiteto de Soluções I": 2,
    "Arquiteto de Soluções II": 4,
    "Arquiteto de Soluções III": 5,
  },
  active: true,
};

function withBlockingItem(assessment: Assessment): Assessment {
  if (assessment.id !== "ana-h2") return assessment;
  return {
    ...assessment,
    items: [
      ...assessment.items,
      { competencyId: "cloud-iac", self: 2, leader: 2, target: 4, final: 2, comments: [] },
    ],
  };
}

/** bruno-h2 vira MASTERY: já está no topo da carreira, a diferença é aprofundamento, não bloqueio de progressão. */
function asMastery(assessment: Assessment): Assessment {
  if (assessment.id !== "bruno-h2") return assessment;
  return { ...assessment, targetSemantics: "MASTERY" };
}

const state: AppState = {
  ...fixtureState,
  competencies: [...fixtureState.competencies, restrictiveCompetency],
  assessments: fixtureState.assessments.map((a) => asMastery(withBlockingItem(a))),
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

const GapPage = GapRoute.options.component as () => ReactNode;

const renderGap = () =>
  render(
    <Wrapper>
      <GapPage />
    </Wrapper>,
  );

describe("Análise de Lacunas — bloqueante × oportunidade × maestria", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    setAuthToken("token-de-teste");

    fetchMock.mockImplementation((url: string) => {
      if (String(url).endsWith("/api/auth/me")) {
        return Promise.resolve(
          new Response(JSON.stringify(fixtureAdminUser), {
            status: 200,
            headers: { "content-type": "application/json" },
          }),
        );
      }
      if (String(url).endsWith("/api/state")) {
        return Promise.resolve(
          new Response(JSON.stringify(state), {
            status: 200,
            headers: { "content-type": "application/json" },
          }),
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

  it("separa bloqueante de oportunidade em listas distintas", async () => {
    renderGap();
    await screen.findByText("Bloqueantes de progressão");

    const blockingSection = screen.getByText("Bloqueantes de progressão").closest("div")!;
    expect(blockingSection.textContent).toContain("Infra as Code");
    expect(blockingSection.textContent).not.toContain("IAM");

    const opportunitySection = screen.getByText("Oportunidades de desenvolvimento").closest("div")!;
    expect(opportunitySection.textContent).toContain("IAM");
    expect(opportunitySection.textContent).not.toContain("Infra as Code");
  });

  it("a tabela de progressão marca o tipo de cada linha (Bloqueante/Oportunidade)", async () => {
    renderGap();
    await screen.findByText("Tabela de Lacunas de Progressão");

    const progressionTable = screen
      .getByText("Tabela de Lacunas de Progressão")
      .closest(".surface-card") as HTMLElement;

    const iacRow = within(progressionTable).getByText("Infra as Code").closest("tr")!;
    expect(iacRow.textContent).toContain("Bloqueante");

    const iamRow = within(progressionTable).getByText("IAM").closest("tr")!;
    expect(iamRow.textContent).toContain("Oportunidade");
  });

  it("Nível III (MASTERY) some da tabela de progressão e aparece só na seção de maestria, sem linguagem de bloqueio", async () => {
    renderGap();
    await screen.findByText("Tabela de Lacunas de Progressão");

    const progressionTable = screen.getByText("Tabela de Lacunas de Progressão").closest(".surface-card")!;
    // Bruno está em MASTERY neste ciclo — os gaps dele não contam mais como progressão.
    expect(progressionTable.textContent).not.toContain("Kubernetes");

    expect(screen.getByText("Oportunidades de Aprofundamento — Nível III")).toBeTruthy();
    const masterySection = screen
      .getByText("Oportunidades de Aprofundamento — Nível III")
      .closest(".surface-card")!;
    expect(masterySection.textContent).toContain("Kubernetes");
    // Nunca o vocabulário de bloqueio/crítico na seção de maestria.
    expect(masterySection.textContent).not.toContain("Bloqueante");
    expect(masterySection.textContent).not.toContain("Crítico");
  });

  it("o radar inclui uma coluna de cobertura na tabela equivalente acessível", async () => {
    renderGap();
    await screen.findByText("Radar de Arquitetura");
    expect(screen.getByRole("columnheader", { name: "Cobertura" })).toBeTruthy();
  });
});
