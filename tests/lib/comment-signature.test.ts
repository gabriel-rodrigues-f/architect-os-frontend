import { describe, expect, it } from "vitest";

import { defaultCommentSignature } from "@/lib/comment-signature";
import pt from "@/locales/pt.json";
import en from "@/locales/en.json";
import type { MessageKey } from "@/lib/i18n";

/**
 * A ASSINATURA do comentário, isolada da tela.
 *
 * Ordem do dono (2026-09-09): a pessoa é reconhecida pelo nome + sobrenome, e
 * não pelo cargo. Os três casos moram aqui porque a régua é uma só e a tela é
 * cara de montar — mas o que este ensaio protege de verdade é o TERCEIRO: a
 * ausência tem de ter uma frase, e essa frase não pode voltar a dizer cargo.
 */
const traduz =
  (dicionario: Record<string, string>) =>
  (key: MessageKey): string =>
    dicionario[key] ?? key;

const emPortugues = traduz(pt as unknown as Record<string, string>);
const emIngles = traduz(en as unknown as Record<string, string>);

describe("a assinatura do comentário é a pessoa", () => {
  it("a própria fala assina 'Você' — o atalho de quem varre a lista", () => {
    expect(defaultCommentSignature.of({ authorName: "Helena Braga" }, true, emPortugues)).toBe(
      "Você",
    );
  });

  it("a fala de outra pessoa assina com nome e sobrenome", () => {
    expect(
      defaultCommentSignature.of({ authorName: "Marina Vasconcelos Prado" }, false, emPortugues),
    ).toBe("Marina Prado");
  });

  it("sem autor, a assinatura é a frase da casa para ausência — nunca um cargo", () => {
    expect(defaultCommentSignature.of({ authorName: null }, false, emPortugues)).toBe("alguém");
  });

  /** A ausência é frase de dicionário; um texto fixo em TS não atravessaria idioma. */
  it("a ausência acompanha o idioma de quem lê", () => {
    expect(defaultCommentSignature.of({ authorName: null }, false, emIngles)).toBe("someone");
    expect(defaultCommentSignature.of({ authorName: "Helena Braga" }, true, emIngles)).toBe("You");
  });

  /** O nome NÃO é traduzido: ele é da pessoa, e é o mesmo em qualquer idioma. */
  it("o nome não muda de idioma", () => {
    const pessoa = { authorName: "Marina Vasconcelos Prado" };

    expect(defaultCommentSignature.of(pessoa, false, emIngles)).toBe(
      defaultCommentSignature.of(pessoa, false, emPortugues),
    );
  });
});
