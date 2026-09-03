import { describe, expect, it } from "vitest";

import {
  ArchitectSelectors,
  AssessmentSelectors,
  CapabilitySelectors,
  createSelectors,
  DevelopmentSelectors,
  emptyState,
  SelectorIndex,
  TrainingSelectors,
} from "@/lib/selectors";
import type { AppState } from "@/lib/api";
import { fixtureState } from "../helpers/fixtures";

describe("coverageFor / teamAverageFor (OO3-11k — média com cobertura, nunca ausência como 0)", () => {
  // "diego" não tem assessment — contribui na cobertura, nunca na média.
  const state: AppState = {
    ...fixtureState,
    architects: [...fixtureState.architects, { ...fixtureState.architects[0]!, id: "diego" }],
  };
  const sel = createSelectors(state);

  it("coverageFor ignora capacidade sem média, mas conta na cobertura", () => {
    // ana: Cloud 4, Security 2 → média (4+2)/2 = 3, cobertura 2/2.
    expect(sel.coverageFor("ana")).toEqual({ avg: 3, covered: 2, total: 2 });
    // diego sem assessment: nunca 0 — undefined com cobertura 0.
    expect(sel.coverageFor("diego")).toEqual({ avg: undefined, covered: 0, total: 2 });
  });

  it("teamAverageFor ignora quem não tem assessment na média, mas conta na cobertura", () => {
    const { atual, alvo } = sel.teamAverageFor("cloud", [{ id: "ana" }, { id: "diego" }]);
    // Ana tem 4 em Cloud; diego não tem — média real é 4, não (4+0)/2=2.
    expect(atual).toEqual({ avg: 4, covered: 1, total: 2 });
    expect(alvo.covered).toBe(1);
  });

  it("população vazia fica undefined, sem dividir por zero", () => {
    expect(sel.teamAverageFor("cloud", []).atual).toEqual({
      avg: undefined,
      covered: 0,
      total: 0,
    });
  });
});

