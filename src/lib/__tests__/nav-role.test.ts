import { describe, expect, it } from "vitest";

import { filterNavGroups, NAV_GROUPS } from "@/components/app/AppShell";

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
});
