import { BrowserMemory } from "./browser-memory";
import type { MessageKey } from "./i18n";

export type SessionEndReasonKind = "manual" | "idle" | "expired";

/**
 * POR QUE A SESSÃO ACABOU (PR 9, [FA-01]/[FA-02]). Três razões, e só duas
 * pedem explicação na tela de login: a pessoa que apertou "Sair" sabe por que
 * está no login; quem foi derrubado por inatividade ou pela expiração do
 * cookie encontrava a porta muda — mesmo relato que gerou `5b26c41`.
 *
 * A razão é um VALOR fechado: cada uma leva a própria chave de tradução, e
 * quem desenha a tela nunca escreve texto por conta própria (o toast em
 * português fixo de antes morreu aqui).
 */
export class SessionEndReason {
  static readonly manual = new SessionEndReason("manual", null);

  static readonly idle = new SessionEndReason("idle", "login.sessionEnded.idle");

  static readonly expired = new SessionEndReason("expired", "login.sessionEnded.expired");

  private static readonly ALL: readonly SessionEndReason[] = [
    SessionEndReason.manual,
    SessionEndReason.idle,
    SessionEndReason.expired,
  ];

  private constructor(
    readonly kind: SessionEndReasonKind,
    readonly messageKey: MessageKey | null,
  ) {}

  /** A razão que o login precisa contar — "Sair" não conta nada. */
  get explainsItself(): boolean {
    return this.messageKey !== null;
  }

  /** Reconstrói a razão guardada; o que não é razão conhecida vira `null`. */
  static of(kind: string | null): SessionEndReason | null {
    return SessionEndReason.ALL.find((reason) => reason.kind === kind) ?? null;
  }
}

/**
 * A MEMÓRIA DA ABA: a razão sobrevive à troca de tela e ao F5 (molde de
 * `DashboardEntrance`), nunca por texto de URL. Só razões que explicam são
 * guardadas; "Sair" apaga qualquer razão anterior — a tela de login depois
 * do logout manual nasce limpa. A memória é consumida por quem abre a
 * sessão de novo (`AuthProvider`), não pela leitura: assim o F5 no login
 * ainda encontra a frase.
 */
export class SessionEndMemory {
  static readonly STORAGE_KEY = "synapse:session-end-reason";

  constructor(
    private readonly memory: BrowserMemory = new BrowserMemory(() => window.sessionStorage),
  ) {}

  remember(reason: SessionEndReason): void {
    if (!reason.explainsItself) {
      this.clear();
      return;
    }
    this.memory.write(SessionEndMemory.STORAGE_KEY, reason.kind);
  }

  recall(): SessionEndReason | null {
    const reason = SessionEndReason.of(this.memory.read(SessionEndMemory.STORAGE_KEY));
    return reason?.explainsItself ? reason : null;
  }

  clear(): void {
    this.memory.forget(SessionEndMemory.STORAGE_KEY);
  }
}

export const sessionEndMemory = new SessionEndMemory();
