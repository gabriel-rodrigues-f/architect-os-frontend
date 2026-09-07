/**
 * O formato do número-síntese (referência FIAP 2026-09-06, §2 item 2): um
 * inteiro com o separador de milhar do idioma, um percentual sem casas ou um
 * decimal com uma casa. Quem escolhe o formato é a tela, que sabe o que o
 * número significa; quem escreve o número é este objeto, sempre igual.
 */
export type KeyFigureFormat = "integer" | "decimal" | "percent";

export class KeyFigureFormatter {
  constructor(private readonly locale: string) {}

  format(value: number, format: KeyFigureFormat): string {
    return new Intl.NumberFormat(this.locale, KeyFigureFormatter.OPTIONS[format]).format(value);
  }

  /** Razão segura para o percentual: 0 de 0 é zero, não NaN. */
  static ratio(part: number, whole: number): number {
    return whole > 0 ? part / whole : 0;
  }

  private static readonly OPTIONS: Record<KeyFigureFormat, Intl.NumberFormatOptions> = {
    integer: { maximumFractionDigits: 0 },
    decimal: { minimumFractionDigits: 1, maximumFractionDigits: 1 },
    percent: { style: "percent", maximumFractionDigits: 0 },
  };
}
