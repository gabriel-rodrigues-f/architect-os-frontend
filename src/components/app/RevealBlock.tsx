import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from "react";

import { useReducedMotion } from "@/hooks";
import { cn } from "@/lib/utils";

/**
 * Entrada orquestrada leve (referência FIAP 2026-09-06, §2 itens 4 e 8): na
 * primeira abertura do Painel depois do login, cada bloco entra com fade e
 * 8 px quando aparece na tela — `IntersectionObserver` decide o momento, o
 * CSS faz o movimento (`[data-reveal]` em `styles.css`), uma vez só.
 *
 * Fora da entrada (`RevealSequence enabled={false}`, o padrão) e com
 * `prefers-reduced-motion`, o bloco nasce pronto: sem atributo, sem
 * observador, sem animação. Sem `IntersectionObserver` no ambiente, revela
 * na hora — um bloco nunca fica invisível por falta de quem o observe.
 */
const RevealSequenceContext = createContext(false);

export function RevealSequence({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  return (
    <RevealSequenceContext.Provider value={enabled}>{children}</RevealSequenceContext.Provider>
  );
}

/** Escalonamento por ordem: 50 ms por bloco, no máximo quatro degraus — a entrada toda fica abaixo de 500 ms. */
const STAGGER_MS = 50;
const MAX_STAGGER_STEPS = 4;

type RevealState = "pending" | "shown";

function useRevealOnEnter(enabled: boolean): {
  ref: RefObject<HTMLDivElement | null>;
  state: RevealState | undefined;
} {
  const reducedMotion = useReducedMotion();
  const active = enabled && !reducedMotion;
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (!active) return;
    const element = ref.current;
    if (!element || typeof IntersectionObserver === "undefined") {
      setShown(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        setShown(true);
        observer.disconnect();
      },
      { threshold: 0.1 },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [active]);

  return { ref, state: active ? (shown ? "shown" : "pending") : undefined };
}

export function RevealBlock({
  order = 0,
  className,
  children,
}: {
  order?: number;
  className?: string;
  children: ReactNode;
}) {
  const enabled = useContext(RevealSequenceContext);
  const { ref, state } = useRevealOnEnter(enabled);
  const delay = `${Math.min(order, MAX_STAGGER_STEPS) * STAGGER_MS}ms`;

  return (
    <div
      ref={ref}
      data-reveal-block
      data-reveal={state}
      className={cn("min-w-0", className)}
      style={state ? ({ "--reveal-delay": delay } as CSSProperties) : undefined}
    >
      {children}
    </div>
  );
}
