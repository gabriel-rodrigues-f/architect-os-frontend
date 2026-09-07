import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Dono (2026-09-08, referência FIAP): "é só quando eu selecionar texto
 * clicando no mouse, não por passar o mouse por cima; não quero pintar o
 * texto, ele deve agir como um marcador". Fundo azul do botão do login no
 * tema escuro, azul-marinho no claro, texto branco por cima — e NADA no hover.
 */
const css = readFileSync(join(process.cwd(), "src", "styles.css"), "utf8");

/** O trecho entre a abertura de um bloco e a abertura do seguinte (blocos aninhados não confundem). */
const trechoEntre = (abertura: string, proxima: string): string => {
  const inicio = css.indexOf(abertura);
  expect(inicio, `bloco ${abertura}`).toBeGreaterThanOrEqual(0);
  const fim = css.indexOf(proxima, inicio + abertura.length);
  return css.slice(inicio, fim < 0 ? undefined : fim);
};
const blocoDe = (seletor: ":root" | ".dark"): string =>
  seletor === ":root"
    ? trechoEntre(":root {", "\n.dark {")
    : trechoEntre("\n.dark {", "::selection");

describe("a seleção de texto é um marca-texto com tokens por tema", () => {
  it("declara --selection e --selection-foreground no tema claro e no escuro, com valores distintos", () => {
    const claro = blocoDe(":root");
    const escuro = blocoDe(".dark");
    const valor = (bloco: string, nome: string) =>
      bloco.match(new RegExp(`--${nome}:\\s*([^;]+);`))?.[1]?.trim();
    expect(valor(claro, "selection")).toBeTruthy();
    expect(valor(escuro, "selection")).toBeTruthy();
    expect(valor(claro, "selection")).not.toBe(valor(escuro, "selection"));
    expect(valor(claro, "selection-foreground")).toBeTruthy();
    expect(valor(escuro, "selection-foreground")).toBeTruthy();
  });

  it("no escuro, a seleção é o azul do botão do login — que desde [P-01] é o --primary do próprio tema escuro", () => {
    const escuro = blocoDe(".dark");
    const primarioDoEscuro = escuro.match(/--primary:\s*([^;]+);/)?.[1]?.trim();
    expect(primarioDoEscuro).toBeTruthy();
    expect(escuro).toContain(`--selection: ${primarioDoEscuro};`);
  });

  it("::selection usa os tokens e não existe hover pintando texto de forma global", () => {
    expect(css).toMatch(/::selection\s*\{[^}]*background(-color)?:\s*var\(--selection\)/);
    expect(css).toMatch(/::selection\s*\{[^}]*color:\s*var\(--selection-foreground\)/);
    expect(css).not.toMatch(/\*:hover\s*\{/);
  });
});
