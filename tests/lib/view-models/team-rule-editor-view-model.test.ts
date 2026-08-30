import { describe, expect, it } from "vitest";

import type { Competency } from "@/lib/domain";
import en from "@/locales/en.json";
import pt from "@/locales/pt.json";
import type { TeamRuleView } from "@/lib/gateways/career.gateway";
import { TeamRuleEditorViewModel, type TeamRuleErrorKey } from "@/lib/view-models";

/**
 * Fase C, tela 1 (spec-telas-novas-2026-08-29 §1) — o NÚCLEO da régua do
 * time. As três recusas abaixo são decisão de CONTRATO, não preferência de
 * tela: o piso ≥ floor é a mesma regra do `settings.tsx`, a competência só
 * pesa dentro de uma capacidade que a régua exige, e o nível vive em 1..5
 * (ADR-0032 tirou o nível exigido do catálogo global e o pôs AQUI).
 */

const FLOOR = 3;

const CATALOG: Competency[] = [
  { id: "clean-core", name: "Clean Core", capabilityId: "cap-btp", active: true },
  { id: "eventos", name: "Eventos", capabilityId: "cap-btp", active: true },
  { id: "malha", name: "Malha de integração", capabilityId: "cap-integracao", active: true },
  { id: "contratos", name: "Contratos de API", capabilityId: "cap-integracao", active: true },
];

function competencyById(id: string): Competency | undefined {
  return CATALOG.find((competency) => competency.id === id);
}

const RULE: TeamRuleView = {
  id: "regra-1",
  teamId: "time-plataforma",
  careerLevelId: "pleno",
  minimumQualifiedCapabilities: 4,
  capabilityIds: ["cap-btp"],
  competencies: [{ competencyId: "clean-core", requirementType: "RESTRICTIVE", requiredLevel: 3 }],
};

function editorSemRegua(): TeamRuleEditorViewModel {
  return TeamRuleEditorViewModel.from({ floor: FLOOR, competencyById, rule: null });
}

function editorComRegua(): TeamRuleEditorViewModel {
  return TeamRuleEditorViewModel.from({ floor: FLOOR, competencyById, rule: RULE });
}

describe("TeamRuleEditorViewModel — o rascunho da régua", () => {
  it("sem régua no servidor, o rascunho nasce no piso mínimo e sem nada exigido", () => {
    const editor = editorSemRegua();

    expect(editor.minimumQualifiedCapabilities).toBe(FLOOR);
    expect(editor.capabilityIds).toEqual([]);
    expect(editor.competencies).toEqual([]);
    expect(editor.hasRule).toBe(false);
    expect(editor.isDirty).toBe(false);
  });

  it("com régua, o rascunho começa igual ao que o servidor entregou", () => {
    const editor = editorComRegua();

    expect(editor.minimumQualifiedCapabilities).toBe(4);
    expect(editor.capabilityIds).toEqual(["cap-btp"]);
    expect(editor.competencies).toEqual(RULE.competencies);
    expect(editor.hasRule).toBe(true);
    expect(editor.isDirty).toBe(false);
  });
});

describe("TeamRuleEditorViewModel — recusas de contrato", () => {
  it("recusa piso menor que o floor da organização", () => {
    const editor = editorComRegua().withMinimum(FLOOR - 1);

    expect(editor.errorKeys).toContain("teamRules.error.minimumBelowFloor");
    expect(editor.isValid).toBe(false);
    expect(editor.definition()).toBeNull();
  });

  it("aceita piso exatamente igual ao floor — o limite é inclusivo", () => {
    const editor = editorComRegua().withMinimum(FLOOR);

    expect(editor.errorKeys).toEqual([]);
    expect(editor.isValid).toBe(true);
  });

  it("recusa competência cuja capacidade não está na régua", () => {
    const editor = editorComRegua().withCompetencyRequired("malha", 3);

    expect(editor.errorKeys).toContain("teamRules.error.competencyWithoutCapability");
    expect(editor.isValid).toBe(false);
    expect(editor.definition()).toBeNull();
  });

  it("aceita a mesma competência assim que a capacidade dela entra na régua", () => {
    const editor = editorComRegua()
      .withCapability("cap-integracao", true)
      .withCompetencyRequired("malha", 3);

    expect(editor.errorKeys).toEqual([]);
    expect(editor.isValid).toBe(true);
  });

  it("recusa nível exigido abaixo de 1 e acima de 5", () => {
    for (const nivel of [0, -1, 6, 2.5]) {
      const editor = editorComRegua().withRequiredLevel("clean-core", nivel);

      expect(editor.errorKeys, `nível ${nivel}`).toContain("teamRules.error.levelOutOfRange");
      expect(editor.isValid, `nível ${nivel}`).toBe(false);
      expect(editor.definition(), `nível ${nivel}`).toBeNull();
    }
  });

  it("aceita as cinco pontas da escala", () => {
    for (const nivel of [1, 2, 3, 4, 5]) {
      const editor = editorComRegua().withRequiredLevel("clean-core", nivel);

      expect(editor.errorKeys, `nível ${nivel}`).toEqual([]);
      expect(editor.definition()?.competencies[0]?.requiredLevel, `nível ${nivel}`).toBe(nivel);
    }
  });
});

