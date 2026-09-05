import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * ADR-0011, encerrado em 2026-09-05 — o blob `GET /api/v1/state` morreu. Cada
 * rota monta o `<ContextScope>` com as fatias que lê, e o servidor não tem
 * mais a rota. Esta catraca impede a volta pela porta dos fundos: nenhum
 * módulo de `src/` pode nomear a rota do blob, e o contrato gerado do
 * backend não pode voltar a tê-la.
 */
const raiz = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

function arquivosDe(pasta: string): string[] {
  return readdirSync(pasta).flatMap((nome) => {
    const caminho = join(pasta, nome);
    if (statSync(caminho).isDirectory()) return arquivosDe(caminho);
    return /\.(ts|tsx)$/.test(nome) ? [caminho] : [];
  });
}

describe("o blob /state morreu — e não volta", () => {
  it("nenhum módulo de src/ nomeia a rota do blob", () => {
    const culpados = arquivosDe(join(raiz, "src"))
      .filter((arquivo) => !arquivo.endsWith("api-contract.gen.ts"))
      .filter((arquivo) =>
        /apiPath\("\/state"\)|["'`]\/api\/v1\/state["'`]/.test(readFileSync(arquivo, "utf8")),
      )
      .map((arquivo) => arquivo.slice(raiz.length + 1));
    expect(culpados).toEqual([]);
  });

  it("o contrato gerado do backend não tem mais a rota", () => {
    const contrato = readFileSync(join(raiz, "src", "lib", "api-contract.gen.ts"), "utf8");
    expect(contrato.includes('"/api/v1/state"')).toBe(false);
  });
});
