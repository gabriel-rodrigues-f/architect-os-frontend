import { describe, expect, it } from "vitest";

import {
  architectsResponseSchema,
  assessmentsResponseSchema,
  capabilitiesResponseSchema,
  careerLevelsResponseSchema,
  competenciesResponseSchema,
  teamLevelRulesResponseSchema,
} from "@/lib/api-schemas";
import { fixtureCareerLevels, fixtureState } from "../helpers/fixtures";

/**
 * R2-TEC-19 (SYNAPSE-DIRECIONAMENTO-EXECUCAO.md) — `careerLevels` perdeu a
 * validação em runtime quando saiu do schema do blob (B-24, ADR-0011):
 * `api.careerLevels()` ficou só com um cast de tipo. `careerLevelsResponseSchema`
 * fecha essa lacuna; estes testes confirmam que ele de fato valida (não só
 * existe).
 */
describe("careerLevelsResponseSchema", () => {
  it("valida a fixture real de níveis de carreira", () => {
    expect(() => careerLevelsResponseSchema.parse(fixtureCareerLevels)).not.toThrow();
  });

  it("recusa um item sem name (campo obrigatório ausente)", () => {
    const broken = [{ id: "nivel-1", rank: 1 }];
    expect(() => careerLevelsResponseSchema.parse(broken)).toThrow();
  });

  it("recusa rank com o tipo errado (string em vez de number)", () => {
    const broken = [{ id: "nivel-1", name: "Nível I", rank: "1" }];
    expect(() => careerLevelsResponseSchema.parse(broken)).toThrow();
  });
});

/**
 * R2-TEC-19 — documenta e prova o comportamento de "strip" do zod: um
 * campo REMOVIDO/RENOMEADO no servidor quebra a validação (o caso que
 * o schema de cada fatia existe pra pegar); um campo ADICIONADO desaparece
 * silenciosamente até o schema ser atualizado — aceito de propósito, não
 * um bug (comentário em `api-schemas.ts`).
 */
describe("schema de fatia — comportamento de strip de campo desconhecido", () => {
  it("valida a fixture real de arquitetos", () => {
    expect(() => architectsResponseSchema.parse(fixtureState.architects)).not.toThrow();
  });

  it("um campo REMOVIDO do payload (ex.: campo obrigatório ausente) quebra a validação", () => {
    const [first, ...rest] = fixtureState.architects;
    const { name: _name, ...withoutName } = first!;
    expect(() => architectsResponseSchema.parse([withoutName, ...rest])).toThrow();
  });

  it("um campo NOVO e desconhecido no payload é descartado em silêncio, não rejeitado", () => {
    const withExtraField = fixtureState.architects.map((architect) => ({
      ...architect,
      campoNovoDoServidor: "valor qualquer",
    }));
    const parsed = architectsResponseSchema.parse(withExtraField);
    expect(parsed[0]).not.toHaveProperty("campoNovoDoServidor");
    // O resto do payload continua íntegro — só a chave desconhecida some.
    expect(parsed).toEqual(fixtureState.architects);
  });
});

/**
 * Fase 2 do modelo de carreira (backend f1926f7, ADRs 0032-0035) — o
 * contrato do `/state` mudou de forma: a competência global perdeu
 * `requirementType`/`expected` (a régua do time é a dona), a curadoria
 * perdeu a contagem por tipo (teto virou sinal), `careerLevelPolicies`
 * morreu dando lugar a `teamLevelRules`, e o arquiteto trocou
 * `leadUserId` por `teamId`. Estes testes provam que o parser aceita o
 * payload REAL do backend novo — era exatamente aqui que o frontend
 * quebrava (o zod rejeitava o parse inteiro e derrubava o app).
 */
describe("schemas de fatia — contrato da Fase 2 (régua por time)", () => {
  it("aceita competência global SEM requirementType/expected (payload real do f1926f7)", () => {
    const parsed = competenciesResponseSchema.parse(fixtureState.competencies);
    expect(parsed[0]).toEqual({
      id: "cloud-k8s",
      name: "Kubernetes",
      capabilityId: "cloud",
      active: true,
    });
  });

  it("carrega teamLevelRules (piso por time×nível) no lugar de careerLevelPolicies", () => {
    const parsed = teamLevelRulesResponseSchema.parse(fixtureState.teamLevelRules);
    expect(parsed).toHaveLength(3);
    expect(parsed[0]).toMatchObject({
      teamId: "time-plataforma",
      careerLevelId: "arquiteto-de-solucoes-i",
      minimumQualifiedCapabilities: 3,
    });
    expect(fixtureState).not.toHaveProperty("careerLevelPolicies");
  });

  it("aceita curadoria sem contagem por tipo e arquiteto com teamId", () => {
    const capabilities = capabilitiesResponseSchema.parse(fixtureState.capabilities);
    expect(capabilities[0]?.curation).toEqual({
      activeCompetencyCount: 2,
      status: "READY",
    });
    const architects = architectsResponseSchema.parse(fixtureState.architects);
    expect(architects[0]?.teamId).toBe("time-plataforma");
  });

  it("a FOTO do item de avaliação não carrega mais requirementType (onda 36, ADR-0082)", () => {
    const parsed = assessmentsResponseSchema.parse(fixtureState.assessments);
    expect(parsed[0]?.items[0]).not.toHaveProperty("requirementType");
  });
});

/**
 * R2-TEC-20 (SYNAPSE-DIRECIONAMENTO-EXECUCAO.md) — `role` era um
 * `z.enum([...3 nomes])` fechado: um arquiteto num 4º nível de carreira
 * (cenário já documentado como esperado, ADR-0002) fazia `appStateSchema.
 * parse` inteiro falhar, derrubando o app TODO em `ConnectionError`
 * (`store.tsx`) por causa de UM arquiteto. `z.string()` aceita qualquer
 * nome de cargo — este teste prova que um nome desconhecido não quebra
 * mais a validação (o comportamento antigo era exatamente o oposto:
 * `.toThrow()`, não `.not.toThrow()`).
 */
describe("schema de arquitetos — role aceita nomes além dos 3 conhecidos (R2-TEC-20)", () => {
  it("um arquiteto com role de um 4º nível de carreira (desconhecido) não quebra a validação", () => {
    const withFourthLevelRole = [
      { ...fixtureState.architects[0], role: "Especialista" },
      ...fixtureState.architects.slice(1),
    ];
    expect(() => architectsResponseSchema.parse(withFourthLevelRole)).not.toThrow();
    const parsed = architectsResponseSchema.parse(withFourthLevelRole);
    expect(parsed[0]?.role).toBe("Especialista");
  });

  it("os 3 nomes conhecidos continuam validando normalmente", () => {
    expect(() => architectsResponseSchema.parse(fixtureState.architects)).not.toThrow();
  });
});
