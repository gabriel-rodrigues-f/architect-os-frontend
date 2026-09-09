import { ApiError } from "./api-errors";

/**
 * O NÚMERO DA RECUSA — regra 18 do dono (2026-09-09).
 *
 * *"Sugiro adotarmos 404 para os casos do 403. Semanticamente, se eu não posso
 * acessar, aquela rota não existe pra mim."* A verificação
 * (`direcao/o-403-vira-404-2026-09-09.md`) mediu 67 recusas, separou-as em
 * duas famílias, e o dono decidiu as duas:
 *
 *  - **ALCANCE** — "esta pessoa, este plano, esta trilha não é sua". Responde
 *    **404**, e o corpo é IDÊNTICO ao de recurso inexistente: mesmo código,
 *    mesma frase, mesmo tamanho. É o que fecha o oráculo — comparar as duas
 *    respostas deixa de contar quem existe. Um 404 que viajasse com a frase
 *    de alcance seria pior que o 403 de hoje, e foi por isso que o próprio
 *    dono reverteu esta troca em 2026-08-28.
 *  - **ATO** — "você vê isto, mas quem reabre o PDI é quem lidera". Continua
 *    **403**, com a frase, porque a frase é a única coisa que diz à pessoa o
 *    que fazer; responder "não existe" faria a tela negar o que está
 *    desenhado na frente dela.
 *
 * Esta classe existe para segurar três coisas que a troca solta:
 *
 *  1. **O número deixa de ser literal solto.** Ele era um `403` cru em quatro
 *     lugares e um `404` cru em outros quatro; com o número disperso, mudar a
 *     régua era achar as oito linhas de novo. Agora a família tem nome, e
 *     `tests/architecture/o-numero-da-recusa.test.ts` proíbe o literal.
 *  2. **Ninguém separa as famílias pelo `code`.** Se o código separasse
 *     alcance de inexistente, ele viraria o oráculo que o número deixou de
 *     ser, e a regra voltaria ao começo. Quem casa status com código por aqui
 *     casa com a MARCA de um mecanismo da própria sessão de quem pergunta —
 *     senha pendente, passe de suporte vencido —, nunca com a família.
 *  3. **Ler 404 não autoriza concluir ausência.** Depois da regra 18 o 404
 *     diz duas coisas ao mesmo tempo, de propósito. Quem o engolir como
 *     "ainda não existe" faz a recusa sumir sem nada na tela. Só as duas
 *     rotas que o dono deixou FORA do lote podem lê-lo assim, e por isso
 *     `answersAbsenceOn` pede o nome da rota: quem chama assina a exceção.
 */
export type NamedAbsenceRoute = "quadro-do-time" | "regua-do-nivel";

export class RefusalNumber {
  /** Recusa de ATO sobre coisa que a pessoa vê — a frase do serviço é contrato. */
  static readonly ACT = 403;

  /** Recusa de ALCANCE — e de recurso inexistente. O mesmo número, de propósito. */
  static readonly OUT_OF_REACH = 404;

  /**
   * As duas rotas que o dono tirou do lote (regra 18, execução, item 4),
   * porque nelas o 404 já tem significado de negócio próprio. Enquanto
   * estiverem aqui, a recusa delas continua chegando como ATO (403) e o 404
   * continua querendo dizer só uma coisa.
   */
  private static readonly ABSENCE_MEANING: Readonly<Record<NamedAbsenceRoute, string>> = {
    "quadro-do-time":
      "GET /teams/:teamId/memberships — o 404 já quer dizer 'leitura do quadro indisponível'",
    "regua-do-nivel":
      "GET /teams/:teamId/rules/:careerLevelId — o 404 já quer dizer 'régua deste nível ainda não definida'",
  };

  static isAct(failure: unknown): boolean {
    return failure instanceof ApiError && failure.status === RefusalNumber.ACT;
  }

  static isOutOfReach(failure: unknown): boolean {
    return failure instanceof ApiError && failure.status === RefusalNumber.OUT_OF_REACH;
  }

  /**
   * A leitura de AUSÊNCIA, assinada pela rota que a promete. Fora das duas
   * exceções nomeadas não existe leitura de ausência: o 404 é recusa, e
   * recusa sobe.
   */
  static answersAbsenceOn(route: NamedAbsenceRoute, failure: unknown): boolean {
    return route in RefusalNumber.ABSENCE_MEANING && RefusalNumber.isOutOfReach(failure);
  }

  /** Por que aquela rota pode ler o 404 como ausência — o texto da exceção. */
  static absenceMeaningOf(route: NamedAbsenceRoute): string {
    return RefusalNumber.ABSENCE_MEANING[route];
  }

  /** As rotas que assinaram a exceção, em ordem — a lista que a catraca confere. */
  static get namedAbsenceRoutes(): NamedAbsenceRoute[] {
    return Object.keys(RefusalNumber.ABSENCE_MEANING).sort() as NamedAbsenceRoute[];
  }
}
