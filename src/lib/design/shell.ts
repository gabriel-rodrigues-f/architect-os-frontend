/**
 * A altura do cabeçalho do shell vivia em três literais (classe arbitrária
 * de altura, classe arbitrária de `top`, constante em pixel) — [N-02]. Agora é UM token,
 * `--shell-header-h`, declarado em `styles.css` a partir daqui, e as classes
 * que dependem dele leem a variável em vez do número. Quem precisa do número
 * (um cálculo em JS) lê `ShellHeader.HEIGHT_PX`; quem precisa de classe lê as
 * classes daqui — o Tailwind só compila o que enxerga literal no fonte.
 */
export class ShellHeader {
  static readonly TOKEN = "--shell-header-h";
  static readonly HEIGHT_PX = 74;

  static get cssLine(): string {
    return `  ${ShellHeader.TOKEN}: ${String(ShellHeader.HEIGHT_PX)}px;`;
  }

  /** O bloco da marca na coluna tem a altura do cabeçalho. */
  static readonly heightClass = "h-(--shell-header-h)";

  /** Um bloco fixo se prende logo ABAIXO do cabeçalho. */
  static readonly stickyBelowClass = "top-(--shell-header-h)";

  /** A área de conteúdo ocupa no mínimo o viewport útil abaixo do cabeçalho. */
  static readonly minContentHeightClass = "min-h-[calc(100dvh-var(--shell-header-h))]";

  /**
   * Uma COLUNA DE APOIO ao lado do conteúdo (dono, 2026-09-09: *"a tela não
   * pode rolar para baixo por conta do grupo Maiores Distâncias"*). Em tela
   * larga ela se solta do esticamento da célula da grade (`self-start` — sem
   * isso a célula já nasce com a altura da linha e o `sticky` não tem para
   * onde correr), gruda abaixo do cabeçalho e rola DENTRO DE SI, no máximo o
   * viewport útil. Em tela estreita as colunas empilham e nada disto vale:
   * caixa de rolagem dentro de página que já rola é pior que o defeito. Por
   * isso o variante `xl:` vem COLADO em cada classe — o Tailwind v4 só
   * compila o que enxerga literal, e `xl:` montado por template morre.
   */
  static readonly sideRailClass =
    "xl:sticky xl:self-start xl:top-(--shell-header-h) xl:max-h-[calc(100dvh-var(--shell-header-h))] xl:overflow-y-auto";
}
