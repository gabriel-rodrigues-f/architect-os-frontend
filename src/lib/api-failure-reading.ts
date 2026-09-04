/**
 * A frase que a tela mostra quando o serviço recusa e NÃO mandou frase própria.
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
 * Quando o SERVIÇO fala, a tela repete o serviço: `apiFailureOf` só cai nesta
 * leitura quando o corpo da resposta não traz `message`. As recusas PT-BR do
 * backend são contrato (mesma régua da `AssistantFailureReading`), e traduzi-las
 * de novo aqui produziria duas frases para o mesmo fato.
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

  private static readonly SENTENCA: Readonly<Record<ApiFailureSituation, string>> = {
    semResposta: "Não foi possível falar com o serviço. Verifique sua conexão e tente novamente.",
    sessaoExpirada: "Sua sessão expirou. Entre de novo para continuar.",
    semPermissao:
      "Você não tem permissão para fazer isso. Peça acesso a quem administra o sistema.",
    naoEncontrado: "Não encontramos o que você pediu. Atualize a página e tente de novo.",
    conflito: "Alguém mudou esse registro antes de você. Atualize a página e refaça a alteração.",
    servicoForaDoAr: "O serviço está fora do ar no momento. Tente de novo em alguns instantes.",
    indefinida: "Não foi possível concluir essa ação agora. Tente de novo em alguns instantes.",
  };

  private constructor(readonly situation: ApiFailureSituation) {}

  static of(status: number): ApiFailureReading {
    return new ApiFailureReading(ApiFailureReading.situationOf(status));
  }

  /** A frase pronta para a tela — nunca carrega verbo, caminho nem número. */
  get sentence(): string {
    return ApiFailureReading.SENTENCA[this.situation];
  }

  private static situationOf(status: number): ApiFailureSituation {
    if (status === ApiFailureReading.SEM_RESPOSTA_STATUS) return "semResposta";
    if (status === 401) return "sessaoExpirada";
    if (status === 403) return "semPermissao";
    if (status === 404 || status === 410) return "naoEncontrado";
    if (status === 409 || status === 412 || status === 428) return "conflito";
    if (status >= ApiFailureReading.PRIMEIRO_STATUS_DE_SERVIDOR) return "servicoForaDoAr";
    return "indefinida";
  }
}
