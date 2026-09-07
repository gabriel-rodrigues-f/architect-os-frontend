/**
 * O LOCKUP DA MARCA — "Synapse" e o descriptor como uma unidade (terceira
 * avaliação de UX, 2026-09-07): as extremidades esquerda e direita das duas
 * linhas coincidem opticamente. Sem `scaleX`, sem espaços manuais — o
 * wordmark ganha o `letter-spacing` que o descriptor pede, medido no cliente
 * e recalculado a cada largura. Aqui mora a conta, sem DOM, para o teste
 * provar com medidas simuladas; quem mede e aplica é o `BrandLockup`.
 *
 * `LetterCascade` é o ritmo da piscada (dono, 2026-09-07): cada letra atrasa
 * proporcionalmente ao índice, com a MESMA duração por letra, de modo que as
 * duas linhas — 7 e 30 letras — comecem e terminem no mesmo instante, cada
 * uma com o seu passo.
 */
export interface LockupMeasure {
  /** A caixa do wordmark como está na tela — inclui o tracking depois de CADA glifo, o último também. */
  readonly wordmarkWidth: number;
  /** O tracking em vigor quando a caixa foi medida, em px. */
  readonly wordmarkTracking: number;
  readonly glyphs: number;
  readonly descriptorWidth: number;
}

export interface LockupStyle {
  readonly letterSpacing: string;
  /** Compensa o tracking que sobra depois da última letra: a caixa termina onde a tinta termina. */
  readonly marginInlineEnd: string;
}

export class LockupFit {
  /** As extremidades "coincidem" quando diferem por até isto. */
  static readonly TOLERANCE_PX = 3;
  /** Diferenças menores não valem uma nova pintura. */
  private static readonly SETTLE_PX = 0.25;

  constructor(readonly trackingPx: number) {}

  static readonly none = new LockupFit(0);

  static for(measure: LockupMeasure): LockupFit {
    if (measure.glyphs < 2) return LockupFit.none;
    const natural = measure.wordmarkWidth - measure.glyphs * measure.wordmarkTracking;
    const tracking = (measure.descriptorWidth - natural) / (measure.glyphs - 1);
    return new LockupFit(Math.max(0, tracking));
  }

  /** Da borda esquerda da primeira letra à borda direita da última, com este tracking. */
  inkWidth(naturalWidth: number, glyphs: number): number {
    return naturalWidth + Math.max(0, glyphs - 1) * this.trackingPx;
  }

  differsFrom(other: LockupFit): boolean {
    return Math.abs(this.trackingPx - other.trackingPx) > LockupFit.SETTLE_PX;
  }

  get style(): LockupStyle {
    return {
      letterSpacing: `${this.trackingPx}px`,
      marginInlineEnd: `${-this.trackingPx}px`,
    };
  }
}

export class LetterCascade {
  /** A piscada de UMA letra dura esta fração do pulso. */
  static readonly LETTER_SHARE = 0.35;

  constructor(
    readonly pulseMs: number,
    readonly letters: number,
  ) {}

  get letterMs(): number {
    return this.pulseMs * LetterCascade.LETTER_SHARE;
  }

  /** `índice / (n − 1) × (D − d)`: a última letra termina exatamente em D. */
  delayOf(index: number): number {
    if (this.letters <= 1) return 0;
    return (index / (this.letters - 1)) * (this.pulseMs - this.letterMs);
  }
}
