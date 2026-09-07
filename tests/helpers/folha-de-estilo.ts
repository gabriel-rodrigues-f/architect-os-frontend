import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * A folha de estilo da casa, lida uma vez, e um bloco dela recortado por
 * seletor — para o teste provar o que um token ou uma utility declara sem
 * renderizar CSS. Nasceu em `tokens-de-movimento` e passou a servir também à
 * composição do login (regra de reuso: dois lugares, um helper).
 */
export const folhaDeEstilo = readFileSync(resolve(process.cwd(), "src/styles.css"), "utf8");

export class Bloco {
  constructor(private readonly corpo: string) {}

  static de(seletor: string, css: string = folhaDeEstilo): Bloco {
    const inicio = css.indexOf(seletor);
    if (inicio === -1) return new Bloco("");
    let profundidade = 0;
    for (let cursor = css.indexOf("{", inicio); cursor < css.length; cursor += 1) {
      if (css[cursor] === "{") profundidade += 1;
      if (css[cursor] === "}") profundidade -= 1;
      if (profundidade === 0) return new Bloco(css.slice(inicio, cursor + 1));
    }
    return new Bloco(css.slice(inicio));
  }

  declara(propriedade: string, valor: string): boolean {
    return new RegExp(`${propriedade}:\\s*${valor.replace(/[()]/g, "\\$&")}`).test(this.corpo);
  }

  /** O valor declarado para a propriedade, ou `null` se o bloco não a declara. */
  valorDe(propriedade: string): string | null {
    const match = new RegExp(`${propriedade}:\\s*([^;]+);`).exec(this.corpo);
    return match?.[1]?.trim() ?? null;
  }

  contem(trecho: string): boolean {
    return this.corpo.includes(trecho);
  }

  get existe(): boolean {
    return this.corpo.length > 0;
  }
}
