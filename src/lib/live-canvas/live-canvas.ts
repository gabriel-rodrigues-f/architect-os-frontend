/**
 * O CANVAS VIVO — o que a corrida de carreira (`CareerRunCanvas`) e a rede de
 * sinapses do login (`SynapseBackground`) têm em comum, num objeto só (regra
 * de reuso: 2 ocorrências = componente).
 *
 *  - `ThemeTokens` lê as cores dos tokens da própria aplicação, do elemento
 *    que vai desenhar — assim uma composição forçada em `.dark` recebe as
 *    cores do escuro mesmo com o tema claro no resto da página.
 *  - `LiveCanvasLoop` liga o relógio do navegador (`requestAnimationFrame`),
 *    entrega o delta em ms, PAUSA quando a aba deixa de estar visível e
 *    retoma sem salto quando ela volta; `stop()` cancela o quadro pendente.
 *
 * Nada aqui desenha: o pincel é de cada componente.
 */
export interface FrameScheduler {
  requestAnimationFrame(callback: (now: number) => void): number;
  cancelAnimationFrame(handle: number): void;
}

export interface VisibilitySource {
  readonly visibilityState: string;
  addEventListener(type: "visibilitychange", listener: () => void): void;
  removeEventListener(type: "visibilitychange", listener: () => void): void;
}

export class ThemeTokens {
  private constructor(private readonly style: CSSStyleDeclaration) {}

  static of(element: Element): ThemeTokens {
    return new ThemeTokens(getComputedStyle(element));
  }

  read(name: string, fallback: string): string {
    return this.style.getPropertyValue(name).trim() || fallback;
  }
}

export class LiveCanvasLoop {
  private frame: number | null = null;
  private last: number | null = null;
  private started = false;

  constructor(
    private readonly onFrame: (deltaMs: number, now: number) => void,
    private readonly scheduler: FrameScheduler = LiveCanvasLoop.browserScheduler(),
    private readonly page: VisibilitySource = document,
  ) {}

  static browserScheduler(): FrameScheduler {
    return {
      requestAnimationFrame: (callback) => window.requestAnimationFrame(callback),
      cancelAnimationFrame: (handle) => window.cancelAnimationFrame(handle),
    };
  }

  get running(): boolean {
    return this.frame !== null;
  }

  start(): void {
    if (this.started) return;
    this.started = true;
    this.page.addEventListener("visibilitychange", this.onVisibility);
    this.resume();
  }

  stop(): void {
    if (!this.started) return;
    this.started = false;
    this.page.removeEventListener("visibilitychange", this.onVisibility);
    this.pause();
  }

  private readonly onVisibility = (): void => {
    if (this.page.visibilityState === "visible") this.resume();
    else this.pause();
  };

  private resume(): void {
    if (this.frame !== null || this.page.visibilityState !== "visible") return;
    this.last = null;
    this.frame = this.scheduler.requestAnimationFrame(this.step);
  }

  private pause(): void {
    if (this.frame === null) return;
    this.scheduler.cancelAnimationFrame(this.frame);
    this.frame = null;
  }

  private readonly step = (now: number): void => {
    const delta = this.last === null ? 0 : now - this.last;
    this.last = now;
    this.onFrame(delta, now);
    if (this.frame !== null) this.frame = this.scheduler.requestAnimationFrame(this.step);
  };
}
