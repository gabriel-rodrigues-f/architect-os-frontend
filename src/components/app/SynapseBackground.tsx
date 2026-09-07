import { useEffect, useRef, useState, type RefObject } from "react";

import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { LiveCanvasLoop, ThemeTokens } from "@/lib/live-canvas";
import {
  CompositionZone,
  NetworkComposition,
  SynapseNetwork,
  SynapseSignals,
  type Point,
  type SynapseNetworkSnapshot,
} from "@/lib/synapse-network";

const MAX_DEVICE_PIXEL_RATIO = 2;
const PLANE_ALPHA = [0.35, 0.55, 0.85] as const;
const LINK_ALPHA = [0.14, 0.22, 0.32] as const;

/** O pincel: lê as cores dos tokens e desenha um quadro da rede. */
class SynapsePainter {
  private constructor(
    private readonly context: CanvasRenderingContext2D,
    private readonly accent: string,
    private readonly front: string,
    private readonly back: string,
  ) {}

  static for(canvas: HTMLCanvasElement): SynapsePainter | null {
    const context = canvas.getContext("2d");
    if (!context) return null;
    const tokens = ThemeTokens.of(canvas);
    return new SynapsePainter(
      context,
      tokens.read("--primary", "#7cb8ff"),
      tokens.read("--foreground", "#e5e7eb"),
      tokens.read("--muted-foreground", "#9ca3af"),
    );
  }

