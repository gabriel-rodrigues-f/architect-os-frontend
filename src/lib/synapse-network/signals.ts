import type { CollectivePulse, CollectivePulseListener } from "./synapse-network";

/**
 * O QUE A TELA DIZ À REDE — e o que a rede diz de volta — sem a tela conhecer
 * o canvas.
 *
 * Para a rede: o `LoginScreen` avisa que um campo ganhou foco (os nós perto
 * do cartão ganham intensidade) e que a pessoa clicou em Entrar (um pulso
 * coletivo corre pela rede). O `SynapseBackground` lê estes sinais a cada
 * quadro; a autenticação nunca espera pela animação — o pulso é disparado e
 * esquecido.
 *
 * Da rede: quando a rede pulsa em COLETIVO (todos os nós juntos), o palco
 * anuncia o evento aqui e a marca (`BrandLockup`) pisca junto, pela mesma
 * duração. O pulso local não passa por este canal.
 */
export class SynapseSignals {
  private pendingPulses = 0;
  private emphasized = false;
  private readonly collectiveListeners = new Set<CollectivePulseListener>();

  pulse(): void {
    this.pendingPulses += 1;
  }

  emphasize(on: boolean): void {
    this.emphasized = on;
  }

  get isEmphasized(): boolean {
    return this.emphasized;
  }

  /** O palco lê os pulsos pendentes e zera a fila. */
  drainPulses(): number {
    const pulses = this.pendingPulses;
    this.pendingPulses = 0;
    return pulses;
  }

  /** Quem quer piscar com a rede. Devolve o cancelamento. */
  onCollectivePulse(listener: CollectivePulseListener): () => void {
    this.collectiveListeners.add(listener);
    return () => {
      this.collectiveListeners.delete(listener);
    };
  }

  /** O palco anuncia: a rede acabou de pulsar em coletivo. */
  announceCollectivePulse(pulse: CollectivePulse): void {
    for (const listener of this.collectiveListeners) listener(pulse);
  }
}
