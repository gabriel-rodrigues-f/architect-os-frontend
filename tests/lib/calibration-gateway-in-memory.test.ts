import { describe, expect, it } from "vitest";

import { InMemoryCalibrationGateway, type LevelDistribution } from "@/lib/gateways/calibration.gateway";
import { calibrationResponseSchema } from "@/lib/api-schemas";

/**
 * O backend do PRD-03 vem na onda 21: a tela nasce contra a PORTA com mock
 * tipado, no MESMO desenho do sino — trocar o mock pelo Http é uma linha no
 * container. O contrato zod nasce junto (spec §3) e o mock precisa passar
 * por ele: é a prova de que mock e contrato não divergem.
 *
 * Lacuna registrada na direção: o item de avaliação ainda não guarda QUEM
 * deu a nota `leader` (scored_by) — o mock usa o contrato FUTURO, e a
 * escolha de implementação (registrar autor ou atribuir pela membership) é
 * do backend, sem mudar este contrato.
 */
const totalOf = (distribution: LevelDistribution): number =>
  Object.values(distribution).reduce((sum, count) => sum + count, 0);

describe("InMemoryCalibrationGateway", () => {
  const gateway = new InMemoryCalibrationGateway();

  it("responde no contrato zod declarado em api-schemas", async () => {
    const snapshot = await gateway.calibration("cycle-1");
    expect(() => calibrationResponseSchema.parse(snapshot)).not.toThrow();
  });

  it("ecoa o ciclo pedido — o recorte por ciclo é do servidor", async () => {
    const snapshot = await gateway.calibration("cycle-42");
    expect(snapshot.cycleId).toBe("cycle-42");
  });

  it("nasce com 3 avaliadores de perfis distintos: leniente, central e severo", async () => {
    const { overall, evaluators } = await gateway.calibration("cycle-1");
    expect(evaluators).toHaveLength(3);
    expect(overall.average).not.toBeNull();
    const averages = evaluators.map((entry) => entry.average ?? 0);
    expect(Math.max(...averages)).toBeGreaterThan(overall.average!);
    expect(Math.min(...averages)).toBeLessThan(overall.average!);
  });

  it("a distribuição geral é a soma das distribuições dos avaliadores", async () => {
    const { overall, evaluators } = await gateway.calibration("cycle-1");
    expect(totalOf(overall.distribution)).toBe(
      evaluators.reduce((sum, entry) => sum + totalOf(entry.distribution), 0),
    );
  });

  it("itemsCount de cada avaliador confere com a própria distribuição", async () => {
    const { evaluators } = await gateway.calibration("cycle-1");
    for (const entry of evaluators) {
      expect(entry.itemsCount, entry.name).toBe(totalOf(entry.distribution));
    }
  });
});
