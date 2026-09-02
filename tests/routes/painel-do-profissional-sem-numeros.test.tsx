import { cleanup, screen } from "@testing-library/react";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** Mesma razão de `dashboard-roles.test.tsx`: `<Link>` exige RouterProvider real. */
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
import type { SessionUser } from "@/lib/api";
import {
  fixtureAdminUser,
  fixtureMemberUser,
  fixtureState,
  scopedFixtureStateFor,
} from "../helpers/fixtures";
import { mockAppFetch, renderWithApp } from "../helpers/render-app";

/**
 * Onda 33 — achado (4) da revisão de PO (2026-09-02): a decisão do dono
 * "o profissional não vê os próprios números de avaliação" estava executada
 * pela metade. A ficha e as colunas do líder já se escondiam, mas o PAINEL
 * dele mostrava "Perfil por capacidade — Atual 4.83 / Esperado 4.83" e
 * "Segurança de APIs e Redes L1 → 4 Distância 3 · Crítico".
 *
 * O que sai do Painel do profissional: o radar e a lista de prioridades com
 * nível e distância. O que fica: a situação da avaliação (texto), as
 * evidências pendentes, Meu PDI, Minhas Trilhas e Minhas evidências. O
 * Painel dos outros papéis não muda — o admin continua com as prioridades.
 *
 * A prova é no DOM: a fixture tem avaliação concluída da Ana com distância
 * aberta, então o radar e a lista TERIAM o que desenhar. Nasceu vermelho.
 */
const fetchMock = vi.fn();

const DashboardPage = DashboardRoute.options.component as () => ReactNode;

const NIVEL = /^L[1-5]\b/;
const DISTANCIA = /Distância \d/;

function renderAs(user: SessionUser) {
  mockAppFetch(fetchMock, {
    user,
    state: user === fixtureAdminUser ? fixtureState : scopedFixtureStateFor(user),
  });
  return renderWithApp(<DashboardPage />);
}

describe("Painel do profissional — sem radar, sem nível, sem distância", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("o radar 'Perfil por capacidade' não é desenhado para o profissional", async () => {
    const { container } = renderAs(fixtureMemberUser);
    await screen.findByText("Minha Evolução");
    await screen.findByText("Meu PDI");

    expect(screen.queryByText("Perfil por capacidade")).toBeNull();
    expect([...container.querySelectorAll("figure, [role='img']")]).toEqual([]);
  });

  it("a lista de prioridades com nível e distância não aparece para o profissional", async () => {
    renderAs(fixtureMemberUser);
    await screen.findByText("Minha Evolução");
    await screen.findByText("Meu PDI");

    expect(screen.queryByText("Principais Prioridades de Desenvolvimento")).toBeNull();
    expect(screen.queryAllByText(NIVEL)).toEqual([]);
    expect(screen.queryAllByText(DISTANCIA)).toEqual([]);
  });

  it("o que é dele para agir continua no Painel", async () => {
    renderAs(fixtureMemberUser);
    await screen.findByText("Minha Evolução");

    expect(await screen.findByText("Avaliação")).toBeTruthy();
    expect(screen.getByText("Evidências pendentes")).toBeTruthy();
    expect(screen.getByText("Meu PDI")).toBeTruthy();
    expect(screen.getByText("Minhas Trilhas")).toBeTruthy();
    expect(screen.getByText("Minhas evidências")).toBeTruthy();
  });

  it("o Painel do admin não muda — as prioridades do time continuam lá", async () => {
    renderAs(fixtureAdminUser);
    await screen.findByText("Painel de Capacidades");

    expect(await screen.findByText("Principais Prioridades de Desenvolvimento")).toBeTruthy();
  });
});
