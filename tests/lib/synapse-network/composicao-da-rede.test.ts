import { describe, expect, it } from "vitest";

import {
  CompositionZone,
  NetworkComposition,
  SynapseNetwork,
  type NetworkNode,
  type Zone,
} from "@/lib/synapse-network";

/**
 * A rede costura os lados (refino do login, 2026-09-07). O dono: "a distância
 * entre branding e forms e o fato de estarem nas extremidades me incomoda".
 * A rede passa a receber a zona de composição — os retângulos da marca e do
 * cartão — e distribui a densidade: o centro entre os dois blocos é
 * média/alta, o canto inferior esquerdo média, perto do login baixa e os
 * extremos da viewport muito baixa. Sem aumentar o total de nós.
 */
class SeededRandom {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  next = (): number => {
    this.state = (Math.imul(this.state, 1664525) + 1013904223) >>> 0;
    return this.state / 4294967296;
  };
}

const LARGURA = 1920;
const ALTURA = 1080;
const MARCA: Zone = { x: 200, y: 390, width: 640, height: 300 };
const CARTAO: Zone = { x: 1260, y: 300, width: 460, height: 480 };

function rede(seed: number, zone: CompositionZone | null): SynapseNetwork {
  return new SynapseNetwork(
    LARGURA,
    ALTURA,
    NetworkComposition.for(LARGURA, zone),
    new SeededRandom(seed).next,
  );
}

function dentro(node: NetworkNode, zona: Zone): boolean {
  return (
    node.x >= zona.x &&
    node.x <= zona.x + zona.width &&
    node.y >= zona.y &&
    node.y <= zona.y + zona.height
  );
}

/** Nós por 10 000 px² — a densidade comparável entre regiões de tamanhos diferentes. */
function densidade(nodes: readonly NetworkNode[], zona: Zone): number {
  const quantos = nodes.filter((node) => dentro(node, zona)).length;
  return (quantos / (zona.width * zona.height)) * 10_000;
}

/** Média sobre várias sementes: a régua é a distribuição, não um sorteio. */
function densidadeMedia(zona: Zone, zone: CompositionZone | null): number {
  const sementes = [1, 2, 3, 5, 8, 13, 21, 34];
  const soma = sementes.reduce(
    (acc, seed) => acc + densidade(rede(seed, zone).snapshot.nodes, zona),
    0,
  );
  return soma / sementes.length;
}

const CENTRO: Zone = {
  x: MARCA.x + MARCA.width,
  y: 200,
  width: CARTAO.x - (MARCA.x + MARCA.width),
  height: 680,
};
const CANTO_INFERIOR_ESQUERDO: Zone = { x: 0, y: MARCA.y + MARCA.height, width: 840, height: 390 };
const EXTREMOS: readonly Zone[] = [
  { x: 0, y: 0, width: 240, height: 180 },
  { x: LARGURA - 240, y: 0, width: 240, height: 180 },
  { x: LARGURA - 240, y: ALTURA - 180, width: 240, height: 180 },
];

