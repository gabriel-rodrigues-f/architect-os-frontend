import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiClient } from "@/lib/api-client";
import { ApiError } from "@/lib/api-errors";
import { apiPath } from "@/lib/api-path";
import type { Competency } from "@/lib/domain";
import {
  HttpCatalogGateway,
  InMemoryCompetencyRemoval,
  type AffectedRecords,
} from "@/lib/gateways/catalog.gateway";

/**
 * Onda 35, achado 16 — contrato de `POST /competencies/bulk-removal`
 * (briefing, fatia backend `remocao-em-massa-de-competencias`):
 *   body { competencyIds: string[] (1..200) }
 *   → 200 { data: { outcomes: [{ competencyId, outcome: "removed"|"archived",
 *          affected: { assessments, planItems, evidences, learningItems, teamRuleRequirements } }] },
 *          message: { code: "catalog.competency.bulkRemoval.success" } }
 *   → 400 fora de 1..200.
 *
 * O gateway em memória é o oráculo desse contrato: as recusas que ele
 * reproduz são as que a tela precisa saber mostrar.
 */

const competencies: Competency[] = [
  { id: "k8s", name: "Kubernetes", capabilityId: "cloud", active: true },
  { id: "iam", name: "IAM", capabilityId: "security", active: true },
];

const nothing: AffectedRecords = {
  assessments: 0,
  planItems: 0,
  evidences: 0,
  learningItems: 0,
  teamRuleRequirements: 0,
};

describe("HttpCatalogGateway.removeCompetencies — o contrato no fio", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("faz POST /competencies/bulk-removal com { competencyIds } e desembrulha os outcomes", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            outcomes: [
              { competencyId: "k8s", outcome: "removed", affected: nothing },
              {
                competencyId: "iam",
                outcome: "archived",
                affected: { ...nothing, assessments: 2, teamRuleRequirements: 1 },
              },
            ],
          },
          message: { code: "catalog.competency.bulkRemoval.success" },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    const gateway = new HttpCatalogGateway(new ApiClient("http://api.test"));

    const summary = await gateway.removeCompetencies(["k8s", "iam"]);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`http://api.test${apiPath("/competencies/bulk-removal")}`);
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({ competencyIds: ["k8s", "iam"] });
    expect(summary.outcomes.map((outcome) => [outcome.competencyId, outcome.outcome])).toEqual([
      ["k8s", "removed"],
      ["iam", "archived"],
    ]);
  });
});

describe("InMemoryCompetencyRemoval — o oráculo do contrato", () => {
  it("competência sem vínculo é removida; com vínculo é arquivada, com a contagem do que a segura", async () => {
    const gateway = new InMemoryCompetencyRemoval(
      competencies,
      new Map([["iam", { ...nothing, assessments: 2, planItems: 1 }]]),
    );

    const summary = await gateway.removeCompetencies(["k8s", "iam"]);

    expect(summary.outcomes).toEqual([
      { competencyId: "k8s", outcome: "removed", affected: nothing },
      {
        competencyId: "iam",
        outcome: "archived",
        affected: { ...nothing, assessments: 2, planItems: 1 },
      },
    ]);
    expect(gateway.removalsMade).toEqual([["k8s", "iam"]]);
  });

  it("recusa seleção vazia com 400", async () => {
    const gateway = new InMemoryCompetencyRemoval(competencies);
    await expect(gateway.removeCompetencies([])).rejects.toMatchObject({ status: 400 });
    expect(gateway.removalsMade).toEqual([]);
  });

  it("recusa mais de 200 ids com 400", async () => {
    const gateway = new InMemoryCompetencyRemoval(competencies);
    const ids = Array.from({ length: 201 }, (_, index) => `c-${index}`);
    await expect(gateway.removeCompetencies(ids)).rejects.toMatchObject({ status: 400 });
  });

  it("recusa id desconhecido com 404 e não remove nada", async () => {
    const gateway = new InMemoryCompetencyRemoval(competencies);
    const refusal = await gateway
      .removeCompetencies(["k8s", "ghost"])
      .catch((error: unknown) => error);
    expect(refusal).toBeInstanceOf(ApiError);
    expect((refusal as ApiError).status).toBe(404);
    expect(gateway.removalsMade).toEqual([]);
  });
});
