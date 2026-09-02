import { createMemoryHistory, createRouter, isRedirect } from "@tanstack/react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { SessionUser } from "@/lib/api";
import { createAppQueryClient } from "@/lib/query-client";
import { routeTree } from "@/routeTree.gen";
import {
  requireCalibrationReach,
  requireCareerFileReach,
  requireLeadReach,
  requireLeadershipReach,
} from "@/lib/route-guards";
import { SESSION_QUERY_KEY } from "@/lib/session-query";
import {
  fixtureAdminUser,
  fixtureAssignedManagerUser,
  fixtureMemberUser,
  fixtureAssignedTechLeadUser,
  fixtureUnassignedTechLeadUser,
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

  it("nega /calibration ao member na navegação interna (PRD-03: só gestor+admin)", async () => {
    expect(await navegarComoUsuario(fixtureMemberUser, "/calibration")).toBe("/");
  });

  it("nega /calibration ao tech lead — é a metade da liderança que o contrato exclui", async () => {
    expect(await navegarComoUsuario(fixtureAssignedTechLeadUser, "/calibration")).toBe("/");
  });

  it("mantém /calibration aberta para admin", async () => {
    expect(await navegarComoUsuario(fixtureAdminUser, "/calibration")).toBe("/calibration");
  });

  it("abre /calibration para o gestor", async () => {
    expect(await navegarComoUsuario(fixtureAssignedManagerUser, "/calibration")).toBe(
      "/calibration",
    );
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

  /**
   * Onda 31 — invertido pelo dono (2026-09-01): "eu não quero que o
   * profissional veja seus números de avaliação". A própria ficha é o lugar
   * onde esses números moram; o member é devolvido ao painel.
   */
  it("nega ao member o PRÓPRIO perfil — os números dele são lidos por quem o lidera", async () => {
    expect(await navegarComoUsuario(fixtureMemberUser, "/architects/ana")).toBe("/");
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
    expect(await navegarComoUsuario(fixtureUnassignedTechLeadUser, "/architects/bruno")).toBe(
      "/architects/bruno",
    );
  });

  it("nega /users a um lead", async () => {
    expect(await navegarComoUsuario(fixtureUnassignedTechLeadUser, "/users")).toBe("/");
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
    expect(await alcancaTelaDaRegua(fixtureUnassignedTechLeadUser)).toBe(false);
  });

  it("deixa passar o lead com vínculo no time", async () => {
    expect(await alcancaTelaDaRegua(fixtureAssignedTechLeadUser)).toBe(true);
  });

  it("deixa passar o admin", async () => {
    expect(await alcancaTelaDaRegua(fixtureAdminUser)).toBe(true);
  });
});

/**
 * CONTRATO PRD-03, "visível só para gestor + admin" — a 3ª guarda do arquivo.
 * A calibração era `requireAdminReach` por FALTA de vocabulário: com um único
 * papel `lead`, abrir a rota teria entregado a leitura ao tech lead, que o
 * contrato exclui. Os quatro papéis (backend ADR-0047) tornam a linha
 * dizível, e esta é a metade de navegação dela.
 *
 * O alcance é o PAPEL, não o vínculo: o contrato fala de gestor, sem dizer
 * "gestor daquele time" — a calibração é uma leitura de distribuição entre
 * avaliadores, não uma ação sobre alguém. Por isso o gestor SEM vínculo
 * nenhum também passa, e o caso está aqui para que essa escolha seja
 * deliberada, e não um efeito colateral da fixture.
 */
async function alcancaCalibracao(user: SessionUser): Promise<boolean> {
  const queryClient = createAppQueryClient();
  queryClient.setQueryData(SESSION_QUERY_KEY, user);
  try {
    await requireCalibrationReach({ context: { queryClient } });
    return true;
  } catch (erro) {
    if (isRedirect(erro)) return false;
    throw erro;
  }
}

describe("requireCalibrationReach — a guarda da leitura de calibração", () => {
  it("nega a quem é member", async () => {
    expect(await alcancaCalibracao(fixtureMemberUser)).toBe(false);
  });

  it("nega ao tech lead, mesmo com vínculo no time", async () => {
    expect(await alcancaCalibracao(fixtureAssignedTechLeadUser)).toBe(false);
  });

  it("deixa passar o gestor", async () => {
    expect(await alcancaCalibracao(fixtureAssignedManagerUser)).toBe(true);
  });

  it("deixa passar o gestor SEM vínculo — o alcance é o papel, não o time", async () => {
    const gestorSemVinculo: SessionUser = { ...fixtureAssignedManagerUser, memberships: [] };
    expect(await alcancaCalibracao(gestorSemVinculo)).toBe(true);
  });

  it("deixa passar o admin", async () => {
    expect(await alcancaCalibracao(fixtureAdminUser)).toBe(true);
  });
});

/**
 * Onda 31 — pedido literal do dono (2026-09-01): "'Minha Carreira' pode ser
 * removido da role do profissional" · "o profissional não pode ver os menus
 * 'time' e 'política de Progressão'". Tirar do menu não fecha a URL (a
 * lição da onda 17); estas são as guardas que fecham, e a metade de
 * navegação delas. A ficha de um LIDERADO continua aberta para quem lidera:
 * são as mesmas rotas, e o dono não pediu para quebrá-las.
 */
const FICHA_DE_ANA = [
  "/architects/ana",
  "/architects/ana/evolution",
  "/architects/ana/roadmap",
  "/architects/ana/statement",
];

describe("o profissional não navega até os próprios números", () => {
  it("nega /team ao member", async () => {
    expect(await navegarComoUsuario(fixtureMemberUser, "/team")).toBe("/");
  });

  it("nega /settings ao member", async () => {
    expect(await navegarComoUsuario(fixtureMemberUser, "/settings")).toBe("/");
  });

  it.each(FICHA_DE_ANA)("nega ao member a própria ficha em %s", async (href) => {
    expect(await navegarComoUsuario(fixtureMemberUser, href)).toBe("/");
  });

  it("mantém /team e /settings para quem lidera, com ou sem vínculo, e para o admin", async () => {
    for (const user of [
      fixtureAdminUser,
      fixtureAssignedTechLeadUser,
      fixtureUnassignedTechLeadUser,
    ]) {
      expect(await navegarComoUsuario(user, "/team"), user.role).toBe("/team");
      expect(await navegarComoUsuario(user, "/settings"), user.role).toBe("/settings");
    }
  });

  it("mantém a ficha de um liderado aberta para o tech lead com vínculo — as rotas não quebram", async () => {
    for (const href of FICHA_DE_ANA) {
      expect(await navegarComoUsuario(fixtureAssignedTechLeadUser, href), href).toBe(href);
    }
  });
});

async function alcancaLideranca(user: SessionUser): Promise<boolean> {
  const queryClient = createAppQueryClient();
  queryClient.setQueryData(SESSION_QUERY_KEY, user);
  try {
    await requireLeadershipReach({ context: { queryClient } });
    return true;
  } catch (erro) {
    if (isRedirect(erro)) return false;
    throw erro;
  }
}

async function alcancaFichaDe(user: SessionUser, architectId: string): Promise<boolean> {
  const queryClient = createAppQueryClient();
  queryClient.setQueryData(SESSION_QUERY_KEY, user);
  try {
    await requireCareerFileReach({ context: { queryClient }, params: { architectId } });
    return true;
  } catch (erro) {
    if (isRedirect(erro)) return false;
    throw erro;
  }
}

describe("requireLeadershipReach e requireCareerFileReach — as guardas do profissional", () => {
  it("a liderança passa; o member não", async () => {
    expect(await alcancaLideranca(fixtureMemberUser)).toBe(false);
    expect(await alcancaLideranca(fixtureUnassignedTechLeadUser)).toBe(true);
    expect(await alcancaLideranca(fixtureAssignedManagerUser)).toBe(true);
    expect(await alcancaLideranca(fixtureAdminUser)).toBe(true);
  });

  it("a ficha PRÓPRIA é negada ao member; a de outra pessoa passa pela guarda e cai no recorte do servidor", async () => {
    expect(await alcancaFichaDe(fixtureMemberUser, "ana")).toBe(false);
    expect(await alcancaFichaDe(fixtureMemberUser, "bruno")).toBe(true);
  });

  it("quem lidera abre qualquer ficha, inclusive a própria quando tem arquiteto vinculado", async () => {
    expect(await alcancaFichaDe(fixtureAssignedTechLeadUser, "ana")).toBe(true);
    expect(
      await alcancaFichaDe({ ...fixtureAssignedTechLeadUser, architectId: "ana" }, "ana"),
    ).toBe(true);
    expect(await alcancaFichaDe(fixtureAdminUser, "ana")).toBe(true);
  });
});
