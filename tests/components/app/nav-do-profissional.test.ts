import { describe, expect, it } from "vitest";

import { NAV_GROUPS, filterNavGroups } from "@/lib/navigation-catalog";
import type { SessionUser } from "@/lib/api";
import {
  fixtureAdminUser,
  fixtureSupportUser,
  fixtureMemberUser,
  fixtureAssignedManagerUser,
  fixtureAssignedTechLeadUser,
  fixtureUnassignedTechLeadUser,
} from "../../helpers/fixtures";

/**
 * Revisão de produto de 2026-08-30, achado mais grave do relatório: "O
 * PROFISSIONAL NÃO TEM NADA DELE NO MENU". Medido na aplicação viva do dono
 * (conta `dev@synapse.local`, papel member) ANTES desta fatia: 13 itens de
 * menu, cinco deles ferramentas de time sobre um time de UMA pessoa.
 *
 * Duas medições feitas no navegador sustentam o recorte abaixo, e valem mais
 * que a intuição de qual tela "é de gestão":
 *   - `/compare` exige de 2 a 6 pessoas e o seletor do profissional tem UMA
 *     opção: a tela fica presa para sempre em "Selecione ao menos 2 pessoas".
 *     É item de menu que ele NUNCA poderá usar.
 *   - `/capability-map` acusa "Concentração" nas 13 capacidades dele — um
 *     alarme de risco organizacional apontado para o próprio dono da conta.
 *
 * Onda 31 — o dono virou a direção do item de carreira (2026-09-01): "eu não
 * quero que o profissional veja seus números de avaliação. isso pode
 * influenciá-lo negativamente" · "'Minha Carreira' pode ser removido da role
 * do profissional" · "o profissional não pode ver os menus 'time' e
 * 'política de Progressão'". O Roteiro continua existindo — é a liderança
 * quem o abre, pela ficha da pessoa — e quem lidera e tem profissional
 * vinculado continua com o item: para os outros papéis nada muda.
 */
const destinos = (user: SessionUser | undefined): string[] =>
  filterNavGroups(NAV_GROUPS, user).flatMap((grupo) => grupo.items.map((item) => item.to));

const rotulosDeGrupo = (user: SessionUser | undefined): (string | undefined)[] =>
  filterNavGroups(NAV_GROUPS, user).map((grupo) => grupo.labelKey);

/**
 * Quem lidera E é profissional. Até 2026-09-05 era o único caso com "Minha
 * carreira"; o dono devolveu o item ao profissional, em leitura.
 */
const liderComProfissional: SessionUser = { ...fixtureAssignedTechLeadUser, professionalId: "ana" };

/** As quatro entradas do grupo "Minha carreira" (dono, 2026-09-06), na ordem do menu. */
const MINHA_CARREIRA_DE_ANA = [
  "/professionals/ana",
  "/professionals/ana/evolution",
  "/professionals/ana/statement",
  "/professionals/ana/roadmap",
];

/** As cinco ferramentas de diagnóstico do TIME, medidas sobre a base inteira. */
const ANALISE_DO_TIME = ["/capability-map", "/gap-analysis", "/progression"];

/**
 * Os dois menus que o dono tirou do profissional, nominalmente — e, desde a
 * onda 33, Ciclos: a revisão de PO (2026-09-02) mediu que a tela mostrava
 * ao profissional "Nível final por ciclo: L4 → L5" competência a
 * competência, o número que a decisão do dono manda esconder.
 */
/** Onda do GRUPO (2026-09-10): `/settings` virou endereço antigo; a leitura do modelo é `/model-reference`. */
const MENUS_DA_LIDERANCA = ["/team", "/model-reference", "/cycles"];

