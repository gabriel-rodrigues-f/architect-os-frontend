import { describe, expect, it } from "vitest";

import en from "@/locales/en.json";
import pt from "@/locales/pt.json";

/**
 * ONDA 37, item 4 do pedido: *"PageHelp de /users e /team reescritos dizendo
 * quem cadastra quem e onde cada coisa muda. Nenhuma tela fala mais em
 * especialização da pessoa."*
 *
 * O "?" das duas telas era a documentação do modelo ANTIGO — duas entidades,
 * dois cadastros: `help.users.lead.nextStep` mandava "vincular a conta ao
 * cadastro dele no Time", que é exatamente a operação que deixou de existir,
 * e `help.team.lead.what` listava especialização como atributo da pessoa.
 * Ajuda que descreve o modelo errado é pior que ajuda nenhuma: ela manda a
 * pessoa procurar um botão que não existe mais.
 */

const PT = pt as Record<string, string>;
const EN = en as Record<string, string>;

const ajudaDe = (dicionario: Record<string, string>) =>
  Object.entries(dicionario).filter(([chave]) => chave.startsWith("help."));

describe("a ajuda de /users diz quem cadastra quem", () => {
  it("nomeia os campos do cadastro — cargo, senioridade e time", () => {
    const texto = `${PT["help.users.lead.what"]} ${PT["help.users.lead.comesFrom"]}`.toLowerCase();
    for (const palavra of ["cargo", "senioridade", "time"]) {
      expect(texto, palavra).toContain(palavra);
    }
  });

  it("diz que gestor e tech lead cadastram no time deles", () => {
    const texto = Object.entries(PT)
      .filter(([chave]) => chave.startsWith("help.users."))
      .map(([, valor]) => valor)
      .join(" ")
      .toLowerCase();
    expect(texto).toContain("gestor");
    expect(texto).toContain("tech lead");
  });

  it("não manda mais vincular a conta ao cadastro do Time — essa operação morreu", () => {
    for (const dicionario of [PT, EN]) {
      const texto = Object.entries(dicionario)
        .filter(([chave]) => chave.startsWith("help.users."))
        .map(([, valor]) => valor)
        .join(" ")
        .toLowerCase();
      expect(texto).not.toContain("vincule");
      expect(texto).not.toContain("link it");
    }
  });
});

describe("a ajuda de /team diz onde cada coisa muda", () => {
  it("aponta Usuários como o lugar do cadastro, e o diálogo como o lugar do time e do nível", () => {
    const texto = Object.entries(PT)
      .filter(([chave]) => chave.startsWith("help.team."))
      .map(([, valor]) => valor)
      .join(" ");
    expect(texto).toContain("Usuários");
    expect(texto).toContain("Mudar time ou nível");
  });

  it("não promete mais cadastrar, editar nem desativar nesta tela", () => {
    const texto = (PT["help.team.lead.nextStep"] ?? "").toLowerCase();
    expect(texto).not.toContain("desative");
    expect(texto).not.toContain("o lápis");
  });
});

describe("nenhuma ajuda fala em especialização da pessoa", () => {
  it("a palavra saiu dos dois dicionários", () => {
    const comEspecializacao = [
      ...ajudaDe(PT).filter(([, valor]) => /especializa/i.test(valor)),
      ...ajudaDe(EN).filter(([, valor]) => /specializ/i.test(valor)),
    ].map(([chave]) => chave);

    expect(comEspecializacao).toEqual([]);
  });
});
