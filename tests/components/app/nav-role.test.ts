import { describe, expect, it } from "vitest";

import { NAV_GROUPS, filterNavGroups } from "@/lib/navigation-catalog";
import type { SessionUser, UserRole } from "@/lib/api";
import {
  fixtureAdminUser,
  fixtureAssignedManagerUser,
  fixtureMemberUser,
  fixtureAssignedTechLeadUser,
  fixtureSupportUser,
  fixtureUnassignedTechLeadUser,
} from "../../helpers/fixtures";

/**
 * Fase C, tela 1 — `filterNavGroups` passou a receber a SESSÃO, não só o
 * papel: `/team-rules` é do lead COM VÍNCULO, e vínculo mora em
 * `memberships`. As asserções de papel abaixo continuam idênticas; só a
 * forma de dizer "este papel" mudou, via `usuarioDoPapel`.
 */
const usuarioDoPapel = (role: UserRole) =>
  ({
    member: fixtureMemberUser,
    tech_lead: fixtureUnassignedTechLeadUser,
    manager: fixtureAssignedManagerUser,
    admin: fixtureAdminUser,
    support: fixtureSupportUser,
  })[role];

const destinosDe = (user: SessionUser): string[] =>
  filterNavGroups(NAV_GROUPS, user).flatMap((group) => group.items.map((item) => item.to));

const rotulosDe = (user: SessionUser): string[] =>
  filterNavGroups(NAV_GROUPS, user).flatMap((group) => group.items.map((item) => item.labelKey));

/**
 * QW-01/QW-02 (Seção 32, Quick Wins, AUDITORIA-QUINTA-RODADA-360-SYNAPSE-
 * 2026-08-19.md) — "esconder destinos administrativos" e "remover
 * `/settings` da navegação primária". Antes, Matriz de Competências,
 * Usuários e Referência apareciam pra qualquer papel, mesmo sem
 * conseguir fazer nada ali.
 *
 * B-15 (AUDITORIA-FINAL-ENTERPRISE-SYNAPSE-2026-08-22.md, P1-14) reverte só
 * a parte de `/settings`: a rota passou a hospedar a Política de Progressão
 * editável, e escondê-la da navegação quebrava a transparência de carreira
 * (profissional não descobria o próprio critério de elegibilidade). Volta
 * visível a todos os papéis — igual `/cycles` — porque ler a política é
 * legítimo pra qualquer um; só editar continua restrito a admin.
 */
