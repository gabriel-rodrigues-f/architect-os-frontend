/**
 * O QUE A TELA DIZ À REDE — sem a tela conhecer o canvas.
 *
 * O `LoginScreen` avisa que um campo ganhou foco (os nós perto do cartão
 * ganham intensidade) e que a pessoa clicou em Entrar (um pulso corre pela
 * rede). O `SynapseBackground` lê estes sinais a cada quadro; a autenticação
 * nunca espera pela animação — o pulso é disparado e esquecido.
 */
export class SynapseSignals {
  private pendingPulses = 0;
  private emphasized = false;

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
}
