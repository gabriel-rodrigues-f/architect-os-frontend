import type { Notice } from "../gateways/notices.gateway";

/**
 * A CAIXA DE AVISOS, do lado de quem lê.
 *
 * O agrupamento por dia MORREU nesta fatia (dono, 2026-09-08): a data saiu do
 * cabeçalho de grupo e entrou na linha, ao lado do título. Sobrou o que a
 * tela realmente pergunta — a ordem, o não-lido e, agora que o sino pagina,
 * o cursor da próxima página e a junção do que já chegou.
 */
export class NoticesViewModel {
  /** Do mais recente para o mais antigo — a única ordem da caixa. */
  newestFirst(notices: readonly Notice[]): Notice[] {
    return [...notices].sort((left, right) => right.occurredAt.localeCompare(left.occurredAt));
  }

  isUnread(notice: Pick<Notice, "readAt">): boolean {
    return notice.readAt === null;
  }

  /**
   * O cursor `before` da PRÓXIMA página: o instante do aviso mais antigo que
   * já chegou. Página que veio incompleta é o fim da caixa — pedir de novo
   * só devolveria vazio, e o botão "Ver mais" não deve nem aparecer.
   */
  cursorAfter(page: readonly Notice[], requestedLimit: number): string | undefined {
    if (page.length < requestedLimit) return undefined;
    return this.newestFirst(page).at(-1)?.occurredAt;
  }

  /**
   * As páginas já recebidas, numa lista só e sem repetir aviso nenhum: o
   * cursor é por instante, e dois avisos do mesmo instante fariam a página
   * seguinte devolver de novo o que já está na tela.
   */
  merge(pages: readonly (readonly Notice[])[]): Notice[] {
    const seen = new Set<string>();
    const merged: Notice[] = [];
    for (const notice of this.newestFirst(pages.flat())) {
      if (seen.has(notice.id)) continue;
      seen.add(notice.id);
      merged.push(notice);
    }
    return merged;
  }
}
