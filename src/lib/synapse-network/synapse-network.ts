/**
 * A REDE DE SINAPSES DO LOGIN — a assinatura visual que o nome Synapse pede
 * (direção `login-synapse-network-2026-09-06.md`).
 *
 * Aqui mora o MOTOR, sem DOM e sem canvas: nós em três planos de profundidade
 * com densidade irregular (clusters e vazios), drift lento, conexões quando a
 * distância permite, atração leve ao ponteiro com inércia e retorno suave, e
 * pulsos que correm pela rede. Tudo em pixels de tela e milissegundos, para o
 * teste medir sem desenhar nada. O desenho é do `SynapseBackground`.
 *
 * Dois pulsos (dono, 2026-09-07): o LOCAL nasce num nó e corre um raio curto,
 * a cada poucos segundos; o COLETIVO é raro, parte de um ponto e atravessa a
 * rede INTEIRA — "os neurônios piscando todos juntos" — e é o único que vira
 * evento (`onCollectivePulse`), com início e duração, para a marca piscar
 * junto. O clique em Entrar é coletivo.
 *
 * O TOM (dono, 2026-09-08): "se o login for rejeitado, a sinapse deve ser
 * vermelha [...]; só pode ser azul quando o usuário conseguir se logar com
 * sucesso". O pulso carrega o tom, o nó aceso herda o tom do pulso que o
 * acendeu, e o evento coletivo leva o tom à marca. O motor não conhece cor:
 * `primary` e `danger` são nomes de token, e quem os lê é o pincel.
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
  /** O tom do que acendeu o nó por último — o pincel pinta o brilho com ele. */
  tone: PulseTone;
  /** Multiplicador de opacidade (0..1]: 1 fora das zonas de exclusão, baixo no halo da marca e atrás do cartão. */
  visibility: number;
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

export type PulseKind = "local" | "collective";

/** O tom do pulso, em nome de token: `primary` é o azul da casa, `danger` o vermelho de erro dos campos. */
export type PulseTone = "primary" | "danger";

export interface Pulse {
  readonly x: number;
  readonly y: number;
  age: number;
  readonly duration: number;
  readonly radius: number;
  readonly kind: PulseKind;
  readonly tone: PulseTone;
}

/** O pulso coletivo como evento: quando começou (relógio da rede, ms), quanto dura e de que tom é. */
export interface CollectivePulse {
  readonly startedAt: number;
  readonly durationMs: number;
  readonly tone: PulseTone;
}

export type CollectivePulseListener = (pulse: CollectivePulse) => void;

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
const PULSE_BAND = 70;
const LOCAL_PULSE_DURATION_MS = 420;
const LOCAL_PULSE_RADIUS = 200;
const LOCAL_PULSE_MIN_MS = 4000;
const LOCAL_PULSE_SPREAD_MS = 5000;
/**
 * O coletivo: a frente atravessa a tela inteira em pouco mais de um segundo.
 * Deixou de ser exportado em 2026-09-08: quem o lia de fora era a marca, para
 * piscar junto — e a piscada morreu a pedido do dono.
 */
const COLLECTIVE_PULSE_DURATION_MS = 1200;
/** A fração da duração em que a frente coletiva cruza a tela; o resto é o apagar. */
const COLLECTIVE_TRAVEL_SHARE = 0.7;
const COLLECTIVE_PULSE_MIN_MS = 12000;
const COLLECTIVE_PULSE_SPREAD_MS = 8000;
/** O halo em volta da marca onde a rede quase some, em px. */
const BRAND_HALO = 40;
const VISIBILITY = { brand: 0.3, behindCard: 0.15, behindContent: 0, elsewhere: 1 } as const;
const CLUSTERED_SHARE = 0.7;
const EDGE_MARGIN = 24;

const SEED_ATTEMPTS = 24;
/** A faixa de "extremo": quem nasce a menos de 8% da borda quase nunca fica. */
const EXTREME_SHARE = 0.08;
/** Até onde "perto do login" vai, em px a partir da borda do cartão. */
const NEAR_CARD = 120;
const WEIGHT = {
  center: 1,
  /** Era 0.6; −25% (terceira avaliação de UX): o que sai do canto vai para o vão central. */
  bottomLeft: 0.45,
  brand: 0.45,
  elsewhere: 0.45,
  nearCard: 0.3,
  extreme: 0.08,
  /** Atrás do cartão o nó não aparece — é nó jogado fora. */
  behindCard: 0.05,
} as const;

export type DeviceClass = "mobile" | "tablet" | "desktop";

