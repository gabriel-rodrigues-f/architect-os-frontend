import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { EmptyState } from "@/components/app/ui-bits";
import { HelpField } from "@/components/app/PageHelp";
import { SentenceLines } from "@/lib/sentence-lines";
import en from "@/locales/en.json";
import pt from "@/locales/pt.json";

/**
 * Referência FIAP 2026-09-06, §2 item 9: "frases curtas, uma por linha, em
 * blocos de três" — nos textos de ajuda ("?") e nos estados vazios, que eram
 * parágrafos. Leitura em dois segundos.
 *
 * Duas réguas: cada campo de ajuda tem no máximo DUAS frases (o bloco de três
 * campos vira no máximo seis linhas), e o componente que mostra ajuda ou
 * estado vazio quebra uma frase por linha. Pergunta e resposta ("Fila vazia?
 * Nada pendente.") contam como uma frase: a pergunta é o gancho da resposta.
 */

afterEach(cleanup);

const MAXIMO_DE_FRASES = 2;

class CampoDeAjuda {
  constructor(
    readonly chave: string,
    readonly texto: string,
  ) {}

  get frases(): number {
    return new SentenceLines(this.texto).lines.length;
  }
}

const camposDe = (dicionario: Record<string, string>) =>
  Object.entries(dicionario)
    .filter(([chave]) => chave.startsWith("help."))
    .map(([chave, texto]) => new CampoDeAjuda(chave, texto));

describe("SentenceLines", () => {
  it("quebra por ponto final e exclamação, e cola a pergunta na resposta", () => {
    expect(
      new SentenceLines("Fila vazia? Nada pendente. Item na fila? Clique nele.").lines,
    ).toEqual(["Fila vazia? Nada pendente.", "Item na fila? Clique nele."]);
  });

  it("não quebra em abreviação nem número", () => {
    expect(new SentenceLines("Proponha o portfólio (mín. 3 capacidades). Pronto.").lines).toEqual([
      "Proponha o portfólio (mín. 3 capacidades).",
      "Pronto.",
    ]);
  });

  it("limita o bloco a três linhas quando pedido — a quarta frase se junta à terceira", () => {
    expect(new SentenceLines("Um. Dois. Três. Quatro.").atMost(3)).toEqual([
      "Um.",
      "Dois.",
      "Três. Quatro.",
    ]);
  });
});

describe("cada campo de ajuda tem no máximo duas frases", () => {
  for (const [idioma, dicionario] of [
    ["pt", pt as Record<string, string>],
    ["en", en as Record<string, string>],
  ] as const) {
    it(`${idioma}: nenhum help.* passa de ${MAXIMO_DE_FRASES} frases`, () => {
      const longos = camposDe(dicionario)
        .filter((campo) => campo.frases > MAXIMO_DE_FRASES)
        .map((campo) => `${campo.chave} (${campo.frases})`);
      expect(longos).toEqual([]);
    });
  }
});

describe("ajuda e estado vazio mostram uma frase por linha", () => {
  it("HelpField quebra o texto por frase", () => {
    const { container } = render(
      <HelpField label="O que é" text="Primeira frase. Segunda frase." />,
    );
    expect(container.querySelectorAll("br")).toHaveLength(1);
    expect(screen.getByText("Primeira frase. Segunda frase.")).toBeTruthy();
  });

  it("EmptyState quebra a dica por frase e continua achável pelo texto inteiro", () => {
    const { container } = render(
      <EmptyState title="Nada aqui" hint="Cadastre alguém. Depois volte." />,
    );
    expect(container.querySelectorAll("br")).toHaveLength(1);
    expect(screen.getByText("Cadastre alguém. Depois volte.")).toBeTruthy();
  });
});
