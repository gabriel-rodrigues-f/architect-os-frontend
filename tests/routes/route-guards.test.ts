import { createMemoryHistory, createRouter, isRedirect } from "@tanstack/react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { SessionUser } from "@/lib/api";
import { createAppQueryClient } from "@/lib/query-client";
import { routeTree } from "@/routeTree.gen";
import { requireLeadReach } from "@/lib/route-guards";
import { SESSION_QUERY_KEY } from "@/lib/session-query";
import {
  fixtureAdminUser,
  fixtureMemberUser,
  fixtureTeamLeadUser,
  fixtureUnassignedLeadUser,
  scopedFixtureStateFor,
} from "../helpers/fixtures";
import { mockAppFetch } from "../helpers/render-app";

/**
 * "Guardas de navegação de rota" em `direcao/frontend/DECISOES.md` (o ex-ADR
 * 0028 do frontend, migrado pela regra 17) — antes desta fatia,
 * `grep -rn "beforeLoad" src/` voltava vazio: a
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

/**
 * Fase C, tela 1 — a 2ª guarda do arquivo. A rota `/team-rules` é da
 * sub-fatia da tela; a barreira, não: ela é a mesma coisa que o `beforeLoad`
 * vai chamar, e é exercitada aqui direto, sem tela nenhuma no caminho.
 *
 * `requireAdminReach` já tem a metade de navegação coberta acima; esta
 * metade prova que a guarda NOVA nega quem não rege régua nenhuma — a
 * repetição do vazamento da onda 17 (`/calibration` por URL direta) é o que
 * este arquivo existe para impedir.
 */
async function alcancaTelaDaRegua(user: SessionUser): Promise<boolean> {
  const queryClient = createAppQueryClient();
  queryClient.setQueryData(SESSION_QUERY_KEY, user);
  try {
    await requireLeadReach({ context: { queryClient } });
    return true;
  } catch (erro) {
    if (isRedirect(erro)) return false;
    throw erro;
  }
}

describe("requireLeadReach — a guarda da régua do time", () => {
  it("nega a quem é member", async () => {
    expect(await alcancaTelaDaRegua(fixtureMemberUser)).toBe(false);
  });

  it("nega ao lead sem vínculo nenhum — não há régua que ele reja", async () => {
    expect(await alcancaTelaDaRegua(fixtureUnassignedLeadUser)).toBe(false);
  });

  it("deixa passar o lead com vínculo no time", async () => {
    expect(await alcancaTelaDaRegua(fixtureTeamLeadUser)).toBe(true);
  });

  it("deixa passar o admin", async () => {
    expect(await alcancaTelaDaRegua(fixtureAdminUser)).toBe(true);
  });
});