describe("createSelectors", () => {
  const s = createSelectors(fixtureState);

  it("resolve entidades por id", () => {
    expect(s.competencyById("cloud-k8s")?.name).toBe("Kubernetes");
    expect(s.capabilityById("security")?.short).toBe("Security");
    expect(s.architectById("ana")?.name).toBe("Ana Martins");
    expect(s.competencyById("nao-existe")).toBeUndefined();
  });

  it("usa o ciclo ativo por padrão e aceita ciclo explícito", () => {
    expect(s.assessmentFor("ana")?.id).toBe("ana-h2");
    expect(s.assessmentFor("ana", "2026-h1")?.id).toBe("ana-h1");
  });

  it("calcula gaps ordenados do maior para o menor", () => {
    const gaps = s.gapsFor("bruno");
    expect(gaps.map((g) => g.item.competencyId)).toEqual([
      "cloud-k8s",
      "security-iam",
      "cloud-serverless",
    ]);
    expect(gaps[0]?.gap).toBe(1);
    expect(gaps[2]?.gap).toBe(0);
  });

  it("gapsFor devolve vazio quando não há assessment no ciclo", () => {
    expect(s.gapsFor("bruno", "2026-h1")).toEqual([]);
    expect(s.gapsFor("ninguem")).toEqual([]);
  });

  describe("Draft e In Review não alimentam indicador oficial", () => {
    /**
     * PLANO-360-AGENTES-SYNAPSE.md, Seção 9 — "Regra crítica": gapsFor() e
     * companhia não podem tratar uma avaliação ainda em curso como fotografia
     * oficial do ciclo. Uma autoavaliação em rascunho nasce com todo item em
     * nível 1 — se contasse, pintaria todo mundo como lacuna crítica antes
     * mesmo de a pessoa ter respondido.
     */
    const rascunho = createSelectors({
      ...fixtureState,
      assessments: [
        {
          ...fixtureState.assessments[0]!,
          id: "draft-1",
          architectId: "diego",
          cycleId: "2026-h2",
          status: "Draft",
        },
      ],
    });
    const emRevisao = createSelectors({
      ...fixtureState,
      assessments: [
        {
          ...fixtureState.assessments[0]!,
          id: "review-1",
          architectId: "diego",
          cycleId: "2026-h2",
          status: "In Review",
        },
      ],
    });
    const concluida = createSelectors({
      ...fixtureState,
      assessments: [
        {
          ...fixtureState.assessments[0]!,
          id: "done-1",
          architectId: "diego",
          cycleId: "2026-h2",
          status: "Completed",
        },
      ],
    });

    it("Draft: gapsFor e capabilityAverages ignoram", () => {
      expect(rascunho.gapsFor("diego")).toEqual([]);
      expect(rascunho.capabilityAverages("diego").every((d) => d.avg === undefined)).toBe(true);
      expect(rascunho.officialAssessmentFor("diego")).toBeUndefined();
    });

    it("In Review: mesma exclusão — calibração ainda não fechou a nota", () => {
      expect(emRevisao.gapsFor("diego")).toEqual([]);
      expect(emRevisao.officialAssessmentFor("diego")).toBeUndefined();
    });

    it("Completed: passa a alimentar gap e média", () => {
      expect(concluida.gapsFor("diego").length).toBeGreaterThan(0);
      expect(concluida.officialAssessmentFor("diego")?.id).toBe("done-1");
    });
  });

  it("média por capacidade agrupa competências da capacidade", () => {
    const averages = s.capabilityAverages("ana");
    const cloud = averages.find((d) => d.capability.id === "cloud");
    const security = averages.find((d) => d.capability.id === "security");

    expect(cloud).toMatchObject({ avg: 4, target: 4 });
    expect(security).toMatchObject({ avg: 2, target: 3 });
  });

  it("média por capacidade fica indefinida (não zero) quando não há assessment", () => {
    expect(
      s.capabilityAverages("ninguem").every((d) => d.avg === undefined && d.target === undefined),
    ).toBe(true);
  });

  it("agrega necessidades de treinamento do time ignorando gaps não positivos", () => {
    const needs = s.teamTrainingNeeds();

    expect(needs.map((n) => n.competency?.id)).toEqual(["security-iam", "cloud-k8s"]);
    expect(needs[0]).toMatchObject({ people: 2, totalGap: 2, avgGap: 1 });
    // cloud-serverless está adequado para os dois — não aparece na LNT
    expect(needs.some((n) => n.competency?.id === "cloud-serverless")).toBe(false);
  });

  it("opera sobre o estado vazio sem quebrar", () => {
    const empty = createSelectors(emptyState);
    expect(empty.teamTrainingNeeds()).toEqual([]);
    expect(empty.capabilityAverages("ana")).toEqual([]);
  });

  /**
   * EPIC E — quem já saiu do time não conta como time atual: nem na lista
   * de `activeArchitects`, nem na Necessidade de Treinamento agregada.
   * `gapsFor`/`capabilityAverages` continuam funcionando por id explícito (uma
   * tela histórica pode pedir o gap de alguém inativo de propósito).
   */
  describe("activeArchitects — time atual exclui quem saiu", () => {
    const comInativo = createSelectors({
      ...fixtureState,
      architects: fixtureState.architects.map((a) =>
        a.id === "bruno" ? { ...a, active: false } : a,
      ),
    });

    it("activeArchitects não lista bruno", () => {
      expect(comInativo.activeArchitects.map((a) => a.id)).toEqual(["ana"]);
    });

    it("teamTrainingNeeds ignora as lacunas de bruno", () => {
      const needs = comInativo.teamTrainingNeeds();
      // Sem o bruno, só a lacuna de segurança da ana permanece.
      expect(needs.map((n) => n.competency?.id)).toEqual(["security-iam"]);
      expect(needs[0]).toMatchObject({ people: 1, totalGap: 1 });
    });

    it("gapsFor ainda funciona para quem está inativo — histórico continua acessível", () => {
      expect(comInativo.gapsFor("bruno").length).toBeGreaterThan(0);
    });
  });
});