describe("AppShell — navegação recortada por papel", () => {
  /**
   * Onda 33 — Ciclos deixou de ser do profissional: a metade de baixo da
   * tela compara o nível final DELE ciclo a ciclo, e a decisão do dono é que
   * ele não vê os próprios números. O item vira `leadershipOnly`.
   */
  it("member não vê Matriz de Competências, Usuários nem Ciclos", () => {
    const groups = filterNavGroups(NAV_GROUPS, fixtureMemberUser);
    const paths = groups.flatMap((grupo) => grupo.items.map((item) => item.to));
    expect(paths).not.toContain("/competency-matrix");
    expect(paths).not.toContain("/users");
    expect(paths).not.toContain("/cycles");
  });

  /**
   * ONDA 37 — Usuários deixou de ser admin-only: é o ÚNICO lugar de cadastro
   * de pessoa, e o dono definiu que gerente e tech lead cadastram no time
   * deles. O diretório de contas continua administrativo (a tela o nega),
   * mas o DESTINO é da liderança — escondê-lo deixaria as duas personas sem
   * caminho nenhum para cadastrar.
   */
  it("tech lead não vê os destinos admin-only nem Usuários — ele não cadastra (D4, 2026-09-05)", () => {
    const groups = filterNavGroups(NAV_GROUPS, fixtureUnassignedTechLeadUser);
    const paths = groups.flatMap((grupo) => grupo.items.map((item) => item.to));
    expect(paths).not.toContain("/competency-matrix");
    expect(paths).not.toContain("/users");
    expect(
      filterNavGroups(NAV_GROUPS, fixtureAssignedManagerUser).flatMap((grupo) =>
        grupo.items.map((item) => item.to),
      ),
    ).toContain("/users");
  });

  /**
   * PR 5 (adendo do dono, 2026-09-08, item 2) — o antigo admin virou SUPPORT
   * e conserva o menu de quem opera o sistema: matriz, usuários, times, e
   * nada de pessoas (Avaliações, Mentoria) nem de calibração.
   */
  it("SUPPORT vê o sistema — matriz, usuários, times — e não pessoas nem calibração (D1)", () => {
    const paths = destinosDe(fixtureSupportUser);
    expect(paths).toContain("/competency-matrix");
    expect(paths).toContain("/users");
    expect(paths).toContain("/teams");
    expect(paths).not.toContain("/calibration");
    expect(paths).not.toContain("/assessments");
    expect(paths).not.toContain("/mentoring");
    expect(paths).not.toContain("/capability-map");
  });

  it("ADMIN (administrador) vê TUDO o que o gerente vê — calibração inclusa (regra 6) — MAIS a Administração", () => {
    const paths = destinosDe(fixtureAdminUser);
    for (const path of destinosDe(fixtureAssignedManagerUser)) expect(paths, path).toContain(path);
    expect(paths).toContain("/competency-matrix");
    expect(paths).toContain("/users");
    expect(paths).toContain("/teams");
  });

  it("Métricas da Plataforma aparece para admin, support, gerente e tech lead — só o member não vê (adendo 5)", () => {
    for (const user of [
      fixtureAdminUser,
      fixtureSupportUser,
      fixtureAssignedManagerUser,
      fixtureUnassignedTechLeadUser,
    ]) {
      expect(rotulosDe(user), user.role).toContain("nav.platformMetrics");
    }
    expect(rotulosDe(fixtureMemberUser)).not.toContain("nav.platformMetrics");
  });

  /**
   * A CALIBRAÇÃO SAIU DO PRODUTO em 2026-09-10 ("remova a calibração entre
   * líderes, é inútil"), e com ela os dois casos que viviam aqui.
   *
   * Ficam como lápide porque a régua que eles guardavam era boa e vale para a
   * próxima tela de alcance restrito: item de menu que só um papel alcança se
   * prova pelos DOIS lados — quem vê e quem não vê —, senão um `filterNavGroups`
   * que devolvesse tudo passaria no teste de presença.
   */

  /**
   * Onda 31 — o dono reverteu o B-15 para o profissional (2026-09-01): "o
   * profissional não pode ver os menus 'time' e 'política de Progressão'".
   * A política continua legível para quem lidera; o profissional a conhece
   * pela liderança dele, não pela tela.
   */
  /**
   * Onda do GRUPO (dono, 2026-09-10): a tela virou grupo, e a fatia que
   * continua sendo de toda a liderança é a LEITURA do modelo. As cinco de
   * configuração ganharam dono mais estreito — ver
   * `nav-criterios-de-progressao.test.ts`.
   */
  it("Referência do modelo aparece para quem lidera e some para o member", () => {
    const destinosDe = (role: UserRole) =>
      filterNavGroups(NAV_GROUPS, usuarioDoPapel(role)).flatMap((group) =>
        group.items.map((item) => item.to),
      );
    for (const role of ["tech_lead", "manager", "admin", "support"] as const) {
      expect(destinosDe(role), role).toContain("/model-reference");
    }
    expect(destinosDe("member")).not.toContain("/model-reference");
  });

  /**
   * Fase C, tela 1 (spec §1) — a régua do time é de quem LIDERA o time:
   * admin sempre, lead com vínculo `manager|tech_lead`. Papel `lead` sem
   * vínculo nenhum não rege régua alguma e não vê o destino — o item de
   * menu segue a MESMA política da guarda (`canConfigureAnyTeamRules`), em
   * vez de reintroduzir `role === "x"` inline.
   */
  it("/team-rules aparece para admin e para o lead COM vínculo, e some para os demais", () => {
    const destinos = (user: typeof fixtureAdminUser) =>
      filterNavGroups(NAV_GROUPS, user).flatMap((group) => group.items.map((item) => item.to));
    expect(destinos(fixtureAdminUser)).toContain("/team-rules");
    expect(destinos(fixtureAssignedTechLeadUser)).toContain("/team-rules");
    expect(destinos(fixtureUnassignedTechLeadUser)).not.toContain("/team-rules");
    expect(destinos(fixtureMemberUser)).not.toContain("/team-rules");
  });

  it("nenhum grupo fica com cabeçalho e zero itens", () => {
    const groups = filterNavGroups(NAV_GROUPS, fixtureMemberUser);
    expect(groups.every((grupo) => grupo.items.length > 0)).toBe(true);
  });

  /**
   * R2-UX-13 (SYNAPSE-DIRECIONAMENTO-EXECUCAO.md) — Painel, Time e
   * Avaliações eram 3 grupos de item só (sem cabeçalho); agora formam um
   * único grupo "Operação", pra contrastar com "Desenvolvimento" e
   * "Administração" já existentes. Capacidades saiu deste grupo (ver teste
   * abaixo) — feedback ao vivo do product owner (Bloco 7) promoveu-a a
   * grupo próprio.
   */
  /**
   * A VISÃO DO SISTEMA entrou no grupo (`84c03f4`) e esta expectativa ficou
   * para trás — o vermelho já estava em main, com o catálogo certo e o teste
   * velho. Ela é do CATÁLOGO inteiro, sem recorte de papel; quem esconde a
   * Visão do Sistema de quem não opera o sistema é o `filterNavGroups`, e isso
   * os testes de alcance abaixo já prendem.
   *
   * Por que ela existe (onda 3 do Painel, dono 2026-09-09): o Painel Executivo
   * passou a ser a leitura de NEGÓCIO para todo mundo que lidera, e a contagem
   * de operação — pessoas, times, contas, ciclo — saiu dele para tela própria.
   * Duas telas, duas perguntas; antes eram a mesma rota despachando por papel.
   */
  it("Painel Executivo, Visão do Sistema, Talentos do Time e Avaliação de Desempenho formam o grupo 'Gestão'", () => {
    const operationGroup = NAV_GROUPS.find((grupo) => grupo.labelKey === "nav.group.operation");
    expect(operationGroup).toBeTruthy();
    expect(operationGroup?.items.map((item) => item.to)).toEqual([
      "/",
      "/system-view",
      "/team",
      "/assessments",
    ]);
  });

  /**
   * Feedback ao vivo do product owner (SYNAPSE-DIRECIONAMENTO-EXECUCAO.md,
   * Bloco 7) — as 5 sub-telas que antes viviam atrás de um único item
   * ("Capacidades") com abas internas (`CapabilitiesTabs`, removido) agora
   * são um grupo de primeiro nível na barra lateral, cada uma com seu
   * próprio item de menu. `nav.capabilities` (rótulo do item único antigo)
   * é reaproveitado como rótulo do GRUPO, sem chave i18n nova.
   */
  it("Risco de Concentração, Prioridades e Prontidão formam o grupo 'Inteligência de Talentos'", () => {
    const capabilitiesGroup = NAV_GROUPS.find((grupo) => grupo.labelKey === "nav.capabilities");
    expect(capabilitiesGroup).toBeTruthy();
    expect(capabilitiesGroup?.items.map((item) => item.to)).toEqual([
      "/capability-map",
      "/gap-analysis",
      "/progression",
      ]);
  });
});
