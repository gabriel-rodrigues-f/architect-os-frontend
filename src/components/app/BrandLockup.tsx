import { useEffect, useRef, useState, type CSSProperties, type RefObject } from "react";

import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { LetterCascade, LockupFit } from "@/lib/brand-lockup";
import {
  COLLECTIVE_PULSE_DURATION_MS,
  type PulseTone,
  type SynapseSignals,
} from "@/lib/synapse-network";

const WORDMARK = "Synapse";

/**
 * A MARCA DAS TELAS DE PORTA — "Synapse" e o descriptor como um lockup
 * (terceira avaliação de UX, 2026-09-07), e a marca piscando com a rede
 * (pedido do dono, mesmo dia).
 *
 * O lockup: as extremidades das duas linhas coincidem. O descriptor tem o seu
 * tracking; o wordmark recebe o tracking que o `LockupFit` calcula a partir
 * das larguras medidas na tela (`ResizeObserver`), refeito a cada largura —
 * nunca congelado, nunca `scaleX`. Sem medida (jsdom, fonte ainda por
 * carregar), vale o `clamp()` da folha de estilo.
 *
 * A piscada: cada linha é dividida em letras (`aria-hidden`; o texto inteiro
 * fica num `sr-only`), cada letra com atraso proporcional ao índice e a mesma
 * duração (`LetterCascade`) — as duas linhas começam e terminam juntas, cada
 * uma com o seu passo. Só o pulso COLETIVO da rede liga `data-pulsing`, pela
 * duração do pulso; com movimento reduzido a marca não se inscreve e fica
 * estática. Aba oculta: a rede pausa, logo nada chega aqui.
 *
 * A piscada ganha a cor do tom (dono, 2026-09-08): `data-pulse-tone` leva o
 * tom do pulso coletivo à folha de estilo — a recusa pisca no vermelho dos
 * campos, o sucesso no azul da casa.
 */
export function BrandLockup({
  signals,
  descriptor,
}: {
  signals?: SynapseSignals;
  descriptor: string;
}) {
  const wordmarkInk = useRef<HTMLSpanElement>(null);
  const descriptorInk = useRef<HTMLSpanElement>(null);
  const fit = useLockupFit(wordmarkInk, descriptorInk, WORDMARK.length);
  const pulse = useCollectivePulse(signals);

  return (
    <div
      data-testid="brand-lockup"
      data-pulsing={pulse.active ? "true" : undefined}
      data-pulse-tone={pulse.active ? pulse.tone : undefined}
      className="flex flex-col items-start"
    >
      <PulsingLine
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
        cascade={new LetterCascade(pulse.durationMs, WORDMARK.length)}
      />
      <PulsingLine
        text={descriptor}
        testId="brand-descriptor"
        className="auth-descriptor mt-2 uppercase"
        inkRef={descriptorInk}
        cascade={new LetterCascade(pulse.durationMs, descriptor.length)}
      />
    </div>
  );
}

/** Uma linha do lockup: o texto inteiro para o leitor de tela, as letras soltas para a piscada. */
function PulsingLine({
  text,
  testId,
  className,
  style,
  inkRef,
  cascade,
}: {
  text: string;
  testId: string;
  className: string;
  style?: CSSProperties | undefined;
  inkRef: RefObject<HTMLSpanElement | null>;
  cascade: LetterCascade;
}) {
  return (
    <p data-testid={testId} className={className} style={style}>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true" ref={inkRef} className="inline-block whitespace-nowrap">
        {[...text].map((letter, index) => (
          <span
            key={index}
            data-letter=""
            className="auth-letter"
            style={{
              animationDelay: `${cascade.delayOf(index)}ms`,
              animationDuration: `${cascade.letterMs}ms`,
            }}
          >
            {letter === " " ? " " : letter}
          </span>
        ))}
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

interface BrandPulse {
  active: boolean;
  durationMs: number;
  tone: PulseTone;
}

/** A inscrição no pulso coletivo: `active` pela duração do pulso, com o tom dele; nada com movimento reduzido. */
function useCollectivePulse(signals: SynapseSignals | undefined): BrandPulse {
  const reducedMotion = useReducedMotion();
  const [pulse, setPulse] = useState<BrandPulse>({
    active: false,
    durationMs: COLLECTIVE_PULSE_DURATION_MS,
    tone: "primary",
  });

  useEffect(() => {
    if (!signals || reducedMotion) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const unsubscribe = signals.onCollectivePulse(({ durationMs, tone }) => {
      if (timer) clearTimeout(timer);
      setPulse({ active: true, durationMs, tone });
      timer = setTimeout(() => {
        timer = null;
        setPulse((current) => ({ ...current, active: false }));
      }, durationMs);
    });
    return () => {
      unsubscribe();
      if (timer) clearTimeout(timer);
    };
  }, [signals, reducedMotion]);

  return pulse;
}
