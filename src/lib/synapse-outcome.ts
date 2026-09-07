import type { ApiOutcome } from "./api-client";
import { ApiError } from "./api-errors";
import { ApiFailureReading } from "./api-failure-reading";
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
