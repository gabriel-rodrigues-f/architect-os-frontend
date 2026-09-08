import { describe, expect, it, vi } from "vitest";

import { SynapseNetwork, SynapseSignals } from "@/lib/synapse-network";
import { EntrancePulseCeremony } from "@/lib/synapse-outcome";

/**
 * Dono (2026-09-08): *"ao inserir a senha correta na tela de login eu quero
 * ver a rede de sinapse piscando em azul, assim como pisca em vermelho quando
 * erro a senha. Se necessário, atrase 1 segundo a entrada do usuário para que
 * seja possível ver a piscada em azul"*.
 *
 * O pulso azul já disparava no 2xx — só que a sessão abria no mesmo instante
 * e a tela trocava antes de a onda cruzar. A cerimônia é a espera: pulsa,
 * espera a onda TERMINAR, e só então devolve o controle a quem abre a sessão.
 *
 * A espera é a duração do MOTOR (`SynapseNetwork.COLLECTIVE_PULSE_DURATION_MS`),
 * não um número escrito na tela: se a onda mudar de ritmo, a espera muda com
 * ela. E com movimento reduzido não há onda — logo não há espera.
 */
describe("EntrancePulseCeremony — a entrada espera a onda azul terminar", () => {
  it("pulsa azul e espera exatamente o tempo da onda coletiva do motor", async () => {
    const signals = new SynapseSignals();
    const esperas: number[] = [];
    const ceremony = new EntrancePulseCeremony(signals, false, async (ms) => {
      esperas.push(ms);
    });

    await ceremony.celebrate();

    expect(signals.drainPulses()).toEqual(["primary"]);
    expect(esperas).toEqual([SynapseNetwork.COLLECTIVE_PULSE_DURATION_MS]);
  });

  it("com movimento reduzido, pulsa nada e não espera nada — a entrada é imediata", async () => {
    const signals = new SynapseSignals();
    const esperas: number[] = [];
    const ceremony = new EntrancePulseCeremony(signals, true, async (ms) => {
      esperas.push(ms);
    });

    await ceremony.celebrate();

    expect(signals.drainPulses()).toEqual([]);
    expect(esperas).toEqual([]);
  });

  it("sem rede na tela (sem sinais), a entrada não fica presa esperando", async () => {
    const esperas: number[] = [];
    const ceremony = new EntrancePulseCeremony(null, false, async (ms) => {
      esperas.push(ms);
    });

    await ceremony.celebrate();

    expect(esperas).toEqual([]);
  });

  it("a espera padrão é o relógio do navegador — e ela realmente espera", async () => {
    vi.useFakeTimers();
    try {
      const signals = new SynapseSignals();
      let terminou = false;
      const espera = new EntrancePulseCeremony(signals, false).celebrate().then(() => {
        terminou = true;
      });

      await vi.advanceTimersByTimeAsync(SynapseNetwork.COLLECTIVE_PULSE_DURATION_MS - 1);
      expect(terminou).toBe(false);

      await vi.advanceTimersByTimeAsync(1);
      await espera;
      expect(terminou).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});
