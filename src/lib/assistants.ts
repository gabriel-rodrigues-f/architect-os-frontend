import type { ApiClient } from "./api-client";
import { ApiError, UserFacingError } from "./api-errors";

export const GENERATION_PROFILE_NAMES = ["empirical", "moderate", "methodical"] as const;

export type GenerationProfileName = (typeof GENERATION_PROFILE_NAMES)[number];

export type SessionAgenda = "one-on-one" | "development-plan";

/**
 * O PERFIL DE GERAÇÃO, do lado da tela.
 *
 * Pedido literal do dono: os três perfis aparecem ANTES de gerar, e
 * **Moderado é o padrão**. O padrão mora aqui e não num `useState("moderate")`
 * porque duas telas o escolhem — e um padrão copiado é um padrão que diverge.
 * O que cada perfil FAZ é do backend (ADR-0087): aqui ele é só a escolha.
 */
export class GenerationProfileChoice {
  static readonly NAMES = GENERATION_PROFILE_NAMES;
  static readonly DEFAULT: GenerationProfileName = "moderate";

  static labelKeyOf(profile: GenerationProfileName): string {
    return `ai.profile.${profile}`;
  }

  static hintKeyOf(profile: GenerationProfileName): string {
    return `ai.profile.${profile}.hint`;
  }

  static isKnown(candidate: string): candidate is GenerationProfileName {
    return (GENERATION_PROFILE_NAMES as readonly string[]).includes(candidate);
  }
}

/**
 * Regra 19 do pedido do dono: *"timeout tratado"*.
 *
 * O `ApiClient` da casa não tem tempo-limite nenhum, e até agora isso nunca
 * incomodou: toda rota responde em milissegundos. Uma rota de IA é a primeira
 * que pode demorar minutos — e sem esta classe o botão gira para sempre, que é
 * exatamente o estado que o dono mandou tratar.
 *
 * O erro tem tipo próprio porque a tela precisa distinguir "demorou demais" de
 * "está sem rede": as duas frases dizem coisas diferentes a quem espera, e a
 * segunda pede que a pessoa olhe a conexão.
 */
export class AssistantTimedOutError extends UserFacingError {
  constructor(
    readonly afterMs: number,
    cause?: unknown,
  ) {
    super("A geração demorou mais do que o previsto e foi interrompida.", { cause });
    this.name = "AssistantTimedOutError";
  }
}

/**
 * A CHAMADA de um assistente: `GET`, com tempo-limite e com o esquema do
 * corpo conferido na porta.
 *
 * Ela é uma classe só porque os dois gateways de assistente precisam
 * exatamente disto (regra de reuso), e porque o tempo-limite tem de ser o
 * mesmo nos oito — um assistente com teto próprio seria um lugar a mais para
 * a tela travar de um jeito diferente.
 */
export class AssistantCall {
  static readonly DEFAULT_TIMEOUT_MS = 45_000;

  constructor(
    private readonly client: ApiClient,
    private readonly timeoutMs: number = AssistantCall.DEFAULT_TIMEOUT_MS,
  ) {}

  async read<T>(resource: string, parse: (data: unknown) => T): Promise<T> {
    const controller = new AbortController();
    let expired = false;
    const timer = setTimeout(() => {
      expired = true;
      controller.abort();
    }, this.timeoutMs);
    try {
      return parse(await this.client.request<unknown>(resource, { signal: controller.signal }));
    } catch (failure) {
      throw expired ? new AssistantTimedOutError(this.timeoutMs, failure) : failure;
    } finally {
      clearTimeout(timer);
    }
  }

  static resourceOf(path: string, query: Readonly<Record<string, string>> = {}): string {
    const search = new URLSearchParams(query).toString();
    return search === "" ? path : `${path}?${search}`;
  }
}

/**
 * Regra 19 do pedido: *"erro da API tratado"* e *"erro amigável"*.
 *
 * A decisão que esta classe carrega é a mesma das ondas 33 e 35 — **quando o
 * serviço fala, a tela repete o serviço**. As recusas de IA do backend foram
 * escritas para serem lidas por gente ("A leitura em linguagem natural está
 * indisponível no momento. O que o sistema apurou continua válido."), e
 * traduzi-las de novo aqui produziria duas frases para o mesmo fato.
 *
 * Onde o serviço NÃO falou — tempo esgotado, rede caída, falha sem corpo — a
 * frase é nossa, e vem do dicionário, em pt e en.
 */
export class AssistantFailureReading {
  private constructor(
    readonly messageKey: string | null,
    readonly serviceMessage: string | null,
  ) {}

  static of(failure: unknown): AssistantFailureReading {
    if (failure instanceof AssistantTimedOutError) {
      return new AssistantFailureReading("ai.failure.timeout", null);
    }
    if (failure instanceof ApiError) return AssistantFailureReading.ofApiFailure(failure);
    return new AssistantFailureReading("ai.failure.unknown", null);
  }

  private static ofApiFailure(failure: ApiError): AssistantFailureReading {
    if (failure.status === 0) return new AssistantFailureReading("ai.failure.offline", null);
    if (failure.code !== undefined) return new AssistantFailureReading(null, failure.message);
    return new AssistantFailureReading("ai.failure.unknown", null);
  }

  sentence(translate: (key: string) => string): string {
    return this.serviceMessage ?? translate(this.messageKey ?? "ai.failure.unknown");
  }
}
