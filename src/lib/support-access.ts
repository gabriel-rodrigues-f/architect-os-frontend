import { ApiError } from "./api-errors";
import { RefusalNumber } from "./refusal-number";

/**
 * O MODO DE SUPORTE (revisão de papéis, 2026-09-05, D1): o suporte não lê
 * sobre pessoas por rotina; quando abre a ficha de alguém, declara o motivo,
 * e a API grava cada requisição no audit_log e avisa o time.
 *
 * PR 6 (revisão mestre 2026-09-08, RBAC-03 e [FA-07]): o passe tem VALIDADE
 * — 15 minutos a partir do motivo declarado, espelho do `SupportPass` do
 * backend — e só viaja nas requisições SOBRE A PESSOA do passe. Antes era
 * estado estático de módulo, ia em toda requisição (Painel, Usuários,
 * Configurações) e sobrevivia ao logout. Agora é uma instância do
 * `FrontendContainer`: quem fecha a sessão apaga o passe.
 */
export class SupportPass {
  static readonly VALIDITY_MINUTES = 15;

  private static readonly VALIDITY_MS = SupportPass.VALIDITY_MINUTES * 60 * 1000;

  constructor(
    readonly professionalId: string,
    readonly reason: string,
    readonly issuedAt: Date,
  ) {}

  get expiresAt(): Date {
    return new Date(this.issuedAt.getTime() + SupportPass.VALIDITY_MS);
  }

  isExpiredAt(now: Date): boolean {
    return now.getTime() > this.expiresAt.getTime();
  }

  /**
   * A requisição é SOBRE a pessoa quando o id dela é um segmento do caminho
   * (`/professionals/ana`, `/professionals/ana/deactivate`) ou o valor de um
   * parâmetro de consulta (`?professionalId=ana`, `&menteeId=ana`). Parte de
   * outro id (`/professionals/anabela`) não conta.
   */
  isAbout(resource: string): boolean {
    return resource
      .split(/[/?&=]/)
      .some((segment) => decodeURIComponent(segment) === this.professionalId);
  }

  headers(): Record<string, string> {
    return {
      [SupportAccess.PROFESSIONAL_HEADER]: this.professionalId,
      [SupportAccess.REASON_HEADER]: this.reason,
      [SupportAccess.ISSUED_AT_HEADER]: this.issuedAt.toISOString(),
    };
  }
}

export class SupportAccess {
  static readonly PROFESSIONAL_HEADER = "x-support-professional";
  static readonly REASON_HEADER = "x-support-reason";
  static readonly ISSUED_AT_HEADER = "x-support-issued-at";
  static readonly MIN_REASON_LENGTH = 12;
  /** A recusa (403) do serviço quando o passe venceu — a tela renova pelo diálogo. */
  static readonly EXPIRED_CODE = "SUPPORT_PASS_EXPIRED";

  private current: SupportPass | null = null;

  private expiredHandler: (() => void) | null = null;

  constructor(private readonly clock: () => Date = () => new Date()) {}

  grant(professionalId: string, reason: string): SupportPass | null {
    const trimmed = reason.trim();
    if (trimmed.length < SupportAccess.MIN_REASON_LENGTH) return null;
    this.current = new SupportPass(professionalId, trimmed, this.clock());
    return this.current;
  }

  /** O passe desta pessoa, enquanto vale para a tela — vencido, é como se não existisse. */
  grantedFor(professionalId: string): SupportPass | null {
    const pass = this.current;
    if (!pass || pass.professionalId !== professionalId) return null;
    return pass.isExpiredAt(this.clock()) ? null : pass;
  }

  clear(): void {
    this.current = null;
  }

  /**
   * Os cabeçalhos da requisição `resource` — só quando ela é sobre a pessoa
   * do passe. Passe vencido ainda viaja: é o SERVIDOR quem o julga, e a
   * recusa dele (`SUPPORT_PASS_EXPIRED`) é o que reabre o diálogo.
   */
  headersFor(resource: string): Record<string, string> {
    const pass = this.current;
    if (!pass || !pass.isAbout(resource)) return {};
    return pass.headers();
  }

  /** Quem reabre o diálogo quando o serviço diz que o passe venceu. */
  whenExpired(handler: (() => void) | null): void {
    this.expiredHandler = handler;
  }

  reviewFailure(error: unknown): void {
    if (!SupportAccess.isExpiredRefusal(error)) return;
    this.clear();
    this.expiredHandler?.();
  }

  /**
   * REGRA 18 (dono, 2026-09-09): o passe vencido é recusa de **ATO** e fica em
   * 403. Ela fala do passe do PRÓPRIO ator — não conta a existência da pessoa
   * cuja ficha ele abriu. Virar 404 pararia de apagar o passe e de reabrir o
   * diálogo de motivo: o suporte ficaria olhando uma ficha que não carrega,
   * sem entender por quê. Casa status **e** código porque o código nomeia
   * este mecanismo, não a família da recusa.
   */
  private static isExpiredRefusal(error: unknown): boolean {
    return (
      RefusalNumber.isAct(error) &&
      error instanceof ApiError &&
      error.code === SupportAccess.EXPIRED_CODE
    );
  }
}
