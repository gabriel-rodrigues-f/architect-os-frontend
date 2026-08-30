import { createMemoryHistory, createRouter } from "@tanstack/react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { SessionUser } from "@/lib/api";
import { createAppQueryClient } from "@/lib/query-client";
import { routeTree } from "@/routeTree.gen";
import {
  fixtureAdminUser,
  fixtureMemberUser,
  fixtureUnassignedLeadUser,
  scopedFixtureStateFor,
} from "../helpers/fixtures";
import { mockAppFetch } from "../helpers/render-app";

/**
 * ADR-0028 — antes desta fatia, `grep -rn "beforeLoad" src/` voltava vazio: a
 * única barreira das telas administrativas era o item de menu escondido
 * (`AppShell.tsx`, `filterNavGroups`). Digitar a URL abria a tela.
 *
 * Este teste não renderiza componente nenhum: navega pelo roteador de verdade
 * (`routeTree` gerado) e afirma onde a navegação PÁRA. É a barreira de
 * navegação que está sob teste, não o que a tela desenha depois.
 */

const fetchMock = vi.fn();

/** Para onde o roteador realmente foi, depois de resolver `beforeLoad`. */
async function navegarComoUsuario(user: SessionUser, href: string): Promise<string> {
  mockAppFetch(fetchMock, { user, state: scopedFixtureStateFor(user) });

  const queryClient = createAppQueryClient();
  const router = createRouter({
    routeTree,
    context: { queryClient },
    history: createMemoryHistory({ initialEntries: [href] }),
  });

  await router.load();
  return router.state.location.pathname;
}

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

describe("guardas de navegação das telas administrativas", () => {
  it("nega /users a quem não é admin", async () => {
    expect(await navegarComoUsuario(fixtureMemberUser, "/users")).toBe("/");
  });

  it("nega /competency-matrix a quem não é admin", async () => {
    expect(await navegarComoUsuario(fixtureMemberUser, "/competency-matrix")).toBe("/");
  });

  it("nega /calibration a quem não é admin na navegação interna (PRD-03: só gestor+admin)", async () => {
    expect(await navegarComoUsuario(fixtureMemberUser, "/calibration")).toBe("/");
  });

  it("mantém /calibration aberta para admin", async () => {
    expect(await navegarComoUsuario(fixtureAdminUser, "/calibration")).toBe("/calibration");
  });

  it("mantém /users aberta para admin", async () => {
    expect(await navegarComoUsuario(fixtureAdminUser, "/users")).toBe("/users");
  });
});

/**
 * Onda 10, T7 — desde o roster fechado (backend `d1edba4`), o perfil fora do
 * escopo NÃO vem no payload de `/state`: a antiga guarda `requireArchitectReach`
 * nunca mais encontrava o arquiteto e caía no ramo "não encontrei, libero" —
 * redirect morto, e o teste antigo só ficava verde porque a fixture emitia o
 * payload que o servidor não manda mais. A negação decidida para o mundo
 * recortado é o estado "não encontrado" que a própria tela já tem (fixado em
 * `architect-profile-fora-do-escopo.test.tsx`); aqui se fixa a metade da
 * navegação: a rota RESOLVE, ninguém é jogado para a home.
 */
describe("navegação do perfil de arquiteto no mundo recortado", () => {
  it("member em perfil fora do escopo permanece na URL — a negação é o 'não encontrado' da tela", async () => {
    expect(await navegarComoUsuario(fixtureMemberUser, "/architects/bruno")).toBe(
      "/architects/bruno",
    );
  });

  it("mantém o próprio perfil aberto para o member dono dele", async () => {
    expect(await navegarComoUsuario(fixtureMemberUser, "/architects/ana")).toBe("/architects/ana");
  });

  it("mantém qualquer perfil aberto para admin", async () => {
    expect(await navegarComoUsuario(fixtureAdminUser, "/architects/bruno")).toBe(
      "/architects/bruno",
    );
  });

  /**
   * UX-001 continua valendo, imposto pelo servidor: o payload recortado de um
   * lead sem atribuição não traz o arquiteto, então a rota resolve e a tela
   * mostra "não encontrado" — nada do perfil chega ao navegador.
   */
  it("lead sem atribuição permanece na URL e não recebe o arquiteto no payload", async () => {
    expect(await navegarComoUsuario(fixtureUnassignedLeadUser, "/architects/bruno")).toBe(
      "/architects/bruno",
    );
  });

  it("nega /users a um lead", async () => {
    expect(await navegarComoUsuario(fixtureUnassignedLeadUser, "/users")).toBe("/");
  });
});
