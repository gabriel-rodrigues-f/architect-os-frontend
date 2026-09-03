import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * A catraca do "inativo some".
 *
 * Pedido literal do dono (2026-09-03): "quando eu desativar um profissional,
 * ao invés de aparecer como inativo, ele não deve mais aparecer em nenhuma
 * parte da aplicação."
 *
 * A régua virou ESTRUTURA, não vigilância: `store.architects` é a lista ATIVA
 * e o acesso ao cru tem nome próprio, `architectsIncludingInactive`. Assim uma
 * tela nova acerta por padrão — quem quiser inativo precisa PEDIR pelo nome, e
 * quem pede fica visível aqui.
 *
 * A exceção é uma só, declarada ao dono: a tela Time, com o filtro de status,
 * é o único lugar onde o administrador reencontra quem desativou (sem ela a
 * desativação seria irreversível pela interface). Esta lista NÃO cresce sem
 * decisão do dono — se um arquivo novo aparecer aqui, alguém reabriu a porta.
 */

const AQUI = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(AQUI, "../../src");

const QUEM_PODE_VER_INATIVO: readonly string[] = [
  "components/app/team-shared.tsx",
  "lib/store.tsx",
  "routes/team.tsx",
];

class ArquivoDeFonte {
  constructor(
    readonly caminho: string,
    readonly conteudo: string,
  ) {}

  static todos(diretorio: string = SRC): ArquivoDeFonte[] {
    return readdirSync(diretorio, { withFileTypes: true }).flatMap((entrada) => {
      const completo = join(diretorio, entrada.name);
      if (entrada.isDirectory()) return ArquivoDeFonte.todos(completo);
      if (!/\.tsx?$/.test(entrada.name)) return [];
      return [
        new ArquivoDeFonte(
          relative(SRC, completo).split("\\").join("/"),
          readFileSync(completo, "utf8"),
        ),
      ];
    });
  }

  get leInativo(): boolean {
    return this.conteudo.includes("architectsIncludingInactive");
  }
}

describe("inativo só aparece na tela Time", () => {
  const arquivos = ArquivoDeFonte.todos();

  it("nenhum arquivo além dos declarados lê a lista com inativos", () => {
    const leitores = arquivos.filter((fonte) => fonte.leInativo).map((fonte) => fonte.caminho);
    expect([...leitores].sort()).toEqual([...QUEM_PODE_VER_INATIVO].sort());
  });

  it("a exceção continua existindo: Time lê a lista com inativos, senão a reativação some", () => {
    const time = arquivos.find((fonte) => fonte.caminho === "routes/team.tsx");
    expect(time?.leInativo).toBe(true);
  });

  it("o sufixo '(inativo)' não existe mais em nenhum seletor", () => {
    const comSufixo = arquivos
      .filter((fonte) => fonte.conteudo.includes("architectCombobox.inactiveName"))
      .map((fonte) => fonte.caminho);
    expect(comSufixo).toEqual([]);
  });
});
