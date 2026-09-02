import { describe, expect, it } from "vitest";

import { filterNavGroups, NAV_GROUPS } from "@/components/app/AppShell";
import type { SessionUser } from "@/lib/api";
import {
  fixtureAdminUser,
  fixtureMemberUser,
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
 * quem o abre, pela ficha da pessoa — e quem lidera e tem arquiteto
 * vinculado continua com o item: para os outros papéis nada muda.
 */
const destinos = (user: SessionUser | undefined): string[] =>
  filterNavGroups(NAV_GROUPS, user).flatMap((grupo) => grupo.items.map((item) => item.to));

const rotulosDeGrupo = (user: SessionUser | undefined): (string | undefined)[] =>
  filterNavGroups(NAV_GROUPS, user).map((grupo) => grupo.labelKey);

/** Quem lidera E é arquiteto: o único caso em que "Minha carreira" ainda aparece. */
const liderComArquiteto: SessionUser = { ...fixtureAssignedTechLeadUser, architectId: "ana" };

/** As cinco ferramentas de diagnóstico do TIME, medidas sobre a base inteira. */
const ANALISE_DO_TIME = [
  "/capability-map",
  "/gap-analysis",
  "/progression",
  "/training-needs",
  "/compare",
];

/**
 * Os dois menus que o dono tirou do profissional, nominalmente — e, desde a
 * onda 33, Ciclos: a revisão de PO (2026-09-02) mediu que a tela mostrava
 * ao profissional "Nível final por ciclo: L4 → L5" competência a
 * competência, o número que a decisão do dono manda esconder.
 */
const MENUS_DA_LIDERANCA = ["/team", "/settings", "/cycles"];

describe("menu do profissional — os números dele não aparecem para ele", () => {
  it("o profissional não recebe 'Minha carreira' — nem endereçado, nem cru", () => {
    expect(destinos(fixtureMemberUser).some((destino) => destino.includes("/architects/"))).toBe(
      false,
    );
  });

  it("o menu do profissional não começa com grupo de carreira", () => {
    const primeiro = filterNavGroups(NAV_GROUPS, fixtureMemberUser)[0];
    expect(primeiro?.labelKey).toBe("nav.group.operation");
  });

  it("'Time' e 'Política de Progressão' somem do menu do profissional", () => {
    for (const destino of MENUS_DA_LIDERANCA) {
      expect(destinos(fixtureMemberUser), destino).not.toContain(destino);
    }
  });

  it("'Time' e 'Política de Progressão' continuam para quem lidera e para quem administra", () => {
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

describe("menu de carreira — para os outros papéis nada muda", () => {
  it("quem lidera e tem arquiteto vinculado recebe o Roteiro endereçado ao próprio arquiteto", () => {
    expect(destinos(liderComArquiteto)).toContain("/architects/ana/roadmap");
  });

  it("o item de carreira de quem lidera nasce no topo do menu, antes de qualquer grupo", () => {
    const primeiro = filterNavGroups(NAV_GROUPS, liderComArquiteto)[0];
    expect(primeiro?.items.map((item) => item.to)).toEqual(["/architects/ana/roadmap"]);
  });

  /**
   * O destino é do DONO da sessão, nunca um caminho com o parâmetro cru: um
   * `/architects/$architectId/roadmap` no menu levaria a uma rota que não
   * resolve, e um id fixo levaria à carreira de outra pessoa.
   */
  it("nenhum destino do menu carrega parâmetro de rota por resolver", () => {
    for (const user of [
      fixtureMemberUser,
      liderComArquiteto,
      fixtureAdminUser,
      fixtureAssignedTechLeadUser,
      fixtureUnassignedTechLeadUser,
    ]) {
      expect(destinos(user).filter((destino) => destino.includes("$"))).toEqual([]);
    }
  });

  it("quem não tem arquiteto vinculado não recebe o item — não há carreira a mostrar", () => {
    expect(destinos(fixtureAdminUser).some((destino) => destino.includes("/roadmap"))).toBe(false);
    expect(
      destinos(fixtureUnassignedTechLeadUser).some((destino) => destino.includes("/roadmap")),
    ).toBe(false);
  });

  it("sem sessão o menu não inventa carreira de ninguém", () => {
    expect(destinos(undefined).some((destino) => destino.includes("/roadmap"))).toBe(false);
  });
});

describe("menu do profissional — o que não é dele some", () => {
  it("as cinco ferramentas de análise do time saem do menu do profissional", () => {
    for (const destino of ANALISE_DO_TIME) {
      expect(destinos(fixtureMemberUser), destino).not.toContain(destino);
    }
  });

  it("o grupo Administração desaparece do menu de quem não administra", () => {
    expect(rotulosDeGrupo(fixtureMemberUser)).not.toContain("nav.group.admin");
    expect(rotulosDeGrupo(fixtureUnassignedTechLeadUser)).not.toContain("nav.group.admin");
    expect(rotulosDeGrupo(fixtureAssignedTechLeadUser)).not.toContain("nav.group.admin");
    expect(rotulosDeGrupo(fixtureAdminUser)).toContain("nav.group.admin");
  });

  it("quem lidera e quem administra continuam com as cinco ferramentas de time", () => {
    for (const destino of ANALISE_DO_TIME) {
      expect(destinos(fixtureAdminUser), destino).toContain(destino);
      expect(destinos(fixtureAssignedTechLeadUser), destino).toContain(destino);
      expect(destinos(fixtureUnassignedTechLeadUser), destino).toContain(destino);
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

  it("o menu dele tem cinco itens, e nenhum deles é de gestão de time nem de números dele", () => {
    expect(destinos(fixtureMemberUser)).toHaveLength(5);
  });
});