/**
 * A ZONA DE COMPOSIÇÃO — os retângulos da marca e do cartão em coordenadas
 * do canvas (refino do login, 2026-09-07). Com ela a rede deixa de ser um
 * fundo indiferente e passa a costurar os lados: o centro entre os dois
 * blocos é onde mais nasce nó; o canto inferior esquerdo fica em densidade
 * média; perto do login é baixa (o cartão precisa de silêncio); os extremos
 * da viewport ficam quase vazios. E há uma direção — a diagonal que vai da
 * marca ao login —, ao longo da qual os clusters se alinham: do pé da marca
 * ao alto do cartão, passando pelo centro do vão entre os dois.
 */
export class CompositionZone {
  /**
   * @param brand A marca — só nas telas de porta. `null` é a composição do
   *   INTERIOR: sem diagonal, sem halo; só o conteúdo a excluir.
   * @param card O bloco protegido: o cartão do login ou o `<main>` do interior.
   */
  constructor(
    readonly brand: Zone | null,
    readonly card: Zone,
  ) {}

  /**
   * A composição do INTERIOR (dono, 2026-09-08: "o mesmo efeito da tela de
   * login, quero no fundo da aplicação como um todo"): o conteúdo — o `<main>`
   * — é zona de exclusão total, e a rede vive nas margens: cabeçalho, bordas,
   * o vão da coluna. Nunca atrás de tabelas e cartões, porque eles moram lá.
   */
  static aroundContent(canvas: Zone, content: Zone): CompositionZone | null {
    if (CompositionZone.empty(canvas) || CompositionZone.empty(content)) return null;
    return new CompositionZone(null, {
      x: content.x - canvas.x,
      y: content.y - canvas.y,
      width: content.width,
      height: content.height,
    });
  }

  private get behindCard(): number {
    return this.brand ? VISIBILITY.behindCard : VISIBILITY.behindContent;
  }

  /** A partir do que a tela mediu (`getBoundingClientRect`), relativo ao canvas; `null` se algo ainda não tem tamanho. */
  static measured(canvas: Zone, brand: Zone, card: Zone): CompositionZone | null {
    if (
      CompositionZone.empty(canvas) ||
      CompositionZone.empty(brand) ||
      CompositionZone.empty(card)
    ) {
      return null;
    }
    const relative = (zone: Zone): Zone => ({
      x: zone.x - canvas.x,
      y: zone.y - canvas.y,
      width: zone.width,
      height: zone.height,
    });
    return new CompositionZone(relative(brand), relative(card));
  }

  private static empty(zone: Zone): boolean {
    return zone.width <= 0 || zone.height <= 0;
  }

  /** O multiplicador de opacidade num ponto: ~0.3 no halo da marca, ~0.15 atrás do cartão, 1 no resto. */
  visibilityAt(point: Point): number {
    if (this.brand && CompositionZone.contains(this.brand, point, BRAND_HALO)) {
      return VISIBILITY.brand;
    }
    if (CompositionZone.contains(this.card, point)) return this.behindCard;
    return VISIBILITY.elsewhere;
  }

  /** Se o segmento entre dois pontos passa pelas letras da marca. */
  crossesBrand(from: Point, to: Point): boolean {
    return this.brand !== null && CompositionZone.segmentMeets(this.brand, from, to);
  }

  /** Liang–Barsky: o segmento toca o retângulo se sobra algum `t` em [0, 1] depois dos quatro cortes. */
  private static segmentMeets(zone: Zone, from: Point, to: Point): boolean {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const cuts: readonly [number, number][] = [
      [-dx, from.x - zone.x],
      [dx, zone.x + zone.width - from.x],
      [-dy, from.y - zone.y],
      [dy, zone.y + zone.height - from.y],
    ];
    let enter = 0;
    let exit = 1;
    for (const [slope, room] of cuts) {
      if (slope === 0) {
        if (room < 0) return false;
        continue;
      }
      const at = room / slope;
      if (slope < 0) enter = Math.max(enter, at);
      else exit = Math.min(exit, at);
      if (enter > exit) return false;
    }
    return true;
  }

  private static contains(zone: Zone, point: Point, margin = 0): boolean {
    return (
      point.x >= zone.x - margin &&
      point.x <= zone.x + zone.width + margin &&
      point.y >= zone.y - margin &&
      point.y <= zone.y + zone.height + margin
    );
  }

