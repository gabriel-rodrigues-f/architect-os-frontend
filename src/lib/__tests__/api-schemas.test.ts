import { describe, expect, it } from "vitest";

import { appStateSchema, careerLevelsResponseSchema } from "../api-schemas";
import { fixtureCareerLevels, fixtureState } from "./fixtures";

/**
 * R2-TEC-19 (SYNAPSE-DIRECIONAMENTO-EXECUCAO.md) — `careerLevels` perdeu a
 * validação em runtime quando saiu de `appStateSchema` (B-24, ADR-0011):
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
 * `appStateSchema` existe pra pegar); um campo ADICIONADO desaparece
 * silenciosamente até o schema ser atualizado — aceito de propósito, não
 * um bug (comentário em `api-schemas.ts`).
 */
describe("appStateSchema — comportamento de strip de campo desconhecido", () => {
  it("valida a fixture real de estado", () => {
    expect(() => appStateSchema.parse(fixtureState)).not.toThrow();
  });

  it("um campo REMOVIDO do payload (ex.: coleção obrigatória ausente) quebra a validação", () => {
    const { architects: _architects, ...withoutArchitects } = fixtureState;
    expect(() => appStateSchema.parse(withoutArchitects)).toThrow();
  });

  it("um campo NOVO e desconhecido no payload é descartado em silêncio, não rejeitado", () => {
    const withExtraField = { ...fixtureState, campoNovoDoServidor: "valor qualquer" };
    const parsed = appStateSchema.parse(withExtraField);
    expect(parsed).not.toHaveProperty("campoNovoDoServidor");
    // O resto do payload continua íntegro — só a chave desconhecida some.
    expect(parsed.architects).toEqual(fixtureState.architects);
  });
});
