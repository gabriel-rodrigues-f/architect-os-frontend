import { createMemoryHistory, createRouter, isRedirect } from "@tanstack/react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { SessionUser } from "@/lib/api";
import { createAppQueryClient } from "@/lib/query-client";
import { routeTree } from "@/routeTree.gen";
import {
  requirePeopleAdministrationReach,
  requireCalibrationReach,
  requireCareerTabsReach,
  requireLeadReach,
  requireLeadershipReach,
  requirePlatformMetricsReach,
  requireSystemOperatorReach,
  requireTeamAnalysisReach,
} from "@/lib/route-guards";
import { SESSION_QUERY_KEY } from "@/lib/session-query";
import {
  fixtureAdminUser,
  fixtureAssignedManagerUser,
  fixtureMemberUser,
  fixtureAssignedTechLeadUser,
  fixtureSupportUser,
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

/**
 * PR 5 (adendo do dono, 2026-09-08) — cinco papéis. SUPPORT tem o alcance do
 * antigo admin (opera o sistema); ADMIN tem o alcance de ORGANIZAÇÃO: todas
 * as rotas de leitura mais a administração. Nenhum dos dois calibra — é rito
 * do gerente com vínculo.
 */
describe("guardas de navegação — SUPPORT opera o sistema, ADMIN lê a organização", () => {
  it.each(["/competency-matrix", "/users", "/teams", "/cycles", "/settings", "/team-rules"])(
    "SUPPORT alcança %s como o antigo admin",
    async (href) => {
      expect(await navegarComoUsuario(fixtureSupportUser, href)).toBe(href);
    },
  );

  it("SUPPORT sem vínculo não alcança a análise de time nem a calibração", async () => {
    expect(await navegarComoUsuario(fixtureSupportUser, "/capability-map")).toBe("/");
    expect(await navegarComoUsuario(fixtureSupportUser, "/calibration")).toBe("/");
  });

  it.each([
    "/competency-matrix",
    "/users",
    "/teams",
    "/cycles",
    "/settings",
    "/team-rules",
    "/capability-map",
    "/progression",
    "/professionals/ana/evolution",
  ])("ADMIN alcança %s — leitura da organização inteira e administração", async (href) => {
    expect(await navegarComoUsuario(fixtureAdminUser, href)).toBe(href);
  });

  it("ADMIN calibra — o administrador faz tudo (regra 6, 2026-09-08); o suporte não", async () => {
    expect(await navegarComoUsuario(fixtureAdminUser, "/calibration")).toBe("/calibration");
    expect(await navegarComoUsuario(fixtureSupportUser, "/calibration")).toBe("/");
  });
});

describe("guardas de navegação das telas administrativas", () => {
  it("nega /users ao profissional — cadastrar pessoa é da liderança", async () => {
    expect(await navegarComoUsuario(fixtureMemberUser, "/users")).toBe("/");
  });

  it("nega /competency-matrix a quem não é admin", async () => {
    expect(await navegarComoUsuario(fixtureMemberUser, "/competency-matrix")).toBe("/");
  });

  it("nega /calibration ao member na navegação interna (PRD-03: só gerente+admin)", async () => {
    expect(await navegarComoUsuario(fixtureMemberUser, "/calibration")).toBe("/");
  });

  it("nega /calibration ao tech lead — é a metade da liderança que o contrato exclui", async () => {
    expect(await navegarComoUsuario(fixtureAssignedTechLeadUser, "/calibration")).toBe("/");
  });

  it("nega /calibration ao suporte — calibração é rito de gestão, e o suporte opera o sistema", async () => {
    expect(await navegarComoUsuario(fixtureSupportUser, "/calibration")).toBe("/");
  });

  it("abre /calibration para o gerente", async () => {
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
 * escopo NÃO vem no payload de `/state`: a antiga guarda `requireProfessionalReach`
 * nunca mais encontrava o profissional e caía no ramo "não encontrei, libero" —
 * redirect morto, e o teste antigo só ficava verde porque a fixture emitia o
 * payload que o servidor não manda mais. A negação decidida para o mundo
 * recortado é o estado "não encontrado" que a própria tela já tem (fixado em
 * `professional-profile-fora-do-escopo.test.tsx`); aqui se fixa a metade da
 * navegação: a rota RESOLVE, ninguém é jogado para a home.
 */
describe("navegação do perfil de profissional no mundo recortado", () => {
  it("member em perfil fora do escopo permanece na URL — a negação é o 'não encontrado' da tela", async () => {
    expect(await navegarComoUsuario(fixtureMemberUser, "/professionals/bruno")).toBe(
      "/professionals/bruno",
    );
  });

  /**
   * 2026-09-05 — o dono devolveu "Minha carreira" ao profissional, em leitura:
   * a Visão geral da própria ficha abre sem guarda. (Era negada desde 01/09.)
   */
  it("o member abre a PRÓPRIA Visão geral — é a tela de leitura do progresso dele", async () => {
    expect(await navegarComoUsuario(fixtureMemberUser, "/professionals/ana")).toBe(
      "/professionals/ana",
    );
  });

  it("mantém qualquer perfil aberto para admin", async () => {
    expect(await navegarComoUsuario(fixtureAdminUser, "/professionals/bruno")).toBe(
      "/professionals/bruno",
    );
  });

  /**
   * UX-001 continua valendo, imposto pelo servidor: o payload recortado de um
   * lead sem atribuição não traz o profissional, então a rota resolve e a tela
   * mostra "não encontrado" — nada do perfil chega ao navegador.
   */
  it("lead sem atribuição permanece na URL e não recebe o profissional no payload", async () => {
    expect(await navegarComoUsuario(fixtureUnassignedTechLeadUser, "/professionals/bruno")).toBe(
      "/professionals/bruno",
    );
  });

  /**
   * ONDA 37 — o cadastro unificado abriu /users à liderança: é o único lugar
   * onde uma pessoa nasce, e o dono definiu que gerente e tech lead cadastram
   * no time deles. O DIRETÓRIO de contas continua administrativo — quem nega
   * a leitura é a tela (`users-alcance.test.tsx`), não a navegação.
   */
  it("abre /users ao gerente com vínculo e nega ao tech lead — cadastrar é ato de gestão (D4)", async () => {
    expect(await navegarComoUsuario(fixtureAssignedManagerUser, "/users")).toBe("/users");
    expect(await navegarComoUsuario(fixtureAssignedTechLeadUser, "/users")).toBe("/");
    expect(await navegarComoUsuario(fixtureUnassignedTechLeadUser, "/users")).toBe("/");
  });
});

/**
 * Revisão de papéis (2026-09-05): duas guardas novas. O mapa técnico com nome
 * (Progressão, Comparativo) é do tech lead vinculado (D5); Usuários e Times
 * são do administrador e do gerente com vínculo.
 */
async function alcanca(
  guarda: typeof requirePeopleAdministrationReach,
  user: SessionUser,
): Promise<boolean> {
  const queryClient = createAppQueryClient();
  queryClient.setQueryData(SESSION_QUERY_KEY, user);
  try {
    await guarda({ context: { queryClient } });
    return true;
  } catch (erro) {
    if (isRedirect(erro)) return false;
    throw erro;
  }
}

describe("requirePeopleAdministrationReach — Usuários e Times", () => {
  it("deixa passar o admin e o gerente com vínculo; nega tech lead e profissional", async () => {
    expect(await alcanca(requirePeopleAdministrationReach, fixtureAdminUser)).toBe(true);
    expect(await alcanca(requirePeopleAdministrationReach, fixtureAssignedManagerUser)).toBe(true);
    expect(await alcanca(requirePeopleAdministrationReach, fixtureAssignedTechLeadUser)).toBe(
      false,
    );
    expect(await alcanca(requirePeopleAdministrationReach, fixtureMemberUser)).toBe(false);
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
 * CONTRATO PRD-03, "visível só para gerente + admin" — a 3ª guarda do arquivo.
 * A calibração era `requireAdminReach` por FALTA de vocabulário: com um único
 * papel `lead`, abrir a rota teria entregado a leitura ao tech lead, que o
 * contrato exclui. Os quatro papéis (backend ADR-0047) tornam a linha
 * dizível, e esta é a metade de navegação dela.
 *
 * O alcance é o PAPEL, não o vínculo: o contrato fala de gerente, sem dizer
 * "gerente daquele time" — a calibração é uma leitura de distribuição entre
 * avaliadores, não uma ação sobre alguém. Por isso o gerente SEM vínculo
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

  it("deixa passar o gerente", async () => {
    expect(await alcancaCalibracao(fixtureAssignedManagerUser)).toBe(true);
  });

  it("nega o gerente SEM vínculo — sem time não há quem calibrar", async () => {
    const gestorSemVinculo: SessionUser = { ...fixtureAssignedManagerUser, memberships: [] };
    expect(await alcancaCalibracao(gestorSemVinculo)).toBe(false);
  });

  it("deixa passar o administrador (regra 6) e nega o suporte", async () => {
    expect(await alcancaCalibracao(fixtureAdminUser)).toBe(true);
    expect(await alcancaCalibracao(fixtureSupportUser)).toBe(false);
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
  "/professionals/ana",
  "/professionals/ana/evolution",
  "/professionals/ana/roadmap",
  "/professionals/ana/statement",
];

/** As três abas que o servidor reserva à liderança (ADR-0070); a Visão geral é da pessoa. */
const ABAS_DA_LIDERANCA = FICHA_DE_ANA.slice(1);

describe("o profissional não navega até os próprios números", () => {
  it("nega /team ao member", async () => {
    expect(await navegarComoUsuario(fixtureMemberUser, "/team")).toBe("/");
  });

  it("nega /settings ao member", async () => {
    expect(await navegarComoUsuario(fixtureMemberUser, "/settings")).toBe("/");
  });

  it.each(ABAS_DA_LIDERANCA)(
    "abre ao member a PRÓPRIA aba %s — D2 (dono, 2026-09-05): a pessoa vê os próprios números",
    async (href) => {
      expect(await navegarComoUsuario(fixtureMemberUser, href)).toBe(href);
    },
  );

  it.each(ABAS_DA_LIDERANCA.map((href) => href.replace("/ana", "/bruno")))(
    "nega ao member a aba %s de OUTRA pessoa",
    async (href) => {
      expect(await navegarComoUsuario(fixtureMemberUser, href)).toBe("/");
    },
  );

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

async function alcancaFichaDe(user: SessionUser, professionalId: string): Promise<boolean> {
  const queryClient = createAppQueryClient();
  queryClient.setQueryData(SESSION_QUERY_KEY, user);
  try {
    await requireCareerTabsReach({ context: { queryClient }, params: { professionalId } });
    return true;
  } catch (erro) {
    if (isRedirect(erro)) return false;
    throw erro;
  }
}

describe("requireLeadershipReach e requireCareerTabsReach — as guardas do profissional", () => {
  it("a liderança passa; o member não", async () => {
    expect(await alcancaLideranca(fixtureMemberUser)).toBe(false);
    expect(await alcancaLideranca(fixtureUnassignedTechLeadUser)).toBe(true);
    expect(await alcancaLideranca(fixtureAssignedManagerUser)).toBe(true);
    expect(await alcancaLideranca(fixtureAdminUser)).toBe(true);
  });

  it("as abas da PRÓPRIA ficha abrem ao member (D2); as de outra pessoa, não", async () => {
    expect(await alcancaFichaDe(fixtureMemberUser, "ana")).toBe(true);
    expect(await alcancaFichaDe(fixtureMemberUser, "bruno")).toBe(false);
  });

  it("quem lidera abre as abas de qualquer ficha, inclusive da própria quando tem profissional vinculado", async () => {
    expect(await alcancaFichaDe(fixtureAssignedTechLeadUser, "ana")).toBe(true);
    expect(
      await alcancaFichaDe({ ...fixtureAssignedTechLeadUser, professionalId: "ana" }, "ana"),
    ).toBe(true);
    expect(await alcancaFichaDe(fixtureAdminUser, "ana")).toBe(true);
  });
});

describe("guardas de navegação do cadastro de times", () => {
  it("nega /teams ao member", async () => {
    expect(await navegarComoUsuario(fixtureMemberUser, "/teams")).toBe("/");
  });

  it("nega /teams ao tech lead sem vínculo — não há time que ele alcance", async () => {
    expect(await navegarComoUsuario(fixtureUnassignedTechLeadUser, "/teams")).toBe("/");
  });

  it("abre /teams para o gerente com vínculo", async () => {
    expect(await navegarComoUsuario(fixtureAssignedManagerUser, "/teams")).toBe("/teams");
  });

  it("mantém /teams aberta para admin", async () => {
    expect(await navegarComoUsuario(fixtureAdminUser, "/teams")).toBe("/teams");
  });
});

/**
 * Onda 33 — achado (4) da revisão de PO (2026-09-02): a decisão "o
 * profissional não vê os próprios números" estava executada pela metade.
 * Ciclos mostrava a ele "Nível final por ciclo: L4 → L5", e as cinco telas
 * de análise do time — tiradas do MENU na onda 31 — "saíram do menu e
 * ficaram na URL, com os números dele dentro". Aqui se fecha a URL: Ciclos
 * entra na régua da liderança (`requireLeadershipReach`) e as cinco ganham
 * a guarda nomeada `requireTeamAnalysisReach`, sobre `canAnalyzeTeam` — a
 * MESMA política que já recortava o menu, agora ligada na navegação.
 */
const ANALISE_DO_TIME = [
  "/progression",
  "/gap-analysis",
  "/training-needs",
  "/capability-map",
  "/compare",
];

describe("o profissional não navega até Ciclos nem até a análise do time", () => {
  it("nega /cycles ao member", async () => {
    expect(await navegarComoUsuario(fixtureMemberUser, "/cycles")).toBe("/");
  });

  it.each(ANALISE_DO_TIME)("nega %s ao member", async (href) => {
    expect(await navegarComoUsuario(fixtureMemberUser, href)).toBe("/");
  });

  it("mantém /cycles para quem lidera e para o admin", async () => {
    for (const user of [
      fixtureAdminUser,
      fixtureAssignedManagerUser,
      fixtureAssignedTechLeadUser,
      fixtureUnassignedTechLeadUser,
    ]) {
      expect(await navegarComoUsuario(user, "/cycles"), user.role).toBe("/cycles");
    }
  });

  it("a análise do time — as cinco — é de quem lidera COM vínculo: gerente e tech lead (dono, 2026-09-06)", async () => {
    for (const href of ANALISE_DO_TIME) {
      expect(await navegarComoUsuario(fixtureAssignedManagerUser, href), href).toBe(href);
      expect(await navegarComoUsuario(fixtureAssignedTechLeadUser, href), href).toBe(href);
    }
    for (const user of [fixtureSupportUser, fixtureUnassignedTechLeadUser]) {
      for (const href of ANALISE_DO_TIME) {
        expect(await navegarComoUsuario(user, href), `${user.role} → ${href}`).toBe("/");
      }
    }
  });
});

async function alcancaAnaliseDoTime(user: SessionUser): Promise<boolean> {
  const queryClient = createAppQueryClient();
  queryClient.setQueryData(SESSION_QUERY_KEY, user);
  try {
    await requireTeamAnalysisReach({ context: { queryClient } });
    return true;
  } catch (erro) {
    if (isRedirect(erro)) return false;
    throw erro;
  }
}

describe("requireTeamAnalysisReach — a guarda da análise do time", () => {
  it("passa quem lidera COM vínculo e o administrador — member, lead sem vínculo e suporte não (revisão de papéis, 2026-09-05; adendo 2026-09-08)", async () => {
    expect(await alcancaAnaliseDoTime(fixtureMemberUser)).toBe(false);
    expect(await alcancaAnaliseDoTime(fixtureUnassignedTechLeadUser)).toBe(false);
    expect(await alcancaAnaliseDoTime(fixtureAssignedTechLeadUser)).toBe(true);
    expect(await alcancaAnaliseDoTime(fixtureAssignedManagerUser)).toBe(true);
    expect(await alcancaAnaliseDoTime(fixtureSupportUser)).toBe(false);
    expect(await alcancaAnaliseDoTime(fixtureAdminUser)).toBe(true);
  });
});

describe("requireSystemOperatorReach — a guarda do catálogo", () => {
  const alcancaOCatalogo = async (user: SessionUser): Promise<boolean> => {
    mockAppFetch(fetchMock, { user, state: scopedFixtureStateFor(user) });
    const queryClient = createAppQueryClient();
    try {
      await requireSystemOperatorReach({ context: { queryClient } });
      return true;
    } catch (error) {
      if (isRedirect(error)) return false;
      throw error;
    }
  };

  it("passa quem opera o sistema — SUPPORT e ADMIN; gerente, tech lead e member não", async () => {
    expect(await alcancaOCatalogo(fixtureSupportUser)).toBe(true);
    expect(await alcancaOCatalogo(fixtureAdminUser)).toBe(true);
    expect(await alcancaOCatalogo(fixtureAssignedManagerUser)).toBe(false);
    expect(await alcancaOCatalogo(fixtureAssignedTechLeadUser)).toBe(false);
    expect(await alcancaOCatalogo(fixtureMemberUser)).toBe(false);
  });
});

/**
 * Onda 45 — as Métricas da Plataforma deixaram de ser âncora externa e
 * viraram rota (dono, 2026-09-08), e rota tem guarda. O alcance é o do adendo
 * 5 do mesmo dia: "o único que não enxerga as métricas passa a ser o membro"
 * — inclusive o lead SEM vínculo, porque as métricas são do serviço e não de
 * um time. Tirar do menu não fecha a URL: é a lição da onda 17, e é esta
 * metade que a fecha.
 */
async function alcancaAsMetricas(user: SessionUser): Promise<boolean> {
  const queryClient = createAppQueryClient();
  queryClient.setQueryData(SESSION_QUERY_KEY, user);
  try {
    await requirePlatformMetricsReach({ context: { queryClient } });
    return true;
  } catch (erro) {
    if (isRedirect(erro)) return false;
    throw erro;
  }
}

describe("requirePlatformMetricsReach — a guarda das Métricas da Plataforma", () => {
  it("passa todo mundo que não é member — inclusive o lead sem vínculo e o suporte", async () => {
    expect(await alcancaAsMetricas(fixtureAdminUser)).toBe(true);
    expect(await alcancaAsMetricas(fixtureSupportUser)).toBe(true);
    expect(await alcancaAsMetricas(fixtureAssignedManagerUser)).toBe(true);
    expect(await alcancaAsMetricas(fixtureAssignedTechLeadUser)).toBe(true);
    expect(await alcancaAsMetricas(fixtureUnassignedTechLeadUser)).toBe(true);
  });

  it("nega ao member", async () => {
    expect(await alcancaAsMetricas(fixtureMemberUser)).toBe(false);
  });

  it("na navegação de verdade, o member é devolvido à home e quem lidera abre a tela", async () => {
    expect(await navegarComoUsuario(fixtureMemberUser, "/platform-metrics")).toBe("/");
    for (const user of [fixtureAdminUser, fixtureSupportUser, fixtureUnassignedTechLeadUser]) {
      expect(await navegarComoUsuario(user, "/platform-metrics"), user.role).toBe(
        "/platform-metrics",
      );
    }
  });
});