describe("menu do profissional — a carreira dele em leitura, e nada do time", () => {
  /**
   * 2026-09-05 — o dono devolveu "Minha carreira" ao profissional: a Visão
   * geral da própria ficha, em leitura, sem ação e sem IA. As abas de
   * liderança (Evolução, Extrato, Roteiro) continuam fora do alcance dele.
   */
  /**
   * Dono, 2026-09-06: "Na visão do Membro, Minha Carreira não seja um Menu,
   * mas um grupo. Deve agrupar Visão Geral, Evolução, Extrato e Roteiro.
   * Assim morre o botão 'Voltar' do canto superior direito."
   */
  it("'Minha carreira' é um GRUPO com Visão geral, Evolução, Extrato e Roteiro, endereçados à própria ficha (dono, 2026-09-06)", () => {
    const primeiro = filterNavGroups(NAV_GROUPS, fixtureMemberUser)[0];
    expect(primeiro?.labelKey).toBe("nav.group.myCareer");
    expect(primeiro?.items.map((item) => item.to)).toEqual(MINHA_CARREIRA_DE_ANA);
    expect(primeiro?.items.map((item) => item.labelKey)).toEqual([
      "arch.tabs.overview",
      "arch.tabs.evolution",
      "arch.tabs.statement",
      "arch.tabs.roadmap",
    ]);
  });

  it("o menu do profissional começa pela carreira dele", () => {
    expect(rotulosDeGrupo(fixtureMemberUser)[0]).toBe("nav.group.myCareer");
  });

  it("'Talentos do Time' e 'Critérios de Progressão' somem do menu do profissional", () => {
    for (const destino of MENUS_DA_LIDERANCA) {
      expect(destinos(fixtureMemberUser), destino).not.toContain(destino);
    }
  });

  it("'Talentos do Time' e 'Critérios de Progressão' continuam para quem lidera e para quem administra", () => {
    for (const user of [
      fixtureAdminUser,
      fixtureAssignedTechLeadUser,
      fixtureUnassignedTechLeadUser,
    ]) {
      for (const destino of MENUS_DA_LIDERANCA) {
        expect(destinos(user), `${user.role} → ${destino}`).toContain(destino);
      }
    }
  });
});

describe("menu de carreira — o gerente não tem 'Minha carreira' (dono, 2026-09-06)", () => {
  it("gerente com ficha vinculada NÃO recebe 'Minha carreira' — ele não é um profissional com capacidades", () => {
    const gerenteComFicha: SessionUser = { ...fixtureAssignedManagerUser, professionalId: "ana" };
    expect(destinos(gerenteComFicha).some((destino) => destino.startsWith("/professionals/"))).toBe(
      false,
    );
  });
});

describe("menu de carreira — para os outros papéis nada muda", () => {
  it("quem lidera e tem profissional vinculado recebe o mesmo grupo Minha carreira, endereçado ao próprio profissional", () => {
    for (const destino of MINHA_CARREIRA_DE_ANA) {
      expect(destinos(liderComProfissional), destino).toContain(destino);
    }
  });

  it("o grupo de carreira de quem lidera nasce no topo do menu", () => {
    const primeiro = filterNavGroups(NAV_GROUPS, liderComProfissional)[0];
    expect(primeiro?.labelKey).toBe("nav.group.myCareer");
    expect(primeiro?.items.map((item) => item.to)).toEqual(MINHA_CARREIRA_DE_ANA);
  });

  /**
   * O destino é do DONO da sessão, nunca um caminho com o parâmetro cru: um
   * `/professionals/$professionalId/roadmap` no menu levaria a uma rota que não
   * resolve, e um id fixo levaria à carreira de outra pessoa.
   */
  it("nenhum destino do menu carrega parâmetro de rota por resolver", () => {
    for (const user of [
      fixtureMemberUser,
      liderComProfissional,
      fixtureAdminUser,
      fixtureAssignedTechLeadUser,
      fixtureUnassignedTechLeadUser,
    ]) {
      expect(destinos(user).filter((destino) => destino.includes("$"))).toEqual([]);
    }
  });

  it("quem não tem profissional vinculado não recebe o item — não há carreira a mostrar", () => {
    expect(destinos(fixtureAdminUser).some((destino) => destino.includes("/professionals/"))).toBe(
      false,
    );
    expect(
      destinos(fixtureUnassignedTechLeadUser).some((destino) =>
        destino.includes("/professionals/"),
      ),
    ).toBe(false);
  });

  it("sem sessão o menu não inventa carreira de ninguém", () => {
    expect(destinos(undefined).some((destino) => destino.includes("/professionals/"))).toBe(false);
  });
});

