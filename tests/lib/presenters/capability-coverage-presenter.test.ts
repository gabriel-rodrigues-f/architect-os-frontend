import { describe, expect, it } from "vitest";

import type { Architect, Capability } from "@/lib/domain";
import { BANDS, CapabilityCoveragePresenter } from "@/lib/presenters";
import { DEFAULT_SCORING_BANDS, type ScoringBand } from "@/lib/scoring-bands";
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
    status: "REQUIRES_CURATION",
  },
});

const architect = (id: string): Architect => ({
  id,
  name: id,
  role: "Júnior",
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

  /**
   * Onda 35, item 8 — o dono pediu que o número "Sem avaliação" abra a avaliação
   * de cada pessoa. A lista de QUEM está sem avaliação sai do mesmo cálculo que
   * produz o número: quem não tem avg naquela capacidade neste ciclo.
   */
  it("expõe QUEM está sem avaliação, na ordem da população, e o número é o tamanho dessa lista", () => {
    const presenter = presenterWithLevels({ ana: 4, carla: undefined, diego: undefined });
    const [area] = presenter.areas([architect("ana"), architect("carla"), architect("diego")]);
    expect(area!.unassessed.map((person) => person.id)).toEqual(["carla", "diego"]);
    expect(area!.notAssessed).toBe(area!.unassessed.length);
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

/**
 * CFG-02 — as réguas do presenter (PROFICIENCY e CONCENTRATION_RISK) vêm de
 * `/api/v1/config/bands`; sem escalas no construtor, o default reproduz o
 * comportamento antigo (é o que TODOS os testes acima exercem).
 */
describe("CapabilityCoveragePresenter com escalas configuradas (CFG-02)", () => {
  const scaleBand = (overrides: Partial<ScoringBand>): ScoringBand => ({
    key: "x",
    minValue: null,
    maxValue: null,
    labelKey: "cap.band.developing",
    tone: "ok",
    sortOrder: 1,
    ...overrides,
  });

  it("fallback: sem escalas, bands do presenter = BANDS default (cortes 2.5/3.5/4.5)", () => {
    const presenter = presenterWithLevels({});
    expect(presenter.bands).toEqual(BANDS);
    expect(presenter.bands.map((b) => [b.min, b.max])).toEqual([
      [-Infinity, 2.5],
      [2.5, 3.5],
      [3.5, 4.5],
      [4.5, Infinity],
    ]);
  });

  it("PROFICIENCY fake muda os cortes: nível 2.5 muda de faixa quando o corte sobe para 3", () => {
    const cap = capability("cloud");
    const averagesFor = (): CapabilityAverage[] => [
      { capability: cap, avg: 2.5, target: undefined },
    ];
    const presenter = new CapabilityCoveragePresenter([cap], averagesFor, {
      PROFICIENCY: [
        scaleBand({ key: "developing", maxValue: 3, tone: "low", sortOrder: 1 }),
        scaleBand({ key: "experts", minValue: 3, labelKey: "cap.band.experts", sortOrder: 2 }),
      ],
      CONCENTRATION_RISK: DEFAULT_SCORING_BANDS.CONCENTRATION_RISK,
    });
    const [area] = presenter.areas([architect("ana")]);
    const byKey = Object.fromEntries(area!.bands.map((b) => [b.key, b.people.length]));
    expect(byKey).toEqual({ developing: 1, experts: 0 }); // no default, 2.5 era practitioners
  });

  it("CONCENTRATION_RISK fake sobe o limiar: com corte em 3, DUAS referências ainda são concentração", () => {
    const cap = capability("cloud");
    const averagesFor = (): CapabilityAverage[] => [{ capability: cap, avg: 4, target: undefined }];
    const presenter = new CapabilityCoveragePresenter([cap], averagesFor, {
      PROFICIENCY: DEFAULT_SCORING_BANDS.PROFICIENCY,
      CONCENTRATION_RISK: [
        scaleBand({
          key: "concentrationRisk",
          maxValue: 3,
          tone: "critical",
          labelKey: "cap.risk.badge.concentrationRisk",
          sortOrder: 1,
        }),
        scaleBand({
          key: "distributedCoverage",
          minValue: 3,
          labelKey: "cap.risk.badge.distributedCoverage",
          sortOrder: 2,
        }),
      ],
    });
    expect(presenter.classifyRisk(3, 2)).toBe("concentrationRisk"); // no default, 2 já distribuía
    expect(presenter.classifyRisk(3, 3)).toBe("distributedCoverage");
    expect(presenter.areas([architect("ana"), architect("bruno")])[0]!.risk).toBe(
      "concentrationRisk",
    );
  });
});