  /**
   * Um ponto na diagonal marca → centro → login: `t` = 0 no pé da marca (canto
   * inferior esquerdo dela), 1 no alto do cartão (a um quarto da borda
   * esquerda). Sobe da esquerda para a direita, cruzando o vão pelo meio.
   */
  along(t: number): Point {
    if (!this.brand) return this.contentCentre();
    const from = { x: this.brand.x, y: this.brand.y + this.brand.height };
    const to = { x: this.card.x + this.card.width * 0.25, y: this.card.y };
    return { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t };
  }

  private contentCentre(): Point {
    return { x: this.card.x + this.card.width / 2, y: this.card.y + this.card.height / 2 };
  }

  /** O peso (0..1] de um ponto receber um nó — a densidade por região. */
  weightAt(point: Point, width: number, height: number): number {
    const toEdge = Math.min(point.x, width - point.x, point.y, height - point.y);
    if (toEdge < Math.min(width, height) * EXTREME_SHARE) return WEIGHT.extreme;
    if (CompositionZone.contains(this.card, point, EDGE_MARGIN)) return WEIGHT.behindCard;
    // No interior não há "perto do conteúdo": as margens são estreitas e são tudo o que a rede tem.
    if (!this.brand) return WEIGHT.center;
    if (CompositionZone.contains(this.card, point, NEAR_CARD)) return WEIGHT.nearCard;
    if (CompositionZone.contains(this.brand, point)) return WEIGHT.brand;
    const brandRight = this.brand.x + this.brand.width;
    const brandBottom = this.brand.y + this.brand.height;
    if (point.x > brandRight && point.x < this.card.x) {
      const spread = height * 0.3;
      const near = Math.exp(-((this.distanceToDiagonal(point) / spread) ** 2));
      return WEIGHT.elsewhere + (WEIGHT.center - WEIGHT.elsewhere) * near;
    }
    if (point.x <= brandRight && point.y > brandBottom) return WEIGHT.bottomLeft;
    return WEIGHT.elsewhere;
  }

  private distanceToDiagonal(point: Point): number {
    const from = this.along(0);
    const to = this.along(1);
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const length = dx * dx + dy * dy;
    const t =
      length === 0
        ? 0
        : Math.max(0, Math.min(1, ((point.x - from.x) * dx + (point.y - from.y) * dy) / length));
    return Math.hypot(point.x - (from.x + dx * t), point.y - (from.y + dy * t));
  }
}

