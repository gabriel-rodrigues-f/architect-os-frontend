import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * ONDA 44 — nenhum módulo lê um token de `ui-bits` no ESCOPO DO MÓDULO.
 *
 * O defeito que esta catraca fecha custou um canário abortado em produção, e
 * nenhuma etapa do gate o viu:
 *
 *   const CHIP_BY_TONE = { warning: semanticTone.warning };   // NoticeList.tsx
 *
 * `semanticTone` mora em `ui-bits`, e o grafo de importação da casa tem ciclo.
 * Na ordem em que o pacote de SSR de PRODUÇÃO inicializa os módulos, este
 * arquivo chegava a rodar antes de `ui-bits` terminar — e o mapa nascia lendo
 * `undefined.warning`. O processo subia, a sonda de prontidão respondia 500, e
 * o Argo voltou para a versão estável.
 *
 * Por que os testes não pegaram: em jsdom, o Vite resolve os módulos noutra
 * ordem e o ciclo não morde. Por que o `build` não pegou: ele compila, não
 * executa. O sintoma só existe no pacote de servidor, rodando.
 *
 * A regra, então, é sobre a FORMA: token se lê na hora de desenhar, dentro de
 * componente ou de função. Aí não há ordem a acertar — quando alguém renderiza,
 * todo módulo já carregou.
 */
const raizDoRepositorio = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const FONTE = join(raizDoRepositorio, "src");

/** Os tokens exportados por `ui-bits` que são objeto e costumam virar mapa. */
const TOKENS = ["semanticTone"];

const PASTAS_IGNORADAS = new Set(["node_modules", "dist", ".output", ".nitro"]);

function arquivosDeFonte(pasta: string): string[] {
  return readdirSync(pasta).flatMap((entrada) => {
    if (PASTAS_IGNORADAS.has(entrada)) return [];
    const caminho = join(pasta, entrada);
    if (statSync(caminho).isDirectory()) return arquivosDeFonte(caminho);
    return /\.tsx?$/.test(entrada) ? [caminho] : [];
  });
}

/**
 * Uma linha está no escopo do módulo quando não tem recuo NENHUM ou está dentro
 * de um literal que começou no escopo do módulo. Aproximação suficiente e
 * honesta: o que se procura é `const X = { ... token.y ... }` no topo do
 * arquivo, e é assim que ele se escreve.
 */
function leituraNoEscopoDoModulo(conteudo: string): number[] {
  const linhas = conteudo.split("\n");
  const achados: number[] = [];
  let dentroDeConstDeModulo = false;
  linhas.forEach((linha, indice) => {
    // Abre um literal de módulo — e a seta é o que separa o perigoso do
    // correto: `const X = {` roda no carregamento; `const x = () => ({` roda
    // quando alguém chama.
    if (/^(export )?const \w+[^=]*=\s*[[{]\s*$/.test(linha) && !linha.includes("=>")) {
      dentroDeConstDeModulo = true;
    } else if (dentroDeConstDeModulo && /^[}\])];?$/.test(linha.trim())) {
      dentroDeConstDeModulo = false;
    }

    if (!dentroDeConstDeModulo) return;
    if (TOKENS.some((token) => linha.includes(`${token}.`))) achados.push(indice + 1);
  });
  return achados;
}

describe("token de aparência não se lê no escopo do módulo", () => {
  it("nenhum arquivo de src/ monta um mapa de tokens fora de função", () => {
    const achados = arquivosDeFonte(FONTE)
      .filter((caminho) => !caminho.endsWith("ui-bits.tsx"))
      .flatMap((caminho) =>
        leituraNoEscopoDoModulo(readFileSync(caminho, "utf8")).map(
          (linha) => `${caminho.replace(raizDoRepositorio, ".")}:${linha}`,
        ),
      );

    expect(achados).toEqual([]);
  });

  it("a catraca reconhece a forma que quebrou o canário", () => {
    const comoEstava = [
      "const CHIP_BY_TONE: Record<NoticeTone, string> = {",
      '  info: "bg-secondary",',
      "  warning: semanticTone.warning,",
      "};",
    ].join("\n");

    expect(leituraNoEscopoDoModulo(comoEstava)).toEqual([3]);
  });

  it("e aceita a forma corrigida — leitura dentro de função", () => {
    const comoFicou = [
      "const chipByTone = (): Record<NoticeTone, string> => ({",
      "  warning: semanticTone.warning,",
      "});",
    ].join("\n");

    // A função é chamada na hora de desenhar; não há ordem de inicialização a
    // acertar. A catraca enxerga a diferença pela seta.
    expect(leituraNoEscopoDoModulo(comoFicou)).toEqual([]);
  });
});