/**
 * OO2-08 (AUDITORIA-OO-PADRONIZACAO-ANALYTICS-IA-SYNAPSE-2026-08-25.md,
 * Seção 62) — os testes de `createSelectors` acima já cobrem o
 * comportamento (a forma achatada não mudou); estes confirmam que as
 * classes por contexto funcionam também quando instanciadas diretamente,
 * fora do objeto achatado — o caso de uso que motivou a divisão (ex.: um
 * ViewModel futuro que só precisa de uma fatia).
 */
describe("classes por contexto (instanciadas diretamente)", () => {
  const index = new SelectorIndex(fixtureState);

  it("ArchitectSelectors resolve por id e lista só quem está ativo", () => {
    const architects = new ArchitectSelectors(fixtureState, index);
    expect(architects.byId("ana")?.name).toBe("Ana Martins");
    expect(architects.byId("nao-existe")).toBeUndefined();
    expect(architects.active.map((a) => a.id)).toEqual(["ana", "bruno"]);
  });

  it("AssessmentSelectors calcula gap igual ao objeto achatado", () => {
    const assessment = new AssessmentSelectors(index);
    const viaClasse = assessment.gapsFor("bruno");
    const viaFlat = createSelectors(fixtureState).gapsFor("bruno");
    expect(viaClasse).toEqual(viaFlat);
    expect(
      assessment.progressionGapsFor("bruno").every((g) => g.targetSemantics !== "MASTERY"),
    ).toBe(true);
  });

  it("DevelopmentSelectors resolve o plano do ciclo ativo", () => {
    const development = new DevelopmentSelectors(index);
    expect(development.planFor("ana")?.id).toBe("pdi-ana");
    expect(development.planFor("bruno")).toBeUndefined();
  });

  it("CapabilitySelectors calcula média por capacidade usando o AssessmentSelectors injetado", () => {
    const assessment = new AssessmentSelectors(index);
    const capability = new CapabilitySelectors(fixtureState, index, assessment);
    const cloud = capability.capabilityAverages("ana").find((d) => d.capability.id === "cloud");
    expect(cloud).toMatchObject({ avg: 4, target: 4 });
  });

  it("TrainingSelectors agrega necessidade de treinamento a partir de Architect + Assessment", () => {
    const architects = new ArchitectSelectors(fixtureState, index);
    const assessment = new AssessmentSelectors(index);
    const training = new TrainingSelectors(architects, assessment);
    const needs = training.teamTrainingNeeds();
    expect(needs.map((n) => n.competency?.id)).toEqual(["security-iam", "cloud-k8s"]);
  });
});

describe("activeArchitects", () => {
  /**
   * Onda 10, T8 — `visibleTo` (OO3-11a) morreu com o roster fechado no
   * backend (`d1edba4`): o recorte de QUEM aparece é do servidor, que só
   * manda os arquitetos do escopo do papel (`scopedFixtureStateFor` espelha
   * esse payload). O que continua sendo regra de UI legítima — e é o que
   * estes casos fixam — é o filtro por `active`: um desligado que VEM no
   * payload (o servidor não recorta por `active`) não entra nas populações
   * de tela nem nos seletores de pessoa.
   */
  const state: AppState = {
    ...fixtureState,
    architects: [
      ...fixtureState.architects,
      {
        id: "carla",
        name: "Carla Inativa",
        role: "Júnior",
        yearsAsArchitect: 2,
        specialization: "Data",
        email: "carla@company.com",
        active: false,
        version: 1,
      },
    ],
  };
  const sel = createSelectors(state);

  it("inativo presente no payload nunca entra na população ativa", () => {
    expect(sel.activeArchitects.map((architect) => architect.id)).toEqual(["ana", "bruno"]);
  });

  it("continua alcançável por id — a ficha dele não some, só as listas", () => {
    expect(sel.architectById("carla")?.name).toBe("Carla Inativa");
  });

  it("é a MESMA referência entre leituras — identidade estável para useMemo", () => {
    expect(sel.activeArchitects).toBe(sel.activeArchitects);
  });
});

