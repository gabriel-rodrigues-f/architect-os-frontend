import { cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `<Link>` do TanStack Router precisa de um `RouterProvider` real (a árvore
 * de rotas inteira) para resolver `to="/architects/$architectId"`. A tela de
 * Time usa `<Link>` nos cards; troca por âncora comum — não é o que se testa.
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
import { fixtureAdminUser, fixtureState } from "../helpers/fixtures";
import { emptyAuthUsersRoute, mockAppFetch, renderWithApp } from "../helpers/render-app";
import { apiPath } from "@/lib/api-path";

/**
 * ONDA 37 — DESATIVAR saiu daqui: virou um ato só (conta + profissional) no
 * menu Usuários, porque o dono tirou o botão desta tela. O que ficou é
 * REATIVAR, e ficou por necessidade declarada: /team é o único lugar com o
 * filtro "Inativos" (exceção registrada na fatia `inativo-some`), então sem
 * este botão a desativação seria irreversível pela interface.
 *
 * Este arquivo cobria os dois; a metade de desativação vive agora em
 * `users-desativar-e-um-ato-so.test.tsx`, contra a tela onde o dono a pôs.
 */

const fetchMock = vi.fn();

const TeamPage = TeamRoute.options.component as () => ReactNode;

const ana = fixtureState.architects[0];
if (!ana) throw new Error("fixture sem Ana");

const comAnaInativa = {
  ...fixtureState,
  architects: fixtureState.architects.map((architect) =>
    architect.id === ana.id ? { ...architect, active: false } : architect,
  ),
};

describe("Time — reativar devolve a pessoa ao roster ativo", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    mockAppFetch(fetchMock, {
      user: fixtureAdminUser,
      state: comAnaInativa,
      routes: [
        emptyAuthUsersRoute,
        (href, init) => {
          if (init?.method === "PATCH" && href.includes(apiPath("/architects/"))) {
            const body = JSON.parse(String(init.body)) as { active: boolean };
            return new Response(JSON.stringify({ ...ana, ...body }), {
              status: 200,
              headers: { "content-type": "application/json" },
            });
          }
          return undefined;
        },
      ],
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  /**
   * O filtro de Status virou composição por caixinha (`MultiSelectFilter`):
   * marcar "Inativos" ADICIONA à seleção, que já tinha "Ativos" por padrão.
   */
  const incluirInativos = async () => {
    await userEvent.click(screen.getByLabelText("Status"));
    await userEvent.click(await screen.findByRole("option", { name: "Inativos" }));
    await userEvent.keyboard("{Escape}");
  };

  it("a pessoa inativa é encontrada pelo filtro e volta com um clique", async () => {
    renderWithApp(<TeamPage />);
    await screen.findByText("Bruno Almeida");
    expect(screen.queryByText("Ana Martins")).toBeNull();

    await incluirInativos();
    await userEvent.click(await screen.findByLabelText("Reativar Ana Martins"));

    await waitFor(() => expect(screen.queryByLabelText("Reativar Ana Martins")).toBeNull());
    expect(screen.getByText("Ana Martins")).toBeTruthy();

    const patches = fetchMock.mock.calls.filter(([, init]) => init?.method === "PATCH");
    expect(patches).toHaveLength(1);
    expect(JSON.parse(String((patches[0]?.[1] as RequestInit).body))).toEqual({ active: true });
  });

  it("a linha da pessoa inativa não oferece desativar de novo — o ato mora em Usuários", async () => {
    renderWithApp(<TeamPage />);
    await screen.findByText("Bruno Almeida");
    await incluirInativos();
    await screen.findByText("Ana Martins");

    expect(screen.queryByLabelText("Desativar Ana Martins")).toBeNull();
  });
});
