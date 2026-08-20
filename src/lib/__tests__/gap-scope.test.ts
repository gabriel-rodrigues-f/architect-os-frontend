import { describe, expect, it } from "vitest";

import { applyArchitectFilter } from "@/components/app/ArchitectFilter";
import { averageWithCoverage, createSelectors } from "../selectors";
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

  /** Espelha exatamente o radar de gap-analysis.tsx — mesma função exportada, não uma cópia da regra. */
  const radarFor = (ids: string[]) => {
    const architects = applyArchitectFilter(fixtureState.architects, ids);
    return fixtureState.capabilities.map((cat) => {
      const rows = architects.map((a) =>
        sel.capabilityAverages(a.id).find((d) => d.capability.id === cat.id),
      );
      const atual = averageWithCoverage(rows.map((r) => r?.avg));
      const alvo = averageWithCoverage(rows.map((r) => r?.target));
      return {
        domain: cat.short,
        atual: Number((atual.avg ?? 0).toFixed(2)),
        alvo: Number((alvo.avg ?? 0).toFixed(2)),
        covered: atual.covered,
        total: atual.total,
      };
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
      expect(row.covered).toBe(0);
      expect(Number.isNaN(row.atual)).toBe(false);
    }
  });

  // AUDITORIA-RIGIDA-SEGUNDA-REVISAO-SYNAPSE.md, Seção 9 — quem não tem
  // assessment oficial não pode puxar a média do grupo para baixo como se
  // tivesse nível 0.
  it("pessoa sem assessment oficial não entra na média da capacidade, só na cobertura", () => {
    const semAssessment = createSelectors({
      ...fixtureState,
      architects: [...fixtureState.architects, { ...fixtureState.architects[0]!, id: "diego" }],
    });
    const rows = fixtureState.capabilities.map((cat) => {
      const pontos = ["ana", "diego"].map((id) =>
        semAssessment.capabilityAverages(id).find((d) => d.capability.id === cat.id),
      );
      return { domain: cat.short, ...averageWithCoverage(pontos.map((p) => p?.avg)) };
    });
    const cloud = rows.find((r) => r.domain === "Cloud");
    // Ana tem 4 em Cloud; "diego" não tem assessment — média real é 4, não (4+0)/2=2.
    expect(cloud?.avg).toBe(4);
    expect(cloud).toMatchObject({ covered: 1, total: 2 });
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
