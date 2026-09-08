import { describe, expect, it } from "vitest";

import { PersonPicker } from "@/lib/person-selection";
import { createSelectors } from "@/lib/selectors";
import { fixtureState } from "../helpers/fixtures";

/**
 * O filtro da tela de Gap Analysis precisa recortar TODOS os widgets — radar,
 * heatmap, prioridades e tabela. Estes testes cobrem a lógica de recorte usada
 * por todos eles.
 */
describe("recorte por profissionais selecionados", () => {
  const sel = createSelectors(fixtureState);

  /**
   * `selected` é sempre explícito (ver doc de `person-selection.ts`): vazio
   * significa ninguém selecionado, não "todo o time". Quem chama decide o
   * valor inicial (normalmente todo mundo já marcado) para a tela nunca
   * nascer mostrando ninguém por engano — mas isso é responsabilidade de
   * quem inicializa o `useState`, não desta função.
   */
  it("filtro vazio significa ninguém selecionado", () => {
    expect(PersonPicker.peopleIn(fixtureState.professionals, [])).toHaveLength(0);
  });

  it("mantém apenas os profissionais escolhidos, na ordem da lista", () => {
    const filtered = PersonPicker.peopleIn(fixtureState.professionals, ["bruno"]);
    expect(filtered.map((a) => a.id)).toEqual(["bruno"]);
  });

  it("ignora ids desconhecidos em vez de quebrar", () => {
    expect(PersonPicker.peopleIn(fixtureState.professionals, ["ninguem"])).toEqual([]);
  });

  /** OO3-11k — chama `sel.teamAverageFor` (a regra do radar), em vez de reimplementá-la aqui. */
  const radarFor = (ids: string[]) => {
    const professionals = PersonPicker.peopleIn(fixtureState.professionals, ids);
    return fixtureState.capabilities.map((cat) => {
      const { atual, alvo } = sel.teamAverageFor(cat.id, professionals);
      return {
        domain: cat.short,
        atual: Number((atual.avg ?? 0).toFixed(2)),
        alvo: Number((alvo.avg ?? 0).toFixed(2)),
        covered: atual.covered,
        total: atual.total,
      };
    });
  };

  it("o radar de um profissional usa só os níveis dele", () => {
    const cloud = radarFor(["ana"]).find((r) => r.domain === "Cloud");
    expect(cloud).toMatchObject({ atual: 4, alvo: 4 });
  });

  it("o radar de dois profissionais é a média entre eles", () => {
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
      professionals: [
        ...fixtureState.professionals,
        { ...fixtureState.professionals[0]!, id: "diego" },
      ],
    });
    const rows = fixtureState.capabilities.map((cat) => ({
      domain: cat.short,
      ...semAssessment.teamAverageFor(cat.id, [{ id: "ana" }, { id: "diego" }]).atual,
    }));
    const cloud = rows.find((r) => r.domain === "Cloud");
    // Ana tem 4 em Cloud; "diego" não tem assessment — média real é 4, não (4+0)/2=2.
    expect(cloud?.avg).toBe(4);
    expect(cloud).toMatchObject({ covered: 1, total: 2 });
  });

  const consolidate = (ids: string[]) => {
    const professionals = PersonPicker.peopleIn(fixtureState.professionals, ids);
    const map = new Map<string, { people: number; totalGap: number; maxGap: number }>();
    for (const professional of professionals) {
      for (const gap of sel.gapsFor(professional.id)) {
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

  it("as prioridades somam o impacto apenas dos profissionais filtrados", () => {
    const soBruno = consolidate(["bruno"]);
    expect(soBruno.get("security-iam")).toMatchObject({ people: 1, totalGap: 1 });
    expect(soBruno.get("cloud-k8s")).toMatchObject({ people: 1, totalGap: 1 });

    const ambos = consolidate(["ana", "bruno"]);
    // security-iam tem gap nos dois; cloud-k8s só no Bruno.
    expect(ambos.get("security-iam")).toMatchObject({ people: 2, totalGap: 2 });
    expect(ambos.get("cloud-k8s")).toMatchObject({ people: 1, totalGap: 1 });
  });

  it("competência adequada para todos não aparece na consolidação", () => {
    // Todo mundo explicitamente selecionado — vazio agora significa "ninguém", não "todos".
    expect(consolidate(["ana", "bruno"]).has("cloud-serverless")).toBe(false);
  });
});
