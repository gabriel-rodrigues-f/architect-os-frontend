import { describe, expect, it } from "vitest";

import { NAV_GROUPS, filterNavGroups } from "@/lib/navigation-catalog";
import type { SessionUser } from "@/lib/api";
import en from "@/locales/en.json";
import pt from "@/locales/pt.json";
import {
  fixtureAdminUser,
  fixtureAssignedManagerUser,
  fixtureMemberUser,
  fixtureSupportUser,
  fixtureUnassignedTechLeadUser,
} from "../../helpers/fixtures";

/**
 * Dono (2026-09-08): a tela de Avisos estava NO AR sem entrada de menu
 * nenhuma — só o sino do cabeçalho levava até ela, e quem fechasse o popover
 * não tinha caminho de volta. O grupo novo, "Central do Usuário", fecha a
 * coluna e não tem régua de alcance: avisos são de TODO MUNDO, e o recorte de
 * quem vê o quê é do servidor, não do menu.
 */
const OS_CINCO_PAPEIS: [string, SessionUser][] = [
  ["member", fixtureMemberUser],
  ["tech_lead", fixtureUnassignedTechLeadUser],
  ["manager", fixtureAssignedManagerUser],
  ["admin", fixtureAdminUser],
  ["support", fixtureSupportUser],
];

const gruposDe = (user: SessionUser) => filterNavGroups(NAV_GROUPS, user);

describe("Central do Usuário — o grupo novo do fim da coluna", () => {
  it("é o ÚLTIMO grupo do catálogo, com Avisos e Minha Conta, nessa ordem", () => {
    const ultimo = NAV_GROUPS.at(-1);
    expect(ultimo?.labelKey).toBe("nav.group.userCenter");
    expect(ultimo?.items.map((item) => item.to)).toEqual(["/notices", "/account"]);
    expect(ultimo?.items.map((item) => item.labelKey)).toEqual(["nav.notices", "nav.account"]);
  });

  for (const [papel, user] of OS_CINCO_PAPEIS) {
    it(`${papel} alcança o grupo, os Avisos e a Minha Conta`, () => {
      const grupos = gruposDe(user);
      const central = grupos.find((grupo) => grupo.labelKey === "nav.group.userCenter");
      expect(central, papel).toBeTruthy();
      expect(central?.items.map((item) => item.to)).toEqual(["/notices", "/account"]);
    });
  }

  /**
   * Minha Conta é de TODO MUNDO — é a única tela nova da governança que o
   * profissional alcança (avaliação de 2026-09-09, seção 7: ele vai de 10 para
   * 11 itens). Nem ela nem os Avisos carregam régua: régua no menu aqui seria
   * esconder de alguém a própria conta.
   */
  it("nenhum dos dois itens carrega régua de alcance", () => {
    for (const item of NAV_GROUPS.at(-1)?.items ?? []) {
      expect(Object.keys(item).sort(), item.to).toEqual(["icon", "labelKey", "to"]);
    }
  });

  it("o grupo e o item existem nas duas línguas", () => {
    const catalogos: Record<string, string>[] = [pt, en];
    for (const catalogo of catalogos) {
      expect(typeof catalogo["nav.group.userCenter"]).toBe("string");
      expect(typeof catalogo["nav.notices"]).toBe("string");
    }
    expect((pt as Record<string, string>)["nav.group.userCenter"]).toBe("Central do Usuário");
  });
});
