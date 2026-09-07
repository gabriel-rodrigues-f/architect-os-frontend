import { describe, expect, it } from "vitest";

import {
  CompositionZone,
  NetworkComposition,
  SynapseNetwork,
  type NetworkNode,
  type Zone,
} from "@/lib/synapse-network";

/**
 * Zonas de exclusão e densidade por região (terceira avaliação de UX do dono,
 * 2026-09-07): a rede respira em volta da marca e do cartão — opacidade a
 * ~0.3 num halo de 32–48 px em torno da marca e ~0.15 atrás do cartão;
 * nenhuma aresta cruza as letras; o canto inferior esquerdo perde 20–30% de
 * densidade e o vão central ganha; o total de nós não muda.
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

const LARGURA = 1440;
const ALTURA = 900;
const MARCA: Zone = { x: 140, y: 340, width: 400, height: 110 };
const CARTAO: Zone = { x: 860, y: 190, width: 460, height: 480 };

function zona(): CompositionZone {
  return new CompositionZone(MARCA, CARTAO);
}

function rede(seed: number): SynapseNetwork {
  return new SynapseNetwork(
    LARGURA,
    ALTURA,
    NetworkComposition.for(LARGURA, zona()),
    new SeededRandom(seed).next,
  );
}

function dentro(zone: Zone, node: { x: number; y: number }, margin = 0): boolean {
  return (
    node.x >= zone.x - margin &&
    node.x <= zone.x + zone.width + margin &&
    node.y >= zone.y - margin &&
    node.y <= zone.y + zone.height + margin
  );
}

function cantoInferiorEsquerdo(node: NetworkNode): boolean {
  return node.x <= MARCA.x + MARCA.width && node.y > MARCA.y + MARCA.height;
}

function vaoCentral(node: NetworkNode): boolean {
  return node.x > MARCA.x + MARCA.width && node.x < CARTAO.x;
}

describe("CompositionZone — a visibilidade por região", () => {
  it("em volta da marca, num halo de 32 a 48 px, a rede fica a ~0.3; fora dele, inteira", () => {
    const zone = zona();
    expect(zone.visibilityAt({ x: MARCA.x + 10, y: MARCA.y + 10 })).toBeCloseTo(0.3, 1);
    expect(zone.visibilityAt({ x: MARCA.x - 30, y: MARCA.y + 50 })).toBeCloseTo(0.3, 1);
    expect(zone.visibilityAt({ x: MARCA.x - 60, y: MARCA.y + 50 })).toBe(1);
    expect(zone.visibilityAt({ x: MARCA.x + MARCA.width + 30, y: MARCA.y })).toBeCloseTo(0.3, 1);
    expect(zone.visibilityAt({ x: MARCA.x + MARCA.width + 60, y: MARCA.y })).toBe(1);
  });

  it("atrás do cartão a rede fica a ~0.15", () => {
    const zone = zona();
    expect(zone.visibilityAt({ x: CARTAO.x + 100, y: CARTAO.y + 100 })).toBeCloseTo(0.15, 2);
    expect(zone.visibilityAt({ x: CARTAO.x - 80, y: CARTAO.y + 100 })).toBe(1);
  });

  it("uma aresta que passa pelas letras é reconhecida — mesmo com as duas pontas fora da marca", () => {
    const zone = zona();
    const esquerda = { x: MARCA.x - 40, y: MARCA.y + 50 };
    const direita = { x: MARCA.x + MARCA.width + 40, y: MARCA.y + 60 };
    expect(zone.crossesBrand(esquerda, direita)).toBe(true);
    expect(zone.crossesBrand({ x: 100, y: 100 }, { x: 700, y: 120 })).toBe(false);
    expect(zone.crossesBrand({ x: MARCA.x + 20, y: MARCA.y + 20 }, { x: 900, y: 800 })).toBe(true);
  });

  it("o canto inferior esquerdo pesa 20–30% menos do que pesava (0.6) e o centro do vão continua em 1", () => {
    const zone = zona();
    const canto = zone.weightAt({ x: 250, y: 700 }, LARGURA, ALTURA);
    expect(canto).toBeGreaterThanOrEqual(0.6 * 0.7);
    expect(canto).toBeLessThanOrEqual(0.6 * 0.8);
    expect(zone.weightAt(zone.along(0.5), LARGURA, ALTURA)).toBeCloseTo(1, 1);
  });
});

describe("SynapseNetwork — com a zona, a rede respira e costura", () => {
  it("todo nó carrega a sua visibilidade: baixa dentro do halo da marca e atrás do cartão, cheia no vão", () => {
    const net = rede(7);
    net.tick(16, null);
    const nodes = net.snapshot.nodes;
    for (const node of nodes) {
      if (dentro(MARCA, node, 32)) expect(node.visibility).toBeLessThanOrEqual(0.3);
      else if (dentro(CARTAO, node)) expect(node.visibility).toBeLessThanOrEqual(0.15);
      else if (!dentro(MARCA, node, 48)) expect(node.visibility).toBe(1);
    }
  });

  it("nenhuma aresta cruza as letras da marca", () => {
    for (const seed of [1, 2, 3, 7, 11]) {
      const net = rede(seed);
      net.tick(16, null);
      const { nodes, links } = net.snapshot;
      const zone = zona();
      for (const link of links) {
        expect(zone.crossesBrand(nodes[link.from]!, nodes[link.to]!)).toBe(false);
      }
    }
  });

  it("o vão central tem mais nós que o canto inferior esquerdo, e o total é o da composição", () => {
    let canto = 0;
    let vao = 0;
    for (const seed of [1, 2, 3, 5, 7, 11, 13]) {
      const net = rede(seed);
      expect(net.snapshot.nodes).toHaveLength(NetworkComposition.for(LARGURA).nodes);
      canto += net.snapshot.nodes.filter(cantoInferiorEsquerdo).length;
      vao += net.snapshot.nodes.filter(vaoCentral).length;
    }
    expect(vao).toBeGreaterThan(canto * 1.5);
  });

  it("sem zona, nada muda: visibilidade 1 em todo nó e nenhuma aresta recusada por marca", () => {
    const net = new SynapseNetwork(
      LARGURA,
      ALTURA,
      NetworkComposition.for(LARGURA),
      new SeededRandom(7).next,
    );
    net.tick(16, null);
    for (const node of net.snapshot.nodes) expect(node.visibility).toBe(1);
  });
});
