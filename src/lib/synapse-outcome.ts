import { ApiError } from "./api-errors";
import { ApiFailureReading } from "./api-failure-reading";
import { SynapseNetwork } from "./synapse-network";
import type { PulseTone, SynapseSignals } from "./synapse-network";

/**
 * A RÉGUA DE COR DA REDE — hoje só a da PORTA (dono, 2026-09-08: *"vamos
 * manter a sinapse dentro da aplicação pós usuário logado, mas remova a
 * piscada, tanto azul quanto vermelha"*).
 *
 * Dentro da aplicação logada a rede continua VIVA no fundo, pelo movimento
 * próprio dos nós, e NADA a faz pulsar: nem o 2xx de uma escrita, nem a
 * recusa 4xx, nem a recusa local. Por isso saíram daqui a régua de escrita
 * (`toneOf`), a lista de rotas silenciosas e o anúncio coalescido — não
 * havia mais quem os chamasse.
 *
 * O que ficou é a régua da PORTA: login, primeiro acesso, criar senha e
 * recuperação continuam anunciando o próprio resultado, porque foi pedido do
 * dono e é fora da aplicação logada.
 */
export class SynapseOutcomeRule {
  /**
   * As PORTAS sabem o resultado do próprio formulário e perguntam aqui.
   * `null` de erro é sucesso; o 401 do login É a recusa; a recusa local
   * (senha que não confere) é mensagem vermelha; e o serviço fora do ar
   * continua não sendo culpa do que foi digitado.
   */
  static toneOfDoorResult(error: unknown): PulseTone | null {
    if (error === null || error === undefined) return "primary";
    if (!(error instanceof ApiError)) return "danger";
    if (SynapseOutcomeRule.isServiceDown(error.status)) return null;
    return "danger";
  }

  private static isServiceDown(status: number): boolean {
    return status === ApiFailureReading.SEM_RESPOSTA_STATUS || status >= 500;
  }
}

/**
 * A ENTRADA ESPERA A PISCADA AZUL — dono, 2026-09-08: *"ao inserir a senha
 * correta na tela de login eu quero ver a rede de sinapse piscando em azul,
 * assim como pisca em vermelho quando erro a senha. Se necessário, atrase 1
 * segundo a entrada do usuário para que seja possível ver a piscada em azul"*.
 *
 * O pulso azul já disparava no 2xx; o que faltava era TEMPO. A sessão abria
 * no mesmo instante e a aplicação trocava a tela antes de a onda cruzar a
 * rede. Aqui a ordem fica explícita: pulsa, espera a onda terminar, e só
 * então quem chamou abre a sessão.
 *
 * Duas coisas de propósito:
 *  - a espera é a duração do MOTOR (`COLLECTIVE_PULSE_DURATION_MS`), lida na
 *    hora: se a onda mudar de ritmo, a espera muda junto — não há "1000" solto;
 *  - com movimento reduzido não há onda, logo não há espera. A preferência
 *    tira a animação, e com ela o motivo de esperar.
 *
 * A RECUSA não passa por aqui: o vermelho pulsa e a tela já está no lugar
 * onde a pessoa vai corrigir a senha — não há nada a esperar.
 */
export class EntrancePulseCeremony {
  constructor(
    private readonly signals: SynapseSignals | null,
    private readonly reducedMotion: boolean,
    private readonly wait: (ms: number) => Promise<void> = (ms) =>
      new Promise((resolve) => setTimeout(resolve, ms)),
  ) {}

  async celebrate(): Promise<void> {
    if (!this.signals || this.reducedMotion) return;
    this.signals.pulseWith("primary");
    await this.wait(SynapseNetwork.COLLECTIVE_PULSE_DURATION_MS);
  }
}
