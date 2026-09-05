/**
 * O MODO DE SUPORTE do administrador (revisão de papéis, 2026-09-05, D1): o
 * admin não lê sobre pessoas por rotina; quando abre a ficha de alguém,
 * declara o motivo, e a API grava cada requisição no audit_log e avisa o time.
 * O motivo vive só nesta sessão do navegador e vai em dois cabeçalhos.
 */
export interface SupportAccessGrant {
  readonly architectId: string;
  readonly reason: string;
}

export class SupportAccess {
  static readonly ARCHITECT_HEADER = "x-support-architect";
  static readonly REASON_HEADER = "x-support-reason";
  static readonly MIN_REASON_LENGTH = 12;

  private static current: SupportAccessGrant | null = null;

  static grant(architectId: string, reason: string): SupportAccessGrant | null {
    const trimmed = reason.trim();
    if (trimmed.length < SupportAccess.MIN_REASON_LENGTH) return null;
    SupportAccess.current = { architectId, reason: trimmed };
    return SupportAccess.current;
  }

  static grantedFor(architectId: string): SupportAccessGrant | null {
    return SupportAccess.current?.architectId === architectId ? SupportAccess.current : null;
  }

  static clear(): void {
    SupportAccess.current = null;
  }

  /** Os cabeçalhos que toda requisição leva enquanto o modo está ativo. */
  static headers(): Record<string, string> {
    const grant = SupportAccess.current;
    if (!grant) return {};
    return {
      [SupportAccess.ARCHITECT_HEADER]: grant.architectId,
      [SupportAccess.REASON_HEADER]: grant.reason,
    };
  }
}
