import { describe, expect, it } from "vitest";

import { SynapseInk, type TokenReader } from "@/components/app/SynapseBackground";
import { CONTRAST, DarkTheme, LightTheme, tokenRegistry, type ThemeStrategy } from "@/lib/design";
import { Bloco } from "../../helpers/folha-de-estilo";

/**
 * O VERMELHO DA REDE FICOU MAIS SUAVE — pedido literal do dono (2026-09-08):
 * "o vermelho da sinapse de erro está muito forte, precisa ser mais suave".
 *
 * A escolha registrada aqui é DE ONDE a rede tira o vermelho, e não quanto de
 * opacidade o pincel usa: baixar a opacidade apagaria o pulso inteiro — as
 * linhas, o brilho, a leitura de que ALGUMA COISA aconteceu —, e o que
 * precisava ceder era só a cor. Por isso existe `--synapse-danger`: o
 * destrutivo recuado na direção do fundo do tema, um valor por tema.
 *
 * Os três invariantes: o pincel LÊ o token da rede (e não o dos campos); o
 * token existe nos dois temas, gerado do destrutivo e do fundo; e ele é
 * mesmo mais suave — menos contraste contra o fundo do que o destrutivo
 * cheio, que continua inteiro nos campos e nos Callouts.
 */
class LeitorEspiao implements TokenReader {
  readonly lidos: string[] = [];

  constructor(private readonly valores: Readonly<Record<string, string>> = {}) {}

  read(name: string, fallback: string): string {
    this.lidos.push(name);
    return this.valores[name] ?? fallback;
  }
}

const temas: ReadonlyArray<readonly [string, ThemeStrategy]> = [
  ["claro", new LightTheme()],
  ["escuro", new DarkTheme()],
];

describe("o pincel da rede lê o vermelho DELA", () => {
  it("o tom `danger` é `--synapse-danger`; `--destructive` não é lido em lugar nenhum", () => {
    const leitor = new LeitorEspiao({
      "--primary": "oklch(0.55 0.15 235)",
      "--synapse-danger": "oklch(0.436 0.137 25)",
    });
    const tinta = SynapseInk.read(leitor, "#7cb8ff");

    expect(leitor.lidos).toContain("--synapse-danger");
    expect(leitor.lidos).not.toContain("--destructive");
    expect(tinta.of("danger")).toBe("oklch(0.436 0.137 25)");
    expect(tinta.of("primary")).toBe("oklch(0.55 0.15 235)");
    expect(SynapseInk.TOKEN).toEqual({ primary: "--primary", danger: "--synapse-danger" });
  });

  it("sem o token na folha, o perigo cai no azul — a rede nunca fica invisível", () => {
    const tinta = SynapseInk.read(new LeitorEspiao(), "#7cb8ff");
    expect(tinta.of("danger")).toBe("#7cb8ff");
  });
});

describe("--synapse-danger existe nos dois temas", () => {
  it("está no registro de tokens, com par de contraste declarado", () => {
    const token = tokenRegistry.get("synapse-danger");
    expect(token?.group).toBe("theme");
    expect(token?.contrastAgainst).toBe("background");
    expect(token?.minContrast).toBe(CONTRAST.decorative);
  });

  it("a folha de estilo emite o valor nos dois temas e o registra no @theme", () => {
    const light = new LightTheme();
    const dark = new DarkTheme();
    const token = tokenRegistry.get("synapse-danger")!;
    expect(Bloco.de("@theme inline").contem("--color-synapse-danger: var(--synapse-danger);")).toBe(
      true,
    );
    expect(Bloco.de(":root {").valorDe("--synapse-danger")).toBe(light.resolve(token).toCss());
    expect(Bloco.de("\n.dark {").valorDe("--synapse-danger")).toBe(dark.resolve(token).toCss());
  });

  it("continua sendo VERMELHO: o matiz é o do destrutivo, nos dois temas", () => {
    for (const [nome, tema] of temas) {
      const suave = tema.resolve(tokenRegistry.get("synapse-danger")!);
      const cheio = tema.resolve(tokenRegistry.get("destructive")!);
      expect(Math.abs(suave.h - cheio.h), nome).toBeLessThanOrEqual(1);
    }
  });
});

describe("mais suave é uma medida, não uma opinião", () => {
  it("contrasta MENOS com o fundo do que o destrutivo cheio, nos dois temas", () => {
    for (const [nome, tema] of temas) {
      const fundo = tema.resolve(tokenRegistry.get("background")!);
      const suave = tema.resolve(tokenRegistry.get("synapse-danger")!);
      const cheio = tema.resolve(tokenRegistry.get("destructive")!);
      expect(suave.contrastWith(fundo), nome).toBeLessThan(cheio.contrastWith(fundo));
      // …e continua visível: o piso da tinta decorativa.
      expect(suave.contrastWith(fundo), nome).toBeGreaterThanOrEqual(CONTRAST.decorative);
    }
  });

  it("é menos saturado que o destrutivo — o que o olho lê como 'forte'", () => {
    for (const [nome, tema] of temas) {
      const suave = tema.resolve(tokenRegistry.get("synapse-danger")!);
      const cheio = tema.resolve(tokenRegistry.get("destructive")!);
      expect(suave.c, nome).toBeLessThan(cheio.c);
    }
  });

  it("o destrutivo CHEIO continua onde o aviso é o assunto: campos e Callouts", () => {
    expect(Bloco.de("@theme inline").contem("--color-destructive: var(--destructive);")).toBe(true);
    expect(Bloco.de(".auth-alert").contem("var(--color-destructive)")).toBe(true);
  });
});
