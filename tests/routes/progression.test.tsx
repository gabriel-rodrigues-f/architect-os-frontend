import { cleanup, screen, within } from "@testing-library/react";
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

import { Route as ProgressionRoute } from "@/routes/progression";
import { type AppState } from "@/lib/api";
import type { Assessment, Competency } from "@/lib/domain";
import { fixtureAdminUser, fixtureState } from "../helpers/fixtures";
import { renderWithApp } from "../helpers/render-app";
import { apiPath } from "@/lib/api-path";

/**
 * `/progression` (Mapa de Calor + Tabela de Gaps de Progressão + Nível
 * III) saiu do fim de `/gap-analysis` pra sua própria aba — apontado ao
 * vivo que empurrava a página de Prioridades (Radar + ranking por pessoa)
 * pra baixo, misturando duas granularidades diferentes na mesma rolagem.
 * Estes casos testavam essas seções em `gap-analysis-restructure.test.tsx`
 * antes da separação; movidos pra cá junto com o conteúdo.
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

/** OO3-11/D-7 — providers compartilhados em `render-app.tsx` (`renderWithApp`). */

const ProgressionPage = ProgressionRoute.options.component as () => ReactNode;

const renderProgression = () => renderWithApp(<ProgressionPage />);

describe("Progressão — heatmap, tabela e maestria", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);

    fetchMock.mockImplementation((url: string) => {
      if (String(url).endsWith(apiPath("/auth/me"))) {
        return Promise.resolve(
          new Response(JSON.stringify(fixtureAdminUser), {
            status: 200,
            headers: { "content-type": "application/json" },
          }),
        );
      }
      if (String(url).endsWith(apiPath("/state"))) {
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

  it("a tabela de progressão marca o tipo de cada linha (Bloqueante/Oportunidade)", async () => {
    renderProgression();
    await screen.findByText("Tabela de Gaps de Progressão");

    const progressionTable = screen
      .getByText("Tabela de Gaps de Progressão")
      .closest(".surface-card") as HTMLElement;

    const iacRow = within(progressionTable).getByText("Infra as Code").closest("tr")!;
    expect(iacRow.textContent).toContain("Bloqueante");

    const iamRow = within(progressionTable).getByText("IAM").closest("tr")!;
    expect(iamRow.textContent).toContain("Oportunidade");
  });

  it("Nível III (MASTERY) some da tabela de progressão e aparece só na seção de maestria, sem linguagem de bloqueio", async () => {
    renderProgression();
    await screen.findByText("Tabela de Gaps de Progressão");

    const progressionTable = screen
      .getByText("Tabela de Gaps de Progressão")
      .closest(".surface-card")!;
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

  /** ENT-09-016 — cabeçalho fixo nas tabelas que crescem com o time/catálogo. */
  it("o cabeçalho da tabela de progressão e do heatmap fica fixo ao rolar (sticky)", async () => {
    renderProgression();
    await screen.findByText("Tabela de Gaps de Progressão");

    const progressionTable = screen
      .getByText("Tabela de Gaps de Progressão")
      .closest(".surface-card") as HTMLElement;
    const competencyHeader = within(progressionTable).getByRole("columnheader", {
      name: "Competência",
    });
    expect(competencyHeader.className).toContain("sticky");

    const architectHeader = screen.getByRole("columnheader", { name: "Arquiteto" });
    expect(architectHeader.className).toContain("sticky");
  });

  /**
   * B-12 (AUDITORIA-FINAL-ENTERPRISE-SYNAPSE-2026-08-22.md, P1) — mesmo
   * hook compartilhado de `/gap-analysis`; confirma que `/progression`
   * também respeita `?selected=` vindo da URL, não só o time inteiro.
   */
  it("abrir a tela com ?selected= na URL respeita o recorte", async () => {
    window.history.replaceState(null, "", "/progression?selected=ana");
    renderProgression();
    await screen.findByText("Tabela de Gaps de Progressão");

    const heatmap = screen.getByRole("columnheader", { name: "Arquiteto" }).closest("table")!;
    expect(heatmap.textContent).toContain("Ana Martins");
    expect(heatmap.textContent).not.toContain("Bruno Almeida");
  });
});
