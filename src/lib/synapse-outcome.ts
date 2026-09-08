import type { ApiOutcome } from "./api-client";
import { ApiError } from "./api-errors";
import { ApiFailureReading } from "./api-failure-reading";
import { SynapseNetwork } from "./synapse-network";
import type { PulseTone, SynapseSignals } from "./synapse-network";

/**
 * A RÉGUA DE COR DA REDE (inventário `sinapse-no-fundo-inventario-2026-09-08.md`,
 * §1.3 e §5). O dono: "Sempre que eu preencher algum formulário e conseguir
 * enviar com sucesso, a sinapse fica azul; quando houver mensagem de erro
 * vermelha, a sinapse fica vermelha."
 *
 * Um ponto de anúncio, uma régua: o `ApiClient` entrega (método, recurso,
 * status) e esta classe decide o tom — ou o silêncio. Nenhuma tela decide cor.
 *
 *  - escrita (`POST/PUT/PATCH/DELETE`) com 2xx → `primary` (azul), inclusive
 *    o destrutivo com sucesso: a pessoa pediu e o sistema obedeceu (§5.1);
 *  - recusa 4xx com mensagem vermelha (400, 403, 404, 409, 422) → `danger`;
 *  - `401` → nada: a sessão expirou, a aplicação some (§5.3);
 *  - `0` e `5xx` → nada: é queda de serviço, e a tela de serviço fora fala
 *    por si; um pulso vermelho culparia o que a pessoa digitou (§5.2);
 *  - leitura (`GET`) → nunca; senão toda navegação viraria festa;
 *  - rota silenciosa (`SilentRoutes`) → nunca, em nenhum sentido.
 */
export class SynapseOutcomeRule {
  static toneOf(outcome: ApiOutcome): PulseTone | null {
    if (!SynapseOutcomeRule.isWrite(outcome.method)) return null;
    if (SilentRoutes.covers(outcome.resource)) return null;
    return SynapseOutcomeRule.toneOfStatus(outcome.status);
  }

  /**
   * As PORTAS (login, primeiro acesso, criar senha, recuperação) não passam
   * pela lista de escritas: a tela sabe o resultado do próprio formulário e
   * pergunta aqui. `null` de erro é sucesso; o 401 do login É a recusa; a
   * recusa local (senha que não confere) é mensagem vermelha; e o serviço
   * fora do ar continua não sendo culpa do que foi digitado.
   */
  static toneOfDoorResult(error: unknown): PulseTone | null {
    if (error === null || error === undefined) return "primary";
    if (!(error instanceof ApiError)) return "danger";
    if (SynapseOutcomeRule.isServiceDown(error.status)) return null;
    return "danger";
  }

  private static toneOfStatus(status: number): PulseTone | null {
    if (status >= 200 && status < 300) return "primary";
    if (status === 401) return null;
    if (status >= 400 && status < 500) return "danger";
    return null;
  }

  private static isServiceDown(status: number): boolean {
    return status === ApiFailureReading.SEM_RESPOSTA_STATUS || status >= 500;
  }

  private static isWrite(method: string): boolean {
    return SynapseOutcomeRule.WRITE_METHODS.has(method.toUpperCase());
  }

  private static readonly WRITE_METHODS: ReadonlySet<string> = new Set([
    "POST",
    "PUT",
    "PATCH",
    "DELETE",
  ]);
}

/**
 * O QUE NÃO PULSA, por nome (§5.9–5.12): as consultas de IA (não são
 * formulários — o pulso é eco do envio), as exportações (leitura que baixa
 * arquivo), marcar aviso como lido (sem formulário, sem vermelho) e as rotas
 * das PORTAS — o login, o primeiro acesso, a senha e a recuperação têm a sua
 * própria rede e anunciam o resultado elas mesmas, depois da resposta.
 *
 * É uma lista nomeada, não um `if` solto: uma rota nova de IA entra aqui, e o
 * teste do gate prova cada linha.
 */
export class SilentRoutes {
  static readonly ASSISTANTS: readonly RegExp[] = [
    /\/one-on-one-preparation(?:\?|$)/,
    /\/session-script(?:\?|$)/,
    /\/career-readiness-explanation(?:\?|$)/,
    /\/development-plan-recommendation(?:\?|$)/,
    /\/review-assistance(?:\?|$)/,
    /\/calibration-assistance(?:\?|$)/,
    /\/stagnation-alert(?:\?|$)/,
    /^\/capabilities\/quality-review(?:\?|$)/,
  ];

  static readonly EXPORTS: readonly RegExp[] = [/^\/reports\//];

  static readonly NOTICES: readonly RegExp[] = [
    /^\/notices\/[^/]+\/read(?:\?|$)/,
    /^\/notices\/read-all(?:\?|$)/,
  ];

  static readonly DOORS: readonly RegExp[] = [
    /^\/auth\/login(?:\?|$)/,
    /^\/auth\/register(?:\?|$)/,
    /^\/auth\/logout(?:\?|$)/,
    /^\/auth\/change-password(?:\?|$)/,
    /^\/auth\/access-recovery(?:\?|$)/,
    /^\/auth\/set-password(?:\?|$)/,
  ];

  static readonly ALL: readonly RegExp[] = [
    ...SilentRoutes.ASSISTANTS,
    ...SilentRoutes.EXPORTS,
    ...SilentRoutes.NOTICES,
    ...SilentRoutes.DOORS,
  ];

  static covers(resource: string): boolean {
    return SilentRoutes.ALL.some((pattern) => pattern.test(resource));
  }
}

/**
 * O ANÚNCIO À REDE, coalescido (§1.3-4, §5.6): pontuar uma avaliação dispara
 * uma escrita POR competência, e a rede não deve tremer doze vezes porque
 * doze competências foram pontuadas. Pulsos do mesmo tom dentro da janela
 * viram um só; a coalescência é POR TOM — a recusa no meio do lote continua
 * pulsando vermelho.
 */
export class SynapseOutcomeAnnouncer {
  static readonly WINDOW_MS = 400;

  private readonly lastPulsedAt = new Map<PulseTone, number>();

  constructor(
    private readonly signals: SynapseSignals,
    private readonly now: () => number = () => Date.now(),
  ) {}

  observe(outcome: ApiOutcome): void {
    const tone = SynapseOutcomeRule.toneOf(outcome);
    if (tone === null) return;
    const moment = this.now();
    const last = this.lastPulsedAt.get(tone);
    if (last !== undefined && moment - last < SynapseOutcomeAnnouncer.WINDOW_MS) return;
    this.lastPulsedAt.set(tone, moment);
    this.signals.pulseWith(tone);
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
