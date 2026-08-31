import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import ts from "typescript";
import { describe, expect, it } from "vitest";

import en from "@/locales/en.json";
import pt from "@/locales/pt.json";

/**
 * Toda tela se explica — a catraca do `?`.
 *
 * Existe porque o dono pediu a MESMA coisa DUAS vezes. Primeiro sobre uma
 * tela; o orquestrador anotou e deixou cair. Depois, literalmente: "faltou o
 * interrogação explicativo em 'Régua do Time' e 'Calibração entre Líderes'".
 *
 * O `PageHelp` já existia e já estava em 17 telas. Nada cobrava a 18ª — então
 * tela nova nascia muda, e quem descobria era o dono, olhando a aplicação.
 * Uma pendência que reaparece é defeito de rede, não de memória: enquanto o
 * único verificador for alguém lembrar, ela volta uma terceira vez.
 *
 * A régua: todo `<PageHeader>` em `src/routes/` declara `help`. Inclusive o
 * do estado negado — é justamente ali que o texto da persona `member` explica
 * POR QUE aquela pessoa não vê a tela, e a tela negada é a que mais precisa
 * se explicar.
 *
 * Baseline SÓ DESCE, como a catraca de idioma. Tela que hoje não tem `?` está
 * nomeada abaixo; tela nova sem `?` é vermelho na hora. Pagar uma dívida
 * exige tirá-la da lista — a lista não encolhe sozinha nem cresce em silêncio.
 */

const AQUI = dirname(fileURLToPath(import.meta.url));
const ROTAS = resolve(AQUI, "../../src/routes");

/**
 * Telas cujo `PageHeader` ainda não declara `help`. **A lista está VAZIA** — a
 * catraca desceu a zero em 2026-08-31 e daqui em diante ela não é mais
 * ratchet, é regra: nenhuma tela pode nascer muda.
 * NÃO acrescente linha aqui. Uma tela nova que precise entrar nesta lista é
 * uma tela que devia ter ganhado o `?` junto com o resto.
 */
const SEM_EXPLICACAO_AINDA: readonly string[] = [];

/** As duas que o dono nomeou. Não podem voltar a ficar mudas. */
const PEDIDAS_PELO_DONO: readonly string[] = ["team-rules.tsx", "calibration.tsx"];

class Tela {
  constructor(
    readonly arquivo: string,
    readonly cabecalhos: number,
    readonly comAjuda: number,
  ) {}

  static ler(arquivo: string): Tela {
    const fonte = ts.createSourceFile(
      arquivo,
      readFileSync(join(ROTAS, arquivo), "utf8"),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );
    let cabecalhos = 0;
    let comAjuda = 0;
    const visitar = (no: ts.Node): void => {
      const marcacao = ts.isJsxSelfClosingElement(no)
        ? no
        : ts.isJsxOpeningElement(no)
          ? no
          : undefined;
      if (marcacao && marcacao.tagName.getText(fonte) === "PageHeader") {
        cabecalhos += 1;
        if (Tela.declaraAjuda(marcacao, fonte)) comAjuda += 1;
      }
      ts.forEachChild(no, visitar);
    };
    visitar(fonte);
    return new Tela(arquivo, cabecalhos, comAjuda);
  }

  private static declaraAjuda(
    marcacao: ts.JsxSelfClosingElement | ts.JsxOpeningElement,
    fonte: ts.SourceFile,
  ): boolean {
    return marcacao.attributes.properties.some(
      (atributo) =>
        ts.isJsxAttribute(atributo) &&
        atributo.name.getText(fonte) === "help" &&
        atributo.initializer !== undefined,
    );
  }

  get muda(): boolean {
    return this.cabecalhos > this.comAjuda;
  }
}

/**
 * O `?` existir não é o mesmo que o `?` dizer alguma coisa.
 *
 * `usePageHelp("x")` monta as chaves `help.x.<persona>.<campo>` e o `t()` devolve a
 * própria chave quando ela não existe. Sem esta varredura, uma tela podia passar na
 * catraca acima e abrir o popover mostrando `help.notices.lead.what` cru para o
 * usuário — verde por fora, oco por dentro. O teste de i18n não pega isso: ele
 * confere pt contra en, e uma chave que falta nos DOIS está em paridade perfeita.
 */