describe("TeamRuleEditorViewModel — rascunho sujo", () => {
  it("marca sujo quando o piso muda e limpo quando ele volta ao original", () => {
    const sujo = editorComRegua().withMinimum(5);
    expect(sujo.isDirty).toBe(true);

    expect(sujo.withMinimum(4).isDirty).toBe(false);
  });

  it("marca sujo ao ligar capacidade, ao trocar obrigatoriedade e ao mexer no nível", () => {
    expect(editorComRegua().withCapability("cap-integracao", true).isDirty).toBe(true);
    expect(editorComRegua().withCompetencyOptional("clean-core", 3).isDirty).toBe(true);
    expect(editorComRegua().withRequiredLevel("clean-core", 4).isDirty).toBe(true);
  });

  it("desligar a capacidade tira junto as competências dela — não fica exigência órfã", () => {
    const editor = editorComRegua().withCapability("cap-btp", false);

    expect(editor.capabilityIds).toEqual([]);
    expect(editor.competencies).toEqual([]);
    expect(editor.isValid).toBe(true);
  });
});

describe("TeamRuleEditorViewModel — o corpo do PUT", () => {
  it("monta a definição inteira: piso, capacidades e competências", () => {
    const editor = editorComRegua()
      .withCapability("cap-integracao", true)
      .withCompetencyOptional("malha", 2);

    expect(editor.definition()).toEqual({
      minimumQualifiedCapabilities: 4,
      capabilityIds: ["cap-btp", "cap-integracao"],
      competencies: [
        { competencyId: "clean-core", requirementType: "RESTRICTIVE", requiredLevel: 3 },
        { competencyId: "malha", requirementType: "NON_RESTRICTIVE", requiredLevel: 2 },
      ],
    });
  });
});

describe("TeamRuleEditorViewModel — o peso por razão (CONTRATO 2026-08-28)", () => {
  it("conta obrigatórias e opcionais e fecha o peso em 1,5× + 1×", () => {
    const editor = editorComRegua()
      .withCapability("cap-integracao", true)
      .withCompetencyRequired("eventos", 3)
      .withCompetencyOptional("malha", 2)
      .withCompetencyOptional("contratos", 2);

    expect(editor.requiredCount).toBe(2);
    expect(editor.optionalCount).toBe(2);
    expect(editor.totalWeight).toBe(5);
  });

  it("a obrigatória pesa 1,5× o que pesa a opcional, e o conjunto fecha em 100%", () => {
    const editor = editorComRegua()
      .withCapability("cap-integracao", true)
      .withCompetencyRequired("eventos", 3)
      .withCompetencyRequired("malha", 3)
      .withCompetencyOptional("contratos", 2);

    const obrigatoria = editor.weightPercentOf("clean-core");
    const opcional = editor.weightPercentOf("contratos");

    expect(obrigatoria / opcional).toBeCloseTo(1.5, 10);
    expect(
      editor.competencies.reduce(
        (soma, competencia) => soma + editor.weightPercentOf(competencia.competencyId),
        0,
      ),
    ).toBeCloseTo(100, 10);
  });

  it("sem competência nenhuma, o peso é zero e não divide por zero", () => {
    const editor = editorSemRegua();

    expect(editor.totalWeight).toBe(0);
    expect(editor.weightPercentOf("clean-core")).toBe(0);
  });
});

describe("TeamRuleEditorViewModel — trocar obrigatoriedade com o par", () => {
  it("oferece como par só quem está do outro lado da obrigatoriedade", () => {
    const editor = editorComRegua()
      .withCapability("cap-integracao", true)
      .withCompetencyOptional("malha", 2)
      .withCompetencyOptional("contratos", 2);

    expect(
      editor.swapCandidatesFor("clean-core").map((candidato) => candidato.competencyId),
    ).toEqual(["malha", "contratos"]);
    expect(editor.swapCandidatesFor("malha").map((candidato) => candidato.competencyId)).toEqual([
      "clean-core",
    ]);
  });

  it("competência fora da régua não tem par para trocar", () => {
    expect(editorComRegua().swapCandidatesFor("malha")).toEqual([]);
  });
});

describe("TeamRuleEditorViewModel — as recusas falam PT-BR na tela", () => {
  const chaves: TeamRuleErrorKey[] = [
    "teamRules.error.minimumBelowFloor",
    "teamRules.error.competencyWithoutCapability",
    "teamRules.error.levelOutOfRange",
  ];

  it("toda chave de recusa tem texto nos dois idiomas — chave crua na tela é defeito", () => {
    for (const chave of chaves) {
      expect(Object.keys(pt), chave).toContain(chave);
      expect(Object.keys(en), chave).toContain(chave);
    }
  });
});
