import path from "node:path";

import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();

type OpcoesDeIdLength = { exceptions: string[] };

const excecoesPara = async (relativePath: string): Promise<string[]> => {
  const eslint = new ESLint({ cwd: repoRoot });
  const configuracao: unknown = await eslint.calculateConfigForFile(
    path.join(repoRoot, relativePath),
  );
  const regras = (configuracao as { rules: Record<string, unknown> }).rules;
  const [, opcoes] = regras["id-length"] as [string, OpcoesDeIdLength];
  return opcoes.exceptions;
};

const idLengthMessages = async (code: string, relativePath: string) => {
  const eslint = new ESLint({ cwd: repoRoot });
  const [result] = await eslint.lintText(code, { filePath: path.join(repoRoot, relativePath) });
  return (result?.messages ?? []).filter((message) => message.ruleId === "id-length");
};

describe("CQ-03 — nomes de uma letra em código novo", () => {
  it("reprova um identificador de uma letra escrito hoje", async () => {
    const messages = await idLengthMessages(
      "export const incrementar = (valores: number[]) => valores.map((n) => n + 1);\n",
      "e2e/id-length-fixture.ts",
    );

    expect(messages).toHaveLength(1);
    expect(messages[0]?.severity).toBe(2);
  });

  it("aceita o `t` do i18n, que é vocabulário estabelecido", async () => {
    const messages = await idLengthMessages(
      'export const rotulo = (t: (chave: string) => string) => t("mentor.new");\n',
      "e2e/id-length-fixture.ts",
    );

    expect(messages).toEqual([]);
  });

  it("aceita `_` como descarte explícito", async () => {
    const messages = await idLengthMessages(
      "export const segundo = ([_, valor]: [number, number]) => valor;\n",
      "e2e/id-length-fixture.ts",
    );

    expect(messages).toEqual([]);
  });

  it("libera os canais do espaço OKLab só nos arquivos de cor", async () => {
    const excecoes = await excecoesPara("src/lib/design/color.ts");

    expect(excecoes).toEqual(expect.arrayContaining(["l", "c", "h", "a", "b", "m", "s"]));
  });

  it("não libera esses canais fora dos arquivos de cor", async () => {
    const excecoes = await excecoesPara("src/lib/store.tsx");

    expect(excecoes).not.toContain("a");
    expect(excecoes).not.toContain("c");
  });
});
