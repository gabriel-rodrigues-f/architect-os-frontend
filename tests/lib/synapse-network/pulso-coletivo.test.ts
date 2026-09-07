import { describe, expect, it } from "vitest";

import {
  NetworkComposition,
  SynapseNetwork,
  SynapseSignals,
  type CollectivePulse,
} from "@/lib/synapse-network";

/**
 * O pulso COLETIVO da rede (dono, 2026-09-07): "quando os neurônios da tela
 * de login piscarem todos juntos, quero que as palavras 'Synapse' e
 * 'Desenvolvimento de capacidades' pisquem juntos [...] mas somente quando os
 * neurônios piscarem todos juntos. Eles piscam diversas vezes, mas nem sempre
 * todos juntos."
 *
 * O motor distingue o pulso LOCAL (um nó, um raio curto, frequente) do
 * COLETIVO (a rede inteira, raro) e só o coletivo vira evento com duração.
 * O clique em Entrar é coletivo. Tudo determinístico com o RNG injetado.
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

/** Avança `ms` em passos de 16 e anota que tipos de pulso apareceram no caminho. */
function tick(net: SynapseNetwork, ms: number): Set<string> {
  const vistos = new Set<string>();
  for (let decorrido = 0; decorrido < ms; decorrido += 16) {
    net.tick(16, null);
    for (const pulse of net.snapshot.pulses) vistos.add(pulse.kind);
  }
  return vistos;
}

describe("SynapseNetwork — pulso local e pulso coletivo", () => {
  it("o clique em Entrar é coletivo: alcança a rede inteira e dura mais que um pulso local", () => {
    const net = network();
    net.pulse({ x: 900, y: 450 });
    const [coletivo] = net.snapshot.pulses;
    expect(coletivo?.kind).toBe("collective");
    // Do ponto de origem até o canto mais distante: a frente alcança todo nó.
    expect(coletivo!.radius).toBeGreaterThanOrEqual(Math.hypot(900, 450));
    expect(coletivo!.duration).toBeGreaterThanOrEqual(900);
    expect(coletivo!.duration).toBeLessThanOrEqual(1600);

    const local = network();
    local.pulse({ x: 900, y: 450 }, "local");
    expect(local.snapshot.pulses[0]?.kind).toBe("local");
    expect(local.snapshot.pulses[0]!.duration).toBeLessThan(coletivo!.duration);
    expect(local.snapshot.pulses[0]!.radius).toBeLessThan(coletivo!.radius);
  });

  it("o coletivo dispara o evento com início e duração; o local não dispara nada", () => {
    const net = network();
    const eventos: CollectivePulse[] = [];
    net.onCollectivePulse((pulse) => eventos.push(pulse));

    net.pulse({ x: 100, y: 100 }, "local");
    net.tick(16, null);
    expect(eventos).toHaveLength(0);

    net.pulse({ x: 100, y: 100 });
    expect(eventos).toHaveLength(1);
    expect(eventos[0]!.durationMs).toBe(
      net.snapshot.pulses.find((pulse) => pulse.kind === "collective")!.duration,
    );
    expect(eventos[0]!.startedAt).toBeGreaterThanOrEqual(0);
  });

  it("a cadência espontânea: locais em menos de 10 s, o primeiro coletivo entre 12 e 20 s — e nunca antes", () => {
    const net = network(3);
    const eventos: CollectivePulse[] = [];
    net.onCollectivePulse((pulse) => eventos.push(pulse));

    const ate10s = tick(net, 10_000);
    expect(ate10s.has("local")).toBe(true);
    expect(ate10s.has("collective")).toBe(false);
    expect(eventos).toHaveLength(0);

    tick(net, 2_000);
    expect(eventos).toHaveLength(0);

    const ate20s = tick(net, 8_100);
    expect(ate20s.has("collective")).toBe(true);
    expect(eventos).toHaveLength(1);
    expect(eventos[0]!.startedAt).toBeGreaterThanOrEqual(12_000);
    expect(eventos[0]!.startedAt).toBeLessThanOrEqual(20_100);
  });

  it("é determinística: a mesma semente produz a mesma cadência de coletivos", () => {
    const primeira: number[] = [];
    const segunda: number[] = [];
    const uma = network(5);
    const outra = network(5);
    uma.onCollectivePulse((pulse) => primeira.push(pulse.startedAt));
    outra.onCollectivePulse((pulse) => segunda.push(pulse.startedAt));
    tick(uma, 45_000);
    tick(outra, 45_000);
    expect(primeira.length).toBeGreaterThanOrEqual(2);
    expect(primeira).toEqual(segunda);
  });

  it("o coletivo acende a rede toda: ao fim do pulso, todo nó passou por um brilho alto", () => {
    const net = network();
    net.pulse({ x: 720, y: 450 });
    const pico = new Map<number, number>();
    const duration = net.snapshot.pulses[0]!.duration;
    for (let decorrido = 0; decorrido <= duration + 100; decorrido += 16) {
      net.tick(16, null);
      for (const node of net.snapshot.nodes) {
        pico.set(node.id, Math.max(pico.get(node.id) ?? 0, node.glow));
      }
    }
    const acesos = [...pico.values()].filter((glow) => glow > 0.4).length;
    expect(acesos / pico.size).toBeGreaterThan(0.9);
  });

  it("cancelar a inscrição silencia o ouvinte", () => {
    const net = network();
    const eventos: CollectivePulse[] = [];
    const parar = net.onCollectivePulse((pulse) => eventos.push(pulse));
    parar();
    net.pulse();
    expect(eventos).toHaveLength(0);
  });
});

describe("SynapseSignals — o coletivo chega à tela como evento", () => {
  it("anuncia o pulso coletivo a quem se inscreveu, com início e duração, e respeita o cancelamento", () => {
    const signals = new SynapseSignals();
    const recebidos: CollectivePulse[] = [];
    const parar = signals.onCollectivePulse((pulse) => recebidos.push(pulse));
    signals.announceCollectivePulse({ startedAt: 1000, durationMs: 1200 });
    expect(recebidos).toEqual([{ startedAt: 1000, durationMs: 1200 }]);
    parar();
    signals.announceCollectivePulse({ startedAt: 2000, durationMs: 1200 });
    expect(recebidos).toHaveLength(1);
  });
});
