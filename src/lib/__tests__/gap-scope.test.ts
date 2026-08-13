import { describe, expect, it } from "vitest";

import { applyArchitectFilter } from "@/components/app/ArchitectFilter";
import { createSelectors } from "../selectors";
import { fixtureState } from "./fixtures";

/**
 * O filtro da tela de Gap Analysis precisa recortar TODOS os widgets — radar,
 * heatmap, prioridades e tabela. Estes testes cobrem a lógica de recorte usada
 * por todos eles.
 */
describe("recorte por arquitetos selecionados", () => {
  const sel = createSelectors(fixtureState);

  it("filtro vazio significa o time inteiro", () => {
    expect(applyArchitectFilter(fixtureState.architects, [])).toHaveLength(2);
  });

  it("mantém apenas os arquitetos escolhidos, na ordem da lista", () => {
    const filtered = applyArchitectFilter(fixtureState.architects, ["bruno"]);
    expect(filtered.map((a) => a.id)).toEqual(["bruno"]);
  });

  it("ignora ids desconhecidos em vez de quebrar", () => {
    expect(applyArchitectFilter(fixtureState.architects, ["ninguem"])).toEqual([]);
  });

  const radarFor = (ids: string[]) => {
    const architects = applyArchitectFilter(fixtureState.architects, ids);
    return fixtureState.categories.map((cat) => {
      const rows = architects.map(
        (a) =>
          sel.domainAverages(a.id).find((d) => d.category.id === cat.id) ?? { avg: 0, target: 0 },
      );
      const mean = (pick: (r: { avg: number; target: number }) => number) =>
        rows.length ? Number((rows.reduce((s, r) => s + pick(r), 0) / rows.length).toFixed(2)) : 0;
      return { domain: cat.short, atual: mean((r) => r.avg), alvo: mean((r) => r.target) };
    });
  };

  it("o radar de um arquiteto usa só os níveis dele", () => {
    const cloud = radarFor(["ana"]).find((r) => r.domain === "Cloud");
    expect(cloud).toMatchObject({ atual: 4, alvo: 4 });
  });

  it("o radar de dois arquitetos é a média entre eles", () => {
    // Ana tem 4 em Cloud, Bruno 2.5 → média 3.25
    const cloud = radarFor(["ana", "bruno"]).find((r) => r.domain === "Cloud");
    expect(cloud?.atual).toBe(3.25);
  });

  it("radar sem ninguém selecionado válido fica zerado, sem NaN", () => {
    for (const row of radarFor(["ninguem"])) {
      expect(row.atual).toBe(0);
      expect(row.alvo).toBe(0);
      expect(Number.isNaN(row.atual)).toBe(false);
    }
  });

  const consolidate = (ids: string[]) => {
    const architects = applyArchitectFilter(fixtureState.architects, ids);
    const map = new Map<string, { people: number; totalGap: number; maxGap: number }>();
    for (const architect of architects) {
      for (const gap of sel.gapsFor(architect.id)) {
        if (gap.gap <= 0 || !gap.competency) continue;
        const current = map.get(gap.competency.id) ?? { people: 0, totalGap: 0, maxGap: 0 };
        map.set(gap.competency.id, {
          people: current.people + 1,
          totalGap: current.totalGap + gap.gap,
          maxGap: Math.max(current.maxGap, gap.gap),
        });
      }
    }
    return map;
  };

  it("as prioridades somam o impacto apenas dos arquitetos filtrados", () => {
    const soBruno = consolidate(["bruno"]);
    expect(soBruno.get("security-iam")).toMatchObject({ people: 1, totalGap: 1 });
    expect(soBruno.get("cloud-k8s")).toMatchObject({ people: 1, totalGap: 1 });

    const ambos = consolidate(["ana", "bruno"]);
    // security-iam tem gap nos dois; cloud-k8s só no Bruno.
    expect(ambos.get("security-iam")).toMatchObject({ people: 2, totalGap: 2 });
    expect(ambos.get("cloud-k8s")).toMatchObject({ people: 1, totalGap: 1 });
  });

  it("competência adequada para todos não aparece na consolidação", () => {
    expect(consolidate([]).has("cloud-serverless")).toBe(false);
  });
});
