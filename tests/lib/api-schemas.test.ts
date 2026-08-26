import { describe, expect, it } from "vitest";

import { appStateSchema, careerLevelsResponseSchema } from "@/lib/api-schemas";
import { fixtureCareerLevels, fixtureState } from "../helpers/fixtures";

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
describe("appStateSchema — role de arquiteto aceita nomes além dos 3 conhecidos (R2-TEC-20)", () => {
  it("um arquiteto com role de um 4º nível de carreira (desconhecido) não quebra a validação", () => {
    const withFourthLevelRole = {
      ...fixtureState,
      architects: [
        { ...fixtureState.architects[0], role: "Arquiteto de Soluções IV" },
        ...fixtureState.architects.slice(1),
      ],
    };
    expect(() => appStateSchema.parse(withFourthLevelRole)).not.toThrow();
    const parsed = appStateSchema.parse(withFourthLevelRole);
    expect(parsed.architects[0]?.role).toBe("Arquiteto de Soluções IV");
  });

  it("os 3 nomes conhecidos continuam validando normalmente", () => {
    expect(() => appStateSchema.parse(fixtureState)).not.toThrow();
  });
});
