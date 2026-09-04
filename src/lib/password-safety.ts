import { ApiError } from "./api-errors";
import type { MessageKey } from "./i18n";

/**
 * A senha segura do primeiro acesso — o que ela precisa ter, e o que ainda falta.
 *
 * Regra do dono (2026-09-03), literal: *"ao realizar o primeiro acesso, o
 * usuário (regra universal) precisa ter que alterar sua senha. a senha precisa
 * ser segura. mínimo 8 caracteres sendo eles no mínimo: 1 maiúscula, 1 número,
 * 1 minúscula, 1 símbolo, não pode conter 1234 e nem o próprio e-mail."*
 *
 * QUEM DECIDE É O BACKEND. Ele já recusa com `WEAK_PASSWORD` e
 * `details.requirement` — um dos sete nomes abaixo, que é o contrato medido.
 * Esta classe existe para a outra metade do pedido: *as exigências à vista,
 * ANTES de errar*. Ela lê a senha enquanto a pessoa digita e diz quais
 * exigências já estão de pé, para ninguém descobrir a régua só depois de
 * apanhar do formulário.
 *
 * Por isso a leitura local NUNCA tranca o botão: se ela e o backend
 * discordarem numa borda (o que conta como "sequência óbvia", o quanto do
 * e-mail conta como "o próprio e-mail"), quem manda é o serviço, e a pessoa
 * segue podendo enviar. A lista é orientação; a recusa é do backend, e
 * `PasswordRefusal` a traduz de volta para a exigência exata.
 */
export const PASSWORD_REQUIREMENTS = [
  "minimum-length",
  "uppercase-letter",
  "lowercase-letter",
  "digit",
  "symbol",
  "obvious-sequence",
  "own-email",
] as const;

export type PasswordRequirement = (typeof PASSWORD_REQUIREMENTS)[number];

/** O item da lista que a pessoa lê enquanto digita — fragmento, não frase. */
export const PASSWORD_REQUIREMENT_ITEM: Readonly<Record<PasswordRequirement, MessageKey>> = {
  "minimum-length": "password.requirement.minimumLength",
  "uppercase-letter": "password.requirement.uppercaseLetter",
  "lowercase-letter": "password.requirement.lowercaseLetter",
  digit: "password.requirement.digit",
  symbol: "password.requirement.symbol",
  "obvious-sequence": "password.requirement.obviousSequence",
  "own-email": "password.requirement.ownEmail",
};

/** A frase inteira, para quando o backend recusa apontando esta exigência. */
export const PASSWORD_REQUIREMENT_REFUSAL: Readonly<Record<PasswordRequirement, MessageKey>> = {
  "minimum-length": "password.refused.minimumLength",
  "uppercase-letter": "password.refused.uppercaseLetter",
  "lowercase-letter": "password.refused.lowercaseLetter",
  digit: "password.refused.digit",
  symbol: "password.refused.symbol",
  "obvious-sequence": "password.refused.obviousSequence",
  "own-email": "password.refused.ownEmail",
};

export class SafePassword {
  static readonly MINIMUM_LENGTH = 8;

  /** O trecho mais curto do e-mail que ainda é "o próprio e-mail" dentro da senha. */
  private static readonly SHORTEST_EMAIL_TRACE = 3;

  private static readonly UPPERCASE = /\p{Lu}/u;
  private static readonly LOWERCASE = /\p{Ll}/u;
  private static readonly DIGIT = /\d/;
  private static readonly SYMBOL = /[^\p{L}\p{N}]/u;
  private static readonly OBVIOUS_SEQUENCE = /1234/;

  /** A exigência que só o e-mail da pessoa permite medir. */
  private static readonly MEASURED_BY_THE_EMAIL: PasswordRequirement = "own-email";

  private constructor(
    private readonly unmet: ReadonlySet<PasswordRequirement>,
    private readonly unmeasurable: ReadonlySet<PasswordRequirement>,
  ) {}

  /**
   * Senha vazia é o estado ANTES de digitar: nenhuma exigência está de pé,
   * nem as duas que uma senha vazia satisfaria por vacuidade. Marcar "não tem
   * 1234" como atendida num campo em branco seria dizer que a pessoa já
   * chegou em algum lugar sem ter dado o primeiro passo.
   */
  static of(password: string, email: string): SafePassword {
    if (password === "") return new SafePassword(new Set(PASSWORD_REQUIREMENTS), new Set());
    return new SafePassword(
      new Set(
        PASSWORD_REQUIREMENTS.filter(
          (requirement) => !SafePassword.satisfies(requirement, password, email),
        ),
      ),
      new Set(),
    );
  }

  /**
   * A leitura de quem chega pelo LINK do convite. Ali não há sessão e o token
   * é opaco: o e-mail da pessoa simplesmente NÃO está naquela tela, e a única
   * exigência que depende dele deixa de ser mensurável aqui.
   *
   * Dar a exigência como atendida seria mentir com um tique verde — a pessoa
   * leria "não ter o seu e-mail dentro dela: já atendido" sobre uma senha que
   * é o e-mail dela inteiro. Dá-la como pendente seria o outro extremo: uma
   * linha vermelha que nunca fecha, por mais que a pessoa acerte. Então ela é
   * declarada NÃO CONFERÍVEL AQUI, a exigência continua à vista, e quem
   * confere é o serviço — que recusa apontando `own-email` e cai na mesma
   * `PasswordRefusal` do primeiro acesso.
   */
  static withoutKnownEmail(password: string): SafePassword {
    const measured = SafePassword.of(password, "");
    return new SafePassword(
      new Set(measured.pending.filter((req) => req !== SafePassword.MEASURED_BY_THE_EMAIL)),
      new Set([SafePassword.MEASURED_BY_THE_EMAIL]),
    );
  }

