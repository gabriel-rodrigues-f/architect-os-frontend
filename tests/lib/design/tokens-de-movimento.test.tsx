import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

/**
 * Referência FIAP 2026-09-06, §2 item 6: "transições de 200–300 ms em todo
 * controle — hoje temos valores variados". Três tokens (`--motion-fast`,
 * `--motion-base`, `--motion-slow`) e uma curva; as primitivas usam a classe
 * `transition-base`, não um número. Com `prefers-reduced-motion`, as durações
 * vão a zero no CSS — quem respeita o token respeita a preferência de graça.
 */

const css = readFileSync(resolve(process.cwd(), "src/styles.css"), "utf8");

class Bloco {
  constructor(private readonly corpo: string) {}

  static de(seletor: string): Bloco {
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

  get existe(): boolean {
    return this.corpo.length > 0;
  }
}

afterEach(cleanup);

describe("tokens de movimento", () => {
  it("existem em :root com a escala pedida", () => {
    const raiz = Bloco.de(":root {");
    expect(raiz.declara("--motion-fast", "150ms")).toBe(true);
    expect(raiz.declara("--motion-base", "250ms")).toBe(true);
    expect(raiz.declara("--motion-slow", "350ms")).toBe(true);
    expect(raiz.declara("--motion-ease", "cubic-bezier")).toBe(true);
  });

  it("prefers-reduced-motion zera as três durações", () => {
    const reduzido = Bloco.de("@media (prefers-reduced-motion: reduce)");
    expect(reduzido.existe).toBe(true);
    for (const token of ["--motion-fast", "--motion-base", "--motion-slow"]) {
      expect(reduzido.declara(token, "0ms"), token).toBe(true);
    }
  });

  it("o padrão do Tailwind passa a ler os tokens — `transition-colors` solto já obedece", () => {
    expect(css).toMatch(/--default-transition-duration:\s*var\(--motion-fast\)/);
    expect(css).toMatch(/--default-transition-timing-function:\s*var\(--motion-ease\)/);
  });

  it("as utilities transition-fast/base/slow lêem os tokens, não números", () => {
    for (const [nome, token] of [
      ["transition-fast", "--motion-fast"],
      ["transition-base", "--motion-base"],
      ["transition-slow", "--motion-slow"],
    ]) {
      const bloco = Bloco.de(`@utility ${nome} {`);
      expect(bloco.existe, nome).toBe(true);
      expect(bloco.declara("transition-duration", `var(${token})`), nome).toBe(true);
      expect(bloco.declara("transition-timing-function", "var(--motion-ease)"), nome).toBe(true);
    }
  });

  it("nenhuma duração em milissegundos sobrou fora dos tokens no CSS", () => {
    const foraDosTokens = css
      .split("\n")
      .filter((linha) => /\d+ms/.test(linha) && !/--motion-(fast|base|slow):/.test(linha));
    expect(foraDosTokens).toEqual([]);
  });
});

describe("as primitivas usam a classe, não um número", () => {
  it("Button e Badge carregam transition-base", () => {
    const { container } = render(
      <>
        <Button>ok</Button>
        <Badge>ok</Badge>
      </>,
    );
    for (const el of Array.from(container.children)) {
      expect(el.className).toContain("transition-base");
    }
  });

  it("nenhum componente escreve duration-<número> — só duration-(--motion-*)", () => {
    const fontes = [
      "src/components/app/AppShell.tsx",
      "src/components/ui/dialog.tsx",
      "src/components/ui/sheet.tsx",
    ];
    for (const arquivo of fontes) {
      const texto = readFileSync(resolve(process.cwd(), arquivo), "utf8");
      expect(texto, arquivo).not.toMatch(/duration-\d+/);
    }
  });

  it("os itens do menu lateral e as abas da ficha usam transition-base", () => {
    const shell = readFileSync(resolve(process.cwd(), "src/components/app/AppShell.tsx"), "utf8");
    const bits = readFileSync(resolve(process.cwd(), "src/components/app/ui-bits.tsx"), "utf8");
    expect(
      shell.match(/rounded-lg px-3 py-2\.5 text-sm[^"]*transition-base/g)?.length ?? 0,
    ).toBeGreaterThanOrEqual(2);
    expect(bits).toMatch(/border-b-2 px-1 pb-2 text-sm font-medium transition-base/);
  });
});

describe("superfície interativa — hover em cartão e linha com ação", () => {
  it("uma utility só: elevação discreta e brilho de um nível, ambos por token", () => {
    const bloco = Bloco.de("@utility surface-interactive {");
    expect(bloco.existe).toBe(true);
    expect(bloco.declara("transition-duration", "var(--motion-base)")).toBe(true);
    expect(bloco.declara("box-shadow", "var(--elevation-hover)")).toBe(true);
    expect(bloco.declara("background-color", "var(--surface-hover)")).toBe(true);
  });

  it("é aplicada nos cartões do Time e nas linhas com ação (Painel e tabela do Time)", () => {
    const team = readFileSync(resolve(process.cwd(), "src/components/app/team-shared.tsx"), "utf8");
    const painel = readFileSync(resolve(process.cwd(), "src/routes/index.tsx"), "utf8");
    expect(team.match(/surface-interactive/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
    expect(painel.match(/surface-interactive/g)?.length ?? 0).toBeGreaterThanOrEqual(3);
  });
});
