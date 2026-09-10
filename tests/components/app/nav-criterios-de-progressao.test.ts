import { describe, expect, it } from "vitest";

import {
  fixtureAdminUser,
  fixtureAssignedManagerUser,
  fixtureMemberUser,
  fixtureUnassignedTechLeadUser,
} from "../../helpers/fixtures";
import { NAV_GROUPS, filterNavGroups } from "@/lib/navigation-catalog";

/**
 * Dono (2026-09-10): *"Agora 'Critérios de Progressão' deixa de ser um menu e
 * torna-se um grupo. E, ao invés de organizarmos em abas verticais,
 * organizamos o que antes seriam abas em menus do grupo Critérios de
 * Progressão. Assim resolvemos o problema de rolar e também o de enxergar o
 * que tem lá."*
 *
 * O ganho que a coluna dá de graça e as abas não davam: a barra lateral já
 * esconde item por alcance. Uma tela de 1390 linhas com TRÊS alcances dentro
 * (`isLeadership`, `isAdmin`, `canConfigureAnyTeamRules`) mostrava caixa vazia
 * ou capada a quem não alcança, e quem lia não sabia se era falta de permissão
 * ou falta de configuração. Seis menus, seis donos: quem não alcança não vê.
 */
const CRITERIOS = "nav.group.progressionCriteria";
const MODELO_DE_CARREIRA = "nav.group.ruler";

const grupo = (labelKey: string) => NAV_GROUPS.find((candidato) => candidato.labelKey === labelKey);

const caminhosDe = (labelKey: string) => (grupo(labelKey)?.items ?? []).map((item) => item.to);

const gruposVisiveis = (user: Parameters<typeof filterNavGroups>[1]) =>
  filterNavGroups(NAV_GROUPS, user);

const itensVisiveisDe = (user: Parameters<typeof filterNavGroups>[1], labelKey: string) =>
  (gruposVisiveis(user).find((candidato) => candidato.labelKey === labelKey)?.items ?? []).map(
    (item) => item.to,
  );

describe("Critérios de Progressão é um grupo da coluna, não um menu", () => {
  it("o grupo existe e traz as seis fatias, na ordem que o dono escreveu", () => {
    expect(caminhosDe(CRITERIOS)).toEqual([
      "/eligibility",
      "/scoring-rulers",
      "/text-templates",
      "/catalog-policy",
      "/vocabularies",
      "/model-reference",
    ]);
  });

  it("Modelo de Carreira devolve o item e fica com dois", () => {
    expect(caminhosDe(MODELO_DE_CARREIRA)).toEqual(["/cycles", "/team-rules"]);
  });

  it("a conta da coluna: com Minha Conta e a Visão do Sistema — 31 itens em 8 grupos", () => {
    expect({
      grupos: NAV_GROUPS.length,
      itens: NAV_GROUPS.reduce((total, candidato) => total + candidato.items.length, 0),
    }).toEqual({ grupos: 8, itens: 31 });
  });

  it("o endereço antigo não é mais item de menu — quem o guarda é o redirecionamento", () => {
    expect(NAV_GROUPS.flatMap((candidato) => candidato.items).map((item) => item.to)).not.toContain(
      "/settings",
    );
  });
});

describe("cada fatia declara o próprio dono na coluna", () => {
  it("o profissional não alcança nenhuma das seis", () => {
    expect(itensVisiveisDe(fixtureMemberUser, CRITERIOS)).toEqual([]);
  });

  /**
   * O tech lead SEM vínculo não rege régua de time nenhuma e não opera o
   * sistema: sobra a leitura. É o caso que hoje abre a tela inteira e mostra
   * cinco caixas capadas.
   */
  it("o tech lead sem vínculo alcança só a leitura de referência", () => {
    expect(itensVisiveisDe(fixtureUnassignedTechLeadUser, CRITERIOS)).toEqual(["/model-reference"]);
  });

  it("o gerente com vínculo alcança a elegibilidade e a referência, e nada de administração", () => {
    expect(itensVisiveisDe(fixtureAssignedManagerUser, CRITERIOS)).toEqual([
      "/eligibility",
      "/model-reference",
    ]);
  });

  it("quem opera o sistema alcança as seis", () => {
    expect(itensVisiveisDe(fixtureAdminUser, CRITERIOS)).toHaveLength(6);
  });
});
