import { useEffect, useRef, useState, type RefObject } from "react";

import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { LiveCanvasLoop, ThemeTokens } from "@/lib/live-canvas";
import {
  CompositionZone,
  NetworkComposition,
  SynapseNetwork,
  SynapseSignals,
  type Point,
  type PulseTone,
  type SynapseNetworkSnapshot,
  type Zone,
} from "@/lib/synapse-network";

const MAX_DEVICE_PIXEL_RATIO = 2;
const PLANE_ALPHA = [0.35, 0.55, 0.85] as const;
const LINK_ALPHA = [0.14, 0.22, 0.32] as const;
/** O interior é denso de conteúdo: planos e arestas a menos da metade da força do login. */
const INTERIOR_INTENSITY = 0.45;

type SceneKind = "door" | "interior";

/**
 * A CENA — o que o palco precisa saber do lugar onde a rede vive, sem
 * conhecer a tela: como compor a rede para o canvas medido, o que enfatizar,
 * de onde nasce o pulso pedido pela tela e com que força pintar.
 *
 * Duas cenas (dono, 2026-09-08: "o mesmo efeito da tela de login, quero no
 * fundo da aplicação como um todo"): a PORTA, com marca e cartão; o
 * INTERIOR, contido, com o conteúdo como zona de exclusão.
 */
interface SynapseScene {
  readonly kind: SceneKind;
  /** Multiplicador de opacidade de planos e arestas. */
  readonly intensity: number;
  composition(canvas: DOMRect, width: number, height: number): NetworkComposition;
  /** A zona que ganha intensidade quando a tela pede ênfase; `null` se a cena não tem uma. */
  emphasisZone(): Zone | null;
  /** De onde parte o pulso pedido pela tela; `undefined` deixa o motor escolher o centro. */
  pulseOrigin(pointer: Point | null): Point | undefined;
}

/** A porta: a rede costura marca e cartão; o cartão é a ênfase e a origem do pulso. */
class DoorScene implements SynapseScene {
  readonly kind = "door";
  readonly intensity = 1;

  constructor(
    private readonly focal: RefObject<HTMLElement | null>,
    private readonly brand: RefObject<HTMLElement | null>,
  ) {}

  composition(canvas: DOMRect, width: number): NetworkComposition {
    const brand = this.brand.current?.getBoundingClientRect();
    const card = this.focal.current?.getBoundingClientRect();
    const zone = brand && card ? CompositionZone.measured(canvas, brand, card) : null;
    return NetworkComposition.for(width, zone);
  }

  emphasisZone(): Zone | null {
    return this.focal.current?.getBoundingClientRect() ?? null;
  }

  pulseOrigin(pointer: Point | null): Point | undefined {
    const zone = this.emphasisZone();
    if (zone) return { x: zone.x + zone.width / 2, y: zone.y + zone.height / 2 };
    return pointer ?? undefined;
  }
}

/**
 * O interior: a rede nas margens — cabeçalho, bordas, o vão da coluna — e
 * nunca atrás do conteúdo (`<main>`), que é a zona de exclusão até o pé do
 * canvas. Não há ênfase; o pulso nasce onde está o ponteiro, ou no centro.
 */
class InteriorScene implements SynapseScene {
  readonly kind = "interior";
  readonly intensity = INTERIOR_INTENSITY;

  constructor(private readonly content: RefObject<HTMLElement | null>) {}

  composition(canvas: DOMRect, width: number, height: number): NetworkComposition {
    const content = this.content.current?.getBoundingClientRect();
    const zone = content
      ? CompositionZone.aroundContent(canvas, {
          x: content.x,
          y: content.y,
          width: content.width,
          height: Math.max(content.height, canvas.y + height - content.y),
        })
      : null;
    return NetworkComposition.interior(width, zone);
  }

  emphasisZone(): Zone | null {
    return null;
  }

  pulseOrigin(pointer: Point | null): Point | undefined {
    return pointer ?? undefined;
  }
}

