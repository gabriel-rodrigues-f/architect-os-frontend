import { cleanup, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `<Link>` do TanStack Router precisa de um `RouterProvider` real; a tela de
 * Time usa `<Link>` nos cards. Troca por âncora comum — não é o que se testa.
 */
vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    Link: ({
      children,
      to: _to,
      params: _params,
      ...rest
    }: ComponentProps<"a"> & { to?: string; params?: unknown }) => <a {...rest}>{children}</a>,
  };
});

import { Route as TeamRoute } from "@/routes/team";
import { fixtureAdminUser, fixtureCareerLevels, fixtureState } from "./fixtures";
import { jsonResponse, mockAppFetch, renderWithApp } from "./render-app";

/**
 * CFG-01 (SPEC-OO3-13-HARDCODED-CONFIG.md, A5) — guard rail: as opções de
 * nível de carreira dos formulários vêm de `GET /api/career-levels`
 * (tabela `career_levels`, por `rank`), nunca de um array literal. Com o
 * `ROLES` hardcoded de antes, um 4º nível cadastrado na tabela jamais
 * apareceria (era impossível: o array fixo tinha sempre 3) — este teste
 * serve 4 níveis e exige 4 opções.
 */
const fourLevels = [
  ...fixtureCareerLevels,
  { id: "arquiteto-de-solucoes-iv", name: "Arquiteto de Soluções IV", rank: 4 },
];

const fetchMock = vi.fn();

const TeamPage = TeamRoute.options.component as () => ReactNode;

describe("Time — níveis de carreira vêm de career_levels, não de array fixo", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    mockAppFetch(fetchMock, {
      user: fixtureAdminUser,
      state: fixtureState,
      routes: [
        (href) => (href.endsWith("/api/career-levels") ? jsonResponse(fourLevels) : undefined),
        (href) => (href.endsWith("/api/auth/users") ? jsonResponse([]) : undefined),
      ],
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("o select de cargo do cadastro oferece os 4 níveis carregados, em ordem de rank", async () => {
    renderWithApp(<TeamPage />);
    await screen.findByText("Ana Martins");

    await userEvent.click(screen.getByRole("button", { name: "Cadastrar arquiteto" }));
    const select = (await screen.findByLabelText("Cargo")) as HTMLSelectElement;
    expect(Array.from(select.options).map((o) => o.textContent)).toEqual([
      "Arquiteto de Soluções I",
      "Arquiteto de Soluções II",
      "Arquiteto de Soluções III",
      "Arquiteto de Soluções IV",
    ]);
    // O nível padrão do cadastro é o primeiro nível real (menor rank).
    expect(select.value).toBe("Arquiteto de Soluções I");
  });

  it("o diálogo de transição de nível oferece os 4 níveis carregados", async () => {
    renderWithApp(<TeamPage />);
    await screen.findByText("Ana Martins");

    await userEvent.click(
      screen.getByRole("button", { name: "Mudar nível de carreira de Ana Martins" }),
    );
    const select = (await screen.findByLabelText("Novo nível")) as HTMLSelectElement;
    expect(Array.from(select.options).map((o) => o.textContent)).toEqual([
      "Arquiteto de Soluções I",
      "Arquiteto de Soluções II",
      "Arquiteto de Soluções III",
      "Arquiteto de Soluções IV",
    ]);
  });

  it("o roster não some enquanto o filtro de nível nasce dos dados (todos selecionados por padrão)", async () => {
    renderWithApp(<TeamPage />);
    // Se o filtro nascesse de uma lista ainda vazia (em vez de "todos"),
    // ninguém apareceria — Ana Martins presente prova o padrão são.
    expect(await screen.findByText("Ana Martins")).toBeTruthy();
  });
});
