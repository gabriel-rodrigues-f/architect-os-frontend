import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * Disciplina de cor (referência FIAP 2026-09-06, §2 item 3): "o primário só em
 * CTA e estado ativo; badges e níveis com os tokens de nível; nenhum azul fora
 * dos tokens". A percepção de premium vem da economia de cor — e a economia
 * morre no dia em que alguém escreve `#7cb8ff` num componente porque o token
 * "não tinha o tom certo".
 *
 * A régua é mecânica: nenhum literal de cor (hex, rgb/rgba, oklch) em `src/`
 * fora de `styles.css` (a paleta) e de `src/lib/design/` (o gerador que
 * escreve a paleta — é a fonte, não um consumidor). Tudo o mais lê um token:
 * `var(--x)`, `bg-primary`, `text-level-3-fg`.
 *
 * A baseline gravada na fixture nomeia as exceções que existiam quando a
 * catraca nasceu (fallback de canvas quando o CSS ainda não carregou, página
 * de erro sem stylesheet, sombra de tooltip) e SÓ DESCE. Para regravar após
 * remover literais:
 * `ATUALIZAR_BASELINE_CORES=1 npx vitest run tests/architecture/nenhuma-cor-fora-dos-tokens.test.ts`
 */

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const FIXTURE = join(raiz, "tests", "architecture", "nenhuma-cor-fora-dos-tokens.fixture.json");
const PALETA = join("src", "styles.css");
const GERADOR = `${join("src", "lib", "design")}${sep}`;

const LITERAL_DE_COR = /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\boklch\(/g;

class ArquivoFonte {
  constructor(
    readonly caminho: string,
    private readonly conteudo: string,
  ) {}

  get literais(): number {
    return (this.conteudo.match(LITERAL_DE_COR) ?? []).length;
  }

  get eConsumidorDaPaleta(): boolean {
    return (
      this.caminho !== PALETA &&
      !this.caminho.startsWith(GERADOR) &&
      !this.caminho.endsWith(".gen.ts") &&
      /\.(ts|tsx|css)$/.test(this.caminho)
    );
  }
}

class Varredura {
  private readonly arquivos: ArquivoFonte[] = [];

  constructor(private readonly base: string) {
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

  get contagem(): Record<string, number> {
    const resultado: Record<string, number> = {};
    for (const arquivo of this.arquivos) {
      if (!arquivo.eConsumidorDaPaleta || arquivo.literais === 0) continue;
      resultado[arquivo.caminho.split(sep).join("/")] = arquivo.literais;
    }
    return Object.fromEntries(
      Object.entries(resultado).sort(([esquerda], [direita]) => esquerda.localeCompare(direita)),
    );
  }
}

const atual = new Varredura(raiz).contagem;
const baseline = JSON.parse(readFileSync(FIXTURE, "utf8")) as Record<string, number>;

describe("nenhuma cor literal fora dos tokens", () => {
  if (process.env["ATUALIZAR_BASELINE_CORES"] === "1") {
    it("regrava a baseline — só para baixo", () => {
      const soma = (mapa: Record<string, number>) =>
        Object.values(mapa).reduce((total, parcela) => total + parcela, 0);
      if (Object.keys(baseline).length > 0) expect(soma(atual)).toBeLessThanOrEqual(soma(baseline));
      writeFileSync(FIXTURE, `${JSON.stringify(atual, null, 2)}\n`);
    });
    return;
  }

  it("nenhum arquivo de src/ ganhou literal de cor além da baseline", () => {
    const pioraram = Object.entries(atual)
      .filter(([arquivo, literais]) => literais > (baseline[arquivo] ?? 0))
      .map(([arquivo, literais]) => `${arquivo}: ${literais} (baseline ${baseline[arquivo] ?? 0})`);
    expect(pioraram).toEqual([]);
  });

  it("a baseline não guarda entrada morta — arquivo limpo sai da fixture", () => {
    const mortas = Object.keys(baseline).filter((arquivo) => (atual[arquivo] ?? 0) === 0);
    expect(mortas).toEqual([]);
  });

  it("a paleta continua sendo a única fonte de oklch fora do gerador", () => {
    const css = readFileSync(join(raiz, PALETA), "utf8");
    expect(css.match(/oklch\(/g)?.length ?? 0).toBeGreaterThan(50);
  });
});
