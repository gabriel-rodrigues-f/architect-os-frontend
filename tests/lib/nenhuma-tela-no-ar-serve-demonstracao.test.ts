import { describe, expect, it } from "vitest";

import { DataOriginPolicy, type OriginatedData } from "@/lib/gateways/data-origin";
import { FrontendContainer } from "@/lib/gateways/container";

/**
 * Onda 20 pôs o carimbo de origem no gateway e a onda 23 entregou os backends
 * reais de avisos (PRD-02) e calibração (PRD-03). Enquanto o container de
 * produção compuser um gateway de demonstração, o dono abre a aplicação e vê
 * número inventado com cara de número da empresa dele — a tela avisa, mas o
 * aviso é o conserto do sintoma.
 *
 * O invariante é do CONTAINER, não da tela: nenhum gateway composto em
 * produção pode carimbar origem que exija declaração. Gateway novo nasce
 * preso a esta régua, sem ninguém lembrar de conferir tela por tela.
 */
const policy = new DataOriginPolicy();

function carimbados(container: FrontendContainer): [string, OriginatedData["dataOrigin"]][] {
  return Object.entries(container as unknown as Record<string, unknown>)
    .filter(
      (entry): entry is [string, { dataOrigin: OriginatedData["dataOrigin"] }] =>
        typeof entry[1] === "object" &&
        entry[1] !== null &&
        "dataOrigin" in (entry[1] as Record<string, unknown>),
    )
    .map(([nome, gateway]) => [nome, gateway.dataOrigin]);
}

describe("o container de produção só serve dado da organização", () => {
  it("carimba avisos e calibração como dado da organização", () => {
    const container = FrontendContainer.create();
    expect(container.noticesGateway.dataOrigin).toBe("organization");
    expect(container.calibrationGateway.dataOrigin).toBe("organization");
  });

  it("nenhum gateway composto exige declaração de demonstração", () => {
    const demonstrativos = carimbados(FrontendContainer.create())
      .filter(([, origem]) => policy.requiresDisclosure(origem))
      .map(([nome]) => nome);
    expect(demonstrativos).toEqual([]);
  });

  it("a régua ainda reprova demonstração — a rede acima não passa por vacuidade", () => {
    expect(policy.requiresDisclosure("demonstration")).toBe(true);
    expect(carimbados(FrontendContainer.create()).length).toBeGreaterThan(0);
  });
});
