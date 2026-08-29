import { describe, expect, it } from "vitest";

import type { CareerLevel, Competency, LearningPath } from "@/lib/domain";
import type { ArchitectAdherence } from "@/lib/gateways/career.gateway";
import { CareerRoadmapViewModel, LearningPathsViewModel } from "@/lib/view-models";

/**
 * Tela 5 (spec-telas-novas-2026-08-29, FASE A) — o roteiro para o próximo
 * nível é COMPOSIÇÃO da aderência já servida pelo backend: a VM resolve o
 * próximo nível pelo rank, dá nome às faltantes pelo catálogo e cruza as
 * faltantes com as trilhas. O CONTRATO manda os DOIS números sempre — a VM
 * preserva a lista de obrigatórias faltantes inteira, nunca só a %.
 */
const LEVELS: CareerLevel[] = [
  { id: "nivel-junior", name: "Júnior", rank: 1 },
  { id: "nivel-pleno", name: "Pleno", rank: 2 },
  { id: "nivel-senior", name: "Sênior", rank: 3 },
];

const CATALOG = new Map<string, Competency>([
  ["comp-clean-core", { id: "comp-clean-core", name: "Clean Core", capabilityId: "cap-btp", active: true }],
  ["comp-eventos", { id: "comp-eventos", name: "Arquitetura de Eventos", capabilityId: "cap-int", active: true }],
  ["comp-cds", { id: "comp-cds", name: "Modelagem CDS", capabilityId: "cap-btp", active: true }],
]);

function adherence(
  missing: { competencyId: string; currentLevel: number; requiredLevel: number }[],
): ArchitectAdherence {
  return {
    architectId: "ana",
    teamId: "time-integracao",
    careerLevelId: "nivel-pleno",
    adherence: { percentage: 72, missingRequired: missing },
  };
}

function path(overrides: Partial<LearningPath>): LearningPath {
  return {
    id: "trilha-1",
    name: "Trilha BTP",
    description: "",
    competencyIds: [],
    assignedTo: [],
    items: [],
    progress: [],
    ...overrides,
  };
}

const idleLearningService = {
  addLearningPath: () => Promise.reject(new Error("não usado")),
  updateLearningPath: () => undefined,
  removeLearningPath: () => undefined,
  addLearningPathItem: () => undefined,
  removeLearningPathItem: () => undefined,
  updateLearningItemProgress: () => undefined,
} as never;

function makeVm(levels: CareerLevel[] = LEVELS) {
  return new CareerRoadmapViewModel(
    levels,
    (id) => CATALOG.get(id),
    new LearningPathsViewModel(idleLearningService),
  );
}

describe("CareerRoadmapViewModel — próximo nível", () => {
  it("resolve o próximo nível pelo rank imediatamente acima", () => {
    const vm = makeVm();
    expect(vm.nextLevelFor("nivel-junior")?.id).toBe("nivel-pleno");
    expect(vm.nextLevelFor("nivel-pleno")?.id).toBe("nivel-senior");
  });

  it("topo da escada não tem próximo nível", () => {
    expect(makeVm().nextLevelFor("nivel-senior")).toBeNull();
  });

  it("sem nível atual (ou nível desconhecido) não inventa próximo", () => {
    const vm = makeVm();
    expect(vm.nextLevelFor(null)).toBeNull();
    expect(vm.nextLevelFor(undefined)).toBeNull();
    expect(vm.nextLevelFor("nivel-fantasma")).toBeNull();
  });

  it("pula buracos de rank: o próximo é o menor rank acima do atual", () => {
    const vm = makeVm([
      { id: "n1", name: "A", rank: 1 },
      { id: "n4", name: "B", rank: 4 },
    ]);
    expect(vm.nextLevelFor("n1")?.id).toBe("n4");
  });
});

