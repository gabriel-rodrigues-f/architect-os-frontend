import type { ApiClient } from "./api-client";
import { ApiError, UserFacingError } from "./api-errors";

export const GENERATION_PROFILE_NAMES = ["empirical", "moderate", "methodical"] as const;

export type GenerationProfileName = (typeof GENERATION_PROFILE_NAMES)[number];

export type SessionAgenda = "one-on-one" | "development-plan";

export const PERSON_DOSSIER_ABSENCES = [
  "seniority",
  "team",
  "teamRuler",
  "observedLevels",
  "assessment",
  "developmentPlan",
  "learningPath",
  "evidence",
  "mentoring",
  "evolutionHistory",
] as const;

export type PersonDossierAbsence = (typeof PERSON_DOSSIER_ABSENCES)[number];

/**
 * A ausência nomeada do dossiê (ADR-0086 §2) vira rótulo de tela por uma
 * classe, e não por um `t(\`ai.absence.${x}\`)` solto: o nome vem do
 * servidor como texto livre, e um nome novo do backend não pode virar chave
 * crua na tela. Desconhecido não se desenha.
 */
export class AdviceAbsences {
  static labelKeyOf(absence: string): `ai.absence.${PersonDossierAbsence}` | null {
    return (PERSON_DOSSIER_ABSENCES as readonly string[]).includes(absence)
      ? `ai.absence.${absence as PersonDossierAbsence}`
      : null;
  }
}

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

  static labelKeyOf(profile: GenerationProfileName): `ai.profile.${GenerationProfileName}` {
    return `ai.profile.${profile}`;
  }

  static hintKeyOf(profile: GenerationProfileName): `ai.profile.${GenerationProfileName}.hint` {
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

export type AssistantFailureKey =
  "ai.failure.timeout" | "ai.failure.offline" | "ai.failure.unknown";

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
    readonly messageKey: AssistantFailureKey | null,
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

  sentence(translate: (key: AssistantFailureKey) => string): string {
    return this.serviceMessage ?? translate(this.messageKey ?? "ai.failure.unknown");
  }
}

export interface AssistantQueryState<T> {
  data: T | undefined;
  error: unknown;
  isFetching: boolean;
  refetch: () => unknown;
}

/**
 * Regra 19 do pedido do dono, inteira, num lugar só: *"estado de
 * carregamento; timeout tratado; erro da API tratado; **tentar novamente**;
 * **sem chamada duplicada** (o botão não dispara duas vezes); erro amigável;
 * e a IA nunca bloqueia operação determinística."*
 *
 * Ela mora numa classe e não num punhado de `useState` porque OITO lugares da
 * aplicação precisam da mesma máquina, e a versão copiada diverge no primeiro
 * conserto: já aconteceu nesta casa com o foco do combobox.
 *
 * Duas decisões que o tipo não conta sozinho:
 *
 *  - o pedido em voo é o ESTADO (`requested`), e a consulta só existe depois
 *    dele. É isso que faz o seletor de perfil ser lido ANTES de gerar, como o
 *    dono pediu: mudar o perfil não dispara nada, porque o perfil não é a
 *    chave da consulta enquanto ninguém clicou;
 *  - `generate` recusa em silêncio enquanto está rodando, e o botão fica
 *    desabilitado pelo mesmo `running`. As duas defesas são de propósito: a
 *    segunda é a que o usuário vê, a primeira é a que sobrevive a um teclado,
 *    a um duplo clique rápido e a um `onClick` disparado por outro caminho.
 */
export class AssistantRunState<P, T> {
  constructor(
    private readonly query: AssistantQueryState<T>,
    readonly request: P | null,
    private readonly ask: (request: P) => void,
  ) {}

  get started(): boolean {
    return this.request !== null;
  }

  get running(): boolean {
    return this.started && this.query.isFetching;
  }

  get advice(): T | undefined {
    return this.running ? undefined : this.query.data;
  }

  get failure(): AssistantFailureReading | null {
    if (this.running) return null;
    const failure: unknown = this.query.error;
    return failure === null || failure === undefined ? null : AssistantFailureReading.of(failure);
  }

  generate(request: P): void {
    if (this.running) return;
    this.ask(request);
  }

  retry(): void {
    void this.query.refetch();
  }
}

export interface TranscribableAdvice {
  readonly notice: string;
  readonly facts: readonly string[];
  readonly narration: string | null;
  readonly outline?: readonly string[];
}

/**
 * O texto que o botão "Copiar" põe na área de transferência.
 *
 * O dono pediu *"o próximo passo claro (copiar, editar, ou abrir a operação
 * que grava)"*, e copiar só serve se o que sai for utilizável fora da tela —
 * daí a transcrição levar junto os FATOS e o aviso de que aquilo é sugestão.
 * Copiar só o parágrafo entregaria a interpretação sem a apuração que a
 * sustenta, que é o contrário do que a frente inteira defende.
 */
export class AdviceTranscript {
  static of(advice: TranscribableAdvice, headline: string): string {
    const outline = advice.outline ?? [];
    return [
      headline,
      ...(outline.length > 0 ? ["", ...outline.map((step) => `- ${step}`)] : []),
      ...(advice.narration === null ? [] : ["", advice.narration]),
      ...(advice.facts.length > 0 ? ["", ...advice.facts.map((fact) => `* ${fact}`)] : []),
      "",
      advice.notice,
    ].join("\n");
  }
}

export interface CareerReadinessFigures {
  readonly currentCareerLevel: string | null;
  readonly nextCareerLevel: string | null;
  readonly eligible: boolean | null;
  readonly qualifiedCapabilityCount: number;
  readonly minimumQualifiedCapabilities: number | null;
}

/**
 * O VEREDITO, e a exigência literal do dono sobre ele: *"a elegibilidade
 * continua sendo calculada pelo motor determinístico; a IA SÓ explica. Se a
 * IA cair, o veredito continua aparecendo."*
 *
 * Ele viaja no mesmo corpo do parágrafo (ADR-0087), então a tela consegue
 * cumprir essa frase sem uma segunda consulta — e esta classe é quem decide o
 * que dá para dizer com o que veio. Cada peça tem o próprio `null`: sem
 * próximo nível não há transição, sem mínimo não há contagem, sem veredito
 * não há palavra. Nada aqui se aproxima de recalcular elegibilidade: a
 * segunda cópia dessa regra apareceria como duas telas discordando sobre a
 * promoção de alguém.
 */
export class CareerReadinessReading {
  constructor(private readonly verdict: CareerReadinessFigures) {}

  get transition(): { from: string; to: string } | null {
    const { currentCareerLevel: from, nextCareerLevel: to } = this.verdict;
    return from === null || to === null ? null : { from, to };
  }

  get eligibilityKey(): "ai.readiness.eligible" | "ai.readiness.notEligible" | null {
    if (this.verdict.eligible === null) return null;
    return this.verdict.eligible ? "ai.readiness.eligible" : "ai.readiness.notEligible";
  }

  get qualified(): { count: number; minimum: number } | null {
    const minimum = this.verdict.minimumQualifiedCapabilities;
    return minimum === null ? null : { count: this.verdict.qualifiedCapabilityCount, minimum };
  }
}
