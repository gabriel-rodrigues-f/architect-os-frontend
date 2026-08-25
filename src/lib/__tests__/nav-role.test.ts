import { describe, expect, it } from "vitest";

import { filterNavGroups, NAV_GROUPS, partitionGroupItems } from "@/components/app/AppShell";

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
  it("member não vê Matriz de Competências nem Usuários, mas continua vendo Ciclos", () => {
    const groups = filterNavGroups(NAV_GROUPS, "member");
    const paths = groups.flatMap((g) => g.items.map((i) => i.to));
    expect(paths).not.toContain("/competency-matrix");
    expect(paths).not.toContain("/users");
    expect(paths).toContain("/cycles");
  });

  it("lead também não vê os destinos admin-only", () => {
    const groups = filterNavGroups(NAV_GROUPS, "lead");
    const paths = groups.flatMap((g) => g.items.map((i) => i.to));
    expect(paths).not.toContain("/competency-matrix");
    expect(paths).not.toContain("/users");
  });

  it("admin vê tudo, incluindo os destinos admin-only", () => {
    const groups = filterNavGroups(NAV_GROUPS, "admin");
    const paths = groups.flatMap((g) => g.items.map((i) => i.to));
    expect(paths).toContain("/competency-matrix");
    expect(paths).toContain("/users");
  });

  it("/settings (Política de Progressão) aparece na navegação para todos os papéis", () => {
    for (const role of ["member", "lead", "admin"]) {
      const groups = filterNavGroups(NAV_GROUPS, role);
      const paths = groups.flatMap((g) => g.items.map((i) => i.to));
      expect(paths).toContain("/settings");
    }
  });

  it("nenhum grupo fica com cabeçalho e zero itens", () => {
    const groups = filterNavGroups(NAV_GROUPS, "member");
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
 * UI). `partitionGroupItems` é a função pura por trás da correção: separa
 * o item ativo (fixo, nunca recolhe) dos irmãos (recolhem/expandem juntos).
 */
describe("partitionGroupItems — item ativo fixo, irmãos recolhem juntos", () => {
  it("sem rota ativa no grupo, todos os itens ficam no conjunto recolhível", () => {
    const group = NAV_GROUPS.find((g) => g.labelKey === "nav.group.development")!;
    const { pinned, collapsible } = partitionGroupItems(group, "/settings");
    expect(pinned).toEqual([]);
    expect(collapsible).toEqual(group.items);
  });

  it("com rota ativa no grupo, ela fica fixada e o resto vai para o conjunto recolhível", () => {
    const group = NAV_GROUPS.find((g) => g.labelKey === "nav.group.operation")!;
    const { pinned, collapsible } = partitionGroupItems(group, "/team");
    expect(pinned.map((i) => i.to)).toEqual(["/team"]);
    expect(collapsible.map((i) => i.to)).toEqual(["/", "/assessments"]);
  });
});
