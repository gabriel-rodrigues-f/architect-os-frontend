import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
import { type AppState } from "../api";
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
    "arquiteto-de-solucoes-i": 2,
    "arquiteto-de-solucoes-ii": 4,
    "arquiteto-de-solucoes-iii": 5,
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
    window.history.replaceState(null, "", "/");
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

  /**
   * ORIENTACAO-NONA-RODADA-FECHAMENTO, Seção 36 (A3) — mais de uma pessoa
   * com a mesma lacuna: os nomes aparecem todos (não só o primeiro), e a
   * contagem de pessoas bate com a quantidade de nomes únicos.
   */
  it("mostra todos os nomes quando mais de uma pessoa tem a mesma lacuna", async () => {
    const carlaState: AppState = {
      ...state,
      architects: [
        ...state.architects,
        {
          id: "carla",
          name: "Carla Souza",
          role: "Arquiteto de Soluções II",
          yearsAsArchitect: 5,
          specialization: "Dados",
          email: "carla@company.com",
          active: true,
          version: 1,
        },
      ],
      assessments: [
        ...state.assessments,
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
            { competencyId: "security-iam", self: 2, leader: 2, target: 3, final: 2, comments: [] },
          ],
        },
      ],
    };
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
          new Response(JSON.stringify(carlaState), {
            status: 200,
            headers: { "content-type": "application/json" },
          }),
        );
      }
      return Promise.resolve(new Response("{}", { status: 200 }));
    });

    renderGap();
    await screen.findByText("Oportunidades de desenvolvimento");

    const opportunitySection = screen
      .getByText("Oportunidades de desenvolvimento")
      .closest("div") as HTMLElement;
    // IAM tem gap para Ana e Carla (2 pessoas) — os dois nomes aparecem, não só o primeiro.
    expect(within(opportunitySection).getByText(/Ana Martins/)).toBeTruthy();
    expect(within(opportunitySection).getByText(/Carla Souza/)).toBeTruthy();
    expect(within(opportunitySection).getByText(/2 pessoa\(s\)/)).toBeTruthy();
  });

  it("o radar inclui uma coluna de cobertura na tabela equivalente acessível", async () => {
    renderGap();
    await screen.findByText("Radar de Arquitetura");
    expect(screen.getByRole("columnheader", { name: "Cobertura" })).toBeTruthy();
  });

  /**
   * B-12 (AUDITORIA-FINAL-ENTERPRISE-SYNAPSE-2026-08-22.md, P1) — trocar o
   * recorte de arquitetos escreve na URL (não só em memória), para que F5 e
   * links copiados preservem o filtro em vez de sempre voltar ao time
   * inteiro.
   */
  it("trocar a seleção no filtro escreve o recorte na URL", async () => {
    renderGap();
    await screen.findByText("Radar de Arquitetura");

    // Time inteiro nasce selecionado — desmarcar Bruno deixa só Ana.
    await userEvent.click(screen.getByRole("button", { expanded: false }));
    await userEvent.click(screen.getByRole("option", { name: "Bruno Almeida" }));

    expect(window.location.search).toBe("?selected=ana");
  });

  it("abrir a tela com ?selected= na URL respeita o recorte, sem cair no time inteiro", async () => {
    window.history.replaceState(null, "", "/gap-analysis?selected=bruno");
    renderGap();
    await screen.findByText("Radar de Arquitetura");

    const scopeChip = screen.getByRole("button", { expanded: false });
    expect(scopeChip.textContent).toContain("Bruno Almeida");
    expect(scopeChip.textContent).not.toContain("Todo o time");
  });
});
