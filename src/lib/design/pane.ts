import { ShellHeader } from "./shell";

/**
 * O RITMO de um bloco rolável: quanto ALTO é um item dele. Existe para que a
 * altura da caixa seja pedida em ITENS ("três itens", "duas linhas") e não em
 * pixels espalhados pelas telas — o número mora uma vez, no token da folha de
 * estilo, e a tela só diz quantos cabem.
 */
export class PaneRhythm {
  private constructor(
    readonly name: string,
    readonly token: string,
  ) {}

  /** Linha de tabela da casa: `py-2` sobre o corpo de texto padrão. */
  static readonly ROW = new PaneRhythm("row", "--pane-row-h");

  /** Item de lista em bloco — cartão empilhado, item de prioridade. */
  static readonly ITEM = new PaneRhythm("item", "--pane-item-h");

  static readonly ALL: readonly PaneRhythm[] = [PaneRhythm.ROW, PaneRhythm.ITEM];
}

/**
 * A ALTURA MÁXIMA de um bloco rolável, como expressão CSS. Duas medidas, e
 * nenhuma delas é um pixel solto:
 *
 * - {@link PaneHeight.restOfPage} — o que sobra da janela abaixo do cabeçalho
 *   do shell e da faixa de título/filtros da página. Lê o token
 *   `--shell-header-h` (nunca o número 74) e o token da faixa.
 * - {@link PaneHeight.items} — tantos itens quantos o dono pediu, no ritmo do
 *   conteúdo. `withColumnHeader` acrescenta a linha do cabeçalho de colunas,
 *   que fica presa e não conta como item lido.
 */
export abstract class PaneHeight {
  /** A variável que a caixa lê — o valor entra por `style`, não por classe montada. */
  static readonly TOKEN = "--pane-max-h";

  /** O token da faixa de título e filtros que fica ACIMA de um bloco de página. */
  static readonly PAGE_INSET_TOKEN = "--pane-page-inset-h";

  abstract get css(): string;

  static restOfPage(): PaneHeight {
    return new RestOfPagePaneHeight();
  }

  static items(count: number, rhythm: PaneRhythm = PaneRhythm.ROW): PaneHeight {
    return new ItemsPaneHeight(count, rhythm, false);
  }

  /** A mesma medida em itens, mais a linha presa do cabeçalho de colunas. */
  static rowsWithColumnHeader(count: number): PaneHeight {
    return new ItemsPaneHeight(count, PaneRhythm.ROW, true);
  }
}

class RestOfPagePaneHeight extends PaneHeight {
  get css(): string {
    return `calc(100dvh - var(${ShellHeader.TOKEN}) - var(${PaneHeight.PAGE_INSET_TOKEN}))`;
  }
}

class ItemsPaneHeight extends PaneHeight {
  constructor(
    private readonly count: number,
    private readonly rhythm: PaneRhythm,
    private readonly columnHeader: boolean,
  ) {
    super();
    if (!Number.isInteger(count) || count < 1) {
      throw new RangeError(`Altura em itens pede um inteiro positivo, recebeu ${String(count)}.`);
    }
  }

  get css(): string {
    const lines = this.count + (this.columnHeader ? 1 : 0);
    return `calc(${String(lines)} * var(${this.rhythm.token}))`;
  }
}

/**
 * As classes que montam a caixa de rolagem — o mesmo aprendizado da coluna de
 * apoio do PDI (`ShellHeader.sideRailClass`), agora generalizado para QUALQUER
 * bloco cujo título precisa continuar visível.
 *
 * Toda classe carrega o variante `xl:` COLADO no literal, por dois motivos:
 * em tela estreita a página já rola, e caixa que rola dentro de página que
 * rola é pior que o defeito original; e o Tailwind v4 só compila a classe que
 * enxerga inteira no fonte — `xl:` montado por template morre.
 */
export class ScrollPaneStyle {
  /** A caixa: teto pela variável (o valor vem por `style`) e rolagem vertical. */
  static readonly boxClass = "xl:max-h-(--pane-max-h) xl:overflow-y-auto";

  /** Alcance por teclado e a barra da casa — valem em qualquer largura. */
  static readonly reachClass = "scroll-visible rounded-lg focus-visible:focus-ring";

  /**
   * Tabela larga: o MESMO elemento rola nos dois eixos. Separar em duas caixas
   * quebraria o cabeçalho preso — ele gruda no topo de quem rola, e quem rola
   * na vertical tem de ser o mesmo que rola na horizontal.
   */
  static readonly horizontalClass = "scroll-visible overflow-x-auto";

  /**
   * Onde há tabela, o cabeçalho de coluna fica preso no topo da caixa: sem
   * isso a pessoa perde a legenda das colunas no meio da lista. O fundo é o do
   * cartão porque o cabeçalho passa POR CIMA das linhas que rolam.
   */
  static readonly pinnedColumnHeaderClass =
    "xl:[&_thead_th]:sticky xl:[&_thead_th]:top-0 xl:[&_thead_th]:z-10 xl:[&_thead_th]:bg-card";
}
