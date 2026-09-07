import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { expect, it } from "vitest";

/**
 * Catraca por baseline só-desce — o mecanismo comum às regras "nenhum X em
 * `src/` além do que já existia quando a regra nasceu".
 *
 * Nasceu em `nenhuma-cor-fora-dos-tokens` e passou a servir a
 * `opacidade-sobre-token`, `tipografia-por-papel` e `espacamento-na-grade`
 * (regra de reuso: dois lugares, um helper). Cada catraca declara só o que a
 * distingue: como contar num arquivo e quais arquivos consome. A varredura, a
 * fixture, a regravação guardada e os três testes são os mesmos.
 *
 * Para regravar a baseline depois de remover ocorrências:
 * `<VARIAVEL>=1 npx vitest run tests/architecture/<catraca>.test.ts`
 * A regravação recusa subir: a soma nova precisa ser ≤ a soma gravada.
 */

export const raizDoFrontend = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

export class ArquivoFonte {
  constructor(
    readonly caminho: string,
    readonly conteudo: string,
  ) {}

  /** O caminho com `/` em qualquer sistema — é o que a fixture guarda. */
  get chave(): string {
    return this.caminho.split(sep).join("/");
  }

  ocorrencias(padrao: RegExp): number {
    return (this.conteudo.match(padrao) ?? []).length;
  }

  /** Código de tela escrito à mão: `.ts`/`.tsx`/`.css`, nunca o gerado. */
  get eFonteDeTela(): boolean {
    return !this.caminho.endsWith(".gen.ts") && /\.(ts|tsx|css)$/.test(this.caminho);
  }
}

export class Varredura {
  private readonly arquivos: ArquivoFonte[] = [];

  constructor(private readonly base: string = raizDoFrontend) {
    this.percorre(join(base, "src"));
  }

  private percorre(pasta: string): void {
    for (const nome of readdirSync(pasta)) {
      const caminho = join(pasta, nome);
      if (statSync(caminho).isDirectory()) {
        this.percorre(caminho);
        continue;
      }
      this.arquivos.push(
        new ArquivoFonte(relative(this.base, caminho), readFileSync(caminho, "utf8")),
      );
    }
  }

  contagem(
    conta: (arquivo: ArquivoFonte) => number,
    consome: (arquivo: ArquivoFonte) => boolean = (arquivo) => arquivo.eFonteDeTela,
  ): Record<string, number> {
    const resultado: Record<string, number> = {};
    for (const arquivo of this.arquivos) {
      if (!consome(arquivo)) continue;
      const total = conta(arquivo);
      if (total > 0) resultado[arquivo.chave] = total;
    }
    return Object.fromEntries(
      Object.entries(resultado).sort(([esquerda], [direita]) => esquerda.localeCompare(direita)),
    );
  }
}

export interface DefinicaoDeCatraca {
  /** Caminho absoluto da fixture com a baseline por arquivo. */
  readonly fixture: string;
  /** Variável de ambiente que autoriza regravar a baseline. */
  readonly variavelDeRegravacao: string;
  /** Quantas ocorrências o arquivo tem. */
  conta(arquivo: ArquivoFonte): number;
  /** Quais arquivos a régua olha (padrão: `.ts`/`.tsx`/`.css` não gerados). */
  consome?(arquivo: ArquivoFonte): boolean;
}

const soma = (mapa: Record<string, number>) =>
  Object.values(mapa).reduce((total, parcela) => total + parcela, 0);

export class Catraca {
  readonly atual: Record<string, number>;
  readonly baseline: Record<string, number>;

  constructor(private readonly definicao: DefinicaoDeCatraca) {
    this.atual = new Varredura().contagem(
      (arquivo) => definicao.conta(arquivo),
      definicao.consome ? (arquivo) => definicao.consome!(arquivo) : undefined,
    );
    this.baseline = JSON.parse(readFileSync(definicao.fixture, "utf8")) as Record<string, number>;
  }

  get total(): number {
    return soma(this.atual);
  }

  get regravando(): boolean {
    return process.env[this.definicao.variavelDeRegravacao] === "1";
  }

  /**
   * Os três testes de toda catraca. Quem chama coloca dentro do próprio
   * `describe`, e pode acrescentar os testes que só fazem sentido para ela.
   */
  registrarTestes(): void {
    if (this.regravando) {
      it("regrava a baseline — só para baixo", () => {
        if (Object.keys(this.baseline).length > 0) {
          expect(this.total).toBeLessThanOrEqual(soma(this.baseline));
        }
        writeFileSync(this.definicao.fixture, `${JSON.stringify(this.atual, null, 2)}\n`);
      });
      return;
    }

    it("nenhum arquivo de src/ piorou em relação à baseline", () => {
      const pioraram = Object.entries(this.atual)
        .filter(([arquivo, total]) => total > (this.baseline[arquivo] ?? 0))
        .map(
          ([arquivo, total]) =>
            `${arquivo}: ${String(total)} (baseline ${String(this.baseline[arquivo] ?? 0)})`,
        );
      expect(pioraram).toEqual([]);
    });

    it("a baseline não guarda entrada morta — arquivo limpo sai da fixture", () => {
      const mortas = Object.keys(this.baseline).filter(
        (arquivo) => (this.atual[arquivo] ?? 0) === 0,
      );
      expect(mortas).toEqual([]);
    });
  }
}
