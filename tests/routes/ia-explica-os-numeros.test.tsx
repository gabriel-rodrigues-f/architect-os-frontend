import { cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** Mesma razão de gap-analysis-restructure.test.tsx: `<Link>` exige RouterProvider real. */
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

import { apiPath } from "@/lib/api-path";
import { Route as GapRoute } from "@/routes/gap-analysis";
import { fixtureAdminUser, fixtureState } from "../helpers/fixtures";
import { jsonResponse, mockAppFetch, renderWithApp, type FetchRoute } from "../helpers/render-app";

/**
 * IA-02 chegou à tela. As três promessas que esta rede prende:
 *
 *  1. a explicação é APOIO — se a IA falhar, os números do fechamento de
 *     lacunas continuam na tela, inteiros;
 *  2. ninguém paga chamada de modelo por renderizar — a explicação é pedida
 *     SOB DEMANDA, no clique;
 *  3. o leitor sabe que aquele texto foi GERADO, não calculado.
 */
const fetchMock = vi.fn();

const EXPLANATION_PATH = apiPath("/analytics/gap-closure/explanation");
const CLOSURE_PATH = apiPath("/analytics/gap-closure");

const fechamentoDeLacunas = {
  waterfall: {
    from: { cycleId: "2026-h1", cycleName: "2026 H1", totalGap: 18, pairCount: 12 },
    to: { cycleId: "2026-h2", cycleName: "2026 H2", totalGap: 11, pairCount: 12 },
    movements: [
      { kind: "CLOSED", pairCount: 4, amount: -5 },
      { kind: "REDUCED", pairCount: 2, amount: -3 },
      { kind: "OPENED", pairCount: 1, amount: 1 },
      { kind: "STABLE", pairCount: 5, amount: 0 },
    ],
  },
  velocity: {
    fromCycleId: "2026-h1",
    toCycleId: "2026-h2",
    gapsOpenAtStart: 8,
    gapsClosed: 4,
    gapsOpened: 1,
    netClosed: 3,
    closureRate: 0.5,
    elapsedDays: 90,
    closedPerDay: 0.0444,
  },
};

const explicacao = {
  subject: "fechamento de lacunas entre ciclos",
  text: "O time fechou 4 lacunas e abriu 1 entre os dois ciclos, com saldo de 3 a menos.",
};

const closureRoute: FetchRoute = (href) =>
  href.includes(CLOSURE_PATH) && !href.includes(EXPLANATION_PATH)
    ? jsonResponse(fechamentoDeLacunas)
    : undefined;

const closureQuebrada: FetchRoute = (href) =>
  href.includes(CLOSURE_PATH) && !href.includes(EXPLANATION_PATH)
    ? jsonResponse({ code: "INTERNAL_ERROR", message: "falhou" }, 500)
    : undefined;

const explanationRoute: FetchRoute = (href) =>
  href.includes(EXPLANATION_PATH) ? jsonResponse(explicacao) : undefined;

const explanationIndisponivel: FetchRoute = (href) =>
  href.includes(EXPLANATION_PATH)
    ? jsonResponse(
        {
          code: "ANALYTICS_EXPLANATION_UNAVAILABLE",
          message: "A explicação em linguagem natural está indisponível no momento.",
          correlationId: "cid-1",
        },
        503,
      )
    : undefined;

const GapPage = GapRoute.options.component as () => ReactNode;

const chamadasDeExplicacao = (): number =>
  fetchMock.mock.calls.filter(([input]) => String(input).includes(EXPLANATION_PATH)).length;

const renderGap = (routes: FetchRoute[]) => {
  mockAppFetch(fetchMock, { user: fixtureAdminUser, state: fixtureState, routes });
  renderWithApp(<GapPage />);
};

const botaoExplicar = () => screen.getByRole("button", { name: /explicar os números/i });

describe("a explicação por IA acompanha os números do fechamento de lacunas", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("mostra os números sem gastar uma única chamada de IA", async () => {
    renderGap([closureRoute, explanationRoute]);

    await screen.findByText("2026 H1");
    expect(screen.getByText("2026 H2")).toBeTruthy();
    expect(chamadasDeExplicacao()).toBe(0);
  });

  it("só pede a explicação quando alguém clica, e diz que o texto foi gerado por IA", async () => {
    renderGap([closureRoute, explanationRoute]);

    await screen.findByText("2026 H1");
    expect(screen.queryByText(explicacao.text)).toBeNull();

    await userEvent.click(botaoExplicar());

    await screen.findByText(explicacao.text);
    expect(chamadasDeExplicacao()).toBe(1);
    expect(screen.getByText(/gerad[ao] por inteligência artificial/i)).toBeTruthy();
  });

  it("com a IA indisponível, os números continuam inteiros na tela", async () => {
    renderGap([closureRoute, explanationIndisponivel]);

    await screen.findByText("2026 H1");
    await userEvent.click(botaoExplicar());

    await screen.findByText(/não foi possível gerar a explicação/i);
    expect(screen.getByText("2026 H1")).toBeTruthy();
    expect(screen.getByText("2026 H2")).toBeTruthy();
    expect(screen.getAllByText("4").length).toBeGreaterThan(0);
  });

  it("sem os números não há o que explicar: o botão nem aparece", async () => {
    renderGap([closureQuebrada, explanationRoute]);

    await screen.findByText(/não foi possível carregar o fechamento de lacunas/i);
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: /explicar os números/i })).toBeNull();
    });
    expect(chamadasDeExplicacao()).toBe(0);
  });
});