  private static satisfies(
    requirement: PasswordRequirement,
    password: string,
    email: string,
  ): boolean {
    switch (requirement) {
      case "minimum-length":
        return password.length >= SafePassword.MINIMUM_LENGTH;
      case "uppercase-letter":
        return SafePassword.UPPERCASE.test(password);
      case "lowercase-letter":
        return SafePassword.LOWERCASE.test(password);
      case "digit":
        return SafePassword.DIGIT.test(password);
      case "symbol":
        return SafePassword.SYMBOL.test(password);
      case "obvious-sequence":
        return !SafePassword.OBVIOUS_SEQUENCE.test(password);
      case "own-email":
        return !SafePassword.echoesEmail(password, email);
    }
  }

  /**
   * O e-mail inteiro e o nome antes do arroba contam igual: `ana@empresa.com`
   * e `ana` são a mesma pista para quem tenta adivinhar. Trecho curto demais
   * (`bi@…`) não conta — viraria proibição de duas letras quaisquer.
   */
  private static echoesEmail(password: string, email: string): boolean {
    const address = email.trim().toLowerCase();
    if (address === "") return false;
    const candidate = password.toLowerCase();
    if (candidate.includes(address)) return true;
    const localPart = address.split("@")[0] ?? "";
    return localPart.length >= SafePassword.SHORTEST_EMAIL_TRACE && candidate.includes(localPart);
  }

  meets(requirement: PasswordRequirement): boolean {
    return !this.unmet.has(requirement) && !this.unmeasurable.has(requirement);
  }

  /** A exigência existe, está à vista, e esta tela não tem como medi-la. */
  cannotMeasure(requirement: PasswordRequirement): boolean {
    return this.unmeasurable.has(requirement);
  }

  /** As exigências que ainda faltam, na ordem em que a lista as mostra. */
  get pending(): readonly PasswordRequirement[] {
    return PASSWORD_REQUIREMENTS.filter((requirement) => this.unmet.has(requirement));
  }

  /** As exigências que esta tela não consegue conferir, na ordem da lista. */
  get unmeasured(): readonly PasswordRequirement[] {
    return PASSWORD_REQUIREMENTS.filter((requirement) => this.unmeasurable.has(requirement));
  }

  get safe(): boolean {
    return this.unmet.size === 0 && this.unmeasurable.size === 0;
  }
}

export type PasswordRefusalReason = "weak" | "wrongCurrentPassword" | "other";

/**
 * A recusa do backend, lida como fato de negócio.
 *
 * O contrato medido: **400** `WEAK_PASSWORD` com `details.requirement` num dos
 * sete nomes, e **401** `INVALID_CURRENT_PASSWORD`. A senha nova fraca responde
 * ANTES da senha atual errada, então uma recusa por vez é o suficiente.
 *
 * A frase é NOSSA, não a do serviço, e é a única exceção da casa à regra "quem
 * fala é o serviço": o backend só escreve pt-BR, e esta tela também existe em
 * inglês. Repetir a frase do serviço mostraria português a quem escolheu
 * inglês — pior do que a duplicação que a regra evita. Fora dos dois códigos
 * conhecidos, a leitura devolve `null` e quem chama cai na frase da situação
 * (`ApiFailureReading`, via `authErrorMessage`).
 */
export class PasswordRefusal {
  static readonly WEAK_PASSWORD_CODE = "WEAK_PASSWORD";

  static readonly INVALID_CURRENT_PASSWORD_CODE = "INVALID_CURRENT_PASSWORD";

  private constructor(
    readonly reason: PasswordRefusalReason,
    readonly requirement: PasswordRequirement | null,
  ) {}

  static of(error: unknown): PasswordRefusal {
    if (!(error instanceof ApiError)) return new PasswordRefusal("other", null);
    if (error.code === PasswordRefusal.INVALID_CURRENT_PASSWORD_CODE) {
      return new PasswordRefusal("wrongCurrentPassword", null);
    }
    if (error.code === PasswordRefusal.WEAK_PASSWORD_CODE) {
      return new PasswordRefusal("weak", PasswordRefusal.requirementIn(error.details));
    }
    return new PasswordRefusal("other", null);
  }

  private static requirementIn(details: unknown): PasswordRequirement | null {
    if (typeof details !== "object" || details === null) return null;
    const named = (details as { requirement?: unknown }).requirement;
    if (typeof named !== "string") return null;
    return (PASSWORD_REQUIREMENTS as readonly string[]).includes(named)
      ? (named as PasswordRequirement)
      : null;
  }

  /** A chave da frase a mostrar, ou `null` quando a tela deve usar a da situação. */
  get messageKey(): MessageKey | null {
    if (this.reason === "wrongCurrentPassword") return "password.refused.currentPassword";
    if (this.requirement !== null) return PASSWORD_REQUIREMENT_REFUSAL[this.requirement];
    if (this.reason === "weak") return "password.refused.weak";
    return null;
  }
}
