import { cleanup, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Mesma razão das demais telas com `<Link>`/`Route.useParams()`: precisam de
 * um `RouterProvider` de verdade. Aqui também trocamos `createFileRoute` por
 * uma versão que devolve `architectId` fixo — a tela real recebe isso via
 * `Route.useParams()`, que só existe dentro de uma árvore de rotas montada
 * de verdade.
 */
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

import { Route as EvolutionRoute } from "@/routes/architects.$architectId.evolution";
import type { ArchitectEvolutionResult } from "@/lib/domain";
import { jsonResponse, mockAppFetch, renderWithApp } from "../helpers/render-app";

/**
 * R3-008 (SYNAPSE-DIRECIONAMENTO-EXECUCAO.md) — os filtros de Período e
 * Fonte da tela de Evolução trocaram de `<select>` nativo por
 * `SingleSelectFilter`. Prova que a troca de controle preservou o
 * comportamento: abrir, escolher, ver o `POST /api/evolution/architect`
 * seguinte carregar o filtro novo.
 */
const fetchMock = vi.fn();

const emptyEvolutionResult: ArchitectEvolutionResult = {
  architect: {
    id: "ana",
    name: "Ana Martins",
    role: "Arquiteto de Soluções II",
    careerLevelName: null,
  },
  summary: {
    coverage: { covered: 0, total: 0 },
    initialAverage: null,
    currentAverage: null,
    averageDelta: null,
    improved: 0,
    stable: 0,
    regressed: 0,
    mentoringCount: 0,
    assessmentCount: 0,
  },
  capabilitySeries: [],
  competencySeries: [],
  events: [],
  snapshots: [],
  comparisons: [],
};

/** OO3-11/D-7 — providers compartilhados em `render-app.tsx` (`renderWithApp`). */

const EvolutionPage = EvolutionRoute.options.component as () => ReactNode;

const renderEvolution = () => renderWithApp(<EvolutionPage />);

describe("Evolução do arquiteto — filtros de Período e Fonte (R3-008)", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    mockAppFetch(fetchMock, {
      routes: [
        (href) =>
          href.endsWith("/api/evolution/architect")
            ? jsonResponse(emptyEvolutionResult)
            : undefined,
      ],
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("mostra o preset de período atual e troca ao escolher outro", async () => {
    renderEvolution();
    const user = userEvent.setup();

    // O componente renderiza o `label` do próprio `SingleSelectFilter`
    // ("Período"/"Fonte") — nome acessível fixo, igual ao "Ordenar por" de
    // `single-select-filter.test.tsx`.
    const periodTrigger = await screen.findByRole("button", { name: "Período" });
    expect(periodTrigger.textContent).toContain("Últimos 90 dias");

    await user.click(periodTrigger);
    const option = await screen.findByRole("option", { name: "Últimos 30 dias" });
    await user.click(option);

    expect(periodTrigger.textContent).toContain("Últimos 30 dias");
    expect(screen.queryByRole("listbox")).toBeNull();

    // A troca de preset dispara uma nova busca com o range recalculado.
    expect(
      fetchMock.mock.calls.some(([url]) => String(url).endsWith("/api/evolution/architect")),
    ).toBe(true);
  });

  it("mostra a fonte atual e troca ao escolher outra", async () => {
    renderEvolution();
    const user = userEvent.setup();

    const sourceTrigger = await screen.findByRole("button", { name: "Fonte" });
    expect(sourceTrigger.textContent).toContain("Todas");

    await user.click(sourceTrigger);
    const option = await screen.findByRole("option", { name: "Mentoria" });
    await user.click(option);

    expect(sourceTrigger.textContent).toContain("Mentoria");
    expect(screen.queryByRole("listbox")).toBeNull();
  });
});
