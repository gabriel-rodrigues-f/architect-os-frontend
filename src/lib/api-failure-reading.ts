import { ApiError } from "./api-errors";
import { BaseDictionary, type MessageKey } from "./i18n";
import { RefusalNumber } from "./refusal-number";

/**
 * A frase que a tela mostra quando a falha não é de negócio.
 *
 * Ordem do dono (2026-09-03), literal: *"o usuário final não pode ver erros
 * técnicos em nenhuma, absolutamente nenhuma parte da aplicação."* A captura
 * que veio junto era a tela de login com, em vermelho, dentro do formulário:
 *
 *     POST /api/v1/auth/login falhou (404)
 *
 * Verbo HTTP, caminho da API e código de status — os três na cara de quem só
 * queria entrar. A frase era MONTADA (`${método} ${caminho} falhou (${status})`)
 * no `api-client.ts` e em dez chamadas do `state-contexts.gateway.ts`, e o
 * `ApiError` que ela alimenta é lido direto por `authErrorMessage`, pelo
 * `useAsyncSubmit`, pelo `MutationRunner` e pelos view-models. Um lugar só
 * vazava para a aplicação inteira.
 *
 * Aqui a frase deixa de ser montada e passa a ser ESCOLHIDA pelo que
 * aconteceu: uma situação, uma frase, escrita para gente e dizendo o que a
 * pessoa pode fazer. O detalhe técnico continua existindo — o status, o código
 * e a causa seguem no `ApiError`, no `console.error` do `MutationRunner` e na
 * telemetria — mas nunca mais na tela.
 *
 * ONDA "O ERRO NÃO CONTA NADA" (dono, 2026-09-09), duas mudanças:
 *
 *  1. **A frase mora no DICIONÁRIO**, uma chave por situação, nos dois
 *     idiomas. Ela era literal de TS e só existia em pt-BR: quem escolheu
 *     inglês lia português toda vez que uma leitura falhava. Como o `ApiError`
 *     nasce longe do provedor de i18n, a `sentence` resolve na língua base e
 *     quem tem `t` em mãos traduz pela `messageKey`.
 *
 *  2. **Quando a casa não conseguiu falar com o serviço, a frase é NOSSA**
 *     (`silencesTheService`). Antes, `apiFailureOf` fazia `body?.message ??
 *     <situação>`: serviço que fala ganhava sempre, e num 5xx quem falava era
 *     o estado interno da casa — "Banco de dados temporariamente
 *     indisponível", "Serviço de proteção contra força bruta indisponível",
 *     "yearsAsProfessional inválido no profissional <uuid>". Nenhuma dessas
 *     frases muda o próximo gesto de quem lê; todas contam como somos por
 *     dentro. Na faixa de negócio (4xx) o serviço continua falando: ali a
 *     frase dele É contrato e diz o que fazer.
 *
 * REGRA 18 (dono, 2026-09-09) — o que ela faz com estas duas linhas: a fatia
 * de erro passou a escolher a frase pela SITUAÇÃO, e com isso publicou NA
 * TELA o mesmo oráculo que a regra 18 fecha na API: quem digitasse o endereço
 * de uma pessoa lia "você não tem permissão" se ela existisse e "não
 * encontramos" se não. Depois da regra, o **403 só carrega recusa de ATO** e
 * o **404 carrega alcance e inexistente juntos** — as duas voltam a ser uma
 * frase só, e é o classificador que fecha o oráculo do lado de cá. Por isso
 * as duas linhas leem `RefusalNumber`, e não o número cru.
 */
export type ApiFailureSituation =
  | "semResposta"
  | "sessaoExpirada"
  | "semPermissao"
  | "naoEncontrado"
  | "conflito"
  | "servicoForaDoAr"
  | "indefinida";

export class ApiFailureReading {
  /** O `fetch` rejeitou: não houve resposta nenhuma para ler. */
  static readonly SEM_RESPOSTA_STATUS = 0;

  private static readonly PRIMEIRO_STATUS_DE_SERVIDOR = 500;

  /**
   * As duas situações em que a aplicação NÃO CONSEGUIU FALAR com a casa: o
   * silêncio (o `fetch` rejeitou) e a casa dizendo que não consegue responder
   * (5xx). Para quem lê, as duas são o mesmo fato — e é o fato que o dono
   * mandou nomear com uma frase só.
   */
  private static readonly SEM_CONVERSA: ReadonlySet<ApiFailureSituation> = new Set([
    "semResposta",
    "servicoForaDoAr",
  ]);

  private static readonly CHAVE: Readonly<Record<ApiFailureSituation, MessageKey>> = {
    semResposta: "error.unavailable",
    sessaoExpirada: "error.sessionExpired",
    semPermissao: "error.forbidden",
    naoEncontrado: "error.notFound",
    conflito: "error.conflict",
    servicoForaDoAr: "error.unavailable",
    indefinida: "error.undefined",
  };

  private constructor(readonly situation: ApiFailureSituation) {}

  static of(status: number): ApiFailureReading {
    return new ApiFailureReading(ApiFailureReading.situationOf(status));
  }

  /**
   * A leitura de uma falha qualquer. O que não é `ApiError` não tem status
   * para ler — e uma exceção do navegador não é resposta de ninguém.
   */
  static ofFailure(failure: unknown): ApiFailureReading {
    return failure instanceof ApiError
      ? ApiFailureReading.of(failure.status)
      : new ApiFailureReading("indefinida");
  }

  /** A chave da frase — para quem tem `t` em mãos e sabe a língua da pessoa. */
  get messageKey(): MessageKey {
    return ApiFailureReading.CHAVE[this.situation];
  }

  /** A frase pronta, na língua base — nunca carrega verbo, caminho nem número. */
  get sentence(): string {
    return BaseDictionary.sentenceOf(this.messageKey);
  }

  /**
   * A casa cala o serviço: o que o backend escreveu não vira texto de tela.
   * `code`, `details` e `correlationId` continuam no `ApiError` — o que morre
   * é a frase, que é a única parte que a pessoa lê.
   */
  get silencesTheService(): boolean {
    return ApiFailureReading.SEM_CONVERSA.has(this.situation);
  }

  private static situationOf(status: number): ApiFailureSituation {
    if (status === ApiFailureReading.SEM_RESPOSTA_STATUS) return "semResposta";
    if (status === 401) return "sessaoExpirada";
    if (status === RefusalNumber.ACT) return "semPermissao";
    if (status === RefusalNumber.OUT_OF_REACH || status === 410) return "naoEncontrado";
    if (status === 409 || status === 412 || status === 428) return "conflito";
    if (status >= ApiFailureReading.PRIMEIRO_STATUS_DE_SERVIDOR) return "servicoForaDoAr";
    return "indefinida";
  }
}
