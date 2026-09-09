import type { MessageKey } from "./i18n";
import { NameFormatter, defaultNameFormatter } from "./text";

/**
 * QUEM ASSINOU o comentário da Avaliação — a frase que vai no alto do cartão.
 *
 * Ordem do dono (2026-09-09): *"a pessoa que assina deve ser reconhecida pelo
 * seu nome + sobrenome, com base na PK do usuário, não pelo seu cargo atual,
 * até porque cargo pode mudar."*
 *
 * O que existia era um `Record` de CARGO em rótulo — "Profissional", "Tech
 * Lead", "Administrador". Ele dizia a mesma palavra para duas pessoas do
 * mesmo cargo (a lista não respondia QUEM falou), e mudava de sentido quando
 * alguém era promovido: o comentário do ano passado passava a ser assinado
 * pelo cargo de hoje. O nome vem resolvido do servidor, pela PK da conta; aqui
 * só se decide a FORMA.
 *
 * Três casos, e nenhum deles é cargo:
 *
 *   - **"Você"** — o comentário de quem está lendo. Não é rótulo de papel: é o
 *     atalho que deixa a pessoa varrer a lista e achar a própria fala sem ler
 *     nome nenhum. Era o padrão da tela antes, e fica.
 *   - **nome + sobrenome** — a régua é do `NameFormatter`, a mesma casa que
 *     ordena e normaliza nome em todo o resto da aplicação.
 *   - **"alguém"** — a ausência. Comentário histórico nasceu sem autor, e o
 *     ESQUECIMENTO anula a conta de quem escreveu. A frase é emprestada da
 *     caixa de avisos, que já resolvia exatamente esta situação ("a pessoa
 *     pode ter sido esquecida... e a frase continua fazendo sentido com
 *     'alguém'"). Uma frase da casa, e não uma segunda invenção para o mesmo
 *     buraco.
 */
export type SignatureTranslate = (
  key: MessageKey,
  params?: Record<string, string | number>,
) => string;

export interface SignedComment {
  authorName: string | null;
}

export class CommentSignature {
  private static readonly YOU: MessageKey = "comment.you";

  private static readonly SOMEONE: MessageKey = "notices.phrase.someone";

  constructor(private readonly names: NameFormatter) {}

  /** `mine` é a resposta da tela a "este comentário é de quem está lendo?". */
  of(comment: SignedComment, mine: boolean, t: SignatureTranslate): string {
    if (mine) return t(CommentSignature.YOU);
    if (comment.authorName === null) return t(CommentSignature.SOMEONE);
    return this.names.firstAndLast(comment.authorName);
  }
}

export const defaultCommentSignature = new CommentSignature(defaultNameFormatter);