describe("CareerRoadmapViewModel — obrigatórias faltantes (o segundo número do CONTRATO)", () => {
  it("dá nome às faltantes pelo catálogo e calcula o gap, ordenando do maior gap para o menor", () => {
    const vm = makeVm();
    const missing = vm.missingRequired(
      adherence([
        { competencyId: "comp-clean-core", currentLevel: 2, requiredLevel: 3 },
        { competencyId: "comp-eventos", currentLevel: 1, requiredLevel: 4 },
      ]),
    );
    expect(missing.map((m) => m.name)).toEqual(["Arquitetura de Eventos", "Clean Core"]);
    expect(missing[0]).toMatchObject({ currentLevel: 1, requiredLevel: 4, gap: 3 });
    expect(missing[1]).toMatchObject({ gap: 1 });
  });

  it("competência fora do catálogo não some da lista — aparece pelo id", () => {
    const vm = makeVm();
    const missing = vm.missingRequired(
      adherence([{ competencyId: "comp-desconhecida", currentLevel: 0, requiredLevel: 2 }]),
    );
    expect(missing).toHaveLength(1);
    expect(missing[0]?.name).toBe("comp-desconhecida");
  });
});

describe("CareerRoadmapViewModel — cobertura das trilhas", () => {
  const MISSING = [
    { competencyId: "comp-clean-core", currentLevel: 2, requiredLevel: 3 },
    { competencyId: "comp-eventos", currentLevel: 1, requiredLevel: 4 },
    { competencyId: "comp-cds", currentLevel: 2, requiredLevel: 4 },
  ];

  it("cruza faltantes com competencyIds das trilhas: só a interseção conta, trilha sem interseção sai", () => {
    const vm = makeVm();
    const missing = vm.missingRequired(adherence(MISSING));
    const coverage = vm.coverageFor("ana", missing, [
      path({ id: "trilha-btp", name: "Trilha BTP", competencyIds: ["comp-clean-core", "comp-cds", "comp-outra"] }),
      path({ id: "trilha-solta", name: "Trilha sem relação", competencyIds: ["comp-outra"] }),
    ]);
    expect(coverage.paths).toHaveLength(1);
    expect(coverage.paths[0]?.covered.map((c) => c.competencyId).sort()).toEqual([
      "comp-cds",
      "comp-clean-core",
    ]);
  });

  it("faltante que nenhuma trilha cobre fica em uncovered — é ela que ganha o CTA de PDI", () => {
    const vm = makeVm();
    const missing = vm.missingRequired(adherence(MISSING));
    const coverage = vm.coverageFor("ana", missing, [
      path({ id: "trilha-btp", name: "Trilha BTP", competencyIds: ["comp-clean-core", "comp-cds"] }),
    ]);
    expect(coverage.uncovered.map((c) => c.competencyId)).toEqual(["comp-eventos"]);
  });

  it("o progresso da trilha é o já calculado pela LearningPathsViewModel (reuso, não recontagem)", () => {
    const vm = makeVm();
    const missing = vm.missingRequired(adherence(MISSING));
    const trilha = path({
      id: "trilha-btp",
      name: "Trilha BTP",
      competencyIds: ["comp-clean-core"],
      items: [
        { id: "i1", title: "Curso", type: "Curso", hours: 8 },
        { id: "i2", title: "Workshop", type: "Workshop", hours: 4 },
      ],
      progress: [
        { architectId: "ana", itemId: "i1", status: "Completed", progress: 100 },
        { architectId: "ana", itemId: "i2", status: "In Progress", progress: 50 },
      ],
    });
    const coverage = vm.coverageFor("ana", missing, [trilha]);
    expect(coverage.paths[0]?.progressPercent).toBe(75);
  });

  it("ordena trilhas da que mais cobre para a que menos cobre", () => {
    const vm = makeVm();
    const missing = vm.missingRequired(adherence(MISSING));
    const coverage = vm.coverageFor("ana", missing, [
      path({ id: "t-1", name: "Cobre uma", competencyIds: ["comp-eventos"] }),
      path({ id: "t-2", name: "Cobre duas", competencyIds: ["comp-clean-core", "comp-cds"] }),
    ]);
    expect(coverage.paths.map((p) => p.pathId)).toEqual(["t-2", "t-1"]);
  });
});
