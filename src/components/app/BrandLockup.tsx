import { useEffect, useState, useRef, type CSSProperties, type RefObject } from "react";

import { LockupFit } from "@/lib/brand-lockup";

const WORDMARK = "Synapse";

/**
 * A MARCA DAS TELAS DE PORTA — "Synapse" e o descriptor como um lockup
 * (terceira avaliação de UX, 2026-09-07): as extremidades das duas linhas
 * coincidem. O descriptor tem o seu tracking; o wordmark recebe o tracking
 * que o `LockupFit` calcula a partir das larguras medidas na tela
 * (`ResizeObserver`), refeito a cada largura — nunca congelado, nunca
 * `scaleX`. Sem medida (jsdom, fonte ainda por carregar), vale o `clamp()`
 * da folha de estilo.
 *
 * A MARCA NÃO PISCA (dono, 2026-09-08: "na tela de login, vamos remover a
 * animação das letras; mantenha apenas na rede de sinapses"). Por isso ela
 * não assina o pulso coletivo da rede e não recebe `SynapseSignals`: cada
 * linha é UM texto, sem caixa por letra, sem `data-pulsing` e sem tom. Quem
 * pulsa com a cor do resultado é a rede, atrás dela.
 */
export function BrandLockup({ descriptor }: { descriptor: string }) {
  const wordmarkInk = useRef<HTMLSpanElement>(null);
  const descriptorInk = useRef<HTMLSpanElement>(null);
  const fit = useLockupFit(wordmarkInk, descriptorInk, WORDMARK.length);

  return (
    <div data-testid="brand-lockup" className="flex flex-col items-start">
      <LockupLine
        text={WORDMARK}
        testId="brand-wordmark"
        className="auth-wordmark font-display font-semibold uppercase text-foreground"
        style={
          fit
            ? ({
                "--lockup-tracking": fit.style.letterSpacing,
                marginInlineEnd: fit.style.marginInlineEnd,
              } as CSSProperties)
            : undefined
        }
        inkRef={wordmarkInk}
      />
      <LockupLine
        text={descriptor}
        testId="brand-descriptor"
        className="auth-descriptor mt-2 uppercase"
        inkRef={descriptorInk}
      />
    </div>
  );
}

/** Uma linha do lockup: o texto inteiro, numa caixa que a régua consegue medir. */
function LockupLine({
  text,
  testId,
  className,
  style,
  inkRef,
}: {
  text: string;
  testId: string;
  className: string;
  style?: CSSProperties | undefined;
  inkRef: RefObject<HTMLSpanElement | null>;
}) {
  return (
    <p data-testid={testId} className={className} style={style}>
      <span ref={inkRef} className="inline-block whitespace-nowrap">
        {text}
      </span>
    </p>
  );
}

/** Mede as duas linhas e devolve o ajuste; `null` enquanto não há medida (ou não há `ResizeObserver`). */
function useLockupFit(
  wordmark: RefObject<HTMLSpanElement | null>,
  descriptor: RefObject<HTMLSpanElement | null>,
  glyphs: number,
): LockupFit | null {
  const [fit, setFit] = useState<LockupFit | null>(null);

  useEffect(() => {
    const wordmarkInk = wordmark.current;
    const descriptorInk = descriptor.current;
    if (!wordmarkInk || !descriptorInk || typeof ResizeObserver === "undefined") return;
    const gauge = new LockupGauge(wordmarkInk, descriptorInk, glyphs, (next) =>
      setFit((current) => (current && !next.differsFrom(current) ? current : next)),
    );
    gauge.start();
    return () => gauge.stop();
  }, [wordmark, descriptor, glyphs]);

  return fit;
}

/** A régua: observa as duas linhas e, a cada mudança de largura, refaz o ajuste. */
class LockupGauge {
  private readonly observer: ResizeObserver;

  constructor(
    private readonly wordmark: HTMLElement,
    private readonly descriptor: HTMLElement,
    private readonly glyphs: number,
    private readonly onFit: (fit: LockupFit) => void,
  ) {
    this.observer = new ResizeObserver(() => this.measure());
  }

  start(): void {
    this.observer.observe(this.wordmark);
    this.observer.observe(this.descriptor);
    this.measure();
    document.fonts?.ready.then(() => this.measure()).catch(() => undefined);
  }

  stop(): void {
    this.observer.disconnect();
  }

  private measure(): void {
    const wordmarkWidth = this.wordmark.getBoundingClientRect().width;
    const descriptorWidth = this.descriptor.getBoundingClientRect().width;
    if (wordmarkWidth <= 0 || descriptorWidth <= 0) return;
    const wordmarkTracking = Number.parseFloat(getComputedStyle(this.wordmark).letterSpacing) || 0;
    this.onFit(
      LockupFit.for({ wordmarkWidth, wordmarkTracking, glyphs: this.glyphs, descriptorWidth }),
    );
  }
}
