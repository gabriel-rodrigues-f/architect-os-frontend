import { describe, expect, it } from "vitest";

import { ApiError } from "@/lib/api-errors";
import {
  PASSWORD_REQUIREMENTS,
  PASSWORD_REQUIREMENT_ITEM,
  PASSWORD_REQUIREMENT_REFUSAL,
  PasswordRefusal,
  SafePassword,
  type PasswordRequirement,
} from "@/lib/password-safety";
import en from "@/locales/en.json";
import pt from "@/locales/pt.json";

/**
 * A regra do dono (2026-09-03), literal: *"a senha precisa ser segura. mínimo
 * 8 caracteres sendo eles no mínimo: 1 maiúscula, 1 número, 1 minúscula, 1
 * símbolo, não pode conter 1234 e nem o próprio e-mail."*
 *
 * Sete exigências, e a tela precisa saber dizer qual delas ainda falta ANTES
 * de a pessoa apanhar do formulário. Cada uma é medida aqui contra a senha
 * que a viola e contra a senha que só ela salva.
 */

const EMAIL = "ana.martins@empresa.com";

/** Uma senha que atende às sete — o ponto de partida de cada violação. */
const SENHA_BOA = "Vento#Sul7";

describe("a senha segura sabe o que ainda falta", () => {
  it("a senha que atende às sete não deixa nada pendente", () => {
    const leitura = SafePassword.of(SENHA_BOA, EMAIL);
    expect(leitura.pending).toEqual([]);
    expect(leitura.safe).toBe(true);
  });

  /**
   * Campo em branco é o estado ANTES de digitar. Marcar "não tem 1234" como
   * atendida numa senha vazia diria que a pessoa já chegou em algum lugar sem
   * ter dado o primeiro passo.
   */
  it("com o campo em branco nenhuma exigência aparece atendida", () => {
    const leitura = SafePassword.of("", EMAIL);
    expect(leitura.pending).toEqual([...PASSWORD_REQUIREMENTS]);
    expect(leitura.safe).toBe(false);
  });

  const VIOLACOES: ReadonlyArray<readonly [PasswordRequirement, string]> = [
    ["minimum-length", "Ven#7ab"],
    ["uppercase-letter", "vento#sul7"],
    ["lowercase-letter", "VENTO#SUL7"],
    ["digit", "Vento#Sull"],
    ["symbol", "VentoSul77"],
    ["obvious-sequence", "Vento#S1234"],
    ["own-email", "Ana.Martins#7"],
  ];

  for (const [exigencia, senha] of VIOLACOES) {
    it(`aponta '${exigencia}' — e SÓ ela — na senha que a viola`, () => {
      expect(SafePassword.of(senha, EMAIL).pending).toEqual([exigencia]);
    });
  }

  it("a senha mínima tem exatamente 8 caracteres, como o dono pediu", () => {
    expect(SafePassword.MINIMUM_LENGTH).toBe(8);
    expect(SafePassword.of("Ab#7abcd", EMAIL).meets("minimum-length")).toBe(true);
    expect(SafePassword.of("Ab#7abc", EMAIL).meets("minimum-length")).toBe(false);
  });

  /** O nome antes do arroba é a mesma pista que o e-mail inteiro. */
  it("o e-mail inteiro e o nome antes do arroba contam igual", () => {
    expect(SafePassword.of(`Norte#7${EMAIL}`, EMAIL).meets("own-email")).toBe(false);
    expect(SafePassword.of("Norte#7ana.martins", EMAIL).meets("own-email")).toBe(false);
    expect(SafePassword.of("Norte#7ANA.MARTINS", EMAIL).meets("own-email")).toBe(false);
  });

  /** Sem esta borda, um e-mail curto proibiria duas letras quaisquer. */
  it("trecho curto demais do e-mail não vira proibição", () => {
    expect(SafePassword.of("Vento#Sul7", "bi@empresa.com").meets("own-email")).toBe(true);
  });

  it("sem e-mail nenhum a exigência do e-mail não trava a pessoa", () => {
    expect(SafePassword.of(SENHA_BOA, "").meets("own-email")).toBe(true);
  });
});

/**
 * A LEITURA DE QUEM CHEGA PELO LINK (onda da recuperação de acesso,
 * 2026-09-04). Ali não há sessão e o token é opaco: o e-mail da pessoa
 * simplesmente não está naquela tela.
 *
 * As duas saídas fáceis são as duas mentiras. Dar a exigência como atendida
 * põe um tique verde sobre uma senha que pode ser o e-mail inteiro; dá-la
 * como pendente desenha uma linha vermelha que nunca fecha. A terceira é a
 * honesta: a exigência continua à vista, declarada como NÃO CONFERÍVEL AQUI,
 * e quem confere é o serviço.
 */
