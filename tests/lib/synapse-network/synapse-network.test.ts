import { describe, expect, it } from "vitest";

import {
  NetworkComposition,
  PLANE_STYLE,
  SynapseNetwork,
  type NetworkNode,
} from "@/lib/synapse-network";

/**
 * O motor da rede de sinapses do login (direção 2026-09-06). Sem canvas: a
 * densidade por plano, a atração ao ponteiro, o retorno e o limite de
 * conexões são provados em pixels de tela, com aleatoriedade injetada.
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

function network(seed = 7, width = 1440, height = 900): SynapseNetwork {
  return new SynapseNetwork(
    width,
    height,
    NetworkComposition.for(width),
    new SeededRandom(seed).next,
  );
}

function tick(net: SynapseNetwork, ms: number, pointer: { x: number; y: number } | null = null) {
  for (let decorrido = 0; decorrido < ms; decorrido += 16) net.tick(16, pointer);
}

function distance(node: NetworkNode, point: { x: number; y: number }): number {
  return Math.hypot(node.x - point.x, node.y - point.y);
}

describe("NetworkComposition — quantos nós por largura", () => {
  it("desktop entre 50 e 90, tablet entre 35 e 60, mobile entre 15 e 35", () => {
    expect(NetworkComposition.for(1920).nodes).toBeGreaterThanOrEqual(50);
    expect(NetworkComposition.for(1920).nodes).toBeLessThanOrEqual(90);
    expect(NetworkComposition.for(1366).nodes).toBeGreaterThanOrEqual(50);
    expect(NetworkComposition.for(1024).nodes).toBeGreaterThanOrEqual(35);
    expect(NetworkComposition.for(1024).nodes).toBeLessThanOrEqual(60);
    expect(NetworkComposition.for(375).nodes).toBeGreaterThanOrEqual(15);
    expect(NetworkComposition.for(375).nodes).toBeLessThanOrEqual(35);
  });

  it("mais largura, mais nós — e a leitura do aparelho acompanha", () => {
    expect(NetworkComposition.for(1920).nodes).toBeGreaterThan(NetworkComposition.for(1280).nodes);
    expect(NetworkComposition.for(1920).device).toBe("desktop");
    expect(NetworkComposition.for(900).device).toBe("tablet");
    expect(NetworkComposition.for(390).device).toBe("mobile");
  });

  it("reparte os nós em três planos, com o fundo mais povoado que a frente", () => {
    const composition = NetworkComposition.for(1920);
    const porPlano = [0, 1, 2].map((plane) => composition.countFor(plane));
    expect(porPlano.reduce((soma, count) => soma + count, 0)).toBe(composition.nodes);
    expect(porPlano[0]).toBeGreaterThan(porPlano[2] ?? 0);
  });
});

describe("SynapseNetwork — nós em três planos com densidade irregular", () => {
  it("nasce com a contagem da composição, cada plano com a sua cota, dentro da tela", () => {
    const net = network();
    const composition = NetworkComposition.for(1440);
    expect(net.snapshot.nodes).toHaveLength(composition.nodes);
    for (const plane of [0, 1, 2]) {
      expect(net.snapshot.nodes.filter((node) => node.plane === plane)).toHaveLength(
        composition.countFor(plane),
      );
    }
    for (const node of net.snapshot.nodes) {
      expect(node.x).toBeGreaterThanOrEqual(0);
      expect(node.x).toBeLessThanOrEqual(1440);
      expect(node.y).toBeGreaterThanOrEqual(0);
      expect(node.y).toBeLessThanOrEqual(900);
    }
  });

  it("é irregular: há regiões cheias e regiões vazias, não uma grade uniforme", () => {
    const net = network();
    const celulas = new Map<string, number>();
    for (const node of net.snapshot.nodes) {
      const chave = `${Math.floor(node.x / 240)}:${Math.floor(node.y / 225)}`;
      celulas.set(chave, (celulas.get(chave) ?? 0) + 1);
    }
    const contagens = [...celulas.values()];
    const totalDeCelulas = 6 * 4;
    expect(contagens.length).toBeLessThan(totalDeCelulas);
    expect(Math.max(...contagens)).toBeGreaterThanOrEqual(3 * Math.max(1, Math.min(...contagens)));
  });

  it("é determinística: a mesma semente produz a mesma rede", () => {
    expect(network(3).snapshot.nodes).toEqual(network(3).snapshot.nodes);
    expect(network(3).snapshot.nodes).not.toEqual(network(4).snapshot.nodes);
  });
});

describe("SynapseNetwork — o ponteiro", () => {
  it("atrai o nó que está dentro do raio do seu plano, e não mexe no que está fora", () => {
    const comPonteiro = network();
    const semPonteiro = network();
    const alvo = comPonteiro.snapshot.nodes.find((node) => node.plane === 2)!;
    const pointer = { x: alvo.x + 60, y: alvo.y + 20 };
    const antes = distance(alvo, pointer);
    tick(comPonteiro, 800, pointer);
    tick(semPonteiro, 800, null);

    const depois = comPonteiro.snapshot.nodes[alvo.id]!;
    expect(distance(depois, pointer)).toBeLessThan(antes - 5);

    const foraDoRaio = comPonteiro.snapshot.nodes.filter(
      (node) => distance(node, pointer) > PLANE_STYLE[2].reach + 40,
    );
    expect(foraDoRaio.length).toBeGreaterThan(0);
    for (const node of foraDoRaio) {
      expect(node.x).toBe(semPonteiro.snapshot.nodes[node.id]!.x);
      expect(node.y).toBe(semPonteiro.snapshot.nodes[node.id]!.y);
    }
  });

  it("os raios crescem com o plano e ficam entre 120 e 220 px", () => {
    expect(PLANE_STYLE[0].reach).toBeGreaterThanOrEqual(120);
    expect(PLANE_STYLE[2].reach).toBeLessThanOrEqual(220);
    expect(PLANE_STYLE[0].reach).toBeLessThan(PLANE_STYLE[1].reach);
    expect(PLANE_STYLE[1].reach).toBeLessThan(PLANE_STYLE[2].reach);
  });

  it("sem ponteiro, o nó volta para onde estaria aos poucos — nunca num salto", () => {
    const net = network();
    const gemea = network();
    const alvo = net.snapshot.nodes.find((node) => node.plane === 2)!;
    const pointer = { x: alvo.x + 60, y: alvo.y + 20 };
    tick(net, 800, pointer);
    tick(gemea, 800, null);
    let anterior = net.snapshot.nodes[alvo.id]!;
    const afastado = distance(anterior, gemea.snapshot.nodes[alvo.id]!);
    expect(afastado).toBeGreaterThan(5);
    let maiorPasso = 0;
    for (let quadro = 0; quadro < 90; quadro += 1) {
      net.tick(16, null);
      gemea.tick(16, null);
      const atual = net.snapshot.nodes[alvo.id]!;
      maiorPasso = Math.max(maiorPasso, distance(atual, anterior));
      anterior = atual;
    }
    expect(distance(anterior, gemea.snapshot.nodes[alvo.id]!)).toBeLessThan(afastado / 2);
    expect(maiorPasso).toBeLessThan(4);
  });
});

describe("SynapseNetwork — conexões e pulsos", () => {
  it("liga vizinhos próximos e nenhum nó passa do limite de conexões do seu plano", () => {
    const net = network(11);
    net.tick(16, null);
    const { links, nodes } = net.snapshot;
    expect(links.length).toBeGreaterThan(0);
    const porNo = new Map<number, number>();
    for (const link of links) {
      porNo.set(link.from, (porNo.get(link.from) ?? 0) + 1);
      porNo.set(link.to, (porNo.get(link.to) ?? 0) + 1);
    }
    for (const node of nodes) {
      expect(porNo.get(node.id) ?? 0).toBeLessThanOrEqual(PLANE_STYLE[node.plane].maxLinks);
    }
  });

  it("um pulso acende os nós perto da frente de onda e se apaga entre 300 e 500 ms", () => {
    const net = network();
    const origem = net.snapshot.nodes[0]!;
    net.pulse({ x: origem.x, y: origem.y });
    expect(net.snapshot.pulses).toHaveLength(1);
    const duration = net.snapshot.pulses[0]!.duration;
    expect(duration).toBeGreaterThanOrEqual(300);
    expect(duration).toBeLessThanOrEqual(500);
    net.tick(16, null);
    expect(net.snapshot.nodes[0]!.glow).toBeGreaterThan(0.3);
    tick(net, duration + 100);
    expect(net.snapshot.pulses).toHaveLength(0);
  });

  it("a ênfase acende só os nós dentro da zona e apaga quando a zona sai", () => {
    const net = network();
    const zona = { x: 900, y: 200, width: 440, height: 500 };
    net.emphasize(zona);
    tick(net, 600);
    const dentro = net.snapshot.nodes.filter(
      (node) =>
        node.x >= zona.x &&
        node.x <= zona.x + zona.width &&
        node.y >= zona.y &&
        node.y <= zona.y + zona.height,
    );
    const longe = net.snapshot.nodes.filter((node) => node.x < zona.x - 200);
    expect(dentro.length).toBeGreaterThan(0);
    expect(longe.length).toBeGreaterThan(0);
    for (const node of dentro) expect(node.glow).toBeGreaterThan(0.3);
    for (const node of longe) expect(node.glow).toBeLessThan(0.05);
    net.emphasize(null);
    tick(net, 1500);
    for (const node of dentro) expect(net.snapshot.nodes[node.id]!.glow).toBeLessThan(0.05);
  });

  it("o passo do relógio é limitado: uma aba que ficou parada não teletransporta a rede", () => {
    const parada = network();
    const contida = network();
    parada.tick(5000, null);
    contida.tick(50, null);
    expect(parada.snapshot.nodes).toEqual(contida.snapshot.nodes);
  });
});
