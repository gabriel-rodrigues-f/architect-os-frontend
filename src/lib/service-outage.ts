import { ApiError } from "./api-errors";
import { ApiFailureReading } from "./api-failure-reading";

/**
 * QUANDO o serviço está fora do ar (dono, 2026-09-06: "desligando o backend
 * propositalmente, todas as telas têm a mensagem… somente Usuários abre o
 * menu completo e mostra um erro discreto. Padronize.").
 *
 * A leitura é UMA e é a mesma da `ApiFailureReading`: a aplicação não
 * conseguiu falar com a casa — ou não houve resposta (o `fetch` rejeitou), ou
 * a casa respondeu que não consegue responder (5xx). Antes eram só 502 e 504
 * numa lista à parte, e o 500 caía no caminho por tela, onde a mensagem crua
 * do servidor vencia; duas classes de falha ganhavam duas aparências.
 *
 * O que NÃO é queda (dono, 2026-09-09, o defeito que o travou): 404, 403,
 * 409 — a casa RESPONDEU, e o que ela respondeu é assunto da tela que
 * perguntou. Um 404 de uma rota derrubava a aplicação inteira na tela do jogo.
 */
export class ServiceOutage {
  /**
   * O 503 é SOBRECARREGADO no contrato: ele diz tanto "a casa caiu" quanto
   * "uma capacidade à parte não respondeu" — a leitura em linguagem natural e
   * a porta do painel de observabilidade. A distinção é pelo CÓDIGO, não pelo
   * número, e o padrão é o mais barato de errar: 503 desconhecido NÃO troca a
   * tela inteira pelo jogo. Regra 19 do dono: *"a IA nunca bloqueia operação
   * determinística"* — e trocar a tela inteira bloquearia.
   */
  private static readonly STATUS_SOBRECARREGADO = 503;

  private static readonly A_CASA_CAIU: ReadonlySet<string> = new Set([
    "DATABASE_UNAVAILABLE",
    "AUTH_RATE_LIMIT_UNAVAILABLE",
  ]);

  static isOutage(error: unknown): boolean {
    if (!(error instanceof ApiError)) return false;
    if (!ApiFailureReading.of(error.status).silencesTheService) return false;
    if (error.status !== ServiceOutage.STATUS_SOBRECARREGADO) return true;
    return ServiceOutage.A_CASA_CAIU.has(error.code ?? "");
  }
}