describe("a senha escolhida sem o e-mail à mão", () => {
  it("a exigência do próprio e-mail não é dada como atendida", () => {
    const leitura = SafePassword.withoutKnownEmail(SENHA_BOA);

    expect(leitura.meets("own-email")).toBe(false);
    expect(leitura.cannotMeasure("own-email")).toBe(true);
    expect(leitura.unmeasured).toEqual(["own-email"]);
  });

  it("nem é dada como pendente — ela não está na fila do que a pessoa precisa consertar", () => {
    expect(SafePassword.withoutKnownEmail(SENHA_BOA).pending).toEqual([]);
  });

  it("as outras seis continuam medidas normalmente", () => {
    const semSimbolo = SafePassword.withoutKnownEmail("VentoSul77");

    expect(semSimbolo.pending).toEqual(["symbol"]);
    expect(semSimbolo.meets("minimum-length")).toBe(true);
    expect(semSimbolo.meets("digit")).toBe(true);
  });

  it("campo em branco continua sendo o estado antes de digitar", () => {
    const leitura = SafePassword.withoutKnownEmail("");

    expect(leitura.pending).toEqual(
      PASSWORD_REQUIREMENTS.filter((exigencia) => exigencia !== "own-email"),
    );
    expect(leitura.cannotMeasure("own-email")).toBe(true);
  });

  /** O que esta tela não consegue medir não conta como senha de pé. */
  it("nenhuma senha é declarada segura por aqui — a palavra final é do serviço", () => {
    expect(SafePassword.withoutKnownEmail(SENHA_BOA).safe).toBe(false);
  });

  /** A leitura COM e-mail não ganhou buraco nenhum: ela mede as sete. */
  it("com o e-mail à mão nada fica sem medir", () => {
    expect(SafePassword.of(SENHA_BOA, EMAIL).unmeasured).toEqual([]);
    expect(SafePassword.of(SENHA_BOA, EMAIL).cannotMeasure("own-email")).toBe(false);
  });
});

describe("a recusa do backend vira a exigência exata", () => {
  const recusaFraca = (requirement: unknown) =>
    new ApiError("recusado", 400, { requirement }, PasswordRefusal.WEAK_PASSWORD_CODE);

  for (const exigencia of PASSWORD_REQUIREMENTS) {
    it(`lê '${exigencia}' de details.requirement e escolhe a frase dela`, () => {
      const leitura = PasswordRefusal.of(recusaFraca(exigencia));
      expect(leitura.reason).toBe("weak");
      expect(leitura.requirement).toBe(exigencia);
      expect(leitura.messageKey).toBe(PASSWORD_REQUIREMENT_REFUSAL[exigencia]);
    });
  }

  it("senha atual errada é recusa de negócio, não de senha fraca", () => {
    const leitura = PasswordRefusal.of(
      new ApiError("recusado", 401, undefined, PasswordRefusal.INVALID_CURRENT_PASSWORD_CODE),
    );
    expect(leitura.reason).toBe("wrongCurrentPassword");
    expect(leitura.requirement).toBeNull();
    expect(leitura.messageKey).toBe("password.refused.currentPassword");
  });

  it("senha fraca sem exigência nomeada ainda manda a pessoa para a lista", () => {
    expect(PasswordRefusal.of(recusaFraca(undefined)).messageKey).toBe("password.refused.weak");
    expect(PasswordRefusal.of(recusaFraca("exigencia-que-nao-existe")).requirement).toBeNull();
  });

  /**
   * Fora dos dois códigos do contrato a tela NÃO inventa frase: devolve
   * `null` e quem chama cai na frase da situação (`ApiFailureReading`).
   */
  it("recusa fora do contrato não ganha frase inventada", () => {
    expect(PasswordRefusal.of(new ApiError("fora do ar", 500)).messageKey).toBeNull();
    expect(PasswordRefusal.of(new TypeError("erro de programa")).reason).toBe("other");
    expect(PasswordRefusal.of(undefined).reason).toBe("other");
  });
});

describe("as sete exigências têm texto nos dois idiomas", () => {
  const dicionarios: ReadonlyArray<readonly [string, Record<string, string>]> = [
    ["pt", pt as Record<string, string>],
    ["en", en as Record<string, string>],
  ];

  for (const [idioma, dicionario] of dicionarios) {
    it(`o ${idioma} tem item de lista e frase de recusa para as sete`, () => {
      const faltando = PASSWORD_REQUIREMENTS.flatMap((exigencia) =>
        [PASSWORD_REQUIREMENT_ITEM[exigencia], PASSWORD_REQUIREMENT_REFUSAL[exigencia]].filter(
          (chave) => !(chave in dicionario),
        ),
      );
      expect(faltando).toEqual([]);
    });
  }
});
