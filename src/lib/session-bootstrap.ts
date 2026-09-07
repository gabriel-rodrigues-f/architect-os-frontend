import type { SessionUser } from "./api";
import { ApiError } from "./api-errors";
import { ServiceHeartbeat } from "../components/app/ServiceOutageScreen";

export type SessionBootstrapKind = "reading" | "open" | "absent" | "serviceDown";

/**
 * O que a aplicação SABE sobre a sessão ao abrir (dono, 2026-09-07: "derrubei
 * o backend… quando atualizei a tela fui deslogado. isso não pode ocorrer,
 * somente se o token do frontend expirar").
 *
 * A leitura de `/auth/me` da montagem tem quatro desfechos, e só um deles é
 * "não há sessão": o 401. Rede sem resposta, porta sem serviço, 500, corpo
 * ilegível — nada disso diz que o cookie morreu; diz que a aplicação NÃO
 * SABE. Enquanto não sabe, não decide: fica em `serviceDown`, e pergunta de
 * novo até o serviço responder.
 */
export class SessionBootstrap {
  private static readonly ABSENT_STATUS = 401;

  private constructor(
    readonly kind: SessionBootstrapKind,
    readonly user: SessionUser | null,
  ) {}

  static reading(): SessionBootstrap {
    return new SessionBootstrap("reading", null);
  }

  static open(user: SessionUser): SessionBootstrap {
    return new SessionBootstrap("open", user);
  }

  static absent(): SessionBootstrap {
    return new SessionBootstrap("absent", null);
  }

  static serviceDown(): SessionBootstrap {
    return new SessionBootstrap("serviceDown", null);
  }

  /** A sessão como a aplicação a conhece DEPOIS da montagem: aberta ou ausente. */
  static of(user: SessionUser | null): SessionBootstrap {
    return user === null ? SessionBootstrap.absent() : SessionBootstrap.open(user);
  }

  /** Só o 401 é ausência de sessão. Qualquer outra falha é o serviço fora. */
  static afterFailure(error: unknown): SessionBootstrap {
    return error instanceof ApiError && error.status === SessionBootstrap.ABSENT_STATUS
      ? SessionBootstrap.absent()
      : SessionBootstrap.serviceDown();
  }

  get loading(): boolean {
    return this.kind === "reading";
  }

  get isServiceDown(): boolean {
    return this.kind === "serviceDown";
  }
}

/**
 * Quem lê a sessão na montagem e INSISTE enquanto o serviço está fora — no
 * mesmo pulso da tela de queda (`ServiceHeartbeat`). Recebe a leitura e o
 * ouvinte por injeção para ser provado com relógio falso; o relógio é lido
 * na hora de agendar (não na construção) pelo mesmo motivo.
 */
export class SessionBootstrapReader {
  static readonly RETRY_INTERVAL_MS = ServiceHeartbeat.INTERVAL_MS;

  private scheduled: ReturnType<typeof setTimeout> | null = null;

  private stopped = false;

  private attempt = 0;

  constructor(
    private readonly read: () => Promise<SessionUser>,
    private readonly onChange: (bootstrap: SessionBootstrap) => void,
  ) {}

  start(): void {
    this.stopped = false;
    this.attemptNow();
  }

  /** A pessoa apertou Recarregar: lê na hora e descarta a tentativa agendada. */
  retryNow(): void {
    if (this.stopped) return;
    this.cancelScheduled();
    this.attemptNow();
  }

  stop(): void {
    this.stopped = true;
    this.attempt += 1;
    this.cancelScheduled();
  }

  private attemptNow(): void {
    const attempt = ++this.attempt;
    this.read().then(
      (user) => this.settle(attempt, SessionBootstrap.open(user)),
      (error: unknown) => this.settle(attempt, SessionBootstrap.afterFailure(error)),
    );
  }

  private settle(attempt: number, bootstrap: SessionBootstrap): void {
    if (this.stopped || attempt !== this.attempt) return;
    this.onChange(bootstrap);
    if (bootstrap.isServiceDown) this.scheduleRetry();
  }

  private scheduleRetry(): void {
    this.cancelScheduled();
    this.scheduled = setTimeout(() => {
      this.scheduled = null;
      this.attemptNow();
    }, SessionBootstrapReader.RETRY_INTERVAL_MS);
  }

  private cancelScheduled(): void {
    if (this.scheduled === null) return;
    clearTimeout(this.scheduled);
    this.scheduled = null;
  }
}
