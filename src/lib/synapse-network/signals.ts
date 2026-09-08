import type { CollectivePulse, CollectivePulseListener, PulseTone } from "./synapse-network";

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
 *
 * O tom (dono, 2026-09-08): `pulseWith("danger")` é a recusa, `pulseWith("primary")`
 * o sucesso. A fila guarda UM pedido por tom — dois pedidos do mesmo tom antes
 * do quadro seguinte são um pulso só. Hoje quem pede pulso é a PORTA: dentro
 * da aplicação logada a rede fica viva sem piscar (dono, 2026-09-08).
 */
export class SynapseSignals {
  private readonly pendingTones = new Set<PulseTone>();
  private emphasized = false;
  private readonly collectiveListeners = new Set<CollectivePulseListener>();

  /** O pulso primário — o de sempre. */
  pulse(): void {
    this.pulseWith("primary");
  }

  pulseWith(tone: PulseTone): void {
    this.pendingTones.add(tone);
  }

  emphasize(on: boolean): void {
    this.emphasized = on;
  }

  get isEmphasized(): boolean {
    return this.emphasized;
  }

  /** O palco lê os tons pendentes e zera a fila. */
  drainPulses(): readonly PulseTone[] {
    const tones = [...this.pendingTones];
    this.pendingTones.clear();
    return tones;
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
