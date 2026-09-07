import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { Bloco } from "../helpers/folha-de-estilo";
import { raizDoFrontend } from "../helpers/catraca";

/**
 * "Sombra só no que flutua" (`styles.css`, superfície sem sombra) — e as
 * primitivas de formulário contradiziam a regra ([E-01]): `button`, `input`,
 * `textarea`, `checkbox`, `badge` e `FilterTriggerButton` traziam
 * `shadow`/`shadow-sm`, e o login removia à mão. Prova do vermelho no dia:
 * 6 arquivos com sombra.
 *
 * O que flutua lê um dos dois tokens de elevação: `raised` (popover, menu,
 * tooltip) e `overlay` (diálogo, sheet, toast).
 */
const PRIMITIVAS_DE_FORMULARIO = [
  "src/components/ui/button.tsx",
  "src/components/ui/input.tsx",
  "src/components/ui/textarea.tsx",
  "src/components/ui/checkbox.tsx",
  "src/components/ui/badge.tsx",
  "src/components/app/FilterTriggerButton.tsx",
];

describe("sombra só no que flutua", () => {
  it("nenhuma primitiva de formulário carrega classe de sombra", () => {
    const comSombra = PRIMITIVAS_DE_FORMULARIO.filter((caminho) =>
      /\bshadow(?:-[a-z0-9]+)?\b/.test(readFileSync(join(raizDoFrontend, caminho), "utf8")),
    );
    expect(comSombra).toEqual([]);
  });

  it("os dois tokens de elevação existem nos dois temas", () => {
    for (const seletor of [":root {", "\n.dark {"]) {
      const bloco = Bloco.de(seletor);
      expect(bloco.valorDe("--elevation-raised"), seletor).toMatch(/^0 /);
      expect(bloco.valorDe("--elevation-overlay"), seletor).toMatch(/^0 /);
    }
  });
});
