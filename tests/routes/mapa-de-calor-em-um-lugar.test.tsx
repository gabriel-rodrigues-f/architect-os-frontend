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

import { Route as DashboardRoute } from "@/routes/index";
import { Route as ProgressionRoute } from "@/routes/progression";
import { fixtureAdminUser, fixtureAssignedTechLeadUser, fixtureState } from "../helpers/fixtures";
import { mockAppFetch, operationsOverviewRoute, renderWithApp } from "../helpers/render-app";

/**
 * ONDA21/mapa-unico — a matriz pessoa × capacidade era desenhada DUAS vezes,
 * célula a célula igual: no Painel do admin ("Mapa de Calor de Competências do
 * Time") e em /progression ("Mapa de Calor de Gaps do Time"). O segundo título
 * MENTIA: dizia gap e pintava o nível atual, então um 5 — o máximo — se lia
 * como "gap 5", o pior caso possível.
 *
 * O mapa passa a morar em UM lugar: /progression, a única das duas telas que
 * os TRÊS papéis alcançam (o Painel do admin é exclusivo do admin; lead e
 * member têm outra home, sem mapa nenhum — medido na aplicação viva). Apagar
 * o de /progression teria REMOVIDO o mapa para dois papéis de três.
 *
 * O que a Progressão herda do Painel para o admin não perder nada: o nome da
 * pessoa leva ao perfil dela.
 *
 * Revisão de papéis (dono, 2026-09-05): o Painel do admin virou o Painel de
 * operação (D1, só contagens) e a Progressão passou a ser do tech lead
 * vinculado (D5) — o mapa com nome mora onde quem pontua o lê.
 */

const fetchMock = vi.fn();

const DashboardPage = DashboardRoute.options.component as () => ReactNode;
const ProgressionPage = ProgressionRoute.options.component as () => ReactNode;

describe("o mapa de calor mora em um lugar só", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    mockAppFetch(fetchMock, { user: fixtureAssignedTechLeadUser, state: fixtureState });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    window.history.replaceState(null, "", "/");
  });

  it("o Painel do tech lead não desenha a matriz pessoa × capacidade — ela mora na Progressão", async () => {
    renderWithApp(<DashboardPage />);
    await screen.findByText("Ações da Liderança");

    expect(screen.queryByTestId("heatmap-scroll")).toBeNull();
    expect(screen.queryByRole("columnheader", { name: "Profissional" })).toBeNull();
  });

  it("D1 (dono, 2026-09-05): o Painel de operação do admin conta as avaliações do ciclo por estado — sem matriz, sem nome", async () => {
    mockAppFetch(fetchMock, {
      user: fixtureAdminUser,
      state: fixtureState,
      routes: [operationsOverviewRoute],
    });
    renderWithApp(<DashboardPage />);
    await screen.findByText("Visão do Sistema");

    expect(await screen.findByText("Avaliações do ciclo por estado")).toBeTruthy();
    expect(screen.queryByTestId("heatmap-scroll")).toBeNull();
    expect(screen.queryByText("Ana Martins")).toBeNull();
  });

  it("/progression desenha a matriz, e uma só", async () => {
    renderWithApp(<ProgressionPage />);
    await screen.findByTestId("heatmap-scroll");

    expect(screen.getAllByTestId("heatmap-scroll").length).toBe(1);
  });

  it("o título do mapa nomeia o NÍVEL, que é o que a tabela pinta — nunca o gap", async () => {
    renderWithApp(<ProgressionPage />);
    const mapa = await screen.findByTestId("heatmap-scroll");
    const cartao = mapa.closest(".surface-card") as HTMLElement;

    const titulo = within(cartao).getByRole("heading").textContent ?? "";
    expect(titulo).toMatch(/nív(e|ei)/i);
    expect(titulo).not.toMatch(/gap/i);
  });

  it("no mapa da Progressão o nome da pessoa leva ao perfil dela, como levava no Painel", async () => {
    renderWithApp(<ProgressionPage />);
    await screen.findByTestId("heatmap-scroll");

    const linha = screen.getByRole("rowheader", { name: "Ana Martins" });
    // O `<Link>` está mockado sem `to`, então o `<a>` não tem href e não
    // ganha o papel "link" — a âncora em si é o que prova a navegação.
    expect(linha.querySelector("a")?.textContent).toBe("Ana Martins");
  });
});
