import { cleanup, screen } from "@testing-library/react";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    useRouterState: () => "/architects/ana/evolution",
    Link: ({
      children,
      to: _to,
      params: _params,
      search: _search,
      ...rest
    }: ComponentProps<"a"> & { to?: string; params?: unknown; search?: unknown }) => (
      <a {...rest}>{children}</a>
    ),
    createFileRoute:
      (..._args: unknown[]) =>
      (options: Record<string, unknown>) => ({
        ...options,
        options,
        useParams: () => ({ architectId: "ana" }),
      }),
  };
});

import { Route as ProfileRoute } from "@/routes/architects.$architectId.index";
import { Route as EvolutionRoute } from "@/routes/architects.$architectId.evolution";
import type { ArchitectEvolutionResult } from "@/lib/domain";
import { apiPath } from "@/lib/api-path";
import { fixtureAdminUser, fixtureState } from "../helpers/fixtures";
import { jsonResponse, mockAppFetch, renderWithApp } from "../helpers/render-app";

/**
 * O PO relatou "nível médio 4,36 × 3,38 na mesma pessoa em abas vizinhas".
 * Medido na aplicação viva (Ana Martins, ciclo ativo 2026 H2): a Visão geral
 * e o Painel mostram 4,36 — a avaliação oficial do CICLO ATIVO — e a aba
 * Evolução mostra 3,38, que é o nível no FIM DO PERÍODO filtrado (últimos 90
 * dias), lido do histórico de eventos de nível. São referências diferentes da
 * mesma régua, e nenhuma das telas dizia qual usava.
 *
 * Nesta fixture Cloud tem DUAS competências (4 e 4) e Security tem UMA (2).
 * Isso separa as duas contas possíveis: média por CAPACIDADE dá 3,00 e média
 * por COMPETÊNCIA daria 3,33. O código sempre calculou por capacidade — era o
 * rótulo que dizia "competências". Esta rede prende as duas pontas juntas: o
 * número que sai E a régua que o rótulo anuncia.
 */
const fetchMock = vi.fn();

const ProfilePage = ProfileRoute.options.component as () => ReactNode;
const EvolutionPage = EvolutionRoute.options.component as () => ReactNode;

/** A régua da Evolução é OUTRA: o nível no fim do período filtrado. */
const evolucaoDaAna: ArchitectEvolutionResult = {
  architect: {
    id: "ana",
    name: "Ana Martins",
    role: "Arquiteto de Soluções II",
    careerLevelName: null,
  },
  summary: {
    coverage: { covered: 3, total: 3 },
    initialAverage: 2.45,
    currentAverage: 3.38,
    averageDelta: 0.94,
    improved: 3,
    stable: 0,
    regressed: 0,
    mentoringCount: 0,
    assessmentCount: 1,
  },
  capabilitySeries: [],
  competencySeries: [],
  events: [],
  snapshots: [],
  comparisons: [],
};

const MEDIA_POR_CAPACIDADE = "3.00";
const MEDIA_POR_COMPETENCIA = "3.33";

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/**
 * Onda 31 — o dono tirou do profissional os próprios números (2026-09-01):
 * o Painel do member não mostra mais "Nível médio", e a ficha e a evolução
 * são lidas por quem lidera. As telas comparadas aqui passam a ser as da
 * LIDERANÇA sobre a mesma pessoa — a régua e o número continuam tendo de
 * concordar entre a Visão geral e a Evolução.
 */
describe("Nível médio — cada tela diz qual régua usa", () => {
  it("o Perfil calcula por capacidade e o rótulo anuncia capacidade", async () => {
    mockAppFetch(fetchMock, { user: fixtureAdminUser, state: fixtureState });
    renderWithApp(<ProfilePage />);

    expect(await screen.findByText(MEDIA_POR_CAPACIDADE)).toBeTruthy();
    expect(screen.queryByText(MEDIA_POR_COMPETENCIA)).toBeNull();
    expect(await screen.findByText(/capacidades avaliadas no ciclo atual/)).toBeTruthy();
  });

  it("a ficha não promete média de competências", async () => {
    mockAppFetch(fetchMock, { user: fixtureAdminUser, state: fixtureState });
    const { container } = renderWithApp(<ProfilePage />);

    await screen.findByText(MEDIA_POR_CAPACIDADE);
    expect(container.textContent).not.toContain("Média das competências avaliadas");
  });

  /**
   * O 3,38 da aba Evolução NÃO é o 3,00 do ciclo ativo: é o nível no fim do
   * período filtrado, lido do histórico de eventos. O número é legítimo — o
   * rótulo "atual" é que o fazia disputar com o vizinho. Os KPIs de mentoria
   * e assessment desta mesma fileira já diziam "no período"; a média passa a
   * dizer também.
   */
  it("a Evolução anuncia a régua do PERÍODO, não um 'atual' que disputa com o ciclo", async () => {
    mockAppFetch(fetchMock, {
      user: fixtureAdminUser,
      state: fixtureState,
      routes: [
        (href) =>
          href.endsWith(apiPath("/evolution/architect")) ? jsonResponse(evolucaoDaAna) : undefined,
      ],
    });
    const { container } = renderWithApp(<EvolutionPage />);

    expect(await screen.findByText("3.38")).toBeTruthy();
    expect(await screen.findByText("Nível médio no fim do período")).toBeTruthy();
    expect(container.textContent).not.toContain("Nível médio atual");
  });
});