/** O pincel: lê as cores dos tokens e desenha um quadro da rede. */
class SynapsePainter {
  private constructor(
    private readonly context: CanvasRenderingContext2D,
    private readonly ink: Readonly<Record<PulseTone, string>>,
    private readonly front: string,
    private readonly back: string,
    private readonly intensity: number,
  ) {}

  static for(canvas: HTMLCanvasElement, intensity: number): SynapsePainter | null {
    const context = canvas.getContext("2d");
    if (!context) return null;
    const tokens = ThemeTokens.of(canvas);
    const primary = tokens.read("--primary", "#7cb8ff");
    return new SynapsePainter(
      context,
      // O vermelho da recusa é o MESMO token do contorno dos campos (`aria-invalid`); sem ele, o azul.
      { primary, danger: tokens.read("--destructive", primary) },
      tokens.read("--foreground", "#e5e7eb"),
      tokens.read("--muted-foreground", "#9ca3af"),
      intensity,
    );
  }

  draw(snapshot: SynapseNetworkSnapshot, width: number, height: number, scale: number): void {
    const { context, intensity } = this;
    context.setTransform(scale, 0, 0, scale, 0, 0);
    context.clearRect(0, 0, width, height);
    context.lineWidth = 1;
    for (const link of snapshot.links) {
      const from = snapshot.nodes[link.from]!;
      const to = snapshot.nodes[link.to]!;
      const plane = Math.min(from.plane, to.plane) as 0 | 1 | 2;
      const brighter = from.glow >= to.glow ? from : to;
      // A zona de exclusão: a aresta é tão visível quanto a ponta mais escondida.
      const visibility = Math.min(from.visibility, to.visibility);
      context.globalAlpha =
        (LINK_ALPHA[plane] * link.strength * intensity + brighter.glow * 0.35) * visibility;
      context.strokeStyle = this.ink[brighter.tone];
      context.beginPath();
      context.moveTo(from.x, from.y);
      context.lineTo(to.x, to.y);
      context.stroke();
    }
    for (const node of snapshot.nodes) {
      const radius = node.size * (1 + node.glow * 0.8);
      const lit = this.ink[node.tone];
      if (node.glow > 0.05) {
        context.globalAlpha = node.glow * 0.25 * node.visibility;
        context.fillStyle = lit;
        context.beginPath();
        context.arc(node.x, node.y, radius * 3.2, 0, Math.PI * 2);
        context.fill();
      }
      context.globalAlpha =
        Math.min(1, PLANE_ALPHA[node.plane] * intensity + node.glow * 0.4) * node.visibility;
      context.fillStyle = node.plane === 0 ? this.back : node.glow > 0.3 ? lit : this.front;
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
  private unsubscribeCollective: (() => void) | null = null;
  private readonly loop = new LiveCanvasLoop((delta) => this.frame(delta));

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly signals: SynapseSignals,
    private readonly scene: SynapseScene,
  ) {
    this.network = new SynapseNetwork(1, 1, new NetworkComposition(0, "mobile"));
    this.fit();
  }

  /**
   * Mede o canvas de novo, com o DPR limitado a 2, e recompõe a rede para a
   * largura nova — com a zona de composição da cena medida na mesma passada.
   * Sem medida (jsdom, ou um bloco ainda sem tamanho), a rede nasce sem zona.
   */
  fit(): void {
    const rect = this.canvas.getBoundingClientRect();
    this.width = Math.max(1, Math.round(rect.width || window.innerWidth));
    this.height = Math.max(1, Math.round(rect.height || window.innerHeight));
    this.scale = Math.min(window.devicePixelRatio || 1, MAX_DEVICE_PIXEL_RATIO);
    this.canvas.width = Math.round(this.width * this.scale);
    this.canvas.height = Math.round(this.height * this.scale);
    this.network = new SynapseNetwork(
      this.width,
      this.height,
      this.scene.composition(rect, this.width, this.height),
    );
    this.listenToCollective();
    this.painter = SynapsePainter.for(this.canvas, this.scene.intensity);
  }

  /** A rede pulsou em coletivo → a tela fica sabendo (a marca pisca junto). Refeito a cada rede nova. */
  private listenToCollective(): void {
    this.unsubscribeCollective?.();
    this.unsubscribeCollective = this.network.onCollectivePulse((pulse) =>
      this.signals.announceCollectivePulse(pulse),
    );
  }

  /** Um quadro só, parado — o que `prefers-reduced-motion` recebe. Nenhum pulso pedido passa por aqui. */
  still(): void {
    this.network.tick(16, null);
    this.paint();
  }

  start(): void {
    this.loop.start();
  }

  stop(): void {
    this.loop.stop();
    this.unsubscribeCollective?.();
    this.unsubscribeCollective = null;
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
    if (this.signals.isEmphasized !== this.emphasized) {
      this.emphasized = this.signals.isEmphasized;
      this.network.emphasize(this.emphasized ? this.scene.emphasisZone() : null);
    }
    const tones = this.signals.drainPulses();
    if (tones.length === 0) return;
    // Dois tons no mesmo quadro: o vermelho é sinal, e vence.
    const tone: PulseTone = tones.includes("danger") ? "danger" : "primary";
    this.network.pulse(this.scene.pulseOrigin(this.pointer), "collective", tone);
  }

  private paint(): void {
    this.painter?.draw(this.network.snapshot, this.width, this.height, this.scale);
  }
}

/**
 * A rede de sinapses ao fundo — do login e, desde 2026-09-08, da aplicação
 * inteira. O motor é o `SynapseNetwork`; este componente só liga o canvas
 * (DPR ≤ 2, resize), a cena (porta: marca e cartão; interior: o conteúdo a
 * excluir), o ponteiro (mouse e toque leve), os sinais da tela e o relógio —
 * que pausa com a aba escondida e é cancelado no unmount. Com
 * `prefers-reduced-motion`, desenha um quadro parado, não anima e não pulsa.
 *
 * `exclusionRef` escolhe a cena: com ele, é o INTERIOR (o canvas é fixo ao
 * viewport, atrás de tudo); sem ele, a PORTA (o canvas preenche o palco).
 */
export function SynapseBackground({
  signals,
  focalRef,
  brandRef,
  exclusionRef,
}: {
  signals: SynapseSignals;
  /** Porta — o cartão: zona de ênfase, origem do pulso e um dos dois blocos da composição. */
  focalRef?: RefObject<HTMLElement | null>;
  /** Porta — a marca: o outro bloco da composição; a rede se adensa entre os dois. */
  brandRef?: RefObject<HTMLElement | null>;
  /** Interior — o conteúdo (`<main>`) que a rede nunca atravessa. */
  exclusionRef?: RefObject<HTMLElement | null>;
}) {
  const reducedMotion = useReducedMotion();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [motion, setMotion] = useState<"live" | "still">(reducedMotion ? "still" : "live");
  const kind: SceneKind = exclusionRef ? "interior" : "door";

  useEffect(() => {
    setMotion(reducedMotion ? "still" : "live");
    const canvas = canvasRef.current;
    if (!canvas) return;
    const scene: SynapseScene = exclusionRef
      ? new InteriorScene(exclusionRef)
      : new DoorScene(focalRef ?? { current: null }, brandRef ?? { current: null });
    const stage = new SynapseStage(canvas, signals, scene);
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
  }, [reducedMotion, signals, focalRef, brandRef, exclusionRef]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      data-testid="synapse-network"
      data-motion={motion}
      data-scene={kind}
      className={
        kind === "interior"
          ? "pointer-events-none fixed inset-0 z-0 h-full w-full motion-safe:animate-[auth-fade_var(--motion-slow)_ease-out_both]"
          : "pointer-events-none absolute inset-0 h-full w-full motion-safe:animate-[auth-fade_var(--motion-slow)_ease-out_both]"
      }
    />
  );
}
