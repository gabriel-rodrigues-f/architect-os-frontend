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
import {
  fixtureMemberUser,
  fixtureUnassignedTechLeadUser,
  scopedFixtureStateFor,
} from "../helpers/fixtures";
import { mockAppFetch } from "../helpers/render-app";
import { renderCareerFile } from "../helpers/ficha";

/**
 * DUAS NEGATIVAS DIFERENTES, E CADA UMA TEM O SEU DONO.
 *
 * Onda 10, T7: desde o roster fechado (backend `d1edba4`) o perfil fora do
 * escopo não chega no payload, e a negação passou a ser o estado "não
 * encontrado" QUE A TELA JÁ TEM. Isso valia para todo mundo — a Visão geral
 * era a única aba sem guarda.
 *
 * A Visão geral GANHOU a guarda (a mesma das outras três abas) quando as
 * listagens por pessoa passaram a responder `200 []` no lugar de `403`: sem
 * ela, a ficha abriria ZERADA sobre alguém que quem olha não alcança. Então as
 * duas negativas se separam:
 *
 *  - quem NÃO ALCANÇA a pessoa nem pelo papel — o profissional na ficha de
 *    outra pessoa — não abre a ficha: lê a negativa de alcance;
 *  - quem alcança pelo papel e não tem a pessoa no estado recortado continua
 *    caindo no "não encontrado" da própria tela, e é ele que este arquivo
 *    fixa nos dois idiomas (a prova de que o texto vem do i18n,
 *    `arch.notFound`, e não de string presa em português no componente).
 */
const fetchMock = vi.fn();

const ProfilePage = ProfileRoute.options.component as () => ReactNode;

describe("perfil fora do escopo, para quem alcança pelo papel: 'não encontrado' da própria tela", () => {
  beforeEach(() => {
    window.localStorage.setItem("synapse:locale", "pt");
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    mockAppFetch(fetchMock, {
      user: fixtureUnassignedTechLeadUser,
      state: scopedFixtureStateFor(fixtureUnassignedTechLeadUser),
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("tech lead em /professionals/bruno vê 'Profissional não encontrado.' com caminho de volta", async () => {
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

describe("perfil fora do escopo, para quem não alcança nem pelo papel: a negativa da ficha", () => {
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

  it("member em /professionals/bruno não abre a ficha — a Visão geral também é guardada", async () => {
    renderCareerFile(<ProfilePage />, { professionalId: "bruno" });

    expect(
      await screen.findByText(
        "A ficha de carreira de uma pessoa é dela e de quem a lidera por vínculo.",
      ),
    ).toBeTruthy();
    expect(screen.queryByText(/Profissional não encontrado\./)).toBeNull();
  });
});