describe("capabilityShortLabel", () => {
  /** OO3-11d — dedup R2-ESC-02 memoizado por snapshot, com o fallback `?? short` embutido. */
  const state: AppState = {
    ...fixtureState,
    capabilities: [
      { ...fixtureState.capabilities[0]!, id: "cloud", short: "Cld" },
      { ...fixtureState.capabilities[1]!, id: "security", short: "Cld" },
    ],
  };
  const sel = createSelectors(state);

  it("desempata siglas repetidas na ordem do catálogo", () => {
    expect(sel.capabilityShortLabel({ id: "cloud", short: "Cld" })).toBe("Cld");
    expect(sel.capabilityShortLabel({ id: "security", short: "Cld" })).toBe("Cld (2)");
    expect(sel.capabilityShortLabels.get("security")).toBe("Cld (2)");
  });

  it("faz fallback para `short` quando o id não está no catálogo", () => {
    expect(sel.capabilityShortLabel({ id: "fantasma", short: "Xx" })).toBe("Xx");
  });
});

describe("consolidação de gaps (GapConsolidationSelectors)", () => {
  /** OO3-11g — a regra saiu de `gap-analysis-shared.tsx` para o selector; estes casos cobrem o cálculo direto. */
  const sel = createSelectors(fixtureState);

  it("agrega por competência somando pessoas e gap total; gap <= 0 é descartado", () => {
    const rows = sel.consolidateProgressionGaps(fixtureState.architects);
    const iam = rows.find((r) => r.competencyId === "security-iam");
    expect(iam).toMatchObject({ people: 2, totalGap: 2 });
    expect(iam?.architectNames.sort()).toEqual(["Ana Martins", "Bruno Almeida"]);
    // cloud-serverless: gap 0 para os dois — nunca vira linha.
    expect(rows.some((r) => r.competencyId === "cloud-serverless")).toBe(false);
  });

  it("maxGap é o maior gap individual e as médias saem com 1 casa", () => {
    const state: AppState = {
      ...fixtureState,
      assessments: fixtureState.assessments.map((a) =>
        a.id === "bruno-h2"
          ? {
              ...a,
              items: a.items.map((i) =>
                i.competencyId === "security-iam"
                  ? { ...i, final: 1 as const, target: 4 as const }
                  : i,
              ),
            }
          : a,
      ),
    };
    const rows = createSelectors(state).consolidateProgressionGaps(state.architects);
    const iam = rows.find((r) => r.competencyId === "security-iam");
    // ana: final 2 → 3 (gap 1); bruno: final 1 → 4 (gap 3)
    expect(iam).toMatchObject({
      people: 2,
      maxGap: 3,
      totalGap: 4,
      avgGap: 2,
      avgFinal: 1.5,
      avgTarget: 3.5,
    });
  });

  it("ordena por totalGap desc com desempate por maxGap desc", () => {
    const rows = sel.consolidateProgressionGaps(fixtureState.architects);
    for (let i = 1; i < rows.length; i += 1) {
      const prev = rows[i - 1]!;
      const cur = rows[i]!;
      expect(
        prev.totalGap > cur.totalGap ||
          (prev.totalGap === cur.totalGap && prev.maxGap >= cur.maxGap),
      ).toBe(true);
    }
  });

  it("consolidateMasteryGaps usa só itens MASTERY — com a fixture atual, nenhum", () => {
    expect(sel.consolidateMasteryGaps(fixtureState.architects)).toEqual([]);
  });
});

/**
 * F2 (caminhos quentes) — `consolidate` e `teamTrainingNeeds` acumulavam com
 * `[...acumulador, item]` dentro de laço duplo (arquitetos × lacunas), o que
 * recopia a lista inteira a cada pessoa. A troca por acumulação em lugar não
 * pode mudar NADA do resultado — inclusive a ORDEM dentro de `architectNames`
 * e `architectIds`, que é a ordem da população recebida e é o que a tela usa
 * no `title` da coluna "pessoas". Estes casos fixam a saída de hoje inteira,
 * campo a campo, com três pessoas na mesma competência (é preciso k ≥ 3 para
 * uma regressão de ordem aparecer).
 */