describe("CompositionZone — a zona de composição", () => {
  const zone = new CompositionZone(MARCA, CARTAO);

  it("nasce dos retângulos medidos na tela, em coordenadas do canvas", () => {
    const canvas = { x: 0, y: 40, width: LARGURA, height: ALTURA };
    const medida = CompositionZone.measured(
      canvas,
      { x: 200, y: 430, width: 640, height: 300 },
      { x: 1260, y: 340, width: 460, height: 480 },
    );
    expect(medida?.brand).toEqual(MARCA);
    expect(medida?.card).toEqual(CARTAO);
  });

  it("sem medida (retângulo vazio, como no jsdom) não há zona", () => {
    const vazio = { x: 0, y: 0, width: 0, height: 0 };
    expect(CompositionZone.measured(vazio, vazio, vazio)).toBeNull();
    expect(
      CompositionZone.measured({ x: 0, y: 0, width: 100, height: 100 }, vazio, CARTAO),
    ).toBeNull();
  });

  it("o peso é maior no centro entre os blocos, menor perto do login e mínimo nos extremos", () => {
    const centro = zone.weightAt({ x: 1050, y: 540 }, LARGURA, ALTURA);
    const cantoInferiorEsquerdo = zone.weightAt({ x: 420, y: 900 }, LARGURA, ALTURA);
    const pertoDoLogin = zone.weightAt({ x: 1200, y: 540 }, LARGURA, ALTURA);
    const atrasDoLogin = zone.weightAt({ x: 1490, y: 540 }, LARGURA, ALTURA);
    const extremo = zone.weightAt({ x: 30, y: 30 }, LARGURA, ALTURA);
    expect(centro).toBeGreaterThan(cantoInferiorEsquerdo);
    expect(cantoInferiorEsquerdo).toBeGreaterThan(pertoDoLogin);
    expect(pertoDoLogin).toBeGreaterThan(extremo);
    expect(atrasDoLogin).toBeLessThan(extremo);
    expect(centro).toBeLessThanOrEqual(1);
    expect(extremo).toBeGreaterThan(0);
  });

  it("a diagonal sobe do pé da marca ao alto do cartão, cruzando o vão pelo meio", () => {
    expect(zone.along(0)).toEqual({ x: 200, y: 690 });
    expect(zone.along(1)).toEqual({ x: 1375, y: 300 });
    const meio = zone.along(0.5);
    expect(meio.x).toBeGreaterThan(MARCA.x + MARCA.width * 0.5);
    expect(meio.x).toBeLessThan(CARTAO.x);
    expect(meio.y).toBeLessThan(zone.along(0).y);
  });
});

describe("SynapseNetwork — a rede que costura os lados", () => {
  const zone = new CompositionZone(MARCA, CARTAO);

  it("não muda o total de nós nem a cota por plano", () => {
    const comZona = NetworkComposition.for(LARGURA, zone);
    const semZona = NetworkComposition.for(LARGURA);
    expect(comZona.nodes).toBe(semZona.nodes);
    for (const plane of [0, 1, 2]) expect(comZona.countFor(plane)).toBe(semZona.countFor(plane));
    expect(rede(7, zone).snapshot.nodes).toHaveLength(comZona.nodes);
    expect(comZona.zone).toBe(zone);
    expect(semZona.zone).toBeNull();
  });

  it("concentra os nós no centro entre os blocos, mais do que perto do login", () => {
    expect(densidadeMedia(CENTRO, zone)).toBeGreaterThan(densidadeMedia(CARTAO, zone) * 1.5);
  });

  it("o canto inferior esquerdo fica em densidade média, entre o centro e o login", () => {
    const canto = densidadeMedia(CANTO_INFERIOR_ESQUERDO, zone);
    expect(canto).toBeGreaterThan(densidadeMedia(CARTAO, zone));
    expect(canto).toBeLessThan(densidadeMedia(CENTRO, zone));
  });

  it("os extremos da viewport ficam quase vazios", () => {
    const centro = densidadeMedia(CENTRO, zone);
    for (const extremo of EXTREMOS) {
      expect(densidadeMedia(extremo, zone)).toBeLessThan(centro / 3);
    }
  });

  it("com a zona, o centro fica mais povoado do que ficava sem ela", () => {
    expect(densidadeMedia(CENTRO, zone)).toBeGreaterThan(densidadeMedia(CENTRO, null) * 1.3);
  });

  it("todo nó continua dentro da tela", () => {
    for (const node of rede(3, zone).snapshot.nodes) {
      expect(node.x).toBeGreaterThanOrEqual(0);
      expect(node.x).toBeLessThanOrEqual(LARGURA);
      expect(node.y).toBeGreaterThanOrEqual(0);
      expect(node.y).toBeLessThanOrEqual(ALTURA);
    }
  });
});