class ChavesDaAjuda {
  private static readonly PERSONAS = ["lead", "member"] as const;
  private static readonly CAMPOS = ["title", "what", "comesFrom", "nextStep"] as const;

  static pedidasPelasTelas(): readonly string[] {
    const fontes = ChavesDaAjuda.arquivosDe(resolve(AQUI, "../../src"));
    const rotas = new Set<string>();
    for (const arquivo of fontes) {
      for (const achado of readFileSync(arquivo, "utf8").matchAll(/usePageHelp\("([^"]+)"\)/g)) {
        const rota = achado[1];
        if (rota !== undefined) rotas.add(rota);
      }
    }
    return [...rotas].flatMap((rota) =>
      ChavesDaAjuda.PERSONAS.flatMap((persona) =>
        ChavesDaAjuda.CAMPOS.map((campo) => `help.${rota}.${persona}.${campo}`),
      ),
    );
  }

  private static arquivosDe(raiz: string): string[] {
    return readdirSync(raiz, { withFileTypes: true }).flatMap((entrada) => {
      const caminho = join(raiz, entrada.name);
      if (entrada.isDirectory()) return ChavesDaAjuda.arquivosDe(caminho);
      return /\.tsx?$/.test(entrada.name) ? [caminho] : [];
    });
  }
}

const telas = readdirSync(ROTAS)
  .filter((arquivo) => arquivo.endsWith(".tsx") && !arquivo.endsWith(".gen.tsx"))
  .map((arquivo) => Tela.ler(arquivo))
  .filter((tela) => tela.cabecalhos > 0);

describe("toda tela se explica", () => {
  it("varre alguma coisa — se a varredura vier vazia, a catraca é decorativa", () => {
    expect(telas.length).toBeGreaterThan(15);
  });

  it("as telas mudas são EXATAMENTE as reconhecidas como dívida", () => {
    const mudas = telas
      .filter((tela) => tela.muda)
      .map((tela) => tela.arquivo)
      .sort();
    expect(mudas).toEqual([...SEM_EXPLICACAO_AINDA].sort());
  });

  it.each(PEDIDAS_PELO_DONO)("%s tem o ? que o dono pediu, em TODO PageHeader", (arquivo) => {
    const tela = telas.find((t) => t.arquivo === arquivo);
    expect(tela, `${arquivo} não foi varrida`).toBeDefined();
    expect(tela?.cabecalhos).toBeGreaterThan(0);
    expect(tela?.comAjuda).toBe(tela?.cabecalhos);
  });

  it("a lista de dívida não guarda tela já paga", () => {
    const jaPagas = SEM_EXPLICACAO_AINDA.filter(
      (arquivo) => !telas.find((tela) => tela.arquivo === arquivo)?.muda,
    );
    expect(jaPagas, "tire da lista: a catraca só desce quando a lista desce junto").toEqual([]);
  });

  it("toda chave de ajuda que uma tela pede EXISTE, nos dois idiomas", () => {
    const pedidas = ChavesDaAjuda.pedidasPelasTelas();
    expect(pedidas.length, "nenhuma tela chama usePageHelp — a varredura quebrou").toBeGreaterThan(
      100,
    );
    const dicionarios: ReadonlyArray<readonly [string, Record<string, unknown>]> = [
      ["pt", pt as Record<string, unknown>],
      ["en", en as Record<string, unknown>],
    ];
    const ausentes = dicionarios.flatMap(([idioma, dicionario]) =>
      pedidas
        .filter((chave) => typeof dicionario[chave] !== "string")
        .map((chave) => `${idioma}:${chave}`),
    );
    expect(ausentes, "o popover mostraria a chave crua para o usuário").toEqual([]);
  });

  it("nenhuma ajuda é texto vazio — o ? abriria em branco", () => {
    const vazias = ChavesDaAjuda.pedidasPelasTelas().filter(
      (chave) => ((pt as Record<string, unknown>)[chave] as string | undefined)?.trim() === "",
    );
    expect(vazias).toEqual([]);
  });
});
