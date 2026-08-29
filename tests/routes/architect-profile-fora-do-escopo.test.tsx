import { cleanup, screen } from "@testing-library/react";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Mesma razão de `evolution-filters-select.test.tsx`: a tela lê
 * `Route.useParams()`, que só existe dentro de uma árvore de rotas montada.
 * Aqui o parâmetro é fixado em "bruno" — o arquiteto que o payload recortado
 * de um member NÃO contém.
 */
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
    createFileRoute:
      (..._args: unknown[]) =>
      (options: Record<string, unknown>) => ({
        ...options,
        options,
        useParams: () => ({ architectId: "bruno" }),
      }),
  };
});

import { Route as ProfileRoute } from "@/routes/architects.$architectId.index";
import { fixtureMemberUser, scopedFixtureStateFor } from "../helpers/fixtures";
import { mockAppFetch, renderWithApp } from "../helpers/render-app";

/**
 * Onda 10, T7 — desde o roster fechado (backend `d1edba4`) o perfil fora do
 * escopo não chega mais no payload: a negação se manifesta como o estado
 * "não encontrado" QUE A TELA JÁ TEM, não como redirect da guarda (morta e
 * removida nesta fatia). Este teste fixa essa UX contra o payload recortado
 * real, nos dois idiomas — a versão em inglês também prova que o texto vem
 * do i18n (`arch.notFound`), não de string presa em português no componente.
 */
const fetchMock = vi.fn();

const ProfilePage = ProfileRoute.options.component as () => ReactNode;

describe("perfil fora do escopo cai no estado 'não encontrado' da própria tela", () => {
  beforeEach(() => {
    window.localStorage.setItem("synapse:locale", "pt");
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    mockAppFetch(fetchMock, {
      user: fixtureMemberUser,
      state: scopedFixtureStateFor(fixtureMemberUser),
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("member em /architects/bruno vê 'Arquiteto não encontrado.' com caminho de volta", async () => {
    renderWithApp(<ProfilePage />);

    expect(await screen.findByText(/Arquiteto não encontrado\./)).toBeTruthy();
    expect(screen.getByText(/Voltar/)).toBeTruthy();
  });

  it("o texto do estado 'não encontrado' segue o idioma da interface", async () => {
    window.localStorage.setItem("synapse:locale", "en");
    renderWithApp(<ProfilePage />);

    expect(await screen.findByText(/Architect not found\./)).toBeTruthy();
    expect(screen.queryByText(/Arquiteto não encontrado\./)).toBeNull();
  });
});
