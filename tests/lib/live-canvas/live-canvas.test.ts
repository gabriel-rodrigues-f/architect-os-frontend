import { describe, expect, it } from "vitest";

import { LiveCanvasLoop, type FrameScheduler, type VisibilitySource } from "@/lib/live-canvas";

/**
 * O relógio do canvas vivo, compartilhado pela corrida de carreira e pela rede
 * de sinapses: entrega o delta, pausa com a aba escondida e cancela ao parar.
 */
class FakeScheduler implements FrameScheduler {
  pending = new Map<number, (now: number) => void>();
  cancelled: number[] = [];
  private nextHandle = 1;

  requestAnimationFrame(callback: (now: number) => void): number {
    const handle = this.nextHandle;
    this.nextHandle += 1;
    this.pending.set(handle, callback);
    return handle;
  }

  cancelAnimationFrame(handle: number): void {
    this.cancelled.push(handle);
    this.pending.delete(handle);
  }

  fire(now: number): void {
    const callbacks = [...this.pending.values()];
    this.pending.clear();
    for (const callback of callbacks) callback(now);
  }
}

class FakePage implements VisibilitySource {
  visibilityState = "visible";
  private listeners: (() => void)[] = [];

  addEventListener(_type: "visibilitychange", listener: () => void): void {
    this.listeners.push(listener);
  }

  removeEventListener(_type: "visibilitychange", listener: () => void): void {
    this.listeners = this.listeners.filter((candidate) => candidate !== listener);
  }

  become(state: "visible" | "hidden"): void {
    this.visibilityState = state;
    for (const listener of this.listeners) listener();
  }

  get listening(): number {
    return this.listeners.length;
  }
}

describe("LiveCanvasLoop", () => {
  it("entrega o delta entre quadros, começando do zero", () => {
    const scheduler = new FakeScheduler();
    const deltas: number[] = [];
    const loop = new LiveCanvasLoop((delta) => deltas.push(delta), scheduler, new FakePage());
    loop.start();
    scheduler.fire(1000);
    scheduler.fire(1016);
    scheduler.fire(1050);
    expect(deltas).toEqual([0, 16, 34]);
  });

  it("pausa quando a aba deixa de estar visível e retoma sem salto quando volta", () => {
    const scheduler = new FakeScheduler();
    const page = new FakePage();
    const deltas: number[] = [];
    const loop = new LiveCanvasLoop((delta) => deltas.push(delta), scheduler, page);
    loop.start();
    scheduler.fire(0);
    page.become("hidden");
    expect(loop.running).toBe(false);
    expect(scheduler.pending.size).toBe(0);
    page.become("visible");
    expect(loop.running).toBe(true);
    scheduler.fire(60000);
    scheduler.fire(60016);
    expect(deltas).toEqual([0, 0, 16]);
  });

  it("parar cancela o quadro pendente e solta o ouvinte de visibilidade", () => {
    const scheduler = new FakeScheduler();
    const page = new FakePage();
    const loop = new LiveCanvasLoop(() => undefined, scheduler, page);
    loop.start();
    expect(page.listening).toBe(1);
    loop.stop();
    expect(scheduler.cancelled).toEqual([1]);
    expect(scheduler.pending.size).toBe(0);
    expect(page.listening).toBe(0);
    expect(loop.running).toBe(false);
  });
});
