import { describe, expect, it } from "vitest";

import { ApiError } from "@/lib/api-errors";
import {
  PASSWORD_CHECKS,
  PASSWORD_CHECK_ITEM,
  PASSWORD_CONFIRMATION_CHECK,
  PASSWORD_REQUIREMENTS,
  PASSWORD_REQUIREMENT_ITEM,
  PASSWORD_REQUIREMENT_REFUSAL,
  PasswordChecklist,
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
 * Oito exigências — a oitava, o espaço no meio, é do dono em 2026-09-08 — e a
 * tela precisa saber dizer qual delas ainda falta ANTES de a pessoa apanhar do
 * formulário. Cada uma é medida aqui contra a senha
 * que a viola e contra a senha que só ela salva.
 */

const EMAIL = "ana.martins@empresa.com";

/** Uma senha que atende às oito — o ponto de partida de cada violação. */
const SENHA_BOA = "Vento# Sul7";

describe("a senha segura sabe o que ainda falta", () => {
  it("a senha que atende às oito não deixa nada pendente", () => {
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
    ["minimum-length", "Ve# 7a"],
    ["uppercase-letter", "vento# sul7"],
    ["lowercase-letter", "VENTO# SUL7"],
    ["digit", "Vento# Sull"],
    ["symbol", "Vento Sul77"],
    ["obvious-sequence", "Vento# S1234"],
    ["own-email", "Ana.Martins# 7"],
  ];

  for (const [exigencia, senha] of VIOLACOES) {
    it(`aponta '${exigencia}' — e SÓ ela — na senha que a viola`, () => {
      expect(SafePassword.of(senha, EMAIL).pending).toEqual([exigencia]);
    });
  }

  it("a senha mínima tem exatamente 8 caracteres, como o dono pediu", () => {
    expect(SafePassword.MINIMUM_LENGTH).toBe(8);
    expect(SafePassword.of("Ab# 7abc", EMAIL).meets("minimum-length")).toBe(true);
    expect(SafePassword.of("Ab# 7ab", EMAIL).meets("minimum-length")).toBe(false);
  });

  /** O nome antes do arroba é a mesma pista que o e-mail inteiro. */
  it("o e-mail inteiro e o nome antes do arroba contam igual", () => {
    expect(SafePassword.of(`Norte# 7${EMAIL}`, EMAIL).meets("own-email")).toBe(false);
    expect(SafePassword.of("Norte# 7ana.martins", EMAIL).meets("own-email")).toBe(false);
    expect(SafePassword.of("Norte# 7ANA.MARTINS", EMAIL).meets("own-email")).toBe(false);
  });

  /** Sem esta borda, um e-mail curto proibiria duas letras quaisquer. */
  it("trecho curto demais do e-mail não vira proibição", () => {
    expect(SafePassword.of("Vento# Sul7", "bi@empresa.com").meets("own-email")).toBe(true);
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

  it("as outras sete continuam medidas normalmente", () => {
    const semSimbolo = SafePassword.withoutKnownEmail("Vento Sul77");

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

  /** A leitura COM e-mail não ganhou buraco nenhum: ela mede as oito. */
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

describe("as oito exigências têm texto nos dois idiomas", () => {
  const dicionarios: ReadonlyArray<readonly [string, Record<string, string>]> = [
    ["pt", pt as Record<string, string>],
    ["en", en as Record<string, string>],
  ];

  for (const [idioma, dicionario] of dicionarios) {
    it(`o ${idioma} tem item de lista e frase de recusa para as oito`, () => {
      const faltando = PASSWORD_REQUIREMENTS.flatMap((exigencia) =>
        [PASSWORD_REQUIREMENT_ITEM[exigencia], PASSWORD_REQUIREMENT_REFUSAL[exigencia]].filter(
          (chave) => !(chave in dicionario),
        ),
      );
      expect(faltando).toEqual([]);
    });
  }
});

/**
 * O ESPELHO DA RÉGUA DO SERVIDOR. Não há fixture compartilhada entre os dois
 * repositórios para a lista de exigências — ela é copiada à mão —, então a
 * lista literal está escrita aqui e no teste gêmeo do backend
 * (`tests/modules/auth/domain/services/forca-da-senha.test.ts`). Divergir
 * derruba um dos dois, que é exatamente o ofício deste caso.
 */
describe("o espelho local tem as mesmas exigências do servidor, na mesma ordem", () => {
  it("as oito, na ordem da recusa", () => {
    expect([...PASSWORD_REQUIREMENTS]).toEqual([
      "minimum-length",
      "uppercase-letter",
      "lowercase-letter",
      "digit",
      "symbol",
      "inner-space",
      "obvious-sequence",
      "own-email",
    ]);
  });

  /** A conferência das duas caixas fecha a lista, e SÓ ela não é do contrato. */
  it("a lista da tela é a do servidor mais a conferência, no fim", () => {
    expect([...PASSWORD_CHECKS]).toEqual([...PASSWORD_REQUIREMENTS, PASSWORD_CONFIRMATION_CHECK]);
  });
});

/**
 * O espaço no meio (dono, 2026-09-08), medido com a mesma régua do servidor:
 * um U+0020 com caractere não-branco dos dois lados.
 */
describe("o espaço no meio da senha", () => {
  const EMAIL_QUALQUER = "quem.digita@empresa.com";
  /** Espaço inquebrável: invisível na tela e impossível de ditar ao telefone. */
  const BRANCO_INVISIVEL = "\u00a0";
  const leitura = (senha: string) => SafePassword.of(senha, EMAIL_QUALQUER);

  it("aceita o espaço entre dois caracteres", () => {
    expect(leitura("Vento# Sul7").meets("inner-space")).toBe(true);
  });

  it("recusa a senha sem espaço nenhum", () => {
    expect(leitura("Vento#Sul7").meets("inner-space")).toBe(false);
    expect(leitura("Vento#Sul7").pending).toEqual(["inner-space"]);
  });

  it("recusa o espaço na ponta", () => {
    expect(leitura(" Vento#Sul7").meets("inner-space")).toBe(false);
    expect(leitura("Vento#Sul7 ").meets("inner-space")).toBe(false);
  });

  it("dois espaços seguidos não fazem um espaço no meio", () => {
    expect(leitura("Vento#  Sul7").meets("inner-space")).toBe(false);
    expect(leitura("Vento#  Sul 7").meets("inner-space")).toBe(true);
  });

  it("branco invisível não vale, nem como espaço nem como vizinho", () => {
    expect(leitura(`Vento#${BRANCO_INVISIVEL}Sul7`).meets("inner-space")).toBe(false);
    expect(leitura(`Vento#${BRANCO_INVISIVEL} ${BRANCO_INVISIVEL}Sul7`).meets("inner-space")).toBe(
      false,
    );
  });

  /**
   * A divergência que o espaço deixaria à mostra: aqui o símbolo já aceitava
   * qualquer não-letra-não-dígito, INCLUSIVE o branco, e o servidor não. Com
   * o espaço virando exigência, "Ventoo Sul77" ficaria com a lista inteira
   * verde nesta tela e seria recusada por `symbol` no serviço.
   */
  it("o espaço não conta como símbolo — as duas exigências são independentes", () => {
    expect(leitura("Ventoo Sul77").meets("symbol")).toBe(false);
    expect(leitura("Ventoo Sul77").pending).toEqual(["symbol"]);
    expect(leitura("Vento# Sul77").meets("symbol")).toBe(true);
  });
});

/**
 * O BULLET DE CONFERÊNCIA e a trava do botão.
 *
 * Dono (2026-09-08): *"deve haver um bullet validando senha nova e repita a
 * senha nova. hoje isso não existe. Somente é possível enviar o formulário de
 * senha depois do usuário preencher ambos os campos corretamente."*
 */
describe("a conferência das duas senhas", () => {
  const EMAIL_QUALQUER = "quem.digita@empresa.com";
  const lista = (nova: string, repeticao: string, apontada: PasswordRequirement | null = null) =>
    PasswordChecklist.of(SafePassword.of(nova, EMAIL_QUALQUER), nova, repeticao, apontada);

  it("acende só quando a repetição é idêntica à senha nova", () => {
    expect(lista(SENHA_BOA, SENHA_BOA).meets(PASSWORD_CONFIRMATION_CHECK)).toBe(true);
    expect(lista(SENHA_BOA, "Outra# Coisa9").meets(PASSWORD_CONFIRMATION_CHECK)).toBe(false);
  });

  it("repetição vazia não confere, nem quando a senha nova também está vazia", () => {
    expect(lista(SENHA_BOA, "").meets(PASSWORD_CONFIRMATION_CHECK)).toBe(false);
    expect(lista("", "").meets(PASSWORD_CONFIRMATION_CHECK)).toBe(false);
  });

  /** A senha com espaço é comparada COMO FOI DIGITADA: nada é aparado. */
  it("a comparação não apara branco de ponta nenhuma", () => {
    expect(lista("Vento# Sul7 ", "Vento# Sul7").meets(PASSWORD_CONFIRMATION_CHECK)).toBe(false);
    expect(lista("Vento# Sul7 ", "Vento# Sul7 ").meets(PASSWORD_CONFIRMATION_CHECK)).toBe(true);
  });

  it("a conferência não é uma exigência do contrato — o servidor nunca a mede", () => {
    expect([...PASSWORD_REQUIREMENTS]).not.toContain(PASSWORD_CONFIRMATION_CHECK);
  });

  it("o botão só abre com a lista inteira fechada", () => {
    expect(lista(SENHA_BOA, SENHA_BOA).ready).toBe(true);
    expect(lista(SENHA_BOA, "Outra# Coisa9").ready).toBe(false);
    expect(lista(SENHA_BOA, "").ready).toBe(false);
    expect(lista("Vento#Sul7", "Vento#Sul7").ready).toBe(false);
    expect(lista("", "").ready).toBe(false);
  });

  it("a exigência apontada pelo serviço tranca o botão, mesmo parecendo de pé aqui", () => {
    const apontada = lista(SENHA_BOA, SENHA_BOA, "obvious-sequence");

    expect(apontada.meets("obvious-sequence")).toBe(false);
    expect(apontada.pointed("obvious-sequence")).toBe(true);
    expect(apontada.ready).toBe(false);
  });

  /**
   * A exigência que esta tela não consegue medir NÃO tranca: quem chega pelo
   * link antes de o convite dizer a quem é ficaria com o botão morto para
   * sempre, sem nada a consertar.
   */
  it("o que a tela não consegue medir não tranca o botão", () => {
    const semEmail = PasswordChecklist.of(
      SafePassword.withoutKnownEmail(SENHA_BOA),
      SENHA_BOA,
      SENHA_BOA,
    );

    expect(semEmail.cannotMeasure("own-email")).toBe(true);
    expect(semEmail.meets("own-email")).toBe(false);
    expect(semEmail.ready).toBe(true);
  });

  it("a conferência tem texto nos dois idiomas", () => {
    for (const [idioma, dicionario] of [
      ["pt", pt as Record<string, string>],
      ["en", en as Record<string, string>],
    ] as const) {
      expect(PASSWORD_CHECK_ITEM[PASSWORD_CONFIRMATION_CHECK] in dicionario, idioma).toBe(true);
      expect("password.submitBlocked" in dicionario, idioma).toBe(true);
    }
  });
});
