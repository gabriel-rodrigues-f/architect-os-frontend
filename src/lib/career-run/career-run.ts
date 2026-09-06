/**
 * O JOGO DA CORRIDA DE CARREIRA — o "dinossauro" do Synapse (dono, 2026-09-06:
 * "na página de carregamento eu gostaria de ver algo cômico, como o
 * dinossauro do Google, ambientado para a nossa solução").
 *
 * Aqui mora o MOTOR, sem DOM e sem canvas: física do pulo, obstáculos,
 * colisão, pontuação e nível. Tudo em unidades de "pista" (largura 600,
 * chão em y=0, y cresce para cima) e em milissegundos, para o teste medir
 * sem desenhar nada. O desenho é do `CareerRunCanvas`.
 *
 * A ambientação usa o vocabulário da casa: a pessoa pula DISTÂNCIAS (as
 * lacunas de competência) e recolhe EVIDÊNCIAS; a cada tanto sobe de NÍVEL
 * (Júnior → Pleno → Sênior), e a pista acelera.
 */
export interface Obstacle {
  readonly kind: "distancia";
  x: number;
  readonly width: number;
  readonly height: number;
}

export interface Pickup {
  readonly kind: "evidencia";
  x: number;
  readonly y: number;
  taken: boolean;
}

export interface Runner {
  readonly x: number;
  y: number;
  vy: number;
  readonly width: number;
  readonly height: number;
}

export type RunPhase = "ready" | "running" | "crashed";

export interface CareerRunSnapshot {
  readonly phase: RunPhase;
  readonly runner: Runner;
  readonly obstacles: readonly Obstacle[];
  readonly pickups: readonly Pickup[];
  readonly score: number;
  readonly evidences: number;
  readonly level: number;
  readonly speed: number;
  readonly distance: number;
}

export const TRACK_WIDTH = 600;
export const RUNNER_X = 60;

/** Os níveis da corrida e a pontuação que os abre — a régua do jogo, não a da carreira real. */
export const RUN_LEVELS = [
  { index: 1, key: "junior", from: 0 },
  { index: 2, key: "pleno", from: 300 },
  { index: 3, key: "senior", from: 800 },
] as const;

const GRAVITY = -0.0022; // unidades/ms²
const JUMP_VELOCITY = 0.72; // unidades/ms
const BASE_SPEED = 0.22; // unidades/ms
const SPEED_PER_LEVEL = 0.05;
const POINTS_PER_UNIT = 0.1;
const EVIDENCE_POINTS = 25;
const MIN_GAP_BETWEEN_OBSTACLES = 220;

export class CareerRun {
  private phase: RunPhase = "ready";
  private readonly runner: Runner = { x: RUNNER_X, y: 0, vy: 0, width: 28, height: 40 };
  private obstacles: Obstacle[] = [];
  private pickups: Pickup[] = [];
  private distance = 0;
  private evidences = 0;
  private sinceLastSpawn = 0;

  constructor(private readonly random: () => number = Math.random) {}

  get snapshot(): CareerRunSnapshot {
    return {
      phase: this.phase,
      runner: { ...this.runner },
      obstacles: this.obstacles.map((obstacle) => ({ ...obstacle })),
      pickups: this.pickups.map((pickup) => ({ ...pickup })),
      score: this.score,
      evidences: this.evidences,
      level: this.level,
      speed: this.speed,
      distance: this.distance,
    };
  }

  get score(): number {
    return Math.floor(this.distance * POINTS_PER_UNIT) + this.evidences * EVIDENCE_POINTS;
  }

  /** O nível é lido da pontuação: sobe, nunca desce dentro da mesma corrida. */
  get level(): number {
    let level = 1;
    for (const candidate of RUN_LEVELS) if (this.score >= candidate.from) level = candidate.index;
    return level;
  }

  get speed(): number {
    return BASE_SPEED + (this.level - 1) * SPEED_PER_LEVEL;
  }

  /** Pular começa a corrida quando ela está pronta, e recomeça quando ela caiu. */
  jump(): void {
    if (this.phase === "ready") {
      this.phase = "running";
    } else if (this.phase === "crashed") {
      this.restart();
      this.phase = "running";
    }
    if (this.runner.y === 0 && this.runner.vy === 0) this.runner.vy = JUMP_VELOCITY;
  }

  restart(): void {
    this.phase = "ready";
    this.runner.y = 0;
    this.runner.vy = 0;
    this.obstacles = [];
    this.pickups = [];
    this.distance = 0;
    this.evidences = 0;
    this.sinceLastSpawn = 0;
  }

  /** Avança o relógio; nada acontece fora de `running`. */
  tick(deltaMs: number): void {
    if (this.phase !== "running" || deltaMs <= 0) return;
    const step = Math.min(deltaMs, 50);
    this.advanceRunner(step);
    this.advanceTrack(step);
    this.spawn(step);
    this.collect();
    if (this.collides()) this.phase = "crashed";
  }

  private advanceRunner(step: number): void {
    if (this.runner.y > 0 || this.runner.vy > 0) {
      this.runner.vy += GRAVITY * step;
      this.runner.y = Math.max(0, this.runner.y + this.runner.vy * step);
      if (this.runner.y === 0) this.runner.vy = 0;
    }
  }

  private advanceTrack(step: number): void {
    const moved = this.speed * step;
    this.distance += moved;
    this.sinceLastSpawn += moved;
    for (const obstacle of this.obstacles) obstacle.x -= moved;
    for (const pickup of this.pickups) pickup.x -= moved;
    this.obstacles = this.obstacles.filter((obstacle) => obstacle.x + obstacle.width > 0);
    this.pickups = this.pickups.filter((pickup) => pickup.x > -20);
  }

  private spawn(step: number): void {
    const gap = MIN_GAP_BETWEEN_OBSTACLES + this.random() * 260;
    if (this.sinceLastSpawn < gap) return;
    this.sinceLastSpawn = 0;
    const tall = this.random() < 0.3;
    this.obstacles.push({
      kind: "distancia",
      x: TRACK_WIDTH,
      width: tall ? 18 : 24 + Math.floor(this.random() * 12),
      height: tall ? 46 : 28,
    });
    if (this.random() < 0.45) {
      this.pickups.push({
        kind: "evidencia",
        x: TRACK_WIDTH + 90 + this.random() * 60,
        y: 70,
        taken: false,
      });
    }
    void step;
  }

  private collect(): void {
    for (const pickup of this.pickups) {
      if (pickup.taken) continue;
      const overlapsX =
        pickup.x >= this.runner.x - 12 && pickup.x <= this.runner.x + this.runner.width + 12;
      const overlapsY =
        pickup.y >= this.runner.y - 8 && pickup.y <= this.runner.y + this.runner.height + 8;
      if (overlapsX && overlapsY) {
        pickup.taken = true;
        this.evidences += 1;
      }
    }
  }

  private collides(): boolean {
    const runner = this.runner;
    return this.obstacles.some(
      (obstacle) =>
        obstacle.x < runner.x + runner.width - 6 &&
        obstacle.x + obstacle.width > runner.x + 6 &&
        runner.y < obstacle.height - 4,
    );
  }
}
