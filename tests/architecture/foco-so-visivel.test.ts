import { describe, expect, it } from "vitest";

import { Bloco } from "../helpers/folha-de-estilo";
import { Varredura } from "../helpers/catraca";

/**
 * O anel de foco é um só ([A-01]): a utility `focus-ring` (borda no primário
 * e halo de `--focus-ring-width` a 8%, o foco do login) aplicada por
 * `focus-visible:` — o teclado ganha anel, o clique do mouse não. `focus:`
 * pintava anel no clique em `badge`, `dialog` e `sheet`. Prova do vermelho
 * no dia: 3 arquivos com `focus:ring`.
 */
const FOCO_SEM_VISIBLE = /(?<![\w-])focus:(?:ring|outline)/g;

describe("foco só por focus-visible", () => {
  it("nenhum `focus:ring`/`focus:outline` sem `-visible` em src/", () => {
    expect(new Varredura().contagem((arquivo) => arquivo.ocorrencias(FOCO_SEM_VISIBLE))).toEqual(
      {},
    );
  });

  it("a utility focus-ring é o foco do login: borda primária e halo na largura do token", () => {
    const utility = Bloco.de("@utility focus-ring");
    expect(utility.existe).toBe(true);
    expect(utility.declara("border-color", "var(--color-primary)")).toBe(true);
    expect(utility.contem("var(--focus-ring-width)")).toBe(true);
    expect(utility.contem("var(--focus-ring) 8%")).toBe(true);
    expect(Bloco.de(":root {").valorDe("--focus-ring-width")).toBe("3px");
  });

  it("as primitivas de components/ui aplicam a utility por focus-visible", () => {
    const primitivas = new Varredura().contagem(
      (arquivo) => arquivo.ocorrencias(/focus-visible:focus-ring/g),
      (arquivo) =>
        /src\/components\/ui\/(button|input|textarea|checkbox|badge|dialog|sheet)\.tsx$/.test(
          arquivo.chave,
        ),
    );
    expect(Object.keys(primitivas).sort()).toEqual([
      "src/components/ui/badge.tsx",
      "src/components/ui/button.tsx",
      "src/components/ui/checkbox.tsx",
      "src/components/ui/dialog.tsx",
      "src/components/ui/input.tsx",
      "src/components/ui/sheet.tsx",
      "src/components/ui/textarea.tsx",
    ]);
  });
});
