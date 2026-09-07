/**
 * A REDE DE SINAPSES DO LOGIN — a assinatura visual que o nome Synapse pede
 * (direção `login-synapse-network-2026-09-06.md`).
 *
 * Aqui mora o MOTOR, sem DOM e sem canvas: nós em três planos de profundidade
 * com densidade irregular (clusters e vazios), drift lento, conexões quando a
 * distância permite, atração leve ao ponteiro com inércia e retorno suave, e
 * pulsos que correm pela rede. Tudo em pixels de tela e milissegundos, para o
 * teste medir sem desenhar nada. O desenho é do `SynapseBackground`.
 */
export type Plane = 0 | 1 | 2;

export interface NetworkNode {
  readonly id: number;
  /** 0 = fundo, 1 = meio, 2 = frente. */
  readonly plane: Plane;
  x: number;
  y: number;
  /** A casa do nó: para onde ele volta quando o ponteiro vai embora. */
  readonly homeX: number;
  readonly homeY: number;
  vx: number;
  vy: number;
  readonly size: number;
  /** Fase individual do drift, para os nós não respirarem em uníssono. */
  readonly phase: number;
  /** Intensidade extra (0..1): pulso passando ou zona enfatizada. */
  glow: number;
}

export interface NetworkLink {
  readonly from: number;
  readonly to: number;
  /** 1 quando os nós se tocam, 0 no limite da distância de conexão. */
  readonly strength: number;
}