  draw(snapshot: SynapseNetworkSnapshot, width: number, height: number, scale: number): void {
    const { context } = this;
    context.setTransform(scale, 0, 0, scale, 0, 0);
    context.clearRect(0, 0, width, height);
    context.lineWidth = 1;
    for (const link of snapshot.links) {
      const from = snapshot.nodes[link.from]!;
      const to = snapshot.nodes[link.to]!;
      const plane = Math.min(from.plane, to.plane) as 0 | 1 | 2;
      const glow = Math.max(from.glow, to.glow);
      context.globalAlpha = LINK_ALPHA[plane] * link.strength + glow * 0.35;
      context.strokeStyle = this.accent;
      context.beginPath();
      context.moveTo(from.x, from.y);
      context.lineTo(to.x, to.y);
      context.stroke();
    }
    for (const node of snapshot.nodes) {
      const radius = node.size * (1 + node.glow * 0.8);
      if (node.glow > 0.05) {
        context.globalAlpha = node.glow * 0.25;
        context.fillStyle = this.accent;
        context.beginPath();
        context.arc(node.x, node.y, radius * 3.2, 0, Math.PI * 2);
        context.fill();
      }
      context.globalAlpha = Math.min(1, PLANE_ALPHA[node.plane] + node.glow * 0.4);
      context.fillStyle = node.plane === 0 ? this.back : node.glow > 0.3 ? this.accent : this.front;
      context.beginPath();
      context.arc(node.x, node.y, radius, 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;
  }
}

/** O palco: rede, ponteiro, sinais da tela e relógio, amarrados a um canvas. */
class SynapseStage {
  private network: SynapseNetwork;
  private painter: SynapsePainter | null = null;
  private pointer: Point | null = null;
  private width = 0;
  private height = 0;
  private scale = 1;
  private emphasized = false;
  private readonly loop = new LiveCanvasLoop((delta) => this.frame(delta));

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly signals: SynapseSignals,
    private readonly focal: RefObject<HTMLElement | null>,
    private readonly brand: RefObject<HTMLElement | null>,
  ) {
    this.network = new SynapseNetwork(1, 1, new NetworkComposition(0, "mobile"));
    this.fit();
  }

  /**
   * Mede o canvas de novo, com o DPR limitado a 2, e recompõe a rede para a
   * largura nova — com a zona de composição (marca e cartão) medida na mesma
   * passada, para a rede costurar os lados. Sem medida (jsdom, ou um bloco
   * ainda sem tamanho), a rede nasce sem zona, como antes.
   */
  fit(): void {
    const rect = this.canvas.getBoundingClientRect();
    this.width = Math.max(1, Math.round(rect.width || window.innerWidth));
    this.height = Math.max(1, Math.round(rect.height || window.innerHeight));
    this.scale = Math.min(window.devicePixelRatio || 1, MAX_DEVICE_PIXEL_RATIO);
    this.canvas.width = Math.round(this.width * this.scale);
    this.canvas.height = Math.round(this.height * this.scale);
    const zone = this.composition(rect);
    this.network = new SynapseNetwork(
      this.width,
      this.height,
      NetworkComposition.for(this.width, zone),
    );
    this.painter = SynapsePainter.for(this.canvas);
  }

  private composition(canvas: DOMRect): CompositionZone | null {
    const brand = this.brand.current?.getBoundingClientRect();
    const card = this.focal.current?.getBoundingClientRect();
    if (!brand || !card) return null;
    return CompositionZone.measured(canvas, brand, card);
  }

  /** Um quadro só, parado — o que `prefers-reduced-motion` recebe. */
  still(): void {
    this.network.tick(16, null);
    this.paint();
  }

  start(): void {
    this.loop.start();
  }

  stop(): void {
    this.loop.stop();
  }

  point(at: Point | null): void {
    this.pointer = at;
  }

  private frame(delta: number): void {
    this.readSignals();
    this.network.tick(delta, this.pointer);
    this.paint();
  }

  private readSignals(): void {
    const zone = this.focal.current?.getBoundingClientRect() ?? null;
    if (this.signals.isEmphasized !== this.emphasized) {
      this.emphasized = this.signals.isEmphasized;
      this.network.emphasize(this.emphasized && zone ? zone : null);
    }
    const pulses = this.signals.drainPulses();
    if (pulses === 0) return;
    const origin = zone
      ? { x: zone.x + zone.width / 2, y: zone.y + zone.height / 2 }
      : (this.pointer ?? undefined);
    this.network.pulse(origin);
  }

  private paint(): void {
    this.painter?.draw(this.network.snapshot, this.width, this.height, this.scale);
  }
}

/**
 * A rede de sinapses atrás do login. O motor é o `SynapseNetwork`; este
 * componente só liga o canvas (DPR ≤ 2, resize), a zona de composição (marca
 * e cartão, medidos a cada ajuste), o ponteiro (mouse e toque
 * leve), os sinais da tela e o relógio — que pausa com a aba escondida e é
 * cancelado no unmount. Com `prefers-reduced-motion`, desenha um quadro
 * parado e não anima.
 */
export function SynapseBackground({
  signals,
  focalRef,
  brandRef,
}: {
  signals: SynapseSignals;
  /** O cartão: zona de ênfase, origem do pulso e um dos dois blocos da composição. */
  focalRef: RefObject<HTMLElement | null>;
  /** A marca: o outro bloco da composição — a rede se adensa entre os dois. */
  brandRef?: RefObject<HTMLElement | null>;
}) {
  const reducedMotion = useReducedMotion();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [motion, setMotion] = useState<"live" | "still">(reducedMotion ? "still" : "live");

  useEffect(() => {
    setMotion(reducedMotion ? "still" : "live");
    const canvas = canvasRef.current;
    if (!canvas) return;
    const stage = new SynapseStage(canvas, signals, focalRef, brandRef ?? { current: null });
    if (reducedMotion) {
      stage.still();
      const onResizeStill = () => {
        stage.fit();
        stage.still();
      };
      window.addEventListener("resize", onResizeStill);
      return () => window.removeEventListener("resize", onResizeStill);
    }
    const onResize = () => stage.fit();
    const onMove = (event: PointerEvent) => stage.point({ x: event.clientX, y: event.clientY });
    const onLeave = () => stage.point(null);
    window.addEventListener("resize", onResize);
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onMove, { passive: true });
    window.addEventListener("pointerup", onLeave);
    window.addEventListener("pointercancel", onLeave);
    document.addEventListener("pointerleave", onLeave);
    stage.start();
    return () => {
      stage.stop();
      window.removeEventListener("resize", onResize);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onMove);
      window.removeEventListener("pointerup", onLeave);
      window.removeEventListener("pointercancel", onLeave);
      document.removeEventListener("pointerleave", onLeave);
    };
  }, [reducedMotion, signals, focalRef, brandRef]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      data-testid="synapse-network"
      data-motion={motion}
      className="pointer-events-none absolute inset-0 h-full w-full motion-safe:animate-[auth-fade_var(--motion-slow)_ease-out_both]"
    />
  );
}