describe("consolidação e LNT — acumulação em laço duplo (F2)", () => {
  const carla: AppState["architects"][number] = {
    id: "carla",
    name: "Carla Souza",
    role: "Sênior",
    yearsAsArchitect: 9,
    specialization: "Data",
    email: "carla@company.com",
    active: true,
    version: 1,
  };

  const state: AppState = {
    ...fixtureState,
    architects: [...fixtureState.architects, carla],
    assessments: [
      ...fixtureState.assessments,
      {
        id: "carla-h2",
        architectId: "carla",
        cycleId: "2026-h2",
        status: "Completed",
        modelVersion: 1,
        targetCareerLevelId: null,
        targetSemantics: null,
        version: 1,
        items: [
          { competencyId: "cloud-k8s", self: 1, leader: 1, target: 5, final: 1, comments: [] },
          {
            competencyId: "cloud-serverless",
            self: 3,
            leader: 3,
            target: 3,
            final: 3,
            comments: [],
          },
          { competencyId: "security-iam", self: 2, leader: 2, target: 4, final: 2, comments: [] },
        ],
      },
    ],
  };

  const sel = createSelectors(state);

  /**
   * Contas à mão (ciclo 2026-h2):
   * - cloud-k8s: bruno 2→3 (gap 1), carla 1→5 (gap 4) → total 5, máx 4,
   *   médias final (2+1)/2 = 1.5 e alvo (3+5)/2 = 4, gap médio 2.5.
   * - security-iam: ana 2→3 (1), bruno 1→2 (1), carla 2→4 (2) → total 4,
   *   máx 2, médias final (2+1+2)/3 = 1.7 e alvo (3+2+4)/3 = 3, gap médio 1.3.
   * - cloud-serverless não tem lacuna em ninguém — nunca vira linha.
   */
  it("consolidateProgressionGaps devolve exatamente as linhas de hoje, com os nomes na ordem da população", () => {
    expect(sel.consolidateProgressionGaps(state.architects)).toEqual([
      {
        competencyId: "cloud-k8s",
        name: "Kubernetes",
        capabilityId: "cloud",
        people: 2,
        architectNames: ["Bruno Almeida", "Carla Souza"],
        totalGap: 5,
        maxGap: 4,
        sumFinal: 3,
        sumTarget: 8,
        avgFinal: 1.5,
        avgTarget: 4,
        avgGap: 2.5,
      },
      {
        competencyId: "security-iam",
        name: "IAM",
        capabilityId: "security",
        people: 3,
        architectNames: ["Ana Martins", "Bruno Almeida", "Carla Souza"],
        totalGap: 4,
        maxGap: 2,
        sumFinal: 5,
        sumTarget: 9,
        avgFinal: 1.7,
        avgTarget: 3,
        avgGap: 1.3,
      },
    ]);
  });

  it("a ordem de architectNames acompanha a ordem da população, não a do catálogo", () => {
    const invertida = [...state.architects].reverse();
    const linha = sel
      .consolidateProgressionGaps(invertida)
      .find((r) => r.competencyId === "security-iam");
    expect(linha?.architectNames).toEqual(["Carla Souza", "Bruno Almeida", "Ana Martins"]);
  });

  it("teamTrainingNeeds devolve exatamente as necessidades de hoje, com os ids na ordem da população", () => {
    expect(sel.teamTrainingNeeds()).toEqual([
      {
        competency: state.competencies.find((c) => c.id === "cloud-k8s"),
        people: 2,
        avgGap: 2.5,
        totalGap: 5,
        architectIds: ["bruno", "carla"],
      },
      {
        competency: state.competencies.find((c) => c.id === "security-iam"),
        people: 3,
        avgGap: 1.3,
        totalGap: 4,
        architectIds: ["ana", "bruno", "carla"],
      },
    ]);
  });

  it("população vazia continua devolvendo lista vazia", () => {
    expect(sel.consolidateProgressionGaps([])).toEqual([]);
    expect(sel.teamTrainingNeeds([])).toEqual([]);
  });

  it("consolidar duas vezes não acumula nada de uma chamada para a outra", () => {
    const primeira = sel.consolidateProgressionGaps(state.architects);
    expect(sel.consolidateProgressionGaps(state.architects)).toEqual(primeira);
    expect(sel.teamTrainingNeeds()).toEqual(sel.teamTrainingNeeds());
  });
});
