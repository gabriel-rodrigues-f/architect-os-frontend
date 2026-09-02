import { describe, expect, it } from "vitest";

import { filterNavGroups, isNavItemHiddenByCollapse, NAV_GROUPS } from "@/components/app/AppShell";
import type { UserRole } from "@/lib/api";
import {
  fixtureAdminUser,
  fixtureAssignedManagerUser,
  fixtureMemberUser,
  fixtureAssignedTechLeadUser,
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
  })[role];

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
    const paths = groups.flatMap((g) => g.items.map((i) => i.to));
    expect(paths).not.toContain("/competency-matrix");
    expect(paths).not.toContain("/users");
    expect(paths).not.toContain("/cycles");
  });

  it("lead também não vê os destinos admin-only", () => {
    const groups = filterNavGroups(NAV_GROUPS, fixtureUnassignedTechLeadUser);
    const paths = groups.flatMap((g) => g.items.map((i) => i.to));
    expect(paths).not.toContain("/competency-matrix");
    expect(paths).not.toContain("/users");
  });

  it("admin vê tudo, incluindo os destinos admin-only", () => {
    const groups = filterNavGroups(NAV_GROUPS, fixtureAdminUser);
    const paths = groups.flatMap((g) => g.items.map((i) => i.to));
    expect(paths).toContain("/competency-matrix");
    expect(paths).toContain("/users");
    expect(paths).toContain("/calibration");
  });

  /**
   * Tela 3 (spec §3, CONTRATO PRD-03) — a calibração é de gestor + admin. Com
   * os quatro papéis (backend ADR-0047) o contrato ficou dizível: o destino
   * aparece para quem calibra e some para quem não calibra. Enquanto só
   * existia `lead`, abrir a navegação teria entregado a leitura ao tech lead
   * junto — por isso a rota nasceu admin-only.
   */
  it("o gestor vê o destino de Calibração — é dele a leitura que o contrato reserva", () => {
    const groups = filterNavGroups(NAV_GROUPS, usuarioDoPapel("manager"));
    const paths = groups.flatMap((group) => group.items.map((item) => item.to));
    expect(paths).toContain("/calibration");
  });

  it("member e tech lead não veem o destino de Calibração", () => {
    for (const role of ["member", "tech_lead"] as const) {
      const groups = filterNavGroups(NAV_GROUPS, usuarioDoPapel(role));
      const paths = groups.flatMap((group) => group.items.map((item) => item.to));
      expect(paths, role).not.toContain("/calibration");
    }
  });

  /**
   * Onda 31 — o dono reverteu o B-15 para o profissional (2026-09-01): "o
   * profissional não pode ver os menus 'time' e 'política de Progressão'".
   * A política continua legível para quem lidera; o profissional a conhece
   * pela liderança dele, não pela tela.
   */
  it("/settings (Política de Progressão) aparece para quem lidera e some para o member", () => {
    const destinosDe = (role: UserRole) =>
      filterNavGroups(NAV_GROUPS, usuarioDoPapel(role)).flatMap((group) =>
        group.items.map((item) => item.to),
      );
    for (const role of ["tech_lead", "manager", "admin"] as const) {
      expect(destinosDe(role), role).toContain("/settings");
    }
    expect(destinosDe("member")).not.toContain("/settings");
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
    expect(groups.every((g) => g.items.length > 0)).toBe(true);
  });

  /**
   * R2-UX-13 (SYNAPSE-DIRECIONAMENTO-EXECUCAO.md) — Painel, Time e
   * Avaliações eram 3 grupos de item só (sem cabeçalho); agora formam um
   * único grupo "Operação", pra contrastar com "Desenvolvimento" e
   * "Administração" já existentes. Capacidades saiu deste grupo (ver teste
   * abaixo) — feedback ao vivo do product owner (Bloco 7) promoveu-a a
   * grupo próprio.
   */
  it("Painel, Time e Avaliações formam o grupo 'Operação'", () => {
    const operationGroup = NAV_GROUPS.find((g) => g.labelKey === "nav.group.operation");
    expect(operationGroup).toBeTruthy();
    expect(operationGroup?.items.map((i) => i.to)).toEqual(["/", "/team", "/assessments"]);
  });

  /**
   * Feedback ao vivo do product owner (SYNAPSE-DIRECIONAMENTO-EXECUCAO.md,
   * Bloco 7) — as 5 sub-telas que antes viviam atrás de um único item
   * ("Capacidades") com abas internas (`CapabilitiesTabs`, removido) agora
   * são um grupo de primeiro nível na barra lateral, cada uma com seu
   * próprio item de menu. `nav.capabilities` (rótulo do item único antigo)
   * é reaproveitado como rótulo do GRUPO, sem chave i18n nova.
   */
  it("Cobertura, Prioridades, Progressão, Necessidades de Treinamento e Comparativo formam o grupo 'Capacidades'", () => {
    const capabilitiesGroup = NAV_GROUPS.find((g) => g.labelKey === "nav.capabilities");
    expect(capabilitiesGroup).toBeTruthy();
    expect(capabilitiesGroup?.items.map((i) => i.to)).toEqual([
      "/capability-map",
      "/gap-analysis",
      "/progression",
      "/training-needs",
      "/compare",
    ]);
  });
});

/**
 * Feedback ao vivo do product owner (SYNAPSE-DIRECIONAMENTO-EXECUCAO.md,
 * Bloco 7) — antes, o grupo da rota ativa nunca podia ser recolhido de
 * verdade (ver `nav-collapsible-groups.test.tsx` para o comportamento de
 * UI). `isNavItemHiddenByCollapse` é a função pura por trás da correção
 * final: cada item esconde no PRÓPRIO lugar da lista, nunca reordena — a
 * primeira tentativa (`partitionGroupItems`, removida) extraía o item
 * ativo pra um slot fixo, o que reordenava a lista toda vez que o item
 * ativo mudava, mesmo com o grupo expandido (bug real, reportado pelo
 * usuário, coberto pelo teste "trocar a rota ativa não reordena o grupo
 * expandido" em `nav-collapsible-groups.test.tsx` — é exatamente o tipo
 * de caso que uma função pura testada em isolamento, ANTES de plugar na
 * renderização, deveria ter pego).
 */
describe("isNavItemHiddenByCollapse — esconde no próprio lugar, nunca reordena", () => {
  const group = NAV_GROUPS.find((g) => g.labelKey === "nav.group.operation")!;

  it("grupo expandido: nenhum item esconde, não importa qual rota está ativa", () => {
    for (const pathname of ["/", "/team", "/assessments", "/rota-que-nao-existe"]) {
      for (const item of group.items) {
        expect(isNavItemHiddenByCollapse(item, pathname, false)).toBe(false);
      }
    }
  });

  it("grupo recolhido, sem rota ativa dentro: todos os itens escondem", () => {
    for (const item of group.items) {
      expect(isNavItemHiddenByCollapse(item, "/settings", true)).toBe(true);
    }
  });

  it("grupo recolhido, com rota ativa dentro: só o item ativo continua visível", () => {
    const activeItem = group.items.find((i) => i.to === "/team")!;
    expect(isNavItemHiddenByCollapse(activeItem, "/team", true)).toBe(false);
    for (const item of group.items.filter((i) => i.to !== "/team")) {
      expect(isNavItemHiddenByCollapse(item, "/team", true)).toBe(true);
    }
  });
});
