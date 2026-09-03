import { describe, expect, it } from "vitest";

import en from "@/locales/en.json";
import pt from "@/locales/pt.json";

/**
 * Item 4 do pedido do dono, literal: *"o PageHelp de cada tela que ganhar IA
 * diz o que a IA faz e o que ela NÃO decide."*
 *
 * A metade que importa é a segunda, e é a que some primeiro. Contar o que a
 * IA FAZ é fácil — o botão já conta. O que nenhuma tela diz por acidente é o
 * limite: que ela sugere e não aprova, que o número continua sendo do
 * sistema, que a decisão continua sendo de quem lê. Sem isto, um assistente
 * de apoio vira, na cabeça de quem usa, um assistente que decide — e aí a
 * frase "IA sugere, humano decide" existe só nos nossos ADRs.
 *
 * A régua é mecânica de propósito, para poder ser cobrada: a ajuda da persona
 * que ALCANÇA a IA precisa dizer as duas coisas, nas duas línguas. `LIMITE`
 * é a segunda metade; `PAPEL` é a primeira. Tela que ganhar assistente novo
 * entra nesta lista no mesmo commit — a lista é o inventário de quem tem IA
 * na tela, e é o que impede a próxima nascer sem o limite escrito.
 */
const TELAS_COM_IA = [
  "architectProfile",
  "architectRoadmap",
  "mentoring",
  "calibration",
  "competencyMatrix",
] as const;

const PAPEL = { pt: /\bA IA\b/, en: /\bThe AI\b/ };
const LIMITE = { pt: /não decide/i, en: /does not decide/i };

class AjudaDaTela {
  constructor(
    readonly rota: string,
    private readonly dicionario: Record<string, string>,
    private readonly idioma: "pt" | "en",
  ) {}

  private get texto(): string {
    return ["what", "comesFrom", "nextStep"]
      .map((campo) => this.dicionario[`help.${this.rota}.lead.${campo}`] ?? "")
      .join(" ");
  }

  get contaOPapel(): boolean {
    return PAPEL[this.idioma].test(this.texto);
  }

  get contaOLimite(): boolean {
    return LIMITE[this.idioma].test(this.texto);
  }
}

const ajudas = (idioma: "pt" | "en", dicionario: Record<string, string>) =>
  TELAS_COM_IA.map((rota) => new AjudaDaTela(rota, dicionario, idioma));

describe("a ajuda de toda tela com IA diz o que a IA faz e o que ela NÃO decide", () => {
  for (const [idioma, dicionario] of [
    ["pt", pt as Record<string, string>],
    ["en", en as Record<string, string>],
  ] as const) {
    it(`${idioma}: cada tela com assistente conta o papel da IA`, () => {
      const mudas = ajudas(idioma, dicionario)
        .filter((ajuda) => !ajuda.contaOPapel)
        .map((ajuda) => ajuda.rota);
      expect(mudas).toEqual([]);
    });

    it(`${idioma}: cada tela com assistente diz o que a IA NÃO decide`, () => {
      const semLimite = ajudas(idioma, dicionario)
        .filter((ajuda) => !ajuda.contaOLimite)
        .map((ajuda) => ajuda.rota);
      expect(semLimite).toEqual([]);
    });
  }

  it("o inventário não está vazio — catraca vazia é catraca decorativa", () => {
    expect(TELAS_COM_IA.length).toBeGreaterThanOrEqual(5);
  });
});
