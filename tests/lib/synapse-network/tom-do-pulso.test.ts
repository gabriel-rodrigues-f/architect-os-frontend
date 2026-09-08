import { describe, expect, it } from "vitest";

import {
  NetworkComposition,
  SynapseNetwork,
  SynapseSignals,
  type CollectivePulse,
  type Zone,
} from "@/lib/synapse-network";

/**
 * O TOM do pulso (dono, 2026-09-08): "se o login for rejeitado, a sinapse deve
 * ser vermelha, no mesmo tom do vermelho de erro do contorno dos campos; só
 * pode ser azul quando o usuário conseguir se logar com sucesso". O motor
 * carrega o tom no pulso, no evento coletivo e no nó aceso — o pincel só lê.
 * O vermelho é sinal, não decoração: enquanto dura, o azul não passa por cima.
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

function network(seed = 7): SynapseNetwork {
  return new SynapseNetwork(1440, 900, NetworkComposition.for(1440), new SeededRandom(seed).next);
}

describe("SynapseNetwork — o pulso carrega o tom", () => {
  it("sem tom, o pulso é primário: é o que os pulsos espontâneos e o login com sucesso usam", () => {
    const net = network();
    net.pulse({ x: 700, y: 450 });
    expect(net.snapshot.pulses[0]?.tone).toBe("primary");
  });

  it("o pulso coletivo de recusa é `danger`, e o evento à marca leva o mesmo tom", () => {
    const net = network();
    const eventos: CollectivePulse[] = [];
    net.onCollectivePulse((pulse) => eventos.push(pulse));
    net.pulse({ x: 700, y: 450 }, "collective", "danger");
    expect(net.snapshot.pulses[0]?.tone).toBe("danger");
    expect(eventos).toEqual([expect.objectContaining({ tone: "danger" })]);
  });

  it("o nó aceso pelo pulso de recusa fica com o tom `danger` — o pincel pinta o nó, não o pulso", () => {
    const net = network();
    net.pulse({ x: 720, y: 450 }, "collective", "danger");
    const tons = new Set<string>();
    for (let decorrido = 0; decorrido <= 1300; decorrido += 16) {
      net.tick(16, null);
      for (const node of net.snapshot.nodes) if (node.glow > 0.4) tons.add(node.tone);
    }
    expect(tons.has("danger")).toBe(true);
    expect(tons.has("primary")).toBe(false);
  });

  it("o vermelho vence enquanto durar: um coletivo primário chegando no meio de um `danger` é descartado", () => {
    const net = network();
    const eventos: CollectivePulse[] = [];
    net.onCollectivePulse((pulse) => eventos.push(pulse));
    net.pulse({ x: 700, y: 450 }, "collective", "danger");
    net.tick(16, null);
    net.pulse({ x: 700, y: 450 }, "collective", "primary");
    const coletivos = net.snapshot.pulses.filter((pulse) => pulse.kind === "collective");
    expect(coletivos.map((pulse) => pulse.tone)).toEqual(["danger"]);
    expect(eventos).toHaveLength(1);
  });

  it("um `danger` chegando no meio de um primário substitui o primário", () => {
    const net = network();
    net.pulse({ x: 700, y: 450 }, "collective", "primary");
    net.tick(16, null);
    net.pulse({ x: 700, y: 450 }, "collective", "danger");
    const coletivos = net.snapshot.pulses.filter((pulse) => pulse.kind === "collective");
    expect(coletivos.map((pulse) => pulse.tone)).toEqual(["danger"]);
  });
});

describe("SynapseSignals — a tela pede o pulso com o tom", () => {
  it("`pulseWith(tone)` enfileira o tom, e o palco lê um pulso por tom por quadro", () => {
    const signals = new SynapseSignals();
    signals.pulseWith("danger");
    signals.pulseWith("danger");
    signals.pulseWith("primary");
    expect([...signals.drainPulses()].sort()).toEqual(["danger", "primary"]);
    expect(signals.drainPulses()).toEqual([]);
  });

  it("`pulse()` continua sendo o pulso primário", () => {
    const signals = new SynapseSignals();
    signals.pulse();
    expect(signals.drainPulses()).toEqual(["primary"]);
  });
});

describe("NetworkComposition — a composição do interior, em toda a viewport", () => {
  const CONTEUDO: Zone = { x: 280, y: 74, width: 1000, height: 826 };

  it("tem menos nós que a do login para a mesma largura — discreta, não ausente", () => {
    const porta = NetworkComposition.for(1440);
    const interior = NetworkComposition.interior(1440);
    expect(interior.nodes).toBeLessThan(porta.nodes);
    expect(interior.nodes).toBeGreaterThanOrEqual(Math.round(porta.nodes * 0.5));
  });

  /**
   * Dono (2026-09-08): *"ainda não vejo a rede de sinapses no fundo da
   * aplicação; quero ver no fundo de todas as telas"*. A fatia anterior punha
   * o `<main>` INTEIRO como zona de exclusão (visibilidade 0) — e o `<main>`
   * é a tela toda. Não sobrava nada visível. Agora o interior não tem zona:
   * a rede corre a viewport inteira, atrás do conteúdo, e aparece nos vãos.
   */
  it("a rede do interior nasce em toda a viewport, e a área do conteúdo tem nós VISÍVEIS", () => {
    const net = new SynapseNetwork(
      1440,
      900,
      NetworkComposition.interior(1440),
      new SeededRandom(11).next,
    );
    const nodes = net.snapshot.nodes;
    const dentro = nodes.filter(
      (node) =>
        node.x >= CONTEUDO.x &&
        node.x <= CONTEUDO.x + CONTEUDO.width &&
        node.y >= CONTEUDO.y &&
        node.y <= CONTEUDO.y + CONTEUDO.height,
    );
    expect(dentro.length).toBeGreaterThan(nodes.length * 0.25);
    for (const node of dentro) expect(node.visibility).toBe(1);
  });

  it("o interior não tem marca: nenhuma aresta é recusada por cruzar letras", () => {
    const interior = NetworkComposition.interior(1440);
    expect(interior.zone).toBeNull();
  });
});
