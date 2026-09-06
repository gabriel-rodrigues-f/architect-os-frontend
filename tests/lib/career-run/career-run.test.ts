import { describe, expect, it } from "vitest";

import { CareerRun, RUN_LEVELS } from "@/lib/career-run";

/**
 * O motor da corrida de carreira (dono, 2026-09-06: "algo cômico, como o
 * dinossauro do Google, ambientado para a nossa solução"). Sem canvas: a
 * física, a colisão e a pontuação são provadas em unidades de pista.
 */
const semAleatoriedade = (valor: number) => () => valor;

function correr(run: CareerRun, ms: number, passo = 16): void {
  for (let decorrido = 0; decorrido < ms; decorrido += passo) run.tick(passo);
}

describe("CareerRun — a régua do jogo", () => {
  it("nasce pronta e parada: o relógio não move nada até o primeiro pulo", () => {
    const run = new CareerRun(semAleatoriedade(0.5));
    correr(run, 1000);
    expect(run.snapshot.phase).toBe("ready");
    expect(run.snapshot.distance).toBe(0);
    run.jump();
    expect(run.snapshot.phase).toBe("running");
  });

  it("o pulo sobe, cai pela gravidade e volta ao chão sem atravessá-lo", () => {
    const run = new CareerRun(semAleatoriedade(0.99));
    run.jump();
    run.tick(100);
    expect(run.snapshot.runner.y).toBeGreaterThan(0);
    correr(run, 1500);
    expect(run.snapshot.runner.y).toBe(0);
    expect(run.snapshot.runner.vy).toBe(0);
  });

  it("no ar não há pulo duplo", () => {
    const run = new CareerRun(semAleatoriedade(0.99));
    run.jump();
    run.tick(100);
    const noAr = run.snapshot.runner.vy;
    run.jump();
    expect(run.snapshot.runner.vy).toBe(noAr);
  });

  it("uma distância chega pela direita e, sem pulo, derruba a pessoa", () => {
    const run = new CareerRun(semAleatoriedade(0));
    run.jump();
    correr(run, 200);
    // Sem pulo desde então: a corrida cai quando a distância alcança a pessoa.
    correr(run, 6000);
    expect(run.snapshot.phase).toBe("crashed");
    expect(run.snapshot.obstacles.length).toBeGreaterThan(0);
  });

  it("caída, a corrida congela: o relógio não pontua mais; pular recomeça do zero", () => {
    const run = new CareerRun(semAleatoriedade(0));
    run.jump();
    correr(run, 6000);
    expect(run.snapshot.phase).toBe("crashed");
    const pontos = run.snapshot.score;
    correr(run, 1000);
    expect(run.snapshot.score).toBe(pontos);
    run.jump();
    expect(run.snapshot.phase).toBe("running");
    expect(run.snapshot.score).toBe(0);
  });

  it("os pontos vêm da distância percorrida e das evidências recolhidas", () => {
    const run = new CareerRun(semAleatoriedade(0.99));
    run.jump();
    correr(run, 1000);
    expect(run.snapshot.score).toBeGreaterThan(0);
    expect(run.snapshot.score).toBe(
      Math.floor(run.snapshot.distance * 0.1) + run.snapshot.evidences * 25,
    );
  });

  it("o nível sobe com a pontuação — Júnior, Pleno, Sênior — e a pista acelera", () => {
    expect(RUN_LEVELS.map((nivel) => nivel.key)).toEqual(["junior", "pleno", "senior"]);
    const run = new CareerRun(semAleatoriedade(0.99));
    run.jump();
    expect(run.snapshot.level).toBe(1);
    const velocidadeJunior = run.snapshot.speed;
    // Um jogador atento: pula quando a distância mais próxima chega.
    while (run.snapshot.score < 300 && run.snapshot.phase === "running") {
      const { obstacles, runner } = run.snapshot;
      const proxima = obstacles.find((obstacle) => obstacle.x > runner.x - 10);
      if (proxima && proxima.x - runner.x < 80 && runner.y === 0) run.jump();
      run.tick(16);
    }
    expect(run.snapshot.phase).toBe("running");
    expect(run.snapshot.level).toBe(2);
    expect(run.snapshot.speed).toBeGreaterThan(velocidadeJunior);
  });

  it("o passo do relógio é limitado: uma aba que ficou parada não teletransporta a pessoa para dentro de uma distância", () => {
    const run = new CareerRun(semAleatoriedade(0.99));
    run.jump();
    run.tick(5000);
    expect(run.snapshot.distance).toBeLessThanOrEqual(50 * run.snapshot.speed + 0.001);
  });
});
