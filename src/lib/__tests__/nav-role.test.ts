import { describe, expect, it } from "vitest";

import { filterNavGroups, NAV_GROUPS } from "@/components/app/AppShell";

/**
 * QW-01/QW-02 (Seção 32, Quick Wins, AUDITORIA-QUINTA-RODADA-360-SYNAPSE-
 * 2026-08-19.md) — "esconder destinos administrativos" e "remover
 * `/settings` da navegação primária". Antes, Matriz de Competências,
 * Usuários e Referência apareciam pra qualquer papel, mesmo sem
 * conseguir fazer nada ali.
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

  it("/settings não aparece na navegação primária para nenhum papel", () => {
    for (const role of ["member", "lead", "admin"]) {
      const groups = filterNavGroups(NAV_GROUPS, role);
      const paths = groups.flatMap((g) => g.items.map((i) => i.to));
      expect(paths).not.toContain("/settings");
    }
  });

  it("nenhum grupo fica com cabeçalho e zero itens", () => {
    const groups = filterNavGroups(NAV_GROUPS, "member");
    expect(groups.every((g) => g.items.length > 0)).toBe(true);
  });
});
