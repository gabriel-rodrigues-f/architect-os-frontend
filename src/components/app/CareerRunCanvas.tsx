import { useEffect, useRef, useState } from "react";

import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { BestScore, CareerRun, CareerRunWords, RUNNER_X, TRACK_WIDTH } from "@/lib/career-run";
import { LiveCanvasLoop, ThemeTokens } from "@/lib/live-canvas";

const TRACK_HEIGHT = 150;
const GROUND_Y = TRACK_HEIGHT - 24;

/** O pincel: lê as cores dos tokens da própria aplicação e desenha um quadro do motor. */
class CareerRunPainter {
  static tokens(canvas: HTMLCanvasElement | null): { fg: string; muted: string; levels: string[] } {
    const tokens = ThemeTokens.of(canvas ?? document.documentElement);
    return {
      fg: tokens.read("--foreground", "#e5e7eb"),
      muted: tokens.read("--muted-foreground", "#9ca3af"),
      levels: [
        tokens.read("--level-2", "#f4d35e"),
        tokens.read("--level-3", "#8ecf9f"),
        tokens.read("--level-5", "#7cb8ff"),
      ],
    };
  }

  static draw(
    context: CanvasRenderingContext2D,
    run: CareerRun,
    colors: ReturnType<typeof CareerRunPainter.tokens>,
  ): void {
    const { runner, obstacles, pickups, level, phase, distance } = run.snapshot;
    const levelColor = colors.levels[level - 1] ?? colors.levels[0]!;
    context.clearRect(0, 0, TRACK_WIDTH, TRACK_HEIGHT);
    // A pista, na cor do nível.
    context.strokeStyle = levelColor;
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(0, GROUND_Y + 0.5);
    context.lineTo(TRACK_WIDTH, GROUND_Y + 0.5);
    context.stroke();
    // As distâncias: blocos que a pessoa precisa pular.
    context.fillStyle = colors.muted;
    for (const obstacle of obstacles) {
      context.fillRect(obstacle.x, GROUND_Y - obstacle.height, obstacle.width, obstacle.height);
    }
    // As evidências: losangos flutuando.
    context.fillStyle = levelColor;
    for (const pickup of pickups) {
      if (pickup.taken) continue;
      const cx = pickup.x;
      const cy = GROUND_Y - pickup.y;
      context.beginPath();
      context.moveTo(cx, cy - 7);
      context.lineTo(cx + 7, cy);
      context.lineTo(cx, cy + 7);
      context.lineTo(cx - 7, cy);
      context.closePath();
      context.fill();
    }
    // A pessoa: um arquiteto estilizado — cabeça, tronco, pernas.
    const baseY = GROUND_Y - runner.y;
    const centerX = RUNNER_X + runner.width / 2;
    context.fillStyle = colors.fg;
    context.beginPath();
    context.arc(centerX, baseY - runner.height + 7, 7, 0, Math.PI * 2);
    context.fill();
    context.fillRect(centerX - 5, baseY - runner.height + 14, 10, 16);
    const stride = phase === "running" && runner.y === 0 ? Math.sin(distance / 18) * 6 : 0;
    context.fillRect(centerX - 6 + stride, baseY - 10, 4, 10);
    context.fillRect(centerX + 2 - stride, baseY - 10, 4, 10);
  }
}

/**
 * O "dinossauro" do Synapse, desenhado. O motor é o `CareerRun`; este
 * componente só liga o relógio do navegador (`LiveCanvasLoop`, o mesmo da
 * rede de sinapses do login), o teclado, o toque e o pincel.
 * Com `prefers-reduced-motion`, não anima: mostra a figura parada e a frase.
 */
export function CareerRunCanvas() {
  const reducedMotion = useReducedMotion();
  const words = CareerRunWords.for(typeof navigator === "undefined" ? [] : navigator.languages);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const runRef = useRef(new CareerRun());
  const [status, setStatus] = useState({
    phase: "ready" as string,
    score: 0,
    level: 1,
    evidences: 0,
  });
  const [best, setBest] = useState(0);

  useEffect(() => {
    setBest(BestScore.read());
  }, []);

  useEffect(() => {
    if (reducedMotion) return;
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d") ?? null;
    const run = runRef.current;
    const colors = CareerRunPainter.tokens(canvas);
    let lastPhase = run.snapshot.phase;
    const loop = new LiveCanvasLoop((deltaMs) => {
      run.tick(deltaMs);
      if (context) CareerRunPainter.draw(context, run, colors);
      const { phase, score, level, evidences } = run.snapshot;
      if (phase !== lastPhase || phase === "running") {
        setStatus({ phase, score, level, evidences });
        if (phase === "crashed" && lastPhase !== "crashed") setBest(BestScore.keep(score));
        lastPhase = phase;
      }
    });
    loop.start();
    const onKey = (event: KeyboardEvent) => {
      if (event.code === "Space" || event.code === "ArrowUp") {
        event.preventDefault();
        run.jump();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      loop.stop();
      window.removeEventListener("keydown", onKey);
    };
  }, [reducedMotion]);

  if (reducedMotion) {
    return (
      <figure className="mx-auto max-w-[600px] text-center" data-testid="career-run-still">
        <svg viewBox="0 0 600 150" role="img" aria-label={words.reducedMotion} className="w-full">
          <line x1="0" y1="126" x2="600" y2="126" stroke="currentColor" strokeWidth="2" />
          <rect x="300" y="98" width="24" height="28" fill="currentColor" opacity="0.5" />
          <circle cx="74" cy="93" r="7" fill="currentColor" />
          <rect x="69" y="100" width="10" height="16" fill="currentColor" />
          <rect x="66" y="116" width="4" height="10" fill="currentColor" />
          <rect x="76" y="116" width="4" height="10" fill="currentColor" />
        </svg>
        <figcaption className="mt-2 text-xs text-muted-foreground">
          {words.reducedMotion}
        </figcaption>
      </figure>
    );
  }

  const jump = () => runRef.current.jump();
  return (
    <div className="mx-auto max-w-[600px]">
      <p className="text-sm font-medium text-foreground">{words.title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{words.invite}</p>
      <canvas
        ref={canvasRef}
        width={TRACK_WIDTH}
        height={TRACK_HEIGHT}
        role="img"
        aria-label={words.canvasLabel}
        tabIndex={0}
        onPointerDown={jump}
        className="mt-3 w-full cursor-pointer rounded-md border border-border bg-card text-foreground"
        data-phase={status.phase}
      />
      <dl className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <div>
          <dt className="inline">{words.score}: </dt>
          <dd className="inline tabular-nums" data-testid="career-run-score">
            {status.score}
          </dd>
        </div>
        <div>
          <dt className="inline">{words.evidences}: </dt>
          <dd className="inline tabular-nums">{status.evidences}</dd>
        </div>
        <div>
          <dt className="inline">{words.levels[status.level - 1]}</dt>
          <dd className="sr-only">{status.level}</dd>
        </div>
        <div>
          <dt className="inline">{words.best}: </dt>
          <dd className="inline tabular-nums">{best}</dd>
        </div>
      </dl>
      {status.phase === "crashed" && (
        <p className="mt-2 text-xs text-muted-foreground" role="status">
          {words.crashed}{" "}
          <button type="button" className="underline underline-offset-2" onClick={jump}>
            {words.again}
          </button>
        </p>
      )}
    </div>
  );
}
