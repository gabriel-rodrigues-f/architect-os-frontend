import { createMemoryHistory, createRouter } from "@tanstack/react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { SessionUser } from "@/lib/api";
import { createAppQueryClient } from "@/lib/query-client";
import { routeTree } from "@/routeTree.gen";
import {
  fixtureAdminUser,
  fixtureMemberUser,
  fixtureState,
  fixtureUnassignedLeadUser,
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
  mockAppFetch(fetchMock, { user, state: fixtureState });

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

  it("mantém /users aberta para admin", async () => {
    expect(await navegarComoUsuario(fixtureAdminUser, "/users")).toBe("/users");
  });
});

describe("guarda de navegação do perfil de arquiteto", () => {
  it("nega o perfil de outra pessoa a um member", async () => {
    expect(await navegarComoUsuario(fixtureMemberUser, "/architects/bruno")).toBe("/");
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
   * UX-001 — ser `lead` não é passe livre: só o lead atribuído àquele
   * arquiteto (`leadUserId`) alcança o perfil. Nenhum arquiteto da fixture
   * aponta para esta conta, então ela é negada.
   */
  it("nega o perfil a um lead sem atribuição àquele arquiteto", async () => {
    expect(await navegarComoUsuario(fixtureUnassignedLeadUser, "/architects/bruno")).toBe("/");
  });

  it("nega /users a um lead", async () => {
    expect(await navegarComoUsuario(fixtureUnassignedLeadUser, "/users")).toBe("/");
  });
});
