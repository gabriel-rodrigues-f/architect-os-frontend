import { describe, expect, it } from "vitest";

import { filterNavGroups, NAV_GROUPS } from "@/components/app/AppShell";
import type { SessionUser } from "@/lib/api";
import {
  fixtureAdminUser,
  fixtureMemberUser,
  fixtureTeamLeadUser,
  fixtureUnassignedLeadUser,
} from "../../helpers/fixtures";

/**
 * Revisão de produto de 2026-08-30, achado mais grave do relatório: "O
 * PROFISSIONAL NÃO TEM NADA DELE NO MENU". Medido na aplicação viva do dono
 * (conta `dev@synapse.local`, papel member) ANTES desta fatia: 13 itens de
 * menu, cinco deles ferramentas de time sobre um time de UMA pessoa, e a
 * pergunta que o produto existe para responder — "o que falta para o meu
 * próximo nível" — sem endereço nenhum, alcançável só por dentro de uma tela
 * chamada "Time" que lista ele mesmo.
 *
 * Duas medições feitas no navegador sustentam o recorte abaixo, e valem mais
 * que a intuição de qual tela "é de gestão":
 *   - `/compare` exige de 2 a 6 pessoas e o seletor do profissional tem UMA
 *     opção: a tela fica presa para sempre em "Selecione ao menos 2 pessoas".
 *     É item de menu que ele NUNCA poderá usar.
 *   - `/capability-map` acusa "Concentração" nas 13 capacidades dele — um
 *     alarme de risco organizacional apontado para o próprio dono da conta.
 *
 * O critério deste arquivo é ALCANCE REAL, não assunto: item que o
 * profissional vê e não pode usar é pior que item ausente. Por isso `/cycles`
 * e `/settings` FICAM — conferidos um a um na aplicação viva, os dois abrem
 * conteúdo dele em leitura (a evolução por ciclo e o critério de
 * elegibilidade + a escala L1–L5), sem um único botão que ele não possa
 * apertar.
 */
const destinos = (user: SessionUser | undefined): string[] =>
  filterNavGroups(NAV_GROUPS, user).flatMap((grupo) => grupo.items.map((item) => item.to));

const rotulosDeGrupo = (user: SessionUser | undefined): (string | undefined)[] =>
  filterNavGroups(NAV_GROUPS, user).map((grupo) => grupo.labelKey);

/** As cinco ferramentas de diagnóstico do TIME, medidas sobre a base inteira. */
const ANALISE_DO_TIME = [
  "/capability-map",
  "/gap-analysis",
  "/progression",
  "/training-needs",
  "/compare",
];

describe("menu do profissional — o que é dele aparece", () => {
  it("o Roteiro ganha endereço próprio, endereçado ao arquiteto da sessão", () => {
    expect(destinos(fixtureMemberUser)).toContain("/architects/ana/roadmap");
  });

  it("o item de carreira nasce no topo do menu, antes de qualquer grupo", () => {
    const primeiro = filterNavGroups(NAV_GROUPS, fixtureMemberUser)[0];
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
      fixtureAdminUser,
      fixtureTeamLeadUser,
      fixtureUnassignedLeadUser,
    ]) {
      expect(destinos(user).filter((destino) => destino.includes("$"))).toEqual([]);
    }
  });

  it("quem não tem arquiteto vinculado não recebe o item — não há carreira a mostrar", () => {
    expect(destinos(fixtureAdminUser)).not.toContain("/architects/ana/roadmap");
    expect(destinos(fixtureAdminUser).some((destino) => destino.includes("/roadmap"))).toBe(false);
    expect(
      destinos(fixtureUnassignedLeadUser).some((destino) => destino.includes("/roadmap")),
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
    expect(rotulosDeGrupo(fixtureUnassignedLeadUser)).not.toContain("nav.group.admin");
    expect(rotulosDeGrupo(fixtureTeamLeadUser)).not.toContain("nav.group.admin");
    expect(rotulosDeGrupo(fixtureAdminUser)).toContain("nav.group.admin");
  });

  it("quem lidera e quem administra continuam com as cinco ferramentas de time", () => {
    for (const destino of ANALISE_DO_TIME) {
      expect(destinos(fixtureAdminUser), destino).toContain(destino);
      expect(destinos(fixtureTeamLeadUser), destino).toContain(destino);
      expect(destinos(fixtureUnassignedLeadUser), destino).toContain(destino);
    }
  });
});

describe("menu do profissional — nada que ele usa é levado junto", () => {
  it("as oito telas que o profissional alcança de verdade continuam no menu", () => {
    const dele = destinos(fixtureMemberUser);
    for (const destino of [
      "/",
      "/team",
      "/assessments",
      "/development-plans",
      "/learning-paths",
      "/mentoring",
      "/cycles",
      "/settings",
    ]) {
      expect(dele, destino).toContain(destino);
    }
  });

  it("o menu dele encolhe de treze itens para nove, e nenhum deles é de gestão de time", () => {
    expect(destinos(fixtureMemberUser)).toHaveLength(9);
  });
});
