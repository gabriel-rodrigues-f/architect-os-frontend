import { cleanup, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Mesma razão de `evolution-filters-select.test.tsx`: a tela lê
 * `Route.useParams()`, que só existe dentro de uma árvore de rotas montada.
 * Aqui o parâmetro é fixado em "bruno" — o profissional que o payload recortado
 * de um member NÃO contém.
 */
vi.mock("@tanstack/react-router", () =>
  import("../helpers/ficha-router").then((mod) => mod.reactRouterOfCareerFile()),
);

import { Route as ProfileRoute } from "@/routes/professionals.$professionalId.index";
import { fixtureMemberUser, scopedFixtureStateFor } from "../helpers/fixtures";
import { mockAppFetch } from "../helpers/render-app";
import { renderCareerFile } from "../helpers/ficha";

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

  it("member em /professionals/bruno vê 'Profissional não encontrado.' com caminho de volta", async () => {
    renderCareerFile(<ProfilePage />, { professionalId: "bruno" });

    expect(await screen.findByText(/Profissional não encontrado\./)).toBeTruthy();
    expect(screen.getByText(/Voltar/)).toBeTruthy();
  });

  it("o texto do estado 'não encontrado' segue o idioma da interface", async () => {
    window.localStorage.setItem("synapse:locale", "en");
    renderCareerFile(<ProfilePage />, { professionalId: "bruno" });

    expect(await screen.findByText(/Professional not found\./)).toBeTruthy();
    expect(screen.queryByText(/Profissional não encontrado\./)).toBeNull();
  });
});
