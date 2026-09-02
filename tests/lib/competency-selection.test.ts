import { describe, expect, it } from "vitest";

import type { Competency } from "@/lib/domain";
import { CompetencySelection } from "@/lib/view-models/competency-selection";

/**
 * Onda 35, achado 16 — a seleção para exclusão em massa é estado de domínio
 * de tela, com regra própria (marcar a capacidade inteira marca as
 * competências ATIVAS dela; desmarcar uma delas desfaz "todas"). Mora na
 * classe, não no JSX: a rota só a consome.
 */

const competencies: Competency[] = [
  { id: "k8s", name: "Kubernetes", capabilityId: "cloud", active: true },
  { id: "serverless", name: "Serverless", capabilityId: "cloud", active: true },
  { id: "old", name: "Antiga", capabilityId: "cloud", active: false },
  { id: "iam", name: "IAM", capabilityId: "security", active: true },
];

describe("CompetencySelection", () => {
  it("nasce vazia e conta o que está marcado", () => {
    const selection = CompetencySelection.empty();
    expect(selection.count).toBe(0);
    expect(selection.isEmpty).toBe(true);
    expect(selection.toggle("k8s").toggle("iam").count).toBe(2);
  });

  it("marcar duas vezes desmarca", () => {
    const selection = CompetencySelection.empty().toggle("k8s").toggle("k8s");
    expect(selection.has("k8s")).toBe(false);
  });

  it("marcar a capacidade inteira marca só as competências ativas dela", () => {
    const selection = CompetencySelection.empty().toggleCapability("cloud", competencies);
    expect(selection.ids).toEqual(["k8s", "serverless"]);
    expect(selection.has("old")).toBe(false);
    expect(selection.capabilityState("cloud", competencies)).toBe("all");
  });

  it("com todas marcadas, marcar a capacidade de novo desmarca todas", () => {
    const selection = CompetencySelection.empty()
      .toggleCapability("cloud", competencies)
      .toggleCapability("cloud", competencies);
    expect(selection.isEmpty).toBe(true);
    expect(selection.capabilityState("cloud", competencies)).toBe("none");
  });

  it("com parte marcada, a capacidade está 'some' e marcá-la completa o conjunto", () => {
    const partial = CompetencySelection.empty().toggle("k8s");
    expect(partial.capabilityState("cloud", competencies)).toBe("some");
    expect(partial.toggleCapability("cloud", competencies).ids).toEqual(["k8s", "serverless"]);
  });

  it("capacidade sem competência ativa nunca está 'all'", () => {
    expect(CompetencySelection.empty().capabilityState("empty", competencies)).toBe("none");
  });

  it("é imutável: alternar devolve outra seleção e preserva a anterior", () => {
    const before = CompetencySelection.empty().toggle("k8s");
    const after = before.toggle("iam");
    expect(before.count).toBe(1);
    expect(after.count).toBe(2);
  });

  it("nomeia o que está marcado, na ordem do catálogo, ignorando id desconhecido", () => {
    const selection = CompetencySelection.empty().toggle("iam").toggle("k8s").toggle("ghost");
    expect(selection.chosenFrom(competencies).map((competency) => competency.name)).toEqual([
      "Kubernetes",
      "IAM",
    ]);
  });
});