export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface Zone {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface Pulse {
  readonly x: number;
  readonly y: number;
  age: number;
  readonly duration: number;
  readonly radius: number;
}

export interface PlaneStyle {
  /** Raio de atração ao ponteiro, em px. */
  readonly reach: number;
  readonly linkDistance: number;
  readonly maxLinks: number;
  readonly size: number;
  /** Amplitude do drift, em px. */
  readonly drift: number;
  /** Quanto o plano responde ao ponteiro (o da frente responde mais). */
  readonly pull: number;
}

export interface SynapseNetworkSnapshot {
  readonly nodes: readonly NetworkNode[];
  readonly links: readonly NetworkLink[];
  readonly pulses: readonly Pulse[];
}

/** O que cada plano tem de seu — a paralaxe é a diferença entre estas linhas. */
export const PLANE_STYLE: readonly [PlaneStyle, PlaneStyle, PlaneStyle] = [
  { reach: 120, linkDistance: 120, maxLinks: 3, size: 1.2, drift: 8, pull: 0.5 },
  { reach: 170, linkDistance: 150, maxLinks: 3, size: 1.9, drift: 12, pull: 0.8 },
  { reach: 220, linkDistance: 180, maxLinks: 4, size: 2.7, drift: 16, pull: 1 },
];

const PLANE_SHARE: readonly [number, number, number] = [0.45, 0.35, 0.2];
const MAX_STEP_MS = 50;
const SPRING = 0.000012; // px/ms² por px de afastamento
const DAMPING_PER_MS = 0.994;
const POINTER_PULL = 0.0004; // px/ms² no centro do raio
const MAX_SPEED = 0.2; // px/ms — retorno suave, nunca salto
const DRIFT_RATE = 0.00035; // rad/ms
const GLOW_EASE_MS = 150;
const EMPHASIS_GLOW = 0.6;
const EMPHASIS_MARGIN = 80;
const PULSE_DURATION_MS = 420;
const PULSE_RADIUS = 480;
const PULSE_BAND = 70;
const SPONTANEOUS_PULSE_MIN_MS = 4000;
const SPONTANEOUS_PULSE_SPREAD_MS = 5000;
const SPONTANEOUS_PULSE_RADIUS = 200;
const CLUSTERED_SHARE = 0.7;
const EDGE_MARGIN = 24;

export type DeviceClass = "mobile" | "tablet" | "desktop";

/** Quantos nós cabem numa largura — e como eles se repartem pelos planos. */
export class NetworkComposition {
  private static readonly BANDS: readonly {
    device: DeviceClass;
    from: number;
    to: number;
    min: number;
    max: number;
  }[] = [
    { device: "mobile", from: 0, to: 768, min: 15, max: 35 },
    { device: "tablet", from: 768, to: 1280, min: 35, max: 60 },
    { device: "desktop", from: 1280, to: 2560, min: 50, max: 90 },
  ];

  constructor(
    readonly nodes: number,
    readonly device: DeviceClass,
  ) {}

  static for(width: number): NetworkComposition {
    const band =
      NetworkComposition.BANDS.find((candidate) => width < candidate.to) ??
      NetworkComposition.BANDS[NetworkComposition.BANDS.length - 1]!;
    const position = Math.min(1, Math.max(0, (width - band.from) / (band.to - band.from)));
    const nodes = Math.round(band.min + (band.max - band.min) * position);
    return new NetworkComposition(nodes, band.device);
  }

  /** A cota de cada plano; o resto da divisão fica com o fundo. */
  countFor(plane: number): number {
    const middle = Math.floor(this.nodes * PLANE_SHARE[1]);
    const front = Math.floor(this.nodes * PLANE_SHARE[2]);
    if (plane === 1) return middle;
    if (plane === 2) return front;
    return this.nodes - middle - front;
  }
}

export class SynapseNetwork {
  private readonly nodes: NetworkNode[] = [];
  private links: NetworkLink[] = [];
  private pulses: Pulse[] = [];
  private emphasis: Zone | null = null;
  private clock = 0;
  private untilSpontaneousPulse: number;

  constructor(
    readonly width: number,
    readonly height: number,
    composition: NetworkComposition = NetworkComposition.for(width),
    private readonly random: () => number = Math.random,
  ) {
    this.seed(composition);
    this.untilSpontaneousPulse = this.nextSpontaneousDelay();
  }

  get snapshot(): SynapseNetworkSnapshot {
    return {
      nodes: this.nodes.map((node) => ({ ...node })),
      links: this.links.map((link) => ({ ...link })),
      pulses: this.pulses.map((pulse) => ({ ...pulse })),
    };
  }

  /** Um pulso que corre pela rede a partir de um ponto — o clique em Entrar. */
  pulse(origin: Point = { x: this.width / 2, y: this.height / 2 }): void {
    this.pulses.push({
      x: origin.x,
      y: origin.y,
      age: 0,
      duration: PULSE_DURATION_MS,
      radius: PULSE_RADIUS,
    });
  }

  /** A zona que ganha intensidade — o cartão, quando um campo tem foco. `null` apaga. */
  emphasize(zone: Zone | null): void {
    this.emphasis = zone;
  }

  /** Avança o relógio; o passo é limitado para uma aba parada não teletransportar a rede. */
  tick(deltaMs: number, pointer: Point | null): void {
    if (deltaMs <= 0) return;
    const step = Math.min(deltaMs, MAX_STEP_MS);
    this.clock += step;
    this.advancePulses(step);
    for (const node of this.nodes) {
      this.move(node, step, pointer);
      this.light(node, step);
    }
    this.links = this.connect();
  }

  private seed(composition: NetworkComposition): void {
    const clusters = this.clusterCenters();
    const spread = Math.min(this.width, this.height) * 0.12;
    let id = 0;
    for (const plane of [0, 1, 2] as const) {
      const style = PLANE_STYLE[plane];
      for (let count = composition.countFor(plane); count > 0; count -= 1) {
        const home =
          this.random() < CLUSTERED_SHARE ? this.nearACluster(clusters, spread) : this.anywhere();
        this.nodes.push({
          id,
          plane,
          x: home.x,
          y: home.y,
          homeX: home.x,
          homeY: home.y,
          vx: 0,
          vy: 0,
          size: style.size * (0.8 + this.random() * 0.5),
          phase: this.random() * Math.PI * 2,
          glow: 0,
        });
        id += 1;
      }
    }
  }

  private clusterCenters(): Point[] {
    const count = 3 + Math.floor(this.random() * 3);
    const centers: Point[] = [];
    for (let index = 0; index < count; index += 1) centers.push(this.anywhere());
    return centers;
  }

  private nearACluster(clusters: readonly Point[], spread: number): Point {
    const center = clusters[Math.floor(this.random() * clusters.length)]!;
    return this.clamp({
      x: center.x + this.gaussian() * spread,
      y: center.y + this.gaussian() * spread,
    });
  }

  private anywhere(): Point {
    return {
      x: EDGE_MARGIN + this.random() * (this.width - EDGE_MARGIN * 2),
      y: EDGE_MARGIN + this.random() * (this.height - EDGE_MARGIN * 2),
    };
  }

  /** Aproximação de uma normal: soma de três uniformes centrada em zero. */
  private gaussian(): number {
    return (this.random() + this.random() + this.random() - 1.5) * 1.6;
  }

  private clamp(point: Point): Point {
    return {
      x: Math.min(this.width - EDGE_MARGIN, Math.max(EDGE_MARGIN, point.x)),
      y: Math.min(this.height - EDGE_MARGIN, Math.max(EDGE_MARGIN, point.y)),
    };
  }

  private move(node: NetworkNode, step: number, pointer: Point | null): void {
    const style = PLANE_STYLE[node.plane];
    const angle = this.clock * DRIFT_RATE + node.phase;
    const targetX = node.homeX + Math.cos(angle) * style.drift;
    const targetY = node.homeY + Math.sin(angle * 0.7 + node.phase) * style.drift;
    let ax = (targetX - node.x) * SPRING;
    let ay = (targetY - node.y) * SPRING;
    if (pointer) {
      const dx = pointer.x - node.x;
      const dy = pointer.y - node.y;
      const distance = Math.hypot(dx, dy);
      if (distance > 0 && distance < style.reach) {
        const strength = (1 - distance / style.reach) * POINTER_PULL * style.pull;
        ax += (dx / distance) * strength;
        ay += (dy / distance) * strength;
      }
    }
    const damping = DAMPING_PER_MS ** step;
    node.vx = (node.vx + ax * step) * damping;
    node.vy = (node.vy + ay * step) * damping;
    const speed = Math.hypot(node.vx, node.vy);
    if (speed > MAX_SPEED) {
      node.vx = (node.vx / speed) * MAX_SPEED;
      node.vy = (node.vy / speed) * MAX_SPEED;
    }
    node.x += node.vx * step;
    node.y += node.vy * step;
  }

  private light(node: NetworkNode, step: number): void {
    let target = this.inEmphasis(node) ? EMPHASIS_GLOW : 0;
    for (const pulse of this.pulses) {
      const front = (pulse.age / pulse.duration) * pulse.radius;
      const distance = Math.hypot(node.x - pulse.x, node.y - pulse.y);
      const band = Math.exp(-(((distance - front) / PULSE_BAND) ** 2));
      target = Math.max(target, band * (1 - pulse.age / pulse.duration));
    }
    const ease = 1 - Math.exp(-step / GLOW_EASE_MS);
    node.glow += (target - node.glow) * (target > node.glow ? Math.max(ease, 0.6) : ease);
  }

  private inEmphasis(node: NetworkNode): boolean {
    const zone = this.emphasis;
    if (!zone) return false;
    return (
      node.x >= zone.x - EMPHASIS_MARGIN &&
      node.x <= zone.x + zone.width + EMPHASIS_MARGIN &&
      node.y >= zone.y - EMPHASIS_MARGIN &&
      node.y <= zone.y + zone.height + EMPHASIS_MARGIN
    );
  }

  private advancePulses(step: number): void {
    for (const pulse of this.pulses) pulse.age += step;
    this.pulses = this.pulses.filter((pulse) => pulse.age <= pulse.duration);
    this.untilSpontaneousPulse -= step;
    if (this.untilSpontaneousPulse > 0 || this.nodes.length === 0) return;
    const origin = this.nodes[Math.floor(this.random() * this.nodes.length)]!;
    this.pulses.push({
      x: origin.x,
      y: origin.y,
      age: 0,
      duration: PULSE_DURATION_MS,
      radius: SPONTANEOUS_PULSE_RADIUS,
    });
    this.untilSpontaneousPulse = this.nextSpontaneousDelay();
  }

  private nextSpontaneousDelay(): number {
    return SPONTANEOUS_PULSE_MIN_MS + this.random() * SPONTANEOUS_PULSE_SPREAD_MS;
  }

  /** Pares próximos, do mais perto ao mais longe, até cada nó esgotar a sua cota. */
  private connect(): NetworkLink[] {
    const candidates: { from: number; to: number; distance: number; limit: number }[] = [];
    for (let first = 0; first < this.nodes.length; first += 1) {
      const nodeA = this.nodes[first]!;
      for (let second = first + 1; second < this.nodes.length; second += 1) {
        const nodeB = this.nodes[second]!;
        const limit =
          (PLANE_STYLE[nodeA.plane].linkDistance + PLANE_STYLE[nodeB.plane].linkDistance) / 2;
        const distance = Math.hypot(nodeA.x - nodeB.x, nodeA.y - nodeB.y);
        if (distance < limit) candidates.push({ from: first, to: second, distance, limit });
      }
    }
    candidates.sort((left, right) => left.distance - right.distance);
    const used = new Uint8Array(this.nodes.length);
    const links: NetworkLink[] = [];
    for (const candidate of candidates) {
      const fromNode = this.nodes[candidate.from]!;
      const toNode = this.nodes[candidate.to]!;
      if (used[candidate.from]! >= PLANE_STYLE[fromNode.plane].maxLinks) continue;
      if (used[candidate.to]! >= PLANE_STYLE[toNode.plane].maxLinks) continue;
      used[candidate.from] = (used[candidate.from] ?? 0) + 1;
      used[candidate.to] = (used[candidate.to] ?? 0) + 1;
      links.push({
        from: candidate.from,
        to: candidate.to,
        strength: 1 - candidate.distance / candidate.limit,
      });
    }
    return links;
  }
}
