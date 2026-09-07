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
}