describe("menu do profissional — o que não é dele some", () => {
  it("as cinco ferramentas de análise do time saem do menu do profissional", () => {
    for (const destino of ANALISE_DO_TIME) {
      expect(destinos(fixtureMemberUser), destino).not.toContain(destino);
    }
  });

  /**
   * ONDA 37 — o grupo Administração deixou de ser exclusivo do admin porque
   * Usuários virou o ÚNICO lugar de cadastro de pessoa, e o dono definiu que
   * gerente e tech lead cadastram no time deles. Para a liderança o grupo tem
   * UM item — Usuários; para o profissional continua sumindo inteiro, que é
   * o achado que este teste guarda.
   */
  it("o grupo Administração desaparece do menu do profissional", () => {
    expect(rotulosDeGrupo(fixtureMemberUser)).not.toContain("nav.group.admin");
    expect(rotulosDeGrupo(fixtureAdminUser)).toContain("nav.group.admin");
  });

  /**
   * Adendo do dono (2026-09-08, item 5) — Métricas da Plataforma abriu para
   * gerente e tech lead. O grupo Administração do tech lead tem SÓ esse
   * item: cadastrar continua sendo ato de gestão (D4, 2026-09-05).
   */
  it("para o tech lead o grupo Administração tem só as Métricas da Plataforma — cadastrar é ato de gestão (D4, 2026-09-05)", () => {
    for (const lead of [fixtureUnassignedTechLeadUser, fixtureAssignedTechLeadUser]) {
      const administracao = filterNavGroups(NAV_GROUPS, lead).find(
        (group) => group.labelKey === "nav.group.admin",
      );
      expect(administracao?.items.map((item) => item.labelKey)).toEqual(["nav.platformMetrics"]);
    }
  });

  it("quem lidera COM vínculo continua com as ferramentas de time; suporte e lead sem vínculo, não", () => {
    for (const destino of ANALISE_DO_TIME) {
      expect(destinos(fixtureAssignedTechLeadUser), destino).toContain(destino);
      expect(destinos(fixtureSupportUser), destino).not.toContain(destino);
      expect(destinos(fixtureUnassignedTechLeadUser), destino).not.toContain(destino);
    }
  });
});

describe("menu do profissional — nada que ele usa é levado junto", () => {
  it("as cinco telas que o profissional alcança de verdade continuam no menu", () => {
    const dele = destinos(fixtureMemberUser);
    for (const destino of [
      "/",
      "/assessments",
      "/development-plans",
      "/learning-paths",
      "/mentoring",
    ]) {
      expect(dele, destino).toContain(destino);
    }
  });

  /**
   * Dez desde 2026-09-08: a décima é `/notices`, o item do grupo "Central do
   * Usuário". Avisos são de todo mundo — até aquela fatia a tela estava no ar
   * sem entrada de menu nenhuma, alcançável só pelo sino.
   *
   * ONZE desde 2026-09-10: a décima primeira é `/account`, Minha Conta. O
   * número subir aqui é a DECISÃO, não um descuido — a avaliação da proposta
   * de governança (2026-09-09, seção 7) escreveu o efeito antes de existir
   * código: *"o Profissional continua em 10, porque nenhum dos quatro itens
   * novos o alcança, exceto Minha Conta — ele vai para 11."* É a única tela
   * do lote de governança que chega até ele, e ela chega porque a conta é
   * dele.
   */
  it("o menu dele tem onze itens — a carreira dele, as cinco telas que ele lê, os Avisos e a Minha Conta; nada de gestão de time", () => {
    expect(destinos(fixtureMemberUser)).toHaveLength(11);
    expect(destinos(fixtureMemberUser)).toContain("/notices");
    expect(destinos(fixtureMemberUser)).toContain("/account");
  });
});
