import { describe, expect, it } from "vitest";

import type { Architect, Capability } from "@/lib/domain";
import { CapabilityCoveragePresenter } from "@/lib/presenters/capability-coverage-presenter";
import type { CapabilityAverage } from "@/lib/selectors";

/**
 * OO3-11h — faixas de proficiência e risco de concentração saíram de
 * `routes/capability-map.tsx` para o presenter; os 3 estados de risco que
 * eram provados pela DOM (`capability-map-risk.test.tsx`) viram unitários
 * baratos aqui, mais as fronteiras de faixa que a DOM nunca cobriu.
 */
const capability = (id: string, active = true): Capability => ({
  id,
  name: id,
  short: id,
  active,
  curation: {
    activeCompetencyCount: 0,
    restrictiveCompetencyCount: 0,
    nonRestrictiveCompetencyCount: 0,
    status: "REQUIRES_CURATION",
  },
});

const architect = (id: string): Architect => ({
  id,
  name: id,
  role: "Arquiteto de Soluções I",
  yearsAsArchitect: 1,
  specialization: "",
  email: `${id}@x`,
  active: true,
  version: 1,
});

const presenterWithLevels = (levels: Record<string, number | undefined>) => {
  const cap = capability("cloud");
  const averagesFor = (architectId: string): CapabilityAverage[] => [
    { capability: cap, avg: levels[architectId], target: undefined },
  ];
  return new CapabilityCoveragePresenter([cap], averagesFor);
};

describe("CapabilityCoveragePresenter.classifyRisk", () => {
  const presenter = presenterWithLevels({});

  it("cobre os 4 estados explícitos", () => {
    expect(presenter.classifyRisk(0, 0)).toBe("insufficientData");
    expect(presenter.classifyRisk(3, 0)).toBe("noReference");
    expect(presenter.classifyRisk(3, 1)).toBe("concentrationRisk");
    expect(presenter.classifyRisk(3, 2)).toBe("distributedCoverage");
  });
});

describe("CapabilityCoveragePresenter.areas", () => {
  it("fronteira de faixa: 2.5 cai em practitioners, 2.49 em developing (min <= nível < max)", () => {
    const presenter = presenterWithLevels({ ana: 2.5, bruno: 2.49 });
    const [area] = presenter.areas([architect("ana"), architect("bruno")]);
    const byKey = Object.fromEntries(
      area!.bands.map((b) => [b.key, b.people.map((p) => p.architect.id)]),
    );
    expect(byKey["practitioners"]).toEqual(["ana"]);
    expect(byKey["developing"]).toEqual(["bruno"]);
  });

  it("sem avg a pessoa cai em notAssessed, nunca numa faixa; população vazia = insufficientData", () => {
    const presenter = presenterWithLevels({ ana: undefined });
    const [area] = presenter.areas([architect("ana")]);
    expect(area).toMatchObject({ assessedCount: 0, notAssessed: 1, risk: "insufficientData" });
  });

  it("referências = avançados + especialistas; 1 referência é risco de concentração, 2+ distribui", () => {
    const umaReferencia = presenterWithLevels({ ana: 4, bruno: 2.5 });
    expect(umaReferencia.areas([architect("ana"), architect("bruno")])[0]).toMatchObject({
      risk: "concentrationRisk",
    });

    const duasReferencias = presenterWithLevels({ ana: 4, carla: 4.5 });
    const [area] = duasReferencias.areas([architect("ana"), architect("carla")]);
    expect(area!.risk).toBe("distributedCoverage");
    expect(area!.references.map((p) => p.architect.id).sort()).toEqual(["ana", "carla"]);
  });

  it("sem ninguém avançado/especialista, o estado é noReference", () => {
    const presenter = presenterWithLevels({ ana: 2, bruno: 3 });
    expect(presenter.areas([architect("ana"), architect("bruno")])[0]!.risk).toBe("noReference");
  });

  it("capacidade inativa não vira área", () => {
    const inativa = capability("legacy", false);
    const presenter = new CapabilityCoveragePresenter([inativa], () => []);
    expect(presenter.areas([architect("ana")])).toEqual([]);
  });
});