/** Quantos nós cabem numa largura, como eles se repartem pelos planos — e, se houver, a zona que os distribui. */
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
    readonly zone: CompositionZone | null = null,
  ) {}

  /** O interior é bem mais discreto que o login: menos da metade dos nós para a mesma largura. */
  static readonly INTERIOR_DENSITY = 0.45;

  /** A composição do interior: a densidade contida, em volta do conteúdo. */
  static interior(width: number, zone: CompositionZone | null): NetworkComposition {
    const door = NetworkComposition.for(width, zone);
    return new NetworkComposition(
      Math.max(1, Math.round(door.nodes * NetworkComposition.INTERIOR_DENSITY)),
      door.device,
      zone,
    );
  }

  static for(width: number, zone: CompositionZone | null = null): NetworkComposition {
    const band =
      NetworkComposition.BANDS.find((candidate) => width < candidate.to) ??
      NetworkComposition.BANDS[NetworkComposition.BANDS.length - 1]!;
    const position = Math.min(1, Math.max(0, (width - band.from) / (band.to - band.from)));
    const nodes = Math.round(band.min + (band.max - band.min) * position);
    return new NetworkComposition(nodes, band.device, zone);
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
  private untilLocalPulse: number;
  private untilCollectivePulse: number;
  private readonly zone: CompositionZone | null;
  private readonly collectiveListeners = new Set<CollectivePulseListener>();

  constructor(
    readonly width: number,
    readonly height: number,
    composition: NetworkComposition = NetworkComposition.for(width),
    private readonly random: () => number = Math.random,
  ) {
    this.zone = composition.zone;
    this.seed(composition);
    this.untilLocalPulse = this.nextLocalDelay();
    this.untilCollectivePulse = this.nextCollectiveDelay();
  }

  get snapshot(): SynapseNetworkSnapshot {
    return {
      nodes: this.nodes.map((node) => ({ ...node })),
      links: this.links.map((link) => ({ ...link })),
      pulses: this.pulses.map((pulse) => ({ ...pulse })),
    };
  }

  /**
   * Um pulso a partir de um ponto. Por padrão COLETIVO — o clique em Entrar
   * atravessa a rede inteira e avisa quem ouve; `"local"` é o pulso curto de
   * um nó, que ninguém anuncia. O tom padrão é o primário.
   *
   * Vermelho e azul nunca se sobrepõem: o vermelho é sinal, não decoração
   * (inventário 2026-09-08, §1.3-5). Um `danger` em curso descarta o
   * primário que chegar; um `danger` que chega apaga o primário em curso.
   */
  pulse(
    origin: Point = { x: this.width / 2, y: this.height / 2 },
    kind: PulseKind = "collective",
    tone: PulseTone = "primary",
  ): void {
    if (kind === "local") {
      this.pulses.push({
        x: origin.x,
        y: origin.y,
        age: 0,
        duration: LOCAL_PULSE_DURATION_MS,
        radius: LOCAL_PULSE_RADIUS,
        kind,
        tone,
      });
      return;
    }
    if (tone === "primary" && this.hasCollective("danger")) return;
    if (tone === "danger") this.pulses = this.pulses.filter((pulse) => pulse.kind !== "collective");
    this.pulses.push({
      x: origin.x,
      y: origin.y,
      age: 0,
      duration: COLLECTIVE_PULSE_DURATION_MS,
      radius: this.collectiveRadius(origin),
      kind,
      tone,
    });
    const event: CollectivePulse = {
      startedAt: this.clock,
      durationMs: COLLECTIVE_PULSE_DURATION_MS,
      tone,
    };
    for (const listener of this.collectiveListeners) listener(event);
  }

  private hasCollective(tone: PulseTone): boolean {
    return this.pulses.some((pulse) => pulse.kind === "collective" && pulse.tone === tone);
  }

  /** Quem quer saber do pulso coletivo (a marca pisca junto). Devolve o cancelamento. */
  onCollectivePulse(listener: CollectivePulseListener): () => void {
    this.collectiveListeners.add(listener);
    return () => {
      this.collectiveListeners.delete(listener);
    };
  }

  /** Do ponto de origem até o canto mais distante — a frente alcança todo nó. */
  private collectiveRadius(origin: Point): number {
    const farX = Math.max(origin.x, this.width - origin.x);
    const farY = Math.max(origin.y, this.height - origin.y);
    return Math.hypot(farX, farY) + PULSE_BAND;
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
    const { zone } = composition;
    const clusters = zone?.brand ? this.clustersAlong(zone, zone.brand) : this.clusterCenters();
    const spread = Math.min(this.width, this.height) * 0.12;
    let id = 0;
    for (const plane of [0, 1, 2] as const) {
      const style = PLANE_STYLE[plane];
      for (let count = composition.countFor(plane); count > 0; count -= 1) {
        const home = this.home(zone, clusters, spread);
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
          tone: "primary",
          visibility: zone ? zone.visibilityAt(home) : VISIBILITY.elsewhere,
        });
        id += 1;
      }
    }
  }

  /**
   * A casa de um nó. Sem zona, o sorteio de sempre; com zona, o mesmo sorteio
   * passa pelo peso da região — quem cai onde a composição quer pouco nó
   * tenta de novo, até um limite, e o total de nós não muda.
   */
  private home(zone: CompositionZone | null, clusters: readonly Point[], spread: number): Point {
    let candidate = this.candidate(clusters, spread);
    if (!zone) return candidate;
    for (let attempt = 0; attempt < SEED_ATTEMPTS; attempt += 1) {
      if (this.random() < zone.weightAt(candidate, this.width, this.height)) return candidate;
      candidate = this.candidate(clusters, spread);
    }
    return candidate;
  }

  private candidate(clusters: readonly Point[], spread: number): Point {
    return this.random() < CLUSTERED_SHARE ? this.nearACluster(clusters, spread) : this.anywhere();
  }

  /** Os clusters da composição da porta: três ao longo da diagonal marca → centro → login, um no canto inferior esquerdo. */
  private clustersAlong(zone: CompositionZone, brand: Zone): Point[] {
    const jitter = Math.min(this.width, this.height) * 0.06;
    const centers = [0.4, 0.55, 0.7].map((t) => zone.along(t));
    const brandBottom = brand.y + brand.height;
    centers.push({
      x: brand.x + brand.width * 0.35,
      y: brandBottom + (this.height - brandBottom) * 0.45,
    });
    return centers.map((center) =>
      this.clamp({
        x: center.x + (this.random() - 0.5) * jitter,
        y: center.y + (this.random() - 0.5) * jitter,
      }),
    );
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
    if (this.zone) node.visibility = this.zone.visibilityAt(node);
  }

  private light(node: NetworkNode, step: number): void {
    let target = this.inEmphasis(node) ? EMPHASIS_GLOW : 0;
    let tone: PulseTone = "primary";
    for (const pulse of this.pulses) {
      const distance = Math.hypot(node.x - pulse.x, node.y - pulse.y);
      const wave = SynapseNetwork.wave(pulse, distance);
      if (wave <= target) continue;
      target = wave;
      tone = pulse.tone;
    }
    // O tom troca quando um pulso acende o nó; enquanto ele só apaga, guarda o tom de quem o acendeu.
    if (target > node.glow) node.tone = tone;
    const ease = 1 - Math.exp(-step / GLOW_EASE_MS);
    node.glow += (target - node.glow) * (target > node.glow ? Math.max(ease, 0.6) : ease);
  }

  /**
   * A frente de onda de um pulso num nó a `distance` da origem. O local corre
   * e apaga no mesmo movimento (frente ∝ idade, envelope 1 − idade). O
   * coletivo precisa acender TODO nó com força: a frente, mais larga, cruza a
   * tela nos primeiros 70% da duração com o envelope cheio, e só depois apaga.
   */
  private static wave(pulse: Pulse, distance: number): number {
    const progress = pulse.age / pulse.duration;
    if (pulse.kind === "local") {
      const band = Math.exp(-(((distance - progress * pulse.radius) / PULSE_BAND) ** 2));
      return band * (1 - progress);
    }
    const front = Math.min(1, progress / COLLECTIVE_TRAVEL_SHARE) * pulse.radius;
    const band = Math.exp(-(((distance - front) / (PULSE_BAND * 2)) ** 2));
    const envelope =
      progress < COLLECTIVE_TRAVEL_SHARE
        ? 1
        : 1 - (progress - COLLECTIVE_TRAVEL_SHARE) / (1 - COLLECTIVE_TRAVEL_SHARE);
    return band * envelope;
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

  /**
   * Os pulsos espontâneos. O local sai de um nó sorteado a cada 4–9 s; o
   * coletivo, de um nó sorteado a cada 12–20 s — e, quando o coletivo passa,
   * o próximo local é adiado para não nascer dentro dele.
   */
  private advancePulses(step: number): void {
    for (const pulse of this.pulses) pulse.age += step;
    this.pulses = this.pulses.filter((pulse) => pulse.age <= pulse.duration);
    if (this.nodes.length === 0) return;
    this.untilCollectivePulse -= step;
    this.untilLocalPulse -= step;
    if (this.untilCollectivePulse <= 0) {
      this.pulse(this.randomNode(), "collective");
      this.untilCollectivePulse = this.nextCollectiveDelay();
      this.untilLocalPulse = Math.max(this.untilLocalPulse, COLLECTIVE_PULSE_DURATION_MS);
      return;
    }
    if (this.untilLocalPulse <= 0) {
      this.pulse(this.randomNode(), "local");
      this.untilLocalPulse = this.nextLocalDelay();
    }
  }

  private randomNode(): Point {
    const node = this.nodes[Math.floor(this.random() * this.nodes.length)]!;
    return { x: node.x, y: node.y };
  }

  private nextLocalDelay(): number {
    return LOCAL_PULSE_MIN_MS + this.random() * LOCAL_PULSE_SPREAD_MS;
  }

  private nextCollectiveDelay(): number {
    return COLLECTIVE_PULSE_MIN_MS + this.random() * COLLECTIVE_PULSE_SPREAD_MS;
  }

  /** Pares próximos, do mais perto ao mais longe, até cada nó esgotar a sua cota — e nunca por cima da marca. */
  private connect(): NetworkLink[] {
    const candidates: { from: number; to: number; distance: number; limit: number }[] = [];
    for (let first = 0; first < this.nodes.length; first += 1) {
      const nodeA = this.nodes[first]!;
      for (let second = first + 1; second < this.nodes.length; second += 1) {
        const nodeB = this.nodes[second]!;
        const limit =
          (PLANE_STYLE[nodeA.plane].linkDistance + PLANE_STYLE[nodeB.plane].linkDistance) / 2;
        const distance = Math.hypot(nodeA.x - nodeB.x, nodeA.y - nodeB.y);
        if (distance >= limit) continue;
        // Nenhuma aresta cruza as letras da marca (zona de exclusão).
        if (this.zone?.crossesBrand(nodeA, nodeB)) continue;
        candidates.push({ from: first, to: second, distance, limit });
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
