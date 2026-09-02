import { cleanup, screen } from "@testing-library/react";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** Mesma razão de `lideranca-nega-o-profissional.test.tsx`: `<Link>` exige RouterProvider real. */
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

import type { SessionUser } from "@/lib/api";
import { Route as CapabilityMapRoute } from "@/routes/capability-map";
import { Route as CompareRoute } from "@/routes/compare";
import { Route as GapAnalysisRoute } from "@/routes/gap-analysis";
import { Route as ProgressionRoute } from "@/routes/progression";
import { Route as TrainingNeedsRoute } from "@/routes/training-needs";
import {
  fixtureAdminUser,
  fixtureMemberUser,
  fixtureState,
  fixtureUnassignedTechLeadUser,
  scopedFixtureStateFor,
} from "../helpers/fixtures";
import { mockAppFetch, renderWithApp } from "../helpers/render-app";

/**
 * O gêmeo de tela das cinco rotas de ANÁLISE DO TIME — a metade que a
 * guarda de navegação não cobre.
 *
 * Achado (4) da revisão de PO (2026-09-02): as cinco telas saíram do menu
 * do profissional na onda 31 e "ficaram na URL, com os números dele
 * dentro" — /progression abria com o mapa de calor dos níveis dele,
 * /gap-analysis com o radar atual × esperado, /capability-map com "13
 * capacidade(s) dependem de poucas pessoas" (alarme sobre ele mesmo).
 * Tirar do menu não fecha a URL (a lição da onda 17), e o `beforeLoad` é
 * CEGO À SESSÃO no SSR. A barreira que sobra é esta: a tela nega, e
 * nenhum número dele é desenhado.
 *
 * O alcance é `canAnalyzeTeam` (= quem lidera, com ou sem vínculo): o tech
 * lead SEM vínculo continua abrindo as cinco — a régua não muda para ele.
 *
 * `tests/architecture/alcance-por-rota.test.ts` exige este arquivo de toda
 * rota declarada `analise-de-time`.
 */
const fetchMock = vi.fn();

const ANALISE_LEITURA_DE_LIDERANCA = "A análise do time é uma leitura de liderança.";

const TELAS: ReadonlyArray<{ rota: string; titulo: string; Page: () => ReactNode }> = [
  {
    rota: "/progression",
    titulo: "Progressão do Time",
    Page: ProgressionRoute.options.component as () => ReactNode,
  },
  {
    rota: "/gap-analysis",
    titulo: "Prioridades de Desenvolvimento",
    Page: GapAnalysisRoute.options.component as () => ReactNode,
  },
  {
    rota: "/training-needs",
    titulo: "Necessidades de Treinamento do Time",
    Page: TrainingNeedsRoute.options.component as () => ReactNode,
  },
  {
    rota: "/capability-map",
    titulo: "De quem o time depende",
    Page: CapabilityMapRoute.options.component as () => ReactNode,
  },
  {
    rota: "/compare",
    titulo: "Comparativo de Profissionais",
    Page: CompareRoute.options.component as () => ReactNode,
  },
];

function renderAs(user: SessionUser, page: ReactNode) {
  mockAppFetch(fetchMock, {
    user,
    state: user === fixtureAdminUser ? fixtureState : scopedFixtureStateFor(user),
  });
  return renderWithApp(page);
}

describe("as cinco telas de análise do time negam o profissional — a tela é a última barreira", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it.each(TELAS)(
    "$rota: o member recebe a negativa, e nenhum número dele é desenhado",
    async ({ Page }) => {
      const { container } = renderAs(fixtureMemberUser, <Page />);

      expect(await screen.findByText(ANALISE_LEITURA_DE_LIDERANCA)).toBeTruthy();
      expect([...container.querySelectorAll("figure, [role='img'], table")]).toEqual([]);
      expect(screen.queryByText("Ana Martins")).toBeNull();
    },
  );

  it.each(TELAS)("$rota: a tela negada continua se explicando — o ? está lá", async ({ Page }) => {
    renderAs(fixtureMemberUser, <Page />);
    await screen.findByText(ANALISE_LEITURA_DE_LIDERANCA);
    expect(screen.getByRole("button", { name: /como usar/i })).toBeTruthy();
  });

  it.each(TELAS)(
    "$rota: o tech lead sem vínculo continua alcançando — o alcance é o papel",
    async ({ Page, titulo }) => {
      renderAs(fixtureUnassignedTechLeadUser, <Page />);

      expect(await screen.findByRole("heading", { level: 1, name: titulo })).toBeTruthy();
      expect(screen.queryByText(ANALISE_LEITURA_DE_LIDERANCA)).toBeNull();
    },
  );

  it.each(TELAS)(
    "$rota: o admin alcança — para os outros papéis nada muda",
    async ({ Page, titulo }) => {
      renderAs(fixtureAdminUser, <Page />);

      expect(await screen.findByRole("heading", { level: 1, name: titulo })).toBeTruthy();
      expect(screen.queryByText(ANALISE_LEITURA_DE_LIDERANCA)).toBeNull();
    },
  );
});
